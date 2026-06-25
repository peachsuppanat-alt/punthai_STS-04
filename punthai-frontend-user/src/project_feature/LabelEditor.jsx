// =====================================================================
// LabelEditor.jsx — ฟีเจอร์ออกแบบฉลากสินค้า (ปรับปรุงใหม่: ต้องเลือก Packaging ก่อน)
// =====================================================================
import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

import { QRCodeSVG } from 'qrcode.react';
import Barcode from 'react-barcode';


import { loadLogoTransparent } from './logoUtils';
import { PACKAGES, CATEGORIES } from './PackageCatalog';
import { getUserFromStorage, isProUser } from '../utils/subscriptionGuard';
import ProUpgradeModal from '../components/ProUpgradeModal';
import { API_URL } from '../config';

const API = `${API_URL}`;

// ============= CONSTANTS =============
const TEMPLATE_TYPES = [
    { id: 'centered_classic', name: 'จัดกลาง', desc: 'โลโก้กลาง ทุกอย่างจัดกึ่งกลาง' },
    { id: 'modern_side', name: 'ชิดซ้าย', desc: 'โลโก้ซ้าย ข้อความชิดซ้าย' },
    { id: 'premium_frame', name: 'พรีเมียม', desc: 'กรอบเส้นบาง สไตล์หรูหรา' },
    { id: 'minimal_strip', name: 'มินิมอล', desc: 'ชื่อใหญ่ แถบข้อมูลด้านล่าง' },
];

const CERT_OPTIONS = [
    { id: 'fda', label: 'อย.' }, { id: 'halal', label: 'ฮาลาล' },
    { id: 'otop', label: 'OTOP' }, { id: 'gmp', label: 'GMP' },
    { id: 'organic', label: 'ออร์แกนิก' }, { id: 'tisi', label: 'มผช./มอก.' },
    { id: 'vegan', label: 'Vegan' }, { id: 'sugar_free', label: 'ปลอดน้ำตาล' },
];

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

// ============= SUB COMPONENTS =============
function AccordionSection({ title, open, onToggle, children, disabled }) {
    return (
        <div style={{ marginBottom: 12, border: '1px solid #eee', borderRadius: 8, overflow: 'hidden', opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
            <button onClick={onToggle} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: open ? '#f5f8eb' : '#fafafa', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
                <span>{title}</span><span>{open ? '▾' : '▸'}</span>
            </button>
            {open && <div style={{ padding: 12 }}>{children}</div>}
        </div>
    );
}

function BgModeBtn({ label, active, onClick }) {
    return (
        <button onClick={onClick} style={{ flex: 1, padding: 8, fontSize: 12, fontWeight: 'bold', cursor: 'pointer', border: active ? '2px solid #8a9a3c' : '1px solid #ddd', background: active ? '#f5f8eb' : '#fff', borderRadius: 6 }}>{label}</button>
    );
}

function FormInput({ label, value, onChange, type = 'text' }) {
    return (
        <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 'bold', marginBottom: 4 }}>{label}</label>
            <input type={type} value={value} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
        </div>
    );
}

function FormTextarea({ label, value, onChange, rows = 3 }) {
    return (
        <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 'bold', marginBottom: 4 }}>{label}</label>
            <textarea rows={rows} value={value} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }} />
        </div>
    );
}

function TagSelector({ label, options, selectedTags, onTagToggle, customText, onCustomChange, showCustom, onToggleCustom }) {
    return (
        <div style={{ marginBottom: 15 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 'bold', marginBottom: 6 }}>{label}</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {options.map(opt => (
                    <button key={opt} onClick={() => onTagToggle(opt)}
                        style={{
                            padding: '6px 10px', fontSize: 11, borderRadius: 20, cursor: 'pointer',
                            background: selectedTags.includes(opt) ? '#8a9a3c' : '#f0f0f0',
                            color: selectedTags.includes(opt) ? '#fff' : '#555',
                            border: '1px solid', borderColor: selectedTags.includes(opt) ? '#8a9a3c' : '#ddd'
                        }}>
                        {opt}
                    </button>
                ))}
                <button onClick={onToggleCustom}
                    style={{
                        padding: '6px 10px', fontSize: 11, borderRadius: 20, cursor: 'pointer',
                        background: showCustom ? '#d3542b' : '#f0f0f0',
                        color: showCustom ? '#fff' : '#555',
                        border: '1px solid', borderColor: showCustom ? '#d3542b' : '#ddd'
                    }}>
                    อื่นๆ +
                </button>
            </div>
            {showCustom && (
                <input type="text" placeholder="พิมพ์ระบุเพิ่มเติม..." value={customText} onChange={e => onCustomChange(e.target.value)}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px dashed #d3542b', fontSize: 12, boxSizing: 'border-box' }} />
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
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 12, background: '#555', borderRadius: '0 0 4px 4px' }} />
        </div>
    );
    return <div style={base} />;
}

