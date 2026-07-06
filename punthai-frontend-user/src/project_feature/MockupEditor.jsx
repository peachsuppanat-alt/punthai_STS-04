// punthai-frontend-user/src/MockupEditor.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Stage, Layer, Image as KImg, Rect as KRect, Text as KText, Circle as KCircle, Shape as KShape, Group, Transformer, Line as KLine } from 'react-konva';
import html2canvas from 'html2canvas';
import { loadLogoTransparent } from './logoUtils';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { getUserFromStorage, isProUser } from '../utils/subscriptionGuard';
import ProUpgradeModal from '../components/ProUpgradeModal';
import { API_URL } from '../config';
import './MockupEditor.css';

const API = `${API_URL}`;

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

    return (
        <div className="label-render-offscreen">
            <div ref={ref} className="label-render-card">
                {brandAssets?.logoUrl && (
                    <img src={brandAssets.logoUrl} crossOrigin="anonymous" alt="logo"
                        className="label-render-logo" />
                )}
                <div className="label-render-name">
                    {labelData.product_name || 'Product Name'}
                </div>
                {labelData.tagline && (
                    <div className="label-render-tagline">
                        {labelData.tagline}
                    </div>
                )}
                {labelData.net_weight && (
                    <div className="label-render-weight">{labelData.net_weight}</div>
                )}
                {labelData.ingredients && (
                    <div className="label-render-ingredients">
                        <strong>ส่วนประกอบ:</strong>
                        <div className="label-render-ingredients-text">{labelData.ingredients}</div>
                    </div>
                )}
                {labelData.certifications?.length > 0 && (
                    <div className="label-render-certs">
                        {labelData.certifications.map((c, i) => {
                            const url = (typeof c === 'object' && c) ? c.url : null;
                            return url
                                ? <img key={i} src={url} crossOrigin="anonymous" alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} />
                                : (typeof c === 'string' ? <span key={i} className="label-render-cert-badge">{c}</span> : null);
                        })}
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
    const [shapeTab, setShapeTab] = useState('ทั้งหมด');
    const [propsPanelTab, setPropsPanelTab] = useState('คุณสมบัติ');
    const [aspectLocked, setAspectLocked] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    // ยุบ sidebar/props-panel ได้เพื่อคืนพื้นที่ให้ canvas — เริ่มต้นยุบอัตโนมัติถ้าจอแคบ
    const [sidebarOpen, setSidebarOpen] = useState(() => typeof window === 'undefined' || window.innerWidth > 1200);
    const [propsPanelOpen, setPropsPanelOpen] = useState(() => typeof window === 'undefined' || window.innerWidth > 1200);
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

    // เส้นกึ่งกลางกระดาษ (แสดงเมื่อลากวัตถุให้ศูนย์กลางตรงกลาง) — v=แนวตั้ง, h=แนวนอน
    const [centerGuide, setCenterGuide] = useState({ v: false, h: false });

    // Zoom & pan state
    const [stageScale, setStageScale] = useState(1);
    const ZOOM_STEP = 0.15;
    const ZOOM_MIN = 0.2;
    const ZOOM_MAX = 4;

    // Undo / redo history (snapshots of panelDesigns)
    const historyRef = useRef([]);
    const historyIndexRef = useRef(-1);
    const isUndoRedoRef = useRef(false);
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);

    // Canvas sizing
    const CANVAS_W = 700;
    const activePanel = panels[activePanelIdx];
    const mmToPx = activePanel ? Math.min(CANVAS_W / activePanel.w_mm, 600 / activePanel.h_mm) : 3;
    const canvasW = activePanel ? activePanel.w_mm * mmToPx : CANVAS_W;
    const canvasH = activePanel ? activePanel.h_mm * mmToPx : 500;

    // Current panel design
    const currentDesign = activePanel ? (panelDesigns[activePanel.id] || { bg_mode: 'solid', bg_color: '#FFFFFF', bg_opacity: 1, elements: [] }) : null;

    // === Record history on panelDesigns change ===
    useEffect(() => {
        if (!dataLoadedRef.current) return;
        if (isUndoRedoRef.current) { isUndoRedoRef.current = false; return; }
        const snapshot = JSON.parse(JSON.stringify(panelDesigns));
        historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
        historyRef.current.push(snapshot);
        historyIndexRef.current = historyRef.current.length - 1;
        setCanUndo(historyIndexRef.current > 0);
        setCanRedo(false);
    }, [panelDesigns]);

    // === Undo ===
    const handleUndo = useCallback(() => {
        if (historyIndexRef.current <= 0) return;
        historyIndexRef.current -= 1;
        isUndoRedoRef.current = true;
        setPanelDesigns(JSON.parse(JSON.stringify(historyRef.current[historyIndexRef.current])));
        setCanUndo(historyIndexRef.current > 0);
        setCanRedo(true);
    }, []);

    // === Redo ===
    const handleRedo = useCallback(() => {
        if (historyIndexRef.current >= historyRef.current.length - 1) return;
        historyIndexRef.current += 1;
        isUndoRedoRef.current = true;
        setPanelDesigns(JSON.parse(JSON.stringify(historyRef.current[historyIndexRef.current])));
        setCanUndo(true);
        setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    }, []);

    // === Keyboard shortcuts Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z ===
    useEffect(() => {
        const onKey = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); handleRedo(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [handleUndo, handleRedo]);

    // === Zoom helpers ===
    const clampScale = (s) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, s));
    const handleZoomIn  = () => setStageScale(s => clampScale(parseFloat((s + ZOOM_STEP).toFixed(2))));
    const handleZoomOut = () => setStageScale(s => clampScale(parseFloat((s - ZOOM_STEP).toFixed(2))));

    const handleFitToScreen = () => {
        const area = document.querySelector('.canvas-scroll-area');
        if (!area) { setStageScale(1); return; }
        const { width: aW, height: aH } = area.getBoundingClientRect();
        const padding = 64;
        const fitScale = clampScale(Math.min((aW - padding) / canvasW, (aH - padding) / canvasH));
        setStageScale(fitScale);
    };

    // Auto fit-to-screen: รันครั้งแรกตอน panel/canvas พร้อม และรันซ้ำตอนย่อ-ขยายหน้าต่าง
    // กันไม่ให้ canvas ล้น/บีบ layout ตอนเปิดใช้งานบนจอคอมพิวเตอร์ที่เล็กกว่าปกติ
    useEffect(() => {
        if (!activePanel) return;
        handleFitToScreen();
    }, [activePanel?.id, canvasW, canvasH]);

    useEffect(() => {
        let resizeTimer;
        const onWindowResize = () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => handleFitToScreen(), 150);
        };
        window.addEventListener('resize', onWindowResize);
        return () => {
            window.removeEventListener('resize', onWindowResize);
            clearTimeout(resizeTimer);
        };
    }, [canvasW, canvasH]);

    // ยุบ/ขยาย sidebar หรือ props-panel ก็เปลี่ยนพื้นที่ที่ canvas มีได้เหมือนกัน
    // รอ transition ของ panel (250ms) เสร็จก่อนค่อยคำนวณ fit-to-screen ใหม่
    useEffect(() => {
        if (!activePanel) return;
        const t = setTimeout(() => handleFitToScreen(), 260);
        return () => clearTimeout(t);
    }, [sidebarOpen, propsPanelOpen]);

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
            el = { id, type: 'text', x: cx - 80, y: cy - 16, w: 160, h: 32, rotation: 0, data: 'ข้อความ', fontSize: 24, fill: '#222', fontFamily: brandAssets?.font || "'Bai Jamjuree', sans-serif" };
        } else if (type === 'rect' || type === 'rect_round' || type === 'triangle' || type === 'star' || type === 'hexagon' || type === 'octagon' || type === 'diamond' || type === 'arrow' || type === 'speech' || type === 'heart') {
            const shapeKind = type === 'rect' ? 'rect' : type;
            el = { id, type: 'shape', shapeKind, x: cx - 60, y: cy - 60, w: 120, h: 120, rotation: 0, fill: brandAssets?.colors?.[2] || '#cccccc', cornerRadius: type === 'rect_round' ? 20 : 0 };
        } else if (type === 'circle' || type === 'ellipse') {
            el = { id, type: 'circle', shapeKind: type, x: cx, y: cy, radius: 50, w: 100, h: 100, rotation: 0, fill: brandAssets?.colors?.[2] || '#cccccc' };
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
            el = { id, type: 'text', x: (canvasW - w) / 2, y: canvasH * 0.3 + Math.random() * 60, w, h: 40, rotation: 0, data: t.data, fontSize: t.fontSize, fill: t.fill, fontFamily: brandAssets?.font || "'Bai Jamjuree', sans-serif" };
        } else if (type === 'label_certs') {
            const raw = labelData?.certifications;
            const certs = Array.isArray(raw) ? raw : (() => { try { return JSON.parse(raw || '[]'); } catch { return []; } })();
            // ตรารับรองถูกเก็บเป็น { id, url } → เพิ่มเป็น "รูปภาพ" แต่ละตราให้ลาก/ปรับขนาดได้
            const urls = certs.map(c => (typeof c === 'object' && c ? c.url : null)).filter(Boolean);
            if (!urls.length) return;
            const size = canvasW * 0.12;
            const gap = size * 0.28;
            const totalW = urls.length * size + (urls.length - 1) * gap;
            const startX = Math.max(0, (canvasW - totalW) / 2);
            const y = canvasH * 0.82;
            const newEls = urls.map((url, i) => ({
                id: `el_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 5)}`,
                type: 'image', x: startX + i * (size + gap), y, w: size, h: size, rotation: 0, src: url,
            }));
            setPanelDesigns(prev => {
                const d = { ...prev[activePanel.id] };
                d.elements = [...d.elements, ...newEls];
                return { ...prev, [activePanel.id]: d };
            });
            setSelectedElId(newEls[newEls.length - 1].id);
            return;
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

    // === Export Illustrator แบบเวกเตอร์ (เหมือน Label): ข้อความ outline + object แยกชิ้น + CMYK + bleed ===
    const handleExportAi = async () => {
        if (!materialData || panels.length === 0) return;
        if (!savedMockupId) { await handleSave(); }
        setIsExporting(true);
        const origIdx = activePanelIdx;
        try {
            const dieW = parseFloat(materialData.dieline_width_mm);
            const dieH = parseFloat(materialData.dieline_height_mm);
            const fontFamily = (brandAssets?.font || 'Bai Jamjuree').replace(/['"]/g, '').split(',')[0].trim();

            const measureCtx = document.createElement('canvas').getContext('2d');
            const wrap = (text, fontPx, fam, maxWpx) => {
                measureCtx.font = `${fontPx}px ${fam}, sans-serif`;
                const out = [];
                for (const para of String(text ?? '').split('\n')) {
                    if (!maxWpx || maxWpx <= 0) { out.push(para); continue; }
                    const words = para.split(/(\s+)/); let cur = '';
                    for (const w of words) {
                        const t = cur + w;
                        if (measureCtx.measureText(t).width > maxWpx && cur.trim() !== '') { out.push(cur.trimEnd()); cur = w.trimStart(); }
                        else cur = t;
                    }
                    out.push(cur.trimEnd());
                }
                return out.length ? out : [String(text ?? '')];
            };
            const urlToDataUrl = async (url) => {
                if (!url) return null;
                if (url.startsWith('data:')) return url;
                try { const res = await fetch(url, { mode: 'cors' }); const blob = await res.blob(); return await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.onerror = () => r(null); fr.readAsDataURL(blob); }); }
                catch (e) { return null; }
            };
            const loadImage = (src) => new Promise((res) => { const im = new window.Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });

            // พื้นหลังของ panel (สี + รูป) → dataURL (null = ใช้สีล้วน)
            const buildPanelBg = async (p, design) => {
                const scale = 4, cw = Math.max(1, Math.round(p.w_mm * scale)), ch = Math.max(1, Math.round(p.h_mm * scale));
                const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
                const ctx = cv.getContext('2d');
                ctx.fillStyle = design?.bg_color || '#FFFFFF'; ctx.fillRect(0, 0, cw, ch);
                let hasImg = false;
                if (design?.bg_mode === 'dalle' && aiDielineBgImg) {
                    const iw = aiDielineBgImg.naturalWidth || aiDielineBgImg.width, ih = aiDielineBgImg.naturalHeight || aiDielineBgImg.height;
                    ctx.globalAlpha = design?.bg_opacity ?? 1;
                    ctx.drawImage(aiDielineBgImg, p.x_mm * (iw / dieW), p.y_mm * (ih / dieH), p.w_mm * (iw / dieW), p.h_mm * (ih / dieH), 0, 0, cw, ch);
                    ctx.globalAlpha = 1; hasImg = true;
                } else if (design?.bg_mode === 'upload' && design?.bg_image_url) {
                    const src = design.bg_image_url.startsWith('http') ? design.bg_image_url : `${API}${design.bg_image_url}`;
                    const im = await loadImage(src);
                    if (im) { ctx.globalAlpha = design?.bg_opacity ?? 1; ctx.drawImage(im, 0, 0, cw, ch); ctx.globalAlpha = 1; hasImg = true; }
                }
                return hasImg ? cv.toDataURL('image/png') : null;
            };

            const outPanels = [];
            for (let i = 0; i < panels.length; i++) {
                const p = panels[i];
                const design = panelDesigns[p.id] || { bg_color: '#FFFFFF', elements: [] };
                const mmToPx = Math.min(700 / p.w_mm, 600 / p.h_mm);

                setActivePanelIdx(i);
                await new Promise(r => setTimeout(r, 400)); // รอ stage เรนเดอร์ + รูปโหลด
                const stage = stageRef.current;

                const bgDataUrl = await buildPanelBg(p, design);
                const els = [];
                for (const el of (design.elements || [])) {
                    if (el.hidden) continue;
                    if (el.type === 'text') {
                        const fontPx = el.fontSize || 20;
                        els.push({
                            type: 'text',
                            x_mm: el.x / mmToPx, y_mm: el.y / mmToPx, w_mm: (el.w || 0) / mmToPx,
                            fontMm: fontPx / mmToPx, color: el.fill || '#222', weight: (el.fontStyle === 'bold' ? 700 : 400),
                            align: el.align || 'left', lines: wrap(el.data, fontPx, el.fontFamily || fontFamily, el.w),
                        });
                    } else {
                        // รูป/โลโก้/ตรา/รูปทรง/บาร์โค้ด/QR → จับ node เป็นรูปแยกชิ้น
                        let dataUrl = null, box = null;
                        const node = stage?.findOne('#' + el.id);
                        if (node) {
                            try { dataUrl = node.toDataURL({ pixelRatio: 3 }); } catch (e) { dataUrl = null; }
                            const r = node.getClientRect({ skipShadow: true });
                            box = { x: r.x, y: r.y, w: r.width, h: r.height };
                        }
                        if (!dataUrl && el.type === 'image' && el.src) { dataUrl = await urlToDataUrl(el.src); box = { x: el.x, y: el.y, w: el.w, h: el.h }; }
                        if (dataUrl && box) {
                            els.push({ type: 'image', x_mm: box.x / mmToPx, y_mm: box.y / mmToPx, w_mm: box.w / mmToPx, h_mm: box.h / mmToPx, dataUrl });
                        }
                    }
                }
                outPanels.push({ x_mm: p.x_mm, y_mm: p.y_mm, w_mm: p.w_mm, h_mm: p.h_mm, bgColor: design.bg_color || '#FFFFFF', bgDataUrl, elements: els });
            }
            setActivePanelIdx(origIdx);

            const payload = { product_name: product.name_product || 'design', bleed_mm: 3, font_family: fontFamily, dieline: { w_mm: dieW, h_mm: dieH }, panels: outPanels };
            const r = await fetch(`${API}/api/mockups/export-vector-ai`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || 'Export failed'); }
            const blob = await r.blob();
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `package_design_${product.name_product || 'design'}_CMYK.ai`;
            document.body.appendChild(link); link.click(); document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        } catch (err) {
            console.error('Mockup vector export error:', err);
            alert('Export Illustrator ไม่สำเร็จ: ' + err.message);
            setActivePanelIdx(origIdx);
        } finally { setIsExporting(false); }
    };

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
            <div className="pkgdesign-loading">
                <iconify-icon icon="mdi:loading" className="spin"></iconify-icon>
                <div>กำลังโหลดข้อมูลบรรจุภัณฑ์...</div>
            </div>
        );
    }

    return (
        <div className="pkgdesign-root">
            {/* === SIDEBAR === */}
            <div className={`pkgdesign-sidebar${sidebarOpen ? '' : ' pkgdesign-panel-collapsed'}`}>
                <button onClick={onBack} className="back-link">
                    <iconify-icon icon="mdi:chevron-left"></iconify-icon> กลับ
                </button>
                <h3 className="pkgdesign-title">ออกแบบบรรจุภัณฑ์</h3>
                <p className="pkgdesign-subtitle">{product.name_product} — {materialData.name}</p>

                {/* Panel Selector */}
                <div className="panel-selector">
                    <div className="panel-selector-label">เลือกด้าน</div>
                    <div className="panel-selector-list">
                        {panels.map((p, idx) => (
                            <button key={p.id} onClick={() => { setActivePanelIdx(idx); setSelectedElId(null); }}
                                className={`panel-chip ${idx === activePanelIdx ? 'panel-chip-active' : ''}`}>
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* === Background Section === */}
                <SidebarSection title={<><iconify-icon icon="mdi:palette"></iconify-icon> Background</>} open={openSections.bg} onToggle={() => toggleSection('bg')}>
                    {/* AI Background */}
                    <div className="ai-bg-block">
                        <div className="ai-bg-label">AI สร้างฉากหลัง ✨</div>
                        <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
                            placeholder="เช่น: ลายใบไม้ สีเขียวอ่อน ฟีลธรรมชาติ สไตล์ organic"
                            className="ai-bg-textarea" />
                        <button onClick={generateAiBg} disabled={isAiGenerating || !aiPrompt.trim()}
                            className="ai-bg-generate-btn">
                            {isAiGenerating ? <><iconify-icon icon="mdi:loading" className="spin"></iconify-icon> กำลังสร้าง...</> : <>สร้างฉากหลัง AI</>}
                        </button>
                    </div>

                    {/* AI BG History */}
                    {aiBgHistory.length > 0 && (
                        <div className="ai-bg-history">
                            <div className="ai-bg-history-label">ประวัติ AI ({aiBgHistory.length})</div>
                            <div className="ai-bg-history-list">
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
                                        className={`ai-bg-history-thumb ${aiDielineBgUrl === h.image_url ? 'ai-bg-history-thumb-active' : ''}`}>
                                        <img src={`${API}${h.image_url}`} alt="" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="bg-manual-divider">
                        <div className="bg-manual-label">Manual (ด้านนี้เท่านั้น)</div>
                    </div>

                    {/* Solid Color */}
                    <div className="bg-color-row">
                        <input type="color" value={currentDesign?.bg_color || '#FFFFFF'}
                            onChange={e => activePanel && updateDesign(activePanel.id, { bg_mode: 'solid', bg_color: e.target.value })}
                            className="bg-color-swatch-input" />
                        <input type="text" value={currentDesign?.bg_color || '#FFFFFF'}
                            onChange={e => activePanel && updateDesign(activePanel.id, { bg_mode: 'solid', bg_color: e.target.value })}
                            className="bg-color-text-input" />
                    </div>

                    {/* Brand color swatches */}
                    {brandAssets?.colors?.length > 0 && (
                        <div className="brand-color-swatches">
                            {brandAssets.colors.map(c => (
                                <button key={c} onClick={() => activePanel && updateDesign(activePanel.id, { bg_mode: 'solid', bg_color: c })}
                                    className="brand-color-swatch" style={{ background: c }} />
                            ))}
                        </div>
                    )}

                    {/* Upload BG image */}
                    <label className="upload-bg-label">
                        <iconify-icon icon="mdi:image-plus"></iconify-icon> อัพโหลดรูป Background
                        <input type="file" accept="image/*" onChange={handleBgImageUpload} className="visually-hidden-input" />
                    </label>

                    {/* Opacity */}
                    <div className="bg-opacity-row">
                        <span className="bg-opacity-label">ความโปร่งใส</span>
                        <input type="range" min="0" max="1" step="0.05" value={currentDesign?.bg_opacity ?? 1}
                            onChange={e => activePanel && updateDesign(activePanel.id, { bg_opacity: parseFloat(e.target.value) })}
                            className="bg-opacity-slider" />
                    </div>
                </SidebarSection>

                {/* === Text Section === */}
                <SidebarSection title={<><iconify-icon icon="mdi:format-text"></iconify-icon> ข้อความ</>} open={openSections.text} onToggle={() => toggleSection('text')}>
                    <button onClick={() => addElement('text')} className="add-text-btn">
                        + เพิ่มข้อความ
                    </button>
                    {selectedEl?.type === 'text' && (
                        <div className="text-controls">
                            <input type="text" value={selectedEl.data} onChange={e => updateElement(activePanel.id, selectedEl.id, { data: e.target.value })}
                                className="text-content-input" />
                            <div className="text-style-row">
                                <input type="number" value={selectedEl.fontSize} onChange={e => updateElement(activePanel.id, selectedEl.id, { fontSize: parseInt(e.target.value) || 16 })}
                                    className="text-fontsize-input" />
                                <input type="color" value={selectedEl.fill || '#222'} onChange={e => updateElement(activePanel.id, selectedEl.id, { fill: e.target.value })}
                                    className="text-color-input" />
                            </div>
                        </div>
                    )}
                </SidebarSection>

                {/* === Image Section === */}
                <SidebarSection title={<><iconify-icon icon="mdi:image-outline"></iconify-icon> รูปภาพ / โลโก้</>} open={openSections.image} onToggle={() => toggleSection('image')}>
                    <div className="image-section-buttons">
                        <label className="upload-image-label">
                            <iconify-icon icon="mdi:image-plus"></iconify-icon> อัพโหลดรูป
                            <input type="file" accept="image/*" onChange={handleImageUpload} className="visually-hidden-input" />
                        </label>
                        {brandAssets?.logoUrl && (
                            <button onClick={() => addElement('logo')} className="add-logo-btn">
                                <iconify-icon icon="mdi:crown"></iconify-icon> ใส่โลโก้แบรนด์
                            </button>
                        )}
                    </div>
                </SidebarSection>

                {/* === Shape Section === */}
                <SidebarSection title={<><iconify-icon icon="mdi:shape-outline"></iconify-icon> รูปทรง</>} open={openSections.shape} onToggle={() => toggleSection('shape')}>
                    {/* Shape category tabs */}
                    <div className="shape-tabs">
                        {['ทั้งหมด', 'พื้นฐาน', 'กรอบ', 'ตกแต่ง'].map(tab => (
                            <button key={tab} onClick={() => setShapeTab(tab)}
                                className={`shape-tab ${shapeTab === tab ? 'shape-tab-active' : ''}`}>
                                {tab}
                            </button>
                        ))}
                    </div>
                    {/* Shape icon grid — filtered by tab */}
                    <div className="shape-grid">
                        {[
                            { type: 'rect',       icon: 'mdi:square-outline',           label: 'สี่เหลี่ยม',   tab: 'พื้นฐาน' },
                            { type: 'rect_round', icon: 'mdi:square-rounded-outline',   label: 'มนเหลี่ยม',  tab: 'พื้นฐาน' },
                            { type: 'circle',     icon: 'mdi:circle-outline',           label: 'วงกลม',       tab: 'พื้นฐาน' },
                            { type: 'triangle',   icon: 'mdi:triangle-outline',         label: 'สามเหลี่ยม', tab: 'พื้นฐาน' },
                            { type: 'diamond',    icon: 'mdi:rhombus-outline',          label: 'ข้าวหลามตัด', tab: 'ตกแต่ง' },
                            { type: 'star',       icon: 'mdi:star-outline',             label: 'ดาว',         tab: 'ตกแต่ง' },
                            { type: 'hexagon',    icon: 'mdi:hexagon-outline',          label: 'หกเหลี่ยม',  tab: 'กรอบ' },
                            { type: 'arrow',      icon: 'mdi:arrow-right-bold-outline', label: 'ลูกศร',       tab: 'ตกแต่ง' },
                            { type: 'octagon',    icon: 'mdi:octagon-outline',          label: 'แปดเหลี่ยม', tab: 'กรอบ' },
                            { type: 'ellipse',    icon: 'mdi:ellipse-outline',          label: 'วงรี',        tab: 'พื้นฐาน' },
                            { type: 'speech',     icon: 'mdi:chat-outline',             label: 'บอลลูน',      tab: 'ตกแต่ง' },
                            { type: 'heart',      icon: 'mdi:cards-heart-outline',      label: 'หัวใจ',       tab: 'ตกแต่ง' },
                        ]
                            .filter(s => shapeTab === 'ทั้งหมด' || s.tab === shapeTab)
                            .map(s => (
                                <button key={s.type} onClick={() => addElement(s.type)}
                                    className="shape-grid-btn" title={s.label}>
                                    <iconify-icon icon={s.icon}></iconify-icon>
                                </button>
                            ))
                        }
                    </div>
                    {/* Fill color quick-picker — always visible; active only when a shape is selected */}
                    <div className={`shape-fill-section${selectedEl && (selectedEl.type === 'shape' || selectedEl.type === 'circle') ? ' shape-fill-section-active' : ''}`}>
                        <div className="shape-fill-row">
                            <span className="shape-fill-label">สีเติม</span>
                            <input type="color"
                                value={(selectedEl && (selectedEl.type === 'shape' || selectedEl.type === 'circle')) ? (selectedEl.fill || '#cccccc') : '#cccccc'}
                                disabled={!(selectedEl && (selectedEl.type === 'shape' || selectedEl.type === 'circle'))}
                                onChange={e => selectedEl && updateElement(activePanel.id, selectedEl.id, { fill: e.target.value })}
                                className="shape-fill-swatch" />
                            {brandAssets?.colors?.length > 0 && (
                                <div className="shape-fill-swatches">
                                    {brandAssets.colors.map((c, i) => (
                                        <button key={i}
                                            disabled={!(selectedEl && (selectedEl.type === 'shape' || selectedEl.type === 'circle'))}
                                            onClick={() => selectedEl && updateElement(activePanel.id, selectedEl.id, { fill: c })}
                                            className="brand-color-swatch" style={{ background: c }} />
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="shape-opacity-row">
                            <span className="shape-fill-label">ความทึบ</span>
                            <input
                                type="range" min={0} max={1} step={0.01}
                                value={(selectedEl && (selectedEl.type === 'shape' || selectedEl.type === 'circle')) ? (selectedEl.opacity ?? 1) : 1}
                                disabled={!(selectedEl && (selectedEl.type === 'shape' || selectedEl.type === 'circle'))}
                                onChange={e => selectedEl && updateElement(activePanel.id, selectedEl.id, { opacity: parseFloat(e.target.value) })}
                                className="shape-opacity-slider" />
                            <span className="shape-fill-opacity">
                                {Math.round(((selectedEl && (selectedEl.type === 'shape' || selectedEl.type === 'circle')) ? (selectedEl.opacity ?? 1) : 1) * 100)}%
                            </span>
                        </div>
                        {!(selectedEl && (selectedEl.type === 'shape' || selectedEl.type === 'circle')) && (
                            <div className="shape-fill-hint">เลือกรูปทรงเพื่อแก้ไขสี</div>
                        )}
                    </div>
                </SidebarSection>

                {/* === Import Label === */}
                <SidebarSection title={<><iconify-icon icon="mdi:clipboard-text-outline"></iconify-icon> Import จากฉลาก</>} open={openSections.label} onToggle={() => toggleSection('label')}>
                    {!labelData ? (
                        <div className="no-label-msg">ยังไม่มีฉลากที่ออกแบบไว้</div>
                    ) : (
                        <div className="label-import-list">
                            <div className="label-import-group-title">วางฉลากทั้งชิ้น</div>
                            <LabelPartBtn icon="mdi:label-outline" label="ฉลากเต็ม (รูปภาพ)" available={!!(labelImageUrl || labelData?.final_label_url)} onClick={() => addElement('label_import')} />

                            <div className="label-import-group-title">ข้อมูลสินค้า</div>
                            <LabelPartBtn icon="mdi:tag-text-outline" label="ชื่อสินค้า" detail={labelData?.product_name} available={!!labelData?.product_name} onClick={() => addElement('label_text_product_name')} />
                            <LabelPartBtn icon="mdi:star-four-points-outline" label="Tagline" detail={labelData?.tagline} available={!!labelData?.tagline} onClick={() => addElement('label_text_tagline')} />
                            <LabelPartBtn icon="mdi:scale-balance" label="น้ำหนักสุทธิ" detail={labelData?.net_weight} available={!!labelData?.net_weight} onClick={() => addElement('label_text_net_weight')} />
                            <LabelPartBtn icon="mdi:text-box-outline" label="ส่วนประกอบ" available={!!labelData?.ingredients} onClick={() => addElement('label_text_ingredients')} />

                            <div className="label-import-group-title">คำแนะนำ / คำเตือน</div>
                            <LabelPartBtn icon="mdi:book-open-variant" label="วิธีใช้" available={!!labelData?.usage_instruction} onClick={() => addElement('label_text_usage')} />
                            <LabelPartBtn icon="mdi:home-outline" label="วิธีเก็บรักษา" available={!!labelData?.storage_instruction} onClick={() => addElement('label_text_storage')} />
                            <LabelPartBtn icon="mdi:alert-outline" label="คำเตือน" available={!!labelData?.warnings} onClick={() => addElement('label_text_warnings')} />

                            <div className="label-import-group-title">ข้อมูลทางกฎหมาย</div>
                            <LabelPartBtn icon="mdi:factory" label="ผู้ผลิต" available={!!labelData?.manufacturer_info} onClick={() => addElement('label_text_manufacturer')} />
                            <LabelPartBtn icon="mdi:bookmark-outline" label="เลข อย." detail={labelData?.fda_number} available={!!labelData?.fda_number} onClick={() => addElement('label_text_fda')} />
                            <LabelPartBtn icon="mdi:calendar-outline" label="MFG / EXP" available={!!(labelData?.mfg_date || labelData?.exp_date)} onClick={() => addElement('label_text_dates')} />
                            <LabelPartBtn icon="mdi:pound" label="LOT" detail={labelData?.lot_number} available={!!labelData?.lot_number} onClick={() => addElement('label_text_lot')} />

                            <div className="label-import-group-title">โลโก้ / เครื่องหมาย</div>
                            <LabelPartBtn icon="mdi:crown" label="โลโก้แบรนด์" available={!!brandAssets?.logoUrl} onClick={() => addElement('label_logo')} />
                            <LabelPartBtn icon="mdi:medal-outline" label="ตรารับรอง" detail={(() => { try { const c = Array.isArray(labelData?.certifications) ? labelData.certifications : JSON.parse(labelData?.certifications || '[]'); return c.length ? `${c.length} ตรา` : ''; } catch { return ''; } })()} available={!!(labelData?.certifications?.length)} onClick={() => addElement('label_certs')} />

                            <div className="label-import-group-title">Barcode / QR Code</div>
                            <LabelPartBtn icon="mdi:barcode" label="Barcode (EAN-13)" detail={labelData?.barcode_value} available={true} onClick={() => addElement('barcode')} />
                            <LabelPartBtn icon="mdi:qrcode" label="QR Code" detail={labelData?.qr_code_value} available={true} onClick={() => addElement('qrcode')} />
                        </div>
                    )}
                </SidebarSection>

                {/* === Export Block === */}
                <div className="save-export-block">
                    {/* Primary: PNG download */}
                    <button onClick={handleExportPng} disabled={isExporting} className="export-primary-btn">
                        <span className="export-primary-icon"><iconify-icon icon="mdi:download"></iconify-icon></span>
                        <span className="export-primary-text">
                            <span className="export-primary-label">ดาวน์โหลด PNG</span>
                            <span className="export-primary-sub">ไฟล์ภาพความละเอียดสูง</span>
                        </span>
                    </button>

                    {/* Secondary: print-ready formats */}
                    <div className="export-pro-label">
                        <iconify-icon icon="mdi:crown"></iconify-icon> สำหรับงานพิมพ์ (Pro)
                    </div>
                    <div className="export-buttons-row">
                        <button onClick={() => { if (!isProUser(getUserFromStorage())) { setShowProModal(true); return; } handleExportPdf(); }}
                            disabled={isExporting}
                            className={`export-btn ${!isProUser(getUserFromStorage()) ? 'export-btn-locked' : ''}`}>
                            <iconify-icon icon="mdi:file-pdf-box"></iconify-icon>
                            <span>PDF</span>
                            {!isProUser(getUserFromStorage()) && <iconify-icon icon="solar:lock-keyhole-linear" width="11" className="lock-icon"></iconify-icon>}
                        </button>
                        <button onClick={() => { if (!isProUser(getUserFromStorage())) { setShowProModal(true); return; } handleExportAi(); }}
                            disabled={isExporting}
                            className={`export-btn ${!isProUser(getUserFromStorage()) ? 'export-btn-locked' : ''}`}>
                            <iconify-icon icon="mdi:adobe"></iconify-icon>
                            <span>Illustrator</span>
                            {!isProUser(getUserFromStorage()) && <iconify-icon icon="solar:lock-keyhole-linear" width="11" className="lock-icon"></iconify-icon>}
                        </button>
                    </div>
                    <div className="export-hint">CMYK · crop marks · fold lines</div>

                    {saveMsg && <div className="save-msg save-msg-success"><iconify-icon icon="mdi:check-circle-outline"></iconify-icon> {saveMsg}</div>}
                    {saveStatus && !saveMsg && <div className={`save-status ${saveStatus.includes('ไม่') ? 'save-status-error' : 'save-status-success'}`}>{saveStatus}</div>}
                </div>

                {/* === AI Mockup Preview === */}
                <div className="ai-mockup-block">
                    <div className="ai-mockup-title">
                        <iconify-icon icon="mdi:cube-scan"></iconify-icon>
                        AI สร้างภาพ Mockup สมบูรณ์
                    </div>
                    <div className="ai-mockup-desc">
                        เลือกด้านที่จะแสดง แล้วให้ AI สร้างภาพ 3D Mockup สมจริง
                    </div>

                    {/* Panel selection checkboxes */}
                    <div className="ai-mockup-panel-select">
                        <div className="ai-mockup-panel-select-label">เลือกด้านที่จะใช้:</div>
                        <div className="ai-mockup-panel-select-list">
                            {panels.map(p => (
                                <label key={p.id} className={`ai-mockup-panel-chip ${mockupPanelSelection[p.id] ? 'ai-mockup-panel-chip-active' : ''}`}>
                                    <input type="checkbox" checked={!!mockupPanelSelection[p.id]}
                                        onChange={e => setMockupPanelSelection(prev => ({ ...prev, [p.id]: e.target.checked }))}
                                        className="ai-mockup-panel-checkbox" />
                                    {p.label}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Background style selector */}
                    <div className="ai-mockup-bgstyle-select">
                        <div className="ai-mockup-bgstyle-label">พื้นหลัง:</div>
                        <div className="ai-mockup-bgstyle-list">
                            {[
                                { key: 'white', label: 'ขาว', color: '#fff' },
                                { key: 'wood', label: 'ไม้', color: '#d4a574' },
                                { key: 'marble', label: 'หินอ่อน', color: '#e8e0d8' },
                                { key: 'nature', label: 'ธรรมชาติ', color: '#86efac' },
                                { key: 'gradient', label: 'สตูดิโอ', color: '#c4b5fd' },
                            ].map(bg => (
                                <button key={bg.key} onClick={() => setMockupBgStyle(bg.key)}
                                    className={`ai-mockup-bgstyle-chip ${mockupBgStyle === bg.key ? 'ai-mockup-bgstyle-chip-active' : ''}`}>
                                    {bg.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button onClick={handleGenMockup} disabled={isGenMockup || panels.length === 0} className="ai-mockup-generate-btn">
                        {isGenMockup ? (
                            <><iconify-icon icon="mdi:loading" className="spin"></iconify-icon> {mockupProgress?.message || 'กำลังสร้าง...'}</>
                        ) : (
                            <><iconify-icon icon="mdi:cube-scan"></iconify-icon> สร้างภาพ Mockup ({panels.filter(p => mockupPanelSelection[p.id]).length} ด้าน)</>
                        )}
                    </button>

                    {/* Progress */}
                    {isGenMockup && mockupProgress && (
                        <div className="ai-mockup-progress">
                            <div className="ai-mockup-progress-track">
                                <div className="ai-mockup-progress-fill" style={{ width: `${(mockupProgress.step / mockupProgress.total) * 100}%` }} />
                            </div>
                            <div className="ai-mockup-progress-text">
                                ขั้นตอน {mockupProgress.step}/{mockupProgress.total}
                            </div>
                        </div>
                    )}

                    {/* Result preview — click to open popup */}
                    {aiMockupPreviewUrl && (
                        <div className="ai-mockup-result">
                            <img src={aiMockupPreviewUrl} alt="AI Mockup"
                                onClick={() => setLightboxUrl(aiMockupPreviewUrl)}
                                className="ai-mockup-result-img" />
                            <div className="ai-mockup-result-hint">คลิกเพื่อขยาย</div>
                        </div>
                    )}

                    {/* Mockup History */}
                    {mockupHistory.length > 0 && (
                        <div className="ai-mockup-history">
                            <div className="ai-mockup-history-label">ประวัติ Mockup ({mockupHistory.length})</div>
                            <div className="ai-mockup-history-list">
                                {mockupHistory.map(h => (
                                    <div key={h.history_id}
                                        onClick={() => setLightboxUrl(`${API}${h.image_url}`)}
                                        className="ai-mockup-history-thumb">
                                        <img src={`${API}${h.image_url}`} alt="" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="ai-mockup-credit-note">ใช้ Gemini AI Credit</div>
                </div>
            </div>

            {/* === CANVAS AREA === */}
            <div className="pkgdesign-canvas-area">
                {/* Panel info */}
                <div className="canvas-panel-nav">
                    <div className="canvas-panel-nav-left">
                        <button onClick={() => setSidebarOpen(o => !o)} title={sidebarOpen ? 'ซ่อนแผงด้านซ้าย' : 'แสดงแผงด้านซ้าย'}
                            className="canvas-panel-toggle-btn">
                            <iconify-icon icon={sidebarOpen ? 'mdi:page-first' : 'mdi:page-last'}></iconify-icon>
                        </button>
                        <button onClick={() => { const prev = (activePanelIdx - 1 + panels.length) % panels.length; setActivePanelIdx(prev); setSelectedElId(null); }}
                            className="canvas-panel-nav-btn"><iconify-icon icon="mdi:chevron-left"></iconify-icon></button>
                        <span className="canvas-panel-nav-label">
                            {activePanel?.label} ({activePanel?.w_mm} × {activePanel?.h_mm} mm)
                        </span>
                        <button onClick={() => { const next = (activePanelIdx + 1) % panels.length; setActivePanelIdx(next); setSelectedElId(null); }}
                            className="canvas-panel-nav-btn"><iconify-icon icon="mdi:chevron-right"></iconify-icon></button>
                    </div>
                    <div className="canvas-panel-nav-right">
                        <button onClick={handleSave} disabled={isSaving} className="canvas-save-btn">
                            <iconify-icon icon="mdi:content-save-outline"></iconify-icon>
                            {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
                        </button>
                        <button onClick={() => setPropsPanelOpen(o => !o)} title={propsPanelOpen ? 'ซ่อนแผงด้านขวา' : 'แสดงแผงด้านขวา'}
                            className="canvas-panel-toggle-btn">
                            <iconify-icon icon={propsPanelOpen ? 'mdi:page-last' : 'mdi:page-first'}></iconify-icon>
                        </button>
                    </div>
                </div>

                {/* Canvas + Mini Map side by side */}
                <div className="canvas-body">
                    {/* Scrollable canvas area — only stage scales */}
                    <div className="canvas-scroll-area" onWheel={e => {
                        if (!e.ctrlKey) return;
                        e.preventDefault();
                        const dir = e.deltaY < 0 ? 1 : -1;
                        setStageScale(s => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, parseFloat((s + dir * ZOOM_STEP).toFixed(2)))));
                    }}>
                        <div className="canvas-center-container">
                            <div className="canvas-stage-scaler" style={{ transform: `scale(${stageScale})`, transformOrigin: 'center top' }}>
                                <div className="canvas-stage-wrapper">
                                    <Stage ref={stageRef} width={canvasW} height={canvasH} onClick={handleStageClick}>
                                        <Layer>
                                            {/* Background */}
                                            <PanelBackground design={currentDesign} width={canvasW} height={canvasH}
                                                panel={activePanel} panels={panels} materialData={materialData}
                                                aiDielineBgImg={aiDielineBgImg} />

                                            {/* Elements */}
                                            {currentDesign?.elements?.map(el => (
                                                <PanelElement key={el.id} el={el} isSelected={el.id === selectedElId}
                                                    canvasW={canvasW} canvasH={canvasH}
                                                    onCenterGuide={setCenterGuide}
                                                    onSelect={() => setSelectedElId(el.id)}
                                                    onChange={(updates) => updateElement(activePanel.id, el.id, updates)} />
                                            ))}

                                            {/* เส้นกึ่งกลางกระดาษ (สีส้มของเว็บ) — แสดงเมื่อวัตถุอยู่กึ่งกลางพอดี */}
                                            {centerGuide.v && <KLine points={[canvasW / 2, 0, canvasW / 2, canvasH]} stroke="#E8541F" strokeWidth={1.5} dash={[7, 5]} listening={false} />}
                                            {centerGuide.h && <KLine points={[0, canvasH / 2, canvasW, canvasH / 2]} stroke="#E8541F" strokeWidth={1.5} dash={[7, 5]} listening={false} />}

                                            <Transformer ref={trRef}
                                                boundBoxFunc={(oldB, newB) => newB.width < 10 ? oldB : newB}
                                                rotateEnabled={true} keepRatio={false} />
                                        </Layer>
                                    </Stage>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Die-line mini map — fixed position, never scales */}
                    <div className="canvas-minimap-panel">
                        <DielineMiniMap panels={panels} activePanelIdx={activePanelIdx} onClickPanel={idx => { setActivePanelIdx(idx); setSelectedElId(null); }}
                            materialData={materialData} panelDesigns={panelDesigns} aiDielineBgImg={aiDielineBgImg} />
                    </div>
                </div>

                {/* Bottom toolbar */}
                <div className="canvas-bottom-toolbar">
                    <button className={`canvas-bottom-toolbar-btn${!canUndo ? ' canvas-bottom-toolbar-btn-dim' : ''}`}
                        onClick={handleUndo} disabled={!canUndo} title="ย้อนกลับ (Ctrl+Z)">
                        <iconify-icon icon="mdi:undo"></iconify-icon> ย้อนกลับ
                    </button>
                    <button className={`canvas-bottom-toolbar-btn${!canRedo ? ' canvas-bottom-toolbar-btn-dim' : ''}`}
                        onClick={handleRedo} disabled={!canRedo} title="ทำซ้ำ (Ctrl+Y)">
                        <iconify-icon icon="mdi:redo"></iconify-icon> ทำซ้ำ
                    </button>
                    <div className="canvas-bottom-toolbar-divider"></div>
                    <button className="canvas-bottom-toolbar-btn" onClick={handleZoomOut} disabled={stageScale <= ZOOM_MIN} title="ซูมออก">
                        <iconify-icon icon="mdi:minus"></iconify-icon>
                    </button>
                    <button className="canvas-bottom-toolbar-zoom-label" onClick={() => setStageScale(1)} title="รีเซ็ตซูม">
                        {Math.round(stageScale * 100)}%
                    </button>
                    <button className="canvas-bottom-toolbar-btn" onClick={handleZoomIn} disabled={stageScale >= ZOOM_MAX} title="ซูมเข้า">
                        <iconify-icon icon="mdi:plus"></iconify-icon>
                    </button>
                    <div className="canvas-bottom-toolbar-divider"></div>
                    <button className="canvas-bottom-toolbar-btn" onClick={handleFitToScreen} title="พอดีจอ">
                        <iconify-icon icon="mdi:fit-to-screen-outline"></iconify-icon> พอดีจอ
                    </button>
                    <div className="canvas-bottom-toolbar-divider"></div>
                    <button className="canvas-bottom-toolbar-btn canvas-bottom-toolbar-btn-reset"
                        onClick={() => { setStageScale(1); }}
                        title="รีเซ็ตซูม 100%">
                        <iconify-icon icon="mdi:restore"></iconify-icon> รีเซ็ต
                    </button>
                </div>
            </div>

            {/* === RIGHT PROPERTIES PANEL === */}
            <div className={`pkgdesign-props-panel${propsPanelOpen ? '' : ' pkgdesign-panel-collapsed'}`}>
                {/* Tabs */}
                <div className="props-tabs">
                    <button
                        className={`props-tab ${propsPanelTab === 'จัดการชั้น' ? 'props-tab-active' : ''}`}
                        onClick={() => setPropsPanelTab('จัดการชั้น')}>จัดการชั้น</button>
                    <button
                        className={`props-tab ${propsPanelTab === 'คุณสมบัติ' ? 'props-tab-active' : ''}`}
                        onClick={() => setPropsPanelTab('คุณสมบัติ')}>คุณสมบัติ</button>
                </div>

                {/* Layer manager tab */}
                {propsPanelTab === 'จัดการชั้น' && (
                    <div className="props-layers-list">
                        {(currentDesign?.elements?.length ?? 0) === 0 ? (
                            <div className="props-empty">
                                <div className="props-empty-icon"><iconify-icon icon="mdi:layers-outline"></iconify-icon></div>
                                <div className="props-empty-text">ยังไม่มีออบเจ็กต์</div>
                            </div>
                        ) : (
                            [...(currentDesign?.elements || [])].reverse().map((el, revIdx) => {
                                const realIdx = (currentDesign.elements.length - 1) - revIdx;
                                const isActive = el.id === selectedElId;
                                const label = el.type === 'text' ? (el.data?.slice(0, 18) || 'ข้อความ')
                                    : el.type === 'image' ? 'รูปภาพ'
                                    : el.type === 'barcode' ? 'Barcode'
                                    : el.type === 'qrcode' ? 'QR Code'
                                    : el.shapeKind ? el.shapeKind : 'รูปทรง';
                                const icon = el.type === 'text' ? 'mdi:format-text'
                                    : el.type === 'image' ? 'mdi:image-outline'
                                    : el.type === 'barcode' ? 'mdi:barcode'
                                    : el.type === 'qrcode' ? 'mdi:qrcode'
                                    : 'mdi:shape-outline';
                                return (
                                    <div key={el.id}
                                        className={`props-layer-item ${isActive ? 'props-layer-item-active' : ''} ${el.hidden ? 'props-layer-item-hidden' : ''}`}
                                        onClick={() => setSelectedElId(el.id)}>
                                        <iconify-icon icon={icon} className="props-layer-item-icon"></iconify-icon>
                                        <span className="props-layer-item-label">{label}</span>
                                        <div className="props-layer-item-actions">
                                            {/* Eye toggle */}
                                            <button
                                                className={`props-layer-item-btn props-layer-item-eye ${el.hidden ? 'props-layer-item-eye-off' : ''}`}
                                                title={el.hidden ? 'แสดง' : 'ซ่อน'}
                                                onClick={e => { e.stopPropagation(); updateElement(activePanel.id, el.id, { hidden: !el.hidden }); }}>
                                                <iconify-icon icon={el.hidden ? 'mdi:eye-off-outline' : 'mdi:eye-outline'}></iconify-icon>
                                            </button>
                                            <button className="props-layer-item-btn" title="ขึ้น"
                                                onClick={e => { e.stopPropagation(); setPanelDesigns(prev => { const d = {...prev[activePanel.id]}; const els = [...d.elements]; if (realIdx < els.length-1) { [els[realIdx], els[realIdx+1]] = [els[realIdx+1], els[realIdx]]; } d.elements = els; return {...prev, [activePanel.id]: d}; }); }}>
                                                <iconify-icon icon="mdi:chevron-up"></iconify-icon>
                                            </button>
                                            <button className="props-layer-item-btn" title="ลง"
                                                onClick={e => { e.stopPropagation(); setPanelDesigns(prev => { const d = {...prev[activePanel.id]}; const els = [...d.elements]; if (realIdx > 0) { [els[realIdx], els[realIdx-1]] = [els[realIdx-1], els[realIdx]]; } d.elements = els; return {...prev, [activePanel.id]: d}; }); }}>
                                                <iconify-icon icon="mdi:chevron-down"></iconify-icon>
                                            </button>
                                            <button className="props-layer-item-btn props-layer-item-del" title="ลบ"
                                                onClick={e => { e.stopPropagation(); deleteElement(el.id); }}>
                                                <iconify-icon icon="mdi:close"></iconify-icon>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {/* Properties tab */}
                {propsPanelTab === 'คุณสมบัติ' && (
                    selectedEl ? (
                        <div className="props-body">
                            {/* Element type label with delete */}
                            <div className="props-el-header">
                                <span className="props-el-type-badge">
                                    {selectedEl.type === 'text' ? 'ข้อความ'
                                        : selectedEl.type === 'image' ? 'รูปภาพ'
                                        : selectedEl.type === 'barcode' ? 'บาร์โค้ด'
                                        : selectedEl.type === 'qrcode' ? 'QR Code'
                                        : 'รูปทรง'}
                                </span>
                                <button onClick={() => deleteElement(selectedEl.id)} className="props-delete-btn">
                                    <iconify-icon icon="mdi:delete-outline"></iconify-icon>
                                </button>
                            </div>

                            {/* Position */}
                            <div className="props-section-label">ตำแหน่ง</div>
                            <div className="props-xy-row">
                                <div className="props-field">
                                    <span className="props-field-label">X</span>
                                    <input type="number"
                                        value={Math.round(selectedEl.x / mmToPx * 10) / 10}
                                        onChange={e => {
                                            const val = parseFloat(e.target.value);
                                            if (!isNaN(val)) updateElement(activePanel.id, selectedEl.id, { x: val * mmToPx });
                                        }}
                                        className="props-mm-input" />
                                    <span className="props-field-unit">mm</span>
                                </div>
                                <div className="props-field">
                                    <span className="props-field-label">Y</span>
                                    <input type="number"
                                        value={Math.round(selectedEl.y / mmToPx * 10) / 10}
                                        onChange={e => {
                                            const val = parseFloat(e.target.value);
                                            if (!isNaN(val)) updateElement(activePanel.id, selectedEl.id, { y: val * mmToPx });
                                        }}
                                        className="props-mm-input" />
                                    <span className="props-field-unit">mm</span>
                                </div>
                            </div>

                            {/* Size */}
                            <div className="props-section-label">ขนาด</div>
                            <div className="props-xy-row">
                                <div className="props-field">
                                    <span className="props-field-label">กว้าง</span>
                                    <input type="number"
                                        value={Math.round((selectedEl.type === 'circle' ? (selectedEl.radius || 0) * 2 : (selectedEl.w || 0)) / mmToPx * 10) / 10}
                                        onChange={e => {
                                            const val = parseFloat(e.target.value);
                                            if (isNaN(val) || val <= 0) return;
                                            const pxW = val * mmToPx;
                                            if (selectedEl.type === 'circle') {
                                                const r = pxW / 2;
                                                updateElement(activePanel.id, selectedEl.id, { radius: r, w: pxW, h: pxW });
                                            } else if (aspectLocked && selectedEl.w && selectedEl.h) {
                                                const ratio = selectedEl.h / selectedEl.w;
                                                updateElement(activePanel.id, selectedEl.id, { w: pxW, h: pxW * ratio });
                                            } else {
                                                updateElement(activePanel.id, selectedEl.id, { w: pxW });
                                            }
                                        }}
                                        className="props-mm-input" />
                                    <span className="props-field-unit">mm</span>
                                </div>
                                <button
                                    className={`props-field-lock-btn ${aspectLocked ? 'props-field-lock-btn-on' : ''}`}
                                    title={aspectLocked ? 'ปลดล็อกสัดส่วน' : 'ล็อกสัดส่วน'}
                                    onClick={() => setAspectLocked(v => !v)}>
                                    <iconify-icon icon={aspectLocked ? 'mdi:link-variant' : 'mdi:link-variant-off'}></iconify-icon>
                                </button>
                                <div className="props-field">
                                    <span className="props-field-label">สูง</span>
                                    <input type="number"
                                        value={Math.round((selectedEl.type === 'circle' ? (selectedEl.radius || 0) * 2 : (selectedEl.h || 0)) / mmToPx * 10) / 10}
                                        onChange={e => {
                                            const val = parseFloat(e.target.value);
                                            if (isNaN(val) || val <= 0) return;
                                            const pxH = val * mmToPx;
                                            if (selectedEl.type === 'circle') {
                                                const r = pxH / 2;
                                                updateElement(activePanel.id, selectedEl.id, { radius: r, w: pxH, h: pxH });
                                            } else if (aspectLocked && selectedEl.w && selectedEl.h) {
                                                const ratio = selectedEl.w / selectedEl.h;
                                                updateElement(activePanel.id, selectedEl.id, { h: pxH, w: pxH * ratio });
                                            } else {
                                                updateElement(activePanel.id, selectedEl.id, { h: pxH });
                                            }
                                        }}
                                        className="props-mm-input" />
                                    <span className="props-field-unit">mm</span>
                                </div>
                            </div>

                            {/* Corner radius — rect only, and only when shapeKind is basic rect or rect_round */}
                            {selectedEl.type === 'shape' && (!selectedEl.shapeKind || selectedEl.shapeKind === 'rect' || selectedEl.shapeKind === 'rect_round') && (
                                <>
                                    <div className="props-section-label">มุมโค้ง</div>
                                    <div className="props-slider-row">
                                        <input type="range" min="0" max="100" step="1"
                                            value={selectedEl.cornerRadius || 0}
                                            onChange={e => updateElement(activePanel.id, selectedEl.id, { cornerRadius: parseInt(e.target.value) })}
                                            className="props-slider" />
                                        <span className="props-slider-val">{selectedEl.cornerRadius || 0}%</span>
                                    </div>
                                </>
                            )}

                            {/* Fill color — shapes, circles, text */}
                            {(selectedEl.type === 'shape' || selectedEl.type === 'circle' || selectedEl.type === 'text') && (
                                <>
                                    <div className="props-section-label">สีเติม</div>
                                    <div className="props-color-row">
                                        <input type="color"
                                            value={selectedEl.fill && selectedEl.fill !== 'transparent' ? selectedEl.fill : '#FF6B35'}
                                            onChange={e => updateElement(activePanel.id, selectedEl.id, { fill: e.target.value })}
                                            className="props-color-swatch" />
                                        <span className="props-color-hex">{(selectedEl.fill || '#FF6B35').toUpperCase()}</span>
                                        <div className="props-color-dropdown"><iconify-icon icon="mdi:chevron-down"></iconify-icon></div>
                                    </div>
                                    {/* Brand color swatches */}
                                    {brandAssets?.colors?.length > 0 && (
                                        <div className="props-brand-swatches">
                                            {brandAssets.colors.map((c, i) => (
                                                <button key={i} title={c}
                                                    onClick={() => updateElement(activePanel.id, selectedEl.id, { fill: c })}
                                                    className="props-brand-swatch" style={{ background: c }} />
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Stroke — shapes and circles */}
                            {(selectedEl.type === 'shape' || selectedEl.type === 'circle') && (
                                <>
                                    <div className="props-section-label-row">
                                        <span className="props-section-label" style={{margin:0}}>เส้นขอบ</span>
                                        <div className={`props-toggle ${selectedEl.stroke ? 'props-toggle-on' : ''}`}
                                            onClick={() => updateElement(activePanel.id, selectedEl.id, { stroke: !selectedEl.stroke, strokeColor: selectedEl.strokeColor || '#000000', strokeWidth: selectedEl.strokeWidth || 2 })}>
                                            <div className="props-toggle-knob"></div>
                                        </div>
                                    </div>
                                    {selectedEl.stroke && (
                                        <>
                                            <div className="props-color-row" style={{marginTop:6}}>
                                                <input type="color"
                                                    value={selectedEl.strokeColor || '#000000'}
                                                    onChange={e => updateElement(activePanel.id, selectedEl.id, { strokeColor: e.target.value })}
                                                    className="props-color-swatch" />
                                                <span className="props-color-hex">{(selectedEl.strokeColor || '#000000').toUpperCase()}</span>
                                                <div className="props-color-dropdown"><iconify-icon icon="mdi:chevron-down"></iconify-icon></div>
                                            </div>
                                            <div className="props-stroke-row">
                                                <select className="props-stroke-style"
                                                    value={selectedEl.strokeDash || 'solid'}
                                                    onChange={e => updateElement(activePanel.id, selectedEl.id, { strokeDash: e.target.value })}>
                                                    <option value="solid">——</option>
                                                    <option value="dashed">- - -</option>
                                                </select>
                                                <input type="number" min="1" max="20" value={selectedEl.strokeWidth || 2}
                                                    onChange={e => updateElement(activePanel.id, selectedEl.id, { strokeWidth: Math.max(1, parseInt(e.target.value) || 1) })}
                                                    className="props-stroke-width" />
                                                <span className="props-field-unit">px</span>
                                            </div>
                                        </>
                                    )}
                                </>
                            )}

                            {/* Text-specific controls */}
                            {selectedEl.type === 'text' && (
                                <>
                                    <div className="props-section-label">ข้อความ</div>
                                    <input type="text" value={selectedEl.data || ''}
                                        onChange={e => updateElement(activePanel.id, selectedEl.id, { data: e.target.value })}
                                        className="text-content-input" style={{width:'100%', boxSizing:'border-box', marginBottom:8}} />
                                    <div className="props-text-style-row">
                                        <div className="props-field">
                                            <span className="props-field-label" style={{minWidth:24}}>ขนาด</span>
                                            <input type="number" min="6" max="200" value={selectedEl.fontSize || 20}
                                                onChange={e => updateElement(activePanel.id, selectedEl.id, { fontSize: Math.max(6, parseInt(e.target.value) || 20) })}
                                                className="props-mm-input" />
                                            <span className="props-field-unit">px</span>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Barcode value */}
                            {selectedEl.type === 'barcode' && (
                                <>
                                    <div className="props-section-label">ค่าบาร์โค้ด</div>
                                    <input type="text" maxLength={13} value={selectedEl.barcodeValue || ''}
                                        onChange={e => updateElement(activePanel.id, selectedEl.id, { barcodeValue: e.target.value })}
                                        placeholder="8850000000000"
                                        className="barcode-input" style={{width:'100%', boxSizing:'border-box'}} />
                                </>
                            )}

                            {/* QR value */}
                            {selectedEl.type === 'qrcode' && (
                                <>
                                    <div className="props-section-label">ข้อมูล QR</div>
                                    <input type="text" value={selectedEl.qrValue || ''}
                                        onChange={e => updateElement(activePanel.id, selectedEl.id, { qrValue: e.target.value })}
                                        placeholder="URL หรือข้อความ"
                                        className="qrcode-input" style={{width:'100%', boxSizing:'border-box'}} />
                                </>
                            )}

                            {/* Opacity */}
                            <div className="props-section-label">ความทึบ</div>
                            <div className="props-slider-row">
                                <input type="range" min="0" max="1" step="0.01"
                                    value={selectedEl.opacity ?? 1}
                                    onChange={e => updateElement(activePanel.id, selectedEl.id, { opacity: parseFloat(e.target.value) })}
                                    className="props-slider" />
                                <span className="props-slider-val">{Math.round((selectedEl.opacity ?? 1) * 100)}%</span>
                            </div>

                            {/* Alignment */}
                            <div className="props-section-label">จัดแนว</div>
                            <div className="props-align-row">
                                <button className="props-align-btn" title="ชิดซ้าย"
                                    onClick={() => {
                                        const offset = selectedEl.type === 'circle' ? -(selectedEl.radius || 0) : 0;
                                        updateElement(activePanel.id, selectedEl.id, { x: offset });
                                    }}>
                                    <iconify-icon icon="mdi:format-horizontal-align-left"></iconify-icon>
                                </button>
                                <button className="props-align-btn" title="กึ่งกลางแนวนอน"
                                    onClick={() => {
                                        const elW = selectedEl.type === 'circle' ? (selectedEl.radius || 0) * 2 : (selectedEl.w || 0);
                                        updateElement(activePanel.id, selectedEl.id, { x: (canvasW - elW) / 2 + (selectedEl.type === 'circle' ? (selectedEl.radius || 0) : 0) });
                                    }}>
                                    <iconify-icon icon="mdi:format-horizontal-align-center"></iconify-icon>
                                </button>
                                <button className="props-align-btn" title="ชิดขวา"
                                    onClick={() => {
                                        const elW = selectedEl.type === 'circle' ? (selectedEl.radius || 0) * 2 : (selectedEl.w || 0);
                                        updateElement(activePanel.id, selectedEl.id, { x: canvasW - elW + (selectedEl.type === 'circle' ? (selectedEl.radius || 0) : 0) });
                                    }}>
                                    <iconify-icon icon="mdi:format-horizontal-align-right"></iconify-icon>
                                </button>
                                <button className="props-align-btn" title="กึ่งกลางแนวตั้ง"
                                    onClick={() => {
                                        const elH = selectedEl.type === 'circle' ? (selectedEl.radius || 0) * 2 : (selectedEl.h || 0);
                                        updateElement(activePanel.id, selectedEl.id, { y: (canvasH - elH) / 2 + (selectedEl.type === 'circle' ? (selectedEl.radius || 0) : 0) });
                                    }}>
                                    <iconify-icon icon="mdi:format-vertical-align-center"></iconify-icon>
                                </button>
                            </div>

                            {/* Layer navigation */}
                            <div className="props-layer-btns">
                                <button className="props-layer-btn"
                                    onClick={() => {
                                        setPanelDesigns(prev => {
                                            const d = { ...prev[activePanel.id] };
                                            const els = [...d.elements];
                                            const idx = els.findIndex(e => e.id === selectedEl.id);
                                            if (idx < els.length - 1) { [els[idx], els[idx + 1]] = [els[idx + 1], els[idx]]; }
                                            d.elements = els;
                                            return { ...prev, [activePanel.id]: d };
                                        });
                                    }}>
                                    <iconify-icon icon="mdi:arrange-bring-to-front"></iconify-icon> นำไปที่ด้านหน้า
                                </button>
                                <button className="props-layer-btn"
                                    onClick={() => {
                                        setPanelDesigns(prev => {
                                            const d = { ...prev[activePanel.id] };
                                            const els = [...d.elements];
                                            const idx = els.findIndex(e => e.id === selectedEl.id);
                                            if (idx > 0) { [els[idx], els[idx - 1]] = [els[idx - 1], els[idx]]; }
                                            d.elements = els;
                                            return { ...prev, [activePanel.id]: d };
                                        });
                                    }}>
                                    <iconify-icon icon="mdi:arrange-send-to-back"></iconify-icon> นำไปที่ด้านหลัง
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="props-empty">
                            <div className="props-empty-icon"><iconify-icon icon="mdi:cursor-default-click-outline"></iconify-icon></div>
                            <div className="props-empty-text">คลิกเลือกออบเจ็กต์เพื่อดูคุณสมบัติ</div>
                        </div>
                    )
                )}
            </div>

            {/* === Canvas Preview Popup === */}
            {/* === Lightbox Popup === */}
            {lightboxUrl && (
                <div onClick={() => setLightboxUrl(null)} className="lightbox-overlay">
                    <div onClick={e => e.stopPropagation()} className="lightbox-content">
                        <img src={lightboxUrl} alt="Mockup Preview" className="lightbox-image" />
                        <button onClick={() => setLightboxUrl(null)} className="lightbox-close-btn">
                            <iconify-icon icon="mdi:close"></iconify-icon>
                        </button>
                    </div>
                    <div className="lightbox-actions" onClick={e => e.stopPropagation()}>
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
                            className="lightbox-download-btn">
                            <iconify-icon icon="mdi:download"></iconify-icon> ดาวน์โหลด
                        </button>
                        <button onClick={() => setLightboxUrl(null)} className="lightbox-close-text-btn">
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
function PanelElement({ el, isSelected, onSelect, onChange, canvasW, canvasH, onCenterGuide }) {
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

    // ขณะลาก — ตรวจว่าศูนย์กลางวัตถุตรงกึ่งกลางกระดาษไหม → ดูดเข้าแนว + โชว์เส้นกึ่งกลาง
    const handleDragMove = (e) => {
        const node = e.target;
        if (!canvasW || !canvasH) return;
        const box = node.getClientRect({ skipShadow: true, skipStroke: true });
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        const SNAP = 6;
        let v = false, h = false;
        if (Math.abs(cx - canvasW / 2) <= SNAP) { node.x(node.x() - (cx - canvasW / 2)); v = true; }
        if (Math.abs(cy - canvasH / 2) <= SNAP) { node.y(node.y() - (cy - canvasH / 2)); h = true; }
        onCenterGuide?.({ v, h });
    };

    const handleDragEnd = (e) => {
        onCenterGuide?.({ v: false, h: false });
        onChange({ x: e.target.x(), y: e.target.y() });
    };
    const handleTransformEnd = (e) => {
        const node = e.target;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);
        const newW = Math.max(10, node.width() * scaleX);
        const newH = Math.max(10, node.height() * scaleY);
        const updates = {
            x: node.x(), y: node.y(),
            w: newW, h: newH,
            rotation: node.rotation()
        };
        // Keep radius in sync for circles
        if (el.type === 'circle') {
            updates.radius = Math.max(5, (newW + newH) / 4);
        }
        onChange(updates);
    };

    const common = { id: el.id, draggable: true, onClick: onSelect, onTap: onSelect, onDragMove: handleDragMove, onDragEnd: handleDragEnd, onTransformEnd: handleTransformEnd };

    // Hidden elements are not rendered on canvas
    if (el.hidden) return null;

    const opacity = el.opacity ?? 1;
    const strokeProps = (el.stroke && el.strokeColor) ? {
        stroke: el.strokeColor,
        strokeWidth: el.strokeWidth || 2,
        dash: el.strokeDash === 'dashed' ? [8, 4] : undefined,
    } : {};

    if (el.type === 'text') {
        return <KText {...common} x={el.x} y={el.y} width={el.w} text={el.data || ''} fontSize={el.fontSize || 20} fill={el.fill || '#222'} fontFamily={el.fontFamily || 'Bai Jamjuree'} rotation={el.rotation || 0} opacity={opacity} />;
    }
    if (el.type === 'shape') {
        const w = el.w || 120;
        const h = el.h || 120;
        const kind = el.shapeKind || 'rect';
        const fill = el.fill || '#ccc';
        const cr = el.cornerRadius ?? (kind === 'rect_round' ? 20 : 0);
        const baseProps = { ...common, x: el.x, y: el.y, rotation: el.rotation || 0, opacity, fill, ...strokeProps };

        // Simple rect / rect_round → use KRect (supports cornerRadius natively)
        if (kind === 'rect' || kind === 'rect_round') {
            return <KRect {...baseProps} width={w} height={h} cornerRadius={cr} />;
        }

        // All other shapes → draw via sceneFunc
        const sceneFunc = (ctx, shape) => {
            ctx.beginPath();
            if (kind === 'triangle') {
                ctx.moveTo(w / 2, 0);
                ctx.lineTo(w, h);
                ctx.lineTo(0, h);
                ctx.closePath();
            } else if (kind === 'diamond') {
                ctx.moveTo(w / 2, 0);
                ctx.lineTo(w, h / 2);
                ctx.lineTo(w / 2, h);
                ctx.lineTo(0, h / 2);
                ctx.closePath();
            } else if (kind === 'star') {
                const cx = w / 2, cy = h / 2;
                const outerR = Math.min(w, h) / 2;
                const innerR = outerR * 0.42;
                const points = 5;
                for (let i = 0; i < points * 2; i++) {
                    const angle = (i * Math.PI) / points - Math.PI / 2;
                    const r = i % 2 === 0 ? outerR : innerR;
                    const px = cx + r * Math.cos(angle);
                    const py = cy + r * Math.sin(angle);
                    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
                }
                ctx.closePath();
            } else if (kind === 'hexagon') {
                const cx = w / 2, cy = h / 2;
                const rx = w / 2, ry = h / 2;
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI / 3) * i - Math.PI / 6;
                    const px = cx + rx * Math.cos(angle);
                    const py = cy + ry * Math.sin(angle);
                    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
                }
                ctx.closePath();
            } else if (kind === 'octagon') {
                const cx = w / 2, cy = h / 2;
                const rx = w / 2, ry = h / 2;
                for (let i = 0; i < 8; i++) {
                    const angle = (Math.PI / 4) * i - Math.PI / 8;
                    const px = cx + rx * Math.cos(angle);
                    const py = cy + ry * Math.sin(angle);
                    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
                }
                ctx.closePath();
            } else if (kind === 'arrow') {
                const tw = w * 0.35; // tail width (vertical center offset)
                const hw = w * 0.42; // arrowhead horizontal depth
                ctx.moveTo(0, h * 0.5 - tw * 0.5);
                ctx.lineTo(w - hw, h * 0.5 - tw * 0.5);
                ctx.lineTo(w - hw, 0);
                ctx.lineTo(w, h / 2);
                ctx.lineTo(w - hw, h);
                ctx.lineTo(w - hw, h * 0.5 + tw * 0.5);
                ctx.lineTo(0, h * 0.5 + tw * 0.5);
                ctx.closePath();
            } else if (kind === 'speech') {
                const r2 = Math.min(w, h) * 0.12;
                const tailH = h * 0.22;
                const bubbleH = h - tailH;
                // Rounded bubble
                ctx.moveTo(r2, 0);
                ctx.lineTo(w - r2, 0);
                ctx.quadraticCurveTo(w, 0, w, r2);
                ctx.lineTo(w, bubbleH - r2);
                ctx.quadraticCurveTo(w, bubbleH, w - r2, bubbleH);
                ctx.lineTo(w * 0.45, bubbleH);
                ctx.lineTo(w * 0.25, h);        // tail tip
                ctx.lineTo(w * 0.25, bubbleH);
                ctx.lineTo(r2, bubbleH);
                ctx.quadraticCurveTo(0, bubbleH, 0, bubbleH - r2);
                ctx.lineTo(0, r2);
                ctx.quadraticCurveTo(0, 0, r2, 0);
                ctx.closePath();
            } else if (kind === 'heart') {
                const cx = w / 2, top = h * 0.25;
                ctx.moveTo(cx, h * 0.95);
                ctx.bezierCurveTo(w * -0.1, h * 0.6, w * -0.1, top, cx * 0.5, top);
                ctx.bezierCurveTo(cx * 0.9, top, cx, h * 0.15, cx, h * 0.25);
                ctx.bezierCurveTo(cx, h * 0.15, cx * 1.1, top, cx * 1.5, top);
                ctx.bezierCurveTo(w * 1.1, top, w * 1.1, h * 0.6, cx, h * 0.95);
                ctx.closePath();
            } else {
                // fallback rect
                ctx.rect(0, 0, w, h);
            }
            ctx.fillStrokeShape(shape);
        };

        return (
            <KShape
                {...common}
                x={el.x} y={el.y}
                width={w} height={h}
                rotation={el.rotation || 0}
                opacity={opacity}
                fill={fill}
                stroke={strokeProps.stroke}
                strokeWidth={strokeProps.strokeWidth}
                dash={strokeProps.dash}
                sceneFunc={sceneFunc}
            />
        );
    }
    if (el.type === 'circle') {
        const r = Math.max(el.radius || el.w / 2 || 30, 5);
        return <KCircle {...common} x={el.x} y={el.y} radius={r} fill={el.fill || '#ccc'} opacity={opacity} {...strokeProps} />;
    }
    if (el.type === 'image' && img) {
        return <KImg {...common} image={img} x={el.x} y={el.y} width={el.w} height={el.h} rotation={el.rotation || 0} opacity={opacity} />;
    }
    if (el.type === 'barcode' && img) {
        return <KImg {...common} image={img} x={el.x} y={el.y} width={el.w} height={el.h} rotation={el.rotation || 0} opacity={opacity} />;
    }
    if (el.type === 'qrcode' && img) {
        return <KImg {...common} image={img} x={el.x} y={el.y} width={el.w} height={el.h} rotation={el.rotation || 0} opacity={opacity} />;
    }
    return null;
}


// === Die-line Mini Map ===
function DielineMiniMap({ panels, activePanelIdx, onClickPanel, materialData, panelDesigns, aiDielineBgImg }) {
    // หดขนาด mini-map ลงจริงๆ (ไม่ใช่แค่ transform scale) ตอนจอเล็กลง เพื่อคืนพื้นที่ให้ canvas
    const [compact, setCompact] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 1440);
    useEffect(() => {
        const onResize = () => setCompact(window.innerWidth <= 1440);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    if (!materialData) return null;
    const dW = parseFloat(materialData.dieline_width_mm);
    const dH = parseFloat(materialData.dieline_height_mm);
    const maxW = compact ? 120 : 200, maxH = compact ? 180 : 300;
    const scale = Math.min(maxW / dW, maxH / dH);
    const mapW = dW * scale, mapH = dH * scale;

    return (
        <div className="dieline-minimap">
            <div className="dieline-minimap-label">
                Die-line ({dW} × {dH} mm)
            </div>
            <svg width={mapW} height={mapH} viewBox={`0 0 ${dW} ${dH}`} className="dieline-minimap-svg">
                <rect x={0} y={0} width={dW} height={dH} fill="#f9fafb" stroke="#e5e7eb" strokeWidth={0.5} />
                {panels.map((p, idx) => {
                    const d = panelDesigns[p.id];
                    const isActive = idx === activePanelIdx;
                    return (
                        <g key={p.id} onClick={() => onClickPanel(idx)} className="dieline-minimap-panel">
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
            className={`label-part-btn ${available ? 'label-part-btn-available' : 'label-part-btn-disabled'}`}>
            <span className="label-part-btn-text">{icon && <iconify-icon icon={icon}></iconify-icon>}{label}</span>
            {detail && <span className="label-part-btn-detail">{detail}</span>}
            {available && <span className="label-part-btn-plus">+</span>}
        </button>
    );
}

// === Sidebar Accordion Section ===
function SidebarSection({ title, open, onToggle, children }) {
    return (
        <div className="sidebar-section">
            <button onClick={onToggle} className="sidebar-section-header">
                {title}
                <iconify-icon icon={open ? 'mdi:chevron-up' : 'mdi:chevron-down'}></iconify-icon>
            </button>
            {open && <div className="sidebar-section-body">{children}</div>}
        </div>
    );
}

// === Mode Selector ===
function ModeSelector({ onPick, onBack, productName, hasPanels }) {
    return (
        <div className="mode-selector">
            <button onClick={onBack} className="back-link">
                <iconify-icon icon="mdi:chevron-left"></iconify-icon>
                เลือกสินค้าใหม่
            </button>
            <h2 className="mode-selector-title">
                เลือกรูปแบบ Mockup
            </h2>
            <p className="mode-selector-subtitle">
                สำหรับสินค้า "{productName}" — เลือกวิธีที่เหมาะกับงานของคุณ
            </p>

            <div className="mode-card-grid">
                <ModeCard iconName="mdi:cube-unfolded" title="ออกแบบบรรจุภัณฑ์ทั้งชิ้น"
                    desc="ออกแบบกราฟิกลงบนพื้นผิวบรรจุภัณฑ์ทุกด้าน ใช้ AI สร้างลวดลาย หรือออกแบบเอง ส่งออกเป็น PDF"
                    badge="แนะนำ"
                    disabled={!hasPanels}
                    disabledMsg="บรรจุภัณฑ์นี้ยังไม่รองรับการออกแบบทั้งชิ้น"
                    onClick={() => onPick('package_design')} />
                <ModeCard iconName="mdi:image-auto-adjust" title="AI สร้าง Mockup จากรูปจริง"
                    desc="ส่งรูปฉลากและบรรจุภัณฑ์จริงให้ Gemini AI สร้างภาพ Mockup สมจริง พร้อมเลือกสไตล์พื้นหลังได้"
                    badge="ใช้ Credit" onClick={() => onPick('aimockup')} />
            </div>
        </div>
    );
}

function ModeCard({ iconName, title, desc, badge, onClick, disabled, disabledMsg }) {
    return (
        <button onClick={disabled ? undefined : onClick}
            title={disabled ? disabledMsg : ''}
            disabled={disabled}
            className={`mode-card ${disabled ? 'mode-card-disabled' : ''}`}>
            <div className="mode-card-badge">
                {badge}
            </div>
            <div className="mode-card-icon">
                <iconify-icon icon={iconName}></iconify-icon>
            </div>
            <h3 className="mode-card-title">{title}</h3>
            <p className="mode-card-desc">{desc}</p>
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
        <div className="aimockup-view">
            <button onClick={onBack} className="back-link">
                <iconify-icon icon="mdi:chevron-left"></iconify-icon>
                เปลี่ยนสินค้า / โหมด
            </button>

            <div className="aimockup-layout">
                {/* คอลัมน์ซ้าย: ตั้งค่า + สร้าง */}
                <div className="aimockup-sidebar">
                    {/* รูป label + package preview */}
                    <div className="aimockup-preview-grid">
                        <div className="aimockup-preview-card">
                            <div className="aimockup-preview-label">
                                <iconify-icon icon="mdi:package-variant"></iconify-icon>
                                บรรจุภัณฑ์
                            </div>
                            {hasPackage ? (
                                <img src={packageImageUrl} className="aimockup-preview-img" alt="pkg" />
                            ) : <div className="aimockup-preview-empty">ไม่มีภาพ</div>}
                        </div>
                        <div className="aimockup-preview-card">
                            <div className="aimockup-preview-label">
                                <iconify-icon icon="mdi:label-outline"></iconify-icon>
                                ฉลาก
                            </div>
                            {hasLabel ? (
                                <img src={labelImageUrl} className="aimockup-preview-img" alt="lbl" />
                            ) : <div className="aimockup-preview-empty aimockup-preview-empty-warn">ยังไม่มีฉลาก</div>}
                        </div>
                    </div>

                    {/* ปุ่มสร้าง */}
                    <button onClick={handleGenerate} disabled={isGenerating || !canGenerate} className="aimockup-generate-btn">
                        <iconify-icon icon="mdi:image-auto-adjust"></iconify-icon>
                        {isGenerating ? 'AI กำลังสร้าง... (30-60 วินาที)' : 'สร้าง Mockup ใหม่'}
                    </button>

                    {/* Gallery ประวัติ */}
                    <div className="aimockup-history-card">
                        <div className="aimockup-history-header">
                            <span>
                                <iconify-icon icon="mdi:history"></iconify-icon>
                                ประวัติที่สร้าง ({history.length})
                            </span>
                        </div>
                        {isLoadingHistory ? (
                            <div className="aimockup-history-loading">กำลังโหลด...</div>
                        ) : history.length === 0 ? (
                            <div className="aimockup-history-empty">
                                ยังไม่มีภาพ Mockup<br />กดปุ่มด้านบนเพื่อสร้าง
                            </div>
                        ) : (
                            <div className="aimockup-history-grid">
                                {history.map(h => {
                                    const url = `${API}${h.image_url}`;
                                    const isActive = selectedImg === url;
                                    return (
                                        <div key={h.history_id} className={`aimockup-history-thumb ${isActive ? 'aimockup-history-thumb-active' : ''}`}>
                                            <img src={url} onClick={() => setSelectedImg(url)}
                                                className="aimockup-history-thumb-img" alt="mockup" />
                                            <button onClick={(e) => { e.stopPropagation(); handleDelete(h.history_id); }} className="aimockup-history-delete-btn">
                                                <iconify-icon icon="mdi:close"></iconify-icon>
                                            </button>
                                            <div className="aimockup-history-thumb-date">
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
                <div className="aimockup-main">
                    {isGenerating ? (
                        <div className="aimockup-generating">
                            <div className="aimockup-generating-icon">
                                <iconify-icon icon="mdi:loading" className="spin"></iconify-icon>
                            </div>
                            <p className="aimockup-generating-message">
                                {progressInfo?.message || 'กำลังเริ่มต้น...'}
                            </p>
                            {progressInfo?.step && progressInfo?.total && (
                                <>
                                    <div className="aimockup-generating-progress-track">
                                        <div className="aimockup-generating-progress-fill" style={{ width: `${(progressInfo.step / progressInfo.total) * 100}%` }} />
                                    </div>
                                    <p className="aimockup-generating-step">
                                        ขั้นตอน {progressInfo.step} / {progressInfo.total}
                                    </p>
                                </>
                            )}
                        </div>
                    ) : selectedImg ? (
                        <>
                            <img src={selectedImg} className="aimockup-result-img" alt="mockup preview" />
                            <div className="aimockup-result-actions">
                                <button onClick={() => handleDownload(selectedImg)} className="aimockup-result-download-btn">
                                    <iconify-icon icon="mdi:download"></iconify-icon>
                                    ดาวน์โหลดรูปนี้
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="aimockup-empty-state">
                            <div className="aimockup-empty-icon">
                                <iconify-icon icon="mdi:image-plus-outline"></iconify-icon>
                            </div>
                            <p className="aimockup-empty-title">ยังไม่มีภาพ Mockup</p>
                            <p className="aimockup-empty-subtitle">กดปุ่มสร้างเพื่อให้ AI สร้างภาพ Mockup</p>
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

    return (
        <div className="mini-label-preview">
            {brandAssets?.logoUrl && (
                <img src={brandAssets.logoUrl} alt="logo" crossOrigin="anonymous"
                    className="mini-label-preview-logo"
                    onError={e => e.target.style.display = 'none'} />
            )}
            <div className="mini-label-preview-name">
                {labelData.product_name || ''}
            </div>
            {labelData.tagline && (
                <div className="mini-label-preview-tagline">
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

    let buttonText, buttonIcon, statusType;
    if (!product.has_package) {
        buttonText = 'ไปเลือกบรรจุภัณฑ์';
        buttonIcon = 'mdi:package-variant-closed'; statusType = 'no_package';
    } else if (!hasLabel) {
        buttonText = 'ไปออกแบบฉลาก';
        buttonIcon = 'mdi:tag-outline'; statusType = 'no_label';
    } else {
        buttonText = 'เริ่มทำ Mockup';
        buttonIcon = 'mdi:image-edit-outline'; statusType = 'ready';
    }

    const isReady = statusType === 'ready';

    return (
        <div className={`product-card ${isReady ? 'product-card-ready' : ''}`}>
            {/* Top: product image + thumbnails side by side */}
            <div className="product-card-top">
                {/* Product image */}
                <div className="product-card-image">
                    {productImg ? (
                        <img src={productImg} alt={product.name_product}
                            onError={e => { e.target.style.display = 'none'; }} />
                    ) : (
                        <div className="product-card-image-placeholder">
                            <iconify-icon icon="mdi:image-outline"></iconify-icon>
                        </div>
                    )}
                </div>

                {/* Thumbnails stacked vertically */}
                <div className="product-card-thumbs">
                    <div className="product-card-thumb-col">
                        <div className="product-card-thumb-box">
                            {pkgImg ? (
                                <img src={pkgImg} alt="package" />
                            ) : (
                                <div className="product-card-thumb-placeholder">
                                    <iconify-icon icon="mdi:package-variant-closed"></iconify-icon>
                                </div>
                            )}
                        </div>
                        <div className="product-card-thumb-caption">บรรจุภัณฑ์</div>
                    </div>

                    <div className="product-card-thumb-col">
                        <div className="product-card-thumb-box">
                            {hasLabel ? (
                                <MiniLabelPreview labelData={labelData} brandAssets={brandAssets} />
                            ) : (
                                <div className="product-card-thumb-placeholder">
                                    <iconify-icon icon="mdi:tag-outline"></iconify-icon>
                                </div>
                            )}
                        </div>
                        <div className="product-card-thumb-caption">ฉลาก</div>
                    </div>
                </div>
            </div>

            {/* Bottom: info + CTA */}
            <div className="product-card-body">
                <div className="product-card-name">{product.name_product}</div>
                {product.type_product && (
                    <div className="product-card-type">{product.type_product}</div>
                )}

                <div className="product-card-status-list">
                    <StatusLine ok={product.has_package}
                        okText={product.name_package || 'มีบรรจุภัณฑ์'}
                        noText="ยังไม่มีบรรจุภัณฑ์" />
                    <StatusLine ok={hasLabel}
                        okText={labelData?.product_name || 'มีฉลากแล้ว'}
                        noText="ยังไม่มีฉลาก" />
                </div>

                <button onClick={() => onSelect(statusType, labelData)}
                    className={`product-card-cta product-card-cta-${statusType}`}>
                    <iconify-icon icon={buttonIcon}></iconify-icon>
                    {buttonText}
                </button>
            </div>
        </div>
    );
}

function StatusLine({ ok, okText, noText }) {
    return (
        <div className={`status-line ${ok ? 'status-line-ok' : 'status-line-warn'}`}>
            <iconify-icon icon={ok ? "mdi:check-circle" : "mdi:alert-circle-outline"}></iconify-icon>
            <span className="status-line-text">
                {ok ? okText : noText}
            </span>
        </div>
    );
}

// === Product Picker ===
function ProductPickerView({ products, isLoading, brandAssets, onSelectProduct, onRefresh }) {
    if (isLoading) return (
        <div className="product-picker-loading">กำลังโหลดสินค้า...</div>
    );
    if (!products || products.length === 0) {
        return (
            <div className="product-picker-empty">
                <div className="product-picker-empty-icon">
                    <iconify-icon icon="mdi:package-variant-closed-remove"></iconify-icon>
                </div>
                ยังไม่มีสินค้าในโปรเจกต์นี้ กรุณาเพิ่มสินค้าก่อน
            </div>
        );
    }

    return (
        <div className="product-picker">
            <div className="product-picker-header">
                <div className="product-picker-header-text">
                    <h2 className="product-picker-title">
                        เลือกสินค้าที่ต้องการทำ Mockup
                    </h2>
                    <p className="product-picker-subtitle">
                        แต่ละสินค้ามีฉลากของตัวเอง — เลือกสินค้าที่มีบรรจุภัณฑ์และฉลากครบเพื่อทำภาพ Mockup
                    </p>
                </div>
                <button onClick={onRefresh} className="product-picker-refresh-btn">
                    <iconify-icon icon="mdi:refresh"></iconify-icon>
                    รีเฟรชข้อมูล
                </button>
            </div>

            <div className="product-picker-grid">
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
            const font = a.font ? `'${a.font.font_name}', sans-serif` : "'Bai Jamjuree', sans-serif";
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