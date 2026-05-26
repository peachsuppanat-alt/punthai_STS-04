// punthai-frontend-user/src/MockupEditor.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Stage, Layer, Image as KImg, Rect as KRect, Text as KText, Circle as KCircle, Group, Transformer } from 'react-konva';
import html2canvas from 'html2canvas';
import { loadLogoTransparent } from './logoUtils';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { getUserFromStorage, isProUser } from '../utils/subscriptionGuard';
import ProUpgradeModal from '../components/ProUpgradeModal';

const API = 'http://localhost:3000';

// Color palette (match other pages)
const C = {
    primary: '#c94e1f',
    primaryDark: '#8f1d1d',
    label: '#8a9a3c',
    accent: '#d3542b',
    text: '#2a2a2a',
    sub: '#6b7280',
    border: '#e5e7eb',
    bgLight: '#fafafa',
    bgPage: '#f5f5f5',
};

// === Helper: load image (CORS-safe) ===
function useHtmlImage(src) {
    const [img, setImg] = useState(null);
    useEffect(() => {
        if (!src) { setImg(null); return; }
        const i = new window.Image();
        i.crossOrigin = 'anonymous';
        i.src = src;
        i.onload = () => setImg(i);
        i.onerror = () => setImg(null);
    }, [src]);
    return img;
}
// === Render label data → image (hidden DOM via html2canvas) ===
function LabelImageRenderer({ labelData, brandAssets, onReady }) {
    const ref = useRef();
    useEffect(() => {
        if (!labelData || !ref.current) return;
        const t = setTimeout(async () => {
            try {
                const canvas = await html2canvas(ref.current, {
                    scale: 2, backgroundColor: null, useCORS: true, logging: false
                });
                onReady(canvas.toDataURL('image/png'));
            } catch (e) { console.error('label render error', e); }
        }, 500);
        return () => clearTimeout(t);
    }, [labelData, brandAssets]);

    if (!labelData) return null;

    const colors = brandAssets?.colors || ['#fff', '#222', '#d3542b', '#777', '#eee'];
    const bgColor = labelData.bg_color || colors[0] || '#fff';
    const textColor = colors[1] || '#222';
    const accent = colors[2] || '#d3542b';
    const sub = colors[3] || '#888';

    return (
        <div style={{ position: 'fixed', left: -99999, top: -99999, pointerEvents: 'none' }}>
            <div ref={ref} style={{
                width: 380, padding: 24, background: bgColor, color: textColor,
                fontFamily: brandAssets?.font || "'Sarabun', sans-serif",
                display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                borderRadius: 12, boxSizing: 'border-box', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
                {brandAssets?.logoUrl && (
                    <img src={brandAssets.logoUrl} crossOrigin="anonymous" alt="logo"
                        style={{ width: 90, height: 90, objectFit: 'contain', marginBottom: 12 }} />
                )}
                <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.1 }}>
                    {labelData.product_name || 'Product Name'}
                </div>
                {labelData.tagline && (
                    <div style={{ fontSize: 13, fontWeight: 600, color: accent, marginTop: 6 }}>
                        {labelData.tagline}
                    </div>
                )}
                {labelData.net_weight && (
                    <div style={{ fontSize: 11, marginTop: 4, color: sub }}>{labelData.net_weight}</div>
                )}
                {labelData.ingredients && (
                    <div style={{ background: 'rgba(255,255,255,0.6)', padding: 10, borderRadius: 8, fontSize: 11, marginTop: 12, textAlign: 'left', width: '100%', lineHeight: 1.5 }}>
                        <strong>ส่วนประกอบ:</strong>
                        <div style={{ whiteSpace: 'pre-wrap' }}>{labelData.ingredients}</div>
                    </div>
                )}
                {labelData.certifications?.length > 0 && (
                    <div style={{ marginTop: 12, display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                        {labelData.certifications.map(c => (
                            <span key={c} style={{ background: accent, color: '#fff', fontSize: 9, padding: '2px 6px', borderRadius: 999, fontWeight: 'bold' }}>
                                {c}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}


// === Package Design Editor ===
function PackageDesignEditor({ projectId, userId, projectName, product, brandAssets, labelData, labelImageUrl, onBack }) {
    const stageRef = useRef();
    const trRef = useRef();

    const [materialData, setMaterialData] = useState(null);
    const [panels, setPanels] = useState([]);
    const [activePanelIdx, setActivePanelIdx] = useState(0);
    const [panelDesigns, setPanelDesigns] = useState({});
    const [selectedElId, setSelectedElId] = useState(null);
    const [openSections, setOpenSections] = useState({ bg: true });
    const [isSaving, setIsSaving] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [savedMockupId, setSavedMockupId] = useState(null);
    const [saveMsg, setSaveMsg] = useState('');
    const [showProModal, setShowProModal] = useState(false);

    // AI background state
    const [aiPrompt, setAiPrompt] = useState('');
    const [isAiGenerating, setIsAiGenerating] = useState(false);
    const [aiDielineBgUrl, setAiDielineBgUrl] = useState(null);
    const [aiDielineBgImg, setAiDielineBgImg] = useState(null);
    const [aiBgHistory, setAiBgHistory] = useState([]);

    // Auto-save state
    const [saveStatus, setSaveStatus] = useState('');
    const dataLoadedRef = useRef(false);

    // AI Mockup Preview state
    const [isGenMockup, setIsGenMockup] = useState(false);
    const [mockupProgress, setMockupProgress] = useState(null);
    const [aiMockupPreviewUrl, setAiMockupPreviewUrl] = useState(null);
    const [mockupBgStyle, setMockupBgStyle] = useState('white');
    const [mockupHistory, setMockupHistory] = useState([]);
    const [lightboxUrl, setLightboxUrl] = useState(null); // for image popup
    const [mockupPanelSelection, setMockupPanelSelection] = useState({}); // which panels to include

    // Canvas sizing
    const CANVAS_W = 700;
    const activePanel = panels[activePanelIdx];
    const mmToPx = activePanel ? Math.min(CANVAS_W / activePanel.w_mm, 600 / activePanel.h_mm) : 3;
    const canvasW = activePanel ? activePanel.w_mm * mmToPx : CANVAS_W;
    const canvasH = activePanel ? activePanel.h_mm * mmToPx : 500;

    // Current panel design
    const currentDesign = activePanel ? (panelDesigns[activePanel.id] || { bg_mode: 'solid', bg_color: '#FFFFFF', bg_opacity: 1, elements: [] }) : null;

    useEffect(() => { fetchMaterial(); }, [product]);

    const fetchMaterial = async () => {
        const matId = product.materials?.[0]?.id;
        if (!matId) return;
        try {
            const r = await fetch(`${API}/api/mockup/material/${matId}`);
            const d = await r.json();
            if (d.status === 'success') {
                setMaterialData(d.data);
                const p = d.data.panels_json ? (typeof d.data.panels_json === 'string' ? JSON.parse(d.data.panels_json) : d.data.panels_json) : [];
                setPanels(p);
                // Default: select front + first side for mockup generation
                const sel = {};
                p.forEach((panel, idx) => {
                    const label = (panel.label || '').toLowerCase();
                    sel[panel.id] = idx < 2 || label.includes('หน้า') || label.includes('ซ้าย');
                });
                setMockupPanelSelection(sel);
                const initial = {};
                p.forEach(panel => { initial[panel.id] = { bg_mode: 'solid', bg_color: '#FFFFFF', bg_opacity: 1, bg_image_url: null, elements: [] }; });
                setPanelDesigns(initial);
                loadExistingMockup(initial);
            }
        } catch (e) { console.error('[PkgDesign] fetch material error:', e); }
    };

    const loadExistingMockup = async (initialDesigns) => {
        try {
            const r = await fetch(`${API}/api/mockups/${projectId}?product_id=${product.product_id}`);
            const d = await r.json();
            if (d.status === 'success' && d.data && d.data.panels?.length > 0) {
                setSavedMockupId(d.data.mockup_id);
                if (d.data.ai_dieline_bg_url) {
                    setAiDielineBgUrl(d.data.ai_dieline_bg_url);
                    loadAiDielineImage(`${API}${d.data.ai_dieline_bg_url}`);
                }
                if (d.data.ai_bg_prompt) setAiPrompt(d.data.ai_bg_prompt);
                const loaded = { ...initialDesigns };
                d.data.panels.forEach(p => {
                    loaded[p.panel_key] = {
                        bg_mode: p.bg_mode || 'solid',
                        bg_color: p.bg_color || '#FFFFFF',
                        bg_opacity: parseFloat(p.bg_opacity) || 1,
                        bg_image_url: p.bg_image_url || null,
                        elements: Array.isArray(p.elements_json) ? p.elements_json : []
                    };
                });
                setPanelDesigns(loaded);
            }
        } catch (e) { console.error('[PkgDesign] load existing:', e); }
        // Mark data as loaded so auto-save can start
        setTimeout(() => { dataLoadedRef.current = true; }, 2000);
    };

    const loadAiDielineImage = (url) => {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.src = url;
        img.onload = () => setAiDielineBgImg(img);
    };

    const fetchAiBgHistory = async () => {
        try {
            const r = await fetch(`${API}/api/mockup/dieline-bg-history/${projectId}`);
            const d = await r.json();
            if (d.status === 'success') setAiBgHistory(d.data || []);
        } catch (e) { console.error('[PkgDesign] fetch AI history:', e); }
    };

    useEffect(() => { if (projectId) { fetchAiBgHistory(); fetchMockupHistory(); } }, [projectId, product?.product_id]);

    const fetchMockupHistory = async () => {
        try {
            const pid = product?.product_id;
            const r = await fetch(`${API}/api/mockup/package-mockup-history/${projectId}${pid ? `?product_id=${pid}` : ''}`);
            const d = await r.json();
            if (d.status === 'success') setMockupHistory(d.data || []);
        } catch (e) { console.error('[PkgDesign] fetch mockup history:', e); }
    };

    // Auto-save (debounced 1500ms) — only after initial data loaded
    useEffect(() => {
        if (!dataLoadedRef.current) return;
        if (!panels.length || !Object.keys(panelDesigns).length) return;
        setSaveStatus('กำลังบันทึก...');
        const timer = setTimeout(() => { handleSave(true); }, 1500);
        return () => clearTimeout(timer);
    }, [panelDesigns]);

    const updateDesign = (panelId, updates) => {
        setPanelDesigns(prev => ({
            ...prev,
            [panelId]: { ...prev[panelId], ...updates }
        }));
    };

    const updateElement = (panelId, elId, updates) => {
        setPanelDesigns(prev => {
            const d = { ...prev[panelId] };
            d.elements = d.elements.map(el => el.id === elId ? { ...el, ...updates } : el);
            return { ...prev, [panelId]: d };
        });
    };

    const addElement = (type) => {
        if (!activePanel) return;
        const id = `el_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const cx = canvasW / 2, cy = canvasH / 2;
        let el;
        if (type === 'text') {
            el = { id, type: 'text', x: cx - 80, y: cy - 16, w: 160, h: 32, rotation: 0, data: 'ข้อความ', fontSize: 24, fill: '#222', fontFamily: brandAssets?.font || "'Sarabun', sans-serif" };
        } else if (type === 'rect') {
            el = { id, type: 'shape', x: cx - 60, y: cy - 40, w: 120, h: 80, rotation: 0, fill: brandAssets?.colors?.[2] || '#cccccc' };
        } else if (type === 'circle') {
            el = { id, type: 'circle', x: cx, y: cy, radius: 40, fill: brandAssets?.colors?.[2] || '#cccccc' };
        } else if (type === 'barcode') {
            const val = labelData?.barcode_value || '8850000000000';
            el = { id, type: 'barcode', x: cx - 80, y: cy - 25, w: 160, h: 50, rotation: 0, barcodeValue: val, barcodeFormat: 'EAN13' };
        } else if (type === 'qrcode') {
            const val = labelData?.qr_code_value || 'https://example.com';
            el = { id, type: 'qrcode', x: cx - 40, y: cy - 40, w: 80, h: 80, rotation: 0, qrValue: val };
        } else if (type === 'image') {
            return; // handled by file upload
        } else if (type === 'logo' || type === 'label_logo') {
            if (!brandAssets?.logoUrl) return;
            // Load logo to get real aspect ratio
            const logoImg = new window.Image();
            logoImg.crossOrigin = 'anonymous';
            logoImg.src = brandAssets.logoUrl;
            logoImg.onload = () => {
                const ratio = logoImg.naturalWidth / logoImg.naturalHeight;
                const maxSize = canvasW * 0.25;
                let w, h;
                if (ratio >= 1) { w = maxSize; h = w / ratio; }
                else { h = maxSize; w = h * ratio; }
                const logoEl = { id, type: 'image', x: cx - w / 2, y: type === 'label_logo' ? 20 : cy - h / 2, w, h, rotation: 0, src: brandAssets.logoUrl };
                setPanelDesigns(prev => {
                    const d = { ...prev[activePanel.id] };
                    d.elements = [...d.elements, logoEl];
                    return { ...prev, [activePanel.id]: d };
                });
                setSelectedElId(id);
            };
            return; // async — don't fall through to sync el
        } else if (type === 'label_import') {
            const imgUrl = labelImageUrl || (labelData?.final_label_url ? `${API}${labelData.final_label_url}` : null);
            if (!imgUrl) return alert('ยังไม่มีฉลากที่ออกแบบไว้');
            // Load label image to get real aspect ratio
            const lblImg = new window.Image();
            lblImg.crossOrigin = 'anonymous';
            lblImg.src = imgUrl;
            lblImg.onload = () => {
                const ratio = lblImg.naturalWidth / lblImg.naturalHeight;
                const maxW = canvasW * 0.7, maxH = canvasH * 0.7;
                let w, h;
                if (ratio >= 1) { w = maxW; h = w / ratio; }
                else { h = maxH; w = h * ratio; }
                if (h > maxH) { h = maxH; w = h * ratio; }
                if (w > maxW) { w = maxW; h = w / ratio; }
                const lblEl = { id, type: 'image', x: (canvasW - w) / 2, y: (canvasH - h) / 2, w, h, rotation: 0, src: imgUrl };
                setPanelDesigns(prev => {
                    const d = { ...prev[activePanel.id] };
                    d.elements = [...d.elements, lblEl];
                    return { ...prev, [activePanel.id]: d };
                });
                setSelectedElId(id);
            };
            return; // async
        } else if (type?.startsWith('label_text_')) {
            const field = type.replace('label_text_', '');
            const textMap = {
                product_name: { data: labelData?.product_name, fontSize: 32, fill: brandAssets?.colors?.[1] || '#222' },
                tagline: { data: labelData?.tagline, fontSize: 18, fill: brandAssets?.colors?.[2] || '#d3542b' },
                net_weight: { data: labelData?.net_weight, fontSize: 14, fill: brandAssets?.colors?.[3] || '#666' },
                ingredients: { data: labelData?.ingredients ? `ส่วนประกอบ: ${labelData.ingredients}` : null, fontSize: 11, fill: '#333' },
                usage: { data: labelData?.usage_instruction, fontSize: 11, fill: '#333' },
                storage: { data: labelData?.storage_instruction, fontSize: 11, fill: '#333' },
                warnings: { data: labelData?.warnings, fontSize: 11, fill: '#cc0000' },
                fda: { data: labelData?.fda_number ? `เลข อย. ${labelData.fda_number}` : null, fontSize: 11, fill: '#333' },
                dates: { data: (labelData?.mfg_date || labelData?.exp_date) ? `MFG: ${labelData.mfg_date || '-'} / EXP: ${labelData.exp_date || '-'}` : null, fontSize: 10, fill: '#666' },
                lot: { data: labelData?.lot_number ? `LOT: ${labelData.lot_number}` : null, fontSize: 10, fill: '#666' },
                manufacturer: { data: (() => {
                    const m = labelData?.manufacturer_info;
                    if (!m) return null;
                    const info = typeof m === 'string' ? JSON.parse(m) : m;
                    return [info.name, info.address, info.phone].filter(Boolean).join('\n');
                })(), fontSize: 11, fill: '#333' },
            };
            const t = textMap[field];
            if (!t?.data) return;
            const w = Math.min(canvasW * 0.8, 400);
            el = { id, type: 'text', x: (canvasW - w) / 2, y: canvasH * 0.3 + Math.random() * 60, w, h: 40, rotation: 0, data: t.data, fontSize: t.fontSize, fill: t.fill, fontFamily: brandAssets?.font || "'Sarabun', sans-serif" };
        } else if (type === 'label_certs') {
            if (!labelData?.certifications?.length) return;
            const certs = Array.isArray(labelData.certifications) ? labelData.certifications : JSON.parse(labelData.certifications || '[]');
            if (certs.length === 0) return;
            el = { id, type: 'text', x: canvasW * 0.1, y: canvasH * 0.85, w: canvasW * 0.8, h: 30, rotation: 0, data: certs.join('  •  '), fontSize: 11, fill: '#fff', fontFamily: brandAssets?.font || "'Sarabun', sans-serif" };
        }
        if (el) {
            setPanelDesigns(prev => {
                const d = { ...prev[activePanel.id] };
                d.elements = [...d.elements, el];
                return { ...prev, [activePanel.id]: d };
            });
            setSelectedElId(id);
        }
    };

    const deleteElement = (elId) => {
        if (!activePanel) return;
        setPanelDesigns(prev => {
            const d = { ...prev[activePanel.id] };
            d.elements = d.elements.filter(el => el.id !== elId);
            return { ...prev, [activePanel.id]: d };
        });
        setSelectedElId(null);
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !activePanel) return;
        const fd = new FormData();
        fd.append('pattern_image', file);
        fd.append('user_id', userId);
        try {
            const r = await fetch(`${API}/api/mockup/upload-pattern`, { method: 'POST', body: fd });
            const d = await r.json();
            const imgPath = d.data?.image_url || d.image_url;
            if (d.status === 'success' && imgPath) {
                const imgUrl = `${API}${imgPath}`;
                // Load image to get real dimensions
                const tempImg = new window.Image();
                tempImg.crossOrigin = 'anonymous';
                tempImg.src = imgUrl;
                tempImg.onload = () => {
                    const id = `el_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                    const ratio = tempImg.naturalWidth / tempImg.naturalHeight;
                    const maxW = canvasW * 0.6, maxH = canvasH * 0.6;
                    let w, h;
                    if (ratio >= 1) { w = Math.min(tempImg.naturalWidth, maxW); h = w / ratio; }
                    else { h = Math.min(tempImg.naturalHeight, maxH); w = h * ratio; }
                    if (h > maxH) { h = maxH; w = h * ratio; }
                    if (w > maxW) { w = maxW; h = w / ratio; }
                    setPanelDesigns(prev => {
                        const dd = { ...prev[activePanel.id] };
                        dd.elements = [...dd.elements, { id, type: 'image', x: (canvasW - w) / 2, y: (canvasH - h) / 2, w, h, rotation: 0, src: imgUrl }];
                        return { ...prev, [activePanel.id]: dd };
                    });
                    setSelectedElId(id);
                };
            }
        } catch (err) { console.error('Upload error:', err); }
        e.target.value = '';
    };

    const handleBgImageUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !activePanel) return;
        const fd = new FormData();
        fd.append('pattern_image', file);
        fd.append('user_id', userId);
        try {
            const r = await fetch(`${API}/api/mockup/upload-pattern`, { method: 'POST', body: fd });
            const d = await r.json();
            const imgPath = d.data?.image_url || d.image_url;
            if (d.status === 'success' && imgPath) {
                updateDesign(activePanel.id, { bg_mode: 'upload', bg_image_url: `${API}${imgPath}` });
            }
        } catch (err) { console.error('BG upload error:', err); }
        e.target.value = '';
    };

    // AI Background Generation
    const generateAiBg = async () => {
        if (!aiPrompt.trim() || !materialData) return;
        setIsAiGenerating(true);
        try {
            const r = await fetch(`${API}/api/mockup/generate-dieline-bg`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_id: projectId,
                    user_id: userId,
                    user_prompt: aiPrompt,
                    dieline_width_mm: materialData.dieline_width_mm,
                    dieline_height_mm: materialData.dieline_height_mm,
                    panels_json: panels,
                    package_type: materialData.package_type,
                    product_name: labelData?.product_name || product.name_product
                })
            });
            const d = await r.json();
            if (d.status === 'success') {
                const fullUrl = `${API}${d.data.image_url}`;
                setAiDielineBgUrl(d.data.image_url);
                loadAiDielineImage(fullUrl);
                panels.forEach(p => {
                    updateDesign(p.id, { bg_mode: 'dalle', bg_image_url: fullUrl });
                });
                fetchAiBgHistory();
            } else {
                alert('AI สร้างไม่สำเร็จ: ' + (d.message || 'ลองใหม่อีกครั้ง'));
            }
        } catch (err) {
            console.error('AI BG error:', err);
            alert('เกิดข้อผิดพลาด: ' + err.message);
        } finally {
            setIsAiGenerating(false);
        }
    };

    // Save
    const handleSave = async (isAutoSave = false) => {
        if (!isAutoSave) setIsSaving(true);
        if (!isAutoSave) setSaveMsg('');
        try {
            const panelsPayload = panels.map(p => {
                const d = panelDesigns[p.id] || {};
                return {
                    panel_key: p.id,
                    bg_mode: d.bg_mode || 'solid',
                    bg_color: d.bg_color || '#FFFFFF',
                    bg_image_url: d.bg_image_url?.replace(API, '') || null,
                    bg_opacity: d.bg_opacity ?? 1,
                    elements_json: d.elements || []
                };
            });
            const body = {
                project_id: projectId,
                product_id: product.product_id,
                package_material_id: product.materials?.[0]?.id,
                label_id: labelData?.label_id || null,
                bleed_mm: materialData?.bleed_mm || 3,
                resolution_dpi: 300,
                design_mode: 'package_design',
                ai_dieline_bg_url: aiDielineBgUrl || null,
                ai_bg_prompt: aiPrompt || null,
                panels: panelsPayload
            };
            const r = await fetch(`${API}/api/mockups`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const d = await r.json();
            if (d.status === 'success') {
                setSavedMockupId(d.mockup_id);
                if (isAutoSave) {
                    setSaveStatus('บันทึกแล้ว');
                    setTimeout(() => setSaveStatus(''), 2000);
                } else {
                    setSaveMsg('บันทึกสำเร็จ');
                    setTimeout(() => setSaveMsg(''), 3000);
                }
            }
        } catch (err) {
            console.error('Save error:', err);
            if (isAutoSave) {
                setSaveStatus('บันทึกไม่สำเร็จ');
                setTimeout(() => setSaveStatus(''), 3000);
            } else {
                setSaveMsg('บันทึกไม่สำเร็จ');
            }
        } finally { if (!isAutoSave) setIsSaving(false); }
    };

    // Export PNG (full die-line)
    const handleExportPng = () => {
        if (!materialData || panels.length === 0) return;
        setIsExporting(true);

        const dW = parseFloat(materialData.dieline_width_mm);
        const dH = parseFloat(materialData.dieline_height_mm);
        const scale = 3;
        const offscreen = document.createElement('canvas');
        offscreen.width = dW * scale;
        offscreen.height = dH * scale;
        const ctx = offscreen.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, offscreen.width, offscreen.height);

        const stageNode = stageRef.current;
        if (!stageNode) { setIsExporting(false); return; }

        const origIdx = activePanelIdx;
        let rendered = 0;
        const totalPanels = panels.length;

        const renderNext = (idx) => {
            if (idx >= totalPanels) {
                // Draw fold lines
                ctx.strokeStyle = '#ff0000';
                ctx.setLineDash([6, 4]);
                ctx.lineWidth = 1;
                for (let i = 0; i < panels.length; i++) {
                    for (let j = i + 1; j < panels.length; j++) {
                        const a = panels[i], b = panels[j];
                        if (Math.abs((a.x_mm + a.w_mm) - b.x_mm) < 0.5) {
                            const x = (a.x_mm + a.w_mm) * scale;
                            const y1 = Math.max(a.y_mm, b.y_mm) * scale;
                            const y2 = Math.min(a.y_mm + a.h_mm, b.y_mm + b.h_mm) * scale;
                            ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke();
                        }
                        if (Math.abs((a.y_mm + a.h_mm) - b.y_mm) < 0.5) {
                            const y = (a.y_mm + a.h_mm) * scale;
                            const x1 = Math.max(a.x_mm, b.x_mm) * scale;
                            const x2 = Math.min(a.x_mm + a.w_mm, b.x_mm + b.w_mm) * scale;
                            ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
                        }
                    }
                }
                // Draw panel labels
                ctx.setLineDash([]);
                ctx.strokeStyle = '#999';
                ctx.lineWidth = 0.5;
                panels.forEach(p => {
                    ctx.strokeRect(p.x_mm * scale, p.y_mm * scale, p.w_mm * scale, p.h_mm * scale);
                });

                const link = document.createElement('a');
                link.href = offscreen.toDataURL('image/png');
                link.download = `package_design_${product.name_product || 'design'}.png`;
                link.click();
                setActivePanelIdx(origIdx);
                setIsExporting(false);
                return;
            }

            setActivePanelIdx(idx);
            setTimeout(() => {
                const panelStage = stageRef.current;
                if (panelStage) {
                    const dataUrl = panelStage.toDataURL({ pixelRatio: 2 });
                    const img = new window.Image();
                    img.onload = () => {
                        const p = panels[idx];
                        ctx.drawImage(img, p.x_mm * scale, p.y_mm * scale, p.w_mm * scale, p.h_mm * scale);
                        renderNext(idx + 1);
                    };
                    img.src = dataUrl;
                } else {
                    renderNext(idx + 1);
                }
            }, 100);
        };
        renderNext(0);
    };

    // Export helper — captures all panels and sends to API
    const exportFile = async (format = 'pdf') => {
        if (!savedMockupId) {
            await handleSave();
        }
        const mid = savedMockupId;
        if (!mid) { alert('กรุณาบันทึกก่อน export'); return; }
        setIsExporting(true);

        try {
            const panelImages = [];
            const origIdx = activePanelIdx;

            for (let i = 0; i < panels.length; i++) {
                setActivePanelIdx(i);
                await new Promise(r => setTimeout(r, 200));
                const s = stageRef.current;
                if (s) {
                    // Use JPEG (much smaller than PNG) at high DPI
                    const dataUrl = s.toDataURL({ pixelRatio: 3, mimeType: 'image/jpeg', quality: 0.92 });
                    panelImages.push({ panel_key: panels[i].id, image_data: dataUrl });
                }
            }
            setActivePanelIdx(origIdx);

            const r = await fetch(`${API}/api/mockups/${mid}/export-pdf`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    format,
                    panel_images: panelImages,
                    spec_data: {
                        project_name: projectName,
                        colors_used: brandAssets?.colors || []
                    }
                })
            });

            if (!r.ok) {
                const errData = await r.json().catch(() => ({}));
                throw new Error(errData.message || 'Export failed');
            }

            // Download file directly from response blob
            const blob = await r.blob();
            const ext = format === 'ai' ? 'ai' : 'pdf';
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `package_design_${product.name_product || 'design'}_CMYK.${ext}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        } catch (err) {
            console.error(`Export ${format} error:`, err);
            alert(`Export ${format.toUpperCase()} ไม่สำเร็จ: ${err.message}`);
        } finally { setIsExporting(false); }
    };

    const handleExportPdf = () => exportFile('pdf');
    const handleExportAi = () => exportFile('ai');

    // === Generate AI Mockup Preview ===
    const handleGenMockup = async () => {
        if (!materialData || panels.length === 0) return;
        const selectedPanels = panels.filter(p => mockupPanelSelection[p.id]);
        if (selectedPanels.length === 0) { alert('กรุณาเลือกอย่างน้อย 1 ด้าน'); return; }

        setIsGenMockup(true);
        setMockupProgress({ step: 0, total: 4, message: 'กำลังเตรียมภาพแต่ละด้าน...' });
        setAiMockupPreviewUrl(null);

        try {
            const origIdx = activePanelIdx;
            const panelImages = [];

            // 1. Capture only selected panels as individual images
            for (const sp of selectedPanels) {
                const idx = panels.findIndex(p => p.id === sp.id);
                if (idx < 0) continue;
                setActivePanelIdx(idx);
                await new Promise(r => setTimeout(r, 250));
                const s = stageRef.current;
                if (s) {
                    const dataUrl = s.toDataURL({ pixelRatio: 2 });
                    panelImages.push({
                        label: sp.label,
                        image_base64: dataUrl,
                        w_mm: sp.w_mm,
                        h_mm: sp.h_mm
                    });
                }
            }
            setActivePanelIdx(origIdx);

            // 2. Get package image URL
            const matId = product.materials?.[0]?.id;
            let packageImageUrl = null;
            if (matId) {
                try {
                    const r = await fetch(`${API}/api/mockup/material/${matId}`);
                    const d = await r.json();
                    if (d.status === 'success' && d.data.images?.length > 0) {
                        packageImageUrl = d.data.images[0].image_path;
                    }
                } catch (e) { console.warn(e); }
            }

            setMockupProgress({ step: 1, total: 4, message: 'กำลังส่งให้ AI สร้างภาพ...' });

            // 3. Send to backend via SSE
            const resp = await fetch(`${API}/api/mockup/generate-package-mockup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_id: projectId,
                    user_id: userId,
                    product_id: product.product_id,
                    package_image_url: packageImageUrl,
                    panel_images: panelImages,
                    package_type: product.materials?.[0]?.package_type || product.materials?.[0]?.name,
                    package_material: product.materials?.[0]?.material_type,
                    product_name: product.name_product,
                    bg_style: mockupBgStyle
                })
            });

            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                const messages = buffer.split('\n\n');
                buffer = messages.pop() || '';

                for (const msg of messages) {
                    let eventType = '';
                    let eventData = '';
                    for (const line of msg.split('\n')) {
                        if (line.startsWith('event: ')) eventType = line.slice(7);
                        else if (line.startsWith('data: ')) eventData = line.slice(6);
                    }
                    if (!eventData) continue;
                    try {
                        const data = JSON.parse(eventData);
                        if (eventType === 'progress') setMockupProgress(data);
                        else if (eventType === 'done' && data.image_url) {
                            setAiMockupPreviewUrl(`${API}${data.image_url}`);
                            fetchMockupHistory(); // refresh history
                        }
                        else if (eventType === 'error') throw new Error(data.message);
                    } catch (e) {
                        if (e.message && !e.message.includes('JSON')) throw e;
                    }
                }
            }
        } catch (err) {
            console.error('Gen mockup error:', err);
            alert(`สร้าง Mockup ไม่สำเร็จ: ${err.message}`);
        } finally {
            setIsGenMockup(false);
            setMockupProgress(null);
        }
    };

    const toggleSection = (key) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

    const selectedEl = currentDesign?.elements?.find(el => el.id === selectedElId);

    // -- Deselect on stage click empty area --
    const handleStageClick = (e) => {
        if (e.target === e.target.getStage() || e.target.name?.() === 'bg') {
            setSelectedElId(null);
            trRef.current?.nodes([]);
        }
    };

    useEffect(() => {
        if (!trRef.current) return;
        const stage = stageRef.current;
        if (!stage || !selectedElId) { trRef.current.nodes([]); return; }
        const node = stage.findOne('#' + selectedElId);
        if (node) { trRef.current.nodes([node]); trRef.current.getLayer().batchDraw(); }
        else { trRef.current.nodes([]); }
    }, [selectedElId, activePanelIdx, currentDesign?.elements]);

    if (!materialData || panels.length === 0) {
        return (
            <div style={{ padding: 60, textAlign: 'center', color: C.sub }}>
                <iconify-icon icon="mdi:loading" style={{ fontSize: 32, animation: 'spin 1s linear infinite' }}></iconify-icon>
                <div style={{ marginTop: 12 }}>กำลังโหลดข้อมูลบรรจุภัณฑ์...</div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', height: 'calc(100vh - 80px - 61px)', overflow: 'hidden' }}>
            {/* === SIDEBAR === */}
            <div style={{ width: 320, minWidth: 320, borderRight: `1px solid ${C.border}`, overflowY: 'auto', background: '#fff', padding: 16 }}>
                <button onClick={onBack} style={{ background: 'none', border: 'none', color: C.sub, cursor: 'pointer', marginBottom: 12, fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}>
                    <iconify-icon icon="mdi:chevron-left"></iconify-icon> กลับ
                </button>
                <h3 style={{ margin: '0 0 4px', fontSize: 16, color: C.primaryDark }}>ออกแบบบรรจุภัณฑ์</h3>
                <p style={{ margin: '0 0 16px', fontSize: 12, color: C.sub }}>{product.name_product} — {materialData.name}</p>

                {/* Panel Selector */}
                <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>เลือกด้าน</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {panels.map((p, idx) => (
                            <button key={p.id} onClick={() => { setActivePanelIdx(idx); setSelectedElId(null); }}
                                style={{
                                    padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                    border: idx === activePanelIdx ? `2px solid #2563eb` : `1px solid ${C.border}`,
                                    background: idx === activePanelIdx ? '#eff6ff' : '#fff',
                                    color: idx === activePanelIdx ? '#2563eb' : C.text
                                }}>
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* === Background Section === */}
                <SidebarSection title={<><iconify-icon icon="mdi:palette" style={{verticalAlign:'middle'}}></iconify-icon> Background</>} open={openSections.bg} onToggle={() => toggleSection('bg')}>
                    {/* AI Background */}
                    <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#2563eb', marginBottom: 6 }}>AI สร้างลวดลาย (ทุกด้านพร้อมกัน)</div>
                        <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
                            placeholder="เช่น: ลายใบไม้ tropical สีเขียวอ่อน พื้นครีม สไตล์ organic"
                            style={{ width: '100%', height: 56, border: `1px solid ${C.border}`, borderRadius: 8, padding: 8, fontSize: 12, resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                        <button onClick={generateAiBg} disabled={isAiGenerating || !aiPrompt.trim()}
                            style={{ marginTop: 6, width: '100%', padding: '8px 0', background: isAiGenerating ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: isAiGenerating ? 'wait' : 'pointer' }}>
                            {isAiGenerating ? <><iconify-icon icon="mdi:loading" style={{verticalAlign:'middle'}} class="spin"></iconify-icon> กำลังสร้าง...</> : <><iconify-icon icon="mdi:auto-fix" style={{verticalAlign:'middle'}}></iconify-icon> สร้างลวดลาย AI</>}
                        </button>
                    </div>

                    {/* AI BG History */}
                    {aiBgHistory.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: C.sub, marginBottom: 6 }}>ประวัติ AI ({aiBgHistory.length})</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxHeight: 120, overflowY: 'auto' }}>
                                {aiBgHistory.map(h => (
                                    <div key={h.history_id}
                                        onClick={() => {
                                            const fullUrl = `${API}${h.image_url}`;
                                            setAiDielineBgUrl(h.image_url);
                                            loadAiDielineImage(fullUrl);
                                            if (h.prompt) setAiPrompt(h.prompt);
                                            panels.forEach(p => { updateDesign(p.id, { bg_mode: 'dalle', bg_image_url: fullUrl }); });
                                        }}
                                        title={h.prompt || ''}
                                        style={{
                                            width: 52, height: 52, borderRadius: 6, overflow: 'hidden', cursor: 'pointer',
                                            border: aiDielineBgUrl === h.image_url ? '2px solid #2563eb' : `1px solid ${C.border}`,
                                            flexShrink: 0
                                        }}>
                                        <img src={`${API}${h.image_url}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, marginBottom: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: C.sub, marginBottom: 6 }}>Manual (ด้านนี้เท่านั้น)</div>
                    </div>

                    {/* Solid Color */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <input type="color" value={currentDesign?.bg_color || '#FFFFFF'}
                            onChange={e => activePanel && updateDesign(activePanel.id, { bg_mode: 'solid', bg_color: e.target.value })}
                            style={{ width: 32, height: 32, border: 'none', cursor: 'pointer', borderRadius: 6 }} />
                        <input type="text" value={currentDesign?.bg_color || '#FFFFFF'}
                            onChange={e => activePanel && updateDesign(activePanel.id, { bg_mode: 'solid', bg_color: e.target.value })}
                            style={{ flex: 1, border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 8px', fontSize: 12 }} />
                    </div>

                    {/* Brand color swatches */}
                    {brandAssets?.colors?.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                            {brandAssets.colors.map(c => (
                                <button key={c} onClick={() => activePanel && updateDesign(activePanel.id, { bg_mode: 'solid', bg_color: c })}
                                    style={{ width: 24, height: 24, borderRadius: 6, border: '2px solid #fff', boxShadow: '0 0 0 1px #ccc', background: c, cursor: 'pointer', padding: 0 }} />
                            ))}
                        </div>
                    )}

                    {/* Upload BG image */}
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 11, cursor: 'pointer', color: C.text, marginBottom: 8 }}>
                        <iconify-icon icon="mdi:image-plus"></iconify-icon> อัพโหลดรูป Background
                        <input type="file" accept="image/*" onChange={handleBgImageUpload} style={{ display: 'none' }} />
                    </label>

                    {/* Opacity */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: C.sub }}>ความโปร่งใส</span>
                        <input type="range" min="0" max="1" step="0.05" value={currentDesign?.bg_opacity ?? 1}
                            onChange={e => activePanel && updateDesign(activePanel.id, { bg_opacity: parseFloat(e.target.value) })}
                            style={{ flex: 1 }} />
                    </div>
                </SidebarSection>

                {/* === Text Section === */}
                <SidebarSection title={<><iconify-icon icon="mdi:format-text" style={{verticalAlign:'middle'}}></iconify-icon> ข้อความ</>} open={openSections.text} onToggle={() => toggleSection('text')}>
                    <button onClick={() => addElement('text')}
                        style={{ width: '100%', padding: '8px 0', background: '#f0fdf4', border: `1px solid #86efac`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#166534', marginBottom: 8 }}>
                        + เพิ่มข้อความ
                    </button>
                    {selectedEl?.type === 'text' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <input type="text" value={selectedEl.data} onChange={e => updateElement(activePanel.id, selectedEl.id, { data: e.target.value })}
                                style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 8px', fontSize: 12 }} />
                            <div style={{ display: 'flex', gap: 6 }}>
                                <input type="number" value={selectedEl.fontSize} onChange={e => updateElement(activePanel.id, selectedEl.id, { fontSize: parseInt(e.target.value) || 16 })}
                                    style={{ width: 60, border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 6px', fontSize: 11 }} />
                                <input type="color" value={selectedEl.fill || '#222'} onChange={e => updateElement(activePanel.id, selectedEl.id, { fill: e.target.value })}
                                    style={{ width: 32, height: 28, border: 'none', cursor: 'pointer' }} />
                            </div>
                        </div>
                    )}
                </SidebarSection>

                {/* === Image Section === */}
                <SidebarSection title={<><iconify-icon icon="mdi:image-outline" style={{verticalAlign:'middle'}}></iconify-icon> รูปภาพ / โลโก้</>} open={openSections.image} onToggle={() => toggleSection('image')}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 11, cursor: 'pointer', color: C.text }}>
                            <iconify-icon icon="mdi:image-plus"></iconify-icon> อัพโหลดรูป
                            <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                        </label>
                        {brandAssets?.logoUrl && (
                            <button onClick={() => addElement('logo')}
                                style={{ padding: '6px 10px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 11, cursor: 'pointer', background: '#fff', color: C.text, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <iconify-icon icon="mdi:crown"></iconify-icon> ใส่โลโก้แบรนด์
                            </button>
                        )}
                    </div>
                </SidebarSection>

                {/* === Shape Section === */}
                <SidebarSection title={<><iconify-icon icon="mdi:shape-outline" style={{verticalAlign:'middle'}}></iconify-icon> รูปทรง</>} open={openSections.shape} onToggle={() => toggleSection('shape')}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button onClick={() => addElement('rect')}
                            style={{ padding: '6px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 11, cursor: 'pointer', background: '#fff' }}>
                            <iconify-icon icon="mdi:square-outline" style={{verticalAlign:'middle'}}></iconify-icon> สี่เหลี่ยม
                        </button>
                        <button onClick={() => addElement('circle')}
                            style={{ padding: '6px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 11, cursor: 'pointer', background: '#fff' }}>
                            <iconify-icon icon="mdi:circle-outline" style={{verticalAlign:'middle'}}></iconify-icon> วงกลม
                        </button>
                    </div>
                    {selectedEl && (selectedEl.type === 'shape' || selectedEl.type === 'circle') && (
                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11, color: C.sub }}>สี:</span>
                            <input type="color" value={selectedEl.fill || '#cccccc'} onChange={e => updateElement(activePanel.id, selectedEl.id, { fill: e.target.value })}
                                style={{ width: 32, height: 28, border: 'none', cursor: 'pointer' }} />
                        </div>
                    )}
                </SidebarSection>

                {/* === Import Label === */}
                <SidebarSection title={<><iconify-icon icon="mdi:clipboard-text-outline" style={{verticalAlign:'middle'}}></iconify-icon> Import จากฉลาก</>} open={openSections.label} onToggle={() => toggleSection('label')}>
                    {!labelData ? (
                        <div style={{ fontSize: 12, color: C.sub, textAlign: 'center', padding: 8 }}>ยังไม่มีฉลากที่ออกแบบไว้</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#92400e', marginBottom: 2 }}>วางฉลากทั้งชิ้น</div>
                            <LabelPartBtn icon="mdi:label-outline" label="ฉลากเต็ม (รูปภาพ)" available={!!(labelImageUrl || labelData?.final_label_url)} onClick={() => addElement('label_import')} />

                            <div style={{ fontSize: 11, fontWeight: 600, color: '#92400e', marginTop: 8, marginBottom: 2 }}>ข้อมูลสินค้า</div>
                            <LabelPartBtn icon="mdi:tag-text-outline" label="ชื่อสินค้า" detail={labelData?.product_name} available={!!labelData?.product_name} onClick={() => addElement('label_text_product_name')} />
                            <LabelPartBtn icon="mdi:star-four-points-outline" label="Tagline" detail={labelData?.tagline} available={!!labelData?.tagline} onClick={() => addElement('label_text_tagline')} />
                            <LabelPartBtn icon="mdi:scale-balance" label="น้ำหนักสุทธิ" detail={labelData?.net_weight} available={!!labelData?.net_weight} onClick={() => addElement('label_text_net_weight')} />
                            <LabelPartBtn icon="mdi:text-box-outline" label="ส่วนประกอบ" available={!!labelData?.ingredients} onClick={() => addElement('label_text_ingredients')} />

                            <div style={{ fontSize: 11, fontWeight: 600, color: '#92400e', marginTop: 8, marginBottom: 2 }}>คำแนะนำ / คำเตือน</div>
                            <LabelPartBtn icon="mdi:book-open-variant" label="วิธีใช้" available={!!labelData?.usage_instruction} onClick={() => addElement('label_text_usage')} />
                            <LabelPartBtn icon="mdi:home-outline" label="วิธีเก็บรักษา" available={!!labelData?.storage_instruction} onClick={() => addElement('label_text_storage')} />
                            <LabelPartBtn icon="mdi:alert-outline" label="คำเตือน" available={!!labelData?.warnings} onClick={() => addElement('label_text_warnings')} />

                            <div style={{ fontSize: 11, fontWeight: 600, color: '#92400e', marginTop: 8, marginBottom: 2 }}>ข้อมูลทางกฎหมาย</div>
                            <LabelPartBtn icon="mdi:factory" label="ผู้ผลิต" available={!!labelData?.manufacturer_info} onClick={() => addElement('label_text_manufacturer')} />
                            <LabelPartBtn icon="mdi:bookmark-outline" label="เลข อย." detail={labelData?.fda_number} available={!!labelData?.fda_number} onClick={() => addElement('label_text_fda')} />
                            <LabelPartBtn icon="mdi:calendar-outline" label="MFG / EXP" available={!!(labelData?.mfg_date || labelData?.exp_date)} onClick={() => addElement('label_text_dates')} />
                            <LabelPartBtn icon="mdi:pound" label="LOT" detail={labelData?.lot_number} available={!!labelData?.lot_number} onClick={() => addElement('label_text_lot')} />

                            <div style={{ fontSize: 11, fontWeight: 600, color: '#92400e', marginTop: 8, marginBottom: 2 }}>โลโก้ / เครื่องหมาย</div>
                            <LabelPartBtn icon="mdi:crown" label="โลโก้แบรนด์" available={!!brandAssets?.logoUrl} onClick={() => addElement('label_logo')} />
                            <LabelPartBtn icon="mdi:medal-outline" label="Certifications" detail={(() => { try { const c = Array.isArray(labelData?.certifications) ? labelData.certifications : JSON.parse(labelData?.certifications || '[]'); return c.join(', '); } catch { return ''; } })()} available={!!labelData?.certifications} onClick={() => addElement('label_certs')} />

                            <div style={{ fontSize: 11, fontWeight: 600, color: '#92400e', marginTop: 8, marginBottom: 2 }}>Barcode / QR Code</div>
                            <LabelPartBtn icon="mdi:barcode" label="Barcode (EAN-13)" detail={labelData?.barcode_value} available={true} onClick={() => addElement('barcode')} />
                            <LabelPartBtn icon="mdi:qrcode" label="QR Code" detail={labelData?.qr_code_value} available={true} onClick={() => addElement('qrcode')} />
                        </div>
                    )}
                </SidebarSection>

                {/* === Selected Element Controls === */}
                {selectedEl && (
                    <div style={{ marginTop: 12, padding: 10, background: '#fef2f2', borderRadius: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#991b1b' }}>
                                {selectedEl.type === 'text' ? 'ข้อความ' : selectedEl.type === 'image' ? 'รูปภาพ' : selectedEl.type === 'barcode' ? 'Barcode (EAN-13)' : selectedEl.type === 'qrcode' ? 'QR Code' : 'รูปทรง'}
                            </span>
                            <button onClick={() => deleteElement(selectedEl.id)}
                                style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>
                                <iconify-icon icon="mdi:delete-outline" style={{verticalAlign:'middle'}}></iconify-icon> ลบ
                            </button>
                        </div>
                        {selectedEl.type === 'barcode' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <label style={{ fontSize: 10, color: C.sub }}>ตัวเลข EAN-13 (13 หลัก)</label>
                                <input type="text" maxLength={13} value={selectedEl.barcodeValue || ''} onChange={e => updateElement(activePanel.id, selectedEl.id, { barcodeValue: e.target.value })}
                                    placeholder="8850000000000"
                                    style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 8px', fontSize: 12 }} />
                            </div>
                        )}
                        {selectedEl.type === 'qrcode' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <label style={{ fontSize: 10, color: C.sub }}>ข้อมูล QR Code</label>
                                <input type="text" value={selectedEl.qrValue || ''} onChange={e => updateElement(activePanel.id, selectedEl.id, { qrValue: e.target.value })}
                                    placeholder="URL หรือข้อมูล"
                                    style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 8px', fontSize: 12 }} />
                            </div>
                        )}
                    </div>
                )}

                {/* === Save / Export Buttons === */}
                <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button onClick={handleSave} disabled={isSaving}
                        style={{ padding: '10px 0', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: isSaving ? 'wait' : 'pointer' }}>
                        {isSaving ? <><iconify-icon icon="mdi:content-save" style={{verticalAlign:'middle'}}></iconify-icon> กำลังบันทึก...</> : <><iconify-icon icon="mdi:content-save" style={{verticalAlign:'middle'}}></iconify-icon> บันทึก</>}
                    </button>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={handleExportPng} disabled={isExporting}
                            style={{ flex: 1, padding: '8px 0', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11, cursor: isExporting ? 'wait' : 'pointer', color: C.text }}>
                            <iconify-icon icon="mdi:image-outline" style={{verticalAlign:'middle'}}></iconify-icon> PNG
                        </button>
                        <button onClick={() => { if (!isProUser(getUserFromStorage())) { setShowProModal(true); return; } handleExportPdf(); }} disabled={isExporting}
                            style={{ flex: 1, padding: '8px 0', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11, cursor: isExporting ? 'wait' : 'pointer', color: isProUser(getUserFromStorage()) ? C.text : '#ccc' }}>
                            <iconify-icon icon="mdi:file-pdf-box" style={{verticalAlign:'middle'}}></iconify-icon> PDF
                            {!isProUser(getUserFromStorage()) && <iconify-icon icon="solar:lock-keyhole-linear" width="12" style={{verticalAlign:'middle', marginLeft: 2, color: '#d35325'}}></iconify-icon>}
                        </button>
                        <button onClick={() => { if (!isProUser(getUserFromStorage())) { setShowProModal(true); return; } handleExportAi(); }} disabled={isExporting}
                            style={{ flex: 1, padding: '8px 0', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11, cursor: isExporting ? 'wait' : 'pointer', color: isProUser(getUserFromStorage()) ? C.text : '#ccc' }}>
                            <iconify-icon icon="mdi:adobe" style={{verticalAlign:'middle'}}></iconify-icon> AI
                            {!isProUser(getUserFromStorage()) && <iconify-icon icon="solar:lock-keyhole-linear" width="12" style={{verticalAlign:'middle', marginLeft: 2, color: '#d35325'}}></iconify-icon>}
                        </button>
                    </div>
                    <div style={{ fontSize: 10, color: C.sub, textAlign: 'center' }}>PDF/AI = print-ready, crop marks, fold lines</div>
                    {saveMsg && <div style={{ fontSize: 12, color: '#16a34a', textAlign: 'center' }}>{saveMsg}</div>}
                    {saveStatus && !saveMsg && <div style={{ fontSize: 11, color: saveStatus.includes('ไม่') ? '#dc2626' : '#16a34a', textAlign: 'center' }}>{saveStatus}</div>}
                </div>

                {/* === AI Mockup Preview === */}
                <div style={{ marginTop: 16, padding: 12, background: '#fdf4ff', borderRadius: 10, border: '1px solid #e9d5ff' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <iconify-icon icon="mdi:cube-scan" style={{fontSize:16}}></iconify-icon>
                        AI สร้างภาพ Mockup สมบูรณ์
                    </div>
                    <div style={{ fontSize: 10, color: '#6b21a8', marginBottom: 8, lineHeight: 1.5 }}>
                        เลือกด้านที่จะแสดง แล้วให้ AI สร้างภาพ 3D Mockup สมจริง
                    </div>

                    {/* Panel selection checkboxes */}
                    <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 10, color: '#7c3aed', fontWeight: 600, marginBottom: 4 }}>เลือกด้านที่จะใช้:</div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {panels.map(p => (
                                <label key={p.id} style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer',
                                    border: mockupPanelSelection[p.id] ? '2px solid #7c3aed' : `1px solid ${C.border}`,
                                    background: mockupPanelSelection[p.id] ? '#ede9fe' : '#fff',
                                    color: mockupPanelSelection[p.id] ? '#7c3aed' : C.sub, fontWeight: mockupPanelSelection[p.id] ? 600 : 400
                                }}>
                                    <input type="checkbox" checked={!!mockupPanelSelection[p.id]}
                                        onChange={e => setMockupPanelSelection(prev => ({ ...prev, [p.id]: e.target.checked }))}
                                        style={{ width: 12, height: 12, accentColor: '#7c3aed' }} />
                                    {p.label}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Background style selector */}
                    <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 10, color: '#7c3aed', fontWeight: 600, marginBottom: 4 }}>พื้นหลัง:</div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {[
                                { key: 'white', label: 'ขาว', color: '#fff' },
                                { key: 'wood', label: 'ไม้', color: '#d4a574' },
                                { key: 'marble', label: 'หินอ่อน', color: '#e8e0d8' },
                                { key: 'nature', label: 'ธรรมชาติ', color: '#86efac' },
                                { key: 'gradient', label: 'สตูดิโอ', color: '#c4b5fd' },
                            ].map(bg => (
                                <button key={bg.key} onClick={() => setMockupBgStyle(bg.key)}
                                    style={{
                                        padding: '3px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer',
                                        border: mockupBgStyle === bg.key ? '2px solid #7c3aed' : `1px solid ${C.border}`,
                                        background: bg.color, color: '#333',
                                        fontWeight: mockupBgStyle === bg.key ? 700 : 400
                                    }}>
                                    {bg.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button onClick={handleGenMockup} disabled={isGenMockup || panels.length === 0}
                        style={{
                            width: '100%', padding: '10px 0', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: isGenMockup ? 'wait' : 'pointer',
                            background: isGenMockup ? '#c4b5fd' : 'linear-gradient(135deg, #7c3aed, #a855f7)',
                            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                        }}>
                        {isGenMockup ? (
                            <><iconify-icon icon="mdi:loading" class="spin" style={{verticalAlign:'middle'}}></iconify-icon> {mockupProgress?.message || 'กำลังสร้าง...'}</>
                        ) : (
                            <><iconify-icon icon="mdi:cube-scan" style={{verticalAlign:'middle'}}></iconify-icon> สร้างภาพ Mockup ({panels.filter(p => mockupPanelSelection[p.id]).length} ด้าน)</>
                        )}
                    </button>

                    {/* Progress */}
                    {isGenMockup && mockupProgress && (
                        <div style={{ marginTop: 6 }}>
                            <div style={{ height: 4, background: '#e9d5ff', borderRadius: 4, overflow: 'hidden' }}>
                                <div style={{ height: '100%', background: '#7c3aed', borderRadius: 4, width: `${(mockupProgress.step / mockupProgress.total) * 100}%`, transition: 'width 0.3s' }} />
                            </div>
                            <div style={{ fontSize: 10, color: '#7c3aed', marginTop: 3, textAlign: 'center' }}>
                                ขั้นตอน {mockupProgress.step}/{mockupProgress.total}
                            </div>
                        </div>
                    )}

                    {/* Result preview — click to open popup */}
                    {aiMockupPreviewUrl && (
                        <div style={{ marginTop: 8 }}>
                            <img src={aiMockupPreviewUrl} alt="AI Mockup"
                                onClick={() => setLightboxUrl(aiMockupPreviewUrl)}
                                style={{ width: '100%', borderRadius: 8, border: `1px solid ${C.border}`, cursor: 'pointer' }} />
                            <div style={{ fontSize: 9, color: '#7c3aed', textAlign: 'center', marginTop: 2 }}>คลิกเพื่อขยาย</div>
                        </div>
                    )}

                    {/* Mockup History */}
                    {mockupHistory.length > 0 && (
                        <div style={{ marginTop: 10 }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: '#7c3aed', marginBottom: 4 }}>ประวัติ Mockup ({mockupHistory.length})</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxHeight: 130, overflowY: 'auto' }}>
                                {mockupHistory.map(h => (
                                    <div key={h.history_id}
                                        onClick={() => setLightboxUrl(`${API}${h.image_url}`)}
                                        style={{
                                            width: 60, height: 60, borderRadius: 6, overflow: 'hidden', cursor: 'pointer',
                                            border: `1px solid ${C.border}`, flexShrink: 0,
                                            transition: 'transform 0.15s', position: 'relative'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
                                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                                        <img src={`${API}${h.image_url}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div style={{ fontSize: 9, color: '#a78bfa', marginTop: 6, textAlign: 'center' }}>ใช้ Gemini AI Credit</div>
                </div>
            </div>

            {/* === CANVAS AREA === */}
            <div style={{ flex: 1, background: C.bgPage, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 20, overflow: 'auto', position: 'relative' }}>
                {/* Panel info */}
                <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button onClick={() => { const prev = (activePanelIdx - 1 + panels.length) % panels.length; setActivePanelIdx(prev); setSelectedElId(null); }}
                        style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 14, display:'flex', alignItems:'center' }}><iconify-icon icon="mdi:chevron-left"></iconify-icon></button>
                    <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                        {activePanel?.label} ({activePanel?.w_mm} × {activePanel?.h_mm} mm)
                    </span>
                    <button onClick={() => { const next = (activePanelIdx + 1) % panels.length; setActivePanelIdx(next); setSelectedElId(null); }}
                        style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 14, display:'flex', alignItems:'center' }}><iconify-icon icon="mdi:chevron-right"></iconify-icon></button>
                </div>

                {/* Canvas + Mini Map side by side */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                    {/* Konva Stage */}
                    <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', padding: 2 }}>
                        <Stage ref={stageRef} width={canvasW} height={canvasH} onClick={handleStageClick}>
                            <Layer>
                                {/* Background */}
                                <PanelBackground design={currentDesign} width={canvasW} height={canvasH}
                                    panel={activePanel} panels={panels} materialData={materialData}
                                    aiDielineBgImg={aiDielineBgImg} />

                                {/* Elements */}
                                {currentDesign?.elements?.map(el => (
                                    <PanelElement key={el.id} el={el} isSelected={el.id === selectedElId}
                                        onSelect={() => setSelectedElId(el.id)}
                                        onChange={(updates) => updateElement(activePanel.id, el.id, updates)} />
                                ))}

                                <Transformer ref={trRef}
                                    boundBoxFunc={(oldB, newB) => newB.width < 10 ? oldB : newB}
                                    rotateEnabled={true} keepRatio={false} />
                            </Layer>
                        </Stage>
                    </div>

                    {/* Mini Map (right side) */}
                    <DielineMiniMap panels={panels} activePanelIdx={activePanelIdx} onClickPanel={idx => { setActivePanelIdx(idx); setSelectedElId(null); }}
                        materialData={materialData} panelDesigns={panelDesigns} aiDielineBgImg={aiDielineBgImg} />
                </div>
            </div>

            {/* === Lightbox Popup === */}
            {lightboxUrl && (
                <div onClick={() => setLightboxUrl(null)}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 9999,
                        background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                    }}>
                    <div onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
                        <img src={lightboxUrl} alt="Mockup Preview"
                            style={{ width: 1024, maxWidth: '90vw', maxHeight: '80vh', borderRadius: 12, boxShadow: '0 12px 48px rgba(0,0,0,0.5)', objectFit: 'contain', background: '#fff' }} />
                        <button onClick={() => setLightboxUrl(null)}
                            style={{
                                position: 'absolute', top: -12, right: -12, width: 32, height: 32, borderRadius: '50%',
                                background: '#fff', border: 'none', cursor: 'pointer', fontSize: 18,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                            }}>
                            <iconify-icon icon="mdi:close"></iconify-icon>
                        </button>
                    </div>
                    <div style={{ marginTop: 16, display: 'flex', gap: 12 }} onClick={e => e.stopPropagation()}>
                        <button onClick={async () => {
                            try {
                                const resp = await fetch(lightboxUrl);
                                const blob = await resp.blob();
                                const url = URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = `mockup_${product.name_product || 'design'}.png`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                URL.revokeObjectURL(url);
                            } catch (e) { console.error('Download error:', e); }
                        }}
                            style={{
                                padding: '10px 24px', background: '#7c3aed', color: '#fff', borderRadius: 8,
                                fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
                                display: 'flex', alignItems: 'center', gap: 6
                            }}>
                            <iconify-icon icon="mdi:download" style={{verticalAlign:'middle'}}></iconify-icon> ดาวน์โหลด
                        </button>
                        <button onClick={() => setLightboxUrl(null)}
                            style={{
                                padding: '10px 24px', background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)',
                                borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer'
                            }}>
                            ปิด
                        </button>
                    </div>
                </div>
            )}

            <ProUpgradeModal isOpen={showProModal} onClose={() => setShowProModal(false)} feature="download" />
        </div>
    );
}

// === Panel Background Renderer ===
function PanelBackground({ design, width, height, panel, panels, materialData, aiDielineBgImg }) {
    const [bgImg, setBgImg] = useState(null);

    useEffect(() => {
        if (design?.bg_mode === 'dalle' && aiDielineBgImg && panel && materialData) {
            // Crop the AI die-line image for this panel
            const dW = parseFloat(materialData.dieline_width_mm);
            const dH = parseFloat(materialData.dieline_height_mm);
            const imgW = aiDielineBgImg.naturalWidth || aiDielineBgImg.width;
            const imgH = aiDielineBgImg.naturalHeight || aiDielineBgImg.height;
            const scaleX = imgW / dW;
            const scaleY = imgH / dH;

            const offscreen = document.createElement('canvas');
            offscreen.width = Math.round(panel.w_mm * scaleX);
            offscreen.height = Math.round(panel.h_mm * scaleY);
            const ctx = offscreen.getContext('2d');
            ctx.drawImage(aiDielineBgImg,
                panel.x_mm * scaleX, panel.y_mm * scaleY,
                panel.w_mm * scaleX, panel.h_mm * scaleY,
                0, 0, offscreen.width, offscreen.height);
            const cropImg = new window.Image();
            cropImg.src = offscreen.toDataURL();
            cropImg.onload = () => setBgImg(cropImg);
        } else if (design?.bg_mode === 'upload' && design?.bg_image_url) {
            const img = new window.Image();
            img.crossOrigin = 'anonymous';
            img.src = design.bg_image_url;
            img.onload = () => setBgImg(img);
            img.onerror = () => setBgImg(null);
        } else {
            setBgImg(null);
        }
    }, [design?.bg_mode, design?.bg_image_url, aiDielineBgImg, panel?.id]);

    return (
        <>
            <KRect name="bg" x={0} y={0} width={width} height={height}
                fill={design?.bg_color || '#FFFFFF'} listening={true} />
            {bgImg && (
                <KImg image={bgImg} x={0} y={0} width={width} height={height}
                    opacity={design?.bg_opacity ?? 1} listening={false} />
            )}
        </>
    );
}

// === Panel Element Renderer ===
function PanelElement({ el, isSelected, onSelect, onChange }) {
    const [img, setImg] = useState(null);

    useEffect(() => {
        if (el.type === 'image' && el.src) {
            const i = new window.Image();
            i.crossOrigin = 'anonymous';
            i.src = el.src;
            i.onload = () => setImg(i);
        }
    }, [el.src]);

    useEffect(() => {
        if (el.type === 'barcode' && el.barcodeValue) {
            try {
                const val = el.barcodeValue.replace(/\D/g, '');
                // Auto-detect format: EAN-13 if exactly 13 digits, otherwise CODE128
                let format = 'CODE128';
                if (val.length === 13) format = 'EAN13';
                else if (val.length === 8) format = 'EAN8';
                else if (val.length === 12) format = 'UPC';

                const canvas = document.createElement('canvas');
                JsBarcode(canvas, val || '0000000000000', {
                    format, width: 2, height: 60, fontSize: 14, margin: 4,
                    displayValue: true, background: '#ffffff'
                });
                const i = new window.Image();
                i.src = canvas.toDataURL();
                i.onload = () => setImg(i);
            } catch (e) {
                // Fallback: try CODE128 which accepts any string
                try {
                    const canvas = document.createElement('canvas');
                    JsBarcode(canvas, el.barcodeValue, {
                        format: 'CODE128', width: 2, height: 60, fontSize: 12, margin: 4,
                        displayValue: true, background: '#ffffff'
                    });
                    const i = new window.Image();
                    i.src = canvas.toDataURL();
                    i.onload = () => setImg(i);
                } catch (e2) {
                    const canvas = document.createElement('canvas');
                    canvas.width = 160; canvas.height = 50;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 160, 50);
                    ctx.fillStyle = '#c00'; ctx.font = '11px sans-serif';
                    ctx.fillText('Invalid Barcode', 30, 30);
                    const i = new window.Image();
                    i.src = canvas.toDataURL();
                    i.onload = () => setImg(i);
                }
            }
        }
    }, [el.type, el.barcodeValue, el.barcodeFormat]);

    useEffect(() => {
        if (el.type === 'qrcode' && el.qrValue) {
            const canvas = document.createElement('canvas');
            QRCode.toCanvas(canvas, el.qrValue, { width: 200, margin: 2, errorCorrectionLevel: 'M' }, (err) => {
                if (err) { console.error('QR render error:', err); return; }
                const i = new window.Image();
                i.src = canvas.toDataURL('image/png');
                i.onload = () => setImg(i);
            });
        }
    }, [el.type, el.qrValue]);

    const handleDragEnd = (e) => {
        onChange({ x: e.target.x(), y: e.target.y() });
    };
    const handleTransformEnd = (e) => {
        const node = e.target;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);
        onChange({
            x: node.x(), y: node.y(),
            w: Math.max(10, node.width() * scaleX),
            h: Math.max(10, node.height() * scaleY),
            rotation: node.rotation()
        });
    };

    const common = { id: el.id, draggable: true, onClick: onSelect, onTap: onSelect, onDragEnd: handleDragEnd, onTransformEnd: handleTransformEnd };

    if (el.type === 'text') {
        return <KText {...common} x={el.x} y={el.y} width={el.w} text={el.data || ''} fontSize={el.fontSize || 20} fill={el.fill || '#222'} fontFamily={el.fontFamily || 'Sarabun'} rotation={el.rotation || 0} />;
    }
    if (el.type === 'shape') {
        return <KRect {...common} x={el.x} y={el.y} width={el.w} height={el.h} fill={el.fill || '#ccc'} rotation={el.rotation || 0} cornerRadius={4} />;
    }
    if (el.type === 'circle') {
        return <KCircle {...common} x={el.x} y={el.y} radius={el.radius || 30} fill={el.fill || '#ccc'} />;
    }
    if (el.type === 'image' && img) {
        return <KImg {...common} image={img} x={el.x} y={el.y} width={el.w} height={el.h} rotation={el.rotation || 0} />;
    }
    if (el.type === 'barcode' && img) {
        return <KImg {...common} image={img} x={el.x} y={el.y} width={el.w} height={el.h} rotation={el.rotation || 0} />;
    }
    if (el.type === 'qrcode' && img) {
        return <KImg {...common} image={img} x={el.x} y={el.y} width={el.w} height={el.h} rotation={el.rotation || 0} />;
    }
    return null;
}

// === Die-line Mini Map ===
function DielineMiniMap({ panels, activePanelIdx, onClickPanel, materialData, panelDesigns, aiDielineBgImg }) {
    if (!materialData) return null;
    const dW = parseFloat(materialData.dieline_width_mm);
    const dH = parseFloat(materialData.dieline_height_mm);
    const maxW = 200, maxH = 300;
    const scale = Math.min(maxW / dW, maxH / dH);
    const mapW = dW * scale, mapH = dH * scale;

    return (
        <div style={{ background: '#fff', borderRadius: 8, padding: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'inline-block', flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: C.sub, marginBottom: 6, textAlign: 'center', fontWeight: 600 }}>
                Die-line ({dW} × {dH} mm)
            </div>
            <svg width={mapW} height={mapH} viewBox={`0 0 ${dW} ${dH}`} style={{ display: 'block' }}>
                <rect x={0} y={0} width={dW} height={dH} fill="#f9fafb" stroke="#e5e7eb" strokeWidth={0.5} />
                {panels.map((p, idx) => {
                    const d = panelDesigns[p.id];
                    const isActive = idx === activePanelIdx;
                    return (
                        <g key={p.id} onClick={() => onClickPanel(idx)} style={{ cursor: 'pointer' }}>
                            <rect x={p.x_mm} y={p.y_mm} width={p.w_mm} height={p.h_mm}
                                fill={d?.bg_mode === 'dalle' ? '#dbeafe' : (d?.bg_color || '#fff')}
                                stroke={isActive ? '#2563eb' : '#9ca3af'}
                                strokeWidth={isActive ? 1.5 : 0.5}
                                rx={0.5} />
                            <text x={p.x_mm + p.w_mm / 2} y={p.y_mm + p.h_mm / 2}
                                textAnchor="middle" dominantBaseline="middle"
                                fontSize={Math.min(p.w_mm, p.h_mm) * 0.18}
                                fill={isActive ? '#2563eb' : '#6b7280'} fontWeight={isActive ? 'bold' : 'normal'}>
                                {p.label}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}

// === Label Part Button ===
function LabelPartBtn({ icon, label, detail, available, onClick }) {
    return (
        <button onClick={available ? onClick : undefined}
            style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
                width: '100%', padding: '6px 10px', border: `1px solid ${available ? '#fbbf24' : C.border}`,
                borderRadius: 6, fontSize: 11, cursor: available ? 'pointer' : 'not-allowed',
                background: available ? '#fffbeb' : '#f9fafb', color: available ? '#92400e' : '#9ca3af',
                opacity: available ? 1 : 0.5, textAlign: 'left'
            }}>
            <span style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>{icon && <iconify-icon icon={icon} style={{fontSize:14,verticalAlign:'middle'}}></iconify-icon>}{label}</span>
            {detail && <span style={{ fontSize: 10, color: '#a16207', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail}</span>}
            {available && <span style={{ fontSize: 10, color: '#d97706' }}>+</span>}
        </button>
    );
}

// === Sidebar Accordion Section ===
function SidebarSection({ title, open, onToggle, children }) {
    return (
        <div style={{ marginBottom: 8, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
            <button onClick={onToggle}
                style={{ width: '100%', padding: '8px 12px', background: open ? '#f8fafc' : '#fff', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, fontWeight: 600, color: C.text }}>
                {title}
                <iconify-icon icon={open ? 'mdi:chevron-up' : 'mdi:chevron-down'} style={{ fontSize: 16 }}></iconify-icon>
            </button>
            {open && <div style={{ padding: '8px 12px 12px' }}>{children}</div>}
        </div>
    );
}

// === Mode Selector ===
function ModeSelector({ onPick, onBack, productName, hasPanels }) {
    return (
        <div style={{ padding: 24 }}>
            <button onClick={onBack} style={{
                background: 'none', border: 'none', color: C.sub, cursor: 'pointer',
                marginBottom: 20, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, padding: 0
            }}>
                <iconify-icon icon="mdi:chevron-left"></iconify-icon>
                เลือกสินค้าใหม่
            </button>
            <h2 style={{ color: C.primaryDark, margin: '0 0 8px', fontSize: 22 }}>
                เลือกรูปแบบ Mockup
            </h2>
            <p style={{ color: C.sub, fontSize: 14, marginBottom: 28 }}>
                สำหรับสินค้า "{productName}" — เลือกวิธีที่เหมาะกับงานของคุณ
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, maxWidth: 700 }}>
                <ModeCard iconName="mdi:cube-unfolded" title="ออกแบบบรรจุภัณฑ์ทั้งชิ้น"
                    desc="ออกแบบกราฟิกลงบนพื้นผิวบรรจุภัณฑ์ทุกด้าน ใช้ AI สร้างลวดลาย หรือออกแบบเอง ส่งออกเป็น PDF"
                    badge="แนะนำ" badgeColor={C.label}
                    disabled={!hasPanels}
                    disabledMsg="บรรจุภัณฑ์นี้ยังไม่รองรับการออกแบบทั้งชิ้น"
                    onClick={() => onPick('package_design')} />
                <ModeCard iconName="mdi:image-auto-adjust" title="AI สร้าง Mockup จากรูปจริง"
                    desc="ส่งรูปฉลากและบรรจุภัณฑ์จริงให้ Gemini AI สร้างภาพ Mockup สมจริง พร้อมเลือกสไตล์พื้นหลังได้"
                    badge="ใช้ Credit" badgeColor={C.primaryDark} onClick={() => onPick('aimockup')} />
            </div>
        </div>
    );
}

function ModeCard({ iconName, title, desc, badge, badgeColor, onClick, disabled, disabledMsg }) {
    const [hover, setHover] = useState(false);
    return (
        <button onClick={disabled ? undefined : onClick}
            onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
            title={disabled ? disabledMsg : ''}
            style={{
                background: disabled ? '#f9fafb' : '#fff',
                border: `2px solid ${!disabled && hover ? badgeColor : C.border}`, borderRadius: 14, padding: 28,
                textAlign: 'left', cursor: disabled ? 'not-allowed' : 'pointer', position: 'relative', fontFamily: 'inherit',
                transform: !disabled && hover ? 'translateY(-2px)' : 'none',
                boxShadow: !disabled && hover ? '0 12px 32px rgba(0,0,0,0.1)' : '0 4px 16px rgba(0,0,0,0.04)',
                transition: 'all 0.2s ease',
                opacity: disabled ? 0.5 : 1
            }}>
            <div style={{
                position: 'absolute', top: 14, right: 14, background: badgeColor, color: '#fff',
                padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600
            }}>
                {badge}
            </div>
            <div style={{ fontSize: 36, color: badgeColor, marginBottom: 10 }}>
                <iconify-icon icon={iconName}></iconify-icon>
            </div>
            <h3 style={{ margin: '0 0 8px', color: badgeColor, fontSize: 17 }}>{title}</h3>
            <p style={{ margin: 0, color: C.sub, fontSize: 13, lineHeight: 1.6 }}>{desc}</p>
        </button>
    );
}

// === AI Mockup View (ส่งรูปจริงให้ Gemini + แสดงประวัติ + SSE progress) ===
function AIMockupView({ projectId, packageImageUrl, labelImageUrl, labelData, onGenerate, isGenerating, progressInfo, onBack }) {
    const [history, setHistory] = useState([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);
    const [selectedImg, setSelectedImg] = useState(null);
    const hasLabel = !!(labelData?.final_label_url || labelImageUrl);
    const hasPackage = !!packageImageUrl;
    const canGenerate = hasLabel || hasPackage;

    const fetchHistory = async () => {
        try {
            const res = await fetch(`${API}/api/mockup/history/${projectId}`);
            const data = await res.json();
            if (data.status === 'success') {
                setHistory(data.data);
                if (data.data.length > 0 && !selectedImg) {
                    setSelectedImg(`${API}${data.data[0].image_url}`);
                }
            }
        } catch (e) { console.error(e); }
        finally { setIsLoadingHistory(false); }
    };

    useEffect(() => { fetchHistory(); }, [projectId]);

    const handleGenerate = async () => {
        await onGenerate();
        await fetchHistory();
    };

    const handleDownload = async (url) => {
        try {
            const resp = await fetch(url);
            const blob = await resp.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = `mockup_ai_${Date.now()}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
        } catch (e) { alert('ดาวน์โหลดไม่สำเร็จ: ' + e.message); }
    };

    const handleDelete = async (historyId) => {
        if (!confirm('ต้องการลบภาพนี้?')) return;
        try {
            await fetch(`${API}/api/mockup/history/${historyId}`, { method: 'DELETE' });
            const updated = history.filter(h => h.history_id !== historyId);
            setHistory(updated);
            if (selectedImg && history.find(h => h.history_id === historyId)) {
                setSelectedImg(updated.length > 0 ? `${API}${updated[0].image_url}` : null);
            }
        } catch (e) { console.error(e); }
    };

    return (
        <div style={{ padding: 24 }}>
            <button onClick={onBack} style={{
                background: 'none', border: 'none', color: C.sub, cursor: 'pointer',
                marginBottom: 20, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, padding: 0
            }}>
                <iconify-icon icon="mdi:chevron-left"></iconify-icon>
                เปลี่ยนสินค้า / โหมด
            </button>

            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
                {/* คอลัมน์ซ้าย: ตั้งค่า + สร้าง */}
                <div style={{ flex: '0 0 320px' }}>
                    {/* รูป label + package preview */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                        <div style={{ background: '#fff', padding: 10, borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: C.sub, marginBottom: 6 }}>
                                <iconify-icon icon="mdi:package-variant" style={{ marginRight: 4 }}></iconify-icon>
                                บรรจุภัณฑ์
                            </div>
                            {hasPackage ? (
                                <img src={packageImageUrl} style={{ width: '100%', borderRadius: 6, maxHeight: 120, objectFit: 'contain' }} alt="pkg" />
                            ) : <div style={{ padding: 20, textAlign: 'center', color: C.border, fontSize: 11 }}>ไม่มีภาพ</div>}
                        </div>
                        <div style={{ background: '#fff', padding: 10, borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: C.sub, marginBottom: 6 }}>
                                <iconify-icon icon="mdi:label-outline" style={{ marginRight: 4 }}></iconify-icon>
                                ฉลาก
                            </div>
                            {hasLabel ? (
                                <img src={labelImageUrl} style={{ width: '100%', borderRadius: 6, maxHeight: 120, objectFit: 'contain' }} alt="lbl" />
                            ) : <div style={{ padding: 20, textAlign: 'center', color: '#b45309', fontSize: 11, background: '#fffbeb', borderRadius: 6 }}>ยังไม่มีฉลาก</div>}
                        </div>
                    </div>

                    {/* ปุ่มสร้าง */}
                    <button onClick={handleGenerate} disabled={isGenerating || !canGenerate} style={{
                        width: '100%', padding: '14px 20px',
                        background: (isGenerating || !canGenerate) ? '#ccc' : C.primaryDark,
                        color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600,
                        cursor: (isGenerating || !canGenerate) ? 'not-allowed' : 'pointer',
                        fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        marginBottom: 16
                    }}>
                        <iconify-icon icon="mdi:image-auto-adjust"></iconify-icon>
                        {isGenerating ? 'AI กำลังสร้าง... (30-60 วินาที)' : 'สร้าง Mockup ใหม่'}
                    </button>

                    {/* Gallery ประวัติ */}
                    <div style={{ background: '#fff', padding: 14, borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>
                                <iconify-icon icon="mdi:history" style={{ marginRight: 4 }}></iconify-icon>
                                ประวัติที่สร้าง ({history.length})
                            </span>
                        </div>
                        {isLoadingHistory ? (
                            <div style={{ textAlign: 'center', padding: 20, color: C.sub, fontSize: 12 }}>กำลังโหลด...</div>
                        ) : history.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 20, color: C.sub, fontSize: 12, lineHeight: 1.6 }}>
                                ยังไม่มีภาพ Mockup<br />กดปุ่มด้านบนเพื่อสร้าง
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
                                {history.map(h => {
                                    const url = `${API}${h.image_url}`;
                                    const isActive = selectedImg === url;
                                    return (
                                        <div key={h.history_id} style={{
                                            position: 'relative', borderRadius: 8, overflow: 'hidden',
                                            border: isActive ? `3px solid ${C.primaryDark}` : '2px solid transparent',
                                            cursor: 'pointer', transition: 'all 0.15s',
                                            boxShadow: isActive ? '0 4px 12px rgba(143,29,29,0.25)' : '0 1px 4px rgba(0,0,0,0.08)'
                                        }}>
                                            <img src={url} onClick={() => setSelectedImg(url)}
                                                style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }} alt="mockup" />
                                            <button onClick={(e) => { e.stopPropagation(); handleDelete(h.history_id); }} style={{
                                                position: 'absolute', top: 4, right: 4, width: 22, height: 22,
                                                background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', borderRadius: '50%',
                                                cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                padding: 0, lineHeight: 1
                                            }}>
                                                <iconify-icon icon="mdi:close" style={{ fontSize: 14 }}></iconify-icon>
                                            </button>
                                            <div style={{
                                                position: 'absolute', bottom: 0, left: 0, right: 0, padding: '3px 6px',
                                                background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 9, textAlign: 'center'
                                            }}>
                                                {new Date(h.created_at).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* คอลัมน์ขวา: รูปขยายใหญ่ */}
                <div style={{ flex: 1, background: '#fff', borderRadius: 14, padding: 24, minHeight: 500,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
                    {isGenerating ? (
                        <div style={{ textAlign: 'center', width: '100%', maxWidth: 320 }}>
                            <div style={{ fontSize: 48, color: C.primaryDark, marginBottom: 16 }}>
                                <iconify-icon icon="mdi:loading" style={{ animation: 'spin 1s linear infinite' }}></iconify-icon>
                            </div>
                            <p style={{ color: C.text, fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
                                {progressInfo?.message || 'กำลังเริ่มต้น...'}
                            </p>
                            {progressInfo?.step && progressInfo?.total && (
                                <>
                                    <div style={{
                                        width: '100%', height: 8, background: '#e5e7eb', borderRadius: 99,
                                        overflow: 'hidden', marginBottom: 8
                                    }}>
                                        <div style={{
                                            width: `${(progressInfo.step / progressInfo.total) * 100}%`,
                                            height: '100%', background: C.primaryDark, borderRadius: 99,
                                            transition: 'width 0.5s ease'
                                        }} />
                                    </div>
                                    <p style={{ color: C.sub, fontSize: 12 }}>
                                        ขั้นตอน {progressInfo.step} / {progressInfo.total}
                                    </p>
                                </>
                            )}
                        </div>
                    ) : selectedImg ? (
                        <>
                            <img src={selectedImg} style={{
                                maxWidth: '100%', maxHeight: 500, borderRadius: 10,
                                boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
                            }} alt="mockup preview" />
                            <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                                <button onClick={() => handleDownload(selectedImg)} style={{
                                    padding: '10px 20px', background: '#22c55e', color: '#fff',
                                    border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer',
                                    fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6
                                }}>
                                    <iconify-icon icon="mdi:download"></iconify-icon>
                                    ดาวน์โหลดรูปนี้
                                </button>
                            </div>
                        </>
                    ) : (
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 64, color: C.border, marginBottom: 16 }}>
                                <iconify-icon icon="mdi:image-plus-outline"></iconify-icon>
                            </div>
                            <p style={{ color: C.sub, fontSize: 14, fontWeight: 600 }}>ยังไม่มีภาพ Mockup</p>
                            <p style={{ color: C.sub, fontSize: 12 }}>กดปุ่มสร้างเพื่อให้ AI สร้างภาพ Mockup</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
// === Mini Label Preview (static HTML, no html2canvas) สำหรับ thumbnail ===
function MiniLabelPreview({ labelData, brandAssets }) {
    if (!labelData) return null;
    const colors = brandAssets?.colors || ['#fff', '#222', '#d3542b'];
    const bgColor = labelData.bg_color || colors[0] || '#fff';
    const textColor = colors[1] || '#222';
    const accent = colors[2] || '#d3542b';

    return (
        <div style={{
            width: '100%', height: '100%', background: bgColor, color: textColor,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: 6, boxSizing: 'border-box', overflow: 'hidden',
            fontFamily: brandAssets?.font || "'Sarabun', sans-serif"
        }}>
            {brandAssets?.logoUrl && (
                <img src={brandAssets.logoUrl} alt="logo" crossOrigin="anonymous"
                    style={{ width: 28, height: 28, objectFit: 'contain', marginBottom: 4 }}
                    onError={e => e.target.style.display = 'none'} />
            )}
            <div style={{ fontSize: 10, fontWeight: 800, textAlign: 'center', lineHeight: 1.1, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {labelData.product_name || ''}
            </div>
            {labelData.tagline && (
                <div style={{ fontSize: 7, color: accent, marginTop: 2, textAlign: 'center', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {labelData.tagline}
                </div>
            )}
        </div>
    );
}
// === Product Card ===
function ProductCard({ product, brandAssets, onSelect }) {
    const [pkgImg, setPkgImg] = useState(null);
    const [labelData, setLabelData] = useState(null);
    const [hover, setHover] = useState(false);

    useEffect(() => {
        // โหลดภาพบรรจุภัณฑ์
        const matId = product.materials?.[0]?.id;
        if (matId) {
            fetch(`${API}/api/mockup/material/${matId}`)
                .then(r => r.json())
                .then(d => {
                    if (d.status === 'success' && d.data.images?.length > 0) {
                        setPkgImg(d.data.images[0].image_path);
                    }
                })
                .catch(e => console.warn('fetch material error', e));
        }

        // โหลดฉลากของสินค้านี้ (per product)
        fetch(`${API}/api/labels/product/${product.product_id}`)
            .then(r => r.json())
            .then(d => {
                if (d.status === 'success' && d.data) {
                    setLabelData(d.data);
                    console.log(`[Mockup] Label for product ${product.product_id}:`, d.data.product_name);
                } else {
                    console.log(`[Mockup] No label for product ${product.product_id}`);
                }
            })
            .catch(e => console.warn('fetch label error', e));
    }, [product.product_id]);

    const productImg = product.image_product ? `${API}/uploads/${product.image_product}` : null;
    const hasLabel = !!labelData;

    let buttonText, buttonColor, buttonIcon, statusType;
    if (!product.has_package) {
        buttonText = 'ไปเลือกบรรจุภัณฑ์'; buttonColor = C.accent;
        buttonIcon = 'mdi:package-variant-closed'; statusType = 'no_package';
    } else if (!hasLabel) {
        buttonText = 'ไปออกแบบฉลาก'; buttonColor = C.label;
        buttonIcon = 'mdi:tag-outline'; statusType = 'no_label';
    } else {
        buttonText = 'เริ่มทำ Mockup'; buttonColor = C.primaryDark;
        buttonIcon = 'mdi:image-edit-outline'; statusType = 'ready';
    }

    return (
        <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{
            background: '#fff', borderRadius: 16, overflow: 'hidden',
            boxShadow: hover ? '0 12px 32px rgba(0,0,0,0.1)' : '0 4px 16px rgba(0,0,0,0.06)',
            border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column',
            transform: hover ? 'translateY(-3px)' : 'none', transition: 'all 0.2s ease'
        }}>
            <div style={{
                position: 'relative', height: 240,
                background: 'linear-gradient(135deg, #fafafa 0%, #f0f0f0 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
            }}>
                {productImg ? (
                    <img src={productImg} alt={product.name_product}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={e => { e.target.style.display = 'none'; }} />
                ) : (
                    <div style={{ color: C.border, fontSize: 64 }}>
                        <iconify-icon icon="mdi:image-outline"></iconify-icon>
                    </div>
                )}
            </div>

            <div style={{
                display: 'flex', gap: 10, padding: '14px 16px',
                background: C.bgLight, borderTop: `1px solid ${C.border}`
            }}>
                {/* Package thumbnail */}
                <div style={{ flex: 1 }}>
                    <div style={{
                        width: '100%', aspectRatio: '1', background: '#fff',
                        border: `1px solid ${C.border}`, borderRadius: 8,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden'
                    }}>
                        {pkgImg ? (
                            <img src={pkgImg} alt="package" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        ) : (
                            <div style={{ color: C.border, fontSize: 28 }}>
                                <iconify-icon icon="mdi:package-variant-closed"></iconify-icon>
                            </div>
                        )}
                    </div>
                    <div style={{ fontSize: 10, color: C.sub, textAlign: 'center', marginTop: 4 }}>บรรจุภัณฑ์</div>
                </div>

                {/* Label thumbnail (mini preview) */}
                <div style={{ flex: 1 }}>
                    <div style={{
                        width: '100%', aspectRatio: '1', background: '#fff',
                        border: `1px solid ${C.border}`, borderRadius: 8,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden'
                    }}>
                        {hasLabel ? (
                            <MiniLabelPreview labelData={labelData} brandAssets={brandAssets} />
                        ) : (
                            <div style={{ color: C.border, fontSize: 28 }}>
                                <iconify-icon icon="mdi:tag-outline"></iconify-icon>
                            </div>
                        )}
                    </div>
                    <div style={{ fontSize: 10, color: C.sub, textAlign: 'center', marginTop: 4 }}>ฉลาก</div>
                </div>
            </div>

            <div style={{ padding: 18, flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 4 }}>
                    {product.name_product}
                </div>
                {product.type_product && (
                    <div style={{ fontSize: 12, color: C.sub, marginBottom: 12 }}>
                        ประเภท: {product.type_product}
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                    <StatusLine ok={product.has_package} okText={`บรรจุภัณฑ์: ${product.name_package || ''}`}
                        noText="ยังไม่ได้เลือกบรรจุภัณฑ์" />
                    <StatusLine ok={hasLabel} okText={`ฉลาก: ${labelData?.product_name || 'ออกแบบแล้ว'}`}
                        noText="ยังไม่ได้ออกแบบฉลาก" />
                </div>

                <button onClick={() => onSelect(statusType, labelData)} style={{
                    marginTop: 'auto', padding: '12px 16px',
                    background: buttonColor, color: '#fff', border: 'none', borderRadius: 8,
                    fontWeight: 600, cursor: 'pointer', fontSize: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}>
                    <iconify-icon icon={buttonIcon}></iconify-icon>
                    {buttonText}
                </button>
            </div>
        </div>
    );
}

function StatusLine({ ok, okText, noText }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, color: ok ? '#5a7020' : '#9a5e15'
        }}>
            <iconify-icon icon={ok ? "mdi:check-circle" : "mdi:alert-circle-outline"}
                style={{ fontSize: 14 }}></iconify-icon>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ok ? okText : noText}
            </span>
        </div>
    );
}

// === Product Picker ===
function ProductPickerView({ products, isLoading, brandAssets, onSelectProduct, onRefresh }) {
    if (isLoading) return (
        <div style={{ padding: 60, textAlign: 'center', color: C.sub }}>กำลังโหลดสินค้า...</div>
    );
    if (!products || products.length === 0) {
        return (
            <div style={{ padding: 60, textAlign: 'center', color: C.sub }}>
                <div style={{ fontSize: 48, marginBottom: 12, color: C.border }}>
                    <iconify-icon icon="mdi:package-variant-closed-remove"></iconify-icon>
                </div>
                ยังไม่มีสินค้าในโปรเจกต์นี้ กรุณาเพิ่มสินค้าก่อน
            </div>
        );
    }

    return (
        <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 16 }}>
                <div style={{ flex: 1 }}>
                    <h2 style={{ margin: '0 0 6px', color: C.primaryDark, fontSize: 22, fontWeight: 700 }}>
                        เลือกสินค้าที่ต้องการทำ Mockup
                    </h2>
                    <p style={{ margin: 0, color: C.sub, fontSize: 14 }}>
                        แต่ละสินค้ามีฉลากของตัวเอง — เลือกสินค้าที่มีบรรจุภัณฑ์และฉลากครบเพื่อทำภาพ Mockup
                    </p>
                </div>
                <button onClick={onRefresh} style={{
                    padding: '8px 14px', background: '#fff', border: `1px solid ${C.border}`,
                    borderRadius: 8, cursor: 'pointer', fontSize: 13, color: C.text,
                    display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500, whiteSpace: 'nowrap'
                }}>
                    <iconify-icon icon="mdi:refresh"></iconify-icon>
                    รีเฟรชข้อมูล
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
                {products.map(p => (
                    <ProductCard key={p.product_id} product={p}
                        brandAssets={brandAssets}
                        onSelect={(statusType, labelData) => onSelectProduct(p, statusType, labelData)} />
                ))}
            </div>
        </div>
    );
}

// === MAIN ===
export default function MockupEditor({ projectId, userId, projectName, onNavigateToPackage, onNavigateToLabel }) {
    const [view, setView] = useState('picker');
    const [products, setProducts] = useState([]);
    const [isLoadingProducts, setIsLoadingProducts] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);

    const [brandAssets, setBrandAssets] = useState(null);
    const [selectedLabelData, setSelectedLabelData] = useState(null);  // 👈 ใหม่: label ของสินค้าที่เลือก
    const [labelImageUrl, setLabelImageUrl] = useState(null);
    const [packageImageUrl, setPackageImageUrl] = useState(null);

    const [isExporting, setIsExporting] = useState(false);
    const [isAIGen, setIsAIGen] = useState(false);
    const [aiMockupUrl, setAiMockupUrl] = useState(null);
    const [aiProgress, setAiProgress] = useState(null);

    useEffect(() => {
        fetchProducts();
        fetchBrandAssets();
    }, [projectId]);

    const fetchProducts = async () => {
        setIsLoadingProducts(true);
        try {
            const res = await fetch(`${API}/api/mockup/products-status/${projectId}`);
            const data = await res.json();
            if (data.status === 'success') setProducts(data.data);
        } catch (err) { console.error(err); }
        finally { setIsLoadingProducts(false); }
    };

    // ดึงเฉพาะ brand assets — ไม่ดึง label เพราะ label ผูกกับ product แต่ละตัว
    const fetchBrandAssets = async () => {
        try {
            const projRes = await fetch(`${API}/api/projects/detail/${projectId}`);
            const proj = await projRes.json();
            const logo = proj.project?.image_logo ? `${API}${proj.project.image_logo}` : '';
            const transparentLogo = await loadLogoTransparent(logo);
            const aRes = await fetch(`${API}/api/projects/${projectId}/selected-assets`);
            const a = await aRes.json();
            const colors = a.color
                ? [a.color.color_code_1, a.color.color_code_2, a.color.color_code_3, a.color.color_code_4, a.color.color_code_5].filter(Boolean)
                : ['#fff', '#222', '#d3542b', '#777', '#eee'];
            const font = a.font ? `'${a.font.font_name}', sans-serif` : "'Sarabun', sans-serif";
            setBrandAssets({ logoUrl: transparentLogo || logo, font, colors });
        } catch (err) {
            console.error('[Mockup] Brand assets fetch error:', err);
        }
    };

    const handleRefresh = async () => {
        setSelectedLabelData(null);
        setLabelImageUrl(null);
        await fetchProducts();
        await fetchBrandAssets();
    };

    const handleSelectProduct = async (product, statusType, labelData) => {
        if (statusType === 'no_package') {
            if (typeof onNavigateToPackage === 'function') onNavigateToPackage();
            else alert('กรุณาไปที่แท็บ Package เพื่อเลือกบรรจุภัณฑ์ก่อน');
            return;
        }
        if (statusType === 'no_label') {
            if (typeof onNavigateToLabel === 'function') onNavigateToLabel();
            else alert('กรุณาไปที่แท็บ Label เพื่อออกแบบฉลากก่อน');
            return;
        }

        setSelectedProduct(product);
        setSelectedLabelData(labelData);
        console.log('[Mockup] Selected product:', product.name_product, 'with label:', labelData?.product_name);

        // ใช้รูป label snapshot ที่ถ่ายไว้ตอน save (สมบูรณ์ 100%)
        if (labelData?.final_label_url) {
            setLabelImageUrl(`${API}${labelData.final_label_url}`);
        } else {
            setLabelImageUrl(null); // fallback ให้ LabelImageRenderer จัดการ
        }

        const matId = product.materials?.[0]?.id;
        if (matId) {
            try {
                const r = await fetch(`${API}/api/mockup/material/${matId}`);
                const d = await r.json();
                if (d.status === 'success' && d.data.images?.length > 0) {
                    setPackageImageUrl(d.data.images[0].image_path);
                }
            } catch (e) { console.error(e); }
        }
        setView('mode');
    };

    const handlePickMode = (m) => setView(m);
    const handleBackToPicker = () => {
        setView('picker'); setSelectedProduct(null);
        setSelectedLabelData(null); setLabelImageUrl(null);
        setPackageImageUrl(null); setAiMockupUrl(null);
        fetchProducts();
    };
    const handleBackToMode = () => { setView('mode'); setAiMockupUrl(null); };

    const handleAIMockup = async (bgStyle = 'white') => {
        if (!selectedProduct) return;
        setIsAIGen(true);
        setAiMockupUrl(null);
        setAiProgress({ step: 0, total: 4, message: 'กำลังเริ่มต้น...' });

        try {
            const mat = selectedProduct.materials?.[0];
            const res = await fetch(`${API}/api/mockup/generate-ai-image`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_id: projectId,
                    user_id: userId,
                    label_image_url: selectedLabelData?.final_label_url || null,
                    package_image_url: packageImageUrl || null,
                    package_name: selectedProduct.name_package || selectedProduct.name || '',
                    package_material: mat?.material_name || '',
                    package_type: mat?.package_type || '',
                    product_name: selectedLabelData?.product_name || selectedProduct.name_product,
                    bg_style: bgStyle,
                    label_width_px: selectedLabelData?.label_width || 380,
                    label_height_px: selectedLabelData?.label_height || 500,
                    dieline_width_mm: mat?.dieline_width_mm || null,
                    dieline_height_mm: mat?.dieline_height_mm || null
                })
            });

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let finalResult = null;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                const lines = buffer.split('\n');
                buffer = lines.pop();

                let currentEvent = null;
                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        currentEvent = line.slice(7).trim();
                    } else if (line.startsWith('data: ') && currentEvent) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (currentEvent === 'progress') {
                                setAiProgress(data);
                            } else if (currentEvent === 'done') {
                                finalResult = data;
                            } else if (currentEvent === 'error') {
                                throw new Error(data.message);
                            }
                        } catch (e) {
                            if (e.message && !e.message.includes('JSON')) throw e;
                        }
                        currentEvent = null;
                    }
                }
            }

            if (finalResult?.status === 'success') {
                setAiMockupUrl(`${API}${finalResult.image_url}`);
            } else if (!finalResult) {
                alert('AI สร้างไม่สำเร็จ: ไม่ได้รับผลลัพธ์');
            }
        } catch (err) {
            alert('Error: ' + err.message);
            console.error(err);
        } finally {
            setIsAIGen(false);
            setAiProgress(null);
        }
    };

    return (
        <>
            {/* Render label เป็น image — ใช้เฉพาะกรณี label เก่าที่ยังไม่มี final_label_url */}
            {selectedLabelData && brandAssets && !selectedLabelData.final_label_url && (
                <LabelImageRenderer labelData={selectedLabelData} brandAssets={brandAssets} onReady={setLabelImageUrl} />
            )}

            {view === 'picker' && (
                <ProductPickerView
                    products={products} isLoading={isLoadingProducts}
                    brandAssets={brandAssets}
                    onSelectProduct={handleSelectProduct}
                    onRefresh={handleRefresh}
                />
            )}

            {view === 'mode' && selectedProduct && (
                <ModeSelector onPick={handlePickMode} onBack={handleBackToPicker}
                    productName={selectedProduct.name_product}
                    hasPanels={!!(selectedProduct.materials?.[0]?.panels_json || selectedProduct.materials?.[0]?.dieline_width_mm)} />
            )}

            {view === 'package_design' && selectedProduct && (
                <PackageDesignEditor
                    projectId={projectId}
                    userId={userId}
                    projectName={projectName}
                    product={selectedProduct}
                    brandAssets={brandAssets}
                    labelData={selectedLabelData}
                    labelImageUrl={labelImageUrl}
                    onBack={handleBackToMode}
                />
            )}

                                    {view === 'aimockup' && (
                <AIMockupView
                    projectId={projectId}
                    packageImageUrl={packageImageUrl}
                    labelImageUrl={labelImageUrl}
                    labelData={selectedLabelData}
                    onGenerate={handleAIMockup}
                    isGenerating={isAIGen}
                    progressInfo={aiProgress}
                    onBack={handleBackToMode}
                />
            )}
        </>
    );
}