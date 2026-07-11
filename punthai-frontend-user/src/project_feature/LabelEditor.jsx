// =====================================================================
// LabelEditor.jsx — ฟีเจอร์ออกแบบฉลากสินค้า (ปรับปรุงใหม่: ต้องเลือก Packaging ก่อน)
// =====================================================================
import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { toCanvas as htiToCanvas } from 'html-to-image';

// จับภาพพรีวิวด้วย html-to-image (foreignObject) แทน html2canvas
// เพราะ html2canvas ตัดคำไทยผิด ทำให้ตัวอักษรเว้นวรรค — foreignObject ให้เบราว์เซอร์เรนเดอร์เอง (ตรงกับพรีวิว 100%)
const captureLabelCanvas = async (node, scale = 2) => {
    return await htiToCanvas(node, {
        pixelRatio: scale,
        backgroundColor: null,
        cacheBust: false, // true จะเติม ?query ต่อท้าย src รวมถึง data URL ของโลโก้ → data URL พัง → img error → canvas taint
        style: { transform: 'none', margin: '0' }, // กันการ scale/zoom ของพรีวิวติดไปด้วย
    });
};
import { jsPDF } from 'jspdf';
import './LabelEditor.css';

import { QRCodeSVG } from 'qrcode.react';
import Barcode from 'react-barcode';

// memoize QR/Barcode — ไม่ให้สร้างใหม่ทุก re-render ตอนลาก/ขยับ (คำนวณหนัก) นอกจากค่าจะเปลี่ยน
const MemoQR = React.memo(function MemoQR({ value, size }) {
    return <QRCodeSVG value={value} size={size} />;
});
const MemoBarcode = React.memo(function MemoBarcode({ value, height, fontSize, width, margin }) {
    return <Barcode value={value} height={height} fontSize={fontSize} width={width} margin={margin} />;
});


import { loadLogoTransparent } from './logoUtils';
import { PACKAGES, CATEGORIES } from './PackageCatalog';
import { getUserFromStorage, isProUser } from '../utils/subscriptionGuard';
import ProUpgradeModal from '../components/ProUpgradeModal';
import { API_URL } from '../config';

const API = `${API_URL}`;

// ============= CONSTANTS =============
const TEMPLATE_TYPES = [
    { id: 'centered_classic', name: 'จัดกลาง', desc: 'โลโก้กลาง ทุกอย่างจัดกึ่งกลาง' },
    { id: 'modern_side', name: 'จัดซ้าย', desc: 'โลโก้ซ้าย ข้อความชิดซ้าย' },
    { id: 'premium_frame', name: 'จัดขวา', desc: 'กรอบเส้นบาง สไตล์หรูหรา' },
    { id: 'minimal_strip', name: 'กำหนดเอง', desc: 'ชื่อใหญ่ แถบข้อมูลด้านล่าง' },
];

const CERT_OPTIONS = [
    { id: 'fda', label: 'อย.', img: '/src/assets/อย.png' },
    { id: 'halal', label: 'ฮาลาล', img: '/src/assets/halal.png' },
    { id: 'otop', label: 'OTOP', img: '/src/assets/OTOP_Logo.svg' },
    { id: 'gmp', label: 'GMP', img: '/src/assets/gmp.png' },
    { id: 'organic', label: 'ออร์แกนิก', img: '/src/assets/ดาวน์โหลด.png' },
    { id: 'tisi', label: 'มผช./มอก.', img: '/src/assets/มผช.png' },
    { id: 'vegan', label: 'Vegan', img: '/src/assets/Vegan.png' },
    { id: 'sugar_free', label: 'ปลอดน้ำตาล', img: null },
];

// ============= CERTIFICATION CATALOG (จากโฟลเดอร์ src/assets/ตรา) =============
// โหลดรูปตราทุกแบบจากทุกโฟลเดอร์ (Vite eager glob → คืน URL ที่ bundle ให้)
const CERT_IMAGE_MODULES = import.meta.glob('../assets/ตรา/**/*.png', { eager: true, query: '?url', import: 'default' });

// จัดกลุ่มตามชื่อโฟลเดอร์ + เรียงไฟล์ตามเลข (1.png, 2.png, ...)
const CERT_GROUPS = (() => {
    const groups = {};
    for (const path in CERT_IMAGE_MODULES) {
        const m = path.match(/\/ตรา\/(.+)\/([^/]+)\.png$/);
        if (!m) continue;
        (groups[m[1]] ||= []).push({ file: m[2], url: CERT_IMAGE_MODULES[path] });
    }
    for (const f in groups) groups[f].sort((a, b) => a.file.localeCompare(b.file, undefined, { numeric: true }));
    return groups;
})();

// เมตาดาทาแต่ละประเภทตรา (ลำดับการแสดง + ป้ายภาษาไทย) — variants ดึงจากโฟลเดอร์
const CERT_CATEGORIES = [
    { id: 'fda',         folder: 'อย',                                  label: 'อย.' },
    { id: 'halal',       folder: 'ฮาลาล',                               label: 'ฮาลาล' },
    { id: 'otop',        folder: 'OTOP',                                label: 'OTOP' },
    { id: 'gmp',         folder: 'GMP',                                 label: 'GMP' },
    { id: 'haccp',       folder: 'HACCP',                               label: 'HACCP' },
    { id: 'organic',     folder: 'Organic Thailand',                    label: 'ออร์แกนิก' },
    { id: 'ttm',         folder: 'Thailand Trust Mark',                 label: 'Thailand Trust Mark' },
    { id: 'healthier',   folder: 'ทางเลือกสุขภาพ',                       label: 'ทางเลือกสุขภาพ' },
    { id: 'sugarfree',   folder: 'ปลอดน้ำตาล',                          label: 'ปลอดน้ำตาล' },
    { id: 'tisi',        folder: 'มอก',                                 label: 'มอก.' },
    { id: 'acfs',        folder: 'รับรองมาตรฐานสินค้าเกษตรและอาหาร',    label: 'มกอช.' },
    { id: 'crueltyfree', folder: 'ไม่ทดลองกับสัตว์ Cruelty-Free',        label: 'Cruelty-Free' },
].map(c => ({ ...c, variants: CERT_GROUPS[c.folder] || [] })).filter(c => c.variants.length > 0);

// แมปไอดีเก่า (ข้อมูลที่เคยบันทึกเป็น string) → ประเภทใหม่ เพื่อ backward-compat
const LEGACY_CERT_MAP = { fda: 'fda', halal: 'halal', otop: 'otop', gmp: 'gmp', organic: 'organic', tisi: 'tisi', vegan: 'crueltyfree', sugar_free: 'sugarfree' };

// คืน id ของรายการตราที่เลือก (รองรับทั้ง object ใหม่ และ string เก่า)
const certEntryId = (c) => (typeof c === 'object' && c ? c.id : LEGACY_CERT_MAP[c] || c);
// คืน URL รูปของรายการตราที่เลือก
const certEntryUrl = (c) => {
    if (typeof c === 'object' && c) return c.url;
    const cat = CERT_CATEGORIES.find(x => x.id === (LEGACY_CERT_MAP[c] || c));
    return cat?.variants[0]?.url || null;
};

const BG_STYLES = [
    { id: 'minimal', label: 'มินิมอล' }, { id: 'thai_traditional', label: 'ลายไทยร่วมสมัย' },
    { id: 'nature', label: 'ธรรมชาติ-ใบไม้' }, { id: 'watercolor', label: 'Watercolor' },
    { id: 'geometric', label: 'Geometric' }, { id: 'vintage', label: 'วินเทจ' },
];

const USAGE_OPTIONS = ['ชงในน้ำร้อน', 'ใช้ดื่ม', 'ทาผิวหน้าเช้า-ก่อนนอน', 'เขย่าขวดก่อนดื่ม', 'ใช้ทำความสะอาดภายนอก', 'ชงน้ำเย็น'];
const STORAGE_OPTIONS = ['เก็บในที่แห้งและเย็น', 'หลีกเลี่ยงแสงแดดจัด', 'เก็บในตู้เย็น (2-8 °C)', 'ปิดฝาให้สนิทหลังใช้งาน', 'เก็บในอุณหภูมิห้อง'];
const WARNING_OPTIONS = ['สตรีมีครรภ์ไม่ควรรับประทาน', 'เก็บให้พ้นมือเด็ก', 'หากเกิดอาการแพ้ควรหยุดใช้', 'ห้ามรับประทาน (ใช้ภายนอก)', 'ข้อมูลผู้แพ้อาหาร: มีส่วนผสมของถั่ว', 'ห้ามโดนแสงแดดจัดเป็นเวลานาน'];

// ============= DRAGGABLE LABEL ELEMENTS =============
const LABEL_ELEMENTS = [
    { id: 'logo', label: 'โลโก้' },
    { id: 'productName', label: 'ชื่อสินค้า' },
    { id: 'tagline', label: 'คำโปรย' },
    { id: 'netWeight', label: 'ปริมาณสุทธิ' },
    { id: 'certifications', label: 'ตรารับรอง' },
    { id: 'ingredients', label: 'ส่วนประกอบ' },
    { id: 'usage', label: 'วิธีใช้' },
    { id: 'storage', label: 'วิธีเก็บ' },
    { id: 'warnings', label: 'คำเตือน' },
    { id: 'codes', label: 'QR/Barcode' },
    { id: 'manufacturer', label: 'ผู้ผลิต' },
    { id: 'legal', label: 'กฎหมาย/วันที่' },
];

// เลเยอร์ข้อความที่กดแก้ไข/พิมพ์ใหม่ได้โดยตรงในพรีวิว (ดับเบิลคลิก)
const EDITABLE_FIELDS = {
    productName: { field: 'productName', multiline: false, baseFont: 22, weight: 800, placeholder: 'ชื่อสินค้า' },
    tagline:     { field: 'tagline',     multiline: false, baseFont: 17, weight: 600, placeholder: 'คำโปรย' },
    netWeight:   { field: 'netWeight',   multiline: false, baseFont: 15, weight: 400, placeholder: 'ปริมาณสุทธิ' },
    ingredients: { field: 'ingredients', multiline: true,  baseFont: 17, weight: 400, placeholder: 'ส่วนประกอบ' },
};

const LAYOUT_PRESETS = {
    centered_classic: {
        logo: { x: 28, y: 3, visible: true, scale: 1.3 },
        productName: { x: 8, y: 18, visible: true, scale: 1.2 },
        tagline: { x: 12, y: 27, visible: true, scale: 1 },
        netWeight: { x: 22, y: 32, visible: true, scale: 1 },
        certifications: { x: 12, y: 36, visible: true, scale: 1 },
        ingredients: { x: 8, y: 42, visible: true, scale: 1 },
        usage: { x: 8, y: 57, visible: true, scale: 1 },
        storage: { x: 8, y: 63, visible: true, scale: 1 },
        warnings: { x: 8, y: 69, visible: true, scale: 1 },
        codes: { x: 18, y: 76, visible: true, scale: 1 },
        manufacturer: { x: 8, y: 85, visible: true, scale: 1 },
        legal: { x: 8, y: 92, visible: true, scale: 1 },
    },
    modern_side: {
        logo: { x: 6, y: 4, visible: true, scale: 1.2 },
        productName: { x: 6, y: 16, visible: true, scale: 1.1 },
        tagline: { x: 6, y: 25, visible: true, scale: 1 },
        netWeight: { x: 6, y: 30, visible: true, scale: 1 },
        certifications: { x: 6, y: 34, visible: true, scale: 1 },
        ingredients: { x: 6, y: 40, visible: true, scale: 1 },
        usage: { x: 6, y: 56, visible: true, scale: 1 },
        storage: { x: 6, y: 62, visible: true, scale: 1 },
        warnings: { x: 6, y: 68, visible: true, scale: 1 },
        codes: { x: 6, y: 75, visible: true, scale: 1 },
        manufacturer: { x: 6, y: 84, visible: true, scale: 1 },
        legal: { x: 6, y: 92, visible: true, scale: 1 },
    },
    premium_frame: {
        logo: { x: 27, y: 6, visible: true, scale: 1.2 },
        productName: { x: 12, y: 22, visible: true, scale: 1.15 },
        tagline: { x: 18, y: 32, visible: true, scale: 1 },
        netWeight: { x: 28, y: 37, visible: true, scale: 1 },
        certifications: { x: 18, y: 42, visible: true, scale: 1 },
        ingredients: { x: 10, y: 48, visible: true, scale: 1 },
        usage: { x: 10, y: 62, visible: true, scale: 1 },
        storage: { x: 10, y: 68, visible: true, scale: 1 },
        warnings: { x: 10, y: 74, visible: true, scale: 1 },
        codes: { x: 22, y: 80, visible: true, scale: 1 },
        manufacturer: { x: 10, y: 88, visible: true, scale: 0.95 },
        legal: { x: 12, y: 94, visible: true, scale: 0.95 },
    },
    minimal_strip: {
        logo: { x: 32, y: 3, visible: true, scale: 1.1 },
        productName: { x: 8, y: 14, visible: true, scale: 1.4 },
        tagline: { x: 18, y: 28, visible: true, scale: 1 },
        netWeight: { x: 28, y: 35, visible: true, scale: 1 },
        certifications: { x: 18, y: 40, visible: true, scale: 1 },
        ingredients: { x: 8, y: 48, visible: true, scale: 1 },
        usage: { x: 8, y: 60, visible: true, scale: 1 },
        storage: { x: 8, y: 66, visible: false, scale: 1 },
        warnings: { x: 8, y: 66, visible: true, scale: 1 },
        codes: { x: 22, y: 73, visible: true, scale: 1 },
        manufacturer: { x: 5, y: 82, visible: true, scale: 0.9 },
        legal: { x: 5, y: 82, visible: true, scale: 0.9 },
    },
};

// ============= HELPERS =============
const parseTags = (str, options) => {
    if (!str) return { tags: [], custom: '' };
    const parts = str.split(', ').map(s => s.trim());
    const tags = parts.filter(p => options.includes(p));
    const customParts = parts.filter(p => !options.includes(p) && p !== '');
    return { tags, custom: customParts.join(', ') };
};

const getFinalText = (tags, custom, showCustom) => {
    let arr = [...tags];
    if (showCustom && custom) arr.push(custom);
    return arr.filter(Boolean).join(', ');
};

const PREVIEW_PX_PER_CM = 38;

// ============= LOCAL (CUSTOM) FONTS =============
// ฟอนต์แบรนด์ (font_name ตรงกับ CNCPT_LOCAL_FONTS ใน CreateConcept) — ไม่มีใน Google Fonts
// เสิร์ฟจาก public/font/*.ttf|otf (ชื่อไฟล์ ASCII) → URL /font/... ใช้ได้จริงทั้ง dev/prod
const LABEL_LOCAL_FONTS = [
    { name: '399PANI TuayJiew',   url: '/font/399PANITuayJiew.ttf' },
    { name: 'Jao Chathai',        url: '/font/JaoChathai.ttf' },
    { name: 'Kart-Thai Esan',     url: '/font/KartThaiEsan.ttf' },
    { name: 'Kart-Kean Fome',     url: '/font/KartKeanFome.ttf' },
    { name: 'MN Nugget',          url: '/font/MNNugget.otf' },
    { name: 'MN Nugget Italic',   url: '/font/MNNuggetItalic.otf' },
    { name: 'MN Tam Thai',        url: '/font/MNTamThai.ttf' },
    { name: 'MN Tam Thai Italic', url: '/font/MNTamThaiItalic.ttf' },
    { name: 'RD Konmek',          url: '/font/RDKonmek.ttf' },
    { name: 'RD Konmek SPC',      url: '/font/RDKonmekSPC.ttf' },
    { name: 'TCS 4KhaiMook',      url: '/font/TCS4KhaiMook.ttf' },
    { name: 'was iittrakorn',     url: '/font/wasiittrakorn.ttf' },
];
const LABEL_LOCAL_FONT_NAMES = new Set(LABEL_LOCAL_FONTS.map(f => f.name));

// inject @font-face ของฟอนต์แบรนด์ (id แยกจาก CreateConcept เพื่อให้ src ที่ใช้ได้จริงมี priority)
function injectLabelLocalFontFaces() {
    if (document.getElementById('label-local-font-faces')) return;
    const style = document.createElement('style');
    style.id = 'label-local-font-faces';
    style.textContent = LABEL_LOCAL_FONTS.map(f => {
        const fmt = f.url.toLowerCase().endsWith('.otf') ? 'opentype' : 'truetype';
        return `@font-face { font-family: '${f.name}'; src: url('${f.url}') format('${fmt}'); font-display: swap; }`;
    }).join('\n');
    document.head.appendChild(style);
}

// ============= SUB COMPONENTS =============
// แก้ไขข้อความในพรีวิวโดยตรง — ใช้ contentEditable เพื่อให้กล่องคงขนาด/ตำแหน่งเดิม ไม่ดันเลย์เอาต์
function EditableText({ value, multiline, onCommit, onDone, style }) {
    const ref = React.useRef(null);
    React.useEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.innerText = value || '';
        el.focus();
        // เลือกข้อความทั้งหมดเพื่อพิมพ์ทับได้ทันที
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <span
            ref={ref}
            contentEditable
            suppressContentEditableWarning
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onInput={(e) => onCommit(e.currentTarget.innerText)}
            onBlur={() => onDone()}
            onKeyDown={(e) => {
                if (e.key === 'Escape') { e.preventDefault(); e.currentTarget.blur(); }
                if (e.key === 'Enter' && !multiline) { e.preventDefault(); e.currentTarget.blur(); }
            }}
            style={{
                outline: '1px dashed var(--le-orange)',
                outlineOffset: 1,
                borderRadius: 2,
                cursor: 'text',
                whiteSpace: multiline ? 'pre-wrap' : 'normal',
                ...style,
            }}
        />
    );
}

function AccordionSection({ title, open, onToggle, children, disabled }) {
    return (
        <div style={{ marginBottom: 8, border: '1px solid #ececec', borderRadius: 10, overflow: 'hidden', opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
            <button onClick={onToggle} style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: open ? '#f5f8eb' : 'var(--le-bg-sidebar)', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', justifyContent: 'space-between', color: 'var(--le-text)' }}>
                <span>{title}</span><span style={{ color: '#aaa', fontSize: 12 }}>{open ? '▾' : '▸'}</span>
            </button>
            {open && <div style={{ padding: '10px 14px' }}>{children}</div>}
        </div>
    );
}

function BgModeBtn({ label, active, onClick }) {
    return (
        <button onClick={onClick} style={{ flex: 1, padding: 8, fontSize: 17, fontWeight: 'bold', cursor: 'pointer', border: active ? '2px solid #8a9a3c' : '1px solid var(--le-border)', background: active ? '#f5f8eb' : '#fff', borderRadius: 6 }}>{label}</button>
    );
}

function FormInput({ label, value, onChange, type = 'text' }) {
    return (
        <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--le-text-sub)', marginBottom: 4 }}>{label}</label>
            <input type={type} value={value} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--le-border)', fontSize: 13, background: 'var(--le-bg-sidebar)', color: 'var(--le-text)', boxSizing: 'border-box' }} />
        </div>
    );
}

function FormTextarea({ label, value, onChange, rows = 3 }) {
    return (
        <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--le-text-sub)', marginBottom: 4 }}>{label}</label>
            <textarea rows={rows} value={value} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--le-border)', fontSize: 13, fontFamily: 'inherit', background: 'var(--le-bg-sidebar)', color: 'var(--le-text)', boxSizing: 'border-box', resize: 'vertical' }} />
        </div>
    );
}

