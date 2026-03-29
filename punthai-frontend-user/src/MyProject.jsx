import React, { useState, useEffect } from 'react';
import './MyProject.css';
import { Link, useLocation, useNavigate } from 'react-router-dom';

// ดึงรูปภาพกลับมาใช้งาน
import logoImg from './assets/logo.png';
import helpImg from './assets/help.png';
import createImg from './assets/create.png';

export const MyProject = () => {
    // State สำหรับจัดการ Sidebar
    const [isCollapsed, setIsCollapsed] = useState(false);
    
    // 👇 State สำหรับเก็บชื่อแบรนด์ที่เลือกจาก AI
    const [selectedBrandName, setSelectedBrandName] = useState(null);

    // State สำหรับเก็บชื่อโปรเจกต์ และ รายการสินค้า
    const [projectName, setProjectName] = useState('กำลังโหลดข้อมูล...');
    const [products, setProducts] = useState([]);

    // รับ projectId ที่ถูกส่งมาจากหน้า Home
    const location = useLocation();
    const navigate = useNavigate();
    const projectId = location.state?.projectId;

    // useEffect เพื่อดึงข้อมูลโปรเจกต์ สินค้า และชื่อแบรนด์ เมื่อเข้าหน้านี้
    useEffect(() => {
        if (projectId) {
            // 1. ดึงชื่อโปรเจกต์ (แก้เป็น project_name ตาม DB ใหม่)
            fetch(`http://localhost:3000/api/projects/detail/${projectId}`)
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'success') {
                        setProjectName(data.project.project_name || 'ไม่มีชื่อโปรเจกต์');
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

            // 3. ดึงชื่อแบรนด์ที่เคยสร้างและถูกเลือกไว้ (is_selected = 1)
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

        } else {
            setProjectName('ไม่พบรหัสโปรเจกต์');
        }
    }, [projectId]);

    const toggleSidebar = () => {
        setIsCollapsed(!isCollapsed);
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
                        <li>
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
                            <span className="cncpt-text">Create Pictures</span>
                        </li>
                    </ul>
                    <hr className="mp-hr" />
                    <ul className="mp-menu">
                        <li onClick={() => navigate('/your-projects', { state: { projectId } })} style={{ cursor: 'pointer' }}>
                            <span className="mp-icon"><iconify-icon icon="mdi:folder-outline"></iconify-icon></span>
                            <span className="mp-text">Yours Projects</span>
                        </li>
                    </ul>
                    <div className="mp-help">
                        <img src={helpImg} className="mp-help-img" alt="help" />
                        <p className="mp-help-text">Having trouble?</p>
                        <a href="#" className="mp-contact-link">Contact Us</a>
                    </div>
                </aside>

                <main className="mp-main">
                    <h1 lang="en" className="mp-h1">{projectName}</h1>
                    <p className="mp-subtitle">นี่คือสรุปสิ่งที่เราได้สร้างขึ้นสำหรับแบรนด์ของคุณจนถึงตอนนี้</p>

                    <div className="mp-grid">
                        {/* Left Card */}
                        <div className="mp-card mp-large">
                            <div className="mp-illustration"></div>
                            <div className="mp-pic-create">
                                <img src={createImg} alt="" className="mp-pic" />
                            </div>
                            
                            {/* 👇 อัปเดตแสดงชื่อแบรนด์ที่เลือก 👇 */}
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
                                <div className="mp-action-item"><div className="mp-left"><iconify-icon icon="mdi:image-outline"></iconify-icon><span>Generate Product Pictures</span></div><iconify-icon icon="mdi:chevron-right"></iconify-icon></div>
                                <div className="mp-action-item" onClick={() => navigate('/your-projects', { state: { projectId } })} style={{ cursor: 'pointer' }}><div className="mp-left"><iconify-icon icon="mdi:folder-outline"></iconify-icon><span>Explore Other Projects</span></div><iconify-icon icon="mdi:chevron-right"></iconify-icon></div>
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="mp-right-column">
                            
                            {/* 👇 Name Card 👇 */}
                            <div className="mp-card">
                                <div className="mp-card-title" style={{ color: '#d75a2a', fontWeight: 'bold', marginBottom: '15px' }}>Name</div>

                                {/* แสดงชื่อแบรนด์ ถ้ายังไม่มีให้ขึ้นข้อความชวนไปทำ */}
                                <h3 style={{ marginBottom: '20px', color: '#333' }}>
                                    {selectedBrandName ? selectedBrandName : "ให้ Ai ช่วยคิดชื่อให้สิ"}
                                </h3>

                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        className="mp-btn-edit"
                                        onClick={() => navigate('/create-concept', { state: { projectId } })}
                                        style={{ padding: '8px 16px', background: '#ffe6de', color: '#d75a2a', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}
                                    >
                                        Edit Name
                                    </button>
                                    <button
                                        className="mp-btn-view"
                                        onClick={() => navigate('/create-concept', { state: { projectId } })}
                                        style={{ padding: '8px 16px', background: '#ffe6de', color: '#d75a2a', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}
                                    >
                                        View
                                    </button>
                                </div>
                            </div>

                            {/* Colors */}
                            <div className="mp-card mp-small">
                                <h3 className="mp-h3">Colors</h3>
                                <div className="mp-colors"><span className="mp-color mp-red"></span><span className="mp-color mp-orange"></span><span className="mp-color mp-green"></span><span className="mp-color mp-yellow"></span></div>
                                <button className="mp-btn">Edit Colors</button>
                            </div>

                            {/* Fonts */}
                            <div className="mp-card mp-small">
                                <h3 className="mp-h3">Fonts</h3>
                                <div className="mp-font-empty"></div>
                                <button className="mp-btn mp-btn-disabled">Edit Fonts</button>
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
                                    <button className="mp-btn">Generates Pictures</button>
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
        </div>
    );
};