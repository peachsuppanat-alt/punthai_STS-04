import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { QRCodeSVG } from 'qrcode.react';
import Barcode from 'react-barcode';
import './Result.css';
import './PackageCatalog.css';
import PackageCatalog from './PackageCatalog';
import MockupEditor from './MockupEditor';
import logoImg from '../assets/logo.png';
import { loadLogoTransparent } from './logoUtils';
// ============= CONSTANTS =============
const TEMPLATE_TYPES = [
    { id: 'centered_classic', name: 'Centered Classic', desc: 'โลโก้กลาง ทุกอย่างจัดกึ่งกลาง' },
    { id: 'modern_side', name: 'Modern Side', desc: 'โลโก้ซ้าย ข้อความชิดซ้าย' },
    { id: 'premium_frame', name: 'Premium Frame', desc: 'มีกรอบเส้นบาง สไตล์พรีเมียม' },
    { id: 'minimal_strip', name: 'Minimal Strip', desc: 'ชื่อใหญ่ ข้อมูลกฎหมายเป็นแถบล่าง' },
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

//  ตัวเลือกสำหรับปุ่มกด (Tags)
const USAGE_OPTIONS = ['ชงในน้ำร้อน', 'ใช้ดื่ม', 'ทาผิวหน้าเช้า-ก่อนนอน', 'เขย่าขวดก่อนดื่ม', 'ใช้ทำความสะอาดภายนอก', "ชงน้ำเย็น"];
const STORAGE_OPTIONS = ['เก็บในที่แห้งและเย็น', 'หลีกเลี่ยงแสงแดดจัด', 'เก็บในตู้เย็น (2-8 °C)', 'ปิดฝาให้สนิทหลังใช้งาน', 'เก็บในอุณหภูมิห้อง'];
const WARNING_OPTIONS = ['สตรีมีครรภ์ไม่ควรรับประทาน', 'เก็บให้พ้นมือเด็ก', 'หากเกิดอาการแพ้ควรหยุดใช้', 'ห้ามรับประทาน (ใช้ภายนอก)', 'ข้อมูลผู้แพ้อาหาร: มีส่วนผสมของถั่ว', 'ห้ามโดนแสงแดดจัดเป็นเวลานาน'];

//  Helper Function ตัดคำจาก Database มาใส่ปุ่ม
const parseTags = (str, options) => {
    if (!str) return { tags: [], custom: '' };
    const parts = str.split(', ').map(s => s.trim());
    const tags = parts.filter(p => options.includes(p));
    const customParts = parts.filter(p => !options.includes(p) && p !== '');
    return { tags, custom: customParts.join(', ') };
};

//  Helper Function รวมปุ่มและกล่องข้อความกลับเป็น String
const getFinalText = (tags, custom, showCustom) => {
    let arr = [...tags];
    if (showCustom && custom) arr.push(custom);
    return arr.filter(Boolean).join(', ');
};

export const Result = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const projectId = location.state?.projectId;

    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    const userId = userData.user_id || 0;

    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [currentTab, setCurrentTab] = useState('package');
    const [projectData, setProjectData] = useState({});

    const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0, background: '#c94e1f' });
    const tabsRef = useRef([]);

    // ====== State สำหรับ Mockup (เดิม) ======
    const [generatedItems, setGeneratedItems] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [detailsInput, setDetailsInput] = useState('');
    const [negativeInput, setNegativeInput] = useState('');
    const [useImportedColor, setUseImportedColor] = useState(false);
    const [useImportedFont, setUseImportedFont] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);

    // ====== State ระบบ Product Selection ======
    const [products, setProducts] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [isAddProductOpen, setIsAddProductOpen] = useState(false);
    const [newProduct, setNewProduct] = useState({ name: '', type: '', file: null });

    // ====== State LABEL ======
    const labelRef = useRef(null);

    const [labelAssets, setLabelAssets] = useState({
        logoUrl: '', colors: ['#FFFFFF', '#222222', '#D3542B', '#888888', '#EEEEEE'], font: "'Sarabun', sans-serif",
    });

    const [labelForm, setLabelForm] = useState({
        productName: '', tagline: '', netWeight: '', ingredients: '',

        // 🟢 เปลี่ยนโครงสร้างการเก็บข้อมูล B
        usageTags: [], usageCustom: '', showUsageCustom: false,
        storageTags: [], storageCustom: '', showStorageCustom: false,
        warningTags: [], warningCustom: '', showWarningCustom: false,

        manufacturerName: '', manufacturerAddress: '', manufacturerPhone: '',
        manufacturerLine: '', manufacturerFacebook: '', manufacturerWebsite: '',
        fdaNumber: '', mfgDate: '', expDate: '', lotNumber: '',
        certifications: [],
        showQR: false, qrValue: '', showBarcode: false, barcodeValue: '',
    });

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

    const [isLabelAILoading, setIsLabelAILoading] = useState(false);
    const [isSavingLabel, setIsSavingLabel] = useState(false);

    const [labelDimensions, setLabelDimensions] = useState({ width: 380, height: 500 });
    const [sectionColors, setSectionColors] = useState({ productName: '#222222', tagline: '#D3542B', details: '#555555' });
    const [saveStatus, setSaveStatus] = useState('');

    const [openAccordions, setOpenAccordions] = useState({
        bg: true, settings: true, main: true, product: true, manufacturer: false, legal: false, cert: false, qr: false,
    });
    const toggleAccordion = (key) => setOpenAccordions(p => ({ ...p, [key]: !p[key] }));

    // ============= EFFECTS =============
    useEffect(() => {
        if (!projectId) { alert("ไม่พบรหัสโปรเจกต์"); navigate('/'); return; }
        fetchProjectDetails(); fetchPictures(); fetchLabelAssets(); fetchBgPresets(); fetchProducts();
    }, [projectId]);

    useEffect(() => {
        const tabIndex = ['package', 'label', 'mockup'].indexOf(currentTab);
        const activeElement = tabsRef.current[tabIndex];
        if (activeElement) {
            setIndicatorStyle({ left: activeElement.offsetLeft, width: activeElement.offsetWidth, background: activeElement.dataset.color });
        }
    }, [currentTab]);

    // 🟢 ระบบ AUTO-SAVE
    useEffect(() => {
        if (!selectedProduct) return;
        setSaveStatus('กำลังบันทึก...');
        const timer = setTimeout(() => { handleSaveLabel(true); }, 1500);
        return () => clearTimeout(timer);
    }, [labelForm, layoutType, bgMode, bgColor, bgPresetId, bgImageUrl, bgOpacity, labelDimensions, sectionColors]);

    // ============= FETCHERS =============
    const fetchProducts = async () => {
        try {
            const res = await fetch(`http://localhost:3000/api/brand_product/${projectId}`);
            const data = await res.json();
            if (data.status === 'success') setProducts(data.products);
        } catch (err) { }
    };

    const fetchProjectDetails = async () => {
        try {
            const res = await fetch(`http://localhost:3000/api/projects/detail/${projectId}`);
            const data = await res.json();
            if (data.status === 'success') setProjectData(data.project);
        } catch (err) { }
    };

    const fetchPictures = async () => {
        try {
            const res = await fetch(`http://localhost:3000/api/pictures/${projectId}`);
            const data = await res.json();
            if (data.status === 'success') setGeneratedItems(data.data);
        } catch (err) { }
    };

    const fetchLabelAssets = async () => {
        try {
            const projRes = await fetch(`http://localhost:3000/api/projects/detail/${projectId}`);
            const projData = await projRes.json();
            const logo = projData.project?.image_logo ? `http://localhost:3000${projData.project.image_logo}` : '';
            // ลบพื้นหลังขาวออกจากโลโก้ก่อนใช้
            const transparentLogo = await loadLogoTransparent(logo);
            const assetRes = await fetch(`http://localhost:3000/api/projects/${projectId}/selected-assets`);
            const assetData = await assetRes.json();

            let colors = ['#FFFFFF', '#222222', '#D3542B', '#888888', '#EEEEEE'];
            if (assetData.color) {
                colors = [assetData.color.color_code_1, assetData.color.color_code_2, assetData.color.color_code_3, assetData.color.color_code_4, assetData.color.color_code_5].filter(Boolean);
                while (colors.length < 5) colors.push('#CCCCCC');
            }
            let font = "'Sarabun', sans-serif";
            if (assetData.font) font = `'${assetData.font.font_name}', sans-serif`;

            setLabelAssets({ logoUrl: transparentLogo || logo, colors, font });
            setBgColor(prev => prev === '#FFFFFF' ? (colors[0] || '#FFFFFF') : prev);

            setSectionColors({ productName: colors[1] || '#222222', tagline: colors[2] || '#D3542B', details: colors[1] || '#555555' });
        } catch (err) { }
    };

    const fetchBgPresets = async () => {
        try {
            const res = await fetch('http://localhost:3000/api/bg-presets');
            const data = await res.json();
            if (data.status === 'success') setBgPresets(data.data);
        } catch (err) { }
    };

    const handleSelectProduct = async (prod) => {
        setSelectedProduct(prod);
        setSaveStatus('');
        try {
            const res = await fetch(`http://localhost:3000/api/labels/product/${prod.product_id}`);
            const data = await res.json();
            if (data.status === 'success' && data.data) {
                const r = data.data;
                const mi = typeof r.manufacturer_info === 'string' ? JSON.parse(r.manufacturer_info) : (r.manufacturer_info || {});
                const certs = typeof r.certifications === 'string' ? JSON.parse(r.certifications) : (r.certifications || []);

                // 🟢 แปลงค่ากลับมาเป็น Tags
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
                setBgImageUrl(r.bg_image_url || '');
                setBgOpacity(parseFloat(r.bg_opacity) || 1);
                setLabelDimensions({ width: r.label_width || 380, height: r.label_height || 500 });
                if (r.text_colors) {
                    try { setSectionColors(typeof r.text_colors === 'string' ? JSON.parse(r.text_colors) : r.text_colors); } catch (e) { }
                }
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

    // ============= HANDLERS LABEL =============
    const handleAddProduct = async (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append('project_id', projectId);
        formData.append('name_product', newProduct.name);
        formData.append('type_product', newProduct.type);
        if (newProduct.file) formData.append('image_product', newProduct.file);

        try {
            const res = await fetch('http://localhost:3000/api/brand_product', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.status === 'success') { setIsAddProductOpen(false); setNewProduct({ name: '', type: '', file: null }); fetchProducts(); }
        } catch (err) { }
    };

    const handleUploadCustomBg = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => { setBgImageUrl(reader.result); setBgMode('preset'); setBgPresetId(null); };
            reader.readAsDataURL(file);
        }
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

    const handleGenerateBgWithDalle = async () => {
        setIsGeneratingBg(true);
        try {
            const res = await fetch('http://localhost:3000/api/generate-label-background', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ project_id: projectId, user_id: userId, style: dalleStyle, tone: dalleTone, density: dalleDensity })
            });
            const data = await res.json();
            if (data.status === 'success') {
                setBgMode('dalle');
                const url = data.data.image_url.startsWith('http') ? data.data.image_url : `http://localhost:3000${data.data.image_url}`;
                setBgImageUrl(url); setBgPresetId(null);
            } else { alert('สร้างพื้นหลังไม่สำเร็จ: ' + (data.message || '')); }
        } catch (err) { alert('AI ติดขัดชั่วคราว ลองใหม่อีกครั้งครับ'); } finally { setIsGeneratingBg(false); }
    };

    const handleAIWriteCopy = async () => {
        if (!labelForm.productName) return alert('กรุณาระบุชื่อสินค้าก่อนครับ');
        setIsLabelAILoading(true);
        try {
            const res = await fetch('http://localhost:3000/api/generate-label-content', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ product_name: labelForm.productName, raw_details: labelForm.ingredients })
            });
            const data = await res.json();
            if (data.status === 'success') {
                setLabelForm(p => ({ ...p, tagline: p.tagline || data.data.tagline, ingredients: data.data.ingredients }));
            }
        } catch (err) { alert('AI ติดขัดชั่วคราว'); } finally { setIsLabelAILoading(false); }
    };

    // 🟢 รวมฟังก์ชันแปลง Tag ให้เป็น String ก่อนบันทึก
    const finalUsageString = getFinalText(labelForm.usageTags, labelForm.usageCustom, labelForm.showUsageCustom);
    const finalStorageString = getFinalText(labelForm.storageTags, labelForm.storageCustom, labelForm.showStorageCustom);
    const finalWarningString = getFinalText(labelForm.warningTags, labelForm.warningCustom, labelForm.showWarningCustom);

    const handleSaveLabel = async (isAutoSave = false) => {
        if (!labelForm.productName || !selectedProduct) return;
        if (!isAutoSave) setIsSavingLabel(true);

        try {
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
                bg_image_url: bgImageUrl ? bgImageUrl.replace('http://localhost:3000', '') : '',
                bg_opacity: bgOpacity, label_width: labelDimensions.width, label_height: labelDimensions.height, text_colors: sectionColors
            };
            const res = await fetch('http://localhost:3000/api/labels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const data = await res.json();
            if (data.status === 'success') {
                if (isAutoSave) {
                    setSaveStatus('บันทึกอัตโนมัติแล้ว ✓');
                    // 🟢 อัปเดตชื่อใน Sidebar แบบ Real-time
                    setProducts(prev => prev.map(p => p.product_id === selectedProduct.product_id ? { ...p, name_product: labelForm.productName } : p));
                    setSelectedProduct(prev => ({ ...prev, name_product: labelForm.productName }));
                } else alert('บันทึกฉลากเรียบร้อยครับ');
            } else { if (!isAutoSave) alert('บันทึกไม่สำเร็จ: ' + (data.message || '')); }
        } catch (err) { if (!isAutoSave) alert('Error: ' + err.message); }
        finally { if (!isAutoSave) setIsSavingLabel(false); }
    };

    const handleDownloadLabel = async () => {
        if (!labelRef.current) return;
        handleSaveLabel(true);
        try {
            const canvas = await html2canvas(labelRef.current, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: null });
            const link = document.createElement("a");
            link.href = canvas.toDataURL("image/png");
            link.download = `Label_${labelForm.productName || 'design'}.png`;
            link.click();
        } catch (err) { alert('ไม่สามารถดาวน์โหลดได้: รูปภาพอาจมาจากแหล่งที่บล็อก CORS'); }
    };

    // ============= HANDLERS MOCKUP =============
    const handleGenerateMockup = async () => {
        setIsModalOpen(false); setIsLoading(true);
        const payload = {
            project_id: projectId, user_id: userId, brand_name: projectData.project_name, category: currentTab,
            details: detailsInput, negative_prompt: negativeInput, use_imported_color: useImportedColor, use_imported_font: useImportedFont
        };
        const res = await fetch('http://localhost:3000/api/generate-picture', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await res.json();
        if (data.status === 'success') fetchPictures();
        setIsLoading(false);
    };

    const toggleFavorite = async (id, currentStatus) => {
        const newStatus = !currentStatus;
        setGeneratedItems(items => items.map(item => item.id === id ? { ...item, isFavorite: newStatus } : item));
        await fetch(`http://localhost:3000/api/pictures/like/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isFavorite: newStatus }) });
    };

    const activeItems = generatedItems.filter(item => item.category === currentTab);

    // ============= RENDER LABEL PREVIEW =============
    const renderLabelPreview = () => {
        const textColor = sectionColors.productName;
        const accentColor = sectionColors.tagline;
        const subColor = sectionColors.details;

        const bgLayerStyle = bgMode === 'solid' ? { background: bgColor } : { backgroundImage: `url(${bgImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: bgOpacity };

        const containerW = labelDimensions.width || 380;
        const containerH = labelDimensions.height || 500;

        const renderCerts = () => labelForm.certifications.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: layoutType === 'modern_side' ? 'flex-start' : 'center', margin: '8px 0' }}>
                {labelForm.certifications.map(id => {
                    const c = CERT_OPTIONS.find(x => x.id === id);
                    if (!c) return null;
                    return <span key={id} style={{ background: accentColor, color: '#fff', fontSize: 10, padding: '3px 8px', borderRadius: 999, fontWeight: 'bold' }}>{c.label}</span>;
                })}
            </div>
        );

        const renderCodes = () => (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: layoutType === 'modern_side' ? 'flex-start' : 'center', flexWrap: 'wrap' }}>
                {labelForm.showQR && labelForm.qrValue && <div style={{ background: '#fff', padding: 6, borderRadius: 6 }}><QRCodeSVG value={labelForm.qrValue} size={56} /></div>}
                {labelForm.showBarcode && labelForm.barcodeValue && <div style={{ background: '#fff', padding: 4, borderRadius: 6 }}><Barcode value={labelForm.barcodeValue} height={36} fontSize={10} width={1.2} margin={0} /></div>}
            </div>
        );

        const renderManufacturer = () => {
            const items = [];
            if (labelForm.manufacturerName) items.push('ผลิตโดย: ' + labelForm.manufacturerName);
            if (labelForm.manufacturerAddress) items.push(labelForm.manufacturerAddress);
            const contact = [labelForm.manufacturerPhone && 'โทร. ' + labelForm.manufacturerPhone, labelForm.manufacturerLine && 'Line: ' + labelForm.manufacturerLine, labelForm.manufacturerFacebook && 'FB: ' + labelForm.manufacturerFacebook].filter(Boolean).join(' | ');
            if (contact) items.push(contact);
            if (labelForm.manufacturerWebsite) items.push(labelForm.manufacturerWebsite);
            if (items.length === 0) return null;
            return <div style={{ fontSize: 9, color: subColor, lineHeight: 1.5, textAlign: layoutType === 'modern_side' ? 'left' : 'center' }}>{items.map((t, i) => <div key={i}>{t}</div>)}</div>;
        };

        const renderLegal = () => {
            const items = [];
            if (labelForm.fdaNumber) items.push('อย. ' + labelForm.fdaNumber);
            if (labelForm.lotNumber) items.push('Lot: ' + labelForm.lotNumber);
            if (labelForm.mfgDate) items.push('MFG: ' + labelForm.mfgDate);
            if (labelForm.expDate) items.push('EXP: ' + labelForm.expDate);
            if (items.length === 0) return null;
            return <div style={{ fontSize: 9, color: subColor, marginTop: 4 }}>{items.join(' • ')}</div>;
        };

        const Logo = ({ size = 90 }) => labelAssets.logoUrl ? <img src={labelAssets.logoUrl} crossOrigin="anonymous" alt="logo" style={{ width: size, height: size, objectFit: 'contain' }} /> : <div style={{ width: size, height: size, background: 'rgba(0,0,0,0.06)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: 12 }}>LOGO</div>;

        if (layoutType === 'centered_classic') {
            return (
                <div ref={labelRef} style={{ width: containerW, height: containerH, position: 'relative', overflow: 'hidden', borderRadius: 18, color: textColor, fontFamily: labelAssets.font, boxShadow: '0 12px 32px rgba(0,0,0,0.12)', background: '#fff' }}>
                    <div style={{ position: 'absolute', inset: 0, ...bgLayerStyle }} />
                    <div style={{ position: 'relative', height: '100%', padding: 30, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                        <Logo size={90} />
                        <h2 style={{ fontSize: 26, margin: '14px 0 6px', fontWeight: 800, color: textColor }}>{labelForm.productName || <span style={{ opacity: .35 }}>ชื่อสินค้า</span>}</h2>
                        {labelForm.tagline && <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 4px', color: accentColor }}>{labelForm.tagline}</p>}
                        {labelForm.netWeight && <p style={{ fontSize: 11, margin: 0, color: subColor }}>ปริมาณสุทธิ: {labelForm.netWeight}</p>}
                        {renderCerts()}
                        <div style={{ flex: 1, width: '100%', marginTop: 8, fontSize: 11, lineHeight: 1.6 }}>
                            {labelForm.ingredients && (
                                <div style={{ background: 'rgba(255,255,255,0.7)', padding: 10, borderRadius: 8, marginBottom: 6, textAlign: 'left' }}>
                                    <strong style={{ fontSize: 11, color: textColor }}>ส่วนประกอบ:</strong>
                                    <div style={{ whiteSpace: 'pre-wrap', color: subColor }}>{labelForm.ingredients}</div>
                                </div>
                            )}
                            {finalUsageString && <div style={{ marginBottom: 4, textAlign: 'left' }}><strong style={{ fontSize: 10, color: textColor }}>วิธีใช้:</strong> <span style={{ color: subColor }}>{finalUsageString}</span></div>}
                            {finalStorageString && <div style={{ marginBottom: 4, textAlign: 'left' }}><strong style={{ fontSize: 10, color: textColor }}>วิธีเก็บรักษา:</strong> <span style={{ color: subColor }}>{finalStorageString}</span></div>}
                            {finalWarningString && <div style={{ color: '#c0392b', fontSize: 10, textAlign: 'left' }}>⚠ {finalWarningString}</div>}
                        </div>
                        {renderCodes()} {renderManufacturer()} {renderLegal()}
                    </div>
                </div>
            );
        }

        if (layoutType === 'modern_side') {
            return (
                <div ref={labelRef} style={{ width: containerW, height: containerH, position: 'relative', overflow: 'hidden', borderRadius: 14, color: textColor, fontFamily: labelAssets.font, boxShadow: '0 12px 32px rgba(0,0,0,0.12)', background: '#fff' }}>
                    <div style={{ position: 'absolute', inset: 0, ...bgLayerStyle }} />
                    <div style={{ position: 'relative', height: '100%', padding: 28, display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                            <Logo size={70} />
                            <div style={{ flex: 1 }}>
                                <h2 style={{ fontSize: 22, margin: 0, fontWeight: 800, lineHeight: 1.1, color: textColor }}>{labelForm.productName || <span style={{ opacity: .35 }}>ชื่อสินค้า</span>}</h2>
                                {labelForm.tagline && <p style={{ fontSize: 12, margin: '4px 0 0', color: accentColor, fontWeight: 600 }}>{labelForm.tagline}</p>}
                            </div>
                        </div>
                        {labelForm.netWeight && <div style={{ fontSize: 11, color: subColor, marginBottom: 6 }}>ปริมาณสุทธิ: {labelForm.netWeight}</div>}
                        {renderCerts()}
                        <div style={{ flex: 1, fontSize: 11, lineHeight: 1.5, marginTop: 6, color: subColor }}>
                            {labelForm.ingredients && <div style={{ marginBottom: 6 }}><strong style={{ color: textColor }}>ส่วนประกอบ:</strong><div style={{ whiteSpace: 'pre-wrap' }}>{labelForm.ingredients}</div></div>}
                            {finalUsageString && <div style={{ marginBottom: 6 }}><strong style={{ color: textColor }}>วิธีใช้:</strong> {finalUsageString}</div>}
                            {finalStorageString && <div style={{ marginBottom: 6 }}><strong style={{ color: textColor }}>วิธีเก็บ:</strong> {finalStorageString}</div>}
                            {finalWarningString && <div style={{ color: '#c0392b' }}>⚠ {finalWarningString}</div>}
                        </div>
                        {renderCodes()}
                        <div style={{ marginTop: 8 }}>{renderManufacturer()} {renderLegal()}</div>
                    </div>
                </div>
            );
        }

        if (layoutType === 'premium_frame') {
            return (
                <div ref={labelRef} style={{ width: containerW, height: containerH, position: 'relative', overflow: 'hidden', borderRadius: 8, color: textColor, fontFamily: labelAssets.font, boxShadow: '0 12px 32px rgba(0,0,0,0.15)', background: '#fff' }}>
                    <div style={{ position: 'absolute', inset: 0, ...bgLayerStyle }} />
                    <div style={{ position: 'absolute', inset: 14, border: `2px solid ${accentColor}`, borderRadius: 4, pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', inset: 20, border: `1px solid ${accentColor}55`, borderRadius: 2, pointerEvents: 'none' }} />
                    <div style={{ position: 'relative', height: '100%', padding: '36px 30px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                        <div style={{ fontSize: 9, letterSpacing: 4, color: accentColor, marginBottom: 6 }}>━━ PREMIUM ━━</div>
                        <Logo size={80} />
                        <h2 style={{ fontSize: 24, margin: '12px 0 4px', fontWeight: 700, letterSpacing: 1, color: textColor }}>{labelForm.productName || <span style={{ opacity: .35 }}>ชื่อสินค้า</span>}</h2>
                        <div style={{ width: 40, height: 1, background: accentColor, margin: '6px 0' }} />
                        {labelForm.tagline && <p style={{ fontSize: 12, margin: '0 0 6px', fontStyle: 'italic', color: accentColor }}>{labelForm.tagline}</p>}
                        {labelForm.netWeight && <p style={{ fontSize: 10, margin: 0, color: subColor }}>{labelForm.netWeight}</p>}
                        {renderCerts()}
                        <div style={{ flex: 1, width: '100%', fontSize: 10.5, lineHeight: 1.6, marginTop: 8 }}>
                            {labelForm.ingredients && <div style={{ background: 'rgba(255,255,255,0.65)', padding: 8, borderRadius: 4, marginBottom: 4, textAlign: 'left' }}><strong style={{ fontSize: 10, color: textColor }}>INGREDIENTS · ส่วนประกอบ</strong><div style={{ whiteSpace: 'pre-wrap', color: subColor }}>{labelForm.ingredients}</div></div>}
                            {finalUsageString && <div style={{ marginBottom: 3, textAlign: 'left' }}><strong style={{ color: textColor }}>วิธีใช้:</strong> <span style={{ color: subColor }}>{finalUsageString}</span></div>}
                            {finalWarningString && <div style={{ color: '#c0392b', fontSize: 10, textAlign: 'left' }}>⚠ {finalWarningString}</div>}
                        </div>
                        {renderCodes()} {renderManufacturer()} {renderLegal()}
                    </div>
                </div>
            );
        }

        if (layoutType === 'minimal_strip') {
            return (
                <div ref={labelRef} style={{ width: containerW, height: containerH, position: 'relative', overflow: 'hidden', borderRadius: 12, color: textColor, fontFamily: labelAssets.font, boxShadow: '0 12px 32px rgba(0,0,0,0.12)', background: '#fff' }}>
                    <div style={{ position: 'absolute', inset: 0, ...bgLayerStyle }} />
                    <div style={{ position: 'relative', padding: '40px 28px 20px', textAlign: 'center' }}>
                        <Logo size={70} />
                        <h2 style={{ fontSize: 38, margin: '16px 0 6px', fontWeight: 900, lineHeight: 1, letterSpacing: -0.5, color: textColor }}>{labelForm.productName || <span style={{ opacity: .35 }}>ชื่อสินค้า</span>}</h2>
                        {labelForm.tagline && <p style={{ fontSize: 14, margin: '0 0 4px', color: accentColor, fontWeight: 600 }}>{labelForm.tagline}</p>}
                        {labelForm.netWeight && <p style={{ fontSize: 11, margin: 0, color: subColor }}>{labelForm.netWeight}</p>}
                    </div>
                    <div style={{ position: 'relative', padding: '0 28px', flex: 1, fontSize: 11, lineHeight: 1.55, color: subColor }}>
                        {renderCerts()}
                        {labelForm.ingredients && <div style={{ marginBottom: 6 }}><strong style={{ color: textColor }}>ส่วนประกอบ:</strong><div style={{ whiteSpace: 'pre-wrap' }}>{labelForm.ingredients}</div></div>}
                        {finalUsageString && <div style={{ marginBottom: 4 }}><strong style={{ color: textColor }}>วิธีใช้:</strong> {finalUsageString}</div>}
                        {finalWarningString && <div style={{ color: '#c0392b' }}>⚠ {finalWarningString}</div>}
                        <div style={{ marginTop: 8 }}>{renderCodes()}</div>
                    </div>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 22px', background: textColor + 'E0', color: '#fff', fontSize: 9, lineHeight: 1.5 }}>
                        {(labelForm.manufacturerName || labelForm.manufacturerAddress) && <div>{labelForm.manufacturerName && <strong>{labelForm.manufacturerName} </strong>}{labelForm.manufacturerAddress}</div>}
                        <div>{[labelForm.fdaNumber && 'อย. ' + labelForm.fdaNumber, labelForm.lotNumber && 'Lot: ' + labelForm.lotNumber, labelForm.mfgDate && 'MFG: ' + labelForm.mfgDate, labelForm.expDate && 'EXP: ' + labelForm.expDate, labelForm.manufacturerPhone && 'โทร ' + labelForm.manufacturerPhone].filter(Boolean).join(' • ')}</div>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="rs-body">
            <header className="rs-navbar">
                <div className="rs-logo"><Link to="/"><img src={logoImg} alt="logo" className="rs-logo-img" /></Link></div>
                <div className="rs-nav-icons">
                    <button className="rs-btn-world"><iconify-icon icon="iconamoon:search-light"></iconify-icon></button>
                    <button className="rs-btn-world"><iconify-icon icon="ph:bell-ringing-light"></iconify-icon></button>
                    <button className="rs-btn-users"><iconify-icon icon="solar:user-linear"></iconify-icon></button>
                </div>
            </header>

            <div className="rs-container">
                <aside className={`rs-sidebar ${isSidebarCollapsed ? 'rs-collapsed' : ''}`}>
                    <button className="rs-toggle-btn" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>{isSidebarCollapsed ? '❯' : '❮'}</button>
                    <ul className="rs-menu">
                        <li onClick={() => navigate('/project', { state: { projectId } })}><span className="rs-icon"><iconify-icon icon="mdi:view-dashboard-outline"></iconify-icon></span><span className="rs-text">Projects</span></li>
                        <li onClick={() => navigate('/brand-dna', { state: { projectId } })}><span className="rs-icon"><iconify-icon icon="mdi:palette-outline"></iconify-icon></span><span className="rs-text">Brand DNA</span></li>
                        <li onClick={() => navigate('/create-concept', { state: { projectId } })}><span className="rs-icon"><iconify-icon icon="mdi:lightbulb-outline"></iconify-icon></span><span className="rs-text">Create Concept</span></li>
                        <li onClick={() => navigate('/create-logo', { state: { projectId } })}><span className="rs-icon"><iconify-icon icon="mdi:folder-outline"></iconify-icon></span><span className="rs-text">Create logo</span></li>
                        <li className="active" style={{ cursor: 'pointer', background: '#f5f5f5' }}><span className="cncpt-icon" style={{ color: '#d3542b' }}><iconify-icon icon="mdi:image-outline"></iconify-icon></span><span className="cncpt-text" style={{ color: '#d3542b', fontWeight: 'bold' }}>Create Pictures</span></li>
                    </ul>
                </aside>

                <div className="rs-main-content">
                    <div className="rs-tabs-wrapper">
                        <div className="rs-tabs">
                            <div className="rs-tab-indicator" style={{ left: `${indicatorStyle.left}px`, width: `${indicatorStyle.width}px`, background: indicatorStyle.background }}></div>
                            <button ref={el => tabsRef.current[0] = el} className={`rs-tab ${currentTab === 'package' ? 'rs-active' : ''}`} data-color="#c94e1f" onClick={() => setCurrentTab('package')}>Package</button>
                            <button ref={el => tabsRef.current[1] = el} className={`rs-tab ${currentTab === 'label' ? 'rs-active' : ''}`} data-color="#8a9a3c" onClick={() => setCurrentTab('label')}>Label</button>
                            <button ref={el => tabsRef.current[2] = el} className={`rs-tab ${currentTab === 'mockup' ? 'rs-active' : ''}`} data-color="#8f1d1d" onClick={() => setCurrentTab('mockup')}>Mockup</button>
                        </div>
                    </div>

                    <div className="rs-tab-page rs-active" style={{ marginTop: 20 }}>
                        {currentTab === 'package' && <PackageCatalog />}

                        {/* แท็บ Label Design */}
                        {currentTab === 'label' && (
                            <>
                                {!selectedProduct ? (
                                    <div>
                                        <h2 style={{ color: '#8a9a3c', marginTop: 0 }}>เลือกสินค้าเพื่อออกแบบฉลาก</h2>
                                        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 20 }}>
                                            {products.map(prod => (
                                                <div key={prod.product_id} onClick={() => handleSelectProduct(prod)}
                                                    style={{ width: 200, background: '#fff', padding: 15, borderRadius: 12, cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.05)', textAlign: 'center', border: '1px solid #eee' }}>
                                                    <div style={{ width: '100%', height: 150, background: '#f9f9f9', borderRadius: 8, marginBottom: 10, overflow: 'hidden' }}>
                                                        {prod.image_product ? <img src={`http://localhost:3000/uploads/${prod.image_product}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ padding: '50px 0', color: '#ccc' }}>No Image</div>}
                                                    </div>
                                                    <h3 style={{ margin: 0, fontSize: 16 }}>{prod.name_product}</h3>
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
                                    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', fontFamily: labelAssets.font }}>
                                        <div style={{ flex: '0 0 440px', maxHeight: 'calc(100vh - 180px)', overflowY: 'auto', background: '#fff', padding: 24, borderRadius: 14, boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>

                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                                                <button onClick={() => { handleSaveLabel(true); setSelectedProduct(null); }} style={{ background: '#eee', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}>❮ ย้อนกลับ</button>
                                                <span style={{ fontSize: 12, color: saveStatus.includes('✓') ? '#8a9a3c' : '#888' }}>{saveStatus}</span>
                                            </div>

                                            <h3 style={{ marginTop: 0, color: '#8a9a3c' }}>ออกแบบฉลาก: {selectedProduct.name_product}</h3>

                                            <div style={{ marginBottom: 20 }}>
                                                <label style={{ fontWeight: 'bold', fontSize: 13, display: 'block', marginBottom: 8 }}>เลือก Layout</label>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                                    {TEMPLATE_TYPES.map(t => (
                                                        <button key={t.id} onClick={() => setLayoutType(t.id)} style={{ padding: '10px 8px', textAlign: 'left', border: layoutType === t.id ? '2px solid #8a9a3c' : '1px solid #ddd', background: layoutType === t.id ? '#f5f8eb' : '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>
                                                            <div style={{ fontWeight: 'bold' }}>{t.name}</div>
                                                            <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>{t.desc}</div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <AccordionSection title="📐 ตั้งค่าขนาด & สี" open={openAccordions.settings} onToggle={() => toggleAccordion('settings')}>
                                                <div style={{ display: 'flex', gap: 10, marginBottom: 15 }}>
                                                    <div style={{ flex: 1 }}>
                                                        <label style={{ fontSize: 12, fontWeight: 'bold' }}>กว้าง (ซม.)</label>
                                                        {/* 🟢 หาร 38 เพื่อโชว์เป็น ซม. และคูณ 38 กลับเป็น Pixel ตอนเซฟ */}
                                                        <input type="number" step="0.1" value={Math.round(labelDimensions.width / 38 * 10) / 10}
                                                            onChange={e => setLabelDimensions({ ...labelDimensions, width: Math.round(e.target.value * 38) })}
                                                            style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #ddd', boxSizing: 'border-box' }} />
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <label style={{ fontSize: 12, fontWeight: 'bold' }}>สูง (ซม.)</label>
                                                        {/* 🟢 หาร 38 เพื่อโชว์เป็น ซม. และคูณ 38 กลับเป็น Pixel ตอนเซฟ */}
                                                        <input type="number" step="0.1" value={Math.round(labelDimensions.height / 38 * 10) / 10}
                                                            onChange={e => setLabelDimensions({ ...labelDimensions, height: Math.round(e.target.value * 38) })}
                                                            style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #ddd', boxSizing: 'border-box' }} />
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                                                    <label style={{ fontSize: 13 }}>สีชื่อสินค้า</label>
                                                    <input type="color" value={sectionColors.productName} onChange={e => setSectionColors({ ...sectionColors, productName: e.target.value })} />
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                                                    <label style={{ fontSize: 13 }}>สีคำโปรย</label>
                                                    <input type="color" value={sectionColors.tagline} onChange={e => setSectionColors({ ...sectionColors, tagline: e.target.value })} />
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <label style={{ fontSize: 13 }}>สีรายละเอียด</label>
                                                    <input type="color" value={sectionColors.details} onChange={e => setSectionColors({ ...sectionColors, details: e.target.value })} />
                                                </div>
                                            </AccordionSection>

                                            <AccordionSection title="พื้นหลังฉลาก" open={openAccordions.bg} onToggle={() => toggleAccordion('bg')}>
                                                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                                                    <BgModeBtn label="สีพื้น" active={bgMode === 'solid'} onClick={() => setBgMode('solid')} />
                                                    <BgModeBtn label="🖼 Preset" active={bgMode === 'preset'} onClick={() => setBgMode('preset')} />
                                                    <BgModeBtn label="AI" active={bgMode === 'dalle'} onClick={() => setBgMode('dalle')} />
                                                </div>

                                                <div style={{ marginBottom: 10 }}>
                                                    <label style={{ fontSize: 12, fontWeight: 'bold' }}>อัปโหลดรูปภาพเอง</label>
                                                    <input type="file" accept="image/*" onChange={handleUploadCustomBg} style={{ width: '100%', fontSize: 12, marginTop: 4 }} />
                                                </div>

                                                {bgMode === 'solid' && (
                                                    <div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                                            <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} style={{ width: 50, height: 40, border: 'none', cursor: 'pointer', borderRadius: 6 }} />
                                                            <input type="text" value={bgColor} onChange={e => setBgColor(e.target.value)} style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #ddd' }} />
                                                        </div>
                                                        <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>สีจาก Brand Palette</div>
                                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                            {labelAssets.colors.map((c, i) => <button key={i} onClick={() => setBgColor(c)} style={{ width: 32, height: 32, borderRadius: 6, background: c, border: bgColor === c ? '2px solid #333' : '1px solid #ddd', cursor: 'pointer' }} title={c} />)}
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
                                                        {bgPresets.length === 0 && <div style={{ fontSize: 11, color: '#999' }}>ยังไม่มี preset (ตรวจสอบตาราง bg_preset)</div>}
                                                    </div>
                                                )}

                                                {bgMode === 'dalle' && (
                                                    <div>
                                                        <div style={{ marginBottom: 8 }}><label style={{ fontSize: 11, fontWeight: 'bold' }}>สไตล์ลาย</label><select value={dalleStyle} onChange={e => setDalleStyle(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd' }}>{BG_STYLES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                                                            <div><label style={{ fontSize: 11, fontWeight: 'bold' }}>โทน</label><select value={dalleTone} onChange={e => setDalleTone(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd' }}><option value="auto">Auto</option><option value="bright">สว่าง</option><option value="dark">เข้ม</option><option value="pastel">Pastel</option></select></div>
                                                            <div><label style={{ fontSize: 11, fontWeight: 'bold' }}>ความหนาแน่น</label><select value={dalleDensity} onChange={e => setDalleDensity(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd' }}><option value="low">เบาบาง</option><option value="medium">ปานกลาง</option><option value="high">หนาแน่น</option></select></div>
                                                        </div>
                                                        <button onClick={handleGenerateBgWithDalle} disabled={isGeneratingBg} style={{ width: '100%', padding: 12, background: '#8f1d1d', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer', marginBottom: 6 }}>{isGeneratingBg ? 'กำลังสร้างพื้นหลัง...' : 'Generate Background (DALL-E)'}</button>
                                                        {bgImageUrl && bgMode === 'dalle' && <img src={bgImageUrl} alt="bg preview" style={{ width: '100%', borderRadius: 6, marginTop: 6 }} />}
                                                    </div>
                                                )}

                                                {(bgMode === 'preset' || bgMode === 'dalle') && bgImageUrl && (
                                                    <div style={{ marginTop: 12 }}>
                                                        <label style={{ fontSize: 11, fontWeight: 'bold' }}>ความเข้มรูปภาพ: {Math.round(bgOpacity * 100)}%</label>
                                                        <input type="range" min="0.2" max="1" step="0.05" value={bgOpacity} onChange={e => setBgOpacity(parseFloat(e.target.value))} style={{ width: '100%' }} />
                                                    </div>
                                                )}
                                            </AccordionSection>

                                            <AccordionSection title="ข้อมูลหลัก" open={openAccordions.main} onToggle={() => toggleAccordion('main')}>
                                                <FormInput label="ชื่อสินค้า *" value={labelForm.productName} onChange={v => setField('productName', v)} />
                                                <FormInput label="คำโปรย / Tagline" value={labelForm.tagline} onChange={v => setField('tagline', v)} />
                                                <FormInput label="ปริมาณสุทธิ (เช่น 100 g, 250 ml)" value={labelForm.netWeight} onChange={v => setField('netWeight', v)} />
                                                <button onClick={handleAIWriteCopy} disabled={isLabelAILoading} style={{ width: '100%', padding: 10, background: '#d3542b', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer', marginTop: 6 }}>
                                                    {isLabelAILoading ? 'Gemini กำลังคิด...' : 'ให้ AI ช่วยร่างคำโปรย+ส่วนประกอบ'}
                                                </button>
                                            </AccordionSection>

                                            {/* 🟢 การปรับปรุงข้อ B เป็นแบบปุ่มกด */}
                                            <AccordionSection title="ข้อมูลผลิตภัณฑ์ (แบบแท็ก)" open={openAccordions.product} onToggle={() => toggleAccordion('product')}>
                                                <FormTextarea label="ส่วนประกอบ / Ingredients" value={labelForm.ingredients} onChange={v => setField('ingredients', v)} rows={3} />

                                                <TagSelector
                                                    label="วิธีใช้ / รับประทาน" options={USAGE_OPTIONS} selectedTags={labelForm.usageTags}
                                                    onTagToggle={(opt) => handleTagToggle('usageTags', opt)}
                                                    showCustom={labelForm.showUsageCustom} onToggleCustom={() => setField('showUsageCustom', !labelForm.showUsageCustom)}
                                                    customText={labelForm.usageCustom} onCustomChange={v => setField('usageCustom', v)}
                                                />
                                                <TagSelector
                                                    label="วิธีเก็บรักษา" options={STORAGE_OPTIONS} selectedTags={labelForm.storageTags}
                                                    onTagToggle={(opt) => handleTagToggle('storageTags', opt)}
                                                    showCustom={labelForm.showStorageCustom} onToggleCustom={() => setField('showStorageCustom', !labelForm.showStorageCustom)}
                                                    customText={labelForm.storageCustom} onCustomChange={v => setField('storageCustom', v)}
                                                />
                                                <TagSelector
                                                    label="คำเตือน" options={WARNING_OPTIONS} selectedTags={labelForm.warningTags}
                                                    onTagToggle={(opt) => handleTagToggle('warningTags', opt)}
                                                    showCustom={labelForm.showWarningCustom} onToggleCustom={() => setField('showWarningCustom', !labelForm.showWarningCustom)}
                                                    customText={labelForm.warningCustom} onCustomChange={v => setField('warningCustom', v)}
                                                />
                                            </AccordionSection>

                                            <AccordionSection title="ข้อมูลผู้ผลิต" open={openAccordions.manufacturer} onToggle={() => toggleAccordion('manufacturer')}>
                                                <FormInput label="ชื่อผู้ผลิต" value={labelForm.manufacturerName} onChange={v => setField('manufacturerName', v)} />
                                                <FormTextarea label="ที่อยู่" value={labelForm.manufacturerAddress} onChange={v => setField('manufacturerAddress', v)} rows={2} />
                                                <FormInput label="โทรศัพท์" value={labelForm.manufacturerPhone} onChange={v => setField('manufacturerPhone', v)} />
                                                <FormInput label="Line ID" value={labelForm.manufacturerLine} onChange={v => setField('manufacturerLine', v)} />
                                                <FormInput label="Facebook" value={labelForm.manufacturerFacebook} onChange={v => setField('manufacturerFacebook', v)} />
                                                <FormInput label="Website" value={labelForm.manufacturerWebsite} onChange={v => setField('manufacturerWebsite', v)} />
                                            </AccordionSection>

                                            <AccordionSection title="กฎหมาย & วันที่" open={openAccordions.legal} onToggle={() => toggleAccordion('legal')}>
                                                <FormInput label="เลข อย. / มอก. / เลขจดแจ้ง" value={labelForm.fdaNumber} onChange={v => setField('fdaNumber', v)} />
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                                    <FormInput label="วันผลิต (MFG)" type="date" value={labelForm.mfgDate} onChange={v => setField('mfgDate', v)} />
                                                    <FormInput label="วันหมดอายุ (EXP)" type="date" value={labelForm.expDate} onChange={v => setField('expDate', v)} />
                                                </div>
                                                <FormInput label="Lot Number" value={labelForm.lotNumber} onChange={v => setField('lotNumber', v)} />
                                            </AccordionSection>

                                            <AccordionSection title="ตราสัญลักษณ์รับรอง" open={openAccordions.cert} onToggle={() => toggleAccordion('cert')}>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                                    {CERT_OPTIONS.map(c => (
                                                        <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                                                            <input type="checkbox" checked={labelForm.certifications.includes(c.id)} onChange={() => toggleCertification(c.id)} /> {c.label}
                                                        </label>
                                                    ))}
                                                </div>
                                            </AccordionSection>

                                            <AccordionSection title="F. QR Code & Barcode" open={openAccordions.qr} onToggle={() => toggleAccordion('qr')}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                                    <input type="checkbox" checked={labelForm.showQR} onChange={e => setField('showQR', e.target.checked)} /> แสดง QR Code บนฉลาก
                                                </label>
                                                {labelForm.showQR && <FormInput label="ค่าที่จะใส่ใน QR (URL / Line ID)" value={labelForm.qrValue} onChange={v => setField('qrValue', v)} />}
                                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 6 }}>
                                                    <input type="checkbox" checked={labelForm.showBarcode} onChange={e => setField('showBarcode', e.target.checked)} /> แสดง Barcode บนฉลาก
                                                </label>
                                                {labelForm.showBarcode && <FormInput label="ตัวเลข Barcode (เช่น EAN-13)" value={labelForm.barcodeValue} onChange={v => setField('barcodeValue', v)} />}
                                            </AccordionSection>

                                            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                                                <button onClick={() => handleSaveLabel()} disabled={isSavingLabel} style={{ flex: 1, padding: 12, background: '#8a9a3c', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer' }}>
                                                    {isSavingLabel ? 'กำลังบันทึก...' : 'บันทึก'}
                                                </button>
                                                <button onClick={handleDownloadLabel} style={{ flex: 1, padding: 12, background: '#333', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer' }}>
                                                    ⬇ PNG
                                                </button>
                                            </div>
                                        </div>

                                        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', background: '#f0f2f5', padding: 40, borderRadius: 14, minHeight: 600, maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' }}>
                                            {renderLabelPreview()}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* แท็บ Mockup */}
                        {currentTab === 'mockup' && (
                            <MockupEditor
                                projectId={projectId}
                                userId={userId}
                                projectName={projectData.project_name}
                            />
                        )}

                    </div>
                </div>
            </div>

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

            {isModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#fff', padding: 30, borderRadius: 12, width: 480 }}>
                        <h3 style={{ marginTop: 0 }}>Generate Mockup</h3>
                        <textarea placeholder="รายละเอียดเพิ่มเติม..." value={detailsInput} onChange={e => setDetailsInput(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', minHeight: 80 }} />
                        <textarea placeholder="Negative prompt (ห้ามมี...)" value={negativeInput} onChange={e => setNegativeInput(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', minHeight: 60, marginTop: 8 }} />
                        <label style={{ display: 'block', marginTop: 8 }}><input type="checkbox" checked={useImportedColor} onChange={e => setUseImportedColor(e.target.checked)} /> ใช้ Color Palette ของแบรนด์</label>
                        <label style={{ display: 'block', marginTop: 4 }}><input type="checkbox" checked={useImportedFont} onChange={e => setUseImportedFont(e.target.checked)} /> ใช้ฟอนต์ของแบรนด์</label>
                        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                            <button onClick={() => setIsModalOpen(false)} style={{ flex: 1, padding: 10, background: '#eee', border: 'none', borderRadius: 6, cursor: 'pointer' }}>ยกเลิก</button>
                            <button onClick={handleGenerateMockup} style={{ flex: 1, padding: 10, background: '#8f1d1d', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Generate</button>
                        </div>
                    </div>
                </div>
            )}

            {previewImage && <div onClick={() => setPreviewImage(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, cursor: 'pointer' }}><img src={previewImage} style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} /></div>}
            {isLoading && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, color: '#fff', fontSize: 18 }}>กำลังสร้าง Mockup ด้วย DALL-E...</div>}
        </div>
    );
};

export default Result;

// ============= SUB COMPONENTS =============
function AccordionSection({ title, open, onToggle, children }) {
    return (
        <div style={{ marginBottom: 12, border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
            <button onClick={onToggle} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: open ? '#f5f8eb' : '#fafafa', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
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

// 🟢 Component ใหม่สำหรับปุ่มกด B. ข้อมูลผลิตภัณฑ์
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