function TagSelector({ label, options, selectedTags, onTagToggle, customText, onCustomChange, showCustom, onToggleCustom }) {
    const [open, setOpen] = React.useState(false);
    const hasSelected = selectedTags.length > 0 || (showCustom && customText);
    return (
        <div style={{ marginBottom: 8, borderRadius: 10, border: '1px solid var(--le-border)', overflow: 'hidden', background: '#fff' }}>
            <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a' }}>{label}</span>
                    {hasSelected && (
                        <span style={{ fontSize: 17, fontWeight: 700, background: '#FF8A00', color: '#fff', borderRadius: 10, padding: '1px 7px', lineHeight: '16px' }}>
                            {selectedTags.length + (showCustom && customText ? 1 : 0)}
                        </span>
                    )}
                </div>
                <span style={{ fontSize: 17, color: '#aaa', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▾</span>
            </button>
            {!open && hasSelected && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '0 12px 10px' }}>
                    {selectedTags.map(t => (
                        <span key={t} style={{ fontSize: 17, padding: '3px 8px', borderRadius: 12, background: '#fff4e6', color: '#FF8A00', border: '1px solid #FFD699' }}>{t}</span>
                    ))}
                    {showCustom && customText && (
                        <span style={{ fontSize: 17, padding: '3px 8px', borderRadius: 12, background: '#fff0ed', color: '#d3542b', border: '1px solid #f9c4b8' }}>{customText}</span>
                    )}
                </div>
            )}
            {open && (
                <div style={{ padding: '4px 12px 12px', borderTop: '1px solid var(--le-border)' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, marginBottom: 8 }}>
                        {options.map(opt => (
                            <button key={opt} onClick={() => onTagToggle(opt)} style={{ padding: '6px 12px', fontSize: 17, borderRadius: 20, cursor: 'pointer', background: selectedTags.includes(opt) ? '#FF8A00' : '#f5f5f5', color: selectedTags.includes(opt) ? '#fff' : 'var(--le-text-sub)', border: '1.5px solid', borderColor: selectedTags.includes(opt) ? '#FF8A00' : '#e0e0e0', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                                {selectedTags.includes(opt) ? '✓ ' : ''}{opt}
                            </button>
                        ))}
                        <button onClick={onToggleCustom} style={{ padding: '6px 12px', fontSize: 17, borderRadius: 20, cursor: 'pointer', background: showCustom ? '#d3542b' : '#f5f5f5', color: showCustom ? '#fff' : 'var(--le-text-sub)', border: '1.5px dashed', borderColor: showCustom ? '#d3542b' : '#ccc', fontFamily: 'inherit' }}>
                            + ระบุเอง
                        </button>
                    </div>
                    {showCustom && (
                        <input type="text" placeholder="พิมพ์ระบุเพิ่มเติม..." value={customText} onChange={e => onCustomChange(e.target.value)}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px dashed #d3542b', fontSize: 17, boxSizing: 'border-box', fontFamily: 'inherit' }} />
                    )}
                </div>
            )}
        </div>
    );
}

function LayoutThumbnail({ type }) {
    const base = { width: '100%', height: 72, borderRadius: 4, background: '#f9f9f9', position: 'relative', overflow: 'hidden' };
    const line = (x, y, w, h, accent) => ({ position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: 2, background: accent ? '#8a9a3c' : '#ccc' });
    const circle = (x, y, s) => ({ position: 'absolute', left: x, top: y, width: s, height: s, borderRadius: '50%', background: '#ddd' });

    if (type === 'centered_classic') return (
        <div style={base}>
            <div style={{ ...circle('50%', 6, 16), transform: 'translateX(-50%)' }} />
            <div style={line('25%', 28, '50%', 5, true)} />
            <div style={line('30%', 36, '40%', 3)} />
            <div style={line('15%', 44, '70%', 3)} />
            <div style={line('15%', 50, '70%', 3)} />
            <div style={line('35%', 60, '30%', 7)} />
        </div>
    );
    if (type === 'modern_side') return (
        <div style={base}>
            <div style={circle(6, 6, 14)} />
            <div style={line(26, 6, '55%', 5, true)} />
            <div style={line(26, 14, '40%', 3)} />
            <div style={line(6, 26, '80%', 3)} />
            <div style={line(6, 32, '80%', 3)} />
            <div style={line(6, 38, '60%', 3)} />
            <div style={line(6, 50, '45%', 3)} />
            <div style={line(6, 60, 20, 7)} />
        </div>
    );
    if (type === 'premium_frame') return (
        <div style={base}>
            <div style={{ position: 'absolute', inset: 4, border: '1.5px solid #8a9a3c', borderRadius: 2 }} />
            <div style={{ ...circle('50%', 10, 14), transform: 'translateX(-50%)' }} />
            <div style={line('25%', 30, '50%', 5, true)} />
            <div style={{ ...line('40%', 38, '20%', 1, true) }} />
            <div style={line('20%', 44, '60%', 3)} />
            <div style={line('20%', 50, '60%', 3)} />
            <div style={line('35%', 60, '30%', 6)} />
        </div>
    );
    if (type === 'minimal_strip') return (
        <div style={base}>
            <div style={{ ...circle('50%', 4, 12), transform: 'translateX(-50%)' }} />
            <div style={line('15%', 20, '70%', 7, true)} />
            <div style={line('30%', 30, '40%', 3)} />
            <div style={line('20%', 38, '60%', 3)} />
            <div style={line('20%', 44, '40%', 3)} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 12, background: 'var(--le-text-sub)', borderRadius: '0 0 4px 4px' }} />
        </div>
    );
    return <div style={base} />;
}

function ColorSwatchPicker({ label, value, onChange, palette }) {
    const [showPicker, setShowPicker] = useState(false);
    return (
        <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 17, fontWeight: 600, color: '#444' }}>{label}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div onClick={() => setShowPicker(!showPicker)} style={{ width: 28, height: 28, borderRadius: 6, background: value, border: '2px solid #ddd', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }} />
                    <span style={{ fontSize: 15, color: 'var(--le-text-sub)', fontFamily: 'monospace' }}>{value}</span>
                </div>
            </div>
            {showPicker && (
                <div style={{ padding: 8, background: '#f9f9f9', borderRadius: 8, border: '1px solid var(--le-border)' }}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                        {palette.map((c, i) => (
                            <button key={i} onClick={() => { onChange(c); setShowPicker(false); }}
                                style={{ width: 30, height: 30, borderRadius: 6, background: c, border: value === c ? '2.5px solid #333' : '1px solid var(--le-border)', cursor: 'pointer', position: 'relative' }}
                                title={c}>
                                {value === c && <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 17, textShadow: '0 0 3px #000' }}>✓</span>}
                            </button>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input type="color" value={value} onChange={e => onChange(e.target.value)} style={{ width: 32, height: 32, border: 'none', borderRadius: 4, cursor: 'pointer', padding: 0 }} />
                        <input type="text" value={value} onChange={e => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) onChange(e.target.value); }}
                            style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--le-border)', fontSize: 17, fontFamily: 'monospace' }} />
                    </div>
                </div>
            )}
        </div>
    );
}

