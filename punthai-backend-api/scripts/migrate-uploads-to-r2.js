// ============================================================================
// scripts/migrate-uploads-to-r2.js
// One-time migration: upload every file under uploads/ to Cloudflare R2,
// preserving the relative path as the object key.
//
// Usage (from punthai-backend-api/):
//   node scripts/migrate-uploads-to-r2.js
//
// Requires the same R2_* env vars as the app (loads .env automatically).
// Safe to re-run: it skips objects that already exist in the bucket.
// After a successful run you can stop committing uploads/ to git:
//   git rm -r --cached uploads && git commit -m "stop tracking uploads (moved to R2)"
// ============================================================================
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    console.error('❌ Missing R2 env vars (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET).');
    process.exit(1);
}

const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

const MIME = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
    '.gif': 'image/gif', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.ai': 'application/postscript',
};
const ct = (f) => MIME[path.extname(f).toLowerCase()] || 'application/octet-stream';

const ROOT = path.join(process.cwd(), 'uploads');

function* walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) yield* walk(full);
        else yield full;
    }
}

async function exists(key) {
    try { await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key })); return true; }
    catch { return false; }
}

let uploaded = 0, skipped = 0, failed = 0;
for (const file of walk(ROOT)) {
    const key = path.relative(ROOT, file).split(path.sep).join('/'); // e.g. generated/x.png
    try {
        if (await exists(key)) { skipped++; continue; }
        await s3.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: fs.readFileSync(file), ContentType: ct(file) }));
        uploaded++;
        if (uploaded % 25 === 0) console.log(`  ...uploaded ${uploaded}`);
    } catch (e) {
        failed++;
        console.error(`  ✗ ${key}: ${e.message}`);
    }
}

console.log(`\n✅ Done. uploaded=${uploaded} skipped(existing)=${skipped} failed=${failed} (bucket: ${R2_BUCKET})`);
