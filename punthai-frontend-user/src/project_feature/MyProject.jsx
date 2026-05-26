import React, { useState, useEffect } from 'react';
import './MyProject.css';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import CircularProgress from '../components/CircularProgress';
import { ProjectSidebar } from '../components/sidebar';

import logoImg from '../assets/logo.png';
import createImg from '../assets/create.png';
import { API_URL } from '../config';

export const MyProject = ({ user }) => {
    // 🟢 1. หัวใจสำคัญ: ดึงข้อมูล User มาตรงๆ แบบเดียวกับ Navbar (ไม่มี State ไม่ต้องรอโหลด)
    // ถ้าหน้า App.jsx ไม่ได้ส่ง Props user มาให้ ก็ให้ไปดึงจาก LocalStorage แทนทันที
    const currentUser = user || JSON.parse(localStorage.getItem('user') || 'null');

    const [selectedBrandName, setSelectedBrandName] = useState(null);
    const [projectName, setProjectName] = useState('กำลังโหลดข้อมูล...');
    const [projectLogo, setProjectLogo] = useState(null);
    const [products, setProducts] = useState([]);
    const [selectedColors, setSelectedColors] = useState([]);
    const [selectedFont, setSelectedFont] = useState(null);
    const [showNamePopup, setShowNamePopup] = useState(false);
    const [editNameInput, setEditNameInput] = useState('');
    const [showBrandNamePopup, setShowBrandNamePopup] = useState(false);
    const [editBrandNameInput, setEditBrandNameInput] = useState('');
    const [completion, setCompletion] = useState({ percentage: 0, details: {} });

    const location = useLocation();
    const navigate = useNavigate();
    const projectId = location.state?.projectId;

    useEffect(() => {
        if (projectId) {
            // 1. ดึงชื่อโปรเจกต์, โลโก้, และชื่อแบรนด์
            fetch(`${API_URL}/api/projects/detail/${projectId}`)
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'success') {
                        setProjectName(data.project.project_name || 'โปรเจกต์ยังไม่ได้ตั้งชื่อ');
                        setProjectLogo(data.project.image_logo);
                        if (data.project.brand_name) {
                            setSelectedBrandName(data.project.brand_name);
                        }
                    } else {
                        setProjectName('ไม่พบข้อมูลโปรเจกต์');
                    }
                })
                .catch(err => {
                    console.error("Fetch error:", err);
                    setProjectName('ไม่สามารถดึงข้อมูลได้');
                });

            // 2. ดึงรายการสินค้าของโปรเจกต์นี้
            fetch(`${API_URL}/api/brand_product/${projectId}`)
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'success') {
                        setProducts(data.products);
                    }
                })
                .catch(err => console.error("Fetch products error:", err));

            // 3. ดึง completion %
            fetch(`${API_URL}/api/projects/${projectId}/completion`)
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'success') {
                        setCompletion({ percentage: data.percentage, details: data.details });
                    }
                })
                .catch(err => console.error("Fetch completion error:", err));

            // 4. ดึงข้อมูล สี และ ฟอนต์
            fetch(`${API_URL}/api/projects/${projectId}/selected-assets`)
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'success') {
                        if (data.color) {
                            setSelectedColors([
                                data.color.color_code_1, 
                                data.color.color_code_2, 
                                data.color.color_code_3, 
                                data.color.color_code_4, 
                                data.color.color_code_5
                            ].filter(Boolean));
                        }
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

    const handleSaveBrandName = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_URL}/api/projects/${projectId}/brand-name`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ brand_name: editBrandNameInput })
            });
            const data = await res.json();
            if (data.status === 'success') {
                setSelectedBrandName(data.brand_name);
                setShowBrandNamePopup(false);
            } else {
                alert(data.message);
            }
        } catch (err) {
            alert('เชื่อมต่อ Server ไม่ได้');
        }
    };

    const handleSaveProjectName = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_URL}/api/projects/${projectId}`, {
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
                    
                    {/* 🟢 2. โค้ดแสดงรูปโปรไฟล์ ก๊อปปี้มาจาก Navbar.jsx เป๊ะๆ ทุกบรรทัด 🟢 */}
                    <button 
                        className="mp-btn-users" 
                        onClick={() => navigate('/profile')}
                        style={{ 
                            overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', 
                            cursor: 'pointer', padding: 0, width: '40px', height: '40px', borderRadius: '50%', border: 'none' 
                        }}
                    >
                        {currentUser && currentUser.image_profile && currentUser.image_profile !== 'null' ? (
                            <img
                                src={currentUser.image_profile.startsWith('http') ? currentUser.image_profile : `${API_URL}/uploads/${currentUser.image_profile}`}
                                alt="User"
                                style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
                                onError={(e) => {
                                    e.target.onerror = null; 
                                    e.target.src = "https://cdn-icons-png.flaticon.com/512/149/149071.png"; 
                                }}
                            />
                        ) : (
                            <iconify-icon icon="solar:user-linear" style={{ pointerEvents: 'none', fontSize: '24px' }}></iconify-icon>
                        )}
                    </button>
                </div>
            </header>

            <div className="mp-container">

                <ProjectSidebar activePage="project" projectId={projectId} />

                <div className="mp-orb3"></div>
                <div className="mp-orb4"></div>
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
                            <div className="mp-pic-create" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', marginBottom: '20px' }}>
                                <CircularProgress percentage={completion.percentage} size={220} strokeWidth={8}>
                                    {projectLogo ? (
                                        <img
                                            src={`${API_URL}${projectLogo}`}
                                            alt="Project Logo"
                                            style={{ width: '180px', height: '180px', objectFit: 'contain', borderRadius: '50%', background: '#fff', padding: '10px' }}
                                        />
                                    ) : (
                                        <img src={createImg} alt="" style={{ width: '140px', height: '140px', objectFit: 'contain' }} />
                                    )}
                                </CircularProgress>
                                <span style={{ marginTop: '10px', fontSize: '16px', fontWeight: 'bold', color: completion.percentage >= 75 ? '#4CAF50' : '#d75a2a' }}>
                                    {completion.percentage}% สำเร็จ
                                </span>
                            </div>
                            
                            <div className="mp-divider">✦</div>
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
                                        <span className="mp-action-icon"><iconify-icon icon="mdi:dna"></iconify-icon></span>
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
                                        <span className="mp-action-icon"><iconify-icon icon="mdi:lightbulb-outline"></iconify-icon></span>
                                        <span>Create Your Brand Concept</span>
                                    </div>
                                    <iconify-icon icon="mdi:chevron-right"></iconify-icon>
                                </div>
                                <div className="mp-action-item" onClick={() => navigate('/create-logo', { state: { projectId } })} style={{ cursor: 'pointer' }}><div className="mp-left"><span className="mp-action-icon"><iconify-icon icon="mdi:image-outline"></iconify-icon></span><span>Generate Product Pictures</span></div><iconify-icon icon="mdi:chevron-right"></iconify-icon></div>
                                <div className="mp-action-item" onClick={() => navigate('/product', { state: { projectId } })} style={{ cursor: 'pointer' }}><div className="mp-left"><span className="mp-action-icon"><iconify-icon icon="mdi:folder-outline"></iconify-icon></span><span>Explore Other Projects</span></div><iconify-icon icon="mdi:chevron-right"></iconify-icon></div>
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="mp-right-column">
                            
                            {/* Name Card */}
                            <div className="mp-card">
                                <div className="mp-card-title" style={{ color: '#d75a2a', fontWeight: 'bold', marginBottom: '15px' }}>Name</div>
                                <h3
                                    style={{ marginBottom: '20px', color: '#333', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                                    onClick={() => {
                                        setEditBrandNameInput(selectedBrandName || '');
                                        setShowBrandNamePopup(true);
                                    }}
                                    title="คลิกเพื่อแก้ไขชื่อแบรนด์"
                                >
                                    {selectedBrandName ? selectedBrandName : "ยังไม่ได้ตั้งชื่อแบรนด์"}
                                    <iconify-icon icon="mdi:pencil-outline" style={{fontSize: '18px', color: '#aaa'}}></iconify-icon>
                                </h3>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        className="mp-btn-edit"
                                        onClick={() => {
                                            setEditBrandNameInput(selectedBrandName || '');
                                            setShowBrandNamePopup(true);
                                        }}
                                        style={{ padding: '8px 16px', background: '#ffe6de', color: '#d75a2a', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}
                                    >
                                        Edit Name
                                    </button>
                                    <button
                                        className="mp-btn-view"
                                        onClick={() => navigate('/create-concept', { state: { projectId, activeTab: 'name' } })}
                                        style={{ padding: '8px 16px', background: '#ffe6de', color: '#d75a2a', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}
                                    >
                                        AI แนะนำ
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
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                            <span className="mp-font-preview-aa" style={{ fontFamily: selectedFont.font_name }}> Aa</span>
                                            <span className="mp-font-preview-name">{selectedFont.font_name}</span>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                            <span className="mp-font-preview-aa">Aa</span>
                                            <span className="mp-font-preview-name">ยังไม่ได้เลือกฟอนต์</span>
                                        </div>
                                    )}
                                </div>
                                <button 
                                    className="mp-btn" 
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
                                                        src={`${API_URL}/uploads/${product.image_product}`}
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

            {/* Popup สำหรับเปลี่ยนชื่อแบรนด์ */}
            {showBrandNamePopup && (
                <div className="mp-popup-overlay" onClick={() => setShowBrandNamePopup(false)}>
                    <div className="mp-popup-content" onClick={e => e.stopPropagation()}>
                        <h2>ตั้งชื่อแบรนด์ของคุณ</h2>
                        <p>พิมพ์ชื่อแบรนด์ที่ต้องการ หรือไปที่ "AI แนะนำ" เพื่อให้ AI ช่วยคิดชื่อ</p>
                        <form onSubmit={handleSaveBrandName}>
                            <input
                                type="text"
                                className="mp-popup-input"
                                placeholder="พิมพ์ชื่อแบรนด์ที่นี่..."
                                value={editBrandNameInput}
                                onChange={(e) => setEditBrandNameInput(e.target.value)}
                                required
                            />
                            <div className="mp-popup-actions">
                                <button
                                    type="button"
                                    className="mp-btn-cancel"
                                    onClick={() => setShowBrandNamePopup(false)}
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="submit"
                                    className="mp-btn-save"
                                >
                                    บันทึกชื่อ
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Popup สำหรับเปลี่ยนชื่อโปรเจกต์ */}
            {showNamePopup && (
                <div className="mp-popup-overlay" onClick={() => setShowNamePopup(false)}>
                    <div className="mp-popup-content" onClick={e => e.stopPropagation()}>
                        <h2>ตั้งชื่อโปรเจกต์ของคุณ</h2>
                        <form onSubmit={handleSaveProjectName}>
                            <input
                                type="text"
                                className="mp-popup-input"
                                placeholder="พิมพ์ชื่อโปรเจกต์ที่นี่..."
                                value={editNameInput}
                                onChange={(e) => setEditNameInput(e.target.value)}
                                required
                            />
                            <div className="mp-popup-actions">
                                <button
                                    type="button"
                                    className="mp-btn-cancel"
                                    onClick={() => setShowNamePopup(false)}
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="submit"
                                    className="mp-btn-save"
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