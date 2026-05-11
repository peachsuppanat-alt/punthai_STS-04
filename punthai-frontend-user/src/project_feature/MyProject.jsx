import React, { useState, useEffect } from 'react';
import './MyProject.css';
import { Link, useLocation, useNavigate } from 'react-router-dom';

// ดึงรูปภาพกลับมาใช้งาน
import logoImg from '../assets/logo.png';
import helpImg from '../assets/help.png';
import createImg from '../assets/create.png';

export const MyProject = () => {
    // State สำหรับจัดการ Sidebar
    const [isCollapsed, setIsCollapsed] = useState(false);
    
    // State สำหรับเก็บชื่อแบรนด์ที่เลือกจาก AI
    const [selectedBrandName, setSelectedBrandName] = useState(null);

    // State สำหรับเก็บชื่อโปรเจกต์ และ รายการสินค้า
    const [projectName, setProjectName] = useState('กำลังโหลดข้อมูล...');
    const [projectLogo, setProjectLogo] = useState(null);
    const [products, setProducts] = useState([]);

    // 👇 1. เพิ่ม State สำหรับเก็บสีและฟอนต์ที่เลือก 👇
    const [selectedColors, setSelectedColors] = useState([]); 
    const [selectedFont, setSelectedFont] = useState(null);

    // เพิ่ม State สำหรับ Popup แก้ไขชื่อโปรเจกต์
    const [showNamePopup, setShowNamePopup] = useState(false);
    const [editNameInput, setEditNameInput] = useState('');

    // รับ projectId ที่ถูกส่งมาจากหน้า Home
    const location = useLocation();
    const navigate = useNavigate();
    const projectId = location.state?.projectId;

    useEffect(() => {
        if (projectId) {
            // 1. ดึงชื่อโปรเจกต์และโลโก้
            fetch(`http://localhost:3000/api/projects/detail/${projectId}`)
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'success') {
                        setProjectName(data.project.project_name || 'โปรเจกต์ยังไม่ได้ตั้งชื่อ');
                        setProjectLogo(data.project.image_logo);
                    } else {
                        setProjectName('ไม่พบข้อมูลโปรเจกต์');
                    }
                })
                .catch(err => {
                    console.error("Fetch error:", err);
                    setProjectName('ไม่สามารถดึงข้อมูลได้');
                });

            // 2. ดึงรายการสินค้าของโปรเจกต์นี้
            fetch(`http://localhost:3000/api/brand_product/${projectId}`)
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'success') {
                        setProducts(data.products);
                    }
                })
                .catch(err => console.error("Fetch products error:", err));

            // 3. ดึงชื่อแบรนด์ที่เคยสร้างและถูกเลือกไว้
            fetch(`http://localhost:3000/api/brand-names/${projectId}`)
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'success' && data.names) {
                        const selected = data.names.find(n => n.is_selected === 1 || n.is_selected === true);
                        if (selected) {
                            setSelectedBrandName(selected.brand_name);
                        }
                    }
                })
                .catch(err => console.error("Fetch brand names error:", err));

            // 👇 4. ดึงข้อมูล สี และ ฟอนต์ ที่ถูกเลือกจาก API ใหม่ 👇
            fetch(`http://localhost:3000/api/projects/${projectId}/selected-assets`)
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'success') {
                        // ถ้ามีสีที่ถูกเลือก
                        if (data.color) {
                            setSelectedColors([
                                data.color.color_code_1, 
                                data.color.color_code_2, 
                                data.color.color_code_3, 
                                data.color.color_code_4, 
                                data.color.color_code_5
                            ].filter(Boolean));
                        }
                        // ถ้ามีฟอนต์ที่ถูกเลือก
                        if (data.font) {
                            setSelectedFont(data.font);
                        }
                    }
                })
                .catch(err => console.error("Fetch selected assets error:", err));

        } else {
            setProjectName('ไม่พบรหัสโปรเจกต์');
        }
    }, [projectId]);

    const toggleSidebar = () => {
        setIsCollapsed(!isCollapsed);
    };

    const handleSaveProjectName = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`http://localhost:3000/api/projects/${projectId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ project_name: editNameInput }) 
            });
            const data = await res.json();
            if (data.status === 'success') {
                setProjectName(editNameInput); 
                setShowNamePopup(false);       
            } else {
                alert('❌ ' + data.message);
            }
        } catch (err) {
            alert('เชื่อมต่อ Server ไม่ได้');
        }
    };

    return (
        <div className="mp-body-wrapper">
            {/* --- Navbar --- */}
            <header className="mp-navbar">
                <div className="mp-logo">
                    <Link to="/">
                        <img src={logoImg} alt="logo" className="mp-logo-img" />
                    </Link>
                </div>
                <div className="mp-nav-icons">
                    <button className="mp-btn-world"><iconify-icon icon="iconamoon:search-light"></iconify-icon></button>
                    <button className="mp-btn-world"><iconify-icon icon="ph:bell-ringing-light"></iconify-icon></button>
                    <button className="mp-btn-users"><iconify-icon icon="solar:user-linear"></iconify-icon></button>
                </div>
            </header>

            <div className="mp-container">
                {/* --- Sidebar --- */}
                <aside className={`mp-sidebar ${isCollapsed ? 'mp-collapsed' : ''}`} id="mp-sidebar">
                    <button className="mp-toggle-btn" id="mp-toggleBtn" onClick={toggleSidebar}>
                        {isCollapsed ? '❯' : '❮'}
                    </button>
                    <ul className="mp-menu">
                        <li className="active">
                            <span className="mp-icon">
                                <iconify-icon icon="mdi:view-dashboard-outline"></iconify-icon>
                            </span>
                            <span className="mp-text">Projects</span>
                        </li>
                        <li onClick={() => navigate('/brand-dna', { state: { projectId } })} style={{ cursor: 'pointer' }}>
                            <span className="mp-icon">
                                <iconify-icon icon="mdi:palette-outline"></iconify-icon>
                            </span>
                            <span className="mp-text">Brand DNA</span>
                        </li>
                        <li onClick={() => navigate('/create-concept', { state: { projectId } })} style={{ cursor: 'pointer' }}>
                            <span className="mp-icon">
                                <iconify-icon icon="mdi:lightbulb-outline"></iconify-icon>
                            </span>
                            <span className="mp-text">Create Concept </span>
                        </li>
                        <li onClick={() => navigate('/create-logo', { state: { projectId } })} style={{ cursor: 'pointer' }}>
                            <span className="cncpt-icon"><iconify-icon icon="mdi:folder-outline"></iconify-icon></span>
                            <span className="cncpt-text">Create Logo</span>
                        </li>
                        <li onClick={() => navigate('/result', { state: { projectId } })} style={{ cursor: 'pointer' }}>
                            <span className="cncpt-icon"><iconify-icon icon="mdi:folder-outline"></iconify-icon></span>
                            <span className="cncpt-text">Create Pictures</span>
                        </li>
                    </ul>
                    <hr className="mp-hr" />
                    <ul className="mp-menu">
                        <li onClick={() => navigate('/product', { state: { projectId } })} style={{ cursor: 'pointer' }}>
                            <span className="mp-icon"><iconify-icon icon="mdi:folder-outline"></iconify-icon></span>
                            <span className="mp-text">Yours Product</span>
                        </li>
                    </ul>
                    <div className="mp-help">
                        <img src={helpImg} className="mp-help-img" alt="help" />
                        <p className="mp-help-text">Having trouble?</p>
                        <a href="#" className="mp-contact-link">Contact Us</a>
                    </div>
                </aside>

                <main className="mp-main">
                    
                    <h1 
                        lang="en" 
                        className="mp-h1" 
                        style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '10px', color: projectName === 'โปรเจกต์ยังไม่ได้ตั้งชื่อ' ? '#888' : '#d75a2a' }}
                        onClick={() => {
                            setEditNameInput(projectName === 'โปรเจกต์ยังไม่ได้ตั้งชื่อ' ? '' : projectName);
                            setShowNamePopup(true);
                        }}
                        title="คลิกเพื่อตั้งชื่อโปรเจกต์"
                    >
                        {projectName}
                        <iconify-icon icon="mdi:pencil-outline" style={{fontSize: '24px', color: '#aaa'}}></iconify-icon>
                    </h1>
                    
                    <p className="mp-subtitle">นี่คือสรุปสิ่งที่เราได้สร้างขึ้นสำหรับแบรนด์ของคุณจนถึงตอนนี้</p>

                    <div className="mp-grid">
                        {/* Left Card */}
                        <div className="mp-card mp-large">
                            <div className="mp-illustration"></div>
                            <div className="mp-pic-create" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', marginBottom: '20px' }}>
                                {projectLogo ? (
                                    <img 
                                        src={`http://localhost:3000${projectLogo}`} 
                                        alt="Project Logo" 
                                        style={{ width: '200px', height: '200px', objectFit: 'contain', borderRadius: '50%', background: '#fff', padding: '10px', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' }} 
                                    />
                                ) : (
                                    <img src={createImg} alt="" className="mp-pic" />
                                )}
                            </div>
                            
                            <h2 className="mp-h2">
                                 {selectedBrandName ? selectedBrandName : " ชื่อแบรนด์ ยังไม่ได้ตั้งชื่อ"}
                            </h2>
                            <p className="mp-p">Let’s get started on building your brand!</p>

                            <div className="mp-action-list">
                                <div
                                    className="mp-action-item"
                                    onClick={() => navigate('/brand-dna', { state: { projectId } })}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className="mp-left" >
                                        <iconify-icon icon="mdi:dna"></iconify-icon>
                                        <span>Generates Brand DNA</span>
                                    </div>
                                    <iconify-icon icon="mdi:chevron-right"></iconify-icon>
                                </div>

                                <div 
                                    className="mp-action-item"
                                    onClick={() => navigate('/create-concept', { state: { projectId } })}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className="mp-left">
                                        <iconify-icon icon="mdi:lightbulb-outline"></iconify-icon>
                                        <span>Create Your Brand Concept</span>
                                    </div>
                                    <iconify-icon icon="mdi:chevron-right"></iconify-icon>
                                </div>
                                <div className="mp-action-item" onClick={() => navigate('/create-logo', { state: { projectId } })} style={{ cursor: 'pointer' }}><div className="mp-left"><iconify-icon icon="mdi:image-outline"></iconify-icon><span>Generate Product Pictures</span></div><iconify-icon icon="mdi:chevron-right"></iconify-icon></div>
                                <div className="mp-action-item" onClick={() => navigate('/product', { state: { projectId } })} style={{ cursor: 'pointer' }}><div className="mp-left"><iconify-icon icon="mdi:folder-outline"></iconify-icon><span>Explore Other Projects</span></div><iconify-icon icon="mdi:chevron-right"></iconify-icon></div>
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="mp-right-column">
                            
                            {/* Name Card */}
                            <div className="mp-card">
                                <div className="mp-card-title" style={{ color: '#d75a2a', fontWeight: 'bold', marginBottom: '15px' }}>Name</div>
                                <h3 style={{ marginBottom: '20px', color: '#333' }}>
                                    {selectedBrandName ? selectedBrandName : "ให้ Ai ช่วยคิดชื่อให้สิ"}
                                </h3>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        className="mp-btn-edit"
                                        onClick={() => navigate('/create-concept', { state: { projectId, activeTab: 'name' } })}
                                        style={{ padding: '8px 16px', background: '#ffe6de', color: '#d75a2a', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}
                                    >
                                        Edit Name
                                    </button>
                                    <button
                                        className="mp-btn-view"
                                        onClick={() => navigate('/create-concept', { state: { projectId, activeTab: 'name' } })}
                                        style={{ padding: '8px 16px', background: '#ffe6de', color: '#d75a2a', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}
                                    >
                                        View
                                    </button>
                                </div>
                            </div>

                            {/* 👇 Colors 👇 */}
                            <div className="mp-card mp-small">
                                <h3 className="mp-h3">Colors</h3>
                                <div className="mp-colors" style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                                    {selectedColors.length > 0 ? (
                                        selectedColors.map((hex, idx) => (
                                            <span key={idx} className="mp-color" style={{ backgroundColor: hex, border: '1px solid #eee' }}></span>
                                        ))
                                    ) : (
                                        <>
                                            <span className="mp-color" style={{backgroundColor: '#e0e0e0'}}></span>
                                            <span className="mp-color" style={{backgroundColor: '#e0e0e0'}}></span>
                                            <span className="mp-color" style={{backgroundColor: '#e0e0e0'}}></span>
                                            <span className="mp-color" style={{backgroundColor: '#e0e0e0'}}></span>
                                        </>
                                    )}
                                </div>
                                <button 
                                    className="mp-btn" 
                                    // ส่งค่า activeTab ไปให้หน้า CreateConcept
                                    onClick={() => navigate('/create-concept', { state: { projectId, activeTab: 'color' } })}
                                >
                                    Edit Colors
                                </button>
                            </div>

                            {/* 👇 Fonts 👇 */}
                            <div className="mp-card mp-small">
                                <h3 className="mp-h3">Fonts</h3>
                                <div className="mp-font-empty" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50px', marginBottom: '15px', background: '#f9f9f9', borderRadius: '8px' }}>
                                    {selectedFont ? (
                                        <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#333', fontFamily: selectedFont.font_name }}>{selectedFont.font_name}</span>
                                    ) : (
                                        <span style={{ color: '#aaa', fontSize: '14px' }}>ยังไม่ได้เลือกฟอนต์</span>
                                    )}
                                </div>
                                <button 
                                    className="mp-btn" 
                                    style={{ background: selectedFont ? '#fff3ee' : '#f5f5f5', color: selectedFont ? '#d75a2a' : '#aaa' }}
                                    // ส่งค่า activeTab ไปให้หน้า CreateConcept
                                    onClick={() => navigate('/create-concept', { state: { projectId, activeTab: 'font' } })}
                                >
                                    Edit Fonts
                                </button>
                            </div>

                            {/* Products Section */}
                            <div className="mp-card mp-small mp-products-card">
                                <h3 className="mp-h3">Products</h3>
                                <div className="mp-products">
                                    {[...Array(4)].map((_, index) => {
                                        const product = products[index];
                                        return (
                                            <div key={index} className="mp-product-box">
                                                {product && product.image_product ? (
                                                    <img
                                                        src={`http://localhost:3000/uploads/${product.image_product}`}
                                                        alt={product.name_product}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '10px' }}
                                                    />
                                                ) : null}
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="mp-btn-group">
                                    <button className="mp-btn" onClick={() => navigate('/create-logo', { state: { projectId } })}>Generates Pictures</button>
                                    <button
                                        className="mp-btn"
                                        onClick={() => navigate('/your-projects', { state: { projectId } })}
                                    >
                                        View
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            {/* Popup สำหรับเปลี่ยนชื่อโปรเจกต์ */}
            {showNamePopup && (
                <div style={popupOverlayStyle} onClick={() => setShowNamePopup(false)}>
                    <div style={popupContentStyle} onClick={e => e.stopPropagation()}>
                        <h2 style={{color: '#d3542b', marginBottom: '15px'}}>ตั้งชื่อโปรเจกต์ของคุณ</h2>
                        <form onSubmit={handleSaveProjectName}>
                            <input 
                                type="text" 
                                placeholder="พิมพ์ชื่อโปรเจกต์ที่นี่..." 
                                value={editNameInput}
                                onChange={(e) => setEditNameInput(e.target.value)}
                                required
                                style={{ width: '100%', padding: '12px', marginBottom: '20px', borderRadius: '10px', border: '1px solid #ccc', fontSize: '16px' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                <button 
                                    type="button" 
                                    onClick={() => setShowNamePopup(false)}
                                    style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: '#eee', color: '#333' }}
                                >
                                    ยกเลิก
                                </button>
                                <button 
                                    type="submit"
                                    style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: '#d3542b', color: '#fff', fontWeight: 'bold' }}
                                >
                                    บันทึกชื่อ
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

// สไตล์สำหรับ Popup 
const popupOverlayStyle = {
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
    backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, backdropFilter: 'blur(3px)'
};
const popupContentStyle = {
    backgroundColor: 'white', padding: '30px', borderRadius: '16px', width: '90%', maxWidth: '400px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
};