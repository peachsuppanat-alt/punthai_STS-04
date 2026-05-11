// src/project_feature/logoUtils.js
// Improved bg removal + multi-format download

/**
 * โหลดรูปและลบพื้นหลังสีขาว — ใช้ Flood-Fill จากขอบรูป + Edge Anti-aliasing
 * แม่นกว่าวิธีเดิมเพราะลบเฉพาะสีขาวที่ "ติดกับขอบ" — ไม่กระทบสีขาวภายในโลโก้
 */
export function removeWhiteBackground(imageUrl, threshold = 245) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            const W = canvas.width, H = canvas.height;

            const isWhitish = (idx) => {
                const r = data[idx*4], g = data[idx*4+1], b = data[idx*4+2];
                return r >= threshold && g >= threshold && b >= threshold;
            };

            // ===== Flood-fill จาก edge ของรูป =====
            // ลบเฉพาะ "พื้นหลังจริง" ที่ติดกับขอบ ไม่กระทบส่วนภายในโลโก้
            const visited = new Uint8Array(W * H);
            const stack = [];
            for (let x = 0; x < W; x++) {
                stack.push(x);
                stack.push((H - 1) * W + x);
            }
            for (let y = 0; y < H; y++) {
                stack.push(y * W);
                stack.push(y * W + (W - 1));
            }
            while (stack.length > 0) {
                const idx = stack.pop();
                if (idx < 0 || idx >= W * H) continue;
                if (visited[idx]) continue;
                if (!isWhitish(idx)) continue;
                visited[idx] = 1;
                data[idx * 4 + 3] = 0;
                const x = idx % W, y = (idx / W) | 0;
                if (x > 0) stack.push(idx - 1);
                if (x < W - 1) stack.push(idx + 1);
                if (y > 0) stack.push(idx - W);
                if (y < H - 1) stack.push(idx + W);
            }

            // ===== Edge Anti-aliasing =====
            // pixel ที่ติดกับขอบ transparent + เป็นสีอ่อน → ลด alpha ตามความอ่อน
            const alphaBuffer = new Uint8ClampedArray(W * H);
            for (let i = 0; i < W * H; i++) alphaBuffer[i] = data[i * 4 + 3];

            for (let y = 0; y < H; y++) {
                for (let x = 0; x < W; x++) {
                    const idx = y * W + x;
                    if (data[idx * 4 + 3] === 0) continue;

                    let transparentNbrs = 0;
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            const nx = x + dx, ny = y + dy;
                            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
                            if (data[(ny * W + nx) * 4 + 3] === 0) transparentNbrs++;
                        }
                    }

                    if (transparentNbrs > 0) {
                        const r = data[idx * 4], g = data[idx * 4 + 1], b = data[idx * 4 + 2];
                        const luminance = r * 0.299 + g * 0.587 + b * 0.114;
                        if (luminance > 210) {
                            const whitenessFactor = (luminance - 210) / 45;
                            const edgeFactor = transparentNbrs / 8;
                            const reduction = whitenessFactor * edgeFactor * 255;
                            alphaBuffer[idx] = Math.max(0, 255 - reduction);
                        }
                    }
                }
            }
            for (let i = 0; i < W * H; i++) data[i * 4 + 3] = alphaBuffer[i];

            ctx.putImageData(imageData, 0, 0);
            canvas.toBlob(blob => {
                resolve({ canvas, dataUrl: canvas.toDataURL('image/png'), blob });
            }, 'image/png');
        };
        img.onerror = reject;
        img.src = imageUrl;
    });
}

/**
 * โหลดรูปต้นฉบับ — composite onto white bg
 */
export function loadImageWithBg(imageUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            resolve({ canvas, img });
        };
        img.onerror = reject;
        img.src = imageUrl;
    });
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function downloadString(text, filename, mime) {
    downloadBlob(new Blob([text], { type: mime }), filename);
}

export async function downloadAsPNG(imageUrl, filename = 'logo.png') {
    const { blob } = await removeWhiteBackground(imageUrl);
    downloadBlob(blob, filename);
}

