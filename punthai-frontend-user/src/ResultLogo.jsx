import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import './MyProject.css'; 
import './ResultLogo.css'; 

import logoImg from './assets/logo.png';
import helpImg from './assets/help.png';

export const ResultLogo = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const projectId = location.state?.projectId;

    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [generatedImages, setGeneratedImages] = useState([]);
    const [selectedImage, setSelectedImage] = useState(null);

    // --- States สำหรับ Form สร้างโลโก้ (ดึงมาจากหน้า Create) ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [brandName, setBrandName] = useState('');
    const [brandValue, setBrandValue] = useState('');
    const [importedProducts, setImportedProducts] = useState([]);
    const [selectedStyles, setSelectedStyles] = useState([]);
    const [detailsInput, setDetailsInput] = useState('');
    const [negativeInput, setNegativeInput] = useState('');
    const styleOptions = ['ทันสมัย', 'ความเป็นไทย', 'หรูหรา', 'เรียบง่าย', 'มินิมอล', 'เป็นกันเอง', 'การ์ตูน', 'ตัวหนังสือ', 'คลาสสิค'];

    // ฟังก์ชันดึงรูปภาพจาก Database 
    const fetchImages = () => {
        fetch(`http://localhost:3000/api/generated-logos/${projectId}`)
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    const formattedImages = data.images.map(img => ({
                        id: img.history_id,
                        url: img.image_url, 
                        isLiked: img.is_liked === 1,
                        isSelected: img.is_selected === 1 // 👈 1. เพิ่มการรับค่า is_selected จาก DB
                    }));
                    setGeneratedImages(formattedImages);
                }
            })
            .catch(err => console.error("Error fetching logos:", err));
    };

    // ทำงานเมื่อเปิดหน้านี้ครั้งแรก
    useEffect(() => {
        if (projectId) {
            fetchImages();
            
            // ดึงข้อมูลฟอร์มล่าสุดที่เคยเจนไว้มาเก็บใน State เพื่อรอแก้ไข
            const savedData = localStorage.getItem(`lastLogoForm_${projectId}`);
            if (savedData) {
                try {
                    const parsed = JSON.parse(savedData);
                    setBrandName(parsed.brand_name || '');
                    setBrandValue(parsed.brand_value || '');
                    setImportedProducts(parsed.products || []);
                    setSelectedStyles(parsed.styles || []);
                    setDetailsInput(parsed.details || '');
                    setNegativeInput(parsed.not_want || '');
                } catch (e) { console.error("Error parsing saved form data:", e); }
            }
        } else {
            alert("ไม่พบรหัสโปรเจกต์");
            navigate('/');
        }
    }, [projectId, navigate]);

    // ฟังก์ชันกดใจ
    const handleLike = async (id) => {
        const imgToUpdate = generatedImages.find(img => img.id === id);
        const newLikeStatus = !imgToUpdate.isLiked;

        setGeneratedImages(images => 
            images.map(img => img.id === id ? { ...img, isLiked: newLikeStatus } : img)
        );

        try {
            await fetch(`http://localhost:3000/api/like-generated-item/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_liked: newLikeStatus ? 1 : 0 })
            });
        } catch (error) {
            console.error("Error updating like status:", error);
        }
    };

    // 👇 2. เพิ่มฟังก์ชันเลือกโลโก้ (ติ๊กถูก) 👇
    const handleSelect = async (id, url, isCurrentlySelected) => {
        // กำหนด action ว่าจะเป็นการ 'select' (เลือก) หรือ 'deselect' (ยกเลิก)
        const actionType = isCurrentlySelected ? 'deselect' : 'select';

        // อัปเดต UI ทันทีให้หน้าเว็บตอบสนองเร็ว
        setGeneratedImages(images => 
            images.map(img => {
                if (img.id === id) {
                    return { ...img, isSelected: !isCurrentlySelected }; // สลับสถานะตัวที่ถูกคลิก
                }
                return { ...img, isSelected: false }; // ตัวอื่นให้เอาติ๊กถูกออกให้หมด
            })
        );

        // ยิง API ไปอัปเดตในฐานข้อมูล
        try {
            await fetch(`http://localhost:3000/api/generated-logos/select/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ project_id: projectId, image_url: url, action: actionType })
            });
            
            if (actionType === 'select') {
                alert("เลือกรูปโลโก้นี้สำเร็จ! รูปจะไปแสดงในหน้า Project ของคุณครับ");
            } else {
                alert("ยกเลิกการเลือกรูปโลโก้แล้วครับ");
            }
        } catch (error) {
            console.error("Error selecting logo:", error);
        }
    };

    // ฟังก์ชันดาวน์โหลดรูป (อัปเดตให้โหลดได้จริงผ่าน Blob)
    const handleDownload = async (url, filename) => {
        try {
            const response = await fetch(`http://localhost:3000${url}`);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
            
        } catch (error) {
            console.error("Download error:", error);
            alert("เกิดข้อผิดพลาด ไม่สามารถดาวน์โหลดรูปภาพได้");
        }
    };

    // ================= ฟังก์ชันจัดการ Modal ใหม่ =================
    const toggleStyle = (style) => {
        if (selectedStyles.includes(style)) {
            setSelectedStyles(selectedStyles.filter(s => s !== style));
        } else {
            setSelectedStyles([...selectedStyles, style]);
        }
    };

    const handleImportBrandName = async () => {
        try {
            const res = await fetch(`http://localhost:3000/api/brand-names/${projectId}`);
            const data = await res.json();
            if (data.status === 'success' && data.names) {
                const selected = data.names.find(n => n.is_selected === 1 || n.is_selected === true);
                if (selected) setBrandName(selected.brand_name);
                else alert("ยังไม่มีชื่อแบรนด์ที่ถูกเลือกในโปรเจกต์นี้");
            }
        } catch (err) { console.error(err); }
    };

    const handleImportBrandValue = async () => {
        try {
            const res = await fetch(`http://localhost:3000/api/brand_dna/${projectId}`);
            const data = await res.json();
            if (data.status === 'success' && data.data) setBrandValue(data.data.brand_value || '');
            else alert("คุณยังไม่ได้ทำแบบทดสอบ Brand DNA ในโปรเจกต์นี้");
        } catch (err) { console.error(err); }
    };

    const handleImportProducts = async () => {
        try {
            const res = await fetch(`http://localhost:3000/api/brand_product/${projectId}`);
            const data = await res.json();
            if (data.status === 'success' && data.products.length > 0) {
                setImportedProducts(data.products);
                alert(`ดึงข้อมูลสินค้ามาแล้ว ${data.products.length} รายการ`);
            } else alert("ยังไม่มีรายการสินค้าในโปรเจกต์นี้");
        } catch (err) { console.error(err); }
    };

    const handleSubmitLogo = async () => {
        if (!brandName.trim()) return alert("กรุณาระบุชื่อแบรนด์");
        if (selectedStyles.length === 0) return alert("กรุณาเลือกสไตล์อย่างน้อย 1 อย่าง");

        setIsLoading(true);
        try {
            const userData = JSON.parse(localStorage.getItem('user') || '{}');
            const payload = {
                project_id: projectId,
                user_id: userData.user_id || 0,
                brand_name: brandName,
                brand_value: brandValue,
                products: importedProducts,
                styles: selectedStyles,
                details: detailsInput,
                not_want: negativeInput
            };

            // อัปเดตข้อมูลล่าสุดลง LocalStorage เผื่อเปิดแก้รอบหน้า
            localStorage.setItem(`lastLogoForm_${projectId}`, JSON.stringify(payload));

            const res = await fetch('http://localhost:3000/api/generate-logo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (data.status === 'success') {
                setIsModalOpen(false); // ปิด Popup
                fetchImages(); // รีเฟรชดึงรูปภาพใหม่มาแสดงใน Grid ทันทีโดยไม่ต้องโหลดหน้าใหม่!
            } else {
                alert("เกิดข้อผิดพลาด: " + data.message);
            }
        } catch (err) {
            console.error(err);
            alert("ไม่สามารถติดต่อ AI Server ได้");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            {/* Navbar */}
            <header className="clg-navbar">
                <div className="clg-logo">
                    <img src={logoImg} alt="logo" className="logo-img" />
                </div>
                <div className="clg-nav-icons">
                    <button className="btn-world"><iconify-icon icon="iconamoon:search-light"></iconify-icon></button>
                    <button className="clg-btn-world"><iconify-icon icon="ph:bell-ringing-light"></iconify-icon></button>
                    <button className="clg-btn-users"><iconify-icon icon="solar:user-linear"></iconify-icon></button>
                </div>
            </header>

            <div className="clg-container">
                {/* Sidebar */}
                <aside className={`cncpt-sidebar ${isSidebarCollapsed ? 'cncpt-collapsed' : ''}`} id="cncpt-sidebar">
                    <button className="cncpt-toggle-btn" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>{isSidebarCollapsed ? '❯' : '❮'}</button>
                    <ul className="cncpt-menu">
                        <li onClick={() => navigate('/project', { state: { projectId } })}><span className="cncpt-icon"><iconify-icon icon="mdi:view-dashboard-outline"></iconify-icon></span><span className="cncpt-text">Projects</span></li>
                        <li onClick={() => navigate('/brand-dna', { state: { projectId } })}><span className="cncpt-icon"><iconify-icon icon="mdi:palette-outline"></iconify-icon></span><span className="cncpt-text">Brand DNA</span></li>
                        <li onClick={() => navigate('/create-concept', { state: { projectId } })}><span className="cncpt-icon"><iconify-icon icon="mdi:lightbulb-outline"></iconify-icon></span><span className="cncpt-text">Create Concept</span></li>
                        <li className="active" onClick={() => navigate('/create-logo', { state: { projectId } })} style={{ cursor: 'pointer' }}>
                            <span className="cncpt-icon"><iconify-icon icon="mdi:folder-outline"></iconify-icon></span>
                            <span className="cncpt-text">Create Logo</span>
                        </li>
                        <li onClick={() => navigate('/result', { state: { projectId } })} style={{ cursor: 'pointer' }}>
                            <span className="cncpt-icon"><iconify-icon icon="mdi:folder-outline"></iconify-icon></span>
                            <span className="cncpt-text">Create Pictures</span>
                        </li>
                    </ul>
                    <hr className="cncpt-hr" />
                    <ul className="cncpt-menu">
                        <li onClick={() => navigate('/your-projects', { state: { projectId } })}><span className="cncpt-icon"><iconify-icon icon="mdi:folder-outline"></iconify-icon></span><span className="cncpt-text">Yours Projects</span></li>
                    </ul>
                </aside>

                {/* Main Content */}
                <main className="rl-main">
                    <h1>ยินดีด้วย! โลโก้แบรนด์ของคุณพร้อมแล้ว</h1>
                    <p className="rl-subtitle">นี่คือโลโก้ที่กำหนดเองที่สร้างขึ้นสำหรับแบรนด์ของคุณโดย AI</p>

                    {generatedImages.length === 0 ? (
                        <p style={{ textAlign: 'center', marginTop: '50px', color: '#888' }}>กำลังโหลดรูปภาพ หรือยังไม่มีรูปที่สร้าง...</p>
                    ) : (
                        <div className="rl-logo-grid">
                            {generatedImages.map((img, index) => (
                                <div key={img.id} className="rl-logo-card">
                                    <div className="rl-logo-actions">
                                        <button className="rl-action-btn" onClick={() => setSelectedImage(`http://localhost:3000${img.url}`)}>
                                            <iconify-icon icon="wordpress:fullscreen"></iconify-icon>
                                        </button>
                                        
                                        <button 
                                            className={`rl-action-btn rl-favorite-btn ${img.isLiked ? 'active' : ''}`} 
                                            onClick={() => handleLike(img.id)}
                                        >
                                            <iconify-icon icon={img.isLiked ? "solar:heart-bold" : "solar:heart-linear"}></iconify-icon>
                                        </button>

                                        {/* 👇 3. เพิ่มปุ่มติ๊กถูกเพื่อเลือกโลโก้ 👇 */}
                                        <button 
                                            className="rl-action-btn" 
                                            onClick={() => handleSelect(img.id, img.url, img.isSelected)}
                                            title="เลือกใช้เป็นโลโก้หลัก"
                                        >
                                            <iconify-icon 
                                                icon={img.isSelected ? "mdi:check-circle" : "mdi:check-circle-outline"} 
                                                style={{ color: img.isSelected ? '#4CAF50' : '#666' }}
                                            ></iconify-icon>
                                        </button>

                                        <button className="rl-action-btn" onClick={() => handleDownload(img.url, `logo_${img.id}.png`)}>
                                            <iconify-icon icon="mynaui:download"></iconify-icon>
                                        </button>
                                    </div>
                                    <div className="rl-logo-box" style={{ border: 'none', padding: 0 }}>
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

                {/* ปุ่มสร้างรูปโลโก้ใหม่ (Popup) */}
                <button 
                    className="rl-floating-text-btn" 
                    onClick={() => setIsModalOpen(true)}
                >
                    สร้างรูปโลโก้ใหม่
                </button>
            </div>

            {/* Popup สำหรับขยายรูป */}
            {selectedImage && (
                <div className="rl-modal-overlay" style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:9999, display:'flex', justifyContent:'center', alignItems:'center'}} onClick={() => setSelectedImage(null)}>
                    <div className="rl-modal-content" style={{position:'relative', maxWidth:'90%', maxHeight:'90vh'}} onClick={e => e.stopPropagation()}>
                        <button className="rl-modal-close" style={{position:'absolute', top:'-15px', right:'-15px', background:'#fff', border:'none', borderRadius:'50%', width:'35px', height:'35px', cursor:'pointer', color:'#d3542b', fontSize:'24px', fontWeight:'bold'}} onClick={() => setSelectedImage(null)}>&times;</button>
                        <img src={selectedImage} alt="Expanded logo" style={{width: '100%', maxHeight: '85vh', objectFit: 'contain', borderRadius: '12px'}} />
                    </div>
                </div>
            )}

            {/* Popup สำหรับเจนรูปใหม่ */}
            {isModalOpen && (
                <div className="rl-modal" onClick={() => setIsModalOpen(false)}>
                    <div className="rl-modal-box" onClick={(e) => e.stopPropagation()}>
                        <button style={{position:'absolute', top:'15px', right:'20px', background:'none', border:'none', fontSize:'28px', cursor:'pointer', color:'#999'}} onClick={() => setIsModalOpen(false)}>&times;</button>
                        <h2 style={{color: '#d3542b', marginBottom: '20px', textAlign: 'left'}}>แก้ไขข้อมูลเพื่อสร้างโลโก้ใหม่</h2>

                        <div className="rl-form-group">
                            <label style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                <span><span className="rl-step">1</span> ชื่อแบรนด์ <span style={{color:'red'}}>*</span></span>
                                <button onClick={handleImportBrandName} style={{background:'#fff3ee', color:'#d75a2a', border:'none', padding:'5px 12px', borderRadius:'20px', cursor:'pointer', fontSize:'13px', display:'flex', alignItems:'center', gap:'5px'}}>
                                    <iconify-icon icon="mdi:download"></iconify-icon> นำเข้าชื่อ
                                </button>
                            </label>
                            <input type="text" placeholder="ระบุชื่อแบรนด์..." value={brandName} onChange={(e) => setBrandName(e.target.value)} />
                        </div>

                        <div className="rl-form-group">
                            <label style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                <span><span className="rl-step">2</span> คุณค่า/แนวคิดแบรนด์</span>
                                <button onClick={handleImportBrandValue} style={{background:'#fff3ee', color:'#d75a2a', border:'none', padding:'5px 12px', borderRadius:'20px', cursor:'pointer', fontSize:'13px', display:'flex', alignItems:'center', gap:'5px'}}>
                                    <iconify-icon icon="mdi:dna"></iconify-icon> นำเข้า DNA
                                </button>
                            </label>
                            <textarea rows="2" placeholder="ระบุคุณค่าหรือแนวคิดหลัก..." value={brandValue} onChange={(e) => setBrandValue(e.target.value)} />
                        </div>

                        <div className="rl-form-group">
                            <label style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                <span><span className="rl-step">3</span> สินค้าที่จะสร้างโลโก้</span>
                                <button onClick={handleImportProducts} style={{background:'#fff3ee', color:'#d75a2a', border:'none', padding:'5px 12px', borderRadius:'20px', cursor:'pointer', fontSize:'13px', display:'flex', alignItems:'center', gap:'5px'}}>
                                    <iconify-icon icon="mdi:basket"></iconify-icon> นำเข้าสินค้า
                                </button>
                            </label>
                            <p style={{fontSize:'13px', color:'#888', marginTop:'5px'}}>
                                {importedProducts.length > 0 ? `ใช้สินค้า: ${importedProducts.map(p => p.name_product).join(', ')}` : '*ไม่ระบุ'}
                            </p>
                        </div>

                        <div className="rl-form-group">
                            <label><span className="rl-step">4</span> สไตล์โลโก้ <span style={{color:'red'}}>*</span></label>
                            <div style={{display:'flex', flexWrap:'wrap', gap:'8px', marginTop:'10px'}}>
                                {styleOptions.map(style => (
                                    <span 
                                        key={style} onClick={() => toggleStyle(style)}
                                        style={{
                                            padding: '6px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px',
                                            border: selectedStyles.includes(style) ? '1px solid #d75a2a' : '1px solid #ddd',
                                            background: selectedStyles.includes(style) ? '#d75a2a' : '#fff',
                                            color: selectedStyles.includes(style) ? '#fff' : '#666'
                                        }}
                                    >
                                        {style}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="rl-form-group">
                            <label><span className="rl-step">5</span> รายละเอียดที่อยากได้เพิ่มเติม</label>
                            <textarea rows="2" placeholder="เช่น อยากได้รูปช้างยืนบนดอกบัว..." value={detailsInput} onChange={(e) => setDetailsInput(e.target.value)} />
                        </div>

                        <div className="rl-form-group">
                            <label><span className="rl-step">6</span> สิ่งที่ไม่อยากให้มี (Negative Prompt)</label>
                            <input type="text" placeholder="เช่น สีดำ, รูปกะโหลก..." value={negativeInput} onChange={(e) => setNegativeInput(e.target.value)} />
                        </div>

                        <div className="rl-modal-actions">
                            <button className="rl-btn-cancel" onClick={() => setIsModalOpen(false)}>ยกเลิก</button>
                            <button className="rl-btn-confirm" onClick={handleSubmitLogo} disabled={isLoading}>
                                {isLoading ? 'Ai กำลังวาดรูป...' : 'ให้ AI เจนโลโก้ใหม่'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Loading Overlay ขยายเต็มจอ */}
            {isLoading && (
                <div style={{position:'fixed', inset:0, background:'rgba(255,255,255,0.85)', zIndex:99999, display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center'}}>
                    <iconify-icon icon="line-md:loading-loop" style={{fontSize:'60px', color:'#d75a2a'}}></iconify-icon>
                    <h2 style={{marginTop:'20px', color:'#d75a2a'}}>Ai กำลังวาดโลโก้ให้คุณใหม่...</h2>
                    <p style={{color:'#666', marginTop:'10px'}}>อาจใช้เวลาประมาณ 10 - 20 วินาที กรุณารอสักครู่</p>
                </div>
            )}
        </>
    );
};