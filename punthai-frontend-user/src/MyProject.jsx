import React, { useState, useEffect } from 'react';
import './MyProject.css';
import { Link, useLocation } from 'react-router-dom'; // เปลี่ยนจาก useParams เป็น useLocation

// ดึงรูปภาพกลับมาใช้งาน
import logoImg from './assets/logo.png';
import helpImg from './assets/help.png';
import createImg from './assets/create.png';

export const MyProject = () => {
    // 1. State สำหรับจัดการ Sidebar
    const [isCollapsed, setIsCollapsed] = useState(false);

    // 2. State สำหรับจัดการข้อมูลโปรเจกต์และ Popup
    const [projectName, setProjectName] = useState('กำลังโหลดข้อมูล...'); // เก็บชื่อแบรนด์ที่ดึงมา
    const [showEditPopup, setShowEditPopup] = useState(false);      // เปิด/ปิด Popup
    const [editNameValue, setEditNameValue] = useState('');         // ค่าที่พิมพ์ใน Popup

    // รับ projectId ที่ถูกส่งมาจากหน้า Home (ผ่านเมนู onClick)
    const location = useLocation();
    const projectId = location.state?.projectId;

    // 3. ใช้ useEffect เพื่อดึงข้อมูลโปรเจกต์จาก Database เมื่อเข้าหน้านี้
    useEffect(() => {
        if (projectId) {
            fetch(`http://localhost:3000/api/projects/detail/${projectId}`)
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'success') {
                        setProjectName(data.project.name_concept); // ใส่ชื่อจาก Database จริงลงไป
                    } else {
                        setProjectName('ไม่พบข้อมูลโปรเจกต์');
                    }
                })
                .catch(err => {
                    console.error("Fetch error:", err);
                    setProjectName('ไม่สามารถดึงข้อมูลได้');
                });
        } else {
            setProjectName('ไม่พบรหัสโปรเจกต์');
        }
    }, [projectId]);

    const toggleSidebar = () => {
        setIsCollapsed(!isCollapsed);
    };

    // 4. ฟังก์ชันสำหรับกดปุ่ม "Edit Name"
    const handleOpenEditPopup = () => {
        setEditNameValue(projectName); // เอาชื่อปัจจุบันไปใส่ในช่องกรอก
        setShowEditPopup(true);
    };

    // 5. ฟังก์ชันสำหรับบันทึกชื่อใหม่ลง Database
    const handleSaveName = async (e) => {
        e.preventDefault();
        
        if (!projectId) return alert('ไม่พบรหัสโปรเจกต์');

        try {
            const res = await fetch(`http://localhost:3000/api/projects/${projectId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name_concept: editNameValue })
            });
            const data = await res.json();
            
            if (data.status === 'success') {
                setProjectName(editNameValue); // อัปเดตชื่อบนหน้าจอ
                setShowEditPopup(false);       // ปิด Popup
            } else {
                alert('อัปเดตไม่สำเร็จ: ' + data.message);
            }
        } catch (err) {
            alert('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
        }
    };

    return (
        <div className="mp-body-wrapper">
            {/* --- Navbar และ Sidebar โค้ดเดิมของคุณ --- */}
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
                <aside className={`mp-sidebar ${isCollapsed ? 'mp-collapsed' : ''}`} id="mp-sidebar">
                    <button className="mp-toggle-btn" id="mp-toggleBtn" onClick={toggleSidebar}>
                        {isCollapsed ? '❯' : '❮'}
                    </button>
                    <ul className="mp-menu">
                        <li><span className="mp-icon"><iconify-icon icon="mdi:view-dashboard-outline"></iconify-icon></span><span className="mp-text">Projects</span></li>
                        <li><span className="mp-icon"><iconify-icon icon="mdi:palette-outline"></iconify-icon></span><span className="mp-text">Brand DNA</span></li>
                        <li><span className="mp-icon"><iconify-icon icon="mdi:lightbulb-outline"></iconify-icon></span><span className="mp-text">Create Concept</span></li>
                        <li><span className="mp-icon"><iconify-icon icon="mdi:folder-outline"></iconify-icon></span><span className="mp-text">Create Pictures</span></li>
                    </ul>
                    <hr className="mp-hr" />
                    <ul className="mp-menu">
                        <li><span className="mp-icon"><iconify-icon icon="mdi:folder-outline"></iconify-icon></span><span className="mp-text">Yours Projects</span></li>
                    </ul>
                    <div className="mp-help">
                        <img src={helpImg} className="mp-help-img" alt="help" />
                        <p className="mp-help-text">Having trouble?</p>
                        <a href="#" className="mp-contact-link">Contact Us</a>
                    </div>
                </aside>

                <main className="mp-main">
                    <h1 lang="en" className="mp-h1">My Project</h1>
                    <p className="mp-subtitle">นี่คือสรุปสิ่งที่เราได้สร้างขึ้นสำหรับแบรนด์ของคุณจนถึงตอนนี้</p>

                    <div className="mp-grid">
                        {/* Left Card */}
                        <div className="mp-card mp-large">
                            <div className="mp-illustration"></div>
                            <div className="mp-pic-create">
                                <img src={createImg} alt="" className="mp-pic" />
                            </div>
                            {/* แสดงชื่อแบรนด์แบบ Dynamic ที่ก้อนซ้ายด้วย */}
                            <h2 className="mp-h2">ชื่อแบรนด์ ({projectName})</h2>
                            <p className="mp-p">Let’s get started on building your brand!</p>
                            
                            <div className="mp-action-list">
                                <div className="mp-action-item"><div className="mp-left"><iconify-icon icon="mdi:dna"></iconify-icon><span>Generates Brand DNA</span></div><iconify-icon icon="mdi:chevron-right"></iconify-icon></div>
                                <div className="mp-action-item"><div className="mp-left"><iconify-icon icon="mdi:lightbulb-outline"></iconify-icon><span>Create Your Brand Concept</span></div><iconify-icon icon="mdi:chevron-right"></iconify-icon></div>
                                <div className="mp-action-item"><div className="mp-left"><iconify-icon icon="mdi:image-outline"></iconify-icon><span>Generate Product Pictures</span></div><iconify-icon icon="mdi:chevron-right"></iconify-icon></div>
                                <div className="mp-action-item"><div className="mp-left"><iconify-icon icon="mdi:folder-outline"></iconify-icon><span>Explore Other Projects</span></div><iconify-icon icon="mdi:chevron-right"></iconify-icon></div>
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="mp-right-column">
                            {/* 👇 แก้ไขส่วน Name Card ตรงนี้ 👇 */}
                            <div className="mp-card mp-small">
                                <h3 className="mp-h3">Name</h3>
                                <div className="mp-name-box">
                                    {/* แสดงชื่อโปรเจกต์ */}
                                    <span style={{ display: 'block', marginBottom: '15px', color: '#333' }}>
                                        {projectName}
                                    </span>
                                    <div className="mp-btn-group">
                                        <button className="mp-btn" onClick={handleOpenEditPopup}>Edit Name</button>
                                        <button className="mp-btn mp-btn-disabled">View</button>
                                    </div>
                                </div>
                            </div>

                            {/* colors, fonts, products โค้ดเดิม */}
                            <div className="mp-card mp-small">
                                <h3 className="mp-h3">Colors</h3>
                                <div className="mp-colors"><span className="mp-color mp-red"></span><span className="mp-color mp-orange"></span><span className="mp-color mp-green"></span><span className="mp-color mp-yellow"></span></div>
                                <button className="mp-btn">Edit Colors</button>
                            </div>
                            <div className="mp-card mp-small">
                                <h3 className="mp-h3">Fonts</h3>
                                <div className="mp-font-empty"></div>
                                <button className="mp-btn mp-btn-disabled">Edit Fonts</button>
                            </div>
                            <div className="mp-card mp-small mp-products-card">
                                <h3 className="mp-h3">Products</h3>
                                <div className="mp-products"><div className="mp-product-box"></div><div className="mp-product-box"></div><div className="mp-product-box"></div><div className="mp-product-box"></div></div>
                                <div className="mp-btn-group"><button className="mp-btn">Generates Pictures</button><button className="mp-btn">View</button></div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            {/* 👇 6. เพิ่ม UI Popup ต่อจาก mp-container (ก่อนปิด div บนสุด) 👇 */}
            {showEditPopup && (
                <div className="mp-popup-overlay">
                    <div className="mp-popup-content">
                        <h3>แก้ไขชื่อแบรนด์</h3>
                        <form onSubmit={handleSaveName}>
                            <input 
                                type="text" 
                                value={editNameValue}
                                onChange={(e) => setEditNameValue(e.target.value)}
                                className="mp-popup-input"
                                required
                                placeholder="ตั้งชื่อแบรนด์ใหม่..."
                            />
                            <div className="mp-popup-actions">
                                <button type="button" className="mp-btn-cancel" onClick={() => setShowEditPopup(false)}>ยกเลิก</button>
                                <button type="submit" className="mp-btn-save">บันทึก</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};