function ColorSwatchPicker({ label, value, onChange, palette }) {
    const [showPicker, setShowPicker] = useState(false);
    return (
        <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#444' }}>{label}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div onClick={() => setShowPicker(!showPicker)} style={{ width: 28, height: 28, borderRadius: 6, background: value, border: '2px solid #ddd', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }} />
                    <span style={{ fontSize: 11, color: '#888', fontFamily: 'monospace' }}>{value}</span>
                </div>
            </div>
            {showPicker && (
                <div style={{ padding: 8, background: '#f9f9f9', borderRadius: 8, border: '1px solid #eee' }}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                        {palette.map((c, i) => (
                            <button key={i} onClick={() => { onChange(c); setShowPicker(false); }}
                                style={{ width: 30, height: 30, borderRadius: 6, background: c, border: value === c ? '2.5px solid #333' : '1px solid #ddd', cursor: 'pointer', position: 'relative' }}
                                title={c}>
                                {value === c && <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, textShadow: '0 0 3px #000' }}>✓</span>}
                            </button>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input type="color" value={value} onChange={e => onChange(e.target.value)} style={{ width: 32, height: 32, border: 'none', borderRadius: 4, cursor: 'pointer', padding: 0 }} />
                        <input type="text" value={value} onChange={e => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) onChange(e.target.value); }}
                            style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid #ddd', fontSize: 12, fontFamily: 'monospace' }} />
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
            <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid #eee' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <h4 style={{ margin: 0, fontSize: 13, color: '#8a9a3c' }}>
                        <iconify-icon icon="mdi:package-variant-closed" style={{ marginRight: 4, verticalAlign: 'middle' }}></iconify-icon>
                        Packaging
                    </h4>
                    <button onClick={() => setIsExpanded(!isExpanded)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#999', padding: 2 }}>
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
                            <div style={{ fontSize: 11, fontWeight: 'bold', color: '#333', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedPkg.name}</div>
                        </div>
                        <iconify-icon icon="mdi:check-circle" style={{ color: '#8a9a3c', fontSize: 16, flexShrink: 0 }}></iconify-icon>
                    </div>
                )}
                {/* Filter pills */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {CATEGORIES.filter(c => ['all', 'pouch', 'box', 'bottle', 'food'].includes(c.id)).map(cat => (
                        <button key={cat.id} onClick={() => setFilterCat(cat.id)}
                            style={{
                                padding: '2px 8px', fontSize: 10, borderRadius: 12, cursor: 'pointer',
                                background: filterCat === cat.id ? '#8a9a3c' : '#f5f5f5',
                                color: filterCat === cat.id ? '#fff' : '#888',
                                border: 'none',
                            }}>
                            {cat.label}
                        </button>
                    ))}
                </div>
            </div>
            {/* Package list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {filtered.map(pkg => {
                        const isSelected = selectedPackageId === pkg.id;
                        return (
                            <div key={pkg.id} onClick={() => onSelectPackage(pkg)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 8, padding: 8,
                                    background: isSelected ? '#f5f8eb' : '#fafafa', borderRadius: 8, cursor: 'pointer',
                                    border: isSelected ? '2px solid #8a9a3c' : '1px solid #eee',
                                    transition: 'all 0.15s',
                                }}>
                                <img src={pkg.thumbnail} alt={pkg.name}
                                    style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 6, background: '#fff', flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 11, fontWeight: 'bold', color: '#333', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {pkg.name}
                                    </div>
                                    <div style={{ fontSize: 9, color: '#999', marginTop: 1 }}>{pkg.type}</div>
                                </div>
                                {isSelected && (
                                    <iconify-icon icon="mdi:check-circle" style={{ color: '#8a9a3c', fontSize: 16, flexShrink: 0 }}></iconify-icon>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function PanelSelector({ panels, selectedPanel, onSelectPanel, materialData }) {
    if (!panels || panels.length === 0) return null;

    return (
        <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 'bold', color: '#333', marginBottom: 8 }}>
                เลือกด้านที่จะออกแบบฉลาก
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {panels.map(panel => {
                    const isSelected = selectedPanel?.id === panel.id;
                    const aspect = panel.w_mm / panel.h_mm;
                    const previewH = 80;
                    const previewW = Math.round(previewH * aspect);
                    const isWrap = aspect > 2;
                    const isPortrait = aspect < 0.8;

                    return (
                        <div
                            key={panel.id}
                            onClick={() => onSelectPanel(panel)}
                            style={{
                                cursor: 'pointer',
                                border: isSelected ? '2px solid #d3542b' : '2px solid #e0e0e0',
                                borderRadius: 10,
                                padding: 10,
                                background: isSelected ? '#fff8f5' : '#fff',
                                minWidth: 100,
                                textAlign: 'center',
                                transition: 'all 0.2s',
                            }}
                        >
                            {/* กรอบแสดงสัดส่วนจริง */}
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                marginBottom: 6, minHeight: 85,
                            }}>
                                <div style={{
                                    width: Math.min(previewW, 120),
                                    height: Math.min(previewH, 100),
                                    border: '1.5px dashed #aaa',
                                    borderRadius: 4,
                                    background: isSelected
                                        ? 'repeating-linear-gradient(45deg, #fff8f5, #fff8f5 4px, #fef0ea 4px, #fef0ea 8px)'
                                        : '#fafafa',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 9, color: '#999', position: 'relative',
                                }}>
                                    <span style={{ fontSize: 8, color: '#aaa' }}>
                                        {panel.w_mm}×{panel.h_mm} mm
                                    </span>
                                    {/* แสดงไอคอนบอกทิศทาง */}
                                    <span style={{
                                        position: 'absolute', top: 3, right: 4,
                                        fontSize: 10, color: '#bbb'
                                    }}>
                                        {isWrap ? '↔' : isPortrait ? '↕' : '⬜'}
                                    </span>
                                </div>
                            </div>
                            <div style={{ fontSize: 12, fontWeight: isSelected ? 'bold' : 500, color: isSelected ? '#d3542b' : '#555' }}>
                                {panel.label}
                            </div>
                            <div style={{ fontSize: 9, color: '#999', marginTop: 2 }}>
                                {isWrap ? 'แนวนอน (wrap)' : isPortrait ? 'แนวตั้ง' : 'สี่เหลี่ยม'}
                            </div>
                        </div>
                    );
                })}
            </div>
            {materialData && (
                <div style={{
                    marginTop: 10, padding: '8px 12px', background: '#f8f9fa',
                    borderRadius: 6, fontSize: 10, color: '#777',
                    display: 'flex', gap: 16, flexWrap: 'wrap'
                }}>
                    <span>วัสดุ: <b style={{ color: '#555' }}>{materialData.name}</b></span>
                    <span>Bleed: {materialData.bleed_mm || 3} mm</span>
                    <span>Safe zone: {materialData.safe_zone_mm || 3} mm</span>
                    <span>ประเภท: {materialData.package_type}</span>
                </div>
            )}
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
    const [materialData, setMaterialData] = useState(null);
    const [selectedPanel, setSelectedPanel] = useState(null);
    const [labelMode, setLabelMode] = useState('sticker'); // 'sticker' | 'fullcover'
    const [elemPositions, setElemPositions] = useState(() => ({ ...LAYOUT_PRESETS.centered_classic }));
    const [selectedElem, setSelectedElem] = useState(null);
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
    const [saveStatus, setSaveStatus] = useState('');

    const [openAccordions, setOpenAccordions] = useState({
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
    useEffect(() => {
        if (!labelAssets.font || labelAssets.font === "'Sarabun', sans-serif") return;
        const fontName = labelAssets.font.replace(/'/g, '').split(',')[0].trim();
        if (!fontName) return;
        const linkId = `gfont-label-${fontName.replace(/\s+/g, '-')}`;
        if (document.getElementById(linkId)) return;
        const link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@300;400;600;700;800;900&display=swap`;
        document.head.appendChild(link);
    }, [labelAssets.font]);

    // AUTO-SAVE (เฉพาะเมื่อเลือก packaging แล้ว)
    useEffect(() => {
        if (!selectedProduct || !hasPackaging) return;
        setSaveStatus('กำลังบันทึก...');
        const timer = setTimeout(() => { handleSaveLabel(true); }, 1500);
        return () => clearTimeout(timer);
    }, [labelForm, layoutType, bgMode, bgColor, bgPresetId, bgImageUrl, bgOpacity, labelDimensions, sectionColors, elemPositions]);

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

        const handleMove = (me) => {
            // For corner handles, use the diagonal distance for proportional scaling
            let dx = me.clientX - startX;
            let dy = me.clientY - startY;

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

    const handleDragStart = (e, elemId) => {
        e.preventDefault();
        if (!labelRef.current) return;
        setSelectedElem(elemId);
        const rect = labelRef.current.getBoundingClientRect();
        const startX = e.clientX;
        const startY = e.clientY;
        const startPos = { ...elemPositions[elemId] };

        const handleMove = (me) => {
            const dx = ((me.clientX - startX) / rect.width) * 100;
            const dy = ((me.clientY - startY) / rect.height) * 100;
            setElemPositions(prev => ({
                ...prev,
                [elemId]: {
                    ...prev[elemId],
                    x: Math.max(0, Math.min(95, startPos.x + dx)),
                    y: Math.max(0, Math.min(95, startPos.y + dy)),
                }
            }));
        };

        const handleUp = () => {
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('mouseup', handleUp);
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
            }
        } catch (err) { console.error('Upload bg error:', err); }
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

    const toggleCertification = (id) => {
        setLabelForm(p => ({ ...p, certifications: p.certifications.includes(id) ? p.certifications.filter(x => x !== id) : [...p.certifications, id] }));
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
                    const canvas = await html2canvas(labelRef.current, {
                        scale: 2, useCORS: true, allowTaint: true, backgroundColor: null, logging: false
                    });
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
            const canvas = await html2canvas(labelRef.current, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: null });
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
            const canvas = await html2canvas(labelRef.current, { scale, useCORS: true, allowTaint: true, backgroundColor: null, logging: false });
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
            const canvas = await html2canvas(labelRef.current, { scale, useCORS: true, allowTaint: true, backgroundColor: null, logging: false });
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

    // ============= RENDER LABEL PREVIEW (Draggable Canvas) =============
    const renderElemContent = (elemId) => {
        const textColor = sectionColors.productName;
        const accentColor = sectionColors.tagline;
        const subColor = sectionColors.details;
        const align = layoutType === 'modern_side' ? 'left' : 'center';

        switch (elemId) {
            case 'logo':
                return labelAssets.logoUrl
                    ? <img src={labelAssets.logoUrl} crossOrigin="anonymous" alt="logo" style={{ maxWidth: 120, maxHeight: 120, width: 'auto', height: 'auto', objectFit: 'contain', display: 'block' }} />
                    : <div style={{ width: 90, height: 90, background: 'rgba(0,0,0,0.06)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: 11 }}>LOGO</div>;
            case 'productName':
                return <div style={{ fontSize: 22, fontWeight: 800, color: textColor, textAlign: align, lineHeight: 1.2 }}>{labelForm.productName || <span style={{ opacity: .35 }}>ชื่อสินค้า</span>}</div>;
            case 'tagline':
                return labelForm.tagline ? <div style={{ fontSize: 12, fontWeight: 600, color: accentColor, textAlign: align }}>{labelForm.tagline}</div> : <div style={{ fontSize: 10, color: '#ccc', textAlign: align }}>คำโปรย</div>;
            case 'netWeight':
                return labelForm.netWeight ? <div style={{ fontSize: 11, color: subColor, textAlign: align }}>ปริมาณสุทธิ: {labelForm.netWeight}</div> : null;
            case 'certifications':
                return labelForm.certifications.length > 0 ? (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: align === 'left' ? 'flex-start' : 'center' }}>
                        {labelForm.certifications.map(id => { const c = CERT_OPTIONS.find(x => x.id === id); return c ? <span key={id} style={{ background: accentColor, color: '#fff', fontSize: 8, padding: '2px 6px', borderRadius: 999, fontWeight: 'bold' }}>{c.label}</span> : null; })}
                    </div>
                ) : null;
            case 'ingredients':
                return labelForm.ingredients ? (
                    <div style={{ fontSize: 10, lineHeight: 1.5, textAlign: 'left', maxWidth: 280 }}>
                        <strong style={{ color: textColor }}>ส่วนประกอบ:</strong>
                        <div style={{ whiteSpace: 'pre-wrap', color: subColor }}>{labelForm.ingredients}</div>
                    </div>
                ) : <div style={{ fontSize: 9, color: '#ccc' }}>ส่วนประกอบ...</div>;
            case 'usage':
                return finalUsageString ? <div style={{ fontSize: 10, textAlign: 'left', maxWidth: 280 }}><strong style={{ color: textColor }}>วิธีใช้:</strong> <span style={{ color: subColor }}>{finalUsageString}</span></div> : null;
            case 'storage':
                return finalStorageString ? <div style={{ fontSize: 10, textAlign: 'left', maxWidth: 280 }}><strong style={{ color: textColor }}>วิธีเก็บ:</strong> <span style={{ color: subColor }}>{finalStorageString}</span></div> : null;
            case 'warnings':
                return finalWarningString ? <div style={{ fontSize: 10, color: '#c0392b', textAlign: 'left', maxWidth: 280 }}>⚠ {finalWarningString}</div> : null;
            case 'codes':
                return (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {labelForm.showQR && labelForm.qrValue && <div style={{ background: '#fff', padding: 4, borderRadius: 4 }}><QRCodeSVG value={labelForm.qrValue} size={48} /></div>}
                        {labelForm.showBarcode && labelForm.barcodeValue && <div style={{ background: '#fff', padding: 3, borderRadius: 4 }}><Barcode value={labelForm.barcodeValue} height={30} fontSize={8} width={1} margin={0} /></div>}
                        {!labelForm.showQR && !labelForm.showBarcode && <div style={{ fontSize: 9, color: '#ccc' }}>QR/Barcode</div>}
                    </div>
                );
            case 'manufacturer': {
                const items = [];
                if (labelForm.manufacturerName) items.push('ผลิตโดย: ' + labelForm.manufacturerName);
                if (labelForm.manufacturerAddress) items.push(labelForm.manufacturerAddress);
                const contact = [labelForm.manufacturerPhone && 'โทร. ' + labelForm.manufacturerPhone, labelForm.manufacturerLine && 'Line: ' + labelForm.manufacturerLine].filter(Boolean).join(' | ');
                if (contact) items.push(contact);
                return items.length > 0 ? <div style={{ fontSize: 9, color: subColor, lineHeight: 1.5, textAlign: align }}>{items.map((t, i) => <div key={i}>{t}</div>)}</div> : <div style={{ fontSize: 9, color: '#ccc' }}>ข้อมูลผู้ผลิต</div>;
            }
            case 'legal': {
                const legalItems = [labelForm.fdaNumber && 'อย. ' + labelForm.fdaNumber, labelForm.lotNumber && 'Lot: ' + labelForm.lotNumber, labelForm.mfgDate && 'MFG: ' + labelForm.mfgDate, labelForm.expDate && 'EXP: ' + labelForm.expDate].filter(Boolean);
                return legalItems.length > 0 ? <div style={{ fontSize: 9, color: subColor, textAlign: align }}>{legalItems.join(' • ')}</div> : <div style={{ fontSize: 9, color: '#ccc' }}>กฎหมาย/วันที่</div>;
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
                onClick={(e) => { if (e.target === e.currentTarget || e.target.dataset.canvas) setSelectedElem(null); }}
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

                {/* Draggable + Resizable elements */}
                {LABEL_ELEMENTS.map(elem => {
                    const pos = elemPositions[elem.id];
                    if (!pos || !pos.visible) return null;
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
                            onMouseDown={(e) => handleDragStart(e, elem.id)}
                            onClick={(e) => { e.stopPropagation(); setSelectedElem(elem.id); }}
                            style={{
                                position: 'absolute',
                                left: `${pos.x}%`,
                                top: `${pos.y}%`,
                                maxWidth: `${Math.min(92, 85 / elemScale)}%`,
                                cursor: 'move',
                                zIndex: isSelected ? 50 : 10,
                                outline: isSelected ? '2px solid #2196F3' : 'none',
                                outlineOffset: 2,
                                borderRadius: 2,
                                transform: `scale(${elemScale})`,
                                transformOrigin: 'top left',
                            }}
                            title={`${elem.label} — ลากเพื่อย้าย / ลากมุมเพื่อปรับขนาด`}
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

    // ============= RENDER: LEFT FORM PANEL =============
    const renderFormPanel = () => (
        <div style={{
            flex: '0 0 440px', maxHeight: 'calc(100vh - 180px)', overflowY: 'auto',
            background: '#fff', padding: 24, borderRadius: 14,
            boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
            position: 'relative',
        }}>
            {/* ปุ่มย้อนกลับ — อยู่เหนือ overlay เสมอ */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, position: 'relative', zIndex: 20 }}>
                <button onClick={() => { if (hasPackaging) handleSaveLabel(true); setSelectedProduct(null); setSelectedPackage(null); }}
                    style={{ background: '#eee', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}>
                    ❮ ย้อนกลับ
                </button>
                <span style={{ fontSize: 12, color: saveStatus.includes('✓') ? '#8a9a3c' : '#888' }}>{saveStatus}</span>
            </div>

            {/* Overlay สำหรับกรณียังไม่ได้เลือก packaging — เริ่มจากใต้ปุ่มย้อนกลับ */}
            {!hasPackaging && (
                <div style={{
                    position: 'absolute', top: 55, left: 0, right: 0, bottom: 0, zIndex: 10,
                    background: 'rgba(255,255,255,0.75)', borderRadius: '0 0 14px 14px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <div style={{ textAlign: 'center', color: '#888', padding: 30 }}>
                        <iconify-icon icon="mdi:package-variant-closed" style={{ fontSize: 48, color: '#ccc' }}></iconify-icon>
                        <p style={{ fontSize: 14, fontWeight: 'bold', marginTop: 12 }}>กรุณาเลือก Packaging ก่อน</p>
                        <p style={{ fontSize: 12, color: '#aaa' }}>เลือกจากแถบ Packaging ด้านขวา</p>
                    </div>
                </div>
            )}

            <h3 style={{ marginTop: 0, color: '#8a9a3c' }}>ออกแบบฉลาก: {selectedProduct?.name_product}</h3>

            {/* แสดง packaging ที่เลือกอยู่ */}
            {hasPackaging && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: 10, marginBottom: 16,
                    background: '#f5f8eb', borderRadius: 8, border: '1px solid #d4e4a0'
                }}>
                    <img src={selectedPackage.thumbnail} alt={selectedPackage.name}
                        style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 6 }} />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 'bold', color: '#333' }}>{selectedPackage.name}</div>
                        <div style={{ fontSize: 10, color: '#888' }}>{selectedPackage.type}</div>
                    </div>
                </div>
            )}

            {/* โหมดฉลาก: สติกเกอร์ / เต็มพื้นที่ */}
            <div style={{ marginBottom: 16 }}>
                <label style={{ fontWeight: 'bold', fontSize: 13, display: 'block', marginBottom: 8 }}>โหมดฉลาก</label>
                <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => handleModeToggle('sticker')} style={{ flex: 1, padding: '10px 8px', border: labelMode === 'sticker' ? '2px solid #d3542b' : '1px solid #ddd', background: labelMode === 'sticker' ? '#fff8f5' : '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 12, textAlign: 'center' }}>
                        <div style={{ fontWeight: 'bold', color: labelMode === 'sticker' ? '#d3542b' : '#333' }}>สติกเกอร์</div>
                        <div style={{ fontSize: 9, color: '#888', marginTop: 2 }}>ลดขนาด 30% แปะบน package</div>
                    </button>
                    <button onClick={() => handleModeToggle('fullcover')} style={{ flex: 1, padding: '10px 8px', border: labelMode === 'fullcover' ? '2px solid #d3542b' : '1px solid #ddd', background: labelMode === 'fullcover' ? '#fff8f5' : '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 12, textAlign: 'center' }}>
                        <div style={{ fontWeight: 'bold', color: labelMode === 'fullcover' ? '#d3542b' : '#333' }}>เต็มพื้นที่</div>
                        <div style={{ fontSize: 9, color: '#888', marginTop: 2 }}>ออกแบบเต็ม panel</div>
                    </button>
                </div>
            </div>

            {/* Layout Preset + จัดการ elements */}
            <div style={{ marginBottom: 16 }}>
                <label style={{ fontWeight: 'bold', fontSize: 13, display: 'block', marginBottom: 8 }}>รูปแบบฉลาก</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 8 }}>
                    {TEMPLATE_TYPES.map(t => (
                        <button key={t.id} onClick={() => applyLayoutPreset(t.id)}
                            style={{ padding: 5, textAlign: 'center', border: layoutType === t.id ? '2.5px solid #8a9a3c' : '1px solid #ddd', background: layoutType === t.id ? '#f5f8eb' : '#fff', borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s' }}>
                            <LayoutThumbnail type={t.id} />
                            <div style={{ fontWeight: 700, fontSize: 10, marginTop: 4, color: layoutType === t.id ? '#8a9a3c' : '#555' }}>{t.name}</div>
                        </button>
                    ))}
                </div>
                <div style={{ fontSize: 9, color: '#999', marginBottom: 8 }}>
                    {TEMPLATE_TYPES.find(t => t.id === layoutType)?.desc} · กดเทมเพลตเพื่อรีเซ็ตตำแหน่ง
                </div>
                <div style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 6, color: '#666' }}>แสดง/ซ่อนองค์ประกอบ</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {LABEL_ELEMENTS.map(elem => {
                        const isVisible = elemPositions[elem.id]?.visible;
                        return (
                            <button key={elem.id} onClick={() => toggleElemVisibility(elem.id)}
                                style={{
                                    padding: '3px 8px', fontSize: 10, borderRadius: 12, cursor: 'pointer',
                                    background: isVisible ? '#8a9a3c' : '#f0f0f0',
                                    color: isVisible ? '#fff' : '#999',
                                    border: 'none',
                                }}>
                                {elem.label}
                            </button>
                        );
                    })}
                </div>
                {/* Scale control สำหรับ element ที่ถูกเลือก */}
                {selectedElem && elemPositions[selectedElem] && (() => {
                    const curScale = elemPositions[selectedElem]?.scale || 1;
                    const pct = Math.round(curScale * 100);
                    return (
                        <div style={{ marginTop: 10, padding: 12, background: '#f0f4ff', borderRadius: 10, border: '1px solid #c5d5f7' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#1565C0' }}>
                                    {LABEL_ELEMENTS.find(e => e.id === selectedElem)?.label}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <input
                                        type="number" min="30" max="400" step="5"
                                        value={pct}
                                        onChange={e => {
                                            const v = Math.max(30, Math.min(400, parseInt(e.target.value) || 100));
                                            setElemPositions(prev => ({ ...prev, [selectedElem]: { ...prev[selectedElem], scale: v / 100 } }));
                                        }}
                                        style={{ width: 52, padding: '3px 6px', border: '1px solid #90CAF9', borderRadius: 4, fontSize: 12, fontWeight: 700, color: '#1565C0', textAlign: 'center', background: '#fff' }}
                                    />
                                    <span style={{ fontSize: 11, color: '#1565C0', fontWeight: 600 }}>%</span>
                                </div>
                            </div>
                            <div style={{ position: 'relative', height: 24, display: 'flex', alignItems: 'center' }}>
                                {/* Track background */}
                                <div style={{ position: 'absolute', left: 0, right: 0, height: 4, background: '#dde5f5', borderRadius: 2 }} />
                                {/* Filled track */}
                                <div style={{ position: 'absolute', left: 0, width: `${Math.min(100, ((curScale - 0.3) / 3.7) * 100)}%`, height: 4, background: 'linear-gradient(90deg, #42A5F5, #1565C0)', borderRadius: 2 }} />
                                <input type="range" min="0.3" max="4" step="0.05"
                                    value={curScale}
                                    onChange={e => setElemPositions(prev => ({ ...prev, [selectedElem]: { ...prev[selectedElem], scale: parseFloat(e.target.value) } }))}
                                    style={{ position: 'relative', width: '100%', height: 24, opacity: 0, cursor: 'pointer', zIndex: 2 }}
                                />
                                {/* Custom thumb */}
                                <div style={{
                                    position: 'absolute',
                                    left: `calc(${((curScale - 0.3) / 3.7) * 100}% - 8px)`,
                                    width: 16, height: 16,
                                    background: '#fff', border: '2px solid #1565C0', borderRadius: '50%',
                                    boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                                    pointerEvents: 'none',
                                }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    {[50, 75, 100, 150, 200].map(v => (
                                        <button key={v} onClick={() => setElemPositions(prev => ({ ...prev, [selectedElem]: { ...prev[selectedElem], scale: v / 100 } }))}
                                            style={{
                                                padding: '2px 6px', fontSize: 9, fontWeight: pct === v ? 700 : 500,
                                                background: pct === v ? '#1565C0' : '#fff', color: pct === v ? '#fff' : '#666',
                                                border: `1px solid ${pct === v ? '#1565C0' : '#ccc'}`, borderRadius: 4, cursor: 'pointer',
                                            }}>{v}%</button>
                                    ))}
                                </div>
                                <button onClick={() => setElemPositions(prev => ({ ...prev, [selectedElem]: { ...prev[selectedElem], visible: false } }))}
                                    style={{ fontSize: 9, color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer' }}>
                                    ซ่อน
                                </button>
                            </div>
                            {/* Position info */}
                            <div style={{ marginTop: 8, display: 'flex', gap: 8, fontSize: 10, color: '#888' }}>
                                <span>X: {Math.round(elemPositions[selectedElem]?.x || 0)}%</span>
                                <span>Y: {Math.round(elemPositions[selectedElem]?.y || 0)}%</span>
                            </div>
                        </div>
                    );
                })()}
                <div style={{ fontSize: 9, color: '#aaa', marginTop: 6 }}>ลากองค์ประกอบบน canvas เพื่อย้ายตำแหน่ง · ลากมุมหรือขอบเพื่อปรับขนาด</div>
            </div>

            {/* ตั้งค่าขนาด & สี */}
            <AccordionSection title="ตั้งค่าขนาด & สี" open={openAccordions.settings} onToggle={() => toggleAccordion('settings')}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 15 }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 12, fontWeight: 'bold' }}>กว้าง (ซม.)</label>
                        <input type="number" step="0.1" value={labelDimensions.width}
                            onChange={e => setLabelDimensions({ ...labelDimensions, width: parseFloat(e.target.value) || 1 })}
                            style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #ddd', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 12, fontWeight: 'bold' }}>สูง (ซม.)</label>
                        <input type="number" step="0.1" value={labelDimensions.height}
                            onChange={e => setLabelDimensions({ ...labelDimensions, height: parseFloat(e.target.value) || 1 })}
                            style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #ddd', boxSizing: 'border-box' }} />
                    </div>
                </div>
                <ColorSwatchPicker label="สีชื่อสินค้า" value={sectionColors.productName} onChange={v => setSectionColors({ ...sectionColors, productName: v })} palette={labelAssets.colors} />
                <ColorSwatchPicker label="สีคำโปรย" value={sectionColors.tagline} onChange={v => setSectionColors({ ...sectionColors, tagline: v })} palette={labelAssets.colors} />
                <ColorSwatchPicker label="สีรายละเอียด" value={sectionColors.details} onChange={v => setSectionColors({ ...sectionColors, details: v })} palette={labelAssets.colors} />
            </AccordionSection>

            {/* พื้นหลังฉลาก */}
            <AccordionSection title="พื้นหลังฉลาก" open={openAccordions.bg} onToggle={() => toggleAccordion('bg')}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                    <BgModeBtn label="สีพื้น" active={bgMode === 'solid'} onClick={() => setBgMode('solid')} />
                    <BgModeBtn label="Preset" active={bgMode === 'preset'} onClick={() => setBgMode('preset')} />
                    <BgModeBtn label="AI" active={bgMode === 'dalle'} onClick={() => setBgMode('dalle')} />
                </div>
                <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 12, fontWeight: 'bold' }}>อัปโหลดรูปภาพเอง</label>
                    <input type="file" accept="image/*" onChange={handleUploadCustomBg} style={{ width: '100%', fontSize: 12, marginTop: 4 }} />
                </div>
                {bgMode === 'solid' && (
                    <div>
                        <div style={{ fontSize: 11, color: '#666', marginBottom: 6, fontWeight: 600 }}>Brand Palette</div>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                            {labelAssets.colors.map((c, i) => (
                                <button key={i} onClick={() => setBgColor(c)}
                                    style={{ width: 36, height: 36, borderRadius: 8, background: c, border: bgColor === c ? '3px solid #333' : '1.5px solid #ddd', cursor: 'pointer', transition: 'transform 0.1s', transform: bgColor === c ? 'scale(1.15)' : 'scale(1)', position: 'relative', boxShadow: bgColor === c ? '0 2px 8px rgba(0,0,0,0.2)' : 'none' }}
                                    title={c}>
                                    {bgColor === c && <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, textShadow: '0 0 4px #000' }}>✓</span>}
                                </button>
                            ))}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} style={{ width: 36, height: 36, border: 'none', cursor: 'pointer', borderRadius: 6, padding: 0 }} />
                            <input type="text" value={bgColor} onChange={e => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) setBgColor(e.target.value); }} style={{ flex: 1, padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 12, fontFamily: 'monospace' }} />
                            <button onClick={() => setBgColor('#FFFFFF')} style={{ padding: '6px 10px', fontSize: 11, border: '1px solid #ddd', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>ขาว</button>
                        </div>
                    </div>
                )}
                {bgMode === 'preset' && (
                    <div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                            {bgPresets.map(p => (
                                <button key={p.bg_preset_id} onClick={() => handleSelectPreset(p)} style={{ padding: 0, border: bgPresetId === p.bg_preset_id ? '3px solid #8a9a3c' : '1px solid #ddd', borderRadius: 6, overflow: 'hidden', cursor: 'pointer', aspectRatio: '1/1', background: '#eee' }} title={p.name}>
                                    <img src={p.thumbnail_url || p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </button>
                            ))}
                        </div>
                        {bgPresets.length === 0 && <div style={{ fontSize: 11, color: '#999' }}>ยังไม่มี preset</div>}
                    </div>
                )}
                {bgMode === 'dalle' && (
                    <div>
                        <div style={{ marginBottom: 8 }}><label style={{ fontSize: 11, fontWeight: 'bold' }}>สไตล์ลาย</label><select value={dalleStyle} onChange={e => setDalleStyle(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd' }}>{BG_STYLES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                            <div><label style={{ fontSize: 11, fontWeight: 'bold' }}>โทน</label><select value={dalleTone} onChange={e => setDalleTone(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd' }}><option value="auto">Auto</option><option value="bright">สว่าง</option><option value="dark">เข้ม</option><option value="pastel">Pastel</option></select></div>
                            <div><label style={{ fontSize: 11, fontWeight: 'bold' }}>ความหนาแน่น</label><select value={dalleDensity} onChange={e => setDalleDensity(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd' }}><option value="low">เบาบาง</option><option value="medium">ปานกลาง</option><option value="high">หนาแน่น</option></select></div>
                        </div>
                        <button onClick={handleGenerateBgWithAI} disabled={isGeneratingBg} style={{ width: '100%', padding: 12, background: '#8f1d1d', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer', marginBottom: 6 }}>{isGeneratingBg ? 'กำลังสร้างพื้นหลัง...' : 'Generate Background (AI)'}</button>
                        {bgImageUrl && bgMode === 'dalle' && <img src={bgImageUrl} alt="bg preview" style={{ width: '100%', borderRadius: 6, marginTop: 6 }} />}
                    </div>
                )}
                {(bgMode === 'preset' || bgMode === 'dalle') && bgImageUrl && (
                    <div style={{ marginTop: 12 }}>
                        <label style={{ fontSize: 11, fontWeight: 'bold' }}>ความเข้มรูปภาพ: {Math.round(bgOpacity * 100)}%</label>
                        <input type="range" min="0.2" max="1" step="0.05" value={bgOpacity} onChange={e => setBgOpacity(parseFloat(e.target.value))} style={{ width: '100%' }} />
                    </div>
                )}
                {/* แกลเลอรีพื้นหลังที่เคยสร้าง/อัปโหลด */}
                {bgHistory.length > 0 && (
                    <div style={{ marginTop: 14, borderTop: '1px solid #eee', paddingTop: 10 }}>
                        <label style={{ fontSize: 11, fontWeight: 'bold', display: 'block', marginBottom: 6 }}>
                            ประวัติพื้นหลัง ({bgHistory.length} รูป)
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                            {bgHistory.map((item) => {
                                const url = item.image_url?.startsWith('http') ? item.image_url : `${API}${item.image_url}`;
                                const isActive = bgImageUrl === url;
                                return (
                                    <button key={item.history_id} onClick={() => { setBgImageUrl(url); setBgMode('preset'); setBgPresetId(null); }}
                                        style={{
                                            padding: 0, border: isActive ? '3px solid #d3542b' : '1px solid #ddd',
                                            borderRadius: 6, overflow: 'hidden', cursor: 'pointer',
                                            aspectRatio: '1/1', background: '#eee', position: 'relative',
                                        }}>
                                        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            onError={(e) => { e.target.style.display = 'none'; }} />
                                        <span style={{
                                            position: 'absolute', bottom: 2, right: 2,
                                            fontSize: 7, background: 'rgba(0,0,0,0.5)', color: '#fff',
                                            padding: '1px 3px', borderRadius: 3,
                                        }}>
                                            {item.generation_type === 'LABEL_BG_UPLOAD' ? 'UP' : 'AI'}
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
                <button onClick={handleAIWriteCopy} disabled={isLabelAILoading} style={{ width: '100%', padding: 10, background: '#d3542b', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer', marginTop: 6 }}>
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

            {/* ตราสัญลักษณ์รับรอง */}
            <AccordionSection title="ตราสัญลักษณ์รับรอง" open={openAccordions.cert} onToggle={() => toggleAccordion('cert')}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {CERT_OPTIONS.map(c => (
                        <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                            <input type="checkbox" checked={labelForm.certifications.includes(c.id)} onChange={() => toggleCertification(c.id)} /> {c.label}
                        </label>
                    ))}
                </div>
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

            {/* ปุ่มบันทึก + Export */}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={() => handleSaveLabel()} disabled={isSavingLabel} style={{ flex: 1, padding: 12, background: '#8a9a3c', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer' }}>
                    {isSavingLabel ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
            </div>

            {/* กลุ่มปุ่ม Export */}
            <div style={{ marginTop: 16, padding: 12, background: '#f8f9fa', borderRadius: 10 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 'bold', marginBottom: 10, color: '#333' }}>ส่งออกฉลาก</label>
                <button onClick={handleDownloadLabel} style={{ width: '100%', padding: 10, background: '#fff', color: '#333', border: '1px solid #ddd', borderRadius: 8, fontWeight: 600, cursor: 'pointer', marginBottom: 8, fontSize: 12 }}>
                    ดาวน์โหลด Preview (PNG)
                </button>
                <button onClick={() => { if (!isProUser(getUserFromStorage())) { setShowProModal(true); return; } handleExportPrintReady(); }} style={{ width: '100%', padding: 10, background: isProUser(getUserFromStorage()) ? '#2d5016' : '#ccc', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', marginBottom: 8, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    ดาวน์โหลด Print-Ready (300 DPI)
                    {!isProUser(getUserFromStorage()) && <iconify-icon icon="solar:lock-keyhole-linear" width="14"></iconify-icon>}
                </button>
                <button onClick={() => { if (!isProUser(getUserFromStorage())) { setShowProModal(true); return; } handleExportLabelPDF(); }} style={{ width: '100%', padding: 10, background: isProUser(getUserFromStorage()) ? '#8f1d1d' : '#ccc', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    ส่งออก PDF พร้อมพิมพ์ (แนะนำ)
                    {!isProUser(getUserFromStorage()) && <iconify-icon icon="solar:lock-keyhole-linear" width="14"></iconify-icon>}
                </button>
            </div>
        </div>
    );
    
    // ============= RENDER: CENTER PANEL (Preview + Template Selector) =============
    const renderCenterPanel = () => {
        if (!hasPackaging) {
            return (
                <div style={{
                    flex: 1, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    background: '#f0f2f5', borderRadius: 14, minHeight: 500,
                }}>
                    <iconify-icon icon="mdi:label-outline" style={{ fontSize: 64, color: '#ddd' }}></iconify-icon>
                    <p style={{ fontSize: 16, fontWeight: 'bold', color: '#bbb', marginTop: 12 }}>ตัวอย่างฉลากจะปรากฏที่นี่</p>
                    <p style={{ fontSize: 12, color: '#ccc' }}>เลือก Packaging จากแถบด้านขวาเพื่อเริ่มต้น</p>
                </div>
            );
        }

        return (
            <div style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                background: '#f0f2f5', padding: 24, borderRadius: 14,
                maxHeight: 'calc(100vh - 180px)', overflowY: 'auto',
            }}>
                {/* Panel Selector — เลือกด้านของ package */}
                <PanelSelector
                    panels={labelPanels}
                    selectedPanel={selectedPanel}
                    onSelectPanel={handleSelectPanel}
                    materialData={materialData}
                />

                {/* แสดงขนาด panel ที่เลือก */}
                {selectedPanel && (
                    <div style={{
                        textAlign: 'center', marginBottom: 8,
                        fontSize: 11, color: '#888',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                    }}>
                        <span style={{ background: '#f0f0f0', padding: '3px 10px', borderRadius: 12, fontSize: 10 }}>
                            {selectedPanel.label}: {selectedPanel.w_mm} × {selectedPanel.h_mm} mm
                            {selectedPanel.w_mm > selectedPanel.h_mm * 2 ? ' (wrap)' : ''}
                        </span>
                    </div>
                )}

                {/* Label Preview */}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
                    {renderLabelPreview()}
                </div>
            </div>
        );
    };

    // ============= MAIN RENDER =============
    return (
        <>
            {!selectedProduct ? (
                <div>
                    <h2 style={{ color: '#8a9a3c', marginTop: 0 }}>เลือกสินค้าเพื่อออกแบบฉลาก</h2>
                    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 20 }}>
                        {products.map(prod => (
                            <div key={prod.product_id} onClick={() => handleSelectProduct(prod)}
                                style={{ width: 200, background: '#fff', padding: 15, borderRadius: 12, cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.05)', textAlign: 'center', border: '1px solid #eee' }}>
                                <div style={{ width: '100%', height: 150, background: '#f9f9f9', borderRadius: 8, marginBottom: 10, overflow: 'hidden' }}>
                                    {prod.image_product ? <img src={`${API}/uploads/${prod.image_product}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <div style={{ padding: '50px 0', color: '#ccc' }}>No Image</div>}
                                </div>
                                <h3 style={{ margin: 0, fontSize: 16 }}>{prod.name_product}</h3>
                                {prod.package_id && (
                                    <div style={{ marginTop: 6, fontSize: 10, color: '#8a9a3c', background: '#f5f8eb', padding: '3px 8px', borderRadius: 10, display: 'inline-block' }}>
                                        <iconify-icon icon="mdi:package-variant" style={{ verticalAlign: 'middle', marginRight: 3 }}></iconify-icon>
                                        มี Packaging แล้ว
                                    </div>
                                )}
                            </div>
                        ))}
                        <div onClick={() => setIsAddProductOpen(true)}
                            style={{ width: 200, background: '#f5f8eb', border: '2px dashed #8a9a3c', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 12, cursor: 'pointer', color: '#8a9a3c' }}>
                            <iconify-icon icon="mdi:plus-circle-outline" style={{ fontSize: 40 }}></iconify-icon>
                            <h3 style={{ fontSize: 16 }}>เพิ่มสินค้าใหม่</h3>
                        </div>
                    </div>
                </div>
            ) : (
                /* === 3-COLUMN LAYOUT: ซ้าย=ฟอร์ม | กลาง=Preview | ขวา=Packaging Sidebar === */
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', fontFamily: labelAssets.font }}>
                    {/* ซ้าย: ฟอร์มออกแบบ */}
                    {renderFormPanel()}

                    {/* กลาง: ตัวอย่างฉลาก + template selector */}
                    {renderCenterPanel()}

                    {/* ขวา: Packaging Sidebar แบบย่อ */}
                    <PackagingSidebar
                        packages={PACKAGES}
                        selectedPackageId={selectedPackage?.id || null}
                        onSelectPackage={handleSelectPackaging}
                    />
                </div>
            )}

            {/* Modal เพิ่มสินค้า */}
            {isAddProductOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
                    <form onSubmit={handleAddProduct} style={{ background: '#fff', padding: 30, borderRadius: 16, width: 400 }}>
                        <h3 style={{ color: '#d3542b', marginTop: 0 }}>เพิ่มสินค้าใหม่</h3>
                        <input type="text" placeholder="ชื่อสินค้า" value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} required style={{ width: '100%', padding: 10, marginBottom: 10, boxSizing: 'border-box' }} />
                        <select value={newProduct.type} onChange={e => setNewProduct({ ...newProduct, type: e.target.value })} required style={{ width: '100%', padding: 10, marginBottom: 10, boxSizing: 'border-box' }}>
                            <option value="">-- เลือกประเภท --</option><option value="อาหาร / ของกินเล่น">อาหาร / ของกินเล่น</option><option value="เครื่องดื่ม">เครื่องดื่ม</option>
                        </select>
                        <input type="file" onChange={e => setNewProduct({ ...newProduct, file: e.target.files[0] })} style={{ marginBottom: 20 }} />
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button type="button" onClick={() => setIsAddProductOpen(false)} style={{ flex: 1, padding: 10, border: 'none', borderRadius: 6 }}>ยกเลิก</button>
                            <button type="submit" style={{ flex: 1, padding: 10, background: '#d3542b', color: '#fff', border: 'none', borderRadius: 6 }}>เพิ่มสินค้า</button>
                        </div>
                    </form>
                </div>
            )}

            <ProUpgradeModal isOpen={showProModal} onClose={() => setShowProModal(false)} feature="download" />
        </>
    );
}