// ============= PACKAGING SELECTOR PANEL =============
// ============= PACKAGING SIDEBAR (แถบย่อขวา) =============
function PackagingSidebar({ packages, selectedPackageId, onSelectPackage }) {
    const [filterCat, setFilterCat] = useState('all');
    const [isExpanded, setIsExpanded] = useState(false);

    const filtered = filterCat === 'all'
        ? packages
        : packages.filter(p => p.categories.includes(filterCat));

    const selectedPkg = packages.find(p => p.id === selectedPackageId);

    return (
        <div style={{
            width: isExpanded ? 280 : 220, flexShrink: 0,
            maxHeight: 'calc(100vh - 180px)', display: 'flex', flexDirection: 'column',
            background: '#fff', borderRadius: 14, boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
            transition: 'width 0.3s',
            overflow: 'hidden',
        }}>
            {/* Header */}
            <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--le-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <h4 style={{ margin: 0, fontSize: 15, color: '#8a9a3c' }}>
                        <iconify-icon icon="mdi:package-variant-closed" style={{ marginRight: 4, verticalAlign: 'middle' }}></iconify-icon>
                        Packaging
                    </h4>
                    <button onClick={() => setIsExpanded(!isExpanded)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 17, color: '#999', padding: 2 }}>
                        <iconify-icon icon={isExpanded ? 'mdi:chevron-right' : 'mdi:chevron-left'}></iconify-icon>
                    </button>
                </div>
                {/* Selected indicator */}
                {selectedPkg && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px',
                        background: '#f5f8eb', borderRadius: 6, border: '1px solid #d4e4a0', marginBottom: 6,
                    }}>
                        <img src={selectedPkg.thumbnail} alt="" style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 4 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 15, fontWeight: 'bold', color: 'var(--le-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedPkg.name}</div>
                        </div>
                        <iconify-icon icon="mdi:check-circle" style={{ color: '#8a9a3c', fontSize: 17, flexShrink: 0 }}></iconify-icon>
                    </div>
                )}
                {/* Filter pills */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {CATEGORIES.filter(c => ['all', 'pouch', 'box', 'bottle', 'food'].includes(c.id)).map(cat => (
                        <button key={cat.id} onClick={() => setFilterCat(cat.id)}
                            style={{
                                padding: '2px 8px', fontSize: 17, borderRadius: 12, cursor: 'pointer',
                                background: filterCat === cat.id ? '#8a9a3c' : '#f5f5f5',
                                color: filterCat === cat.id ? '#fff' : 'var(--le-text-sub)',
                                border: 'none',
                            }}>
                            {cat.label}
                        </button>
                    ))}
                </div>
            </div>
            {/* Package list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 8, scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {filtered.map(pkg => {
                        const isSelected = selectedPackageId === pkg.id;
                        return (
                            <div key={pkg.id} onClick={() => onSelectPackage(pkg)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 8, padding: 8,
                                    background: isSelected ? '#f5f8eb' : 'var(--le-bg-sidebar)', borderRadius: 8, cursor: 'pointer',
                                    border: isSelected ? '2px solid #8a9a3c' : '1px solid var(--le-border)',
                                    transition: 'all 0.15s',
                                }}>
                                <img src={pkg.thumbnail} alt={pkg.name}
                                    style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 6, background: '#fff', flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 15, fontWeight: 'bold', color: 'var(--le-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {pkg.name}
                                    </div>
                                    <div style={{ fontSize: 9, color: '#999', marginTop: 1 }}>{pkg.type}</div>
                                </div>
                                {isSelected && (
                                    <iconify-icon icon="mdi:check-circle" style={{ color: '#8a9a3c', fontSize: 17, flexShrink: 0 }}></iconify-icon>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function PanelSelector({ panels, selectedPanel, onSelectPanel }) {
    if (!panels || panels.length === 0) return null;

    return (
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end' }}>
            {panels.map(panel => {
                const isSelected = selectedPanel?.id === panel.id;
                const aspect = panel.w_mm / panel.h_mm;
                const isPortrait = aspect < 0.8;
                const isWrap = aspect > 2;
                const thumbH = 64;
                const thumbW = isWrap ? 100 : isPortrait ? Math.round(thumbH * aspect) : thumbH;

                return (
                    <div
                        key={panel.id}
                        onClick={() => onSelectPanel(panel)}
                        style={{
                            cursor: 'pointer',
                            textAlign: 'center',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                            opacity: isSelected ? 1 : 0.55,
                            transition: 'opacity 0.15s',
                        }}
                    >
                        {/* dashed thumbnail */}
                        <div style={{
                            width: thumbW,
                            height: thumbH,
                            border: isSelected ? '2px dashed #d3542b' : '2px dashed #bbb',
                            borderRadius: 5,
                            background: 'transparent',
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center',
                            gap: 2,
                            position: 'relative',
                        }}>
                            {/* arrow icon */}
                            <span style={{ fontSize: 14, color: isSelected ? '#d3542b' : '#aaa' }}>
                                {isWrap ? '↔' : '↕'}
                            </span>
                            <span style={{ fontSize: 9, color: isSelected ? '#d3542b' : '#bbb', lineHeight: 1 }}>
                                {panel.w_mm}×{panel.h_mm}
                            </span>
                            <span style={{ fontSize: 9, color: isSelected ? '#d3542b' : '#bbb', lineHeight: 1 }}>
                                มม.
                            </span>
                        </div>
                        {/* label */}
                        <div style={{
                            fontSize: 13, fontWeight: isSelected ? 700 : 500,
                            color: isSelected ? '#d3542b' : 'var(--le-text-sub)',
                        }}>
                            {panel.label}
                        </div>
                        {/* orientation tag */}
                        <div style={{ fontSize: 11, color: isSelected ? '#e8896a' : '#aaa', marginTop: -4 }}>
                            {isWrap ? 'แนวนอน' : isPortrait ? 'แนวตั้ง' : 'สี่เหลี่ยม'}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// =====================================================================
// MAIN COMPONENT
// =====================================================================
export default function LabelEditor({ projectId, userId }) {
    const labelRef = useRef(null);

    // ====== Products ======
    const [products, setProducts] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [isAddProductOpen, setIsAddProductOpen] = useState(false);
    const [newProduct, setNewProduct] = useState({ name: '', type: '', file: null });

    // ====== Packaging ======
    const [selectedPackage, setSelectedPackage] = useState(null);
    const [showPkgModal, setShowPkgModal] = useState(false);
    const [materialData, setMaterialData] = useState(null);
    const [selectedPanel, setSelectedPanel] = useState(null);
    const [labelMode, setLabelMode] = useState('sticker'); // 'sticker' | 'fullcover'
    const [elemPositions, setElemPositions] = useState(() => ({ ...LAYOUT_PRESETS.centered_classic }));
    const [selectedElem, setSelectedElem] = useState(null);
    const [editingElem, setEditingElem] = useState(null);      // เลเยอร์ที่กำลังแก้ไขข้อความในพรีวิว
    const [activeCertCat, setActiveCertCat] = useState(null);  // ประเภทตราที่กำลังเลือกแบบลายอยู่
    const [customImages, setCustomImages] = useState([]);      // รูปภาพที่ผู้ใช้อัปโหลดเอง [{ id, label, url }]
    const [showCenterGuide, setShowCenterGuide] = useState(false); // เส้นกึ่งกลางแกน y (แนวตั้ง)
    const [layerDraggingId, setLayerDraggingId] = useState(null);
    const [layerDragOverId, setLayerDragOverId] = useState(null);
    const [bgHistory, setBgHistory] = useState([]);

    // ====== Brand Assets ======
    const [labelAssets, setLabelAssets] = useState({
        logoUrl: '', colors: ['#FFFFFF', '#222222', '#D3542B', '#888888', '#EEEEEE'], font: "'Sarabun', sans-serif",
    });

    // ====== Label Form ======
    const [labelForm, setLabelForm] = useState({
        productName: '', tagline: '', netWeight: '', ingredients: '',
        usageTags: [], usageCustom: '', showUsageCustom: false,
        storageTags: [], storageCustom: '', showStorageCustom: false,
        warningTags: [], warningCustom: '', showWarningCustom: false,
        manufacturerName: '', manufacturerAddress: '', manufacturerPhone: '',
        manufacturerLine: '', manufacturerFacebook: '', manufacturerWebsite: '',
        fdaNumber: '', mfgDate: '', expDate: '', lotNumber: '',
        certifications: [],
        showQR: false, qrValue: '', showBarcode: false, barcodeValue: '',
    });

    // ====== Layout & BG ======
    const [layoutType, setLayoutType] = useState('centered_classic');
    const [bgMode, setBgMode] = useState('solid');
    const [bgColor, setBgColor] = useState('#FFFFFF');
    const [bgPresetId, setBgPresetId] = useState(null);
    const [bgImageUrl, setBgImageUrl] = useState('');
    const [bgOpacity, setBgOpacity] = useState(1);
    const [bgPresets, setBgPresets] = useState([]);
    const [isGeneratingBg, setIsGeneratingBg] = useState(false);
    const [dalleStyle, setDalleStyle] = useState('minimal');
    const [dalleTone, setDalleTone] = useState('auto');
    const [dalleDensity, setDalleDensity] = useState('medium');

    // ====== UI State ======
    const [showProModal, setShowProModal] = useState(false);
    const [isLabelAILoading, setIsLabelAILoading] = useState(false);
    const [isSavingLabel, setIsSavingLabel] = useState(false);
    const [labelDimensions, setLabelDimensions] = useState({ width: 380, height: 500 });
    const [sectionColors, setSectionColors] = useState({ productName: '#222222', tagline: '#D3542B', details: '#555555' });

    // Per-element text styles: bold, italic, underline, align, color
    const DEFAULT_ELEM_STYLE = { bold: false, italic: false, underline: false, align: 'center', color: '#222222' };
    const [elemStyles, setElemStyles] = useState(() =>
        Object.fromEntries(LABEL_ELEMENTS.map(e => [e.id, { ...DEFAULT_ELEM_STYLE }]))
    );
    const updateElemStyle = (elemId, patch) => {
        if (!elemId) return;
        setElemStyles(prev => ({ ...prev, [elemId]: { ...prev[elemId], ...patch } }));
    };
    const [saveStatus, setSaveStatus] = useState('');

    const [openAccordions, setOpenAccordions] = useState({
        elements: true,
        bg: true, settings: true, main: true, product: true, manufacturer: false, legal: false, cert: false, qr: false,
    });
    const toggleAccordion = (key) => setOpenAccordions(p => ({ ...p, [key]: !p[key] }));

    // ====== Packaging เลือกแล้วหรือยัง ======
    const hasPackaging = !!selectedPackage;

    // ============= EFFECTS =============
    useEffect(() => {
        if (!projectId) return;
        fetchProducts();
        fetchLabelAssets();
        fetchBgPresets();
    }, [projectId]);
    useEffect(() => {
        if (!selectedPackage) {
            setMaterialData(null);
            setSelectedPanel(null);
            return;
        }
        fetch(`${API}/api/package/${selectedPackage.id}/materials`)
            .then(r => r.json())
            .then(data => {
                if (data.status === 'success' && data.data.length > 0) {
                    const mat = data.data[0];
                    setMaterialData(mat);
                    const panels = (mat.panels_json || []).filter(p => p.is_label_target);
                    if (panels.length > 0 && !selectedPanel) {
                        setSelectedPanel(panels[0]);
                        const scale = labelMode === 'sticker' ? 0.7 : 1.0;
                        setLabelDimensions({
                            width: (panels[0].w_mm * scale) / 10,
                            height: (panels[0].h_mm * scale) / 10
                        });
                    }
                }
            })
            .catch(err => console.error('fetch materials error:', err));
    }, [selectedPackage]);
    // ดึงประวัติ background ที่เคยสร้าง/อัปโหลด
    useEffect(() => {
        if (!projectId) return;
        fetch(`${API}/api/label-bg-history/${projectId}`)
            .then(r => r.json())
            .then(data => { if (data.status === 'success') setBgHistory(data.data || []); })
            .catch(() => {});
    }, [projectId]);

    // ============= GOOGLE FONT LOADING =============
    // Pre-load Bai Jamjuree on mount
    useEffect(() => {
        const linkId = 'gfont-bai-jamjuree';
        if (!document.getElementById(linkId)) {
            const link = document.createElement('link');
            link.id = linkId;
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=Bai+Jamjuree:wght@300;400;500;600;700&display=swap';
            document.head.appendChild(link);
        }
    }, []);

    // inject ฟอนต์ local ทั้งหมดตั้งแต่ต้น (เผื่อฟอนต์ที่เลือกจาก CreateConcept เป็นฟอนต์ local)
    useEffect(() => { injectLabelLocalFontFaces(); }, []);

    useEffect(() => {
        if (!labelAssets.font) return;
        const fontName = labelAssets.font.replace(/'/g, '').split(',')[0].trim();
        if (!fontName) return;
        // ฟอนต์ local (RD Konmek ฯลฯ) ไม่มีใน Google Fonts → ใช้ @font-face ที่ inject ไว้ ไม่ต้องโหลดจาก Google
        if (LABEL_LOCAL_FONT_NAMES.has(fontName)) { injectLabelLocalFontFaces(); return; }
        const linkId = `gfont-label-${fontName.replace(/\s+/g, '-')}`;
        if (document.getElementById(linkId)) return;
        const link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@300;400;600;700;800;900&display=swap`;
        document.head.appendChild(link);
    }, [labelAssets.font]);

    // AUTO-SAVE (ทำงานทันทีที่เลือกสินค้า — ไม่ต้องรอเลือก packaging แล้ว)
    // NOTE: !hasPackaging check removed intentionally; PackagingSidebar moved out of required flow
    useEffect(() => {
        if (!selectedProduct) return;
        setSaveStatus('กำลังบันทึก...');
        const timer = setTimeout(() => { handleSaveLabel(true); }, 1500);
        return () => clearTimeout(timer);
    }, [labelForm, layoutType, bgMode, bgColor, bgPresetId, bgImageUrl, bgOpacity, labelDimensions, sectionColors, elemPositions]);

    // ============= KEYBOARD DELETE =============
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!selectedElem) return;
            // ไม่ทำงานถ้า focus อยู่ที่ input/textarea
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                setElemPositions(prev => ({ ...prev, [selectedElem]: { ...prev[selectedElem], visible: false } }));
                setSelectedElem(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedElem]);

    // ============= FETCHERS =============
    const fetchProducts = async () => {
        try {
            const res = await fetch(`${API}/api/brand_product/${projectId}`);
            const data = await res.json();
            if (data.status === 'success') setProducts(data.products);
        } catch (err) { }
    };

    const fetchLabelAssets = async () => {
        try {
            const projRes = await fetch(`${API}/api/projects/detail/${projectId}`);
            const projData = await projRes.json();
            const logo = projData.project?.image_logo ? `${API}${projData.project.image_logo}` : '';
            const transparentLogo = await loadLogoTransparent(logo);
            const assetRes = await fetch(`${API}/api/projects/${projectId}/selected-assets`);
            const assetData = await assetRes.json();

            let colors = ['#FFFFFF', '#222222', '#D3542B', '#888888', '#EEEEEE'];
            if (assetData.color) {
                colors = [assetData.color.color_code_1, assetData.color.color_code_2, assetData.color.color_code_3, assetData.color.color_code_4, assetData.color.color_code_5].filter(Boolean);
                while (colors.length < 5) colors.push('#CCCCCC');
            }
            let font = "'Sarabun', sans-serif";
            if (assetData.font) font = `'${assetData.font.font_name}', sans-serif`;

            setLabelAssets({ logoUrl: transparentLogo || logo, colors, font });
            // เฉพาะตอนยังไม่มี label ที่บันทึกไว้ (bgColor ยังเป็นค่าเริ่มต้น) ถึงจะเซ็ตจาก brand colors
            setBgColor(prev => prev === '#FFFFFF' ? (colors[0] || '#FFFFFF') : prev);
            setSectionColors(prev => {
                // ถ้ายังเป็นค่าเริ่มต้น ให้ใช้สีจาก brand, ถ้ามีค่าจากที่บันทึกไว้แล้วก็ไม่ overwrite
                if (prev.productName === '#222222' && prev.tagline === '#D3542B' && prev.details === '#555555') {
                    return { productName: colors[1] || '#222222', tagline: colors[2] || '#D3542B', details: colors[1] || '#555555' };
                }
                return prev;
            });
        } catch (err) { }
    };

    const fetchBgPresets = async () => {
        try {
            const res = await fetch(`${API}/api/bg-presets`);
            const data = await res.json();
            if (data.status === 'success') setBgPresets(data.data);
        } catch (err) { }
    };

    // ============= PRODUCT SELECTION =============
    const handleSelectProduct = async (prod) => {
        setSelectedProduct(prod);
        setSaveStatus('');

        // ตรวจสอบว่า product นี้เลือก package แล้วหรือยัง
        if (prod.package_id) {
            const pkg = PACKAGES.find(p => p.id === prod.package_id);
            if (pkg) {
                setSelectedPackage(pkg);
            }
        } else {
            setSelectedPackage(null);
        }

        try {
            const res = await fetch(`${API}/api/labels/product/${prod.product_id}`);
            const data = await res.json();
            if (data.status === 'success' && data.data) {
                const r = data.data;
                const mi = typeof r.manufacturer_info === 'string' ? JSON.parse(r.manufacturer_info) : (r.manufacturer_info || {});
                const certs = typeof r.certifications === 'string' ? JSON.parse(r.certifications) : (r.certifications || []);

                const parsedUsage = parseTags(r.usage_instruction, USAGE_OPTIONS);
                const parsedStorage = parseTags(r.storage_instruction, STORAGE_OPTIONS);
                const parsedWarning = parseTags(r.warnings, WARNING_OPTIONS);

                setLabelForm({
                    productName: r.product_name || prod.name_product, tagline: r.tagline || '', netWeight: r.net_weight || '', ingredients: r.ingredients || '',
                    usageTags: parsedUsage.tags, usageCustom: parsedUsage.custom, showUsageCustom: !!parsedUsage.custom,
                    storageTags: parsedStorage.tags, storageCustom: parsedStorage.custom, showStorageCustom: !!parsedStorage.custom,
                    warningTags: parsedWarning.tags, warningCustom: parsedWarning.custom, showWarningCustom: !!parsedWarning.custom,
                    manufacturerName: mi.name || '', manufacturerAddress: mi.address || '', manufacturerPhone: mi.phone || '',
                    manufacturerLine: mi.line || '', manufacturerFacebook: mi.facebook || '', manufacturerWebsite: mi.website || '',
                    fdaNumber: r.fda_number || '', mfgDate: r.mfg_date ? r.mfg_date.substring(0, 10) : '', expDate: r.exp_date ? r.exp_date.substring(0, 10) : '',
                    lotNumber: r.lot_number || '', certifications: certs,
                    showQR: !!r.show_qr, qrValue: r.qr_code_value || '', showBarcode: !!r.show_barcode, barcodeValue: r.barcode_value || '',
                });
                setLayoutType(r.layout_type || 'centered_classic');
                setBgMode(r.bg_mode || 'solid');
                setBgColor(r.bg_color || '#FFFFFF');
                setBgPresetId(r.bg_preset_id || null);
                setBgImageUrl(r.bg_image_url ? (r.bg_image_url.startsWith('http') ? r.bg_image_url : `${API}${r.bg_image_url}`) : '');
                setBgOpacity(parseFloat(r.bg_opacity) || 1);
                setLabelDimensions({ width: r.label_width || 380, height: r.label_height || 500 });
                if (r.text_colors) {
                    try { setSectionColors(typeof r.text_colors === 'string' ? JSON.parse(r.text_colors) : r.text_colors); } catch (e) { }
                }
                if (r.elem_positions) {
                    try {
                        const saved = typeof r.elem_positions === 'string' ? JSON.parse(r.elem_positions) : r.elem_positions;
                        setElemPositions(saved);
                    } catch (e) { }
                }
                if (r.label_mode) setLabelMode(r.label_mode);
            } else {
                setLabelForm(p => ({
                    ...p, productName: prod.name_product, tagline: '', netWeight: '', ingredients: '',
                    usageTags: [], usageCustom: '', showUsageCustom: false,
                    storageTags: [], storageCustom: '', showStorageCustom: false,
                    warningTags: [], warningCustom: '', showWarningCustom: false,
                    manufacturerName: '', manufacturerAddress: '', manufacturerPhone: '', manufacturerLine: '', manufacturerFacebook: '', manufacturerWebsite: '', fdaNumber: '', mfgDate: '', expDate: '', lotNumber: '', certifications: [], showQR: false, qrValue: '', showBarcode: false, barcodeValue: ''
                }));
                setLabelDimensions({ width: 380, height: 500 }); setBgMode('solid'); setBgColor('#FFFFFF'); setBgImageUrl(''); setBgPresetId(null);
            }
        } catch (err) { }
    };
    const handleSelectPanel = (panel) => {
        setSelectedPanel(panel);
        const scale = labelMode === 'sticker' ? 0.7 : 1.0;
        setLabelDimensions({
            width: (panel.w_mm * scale) / 10,
            height: (panel.h_mm * scale) / 10
        });
    };

    const labelPanels = materialData
        ? (materialData.panels_json || []).filter(p => p.is_label_target)
        : [];

    const handleModeToggle = (mode) => {
        setLabelMode(mode);
        if (selectedPanel) {
            const scale = mode === 'sticker' ? 0.7 : 1.0;
            setLabelDimensions({
                width: (selectedPanel.w_mm * scale) / 10,
                height: (selectedPanel.h_mm * scale) / 10,
            });
        }
    };

    const applyLayoutPreset = (presetKey) => {
        setLayoutType(presetKey);
        const preset = LAYOUT_PRESETS[presetKey] || LAYOUT_PRESETS.centered_classic;
        setElemPositions({ ...preset });
        setSelectedElem(null);
    };

    const handleElemScale = (elemId, delta) => {
        setElemPositions(prev => {
            const cur = prev[elemId]?.scale || 1;
            const newScale = Math.max(0.4, Math.min(3, cur + delta));
            return { ...prev, [elemId]: { ...prev[elemId], scale: Math.round(newScale * 100) / 100 } };
        });
    };

    // Canva-style corner/edge resize by drag
    const handleResizeStart = (e, elemId, handle) => {
        e.preventDefault();
        e.stopPropagation();
        if (!labelRef.current) return;
        const rect = labelRef.current.getBoundingClientRect();
        const startX = e.clientX;
        const startY = e.clientY;
        const startScale = elemPositions[elemId]?.scale || 1;

        // throttle ด้วย rAF (กันค้างจาก re-render ถี่)
        let rafPending = false;
        let latestEvent = null;
        const process = () => {
            rafPending = false;
            const me = latestEvent;
            if (!me) return;
            const dx = me.clientX - startX;
            const dy = me.clientY - startY;
            let scaleDelta = 0;
            if (handle === 'se') scaleDelta = (dx + dy) / 150;
            else if (handle === 'sw') scaleDelta = (-dx + dy) / 150;
            else if (handle === 'ne') scaleDelta = (dx - dy) / 150;
            else if (handle === 'nw') scaleDelta = (-dx - dy) / 150;
            else if (handle === 'e') scaleDelta = dx / 150;
            else if (handle === 'w') scaleDelta = -dx / 150;
            else if (handle === 's') scaleDelta = dy / 150;
            else if (handle === 'n') scaleDelta = -dy / 150;

            const newScale = Math.max(0.3, Math.min(4, startScale + scaleDelta));
            setElemPositions(prev => ({
                ...prev,
                [elemId]: { ...prev[elemId], scale: Math.round(newScale * 100) / 100 }
            }));
        };
        const handleMove = (me) => {
            latestEvent = me;
            if (rafPending) return;
            rafPending = true;
            requestAnimationFrame(process);
        };

        const handleUp = () => {
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('mouseup', handleUp);
            document.body.style.cursor = '';
        };

        document.body.style.cursor = handle === 'e' || handle === 'w' ? 'ew-resize' : handle === 'n' || handle === 's' ? 'ns-resize' : handle === 'se' || handle === 'nw' ? 'nwse-resize' : 'nesw-resize';
        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleUp);
    };

    const toggleElemVisibility = (elemId) => {
        setElemPositions(prev => ({
            ...prev,
            [elemId]: { ...prev[elemId], visible: !prev[elemId]?.visible }
        }));
    };

    // ============= LAYER ORDER (เลื่อนเลเยอร์ขึ้น/ลงจริง) =============
    // ลำดับเลเยอร์เก็บเป็น zIndex ในตัว elemPositions ของแต่ละ element เอง
    // (ผูกกับการบันทึก/โหลด elem_positions ที่มีอยู่แล้ว ไม่ต้องเพิ่ม field ใหม่)
    // element ทั้งหมด = element มาตรฐาน + รูปภาพที่อัปโหลดเอง (แสดงเป็นเลเยอร์เหมือนกัน)
    const getAllBaseElements = () => [
        ...LABEL_ELEMENTS,
        ...customImages.map((im, i) => ({ id: im.id, label: im.label || `รูปภาพ ${i + 1}`, isCustomImage: true })),
    ];

    const getOrderedElements = () => {
        const all = getAllBaseElements();
        return [...all].sort((a, b) => {
            const za = elemPositions[a.id]?.zIndex ?? all.findIndex(e => e.id === a.id);
            const zb = elemPositions[b.id]?.zIndex ?? all.findIndex(e => e.id === b.id);
            return za - zb;
        });
    };

    // อัปโหลดรูปภาพจากเครื่อง → เพิ่มเป็นเลเยอร์ในพรีวิว
    const handleUploadCustomImage = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const id = `img_${Date.now()}`;
            setCustomImages(prev => [...prev, { id, label: `รูปภาพ ${prev.length + 1}`, url: reader.result }]);
            setElemPositions(prev => {
                const maxZ = Math.max(0, ...Object.values(prev).map(p => p?.zIndex ?? 0));
                return { ...prev, [id]: { x: 32, y: 40, scale: 1, visible: true, zIndex: maxZ + 1 } };
            });
            setSelectedElem(id);
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    // ลบรูปภาพที่อัปโหลด
    const removeCustomImage = (id) => {
        setCustomImages(prev => prev.filter(im => im.id !== id));
        setElemPositions(prev => { const n = { ...prev }; delete n[id]; return n; });
        setSelectedElem(cur => (cur === id ? null : cur));
    };

    const reorderLayer = (draggedId, targetId) => {
        if (draggedId === targetId) return;
        const ordered = getOrderedElements().map(e => e.id);
        const fromIdx = ordered.indexOf(draggedId);
        const toIdx = ordered.indexOf(targetId);
        if (fromIdx === -1 || toIdx === -1) return;
        const next = [...ordered];
        next.splice(fromIdx, 1);
        next.splice(toIdx, 0, draggedId);
        setElemPositions(prev => {
            const updated = { ...prev };
            next.forEach((id, i) => {
                updated[id] = { ...updated[id], zIndex: i };
            });
            return updated;
        });
    };

    const moveLayerStep = (elemId, direction) => {
        // direction: -1 = เลื่อนขึ้น (ทับซ้อนบนสุดมากขึ้น / zIndex สูงขึ้น), 1 = เลื่อนลง (zIndex ต่ำลง)
        const ordered = getOrderedElements().map(e => e.id); // เรียงจาก zIndex น้อย -> มาก (ล่างสุด -> บนสุด)
        const idx = ordered.indexOf(elemId);
        // เลื่อนขึ้น (direction -1) ต้องขยับไปทาง index ที่มากขึ้นใน ordered (zIndex สูงขึ้น)
        const targetIdx = idx - direction;
        if (targetIdx < 0 || targetIdx >= ordered.length) return;
        const next = [...ordered];
        [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
        setElemPositions(prev => {
            const updated = { ...prev };
            next.forEach((id, i) => { updated[id] = { ...updated[id], zIndex: i }; });
            return updated;
        });
    };

    const handleDragStart = (e, elemId) => {
        // ขณะกำลังพิมพ์แก้ไขข้อความเลเยอร์นี้ ไม่ต้องลาก
        if (editingElem === elemId) return;
        e.preventDefault();
        if (!labelRef.current) return;
        setSelectedElem(elemId);
        const node = e.currentTarget;                 // กล่องของวัตถุที่กำลังลาก (ใช้วัดจุดศูนย์กลาง)
        const rect = labelRef.current.getBoundingClientRect();
        const startX = e.clientX;
        const startY = e.clientY;
        const startPos = { ...elemPositions[elemId] };
        const SNAP_PCT = 1.5;                          // ระยะดูด (เปอร์เซ็นต์ของความกว้างพรีวิว)

        // throttle ด้วย rAF — อัปเดต state มากสุด 1 ครั้ง/เฟรม (กันค้างจาก re-render ถี่เกินไป)
        let rafPending = false;
        let latestEvent = null;
        let guideOn = false;

        const process = () => {
            rafPending = false;
            const me = latestEvent;
            if (!me) return;
            const dx = ((me.clientX - startX) / rect.width) * 100;
            const dy = ((me.clientY - startY) / rect.height) * 100;
            let newX = Math.max(0, Math.min(95, startPos.x + dx));
            const newY = Math.max(0, Math.min(95, startPos.y + dy));

            // เส้นกึ่งกลางแกน y — คำนวณจุดศูนย์กลางแกน x เทียบกึ่งกลางพรีวิว (50%)
            const nodeRect = node.getBoundingClientRect();
            const elemWidthPct = (nodeRect.width / rect.width) * 100;
            const centerXPct = newX + elemWidthPct / 2;
            const snap = Math.abs(centerXPct - 50) <= SNAP_PCT;
            if (snap) newX = 50 - elemWidthPct / 2;
            if (snap !== guideOn) { guideOn = snap; setShowCenterGuide(snap); }   // อัปเดตเฉพาะตอนค่าเปลี่ยน

            setElemPositions(prev => ({
                ...prev,
                [elemId]: { ...prev[elemId], x: newX, y: newY }
            }));
        };

        const handleMove = (me) => {
            latestEvent = me;
            if (rafPending) return;
            rafPending = true;
            requestAnimationFrame(process);
        };

        const handleUp = () => {
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('mouseup', handleUp);
            if (guideOn) setShowCenterGuide(false);
        };

        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleUp);
    };

    const handleUploadBgToServer = async (file) => {
        const formData = new FormData();
        formData.append('image', file);
        formData.append('project_id', projectId);
        formData.append('user_id', userId);
        try {
            const res = await fetch(`${API}/api/label-bg-upload`, { method: 'POST', body: formData });
            const data = await res.json();
            if (data.status === 'success') {
                const url = data.image_url.startsWith('http') ? data.image_url : `${API}${data.image_url}`;
                setBgImageUrl(url);
                setBgMode('preset');
                setBgPresetId(null);
                setBgHistory(prev => [{ history_id: Date.now(), image_url: data.image_url, generation_type: 'LABEL_BG_UPLOAD', created_at: new Date().toISOString() }, ...prev]);
            } else {
                alert('อัปโหลดรูปไม่สำเร็จ: ' + (data.message || 'กรุณาลองใหม่อีกครั้ง'));
            }
        } catch (err) {
            console.error('Upload bg error:', err);
            alert('อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่อีกครั้งครับ');
        }
    };
    // ============= PACKAGING SELECTION =============
    const handleSelectPackaging = async (pkg) => {
        setSelectedPackage(pkg);

        // บันทึก package_id ลง brand_product
        if (selectedProduct) {
            try {
                await fetch(`${API}/api/brand_product/${selectedProduct.product_id}/package`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ package_id: pkg.id }),
                });

                // บันทึกลง package_catalog ด้วย
                await fetch(`${API}/api/package-catalog`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        product_id: selectedProduct.product_id,
                        package_id: pkg.id,
                        action: 'select',
                    }),
                });

                // อัปเดต selectedProduct ใน state
                setSelectedProduct(prev => ({ ...prev, package_id: pkg.id }));
                // อัปเดต products array ด้วย เพื่อให้กดย้อนกลับแล้วกลับมาเลือกสินค้าเดิมจำ package ได้
                setProducts(prev => prev.map(p => p.product_id === selectedProduct.product_id ? { ...p, package_id: pkg.id } : p));
            } catch (err) {
                console.error('Error saving package selection:', err);
            }
        }
    };

    // ============= HANDLERS =============
    const handleAddProduct = async (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append('project_id', projectId);
        formData.append('name_product', newProduct.name);
        formData.append('type_product', newProduct.type);
        if (newProduct.file) formData.append('image_product', newProduct.file);
        try {
            const res = await fetch(`${API}/api/brand_product`, { method: 'POST', body: formData });
            const data = await res.json();
            if (data.status === 'success') { setIsAddProductOpen(false); setNewProduct({ name: '', type: '', file: null }); fetchProducts(); }
        } catch (err) { }
    };

    const handleUploadCustomBg = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        handleUploadBgToServer(file);
    };

    const handleSelectPreset = (p) => {
        const url = p.image_url.startsWith('http') ? p.image_url : `${API}${p.image_url}`;
        setBgImageUrl(url);
        setBgPresetId(p.bg_preset_id);
        setBgMode('preset');
    };

    const setField = (field, value) => setLabelForm(p => ({ ...p, [field]: value }));

    const handleTagToggle = (field, option) => {
        setLabelForm(p => {
            const tags = p[field];
            return { ...p, [field]: tags.includes(option) ? tags.filter(t => t !== option) : [...tags, option] };
        });
    };

    // ตราที่ถูกเลือกแล้วของประเภทนี้หรือยัง
    const isCertSelected = (catId) => labelForm.certifications.some(c => certEntryId(c) === catId);
    // URL ของลายที่เลือกในประเภทนี้ (ถ้ามี)
    const getCertVariantUrl = (catId) => {
        const found = labelForm.certifications.find(c => certEntryId(c) === catId);
        return found ? certEntryUrl(found) : null;
    };
    // เลือก/เปลี่ยนลายของประเภทตรา → ใส่/แทนที่ในพรีวิว
    const selectCertVariant = (catId, url) => {
        setLabelForm(p => {
            const others = p.certifications.filter(c => certEntryId(c) !== catId);
            return { ...p, certifications: [...others, { id: catId, url }] };
        });
    };
    // เอาตราออก
    const removeCert = (catId) => {
        setLabelForm(p => ({ ...p, certifications: p.certifications.filter(c => certEntryId(c) !== catId) }));
        setActiveCertCat(prev => prev === catId ? null : prev);
    };

    const handleGenerateBgWithAI = async () => {
        setIsGeneratingBg(true);
        try {
            const res = await fetch(`${API}/api/generate-label-background`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ project_id: projectId, user_id: userId, style: dalleStyle, tone: dalleTone, density: dalleDensity })
            });
            const data = await res.json();
            if (data.status === 'success') {
                setBgMode('dalle');
                const url = data.data.image_url.startsWith('http') ? data.data.image_url : `${API}${data.data.image_url}`;
                setBgImageUrl(url); setBgPresetId(null);
                setBgHistory(prev => [{ history_id: Date.now(), image_url: data.data.image_url, generation_type: 'LABEL_BG', created_at: new Date().toISOString() }, ...prev]);
            } else { alert('สร้างพื้นหลังไม่สำเร็จ: ' + (data.message || '')); }
        } catch (err) { alert('AI ติดขัดชั่วคราว ลองใหม่อีกครั้งครับ'); } finally { setIsGeneratingBg(false); }
    };

    const handleAIWriteCopy = async () => {
        if (!labelForm.productName) return alert('กรุณาระบุชื่อสินค้าก่อนครับ');
        setIsLabelAILoading(true);
        try {
            const res = await fetch(`${API}/api/generate-label-content`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ product_name: labelForm.productName, raw_details: labelForm.ingredients })
            });
            const data = await res.json();
            if (data.status === 'success') {
                setLabelForm(p => ({ ...p, tagline: p.tagline || data.data.tagline, ingredients: data.data.ingredients }));
            }
        } catch (err) { alert('AI ติดขัดชั่วคราว'); } finally { setIsLabelAILoading(false); }
    };

    // ============= SAVE =============
    const finalUsageString = getFinalText(labelForm.usageTags, labelForm.usageCustom, labelForm.showUsageCustom);
    const finalStorageString = getFinalText(labelForm.storageTags, labelForm.storageCustom, labelForm.showStorageCustom);
    const finalWarningString = getFinalText(labelForm.warningTags, labelForm.warningCustom, labelForm.showWarningCustom);

        const handleSaveLabel = async (isAutoSave = false) => {
        if (!labelForm.productName || !selectedProduct) return;
        if (!isAutoSave) setIsSavingLabel(true);
        try {
            // จับภาพ label เป็น base64 สำหรับส่งไปเก็บบน server (ใช้ใน Mockup)
            let labelImageBase64 = null;
            if (labelRef.current) {
                try {
                    const canvas = await captureLabelCanvas(labelRef.current, 2);
                    labelImageBase64 = canvas.toDataURL('image/png');
                } catch (e) { console.warn('label capture error:', e); }
            }

            const payload = {
                project_id: projectId, product_id: selectedProduct.product_id,
                product_name: labelForm.productName, tagline: labelForm.tagline, net_weight: labelForm.netWeight, ingredients: labelForm.ingredients,
                usage_instruction: finalUsageString, storage_instruction: finalStorageString, warnings: finalWarningString,
                manufacturer_info: {
                    name: labelForm.manufacturerName, address: labelForm.manufacturerAddress, phone: labelForm.manufacturerPhone,
                    line: labelForm.manufacturerLine, facebook: labelForm.manufacturerFacebook, website: labelForm.manufacturerWebsite,
                },
                fda_number: labelForm.fdaNumber, mfg_date: labelForm.mfgDate || null, exp_date: labelForm.expDate || null, lot_number: labelForm.lotNumber,
                certifications: labelForm.certifications, qr_code_value: labelForm.qrValue, barcode_value: labelForm.barcodeValue,
                show_qr: labelForm.showQR, show_barcode: labelForm.showBarcode,
                layout_type: layoutType, bg_mode: bgMode, bg_color: bgColor, bg_preset_id: bgPresetId,
                bg_image_url: bgImageUrl ? bgImageUrl.replace(API, '') : '',
                bg_opacity: bgOpacity, label_width: labelDimensions.width, label_height: labelDimensions.height, text_colors: sectionColors,
                elem_positions: elemPositions, label_mode: labelMode,
                panel_id: selectedPanel?.id || null,
                label_image_base64: labelImageBase64
            };
            const res = await fetch(`${API}/api/labels`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const data = await res.json();
            if (data.status === 'success') {
                if (isAutoSave) {
                    setSaveStatus('บันทึกอัตโนมัติแล้ว ✓');
                    setProducts(prev => prev.map(p => p.product_id === selectedProduct.product_id ? { ...p, name_product: labelForm.productName } : p));
                    setSelectedProduct(prev => ({ ...prev, name_product: labelForm.productName }));
                } else alert('บันทึกฉลากเรียบร้อยครับ');
            } else { if (!isAutoSave) alert('บันทึกไม่สำเร็จ: ' + (data.message || '')); }
        } catch (err) { if (!isAutoSave) alert('Error: ' + err.message); }
        finally { if (!isAutoSave) setIsSavingLabel(false); }
    };

    // ============= EXPORT FUNCTIONS =============
    const calculateScaleFor300DPI = () => {
        const widthCm = labelDimensions.width;
        const heightCm = labelDimensions.height;
        const isLikelyCm = widthCm <= 100 && heightCm <= 100;
        if (!isLikelyCm) return 3;
        const targetWidthPx = (widthCm / 2.54) * 300;
        const currentRenderWidthPx = labelRef.current?.offsetWidth || 380;
        const scale = Math.ceil(targetWidthPx / currentRenderWidthPx);
        return Math.max(2, Math.min(scale, 10));
    };

    const handleDownloadLabel = async () => {
        if (!labelRef.current) return;
        handleSaveLabel(true);
        try {
            const canvas = await captureLabelCanvas(labelRef.current, 2);
            const link = document.createElement("a");
            link.href = canvas.toDataURL("image/png");
            link.download = `Label_Preview_${labelForm.productName || 'design'}.png`;
            link.click();
        } catch (err) { alert('ไม่สามารถดาวน์โหลดได้: รูปภาพอาจมาจากแหล่งที่บล็อก CORS'); }
    };

    const handleExportPrintReady = async () => {
        if (!labelRef.current) return;
        handleSaveLabel(true);
        const warnings = [];
        if (!labelForm.productName) warnings.push('ยังไม่มีชื่อสินค้า');
        if (!labelForm.ingredients) warnings.push('ยังไม่มีส่วนประกอบ');
        if (!labelForm.manufacturerName) warnings.push('ยังไม่มีชื่อผู้ผลิต');
        if (!labelForm.fdaNumber) warnings.push('ยังไม่มีเลข อย.');
        if (!labelForm.expDate) warnings.push('ยังไม่มีวันหมดอายุ');
        if (!labelForm.mfgDate) warnings.push('ยังไม่มีวันผลิต');
        if (!labelForm.showBarcode && !labelForm.showQR) warnings.push('ยังไม่มี Barcode หรือ QR Code');
        if (warnings.length > 0) {
            const proceed = window.confirm(` ข้อมูลฉลากยังไม่ครบสำหรับส่งพิมพ์:\n\n• ${warnings.join('\n• ')}\n\nต้องการดาวน์โหลดต่อหรือไม่?`);
            if (!proceed) return;
        }
        try {
            const scale = calculateScaleFor300DPI();
            const canvas = await captureLabelCanvas(labelRef.current, scale);
            const link = document.createElement("a");
            link.href = canvas.toDataURL("image/png", 1.0);
            link.download = `Label_PrintReady_${labelForm.productName || 'design'}_300dpi.png`;
            link.click();
            const widthCm = labelDimensions.width;
            const heightCm = labelDimensions.height;
            alert(`ดาวน์โหลดสำเร็จ!\n\n ขนาดฉลาก: ${widthCm} × ${heightCm} ซม.\n ขนาดภาพ: ${canvas.width} × ${canvas.height} px\n DPI โดยประมาณ: ${Math.round((canvas.width / (widthCm / 2.54)))}\n\n หมายเหตุสำหรับโรงพิมพ์:\n• ระบบสี: RGB (กรุณาแปลงเป็น CMYK ก่อนพิมพ์)\n• กรุณาเผื่อ Bleed 3 มม. รอบด้าน\n• แนะนำกระดาษ: อาร์ตมัน 210-260 แกรม`);
        } catch (err) { alert('ไม่สามารถ export ได้: ' + err.message); }
    };

    const handleExportLabelPDF = async () => {
        if (!labelRef.current || !selectedProduct) return;
        handleSaveLabel(true);
        try {
            const scale = calculateScaleFor300DPI();
            const canvas = await captureLabelCanvas(labelRef.current, scale);
            const imageData = canvas.toDataURL("image/png", 1.0);

            const widthCm = labelDimensions.width;
            const heightCm = labelDimensions.height;
            const widthMm = widthCm * 10;
            const heightMm = heightCm * 10;
            const bleed = 3; // mm
            const totalW = widthMm + bleed * 2;
            const totalH = heightMm + bleed * 2;

            // --- หน้า 1: ฉลาก Print-Ready ---
            const pdf = new jsPDF({ orientation: totalW > totalH ? 'l' : 'p', unit: 'mm', format: [totalW, totalH] });
            pdf.setFillColor(255, 255, 255);
            pdf.rect(0, 0, totalW, totalH, 'F');
            pdf.addImage(imageData, 'PNG', bleed, bleed, widthMm, heightMm);

            // Crop marks
            const cl = 5;
            pdf.setDrawColor(0); pdf.setLineWidth(0.1);
            // bottom-left
            pdf.line(0, bleed, cl, bleed); pdf.line(bleed, 0, bleed, cl);
            // bottom-right
            pdf.line(totalW - cl, bleed, totalW, bleed); pdf.line(totalW - bleed, 0, totalW - bleed, cl);
            // top-left
            pdf.line(0, totalH - bleed, cl, totalH - bleed); pdf.line(bleed, totalH - cl, bleed, totalH);
            // top-right
            pdf.line(totalW - cl, totalH - bleed, totalW, totalH - bleed); pdf.line(totalW - bleed, totalH - cl, totalW - bleed, totalH);

            // --- หน้า 2: Spec Sheet ---
            pdf.addPage('a4', 'p');
            pdf.setFont('helvetica', 'bold'); pdf.setFontSize(18);
            pdf.text('LABEL PRINT SPECIFICATION', 20, 25);

            pdf.setFont('helvetica', 'normal'); pdf.setFontSize(11);
            let y = 45;
            const specs = [
                `Label Size: ${widthCm} x ${heightCm} cm (${widthMm} x ${heightMm} mm)`,
                `Bleed: ${bleed} mm each side`,
                `Total with bleed: ${totalW} x ${totalH} mm`,
                `Image Resolution: ${canvas.width} x ${canvas.height} px`,
                `Estimated DPI: ${Math.round(canvas.width / (widthCm / 2.54))}`,
                '',
                'PRINTING NOTES:',
                '1. Color space: sRGB (convert to CMYK before printing)',
                '2. Crop marks at 4 corners - trim along marks',
                '3. Recommended paper: Art card 210-260 gsm',
                '4. Recommended finish: Matte or glossy lamination',
            ];
            specs.forEach(s => {
                if (s === '') { y += 5; return; }
                if (s.startsWith('PRINTING')) { pdf.setFont('helvetica', 'bold'); pdf.setFontSize(13); }
                pdf.text(s, 20, y);
                if (s.startsWith('PRINTING')) { pdf.setFont('helvetica', 'normal'); pdf.setFontSize(11); }
                y += 7;
            });

            // Colors used
            if (labelAssets.colors?.length > 0) {
                y += 8;
                pdf.setFont('helvetica', 'bold'); pdf.setFontSize(13);
                pdf.text('COLORS USED', 20, y); y += 10;
                pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10);
                labelAssets.colors.forEach(hex => {
                    if (!hex || hex.length < 7) return;
                    const r = parseInt(hex.slice(1, 3), 16);
                    const g = parseInt(hex.slice(3, 5), 16);
                    const b = parseInt(hex.slice(5, 7), 16);
                    pdf.setFillColor(r, g, b);
                    pdf.rect(20, y - 4, 8, 5, 'F');
                    pdf.setTextColor(0); pdf.text(`${hex.toUpperCase()}`, 32, y);
                    y += 8;
                });
            }

            // Label preview thumbnail
            y += 10;
            pdf.setFont('helvetica', 'bold'); pdf.setFontSize(13); pdf.setTextColor(0);
            pdf.text('LABEL PREVIEW', 20, y); y += 5;
            const aspect = widthMm / heightMm;
            const prevMaxW = 80, prevMaxH = 100;
            let prevW, prevH;
            if (aspect > prevMaxW / prevMaxH) { prevW = prevMaxW; prevH = prevMaxW / aspect; }
            else { prevH = prevMaxH; prevW = prevMaxH * aspect; }
            if (y + prevH < 280) {
                pdf.addImage(imageData, 'PNG', 20, y, prevW, prevH);
            }

            pdf.save(`Label_${labelForm.productName || 'design'}_PrintReady.pdf`);
        } catch (err) { alert('เกิดข้อผิดพลาด: ' + err.message); }
    };

    // ============= EXPORT: ILLUSTRATOR (Layered Vector SVG) =============
    // สร้างไฟล์ SVG เวกเตอร์ แยกเลเยอร์ ข้อความแก้ไขต่อได้ + เผื่อขอบตัดตก (bleed) สีล้นออกมา
    const escapeXml = (s = '') => String(s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

    const imageToDataUrl = async (url) => {
        if (!url) return null;
        if (url.startsWith('data:')) return url;
        try {
            const res = await fetch(url, { mode: 'cors' });
            const blob = await res.blob();
            return await new Promise((resolve) => {
                const fr = new FileReader();
                fr.onload = () => resolve(fr.result);
                fr.onerror = () => resolve(null);
                fr.readAsDataURL(blob);
            });
        } catch (e) { return null; }
    };

    // ข้อความแต่ละ "ย่อหน้า" ของแต่ละ element (ก่อนตัดบรรทัดตามความกว้าง)
    const getElementParagraphs = (elemId) => {
        switch (elemId) {
            case 'productName': return labelForm.productName ? [labelForm.productName] : [];
            case 'tagline': return labelForm.tagline ? [labelForm.tagline] : [];
            case 'netWeight': return labelForm.netWeight ? [`ปริมาณสุทธิ: ${labelForm.netWeight}`] : [];
            case 'ingredients': return labelForm.ingredients ? ['ส่วนประกอบ:', ...labelForm.ingredients.split('\n')] : [];
            case 'usage': return finalUsageString ? [`วิธีใช้: ${finalUsageString}`] : [];
            case 'storage': return finalStorageString ? [`วิธีเก็บ: ${finalStorageString}`] : [];
            case 'warnings': return finalWarningString ? [`⚠ ${finalWarningString}`] : [];
            case 'manufacturer': {
                const items = [];
                if (labelForm.manufacturerName) items.push('ผลิตโดย: ' + labelForm.manufacturerName);
                if (labelForm.manufacturerAddress) items.push(labelForm.manufacturerAddress);
                const contact = [labelForm.manufacturerPhone && 'โทร. ' + labelForm.manufacturerPhone, labelForm.manufacturerLine && 'Line: ' + labelForm.manufacturerLine].filter(Boolean).join(' | ');
                if (contact) items.push(contact);
                return items;
            }
            case 'legal': {
                const legalItems = [labelForm.fdaNumber && 'อย. ' + labelForm.fdaNumber, labelForm.lotNumber && 'Lot: ' + labelForm.lotNumber, labelForm.mfgDate && 'MFG: ' + labelForm.mfgDate, labelForm.expDate && 'EXP: ' + labelForm.expDate].filter(Boolean);
                return legalItems.length ? [legalItems.join(' • ')] : [];
            }
            default: return [];
        }
    };

    const TEXT_BASE_FONT = { productName: 22, tagline: 17, netWeight: 15, ingredients: 17, usage: 17, storage: 17, warnings: 17, manufacturer: 9, legal: 9 };
    // น้ำหนักฟอนต์ที่ใส่ตายตัวในพรีวิว (productName=800, tagline=600) ต้องส่งไปด้วยให้ไฟล์ตรงกัน
    const INTRINSIC_WEIGHT = { productName: 700, tagline: 600 };
    const LEFT_ALIGN_ELEMS = ['ingredients', 'usage', 'storage', 'warnings'];

    const getElementTextStyle = (elemId) => {
        const es = elemStyles[elemId] || DEFAULT_ELEM_STYLE;
        let color = es.color;
        if (!color) {
            if (elemId === 'tagline') color = sectionColors.tagline;
            else if (elemId === 'warnings') color = '#c0392b';
            else if (['netWeight', 'manufacturer', 'legal'].includes(elemId)) color = sectionColors.details;
            else color = sectionColors.productName;
        }
        const align = es.align || (LEFT_ALIGN_ELEMS.includes(elemId) ? 'left' : (layoutType === 'modern_side' ? 'left' : 'center'));
        const scale = elemPositions[elemId]?.scale || 1;
        const weight = es.bold ? 700 : (INTRINSIC_WEIGHT[elemId] || 400);
        return {
            color,
            weight,
            bold: weight >= 700,
            italic: !!es.italic,
            align,
            fontPx: (TEXT_BASE_FONT[elemId] || 12) * scale,
        };
    };

    const handleExportIllustratorSVG = async () => {
        if (!labelRef.current) return;
        handleSaveLabel(true);

        // ยกเลิกการเลือก/แก้ไขเพื่อไม่ให้มี handle/กรอบติดไปในไฟล์
        setSelectedElem(null);
        setEditingElem(null);
        setShowCenterGuide(false);
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

        try {
            // ===== ขนาดงานจริง (mm) + ขอบตัดตก =====
            const isLikelyCm = (labelDimensions.width <= 100 && labelDimensions.height <= 100);
            const containerW = isLikelyCm ? Math.round(labelDimensions.width * PREVIEW_PX_PER_CM) : (labelDimensions.width || 380);
            const containerH = isLikelyCm ? Math.round(labelDimensions.height * PREVIEW_PX_PER_CM) : (labelDimensions.height || 500);
            const wMm = isLikelyCm ? labelDimensions.width * 10 : (selectedPanel?.w_mm || labelDimensions.width);
            const hMm = isLikelyCm ? labelDimensions.height * 10 : (selectedPanel?.h_mm || labelDimensions.height);
            const bleedMm = Number(materialData?.bleed_mm || 3);             // มาตรฐานโรงพิมพ์ 3 มม.
            const pxPerMm = containerW / wMm;
            const bleedPx = bleedMm * pxPerMm;
            const totalPxW = containerW + bleedPx * 2;
            const totalPxH = containerH + bleedPx * 2;
            const totalMmW = wMm + bleedMm * 2;
            const totalMmH = hMm + bleedMm * 2;
            const OFF = bleedPx;                                             // เลื่อนเนื้อหาเข้ามาตามขอบตัดตก

            // ฟอนต์
            const fontFamily = (labelAssets.font || 'Bai Jamjuree').replace(/['"]/g, '').split(',')[0].trim();

            // วัดตำแหน่งจริงจาก DOM (หาร zoom ออก)
            const baseRect = labelRef.current.getBoundingClientRect();
            const zoomRatio = containerW / baseRect.width;
            const rectOf = (node) => {
                const r = node.getBoundingClientRect();
                return {
                    x: (r.left - baseRect.left) * zoomRatio,
                    y: (r.top - baseRect.top) * zoomRatio,
                    w: r.width * zoomRatio,
                    h: r.height * zoomRatio,
                };
            };

            // ===== เตรียม data URL ของรูปทั้งหมด =====
            const certEntries = labelForm.certifications.map(c => ({ id: certEntryId(c), url: certEntryUrl(c) })).filter(c => c.url);
            const urlSet = new Set();
            if (labelAssets.logoUrl) urlSet.add(labelAssets.logoUrl);
            if (bgMode !== 'solid' && bgImageUrl) urlSet.add(bgImageUrl);
            certEntries.forEach(c => urlSet.add(c.url));
            const dataUrlMap = {};
            await Promise.all([...urlSet].map(async u => { dataUrlMap[u] = await imageToDataUrl(u); }));

            // ===== ตัวช่วยตัดบรรทัดข้อความตามความกว้างกล่อง =====
            const measureCtx = document.createElement('canvas').getContext('2d');
            const wrapParagraph = (text, fontPx, bold, italic, maxW) => {
                measureCtx.font = `${italic ? 'italic ' : ''}${bold ? '700' : '400'} ${fontPx}px ${fontFamily}, sans-serif`;
                if (!maxW || maxW <= 0) return [text];
                const words = text.split(/(\s+)/); // เก็บช่องว่างไว้
                const lines = [];
                let cur = '';
                for (const word of words) {
                    const test = cur + word;
                    if (measureCtx.measureText(test).width > maxW && cur.trim() !== '') {
                        lines.push(cur.trimEnd());
                        cur = word.trimStart();
                    } else {
                        cur = test;
                    }
                }
                if (cur.trim() !== '') lines.push(cur.trimEnd());
                return lines.length ? lines : [text];
            };

            // ===== สร้างเลเยอร์ =====
            const layers = [];

            // เลเยอร์พื้นหลัง (สีล้นเต็มพื้นที่รวมขอบตัดตก)
            let bgInner = '';
            if (bgMode === 'solid') {
                bgInner = `<rect x="0" y="0" width="${totalPxW.toFixed(2)}" height="${totalPxH.toFixed(2)}" fill="${escapeXml(bgColor)}"/>`;
            } else if (bgImageUrl && dataUrlMap[bgImageUrl]) {
                bgInner = `<image x="0" y="0" width="${totalPxW.toFixed(2)}" height="${totalPxH.toFixed(2)}" preserveAspectRatio="xMidYMid slice" opacity="${bgOpacity}" xlink:href="${dataUrlMap[bgImageUrl]}"/>`;
            } else {
                bgInner = `<rect x="0" y="0" width="${totalPxW.toFixed(2)}" height="${totalPxH.toFixed(2)}" fill="#FFFFFF"/>`;
            }
            layers.push(`  <g id="พื้นหลัง" inkscape:groupmode="layer" inkscape:label="พื้นหลัง (Background + Bleed)">\n    ${bgInner}\n  </g>`);

            // เลเยอร์ของแต่ละ object ตามลำดับการซ้อน
            const ordered = getOrderedElements();
            for (const elem of ordered) {
                const pos = elemPositions[elem.id];
                if (!pos || !pos.visible) continue;
                const node = labelRef.current.querySelector(`[data-elem-id="${elem.id}"]`);
                if (!node) continue;
                const box = rectOf(node);
                const layerName = elem.label;
                let inner = '';

                if (elem.id === 'logo') {
                    const du = dataUrlMap[labelAssets.logoUrl];
                    if (du) inner = `<image x="${(OFF + box.x).toFixed(2)}" y="${(OFF + box.y).toFixed(2)}" width="${box.w.toFixed(2)}" height="${box.h.toFixed(2)}" preserveAspectRatio="xMidYMid meet" xlink:href="${du}"/>`;
                } else if (elem.id === 'certifications') {
                    const imgs = node.querySelectorAll('img');
                    imgs.forEach((img) => {
                        const r = rectOf(img);
                        const du = dataUrlMap[img.getAttribute('src')] || dataUrlMap[img.src];
                        if (du) inner += `<image x="${(OFF + r.x).toFixed(2)}" y="${(OFF + r.y).toFixed(2)}" width="${r.w.toFixed(2)}" height="${r.h.toFixed(2)}" preserveAspectRatio="xMidYMid meet" xlink:href="${du}"/>`;
                    });
                } else if (elem.id === 'codes') {
                    const svgs = node.querySelectorAll('svg');
                    svgs.forEach((svgEl) => {
                        const r = rectOf(svgEl);
                        const clone = svgEl.cloneNode(true);
                        let vb = clone.getAttribute('viewBox');
                        if (!vb) {
                            const ow = parseFloat(clone.getAttribute('width')) || r.w;
                            const oh = parseFloat(clone.getAttribute('height')) || r.h;
                            vb = `0 0 ${ow} ${oh}`;
                        }
                        clone.setAttribute('viewBox', vb);
                        clone.setAttribute('x', (OFF + r.x).toFixed(2));
                        clone.setAttribute('y', (OFF + r.y).toFixed(2));
                        clone.setAttribute('width', r.w.toFixed(2));
                        clone.setAttribute('height', r.h.toFixed(2));
                        clone.setAttribute('preserveAspectRatio', 'xMidYMid meet');
                        inner += new XMLSerializer().serializeToString(clone);
                    });
                } else {
                    // เลเยอร์ข้อความ → <text> แก้ไขต่อได้
                    const paragraphs = getElementParagraphs(elem.id);
                    if (paragraphs.length) {
                        const st = getElementTextStyle(elem.id);
                        const lineH = st.fontPx * 1.4;
                        const anchor = st.align === 'center' ? 'middle' : st.align === 'right' ? 'end' : 'start';
                        const tx = st.align === 'center' ? OFF + box.x + box.w / 2 : st.align === 'right' ? OFF + box.x + box.w : OFF + box.x;
                        // ตัดบรรทัดตามความกว้างกล่องจริง
                        const allLines = [];
                        paragraphs.forEach(p => wrapParagraph(p, st.fontPx, st.bold, st.italic, box.w).forEach(l => allLines.push(l)));
                        const startY = OFF + box.y + st.fontPx;     // baseline บรรทัดแรก
                        const tspans = allLines.map((line, i) =>
                            `<tspan x="${tx.toFixed(2)}" ${i === 0 ? `y="${startY.toFixed(2)}"` : `dy="${lineH.toFixed(2)}"`}>${escapeXml(line)}</tspan>`
                        ).join('');
                        inner = `<text text-anchor="${anchor}" font-family="${escapeXml(fontFamily)}, sans-serif" font-size="${st.fontPx.toFixed(2)}" font-weight="${st.bold ? '700' : '400'}" font-style="${st.italic ? 'italic' : 'normal'}" fill="${escapeXml(st.color)}" xml:space="preserve">${tspans}</text>`;
                    }
                }

                if (inner) {
                    layers.push(`  <g id="${escapeXml(layerName)}" inkscape:groupmode="layer" inkscape:label="${escapeXml(layerName)}">\n    ${inner}\n  </g>`);
                }
            }

            // เลเยอร์เส้นไกด์: ขอบตัดจริง (Trim) + ขอบตัดตก (Bleed) — สำหรับโรงพิมพ์
            const guide =
                `  <g id="เส้นไกด์-โรงพิมพ์" inkscape:groupmode="layer" inkscape:label="เส้นไกด์ (Trim/Bleed)">\n` +
                `    <rect x="${OFF.toFixed(2)}" y="${OFF.toFixed(2)}" width="${containerW.toFixed(2)}" height="${containerH.toFixed(2)}" fill="none" stroke="#FF00FF" stroke-width="${Math.max(0.5, 0.25 * pxPerMm).toFixed(2)}" stroke-dasharray="${(2 * pxPerMm).toFixed(2)},${(2 * pxPerMm).toFixed(2)}"/>\n` +
                `    <rect x="0" y="0" width="${totalPxW.toFixed(2)}" height="${totalPxH.toFixed(2)}" fill="none" stroke="#00AEEF" stroke-width="${Math.max(0.5, 0.25 * pxPerMm).toFixed(2)}" stroke-dasharray="${(1 * pxPerMm).toFixed(2)},${(1.5 * pxPerMm).toFixed(2)}"/>\n` +
                `  </g>`;
            layers.push(guide);

            // ===== ประกอบ SVG =====
            const svg =
                `<?xml version="1.0" encoding="UTF-8"?>\n` +
                `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" ` +
                `width="${totalMmW}mm" height="${totalMmH}mm" viewBox="0 0 ${totalPxW.toFixed(2)} ${totalPxH.toFixed(2)}">\n` +
                `<title>${escapeXml(labelForm.productName || 'label')}</title>\n` +
                `<desc>Trim ${wMm}x${hMm} mm | Bleed ${bleedMm} mm | Total ${totalMmW}x${totalMmH} mm</desc>\n` +
                layers.join('\n') + '\n' +
                `</svg>`;

            const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `Label_${labelForm.productName || 'design'}_Illustrator.svg`;
            link.click();
            setTimeout(() => URL.revokeObjectURL(link.href), 1000);

            alert(
                `ดาวน์โหลดไฟล์ Illustrator (SVG เวกเตอร์) สำเร็จ!\n\n` +
                `• ขนาดงานจริง: ${wMm} × ${hMm} มม.\n` +
                `• เผื่อขอบตัดตก (Bleed): ${bleedMm} มม. รอบด้าน (สีพื้นล้นออกมาแล้ว)\n` +
                `• ขนาดรวมขอบตัดตก: ${totalMmW} × ${totalMmH} มม.\n` +
                `• แต่ละ object แยกเป็นเลเยอร์ + ข้อความแก้ไขต่อได้\n\n` +
                `เปิดใน Illustrator: File > Open ไฟล์ .svg นี้\n` +
                `แต่ละชิ้นจะถูกจัดเป็นกลุ่ม/เลเยอร์ตามชื่อ — ถ้าต้องการให้แยกเป็น Layer เต็มรูปแบบ ใช้คำสั่ง Layers > Release to Layers ได้`
            );
        } catch (err) {
            console.error('SVG export error:', err);
            alert('สร้างไฟล์ Illustrator ไม่สำเร็จ: ' + err.message);
        }
    };

    // ============= EXPORT: ILLUSTRATOR (.ai เวกเตอร์จริง ผ่าน backend) =============
    const handleExportIllustratorAI = async () => {
        if (!labelRef.current) return;
        handleSaveLabel(true);
        setSelectedElem(null);
        setEditingElem(null);
        setShowCenterGuide(false);
        setSaveStatus('กำลังสร้างไฟล์ Illustrator...');
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

        try {
            // ขนาด/สเกล
            const isLikelyCm = (labelDimensions.width <= 100 && labelDimensions.height <= 100);
            const containerW = isLikelyCm ? Math.round(labelDimensions.width * PREVIEW_PX_PER_CM) : (labelDimensions.width || 380);
            const containerH = isLikelyCm ? Math.round(labelDimensions.height * PREVIEW_PX_PER_CM) : (labelDimensions.height || 500);
            const wMm = isLikelyCm ? labelDimensions.width * 10 : (selectedPanel?.w_mm || labelDimensions.width);
            const hMm = isLikelyCm ? labelDimensions.height * 10 : (selectedPanel?.h_mm || labelDimensions.height);
            const bleedMm = Number(materialData?.bleed_mm || 3);
            const pxPerMm = containerW / wMm;

            const baseRect = labelRef.current.getBoundingClientRect();
            const zoomRatio = containerW / baseRect.width;
            const rectMm = (node) => {
                const r = node.getBoundingClientRect();
                return {
                    x_mm: ((r.left - baseRect.left) * zoomRatio) / pxPerMm,
                    y_mm: ((r.top - baseRect.top) * zoomRatio) / pxPerMm,
                    w_mm: (r.width * zoomRatio) / pxPerMm,
                    h_mm: (r.height * zoomRatio) / pxPerMm,
                    w_px: r.width * zoomRatio,
                };
            };

            // ลดขนาดรูปก่อนส่ง (เลี่ยง payload ใหญ่ + รูปตราต้นฉบับหนัก 2-6MB)
            const loadImg = (src) => new Promise((resolve, reject) => {
                const im = new Image();
                im.onload = () => resolve(im);
                im.onerror = reject;
                im.src = src;
            });
            const downscaleDataUrl = async (url, maxDim) => {
                const dataUrl = await imageToDataUrl(url);
                if (!dataUrl) return null;
                try {
                    const im = await loadImg(dataUrl);
                    const scale = Math.min(1, maxDim / Math.max(im.width || maxDim, im.height || maxDim));
                    const cw = Math.max(1, Math.round((im.width || maxDim) * scale));
                    const ch = Math.max(1, Math.round((im.height || maxDim) * scale));
                    const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
                    cv.getContext('2d').drawImage(im, 0, 0, cw, ch);
                    return cv.toDataURL('image/png');
                } catch (e) { return dataUrl; }
            };
            const svgToPng = async (svgEl, scale = 4) => {
                const xml = new XMLSerializer().serializeToString(svgEl);
                const src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)));
                const im = await loadImg(src);
                const r = svgEl.getBoundingClientRect();
                const cw = Math.max(1, Math.round((r.width || im.width) * scale));
                const ch = Math.max(1, Math.round((r.height || im.height) * scale));
                const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
                cv.getContext('2d').drawImage(im, 0, 0, cw, ch);
                return cv.toDataURL('image/png');
            };

            // ตัวช่วยตัดบรรทัด
            const measureCtx = document.createElement('canvas').getContext('2d');
            const fontFamily = (labelAssets.font || 'Bai Jamjuree').replace(/['"]/g, '').split(',')[0].trim();
            const wrap = (text, fontPx, bold, italic, maxWpx) => {
                measureCtx.font = `${italic ? 'italic ' : ''}${bold ? '700' : '400'} ${fontPx}px ${fontFamily}, sans-serif`;
                if (!maxWpx || maxWpx <= 0) return [text];
                const words = text.split(/(\s+)/);
                const lines = []; let cur = '';
                for (const w of words) {
                    const test = cur + w;
                    if (measureCtx.measureText(test).width > maxWpx && cur.trim() !== '') { lines.push(cur.trimEnd()); cur = w.trimStart(); }
                    else cur = test;
                }
                if (cur.trim() !== '') lines.push(cur.trimEnd());
                return lines.length ? lines : [text];
            };

            // สร้างรายการ element (ล่าง→บน)
            const elements = [];
            for (const elem of getOrderedElements()) {
                const pos = elemPositions[elem.id];
                if (!pos || !pos.visible) continue;
                const node = labelRef.current.querySelector(`[data-elem-id="${elem.id}"]`);
                if (!node) continue;

                if (elem.isCustomImage) {
                    const img = node.querySelector('img');
                    if (img) {
                        const dataUrl = await downscaleDataUrl(img.getAttribute('src') || img.src, 900);
                        if (dataUrl) elements.push({ type: 'image', name: elem.label, ...rectMm(img), dataUrl });
                    }
                } else if (elem.id === 'logo') {
                    const img = node.querySelector('img');
                    if (img && labelAssets.logoUrl) {
                        const dataUrl = await downscaleDataUrl(labelAssets.logoUrl, 700);
                        if (dataUrl) elements.push({ type: 'image', name: elem.label, ...rectMm(img), dataUrl });
                    }
                } else if (elem.id === 'certifications') {
                    for (const img of node.querySelectorAll('img')) {
                        const dataUrl = await downscaleDataUrl(img.getAttribute('src') || img.src, 400);
                        if (dataUrl) elements.push({ type: 'image', name: elem.label, ...rectMm(img), dataUrl });
                    }
                } else if (elem.id === 'codes') {
                    for (const svgEl of node.querySelectorAll('svg')) {
                        try {
                            const dataUrl = await svgToPng(svgEl, 4);
                            elements.push({ type: 'image', name: elem.label, ...rectMm(svgEl), dataUrl });
                        } catch (e) { /* skip */ }
                    }
                } else {
                    const paragraphs = getElementParagraphs(elem.id);
                    if (!paragraphs.length) continue;
                    const st = getElementTextStyle(elem.id);
                    const box = rectMm(node);
                    const lines = [];
                    paragraphs.forEach(p => wrap(p, st.fontPx, st.bold, st.italic, box.w_px).forEach(l => lines.push(l)));
                    elements.push({
                        type: 'text', name: elem.label,
                        x_mm: box.x_mm, y_mm: box.y_mm, w_mm: box.w_mm, h_mm: box.h_mm,
                        fontMm: st.fontPx / pxPerMm, lineHeightMm: (st.fontPx * 1.4) / pxPerMm,
                        color: st.color, weight: st.weight, bold: st.bold, italic: st.italic, align: st.align, lines,
                    });
                }
            }

            // พื้นหลัง
            let background;
            if (bgMode === 'solid') background = { mode: 'solid', color: bgColor };
            else background = { mode: 'image', imageDataUrl: await downscaleDataUrl(bgImageUrl, 1600), opacity: bgOpacity };

            const payload = {
                product_name: labelForm.productName || 'design',
                label_width_cm: labelDimensions.width, label_height_cm: labelDimensions.height,
                bleed_mm: bleedMm, background, elements,
                font_family: (labelAssets.font || 'Bai Jamjuree').replace(/['"]/g, '').split(',')[0].trim(),
            };

            const resp = await fetch(`${API}/api/labels/export-ai`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
            });
            if (!resp.ok) {
                const e = await resp.json().catch(() => ({}));
                throw new Error(e.message || 'สร้างไฟล์ไม่สำเร็จ');
            }
            const blob = await resp.blob();
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `Label_${labelForm.productName || 'design'}_CMYK.ai`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(link.href), 1000);
            setSaveStatus('สร้างไฟล์ Illustrator (.ai) สำเร็จ ✓');
        } catch (err) {
            console.error('AI export error:', err);
            setSaveStatus('');
            alert('สร้างไฟล์ Illustrator ไม่สำเร็จ: ' + err.message);
        }
    };

    // ============= RENDER LABEL PREVIEW (Draggable Canvas) =============
    const renderElemContent = (elemId) => {
        // รูปภาพที่อัปโหลดเอง
        const customImg = customImages.find(im => im.id === elemId);
        if (customImg) {
            return <img src={customImg.url} crossOrigin="anonymous" alt={customImg.label}
                style={{ maxWidth: 220, maxHeight: 220, width: 'auto', height: 'auto', objectFit: 'contain', display: 'block', pointerEvents: 'none' }} />;
        }

        const textColor = sectionColors.productName;
        const accentColor = sectionColors.tagline;
        const subColor = sectionColors.details;
        const align = layoutType === 'modern_side' ? 'left' : 'center';

        // Per-element style overrides
        const es = elemStyles[elemId] || DEFAULT_ELEM_STYLE;
        const esColor = es.color || textColor;
        const esAlign = es.align || align;
        const esFontWeight = es.bold ? '800' : undefined;
        const esFontStyle = es.italic ? 'italic' : undefined;
        const esTextDecoration = es.underline ? 'underline' : undefined;
        // fontFamily ต้องกำหนด inline บนตัวข้อความเอง เพราะมีกฎ CSS ระดับ global (Poppins) override การ inherit จาก labelRef
        const esBase = { fontFamily: labelAssets.font, fontWeight: esFontWeight, fontStyle: esFontStyle, textDecoration: esTextDecoration, textAlign: esAlign, color: esColor };

        // helper: ช่องแก้ไขข้อความในพรีวิว (กล่องคงขนาดเดิม)
        const inlineEdit = (field, multiline = false, extraStyle = {}) => (
            <EditableText
                value={labelForm[field]}
                multiline={multiline}
                onCommit={(v) => setField(field, v)}
                onDone={() => setEditingElem(null)}
                style={extraStyle}
            />
        );

        switch (elemId) {
            case 'logo':
                return labelAssets.logoUrl
                    ? <img src={labelAssets.logoUrl} crossOrigin="anonymous" alt="logo" style={{ maxWidth: 120, maxHeight: 120, width: 'auto', height: 'auto', objectFit: 'contain', display: 'block' }} />
                    : <div style={{ width: 90, height: 90, background: 'rgba(0,0,0,0.06)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: 15 }}>LOGO</div>;
            case 'productName':
                return <div style={{ fontSize: 22, fontWeight: 800, color: textColor, textAlign: align, lineHeight: 1.2, ...esBase }}>{editingElem === 'productName' ? inlineEdit('productName') : (labelForm.productName || <span style={{ opacity: .35 }}>ชื่อสินค้า</span>)}</div>;
            case 'tagline':
                return editingElem === 'tagline'
                    ? <div style={{ fontSize: 17, fontWeight: 600, color: accentColor, textAlign: align, ...esBase }}>{inlineEdit('tagline')}</div>
                    : (labelForm.tagline ? <div style={{ fontSize: 17, fontWeight: 600, color: accentColor, textAlign: align, ...esBase }}>{labelForm.tagline}</div> : <div style={{ fontSize: 17, color: '#ccc', textAlign: align }}>คำโปรย</div>);
            case 'netWeight':
                return (labelForm.netWeight || editingElem === 'netWeight')
                    ? <div style={{ fontSize: 15, color: subColor, textAlign: align, ...esBase }}>ปริมาณสุทธิ: {editingElem === 'netWeight' ? inlineEdit('netWeight') : labelForm.netWeight}</div>
                    : null;
            case 'certifications':
                return labelForm.certifications.length > 0 ? (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: align === 'left' ? 'flex-start' : 'center' }}>
                        {labelForm.certifications.map((c, i) => {
                            const url = certEntryUrl(c);
                            return url ? <img key={certEntryId(c) || i} src={url} crossOrigin="anonymous" alt="" style={{ width: 36, height: 36, objectFit: 'contain' }} /> : null;
                        })}
                    </div>
                ) : null;
            case 'ingredients':
                return (labelForm.ingredients || editingElem === 'ingredients') ? (
                    <div style={{ fontSize: 17, lineHeight: 1.5, textAlign: 'left', maxWidth: 280, ...esBase }}>
                        <strong style={{ color: esColor }}>ส่วนประกอบ:</strong>
                        {editingElem === 'ingredients'
                            ? inlineEdit('ingredients', true, { display: 'block', color: esColor, lineHeight: 1.5 })
                            : <div style={{ whiteSpace: 'pre-wrap', color: esColor }}>{labelForm.ingredients}</div>}
                    </div>
                ) : <div style={{ fontSize: 9, color: '#ccc' }}>ส่วนประกอบ...</div>;
            case 'usage':
                return finalUsageString ? <div style={{ fontSize: 17, textAlign: 'left', maxWidth: 280, ...esBase }}><strong style={{ color: esColor }}>วิธีใช้:</strong> <span style={{ color: esColor }}>{finalUsageString}</span></div> : null;
            case 'storage':
                return finalStorageString ? <div style={{ fontSize: 17, textAlign: 'left', maxWidth: 280, ...esBase }}><strong style={{ color: esColor }}>วิธีเก็บ:</strong> <span style={{ color: esColor }}>{finalStorageString}</span></div> : null;
            case 'warnings':
                return finalWarningString ? <div style={{ fontSize: 17, color: '#c0392b', textAlign: 'left', maxWidth: 280, ...esBase }}>⚠ {finalWarningString}</div> : null;
            case 'codes':
                return (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {labelForm.showQR && labelForm.qrValue && <div style={{ background: '#fff', padding: 4, borderRadius: 4 }}><MemoQR value={labelForm.qrValue} size={48} /></div>}
                        {labelForm.showBarcode && labelForm.barcodeValue && <div style={{ background: '#fff', padding: 3, borderRadius: 4 }}><MemoBarcode value={labelForm.barcodeValue} height={30} fontSize={8} width={1} margin={0} /></div>}
                        {!labelForm.showQR && !labelForm.showBarcode && <div style={{ fontSize: 9, color: '#ccc' }}>QR/Barcode</div>}
                    </div>
                );
            case 'manufacturer': {
                const items = [];
                if (labelForm.manufacturerName) items.push('ผลิตโดย: ' + labelForm.manufacturerName);
                if (labelForm.manufacturerAddress) items.push(labelForm.manufacturerAddress);
                const contact = [labelForm.manufacturerPhone && 'โทร. ' + labelForm.manufacturerPhone, labelForm.manufacturerLine && 'Line: ' + labelForm.manufacturerLine].filter(Boolean).join(' | ');
                if (contact) items.push(contact);
                return items.length > 0 ? <div style={{ fontSize: 9, color: subColor, lineHeight: 1.5, textAlign: align, ...esBase }}>{items.map((t, i) => <div key={i}>{t}</div>)}</div> : <div style={{ fontSize: 9, color: '#ccc' }}>ข้อมูลผู้ผลิต</div>;
            }
            case 'legal': {
                const legalItems = [labelForm.fdaNumber && 'อย. ' + labelForm.fdaNumber, labelForm.lotNumber && 'Lot: ' + labelForm.lotNumber, labelForm.mfgDate && 'MFG: ' + labelForm.mfgDate, labelForm.expDate && 'EXP: ' + labelForm.expDate].filter(Boolean);
                return legalItems.length > 0 ? <div style={{ fontSize: 9, color: subColor, textAlign: align, ...esBase }}>{legalItems.join(' • ')}</div> : <div style={{ fontSize: 9, color: '#ccc' }}>กฎหมาย/วันที่</div>;
            }
            default: return null;
        }
    };

    const renderLabelPreview = () => {
        const isLikelyCm = (labelDimensions.width <= 100 && labelDimensions.height <= 100);
        const containerW = isLikelyCm ? Math.round(labelDimensions.width * PREVIEW_PX_PER_CM) : (labelDimensions.width || 380);
        const containerH = isLikelyCm ? Math.round(labelDimensions.height * PREVIEW_PX_PER_CM) : (labelDimensions.height || 500);
        const safeZonePx = isLikelyCm ? Math.round(0.3 * PREVIEW_PX_PER_CM) : 12;
        const bgLayerStyle = bgMode === 'solid' ? { background: bgColor } : { backgroundImage: `url(${bgImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: bgOpacity };

        return (
            <div
                ref={labelRef}
                className="le-label-canvas"
                onClick={(e) => { if (e.target === e.currentTarget || e.target.dataset.canvas) { setSelectedElem(null); setEditingElem(null); } }}
                style={{
                    width: containerW, height: containerH, position: 'relative', overflow: 'hidden',
                    borderRadius: 4, fontFamily: labelAssets.font,
                    boxShadow: '0 12px 32px rgba(0,0,0,0.12)', background: '#fff',
                    cursor: 'default', userSelect: 'none',
                }}
            >
                <div style={{ position: 'absolute', inset: 0, ...bgLayerStyle }} data-canvas="true" />
                {/* Guide overlay */}
                <div style={{ position: 'absolute', inset: 0, border: '1px dashed rgba(255,0,0,0.2)', pointerEvents: 'none', zIndex: 90 }} />
                <div style={{ position: 'absolute', inset: safeZonePx, border: '1px dashed rgba(0,120,255,0.15)', pointerEvents: 'none', zIndex: 90 }} />
                {/* Inner padding zone — safe area visual */}
                <div style={{ position: 'absolute', inset: safeZonePx + 4, pointerEvents: 'none', zIndex: 0 }} />
                {/* เส้นกึ่งกลางแกน y (แนวตั้ง) — แสดงเมื่อจุดศูนย์กลางวัตถุตรงกับกึ่งกลางพรีวิว */}
                {showCenterGuide && (
                    <div style={{
                        position: 'absolute', top: 0, bottom: 0, left: '50%',
                        width: 0, borderLeft: '1.5px solid var(--le-orange)',
                        transform: 'translateX(-50%)', pointerEvents: 'none', zIndex: 95,
                    }} />
                )}

                {/* Draggable + Resizable elements — เรียงตามลำดับเลเยอร์จริง (เลื่อนขึ้น/ลงแล้วซ้อนทับกันตามนี้) */}
                {getOrderedElements().map((elem, layerIdx) => {
                    const pos = elemPositions[elem.id];
                    if (!pos || !pos.visible) return null;
                    const editCfg = EDITABLE_FIELDS[elem.id];
                    const isEditing = editingElem === elem.id && !!editCfg;
                    const content = renderElemContent(elem.id);
                    if (!content) return null;
                    const isSelected = selectedElem === elem.id;
                    const elemScale = pos.scale || 1;

                    // Canva-style handle styles
                    const handleSize = 8;
                    const handleStyle = (cursor) => ({
                        position: 'absolute', width: handleSize, height: handleSize,
                        background: '#fff', border: '2px solid #2196F3', borderRadius: 2,
                        cursor, zIndex: 60, pointerEvents: 'auto',
                    });
                    const edgeHandleH = { position: 'absolute', width: 20, height: 6, background: '#fff', border: '2px solid #2196F3', borderRadius: 3, zIndex: 60, pointerEvents: 'auto' };
                    const edgeHandleV = { position: 'absolute', width: 6, height: 20, background: '#fff', border: '2px solid #2196F3', borderRadius: 3, zIndex: 60, pointerEvents: 'auto' };

                    return (
                        <div
                            key={elem.id}
                            data-elem-id={elem.id}
                            onMouseDown={(e) => handleDragStart(e, elem.id)}
                            onClick={(e) => { e.stopPropagation(); setSelectedElem(elem.id); }}
                            onDoubleClick={(e) => {
                                e.stopPropagation();
                                if (editCfg) { setSelectedElem(elem.id); setEditingElem(elem.id); }
                            }}
                            style={{
                                position: 'absolute',
                                left: `${pos.x}%`,
                                top: `${pos.y}%`,
                                // width:max-content → ขนาดกล่องยึดตามเนื้อหาจริง ไม่หดตามพื้นที่ที่เหลือเมื่อเข้าใกล้ขอบ (กันสัดส่วนเพี้ยน)
                                width: 'max-content',
                                maxWidth: `${Math.min(92, 85 / elemScale)}%`,
                                cursor: isEditing ? 'text' : 'move',
                                zIndex: isSelected ? 1000 : 10 + layerIdx,
                                outline: isSelected ? '2px solid #2196F3' : 'none',
                                outlineOffset: 2,
                                borderRadius: 2,
                                transform: `scale(${elemScale})`,
                                transformOrigin: 'top left',
                            }}
                            title={editCfg ? `${elem.label} — ลากเพื่อย้าย / ดับเบิลคลิกเพื่อพิมพ์แก้ไข / ลากมุมเพื่อปรับขนาด` : `${elem.label} — ลากเพื่อย้าย / ลากมุมเพื่อปรับขนาด`}
                        >
                            {content}
                            {isSelected && (
                                <>
                                    {/* Label badge */}
                                    <div style={{
                                        position: 'absolute', top: -20 / elemScale, left: 0,
                                        pointerEvents: 'none', whiteSpace: 'nowrap',
                                    }}>
                                        <span style={{
                                            background: '#2196F3', color: '#fff', fontSize: 9,
                                            padding: '2px 8px', borderRadius: '4px 4px 0 0',
                                            fontWeight: 600, letterSpacing: 0.3,
                                        }}>
                                            {elem.label} {Math.round(elemScale * 100)}%
                                        </span>
                                    </div>

                                    {/* Corner handles — Canva style */}
                                    <div onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, elem.id, 'nw'); }}
                                        style={{ ...handleStyle('nwse-resize'), top: -handleSize / 2, left: -handleSize / 2 }} />
                                    <div onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, elem.id, 'ne'); }}
                                        style={{ ...handleStyle('nesw-resize'), top: -handleSize / 2, right: -handleSize / 2 }} />
                                    <div onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, elem.id, 'sw'); }}
                                        style={{ ...handleStyle('nesw-resize'), bottom: -handleSize / 2, left: -handleSize / 2 }} />
                                    <div onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, elem.id, 'se'); }}
                                        style={{ ...handleStyle('nwse-resize'), bottom: -handleSize / 2, right: -handleSize / 2 }} />

                                    {/* Edge handles — mid-points */}
                                    <div onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, elem.id, 'n'); }}
                                        style={{ ...edgeHandleH, top: -3, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' }} />
                                    <div onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, elem.id, 's'); }}
                                        style={{ ...edgeHandleH, bottom: -3, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' }} />
                                    <div onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, elem.id, 'w'); }}
                                        style={{ ...edgeHandleV, left: -3, top: '50%', transform: 'translateY(-50%)', cursor: 'ew-resize' }} />
                                    <div onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, elem.id, 'e'); }}
                                        style={{ ...edgeHandleV, right: -3, top: '50%', transform: 'translateY(-50%)', cursor: 'ew-resize' }} />
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    // ============= RENDER: RIGHT TEXT EDITOR PANEL =============
    const renderTextEditorPanel = () => {
        const GOOGLE_FONT_OPTIONS = [
            'Bai Jamjuree', 'Prompt', 'Sarabun', 'Kanit', 'Mitr', 'Charm', 'Itim', 'Mali', 'Sriracha',
            'Noto Serif Thai', 'Thasadith',
        ];
        const LOCAL_FONT_OPTIONS = LABEL_LOCAL_FONTS.map(f => f.name);
        const curElemLabel = LABEL_ELEMENTS.find(e => e.id === selectedElem)?.label || '';
        const curScale = selectedElem ? (elemPositions[selectedElem]?.scale || 1) : 1;
        const pct = Math.round(curScale * 100);

        // เลเยอร์ที่มองเห็น
        const visibleElems = getAllBaseElements().filter(e => elemPositions[e.id]?.visible);
        const hiddenElems = getAllBaseElements().filter(e => !elemPositions[e.id]?.visible);

        return (
            <div style={{
                width: 280, flexShrink: 0,
                maxHeight: 'calc(100vh - 180px)', overflowY: 'auto',
                background: 'var(--le-bg-card)', borderRadius: 14,
                boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
                scrollbarWidth: 'none', msOverflowStyle: 'none',
            }}>
                {/* Panel Selector — ด้านหน้า/ด้านหลัง */}
                {labelPanels.length > 0 && (
                    <div style={{
                        padding: '16px 16px 14px',
                        borderBottom: '1px solid var(--le-border)',
                        display: 'flex', justifyContent: 'center',
                    }}>
                        <PanelSelector
                            panels={labelPanels}
                            selectedPanel={selectedPanel}
                            onSelectPanel={handleSelectPanel}
                            materialData={materialData}
                        />
                    </div>
                )}

                {/* Header */}
                <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--le-border)' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--le-text)' }}>ปรับแต่งข้อความ</div>
                </div>

                <div style={{ padding: '12px 16px' }}>
                    {/* ฟอนต์ */}
                    <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, color: 'var(--le-text-faint)', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>ฟอนต์</div>
                        <select
                            value={labelAssets.font.replace(/'/g, '').split(',')[0].trim()}
                            onChange={e => setLabelAssets(prev => ({ ...prev, font: `'${e.target.value}', sans-serif` }))}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--le-border)', fontSize: 13, background: 'var(--le-bg-sidebar)', cursor: 'pointer' }}
                        >
                            <optgroup label="Google Fonts">
                                {GOOGLE_FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                            </optgroup>
                            <optgroup label="ฟอนต์แบรนด์ (Local)">
                                {LOCAL_FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                            </optgroup>
                        </select>
                    </div>

                    {/* ขนาด */}
                    <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, color: 'var(--le-text-faint)', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                            ขนาด{selectedElem ? ` — ${LABEL_ELEMENTS.find(e => e.id === selectedElem)?.label || ''}` : ''}
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input
                                type="number" min="30" max="400" step="5"
                                value={pct}
                                onChange={e => {
                                    if (!selectedElem) return;
                                    const v = Math.max(30, Math.min(400, parseInt(e.target.value) || 100));
                                    setElemPositions(prev => ({ ...prev, [selectedElem]: { ...prev[selectedElem], scale: v / 100 } }));
                                }}
                                style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--le-border)', fontSize: 15, fontWeight: 600, background: 'var(--le-bg-sidebar)', textAlign: 'center' }}
                                placeholder="100"
                            />
                            <span style={{ fontSize: 13, color: 'var(--le-text-sub)', background: 'var(--le-border)', padding: '8px 12px', borderRadius: 8, fontWeight: 600 }}>px</span>
                        </div>
                    </div>

                    {/* Bold / Italic / Underline + Align — แยกเป็น 2 กลุ่ม */}
                    <div style={{ marginBottom: 14 }}>
                        {!selectedElem && <div style={{ fontSize: 11, color: '#bbb', marginBottom: 6 }}>เลือก element บน canvas เพื่อแก้ไข</div>}
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            {/* กลุ่ม Style */}
                            {[
                                { icon: 'mdi:format-bold', label: 'Bold', key: 'bold', toggle: true },
                                { icon: 'mdi:format-italic', label: 'Italic', key: 'italic', toggle: true },
                                { icon: 'mdi:format-underline', label: 'Underline', key: 'underline', toggle: true },
                            ].map((btn, i) => {
                                const curStyle = selectedElem ? (elemStyles[selectedElem] || DEFAULT_ELEM_STYLE) : DEFAULT_ELEM_STYLE;
                                const isActive = !!curStyle[btn.key];
                                return (
                                    <button key={i} title={btn.label}
                                        disabled={!selectedElem}
                                        onClick={() => { if (!selectedElem) return; updateElemStyle(selectedElem, { [btn.key]: !curStyle[btn.key] }); }}
                                        style={{
                                            flex: 1, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            border: isActive ? '1.5px solid #2196F3' : '1px solid var(--le-border)',
                                            borderRadius: 7, background: isActive ? '#e3f2fd' : 'var(--le-bg-sidebar)',
                                            cursor: selectedElem ? 'pointer' : 'default',
                                            fontSize: 16, color: isActive ? '#1976D2' : 'var(--le-text-sub)',
                                            opacity: selectedElem ? 1 : 0.45,
                                        }}>
                                        <iconify-icon icon={btn.icon}></iconify-icon>
                                    </button>
                                );
                            })}
                            <div style={{ width: 1, height: 24, background: 'var(--le-border)', flexShrink: 0 }} />
                            {/* กลุ่ม Align */}
                            {[
                                { icon: 'mdi:format-align-left', label: 'Left', value: 'left' },
                                { icon: 'mdi:format-align-center', label: 'Center', value: 'center' },
                                { icon: 'mdi:format-align-right', label: 'Right', value: 'right' },
                                { icon: 'mdi:format-align-justify', label: 'Justify', value: 'justify' },
                            ].map((btn, i) => {
                                const curStyle = selectedElem ? (elemStyles[selectedElem] || DEFAULT_ELEM_STYLE) : DEFAULT_ELEM_STYLE;
                                const isActive = curStyle.align === btn.value;
                                return (
                                    <button key={i} title={btn.label}
                                        disabled={!selectedElem}
                                        onClick={() => { if (!selectedElem) return; updateElemStyle(selectedElem, { align: btn.value }); }}
                                        style={{
                                            flex: 1, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            border: isActive ? '1.5px solid #2196F3' : '1px solid var(--le-border)',
                                            borderRadius: 7, background: isActive ? '#e3f2fd' : 'var(--le-bg-sidebar)',
                                            cursor: selectedElem ? 'pointer' : 'default',
                                            fontSize: 16, color: isActive ? '#1976D2' : 'var(--le-text-sub)',
                                            opacity: selectedElem ? 1 : 0.45,
                                        }}>
                                        <iconify-icon icon={btn.icon}></iconify-icon>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* สี */}
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 11, color: 'var(--le-text-faint)', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                            สี{selectedElem ? ` — ${LABEL_ELEMENTS.find(e => e.id === selectedElem)?.label || ''}` : ''}
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input type="text"
                                value={selectedElem ? (elemStyles[selectedElem]?.color || '#222222') : sectionColors.productName}
                                onChange={e => {
                                    if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) {
                                        if (selectedElem) updateElemStyle(selectedElem, { color: e.target.value });
                                        else setSectionColors(p => ({ ...p, productName: e.target.value }));
                                    }
                                }}
                                style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--le-border)', fontSize: 13, fontFamily: 'monospace', background: 'var(--le-bg-sidebar)' }} />
                            <input type="color"
                                value={selectedElem ? (elemStyles[selectedElem]?.color || '#222222') : sectionColors.productName}
                                onChange={e => {
                                    if (selectedElem) updateElemStyle(selectedElem, { color: e.target.value });
                                    else setSectionColors(p => ({ ...p, productName: e.target.value }));
                                }}
                                style={{ width: 36, height: 34, border: '1px solid var(--le-border)', borderRadius: 8, cursor: 'pointer', padding: 2, background: 'var(--le-bg-sidebar)', flexShrink: 0 }} />
                        </div>
                    </div>

                    {/* Divider */}
                    <div style={{ borderTop: '1px solid var(--le-border)', marginBottom: 14 }} />

                    {/* เลเยอร์ */}
                    <div style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <div style={{ fontSize: 11, color: 'var(--le-text-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>เลเยอร์</div>
                            {hiddenElems.length > 0 && (
                                <button onClick={() => {
                                    setElemPositions(prev => {
                                        const next = { ...prev };
                                        hiddenElems.forEach(e => { next[e.id] = { ...next[e.id], visible: true }; });
                                        return next;
                                    });
                                }} style={{ fontSize: 11, color: '#d3542b', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                                    แสดงทั้งหมด
                                </button>
                            )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {[...getOrderedElements()].reverse().map((elem, displayIdx, arr) => {
                                const isVisible = elemPositions[elem.id]?.visible;
                                const isActive = selectedElem === elem.id;
                                const isDraggedOver = layerDragOverId === elem.id;
                                const layerIconMap = {
                                    logo: 'mdi:image-outline',
                                    productName: 'mdi:format-text',
                                    tagline: 'mdi:format-text',
                                    netWeight: 'mdi:format-text',
                                    certifications: 'mdi:certificate-outline',
                                    ingredients: 'mdi:format-text',
                                    usage: 'mdi:format-text',
                                    storage: 'mdi:format-text',
                                    warnings: 'mdi:format-text',
                                    codes: 'mdi:qrcode',
                                    manufacturer: 'mdi:format-text',
                                    legal: 'mdi:format-text',
                                };
                                return (
                                    <div key={elem.id}
                                        draggable
                                        onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', elem.id); setLayerDraggingId(elem.id); }}
                                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setLayerDragOverId(elem.id); }}
                                        onDragLeave={() => setLayerDragOverId(prev => prev === elem.id ? null : prev)}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            const draggedId = layerDraggingId || e.dataTransfer.getData('text/plain');
                                            if (draggedId) reorderLayer(draggedId, elem.id);
                                            setLayerDraggingId(null);
                                            setLayerDragOverId(null);
                                        }}
                                        onDragEnd={() => { setLayerDraggingId(null); setLayerDragOverId(null); }}
                                        onClick={() => setSelectedElem(isActive ? null : elem.id)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px',
                                            borderRadius: 8, cursor: 'pointer', transition: 'background 0.1s',
                                            background: isDraggedOver ? '#eef6ff' : isActive ? '#fff8f5' : 'transparent',
                                            border: isDraggedOver ? '1px dashed #2196F3' : isActive ? '1px solid #ffddcc' : '1px solid transparent',
                                            opacity: layerDraggingId === elem.id ? 0.4 : 1,
                                        }}>
                                        {/* Eye toggle */}
                                        <button onClick={(e) => { e.stopPropagation(); toggleElemVisibility(elem.id); }}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: isVisible ? 'var(--le-text-sub)' : '#ccc', fontSize: 14, lineHeight: 1, flexShrink: 0 }}>
                                            <iconify-icon icon={isVisible ? 'mdi:eye-outline' : 'mdi:eye-off-outline'}></iconify-icon>
                                        </button>
                                        {/* Icon */}
                                        <span style={{ fontSize: 13, color: isVisible ? 'var(--le-text-sub)' : '#ccc', display: 'flex', flexShrink: 0 }}>
                                            <iconify-icon icon={layerIconMap[elem.id] || (elem.isCustomImage ? 'mdi:image-outline' : 'mdi:format-text')}></iconify-icon>
                                        </span>
                                        {/* Label */}
                                        <span style={{ flex: 1, fontSize: 13, color: isVisible ? 'var(--le-text)' : '#aaa', fontWeight: isActive ? 600 : 400, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {elem.label}
                                        </span>
                                        {/* ปุ่มเลื่อนขึ้น/ลง */}
                                        <button onClick={(e) => { e.stopPropagation(); moveLayerStep(elem.id, -1); }}
                                            disabled={displayIdx === 0}
                                            title="เลื่อนขึ้น"
                                            style={{ background: 'none', border: 'none', cursor: displayIdx === 0 ? 'default' : 'pointer', padding: 1, display: 'flex', color: displayIdx === 0 ? 'var(--le-border)' : '#aaa', fontSize: 14, lineHeight: 1, flexShrink: 0 }}>
                                            <iconify-icon icon="mdi:chevron-up"></iconify-icon>
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); moveLayerStep(elem.id, 1); }}
                                            disabled={displayIdx === arr.length - 1}
                                            title="เลื่อนลง"
                                            style={{ background: 'none', border: 'none', cursor: displayIdx === arr.length - 1 ? 'default' : 'pointer', padding: 1, display: 'flex', color: displayIdx === arr.length - 1 ? 'var(--le-border)' : '#aaa', fontSize: 14, lineHeight: 1, flexShrink: 0 }}>
                                            <iconify-icon icon="mdi:chevron-down"></iconify-icon>
                                        </button>
                                        {/* ลบรูปภาพที่อัปโหลด (เฉพาะเลเยอร์รูปภาพเอง) */}
                                        {elem.isCustomImage && (
                                            <button onClick={(e) => { e.stopPropagation(); removeCustomImage(elem.id); }}
                                                title="ลบรูปภาพ"
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 1, display: 'flex', color: '#d99', fontSize: 14, lineHeight: 1, flexShrink: 0 }}>
                                                <iconify-icon icon="mdi:trash-can-outline"></iconify-icon>
                                            </button>
                                        )}
                                        {/* Drag handle */}
                                        <span style={{ fontSize: 14, color: '#ccc', cursor: 'grab', display: 'flex', flexShrink: 0 }}>
                                            <iconify-icon icon="mdi:drag-vertical"></iconify-icon>
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Divider */}
                    <div style={{ borderTop: '1px solid var(--le-border)', margin: '10px 0 12px' }} />

                    {/* จัดการเลเยอร์ */}
                    <button
                        onClick={() => setOpenAccordions(p => ({ ...p, settings: true, main: true, manufacturer: true, legal: true, cert: true, qr: true }))}
                        style={{
                            width: '100%', padding: '9px 0', background: '#f5f5f5', border: '1px solid var(--le-border)',
                            borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--le-text-sub)', cursor: 'pointer',
                        }}>
                        จัดการเลเยอร์
                    </button>
                </div>
            </div>
        );
    };

    // ============= RENDER: LEFT FORM PANEL =============
    const renderFormPanel = () => (
        <div className="le-form-panel">
            {/* ปุ่มย้อนกลับ */}
            <div className="le-panel-back">
                <button className="le-panel-back-btn"
                    onClick={() => { if (hasPackaging) handleSaveLabel(true); setSelectedProduct(null); setSelectedPackage(null); }}>
                    <iconify-icon icon="mdi:chevron-left"></iconify-icon>
                    กลับไปเลือกสินค้า
                </button>
            </div>
            {saveStatus && (
                <div className={`le-panel-save-status ${saveStatus.includes('✓') ? 'ok' : 'pending'}`}>
                    {saveStatus}
                </div>
            )}

            {/* ── ส่วนสินค้า ── */}
            <div className="le-section">
                <div className="le-section-body" style={{ borderTop: 'none', paddingTop: 16 }}>
                    <div className="le-section-label">สินค้า</div>
                    <div className="le-product-card">
                        {selectedProduct?.image_product
                            ? <img className="le-product-thumb" src={`${API}/uploads/${selectedProduct.image_product}`} alt="" />
                            : <div className="le-product-thumb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>
                                <iconify-icon icon="mdi:package-variant" style={{ fontSize: 22 }}></iconify-icon>
                              </div>
                        }
                        <div className="le-product-info">
                            <div className="le-product-name">{selectedProduct?.name_product}</div>
                            {selectedProduct?.type_product && (
                                <div style={{ fontSize: 'var(--le-fs-xs)', color: 'var(--le-text-sub)', marginTop: 2 }}>
                                    {selectedProduct.type_product}
                                </div>
                            )}
                        </div>
                        <button className="le-btn-ghost" style={{ padding: '7px 14px', fontSize: 'var(--le-fs-xs)', flexShrink: 0 }}
                            onClick={() => { if (hasPackaging) handleSaveLabel(true); setSelectedProduct(null); setSelectedPackage(null); }}>
                            เปลี่ยนสินค้า
                        </button>
                    </div>
                </div>
            </div>

            {/* ── ส่วน Packaging ── */}
            <div className="le-section">
                <div className="le-section-body" style={{ borderTop: 'none', paddingTop: 16 }}>
                    <div className="le-section-label">บรรจุภัณฑ์</div>
                    {selectedPackage ? (
                        <div className="le-pkg-row">
                            <div className="le-pkg-thumb">
                                {selectedPackage.thumbnail
                                    ? <img src={selectedPackage.thumbnail} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="" />
                                    : <iconify-icon icon="mdi:package-variant-closed" style={{ fontSize: 26, color: '#ccc' }}></iconify-icon>
                                }
                            </div>
                            <div className="le-pkg-info">
                                <div className="le-pkg-name">{selectedPackage.name}</div>
                                <div className="le-pkg-type">{selectedPackage.type || 'บรรจุภัณฑ์'}</div>
                            </div>
                            <button className="le-pkg-change-btn" onClick={() => setShowPkgModal(true)}>
                                เปลี่ยน
                            </button>
                        </div>
                    ) : (
                        <button className="le-pkg-empty-btn" onClick={() => setShowPkgModal(true)}>
                            <iconify-icon icon="mdi:package-variant-closed"></iconify-icon>
                            <span>เลือกบรรจุภัณฑ์...</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Modal เลือก Packaging */}
            {showPkgModal && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        onClick={() => setShowPkgModal(false)}>
                        <div style={{ background: 'var(--le-bg-card)', borderRadius: 14, width: 420, maxHeight: '75vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
                            onClick={e => e.stopPropagation()}>
                            {/* Header */}
                            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--le-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>เลือกบรรจุภัณฑ์</div>
                                <button onClick={() => setShowPkgModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#aaa', lineHeight: 1 }}>×</button>
                            </div>
                            {/* Package list */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: 12, scrollbarWidth: 'none' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {PACKAGES.map(pkg => {
                                        const isSelected = selectedPackage?.id === pkg.id;
                                        return (
                                            <div key={pkg.id} onClick={() => { handleSelectPackaging(pkg); setShowPkgModal(false); }}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                                                    border: isSelected ? '2px solid #E56F2D' : '1.5px solid #e4e4e7',
                                                    borderRadius: 10, cursor: 'pointer',
                                                    background: isSelected ? '#fff4ee' : 'var(--le-bg-sidebar)',
                                                    transition: 'all 0.15s',
                                                }}>
                                                <div style={{ width: 48, height: 48, background: '#fff', borderRadius: 8, border: '1px solid var(--le-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    {pkg.thumbnail
                                                        ? <img src={pkg.thumbnail} alt={pkg.name} style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 6 }} />
                                                        : <iconify-icon icon="mdi:package-variant-closed" style={{ fontSize: 24, color: '#ccc' }}></iconify-icon>
                                                    }
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: 14, fontWeight: 600, color: isSelected ? '#E56F2D' : '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pkg.name}</div>
                                                    <div style={{ fontSize: 12, color: '#a1a1aa', marginTop: 2 }}>{pkg.type || ''}</div>
                                                </div>
                                                {isSelected && <iconify-icon icon="mdi:check-circle" style={{ color: '#E56F2D', fontSize: 20, flexShrink: 0 }}></iconify-icon>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
            )}

            {/* ── โหมดฉลาก ── */}
            <div className="le-section">
                <div className="le-section-body" style={{ borderTop: 'none', paddingTop: 16 }}>
                    <div className="le-section-label">โหมดฉลาก</div>
                    <div className="le-mode-grid">
                        {[
                            { id: 'sticker', label: 'สติ๊กเกอร์', sub: 'ฉลากติดสินค้า' },
                            { id: 'fullwrap', label: 'เต็มพื้นที่', sub: 'ฉลากแบบเต็มถุง' },
                        ].map(m => {
                            const isActive = labelMode === m.id;
                            return (
                                <button key={m.id} onClick={() => handleModeToggle(m.id)} className={`le-mode-btn${isActive ? ' active' : ''}`}>
                                    <div className="le-mode-btn-label">{m.label}</div>
                                    <div className="le-mode-btn-sub">{m.sub}</div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── รูปแบบฉลาก ── */}
            <div className="le-section">
                <div className="le-section-body" style={{ borderTop: 'none', paddingTop: 16 }}>
                    <div className="le-section-label">รูปแบบฉลาก</div>
                    <div className="le-layout-grid">
                        {TEMPLATE_TYPES.map(t => {
                            const isActive = layoutType === t.id;
                            return (
                                <button key={t.id} onClick={() => applyLayoutPreset(t.id)} className={`le-layout-btn${isActive ? ' active' : ''}`}>
                                    <LayoutThumbnail type={t.id} />
                                    <div className="le-layout-btn-label">{t.name}</div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── องค์ประกอบ ── */}
            <div className="le-section">
                <button className="le-section-header" onClick={() => toggleAccordion('elements')}>
                    <span className="le-section-header-left">
                        <iconify-icon icon="mdi:layers-outline"></iconify-icon>
                        องค์ประกอบ
                    </span>
                    <iconify-icon icon={openAccordions.elements ? 'mdi:chevron-up' : 'mdi:chevron-down'}></iconify-icon>
                </button>
                {openAccordions.elements && (
                    <div className="le-section-body">
                        <div className="le-elem-chips">
                            {[
                                { label: 'โลโก้', elemId: 'logo' },
                                { label: 'ชื่อสินค้า', elemId: 'productName' },
                                { label: 'รายละเอียด', elemId: 'ingredients' },
                                { label: 'ภาพสินค้า', elemId: 'certifications' },
                                { label: 'ไอคอน', elemId: 'certifications' },
                                { label: 'ฉลากรับรอง', elemId: 'certifications' },
                                { label: 'QR Code', toggleField: 'showQR' },
                                { label: 'บาร์โค้ด', toggleField: 'showBarcode' },
                            ].map(({ label, elemId, toggleField }) => {
                                const isOn = toggleField ? labelForm[toggleField] : elemPositions[elemId]?.visible;
                                return (
                                    <button key={label}
                                        onClick={() => {
                                            if (toggleField) setField(toggleField, !labelForm[toggleField]);
                                            else if (elemId) toggleElemVisibility(elemId);
                                        }}
                                        className={`le-elem-chip${isOn ? ' on' : ''}`}>
                                        {label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* อัปโหลดรูปภาพจากเครื่อง → เพิ่มเป็นเลเยอร์ */}
                        <label className="le-pkg-empty-btn" style={{ marginTop: 10 }}>
                            <iconify-icon icon="mdi:image-plus"></iconify-icon>
                            <span>อัปโหลดรูปภาพ</span>
                            <input type="file" accept="image/*" onChange={handleUploadCustomImage} style={{ display: 'none' }} />
                        </label>

                        {/* รายการรูปที่อัปโหลด */}
                        {customImages.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                                {customImages.map(im => (
                                    <div key={im.id} onClick={() => setSelectedElem(im.id)}
                                        style={{ position: 'relative', width: 54, height: 54, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', border: selectedElem === im.id ? '2px solid var(--le-orange)' : '1px solid var(--le-border)', background: 'var(--le-bg-sidebar)' }}>
                                        <img src={im.url} alt={im.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        <button onClick={(e) => { e.stopPropagation(); removeCustomImage(im.id); }}
                                            title="ลบรูปภาพ"
                                            style={{ position: 'absolute', top: 1, right: 1, width: 16, height: 16, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Accordion sections ด้านล่าง (ซ่อนได้) */}
            <div className="le-accordions">
                {/* ตั้งค่าขนาด & สี */}
                <AccordionSection title="ตั้งค่าขนาด & สี" open={openAccordions.settings} onToggle={() => toggleAccordion('settings')}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 15 }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 17, fontWeight: 'bold' }}>กว้าง (ซม.)</label>
                        <input type="number" step="0.1" value={labelDimensions.width}
                            onChange={e => setLabelDimensions({ ...labelDimensions, width: parseFloat(e.target.value) || 1 })}
                            style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid var(--le-border)', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 17, fontWeight: 'bold' }}>สูง (ซม.)</label>
                        <input type="number" step="0.1" value={labelDimensions.height}
                            onChange={e => setLabelDimensions({ ...labelDimensions, height: parseFloat(e.target.value) || 1 })}
                            style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid var(--le-border)', boxSizing: 'border-box' }} />
                    </div>
                </div>

            </AccordionSection>

            {/* พื้นหลังฉลาก */}
            <AccordionSection title="พื้นหลังฉลาก" open={openAccordions.bg} onToggle={() => toggleAccordion('bg')}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                    <BgModeBtn label="สีพื้น" active={bgMode === 'solid'} onClick={() => { setBgMode('solid'); setBgImageUrl(''); setBgPresetId(null); }} />
                    <BgModeBtn label="Preset" active={bgMode === 'preset'} onClick={() => setBgMode('preset')} />
                    <BgModeBtn label="AI" active={bgMode === 'dalle'} onClick={() => setBgMode('dalle')} />
                </div>
                {/* สีพื้น — สีแบรนด์ + hex ไว้แถวเดียว โชว์เฉพาะตอนอยู่โหมด "สีพื้น" */}
                {bgMode === 'solid' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                        {labelAssets.colors.map((color, i) => (
                            <button key={i} onClick={() => setBgColor(color)}
                                style={{
                                    width: 28, height: 28, borderRadius: '50%', background: color,
                                    border: bgColor === color ? '3px solid #555' : '2px solid #e0e0e0',
                                    cursor: 'pointer', padding: 0, flexShrink: 0,
                                    boxShadow: bgColor === color ? '0 0 0 2px #fff inset' : 'none',
                                }} />
                        ))}
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                            <input
                                type="color"
                                id="brandColorPicker"
                                defaultValue="#FF8A00"
                                onBlur={e => {
                                    const picked = e.target.value;
                                    setLabelAssets(prev => ({
                                        ...prev,
                                        colors: [...prev.colors, picked],
                                    }));
                                    setBgColor(picked);
                                }}
                                style={{ position: 'absolute', opacity: 0, width: 28, height: 28, cursor: 'pointer', top: 0, left: 0 }}
                            />
                            <button
                                onClick={() => document.getElementById('brandColorPicker').click()}
                                style={{
                                    width: 28, height: 28, borderRadius: '50%', background: '#fff',
                                    border: '1.5px dashed #ccc', cursor: 'pointer', fontSize: 17, color: '#bbb',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    pointerEvents: 'none',
                                }}>+</button>
                        </div>
                        <div style={{ width: 1, height: 24, background: '#e0e0e0', margin: '0 2px', flexShrink: 0 }} />
                        <input type="text" value={bgColor} onChange={e => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) setBgColor(e.target.value); }} style={{ flex: 1, minWidth: 90, padding: '8px 10px', borderRadius: 6, border: '1px solid var(--le-border)', fontSize: 17, fontFamily: 'monospace' }} />
                    </div>
                )}
                <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--le-text-sub)', display: 'block', marginBottom: 6 }}>อัปโหลดรูปภาพเอง</label>
                    <label htmlFor="bg-upload-input" style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                        border: '1.5px dashed #d1d1d1', borderRadius: 8, cursor: 'pointer',
                        background: 'var(--le-bg-sidebar)', color: 'var(--le-text-sub)', fontSize: 13, fontWeight: 500,
                        transition: 'border-color 0.15s',
                    }}>
                        <iconify-icon icon="mdi:image-plus-outline" style={{ fontSize: 18, color: '#aaa' }}></iconify-icon>
                        <span>เลือกไฟล์รูปภาพ...</span>
                    </label>
                    <input id="bg-upload-input" type="file" accept="image/*" onChange={handleUploadCustomBg}
                        style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }} />
                </div>
                {bgMode === 'preset' && (
                    <div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                            {bgPresets.map(p => (
                                <button key={p.bg_preset_id} onClick={() => handleSelectPreset(p)} style={{ padding: 0, border: bgPresetId === p.bg_preset_id ? '3px solid #8a9a3c' : '1px solid var(--le-border)', borderRadius: 6, overflow: 'hidden', cursor: 'pointer', aspectRatio: '1/1', background: '#eee' }} title={p.name}>
                                    <img src={p.thumbnail_url || p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </button>
                            ))}
                        </div>
                        {bgPresets.length === 0 && <div style={{ fontSize: 15, color: '#999' }}>ยังไม่มี preset</div>}
                    </div>
                )}
                {bgMode === 'dalle' && (
                    <div>
                        <div style={{ marginBottom: 8 }}><label style={{ fontSize: 15, fontWeight: 'bold' }}>สไตล์ลาย</label><select value={dalleStyle} onChange={e => setDalleStyle(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--le-border)' }}>{BG_STYLES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                            <div><label style={{ fontSize: 15, fontWeight: 'bold' }}>โทน</label><select value={dalleTone} onChange={e => setDalleTone(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--le-border)' }}><option value="auto">Auto</option><option value="bright">สว่าง</option><option value="dark">เข้ม</option><option value="pastel">Pastel</option></select></div>
                            <div><label style={{ fontSize: 15, fontWeight: 'bold' }}>ความหนาแน่น</label><select value={dalleDensity} onChange={e => setDalleDensity(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--le-border)' }}><option value="low">เบาบาง</option><option value="medium">ปานกลาง</option><option value="high">หนาแน่น</option></select></div>
                        </div>
                        <button onClick={handleGenerateBgWithAI} disabled={isGeneratingBg} style={{ width: '100%', padding: 12, background: '#8f1d1d', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer', marginBottom: 6 }}>{isGeneratingBg ? 'กำลังสร้างพื้นหลัง...' : 'Generate Background (AI)'}</button>
                        {bgImageUrl && bgMode === 'dalle' && <img src={bgImageUrl} alt="bg preview" style={{ width: '100%', borderRadius: 6, marginTop: 6 }} />}
                    </div>
                )}
                {(bgMode === 'preset' || bgMode === 'dalle') && bgImageUrl && (
                    <div style={{ marginTop: 12 }}>
                        <label style={{ fontSize: 15, fontWeight: 'bold' }}>ความเข้มรูปภาพ: {Math.round(bgOpacity * 100)}%</label>
                        <input type="range" min="0.2" max="1" step="0.05" value={bgOpacity} onChange={e => setBgOpacity(parseFloat(e.target.value))} style={{ width: '100%' }} />
                    </div>
                )}
                {/* แกลเลอรีพื้นหลังที่เคยสร้าง/อัปโหลด */}
                {bgHistory.length > 0 && (
                    <div style={{ marginTop: 14, borderTop: '1px solid var(--le-border)', paddingTop: 10 }}>
                        <label style={{ fontSize: 15, fontWeight: 'bold', display: 'block', marginBottom: 6 }}>
                            ประวัติพื้นหลัง ({bgHistory.length} รูป)
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                            {bgHistory.map((item) => {
                                const url = item.image_url?.startsWith('http') ? item.image_url : `${API}${item.image_url}`;
                                const isUpload = item.generation_type === 'LABEL_BG_UPLOAD';
                                const isActive = bgImageUrl === url;
                                return (
                                    <button key={item.history_id}
                                        onClick={() => {
                                            setBgImageUrl(url);
                                            // อัปโหลดเอง -> ยังถือเป็นโหมด preset (รูปคงที่ ไม่ผ่าน AI)
                                            // สร้างจาก AI -> ต้องกลับไปโหมด AI เพื่อให้แท็บ/ตัวเลือกสไตล์ตรงกับรูปจริง
                                            setBgMode(isUpload ? 'preset' : 'dalle');
                                            setBgPresetId(null);
                                        }}
                                        title={isUpload ? 'รูปอัปโหลด' : 'สร้างโดย AI'}
                                        style={{
                                            padding: 0, border: isActive ? '3px solid #d3542b' : '1px solid var(--le-border)',
                                            borderRadius: 6, overflow: 'hidden', cursor: 'pointer',
                                            aspectRatio: '1/1', background: '#eee', position: 'relative',
                                        }}>
                                        <img src={url} alt={isUpload ? 'รูปอัปโหลด' : 'พื้นหลังจาก AI'}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                            onError={(e) => {
                                                e.target.onerror = null;
                                                e.target.style.display = 'none';
                                                const fallback = e.target.nextElementSibling;
                                                if (fallback) fallback.style.display = 'flex';
                                            }} />
                                        <div style={{
                                            display: 'none', width: '100%', height: '100%',
                                            alignItems: 'center', justifyContent: 'center',
                                            fontSize: 17, color: '#bbb', background: 'var(--le-border)',
                                        }}>
                                            <iconify-icon icon="mdi:image-broken-variant"></iconify-icon>
                                        </div>
                                        <span style={{
                                            position: 'absolute', bottom: 2, right: 2,
                                            fontSize: 7, background: 'rgba(0,0,0,0.5)', color: '#fff',
                                            padding: '1px 3px', borderRadius: 3,
                                        }}>
                                            {isUpload ? 'UP' : 'AI'}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </AccordionSection>

            {/* ข้อมูลหลัก */}
            <AccordionSection title="ข้อมูลหลัก" open={openAccordions.main} onToggle={() => toggleAccordion('main')}>
                <FormInput label="ชื่อสินค้า *" value={labelForm.productName} onChange={v => setField('productName', v)} />
                <FormInput label="คำโปรย / Tagline" value={labelForm.tagline} onChange={v => setField('tagline', v)} />
                <FormInput label="ปริมาณสุทธิ (เช่น 100 g, 250 ml)" value={labelForm.netWeight} onChange={v => setField('netWeight', v)} />
                <button onClick={handleAIWriteCopy} disabled={isLabelAILoading} style={{
                    width: '100%', padding: '10px 12px', background: isLabelAILoading ? '#e8956a' : '#d3542b',
                    color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13,
                    cursor: isLabelAILoading ? 'default' : 'pointer', marginTop: 4,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                    <iconify-icon icon={isLabelAILoading ? 'mdi:loading' : 'mdi:auto-fix'} style={{ fontSize: 15 }}></iconify-icon>
                    {isLabelAILoading ? 'Gemini กำลังคิด...' : 'ให้ AI ช่วยร่างคำโปรย+ส่วนประกอบ'}
                </button>
            </AccordionSection>

            {/* ข้อมูลผลิตภัณฑ์ */}
            <AccordionSection title="ข้อมูลผลิตภัณฑ์ (แบบแท็ก)" open={openAccordions.product} onToggle={() => toggleAccordion('product')}>
                <FormTextarea label="ส่วนประกอบ / Ingredients" value={labelForm.ingredients} onChange={v => setField('ingredients', v)} rows={3} />
                <TagSelector label="วิธีใช้ / รับประทาน" options={USAGE_OPTIONS} selectedTags={labelForm.usageTags} onTagToggle={(opt) => handleTagToggle('usageTags', opt)} showCustom={labelForm.showUsageCustom} onToggleCustom={() => setField('showUsageCustom', !labelForm.showUsageCustom)} customText={labelForm.usageCustom} onCustomChange={v => setField('usageCustom', v)} />
                <TagSelector label="วิธีเก็บรักษา" options={STORAGE_OPTIONS} selectedTags={labelForm.storageTags} onTagToggle={(opt) => handleTagToggle('storageTags', opt)} showCustom={labelForm.showStorageCustom} onToggleCustom={() => setField('showStorageCustom', !labelForm.showStorageCustom)} customText={labelForm.storageCustom} onCustomChange={v => setField('storageCustom', v)} />
                <TagSelector label="คำเตือน" options={WARNING_OPTIONS} selectedTags={labelForm.warningTags} onTagToggle={(opt) => handleTagToggle('warningTags', opt)} showCustom={labelForm.showWarningCustom} onToggleCustom={() => setField('showWarningCustom', !labelForm.showWarningCustom)} customText={labelForm.warningCustom} onCustomChange={v => setField('warningCustom', v)} />
            </AccordionSection>

            {/* ข้อมูลผู้ผลิต */}
            <AccordionSection title="ข้อมูลผู้ผลิต" open={openAccordions.manufacturer} onToggle={() => toggleAccordion('manufacturer')}>
                <FormInput label="ชื่อผู้ผลิต" value={labelForm.manufacturerName} onChange={v => setField('manufacturerName', v)} />
                <FormTextarea label="ที่อยู่" value={labelForm.manufacturerAddress} onChange={v => setField('manufacturerAddress', v)} rows={2} />
                <FormInput label="โทรศัพท์" value={labelForm.manufacturerPhone} onChange={v => setField('manufacturerPhone', v)} />
                <FormInput label="Line ID" value={labelForm.manufacturerLine} onChange={v => setField('manufacturerLine', v)} />
                <FormInput label="Facebook" value={labelForm.manufacturerFacebook} onChange={v => setField('manufacturerFacebook', v)} />
                <FormInput label="Website" value={labelForm.manufacturerWebsite} onChange={v => setField('manufacturerWebsite', v)} />
            </AccordionSection>

            {/* กฎหมาย & วันที่ */}
            <AccordionSection title="กฎหมาย & วันที่" open={openAccordions.legal} onToggle={() => toggleAccordion('legal')}>
                <FormInput label="เลข อย. / มอก. / เลขจดแจ้ง" value={labelForm.fdaNumber} onChange={v => setField('fdaNumber', v)} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <FormInput label="วันผลิต (MFG)" type="date" value={labelForm.mfgDate} onChange={v => setField('mfgDate', v)} />
                    <FormInput label="วันหมดอายุ (EXP)" type="date" value={labelForm.expDate} onChange={v => setField('expDate', v)} />
                </div>
                <FormInput label="Lot Number" value={labelForm.lotNumber} onChange={v => setField('lotNumber', v)} />
            </AccordionSection>

            {/* ตราสัญลักษณ์รับรอง — ขั้นที่ 1 เลือกประเภท / ขั้นที่ 2 เลือกแบบลาย */}
            <AccordionSection title="ตราสัญลักษณ์รับรอง" open={openAccordions.cert} onToggle={() => toggleAccordion('cert')}>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
                    เลือกประเภทตรา แล้วเลือกแบบลายที่ต้องการ — ตราจะไปปรากฏในพรีวิวให้จัดวางต่อ
                </div>
                {/* ขั้นที่ 1: ประเภทตรา (ใช้ภาพแรกของแต่ละโฟลเดอร์เป็นไอคอนปุ่ม) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {CERT_CATEGORIES.map(cat => {
                        const selected = isCertSelected(cat.id);
                        const isActive = activeCertCat === cat.id;
                        const thumb = getCertVariantUrl(cat.id) || cat.variants[0]?.url;
                        return (
                            <button key={cat.id}
                                onClick={() => setActiveCertCat(prev => prev === cat.id ? null : cat.id)}
                                title={cat.label}
                                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', gap: 4, padding: '8px 4px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', border: selected ? '2px solid #FF8A00' : isActive ? '2px solid #FFD699' : '1.5px solid #e8e8e8', background: selected ? '#FFF4E6' : isActive ? '#FFFaf3' : 'var(--le-bg-sidebar)', position: 'relative', transition: 'all 0.15s' }}>
                                {selected && (
                                    <span style={{ position: 'absolute', top: 3, right: 3, width: 14, height: 14, borderRadius: '50%', background: '#FF8A00', color: '#fff', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>✓</span>
                                )}
                                <img src={thumb} alt={cat.label} style={{ width: 36, height: 36, objectFit: 'contain' }} />
                                <span style={{ fontSize: 11, color: selected ? '#FF8A00' : 'var(--le-text-sub)', fontWeight: selected ? 600 : 400, textAlign: 'center', lineHeight: 1.15, wordBreak: 'break-word' }}>{cat.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* ขั้นที่ 2: เลือกแบบลายของประเภทที่กดเลือก */}
                {activeCertCat && (() => {
                    const cat = CERT_CATEGORIES.find(c => c.id === activeCertCat);
                    if (!cat) return null;
                    const selectedUrl = getCertVariantUrl(cat.id);
                    return (
                        <div style={{ marginTop: 12, padding: 10, background: '#FFF8F0', border: '1px solid #FFE0C2', borderRadius: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#C8441A' }}>เลือกแบบลาย — {cat.label}</span>
                                {isCertSelected(cat.id) && (
                                    <button onClick={() => removeCert(cat.id)} style={{ fontSize: 11, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 2 }}>
                                        <iconify-icon icon="mdi:trash-can-outline"></iconify-icon> เอาออก
                                    </button>
                                )}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                                {cat.variants.map(v => {
                                    const isChosen = selectedUrl === v.url;
                                    return (
                                        <button key={v.file} onClick={() => selectCertVariant(cat.id, v.url)}
                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6, borderRadius: 8, cursor: 'pointer', background: '#fff', border: isChosen ? '2px solid #FF8A00' : '1.5px solid #e8e8e8', position: 'relative', transition: 'all 0.15s' }}>
                                            {isChosen && (
                                                <span style={{ position: 'absolute', top: 2, right: 2, width: 13, height: 13, borderRadius: '50%', background: '#FF8A00', color: '#fff', fontSize: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>✓</span>
                                            )}
                                            <img src={v.url} alt={`${cat.label} ${v.file}`} style={{ width: 44, height: 44, objectFit: 'contain' }} />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })()}
            </AccordionSection>

            {/* QR Code & Barcode */}
            <AccordionSection title="QR Code & Barcode" open={openAccordions.qr} onToggle={() => toggleAccordion('qr')}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <input type="checkbox" checked={labelForm.showQR} onChange={e => setField('showQR', e.target.checked)} /> แสดง QR Code บนฉลาก
                </label>
                {labelForm.showQR && <FormInput label="ค่าที่จะใส่ใน QR (URL / Line ID)" value={labelForm.qrValue} onChange={v => setField('qrValue', v)} />}
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 6 }}>
                    <input type="checkbox" checked={labelForm.showBarcode} onChange={e => setField('showBarcode', e.target.checked)} /> แสดง Barcode บนฉลาก
                </label>
                {labelForm.showBarcode && <FormInput label="ตัวเลข Barcode (เช่น EAN-13)" value={labelForm.barcodeValue} onChange={v => setField('barcodeValue', v)} />}
            </AccordionSection>
            </div>{/* end accordion wrapper */}

            {/* ปุ่มบันทึก + Export */}
            <div style={{ margin: '4px 14px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>

                {/* Save */}
                <button onClick={() => handleSaveLabel()} disabled={isSavingLabel}
                    style={{
                        width: '100%', padding: '11px 12px', background: isSavingLabel ? '#a8b86c' : '#8a9a3c',
                        color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13,
                        cursor: isSavingLabel ? 'default' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    }}>
                    <iconify-icon icon={isSavingLabel ? 'mdi:loading' : 'mdi:content-save-outline'} style={{ fontSize: 16 }}></iconify-icon>
                    {isSavingLabel ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>

                {/* PNG Download — hero card */}
                <button onClick={handleDownloadLabel}
                    style={{
                        width: '100%', padding: '12px 14px', marginTop: 6,
                        background: 'var(--le-orange)',
                        color: '#fff', border: 'none', borderRadius: 12,
                        cursor: 'pointer', boxShadow: '0 4px 14px rgba(255,138,0,0.35)',
                        display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                    }}>
                    <div style={{
                        width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.22)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                        <iconify-icon icon="mdi:download" style={{ fontSize: 19 }}></iconify-icon>
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>ดาวน์โหลด PNG</div>
                        <div style={{ fontSize: 11.5, opacity: 0.9, marginTop: 1 }}>ไฟล์ภาพความละเอียดสูง</div>
                    </div>
                </button>

                {/* Divider + PRO label */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '10px 0 2px' }}>
                    <iconify-icon icon="mdi:certificate-outline" style={{ fontSize: 14, color: 'var(--le-text-faint)' }}></iconify-icon>
                    <span style={{ fontSize: 11.5, color: 'var(--le-text-faint)', fontWeight: 600 }}>สำหรับงานพิมพ์ (PRO)</span>
                </div>

                {/* PDF + Illustrator — 2 cols */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {/* PDF */}
                    <button onClick={() => { if (!isProUser(getUserFromStorage())) { setShowProModal(true); return; } handleExportLabelPDF(); }}
                        style={{
                            position: 'relative',
                            padding: '12px 8px', borderRadius: 10, fontWeight: 600, fontSize: 12.5,
                            cursor: 'pointer', border: '1px solid var(--le-border)',
                            background: 'var(--le-bg-muted)', color: 'var(--le-text-sub)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}>
                        <iconify-icon icon="mdi:file-pdf-box" style={{ fontSize: 17 }}></iconify-icon>
                        <span>PDF</span>
                        {!isProUser(getUserFromStorage()) && (
                            <iconify-icon icon="mdi:lock-outline"
                                style={{ position: 'absolute', top: 6, right: 7, fontSize: 12, color: 'var(--le-text-faint)' }}></iconify-icon>
                        )}
                    </button>

                    {/* Illustrator */}
                    <button onClick={() => { if (!isProUser(getUserFromStorage())) { setShowProModal(true); return; } handleExportIllustratorAI(); }}
                        style={{
                            position: 'relative',
                            padding: '12px 8px', borderRadius: 10, fontWeight: 600, fontSize: 12.5,
                            cursor: 'pointer', border: '1px solid var(--le-border)',
                            background: 'var(--le-bg-muted)', color: 'var(--le-text-sub)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}>
                        <iconify-icon icon="mdi:vector-square" style={{ fontSize: 17 }}></iconify-icon>
                        <span>Illustrator</span>
                        {!isProUser(getUserFromStorage()) && (
                            <iconify-icon icon="mdi:lock-outline"
                                style={{ position: 'absolute', top: 6, right: 7, fontSize: 12, color: 'var(--le-text-faint)' }}></iconify-icon>
                        )}
                    </button>
                </div>

                {/* Footnote */}
                <div style={{ textAlign: 'center', fontSize: 10.5, color: 'var(--le-text-faint)', marginTop: 4 }}>
                    CMYK · crop marks · fold lines
                </div>

            </div>
        </div>
    );

    // ============= RENDER: CENTER PANEL (Preview + Template Selector) =============
    const [zoomLevel, setZoomLevel] = useState(125);
    const renderCenterPanel = () => {
        // NOTE: hasPackaging gate removed — Packaging selection is no longer a prerequisite
        // Old gate preserved here for reference (do not restore without design review):
        // if (!hasPackaging) { return <div>เลือก Packaging จากแถบด้านขวาเพื่อเริ่มต้น</div>; }

        const bleedMm = Number(materialData?.bleed_mm || 3);
        const safeZoneMm = Number(materialData?.safe_zone_mm || 3);
        const wMm = selectedPanel?.w_mm || labelDimensions.width * 10;
        const hMm = selectedPanel?.h_mm || labelDimensions.height * 10;

        return (
            <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                background: 'var(--le-bg-app)', borderRadius: 14,
                height: 'calc(100vh - 180px)', maxHeight: 'calc(100vh - 180px)', overflow: 'hidden',
            }}>
                {/* Secondary info bar */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 20,
                    margin: '10px 14px 0', padding: '0 16px', height: 34,
                    background: 'var(--le-bg-card)', border: '1px solid var(--le-border)', borderRadius: 17,
                    flexShrink: 0, fontSize: 12, color: 'var(--le-text-sub)',
                }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ color: '#aaa' }}>ขนาดงาน:</span>
                        <span style={{ color: 'var(--le-text)', fontWeight: 500 }}>กว้าง {wMm} × สูง {hMm} มม.</span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ color: '#aaa' }}>ตัดตก:</span>
                        <span style={{ color: 'var(--le-text)', fontWeight: 500 }}>{bleedMm} มม.</span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ color: '#aaa' }}>Safe Zone:</span>
                        <span style={{ color: 'var(--le-text)', fontWeight: 500 }}>{safeZoneMm} มม.</span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ color: '#aaa' }}>แนว:</span>
                        <span style={{ color: 'var(--le-text)', fontWeight: 500 }}>{wMm > hMm ? 'แนวนอน' : 'แนวตั้ง'}</span>
                    </span>
                </div>

                {/* Canvas area — เต็มความสูงที่เหลือ */}
                <div style={{
                    flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'flex-start', padding: '20px 24px 0',
                    scrollbarWidth: 'none', msOverflowStyle: 'none',
                }}>
                    <div style={{
                        display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
                        transform: `scale(${zoomLevel / 100})`,
                        transformOrigin: 'top center',
                        transition: 'transform 0.2s',
                    }}>
                        {renderLabelPreview()}
                    </div>
                </div>

                {/* Bottom toolbar pill — compact width:fit-content centered */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '8px 0 10px', flexShrink: 0,
                }}>
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 1,
                    padding: '3px 6px',
                    background: 'var(--le-bg-card)', border: '1px solid var(--le-border)', borderRadius: 999,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                    fontFamily: 'var(--le-font)',
                }}>
                    {/* ย้อนกลับ */}
                    <button title="ย้อนกลับ" style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '4px 9px', border: 'none', borderRadius: 7, background: 'none',
                        cursor: 'pointer', color: '#777', fontSize: 12, fontWeight: 500,
                        fontFamily: 'var(--le-font)', transition: 'background 0.13s, color 0.13s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#f4f4f5'; e.currentTarget.style.color = 'var(--le-text)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#777'; }}>
                        <iconify-icon icon="mdi:undo" style={{ fontSize: 13 }}></iconify-icon>
                        <span>ย้อนกลับ</span>
                    </button>

                    {/* ทำซ้ำ */}
                    <button title="ทำซ้ำ" style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '4px 9px', border: 'none', borderRadius: 7, background: 'none',
                        cursor: 'pointer', color: '#777', fontSize: 12, fontWeight: 500,
                        fontFamily: 'var(--le-font)', transition: 'background 0.13s, color 0.13s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#f4f4f5'; e.currentTarget.style.color = 'var(--le-text)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#777'; }}>
                        <iconify-icon icon="mdi:redo" style={{ fontSize: 13 }}></iconify-icon>
                        <span>ทำซ้ำ</span>
                    </button>

                    {/* Divider */}
                    <div style={{ width: 1, height: 16, background: 'var(--le-border)', margin: '0 3px', flexShrink: 0 }} />

                    {/* Zoom out */}
                    <button onClick={() => setZoomLevel(z => Math.max(50, z - 25))} title="ย่อ"
                        style={{
                            width: 26, height: 26, border: 'none', borderRadius: 6, background: 'none',
                            cursor: 'pointer', fontSize: 16, color: 'var(--le-text-sub)', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--le-font)',
                            transition: 'background 0.13s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f4f4f5'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                        −
                    </button>

                    {/* Zoom label */}
                    <span style={{
                        fontSize: 12, fontWeight: 700, color: 'var(--le-text)',
                        minWidth: 38, textAlign: 'center', userSelect: 'none',
                    }}>{zoomLevel}%</span>

                    {/* Zoom in */}
                    <button onClick={() => setZoomLevel(z => Math.min(200, z + 25))} title="ขยาย"
                        style={{
                            width: 26, height: 26, border: 'none', borderRadius: 6, background: 'none',
                            cursor: 'pointer', fontSize: 16, color: 'var(--le-text-sub)', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--le-font)',
                            transition: 'background 0.13s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f4f4f5'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                        +
                    </button>

                    {/* Divider */}
                    <div style={{ width: 1, height: 16, background: 'var(--le-border)', margin: '0 3px', flexShrink: 0 }} />

                    {/* พอดีจอ */}
                    <button onClick={() => setZoomLevel(100)} title="พอดีจอ" style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '4px 9px', border: 'none', borderRadius: 7, background: 'none',
                        cursor: 'pointer', color: '#777', fontSize: 12, fontWeight: 500,
                        fontFamily: 'var(--le-font)', transition: 'background 0.13s, color 0.13s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#f4f4f5'; e.currentTarget.style.color = 'var(--le-text)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#777'; }}>
                        <iconify-icon icon="mdi:fit-to-screen-outline" style={{ fontSize: 13 }}></iconify-icon>
                        <span>พอดีจอ</span>
                    </button>

                    {/* รีเซ็ต */}
                    <button onClick={() => { setZoomLevel(125); setElemPositions({ ...LAYOUT_PRESETS[layoutType] }); }} title="รีเซ็ตตำแหน่ง" style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '4px 9px', border: 'none', borderRadius: 7, background: 'none',
                        cursor: 'pointer', color: 'var(--le-orange)', fontSize: 12, fontWeight: 600,
                        fontFamily: 'var(--le-font)', transition: 'background 0.13s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--le-orange-tint)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                        <iconify-icon icon="mdi:refresh" style={{ fontSize: 13 }}></iconify-icon>
                        <span>รีเซ็ต</span>
                    </button>
                </div>{/* end pill */}
                </div>{/* end toolbar row */}
            </div>
        );
    };

    // ============= MAIN RENDER =============
    return (
        <>
            {!selectedProduct ? (
                <div className="le-product-picker">
                    <h2>เลือกสินค้าเพื่อออกแบบฉลาก</h2>
                    <p>เลือกสินค้าที่ต้องการออกแบบฉลาก หรือเพิ่มสินค้าใหม่</p>
                    <div className="le-product-grid">
                        {products.map(prod => (
                            <div key={prod.product_id} onClick={() => handleSelectProduct(prod)}
                                className="le-product-card-pick">
                                <div style={{ width: '100%', height: 148, background: 'var(--le-bg-muted)', borderRadius: 'var(--le-radius-sm)', marginBottom: 10, overflow: 'hidden' }}>
                                    {prod.image_product ? <img src={`${API}/uploads/${prod.image_product}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--le-text-faint)', fontSize: 13 }}>ไม่มีรูปภาพ</div>}
                                </div>
                                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--le-text)' }}>{prod.name_product}</h3>
                                {prod.package_id && (
                                    <div style={{ marginTop: 7, fontSize: 11, color: 'var(--le-orange)', background: 'var(--le-orange-tint)', padding: '3px 9px', borderRadius: 10, display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid var(--le-orange-border)' }}>
                                        <iconify-icon icon="mdi:package-variant" style={{ fontSize: 13 }}></iconify-icon>
                                        มี Packaging แล้ว
                                    </div>
                                )}
                            </div>
                        ))}
                        <div onClick={() => setIsAddProductOpen(true)} className="le-add-product">
                            <iconify-icon icon="mdi:plus-circle-outline" style={{ fontSize: 38 }}></iconify-icon>
                            <span style={{ fontSize: 14, fontWeight: 600 }}>เพิ่มสินค้าใหม่</span>
                        </div>
                    </div>
                </div>
            ) : (
                /* === 3-COLUMN LAYOUT: ซ้าย=ฟอร์ม | กลาง=Preview | ขวา=TextEditor === */
                /* NOTE: PackagingSidebar (4th column) hidden — Packaging section moved into left form panel (หัวข้อ "สินค้า")
                   All related code (PackagingSidebar component, selectedPackage state, handleSelectPackaging,
                   materialData fetch) is preserved for future reconnection. */
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', fontFamily: labelAssets.font }}>
                    {/* ซ้าย: ฟอร์มออกแบบ */}
                    {renderFormPanel()}

                    {/* กลาง: ตัวอย่างฉลาก + info bar + zoom */}
                    {renderCenterPanel()}

                    {/* ขวา: Text Editor Panel */}
                    {renderTextEditorPanel()}

                    {/* ไกลขวา: PackagingSidebar — ซ่อนชั่วคราว รอย้ายเข้าหัวข้อ "สินค้า" ในฟอร์มซ้าย
                    <PackagingSidebar
                        packages={PACKAGES}
                        selectedPackageId={selectedPackage?.id || null}
                        onSelectPackage={handleSelectPackaging}
                    />
                    */}
                </div>
            )}

            {/* Modal เพิ่มสินค้า */}
            {isAddProductOpen && (
                <div className="le-add-modal-overlay" onClick={() => setIsAddProductOpen(false)}>
                    <form onSubmit={handleAddProduct} className="le-add-modal-box" onClick={e => e.stopPropagation()}>

                        {/* Header */}
                        <div className="le-add-modal-header">
                            <h3 className="le-add-modal-title">เพิ่มสินค้าใหม่</h3>
                            <button type="button" className="le-add-modal-close" onClick={() => setIsAddProductOpen(false)}>
                                <iconify-icon icon="mdi:close"></iconify-icon>
                            </button>
                        </div>

                        {/* ชื่อสินค้า */}
                        <div className="le-add-form-group">
                            <label>
                                <span className="le-add-step">1</span>
                                ชื่อสินค้า <span className="le-add-req">*</span>
                            </label>
                            <input type="text" placeholder="เช่น น้ำผึ้งป่า, โดนัทสายรุ้ง"
                                value={newProduct.name}
                                onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
                                required />
                        </div>

                        {/* ประเภท */}
                        <div className="le-add-form-group">
                            <label>
                                <span className="le-add-step">2</span>
                                ประเภทสินค้า <span className="le-add-req">*</span>
                            </label>
                            <select value={newProduct.type}
                                onChange={e => setNewProduct({ ...newProduct, type: e.target.value })}
                                required>
                                <option value="">— เลือกประเภทสินค้า —</option>
                                <option value="อาหาร / ของกินเล่น">อาหาร / ของกินเล่น</option>
                                <option value="เครื่องดื่ม">เครื่องดื่ม</option>
                            </select>
                        </div>

                        {/* รูปภาพ */}
                        <div className="le-add-form-group">
                            <label>
                                <span className="le-add-step">3</span>
                                รูปภาพสินค้า
                                <span className="le-add-opt">(ไม่บังคับ)</span>
                            </label>
                            <label className="le-add-file-label">
                                <iconify-icon icon="mdi:image-plus-outline"></iconify-icon>
                                {newProduct.file ? newProduct.file.name : 'เลือกไฟล์รูปภาพ...'}
                                <input type="file" accept="image/*"
                                    onChange={e => setNewProduct({ ...newProduct, file: e.target.files[0] })} />
                            </label>
                        </div>

                        {/* Actions */}
                        <div className="le-add-modal-actions">
                            <button type="button" className="le-add-cancel-btn"
                                onClick={() => setIsAddProductOpen(false)}>ยกเลิก</button>
                            <button type="submit" className="le-add-confirm-btn">
                                <iconify-icon icon="mdi:plus"></iconify-icon>
                                เพิ่มสินค้า
                            </button>
                        </div>

                    </form>
                </div>
            )}

            <ProUpgradeModal isOpen={showProModal} onClose={() => setShowProModal(false)} feature="download" />
        </>
    );
}