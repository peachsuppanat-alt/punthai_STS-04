// ============================================================================
// storage.js — Object storage helper (Cloudflare R2, S3-compatible)
// ----------------------------------------------------------------------------
// Design goals:
//  - Keep DB values in the SAME format as before ("/uploads/<key>") so the
//    frontend needs ZERO changes.
//  - When R2 env vars are set  -> new files go to R2, and GET /uploads/<key>
//    redirects to the R2 public URL (unless the file exists locally).
//  - When R2 env vars are NOT set -> behave exactly like before (local disk).
//    This makes the migration safe to deploy incrementally.
// ============================================================================
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

const {
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET,
    R2_PUBLIC_URL, // e.g. https://pub-xxxxxxxx.r2.dev  (or your custom domain)
} = process.env;

export const USE_R2 = Boolean(
    R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET && R2_PUBLIC_URL
);

const PUBLIC_BASE = (R2_PUBLIC_URL || '').replace(/\/+$/, '');
const LOCAL_ROOT = path.join(process.cwd(), 'uploads');

// Accept either the bare account id OR a full endpoint URL pasted by mistake
// (e.g. "https://<id>.r2.cloudflarestorage.com") — normalise to just the id.
const ACCOUNT_ID = (R2_ACCOUNT_ID || '')
    .replace(/^https?:\/\//i, '')
    .replace(/\.r2\.cloudflarestorage\.com.*$/i, '')
    .replace(/\/+$/, '')
    .trim();

let s3 = null;
if (USE_R2) {
    s3 = new S3Client({
        region: 'auto',
        endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    });
    console.log(`🗄️  Storage: Cloudflare R2 enabled (bucket: ${R2_BUCKET})`);
} else {
    console.log('🗄️  Storage: local disk (uploads/) — R2 env not set');
}

const MIME = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf', '.ai': 'application/postscript',
};
function guessContentType(key) {
    return MIME[path.extname(key).toLowerCase()] || 'application/octet-stream';
}

// Normalise a stored value / path into an R2 key (strip leading slash + "uploads/").
export function toKey(ref) {
    return String(ref || '').replace(/^https?:\/\/[^/]+\//i, '').replace(/^\/+/, '').replace(/^uploads\//, '');
}

// Build the public URL for a key (only meaningful when R2 is enabled).
export function publicUrl(key) {
    return `${PUBLIC_BASE}/${toKey(key)}`;
}

// ---------------------------------------------------------------------------
// saveBuffer(relKey, buffer, contentType?)
//   relKey: path under uploads/, e.g. "generated/logo_123.png" or "123.png"
//   returns the value to store in DB: "/uploads/<relKey>"  (unchanged format)
// ---------------------------------------------------------------------------
export async function saveBuffer(relKey, buffer, contentType) {
    const key = toKey(relKey);
    const ct = contentType || guessContentType(key);
    if (USE_R2) {
        await s3.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: buffer, ContentType: ct }));
    } else {
        const dest = path.join(LOCAL_ROOT, key);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, buffer);
    }
    return `/uploads/${key}`;
}

// Save an in-memory multer file (requires multer.memoryStorage()).
//   folder: '' for root, or 'patterns', 'generated', ...
//   returns { key, filename, url } where url = "/uploads/<key>"
export async function saveUpload(file, folder = '') {
    const ext = path.extname(file.originalname || '') || guessExt(file.mimetype);
    const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    const key = folder ? `${toKey(folder)}/${filename}` : filename;
    await saveBuffer(key, file.buffer, file.mimetype);
    return { key, filename, url: `/uploads/${key}` };
}
function guessExt(mime) {
    if (!mime) return '';
    if (mime.includes('png')) return '.png';
    if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg';
    if (mime.includes('webp')) return '.webp';
    if (mime.includes('pdf')) return '.pdf';
    return '';
}

// ---------------------------------------------------------------------------
// loadBuffer(ref) -> Buffer
//   Accepts: full http(s) URL, "/uploads/xxx", "uploads/xxx", or a bare key.
//   Resolution order: external URL -> local file -> R2 public URL.
// ---------------------------------------------------------------------------
export async function loadBuffer(ref) {
    if (!ref) throw new Error('loadBuffer: empty ref');
    if (/^https?:\/\//i.test(ref)) {
        const resp = await axios.get(ref, { responseType: 'arraybuffer' });
        return Buffer.from(resp.data);
    }
    const key = toKey(ref);
    const local = path.join(LOCAL_ROOT, key);
    if (fs.existsSync(local)) return fs.readFileSync(local);
    if (USE_R2) {
        const resp = await axios.get(publicUrl(key), { responseType: 'arraybuffer' });
        return Buffer.from(resp.data);
    }
    throw new Error(`loadBuffer: not found -> ${ref}`);
}

// Express handler for GET /uploads/*.
// Serves the local file if present; otherwise streams the object FROM R2 through
// this backend (same-origin) instead of redirecting. Same-origin serving means
// the app's existing CORS applies and there is no cross-origin redirect — which
// some browsers (e.g. Samsung Internet) mishandle for crossOrigin <img>/canvas.
export async function uploadsHandler(req, res) {
    const key = toKey(decodeURIComponent(req.path));
    if (!key || key.includes('..')) return res.status(400).end();
    const local = path.join(LOCAL_ROOT, key);
    if (fs.existsSync(local)) return res.sendFile(local);
    if (!USE_R2) return res.status(404).end();
    try {
        const obj = await s3.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
        if (obj.ContentType) res.setHeader('Content-Type', obj.ContentType);
        if (obj.ContentLength != null) res.setHeader('Content-Length', obj.ContentLength);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        obj.Body.on('error', () => { res.headersSent ? res.destroy() : res.status(502).end(); });
        obj.Body.pipe(res);
    } catch (e) {
        if (e?.$metadata?.httpStatusCode === 404 || e?.name === 'NoSuchKey') return res.status(404).end();
        console.error('uploadsHandler R2 error:', e?.message);
        return res.status(502).end();
    }
}
