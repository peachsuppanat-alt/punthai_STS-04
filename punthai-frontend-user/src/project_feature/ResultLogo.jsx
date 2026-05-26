import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { downloadLogo } from './logoUtils';
import './ResultLogo.css';
import { getUserFromStorage, isFormatAllowed } from '../utils/subscriptionGuard';
import ProUpgradeModal from '../components/ProUpgradeModal';
import { ProjectSidebar } from '../components/sidebar';

import logoImg from '../assets/logo.png';

export const ResultLogo = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const projectId = location.state?.projectId;

    const [generatedImages, setGeneratedImages] = useState([]);
    const [selectedImage, setSelectedImage] = useState(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [brandName, setBrandName] = useState('');
    const [brandValue, setBrandValue] = useState('');
    const [importedProducts, setImportedProducts] = useState([]);
    const [selectedStyle, setSelectedStyle] = useState('combination');
    const [detailsInput, setDetailsInput] = useState('');
    const [negativeInput, setNegativeInput] = useState('');
    const [useImportedColor, setUseImportedColor] = useState(false);
    const [useImportedFont, setUseImportedFont] = useState(false);
    const [downloadMenuOpen, setDownloadMenuOpen] = useState(null);
    const [downloading, setDownloading] = useState(null);
    const [showProModal, setShowProModal] = useState(false);

    const styleOptions = [
        { id: 'wordmark',    name: 'Wordmark',    desc: '(ตัวอักษรล้วน)',   icon: 'mdi:format-text' },
        { id: 'lettermark',  name: 'Lettermark',  desc: '(อักษรย่อ)',        icon: 'mdi:format-letter-case' },
        { id: 'combination', name: 'Combination', desc: '(ผสม)',             icon: 'mdi:puzzle-outline' },
        { id: 'emblem',      name: 'Emblem',      desc: '(ตราสัญลักษณ์)',    icon: 'mdi:shield-check-outline' },
        { id: 'mascot',      name: 'Mascot',      desc: '(มาสคอต)',          icon: 'mdi:teddy-bear' },
        { id: 'minimal',     name: 'Minimal',     desc: '(มินิมอล)',         icon: 'mdi:shape-outline' }
    ];

    const fetchImages = () => {
        fetch(`http://localhost:3000/api/generated-logos/${projectId}`)
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    const formattedImages = data.images.map(img => ({
                        id: img.history_id,
                        url: img.image_url,
                        isLiked: img.is_liked === 1,
                        isSelected: img.is_selected === 1
                    }));
                    setGeneratedImages(formattedImages);
                }
            })
            .catch(err => console.error('Error fetching logos:', err));
    };

    useEffect(() => {
        if (projectId) {
            fetchImages();
            const savedData = localStorage.getItem(`lastLogoForm_${projectId}`);
            if (savedData) {
                try {
                    const parsed = JSON.parse(savedData);
                    setBrandName(parsed.brand_name || '');
                    setBrandValue(parsed.brand_value || '');
                    let loadedProducts = parsed.products || [];
                    if (typeof loadedProducts === 'string') loadedProducts = [{ name_product: loadedProducts }];
                    setImportedProducts(loadedProducts);
                    setSelectedStyle(parsed.styles || 'combination');
                    setDetailsInput(parsed.details || '');
                    setNegativeInput(parsed.negative_prompt || parsed.not_want || '');
                } catch (e) { console.error('Error parsing saved form data:', e); }
            }
        } else {
            alert('ไม่พบรหัสโปรเจกต์');
            navigate('/');
        }
    }, [projectId, navigate]);

    const handleLike = async (id) => {
        const imgToUpdate = generatedImages.find(img => img.id === id);
        const newLikeStatus = !imgToUpdate.isLiked;
        setGeneratedImages(images => images.map(img => img.id === id ? { ...img, isLiked: newLikeStatus } : img));
        try {
            await fetch(`http://localhost:3000/api/like-generated-item/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_liked: newLikeStatus ? 1 : 0 })
            });
        } catch (error) { console.error(error); }
    };

    const handleSelect = async (id, url, isCurrentlySelected) => {
        const actionType = isCurrentlySelected ? 'deselect' : 'select';
        setGeneratedImages(images => images.map(img => {
            if (img.id === id) return { ...img, isSelected: !isCurrentlySelected };
            return { ...img, isSelected: false };
        }));
        try {
            await fetch(`http://localhost:3000/api/generated-logos/select/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ project_id: projectId, image_url: url, action: actionType })
            });
            if (actionType === 'select') alert('เลือกรูปโลโก้นี้สำเร็จ!');
        } catch (error) { console.error(error); }
    };

    const handleDownload = async (imgUrl, imgId, format) => {
        setDownloading(`${imgId}_${format}`);
        try {
            const fullUrl = imgUrl.startsWith('http') ? imgUrl : `http://localhost:3000${imgUrl}`;
            await downloadLogo(fullUrl, format, `logo_${imgId}`);
            setDownloadMenuOpen(null);
        } catch (err) {
            alert(`ดาวน์โหลด ${format.toUpperCase()} ไม่สำเร็จ: ${err.message}`);
        } finally {
            setDownloading(null);
        }
    };

    const handleImportBrandValue = async () => {
        try {
            const res = await fetch(`http://localhost:3000/api/brand_dna/${projectId}`);
            const data = await res.json();
            if (data.status === 'success' && data.data) setBrandValue(data.data.brand_value || '');
            else alert('คุณยังไม่ได้ทำแบบทดสอบ Brand DNA ในโปรเจกต์นี้');
        } catch (err) { console.error(err); }
    };

    const handleImportProducts = async () => {
        try {
            const res = await fetch(`http://localhost:3000/api/brand_product/${projectId}`);
            const data = await res.json();
            if (data.status === 'success' && data.products.length > 0) {
                setImportedProducts(data.products);
                alert(`ดึงข้อมูลสินค้ามาแล้ว ${data.products.length} รายการ`);
            } else alert('ยังไม่มีรายการสินค้าในโปรเจกต์นี้');
        } catch (err) { console.error(err); }
    };

    const handleSubmitLogo = () => {
        if (!brandName.trim()) return alert('กรุณาระบุชื่อแบรนด์');
        if (!selectedStyle) return alert('กรุณาเลือกสไตล์ของโลโก้');

        setIsLoading(true);
        setLoadingMessage('กำลังเตรียมข้อมูล...');

        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        const productsText = Array.isArray(importedProducts)
            ? importedProducts.map(p => p.name_product || p).join(', ')
            : importedProducts;

        const payload = {
            project_id: projectId,
            user_id: userData.user_id || 0,
            brand_name: brandName,
            brand_value: brandValue,
            products: productsText,
            styles: selectedStyle,
            details: detailsInput,
            negative_prompt: negativeInput,
            use_imported_color: useImportedColor,
            use_imported_font: useImportedFont
        };

        localStorage.setItem(`lastLogoForm_${projectId}`, JSON.stringify(payload));

        const params = new URLSearchParams();
        Object.entries(payload).forEach(([k, v]) => {
            if (v !== undefined && v !== null) params.append(k, String(v));
        });

        const eventSource = new EventSource(`http://localhost:3000/api/generate-logo?${params.toString()}`);

        eventSource.addEventListener('progress', (e) => {
            try { const data = JSON.parse(e.data); setLoadingMessage(data.message); } catch {}
        });

        eventSource.addEventListener('done', (e) => {
            eventSource.close();
            setIsLoading(false);
            setLoadingMessage('');
            setIsModalOpen(false);
            fetchImages();
        });

        eventSource.addEventListener('error', (e) => {
            eventSource.close();
            setIsLoading(false);
            setLoadingMessage('');
            try { const data = JSON.parse(e.data); alert(data.message || 'เกิดข้อผิดพลาดในการสร้างโลโก้'); }
            catch { alert('เกิดข้อผิดพลาดในการสร้างโลโก้'); }
        });

        eventSource.onerror = () => {
            eventSource.close();
            setIsLoading(false);
            setLoadingMessage('');
            alert('การเชื่อมต่อกับ Server ขาดหาย กรุณาลองใหม่อีกครั้ง');
        };
    };

    return (
        <div className="rl-body">

            {/* Orbs */}
            <div className="rl-orb3" aria-hidden="true"></div>
            <div className="rl-orb4" aria-hidden="true"></div>

            {/* Navbar */}
            <header className="clg-navbar">
                <div className="clg-logo">
                    <Link to="/">
                        <img src={logoImg} alt="logo" className="clg-logo-img" />
                    </Link>
                </div>
                <div className="clg-nav-icons">
                    <button className="clg-btn-world"><iconify-icon icon="iconamoon:search-light"></iconify-icon></button>
                    <button className="clg-btn-world"><iconify-icon icon="ph:bell-ringing-light"></iconify-icon></button>
                    <button className="clg-btn-users" onClick={() => navigate('/profile')}><iconify-icon icon="solar:user-linear"></iconify-icon></button>
                </div>
            </header>

            <div className="clg-layout">

                {/* Sidebar */}
                <ProjectSidebar activePage="create-logo" projectId={projectId} />

                {/* Main */}
                <main className="rl-main">
                    <h1 className="rl-page-title">Result Logo</h1>
                    <p className="rl-page-subtitle">โลโก้แบรนด์ของคุณที่สร้างโดย AI พร้อมแล้ว — เลือก ดาวน์โหลด หรือสร้างใหม่ได้เลย</p>

                    {generatedImages.length === 0 ? (
                        <div className="rl-empty-state">
                            <iconify-icon icon="line-md:loading-loop"></iconify-icon>
                            <p>กำลังโหลดรูปภาพ หรือยังไม่มีรูปที่สร้าง...</p>
                        </div>
                    ) : (
                        <div className="rl-logo-grid">
                            {generatedImages.map((img, index) => (
                                <div key={img.id} className={`rl-logo-card${img.isSelected ? ' rl-logo-card--selected' : ''}`}>
                                    <div className="rl-logo-actions">
                                        <button className="rl-action-btn" onClick={() => setSelectedImage(`http://localhost:3000${img.url}`)}>
                                            <iconify-icon icon="wordpress:fullscreen"></iconify-icon>
                                        </button>

                                        <div style={{ position: 'relative' }}>
                                            <button className="rl-action-btn" onClick={() => setDownloadMenuOpen(downloadMenuOpen === img.id ? null : img.id)}>
                                                <iconify-icon icon="mynaui:download"></iconify-icon>
                                            </button>
                                            {downloadMenuOpen === img.id && (
                                                <div className="rl-download-menu">
                                                    <div className="rl-download-menu-label">เลือกรูปแบบไฟล์</div>
                                                    {[
                                                        { ext: 'png', label: 'PNG' },
                                                        { ext: 'svg', label: 'SVG' },
                                                        { ext: 'eps', label: 'EPS' },
                                                        { ext: 'jpg', label: 'JPG' },
                                                        { ext: 'pdf', label: 'PDF' }
                                                    ].map(opt => {
                                                        const allowed = isFormatAllowed('resultLogo', opt.ext, getUserFromStorage());
                                                        return (
                                                            <button key={opt.ext}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (!allowed) { setDownloadMenuOpen(null); setShowProModal(true); return; }
                                                                    handleDownload(img.url, img.id, opt.ext);
                                                                }}
                                                                disabled={downloading === `${img.id}_${opt.ext}`}
                                                                className={`rl-download-opt${!allowed ? ' rl-download-opt--locked' : ''}`}>
                                                                <span>{opt.label}</span>
                                                                {!allowed && <iconify-icon icon="solar:lock-keyhole-linear" width="14"></iconify-icon>}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        <button className={`rl-action-btn rl-favorite-btn${img.isLiked ? ' active' : ''}`} onClick={() => handleLike(img.id)}>
                                            <iconify-icon icon={img.isLiked ? 'solar:heart-bold' : 'solar:heart-linear'}></iconify-icon>
                                        </button>

                                        <button className={`rl-action-btn${img.isSelected ? ' rl-select-btn--active' : ''}`} onClick={() => handleSelect(img.id, img.url, img.isSelected)}>
                                            <iconify-icon icon={img.isSelected ? 'mdi:check-circle' : 'mdi:check-circle-outline'}></iconify-icon>
                                        </button>
                                    </div>

                                    <div className="rl-logo-box">
                                        <img
                                            src={`http://localhost:3000${img.url}`}
                                            alt={`Logo ${index + 1}`}
                                            style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '12px' }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </main>
            </div>

            {/* Floating Button */}
            <button className="rl-floating-text-btn" onClick={() => setIsModalOpen(true)}>
                <iconify-icon icon="mdi:plus"></iconify-icon>
                สร้างโลโก้ใหม่
            </button>

            {/* ── Image Preview Modal ── */}
            {selectedImage && (
                <div className="rl-preview-overlay" onClick={() => setSelectedImage(null)}>
                    <div className="rl-preview-content" onClick={e => e.stopPropagation()}>
                        <button className="rl-preview-close" onClick={() => setSelectedImage(null)}>&times;</button>
                        <img src={selectedImage} alt="Expanded logo" style={{ width: '100%', maxHeight: '85vh', objectFit: 'contain', borderRadius: '16px' }} />
                    </div>
                </div>
            )}

            {/* ── Regenerate Modal ── */}
            {isModalOpen && (
                <div className="clg-modal" onClick={() => setIsModalOpen(false)}>
                    <div className="clg-modal-box" onClick={(e) => e.stopPropagation()}>
                        <button className="clg-close-modal" onClick={() => setIsModalOpen(false)}>&times;</button>
                        <div className="clg-modal-inner">
                            <h2 className="clg-modal-title">สร้างโลโก้ใหม่</h2>

                            <div className="clg-form-group">
                                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span><span className="clg-step">1</span> ชื่อแบรนด์ <span style={{ color: 'var(--orange)' }}>*</span></span>
                                </label>
                                <input type="text" placeholder="ระบุชื่อแบรนด์ของคุณ" value={brandName} onChange={(e) => setBrandName(e.target.value)} />
                            </div>

                            <div className="clg-form-group">
                                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span><span className="clg-step">2</span> คุณค่า/แนวคิดแบรนด์</span>
                                    <button onClick={handleImportBrandValue} className="clg-import-btn">
                                        <iconify-icon icon="mdi:dna"></iconify-icon> นำเข้า DNA
                                    </button>
                                </label>
                                <textarea rows="2" placeholder="ระบุคุณค่าหรือแนวคิดหลัก..." value={brandValue} onChange={(e) => setBrandValue(e.target.value)} className="clg-textarea" />
                            </div>

                            <div className="clg-form-group">
                                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span><span className="clg-step">3</span> สินค้าที่จะสร้างโลโก้</span>
                                    <button onClick={handleImportProducts} className="clg-import-btn">
                                        <iconify-icon icon="mdi:basket"></iconify-icon> นำเข้าสินค้า
                                    </button>
                                </label>
                                <p className="clg-product-hint">
                                    {importedProducts.length > 0
                                        ? `ใช้สินค้า: ${Array.isArray(importedProducts) ? importedProducts.map(p => p.name_product || p).join(', ') : importedProducts}`
                                        : '*ไม่ระบุ จะเจนเป็นโลโก้นามธรรม'}
                                </p>
                            </div>

                            <div className="clg-form-group">
                                <label><span className="clg-step">4</span> สไตล์โลโก้ <span style={{ color: 'var(--orange)' }}>*</span></label>
                                <div className="clg-style-grid">
                                    {styleOptions.map(style => (
                                        <div
                                            key={style.id}
                                            onClick={() => setSelectedStyle(style.id)}
                                            className={`clg-style-option${selectedStyle === style.id ? ' clg-style-selected' : ''}`}
                                        >
                                            <iconify-icon icon={style.icon}></iconify-icon>
                                            <span className="clg-style-name">{style.name}</span>
                                            <span className="clg-style-desc">{style.desc}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="clg-form-group">
                                <label><span className="clg-step">5</span> รายละเอียดที่อยากได้เพิ่มเติม</label>
                                <textarea rows="2" placeholder="เช่น อยากได้รูปช้างยืนบนดอกบัว..." value={detailsInput} onChange={(e) => setDetailsInput(e.target.value)} className="clg-textarea" />
                            </div>

                            <div className="clg-form-group">
                                <label><span className="clg-step">6</span> สิ่งที่ไม่อยากให้มี (Negative Prompt)</label>
                                <input type="text" placeholder="เช่น สีดำ, รูปกะโหลก..." value={negativeInput} onChange={(e) => setNegativeInput(e.target.value)} />
                            </div>

                            <div className="clg-form-group clg-checkbox-row">
                                <label className="clg-checkbox-card">
                                    <input type="checkbox" checked={useImportedColor} onChange={(e) => setUseImportedColor(e.target.checked)} />
                                    <span>นำเข้า <b>ชุดสี</b> ที่เลือกไว้แล้ว</span>
                                </label>
                                <label className="clg-checkbox-card">
                                    <input type="checkbox" checked={useImportedFont} onChange={(e) => setUseImportedFont(e.target.checked)} />
                                    <span>นำเข้า <b>ฟอนต์</b> ที่เลือกไว้แล้ว</span>
                                </label>
                            </div>

                            <div className="clg-modal-actions">
                                <button className="clg-cancel" onClick={() => setIsModalOpen(false)}>ยกเลิก</button>
                                <button className="clg-confirm" onClick={handleSubmitLogo} disabled={isLoading}>
                                    {isLoading ? 'AI กำลังเจนรูป...' : 'ให้ AI เจนโลโก้ใหม่'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Loading Overlay ── */}
            {isLoading && (
                <div className="clg-loading-overlay">
                    <iconify-icon icon="line-md:loading-loop"></iconify-icon>
                    <h2>{loadingMessage || 'AI กำลังวาดโลโก้ให้คุณใหม่...'}</h2>
                    <p>กรุณารอสักครู่</p>
                </div>
            )}

            <ProUpgradeModal isOpen={showProModal} onClose={() => setShowProModal(false)} feature="download" />
        </div>
    );
};