export async function downloadAsJPG(imageUrl, filename = 'logo.jpg') {
    const { canvas } = await loadImageWithBg(imageUrl);
    canvas.toBlob(blob => downloadBlob(blob, filename), 'image/jpeg', 0.95);
}

export async function downloadAsSVG(imageUrl, filename = 'logo.svg') {
    const { dataUrl, canvas } = await removeWhiteBackground(imageUrl);
    const w = canvas.width, h = canvas.height;
    const svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <image xlink:href="${dataUrl}" width="${w}" height="${h}"/>
</svg>`;
    downloadString(svg, filename, 'image/svg+xml');
}

/**
 * EPS แบบ Type 1 RGB image (มาตรฐานที่ Illustrator + InDesign + โรงพิมพ์ทุกที่รองรับ)
 * พื้นหลังขาว — ถ้าต้องการ vector โปร่งให้ใช้ SVG แทน
 * ไฟล์จะใหญ่ ~5-7MB สำหรับ 1024×1024 เพราะใช้ ASCIIHex (ไม่ compress)
 */
export async function downloadAsEPS(imageUrl, filename = 'logo.eps') {
    const { canvas } = await loadImageWithBg(imageUrl);
    const w = canvas.width, h = canvas.height;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const HEX = '0123456789abcdef';
    const parts = [];
    let lineLen = 0;
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        parts.push(
            HEX[(r >> 4) & 0xF], HEX[r & 0xF],
            HEX[(g >> 4) & 0xF], HEX[g & 0xF],
            HEX[(b >> 4) & 0xF], HEX[b & 0xF]
        );
        lineLen += 6;
        if (lineLen >= 78) { parts.push('\n'); lineLen = 0; }
    }
    const hex = parts.join('');

    const eps = `%!PS-Adobe-3.0 EPSF-3.0
%%BoundingBox: 0 0 ${w} ${h}
%%HiResBoundingBox: 0 0 ${w} ${h}
%%Creator: Punthai Platform
%%Title: ${filename}
%%LanguageLevel: 2
%%Pages: 1
%%EndComments
%%Page: 1 1
gsave
0 0 translate
${w} ${h} scale
/DeviceRGB setcolorspace

  /ImageType 1
  /Width ${w}
  /Height ${h}
  /BitsPerComponent 8
  /Decode [0 1 0 1 0 1]
  /ImageMatrix [${w} 0 0 -${h} 0 ${h}]
  /DataSource currentfile /ASCIIHexDecode filter
>> image
${hex}>
grestore
showpage
%%EOF
`;
    downloadString(eps, filename, 'application/postscript');
}

export async function downloadAsPDF(imageUrl, filename = 'logo.pdf') {
    const { jsPDF } = await import('jspdf');
    const { canvas } = await loadImageWithBg(imageUrl);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const w = canvas.width, h = canvas.height;
    const orientation = w > h ? 'landscape' : 'portrait';
    const pdf = new jsPDF({ orientation, unit: 'px', format: [w, h] });
    pdf.addImage(dataUrl, 'JPEG', 0, 0, w, h);
    pdf.save(filename);
}

export async function downloadLogo(imageUrl, format, baseFilename = 'logo') {
    const fmt = format.toLowerCase().replace('.', '');
    const ext = fmt === 'jpeg' ? 'jpg' : fmt;
    const fname = `${baseFilename}.${ext}`;
    switch (fmt) {
        case 'png': return downloadAsPNG(imageUrl, fname);
        case 'jpg':
        case 'jpeg': return downloadAsJPG(imageUrl, fname);
        case 'svg': return downloadAsSVG(imageUrl, fname);
        case 'eps': return downloadAsEPS(imageUrl, fname);
        case 'pdf': return downloadAsPDF(imageUrl, fname);
        default: throw new Error('Unsupported format: ' + format);
    }
}

export async function loadLogoTransparent(logoUrl) {
    if (!logoUrl) return null;
    try {
        const { dataUrl } = await removeWhiteBackground(logoUrl);
        return dataUrl;
    } catch (e) {
        console.warn('Could not remove logo background:', e);
        return logoUrl;
    }
}