import React, { useState } from 'react';
// import { useNavigate } from 'react-router-dom';
// นำเข้าไฟล์ CSS เดิมของคุณที่แปลงชื่อ class แล้ว (เติม clg-)
import './ResultLogo.css'; 
import logoImg from './assets/logo.png';

export const ResultLogo = () => {
    // const navigate = useNavigate();
    
    // 👇 State สมมติสำหรับเก็บข้อมูลรูปภาพที่เจนออกมา 👇
    const [generatedImages, setGeneratedImages] = useState([
        { id: 1, url: 'https://img5.pic.in.th/file/secure-sv1/punthai_db-1.png', isLiked: false },
        { id: 2, url: 'https://img5.pic.in.th/file/secure-sv1/punthai_db-1.png', isLiked: false },
        { id: 3, url: 'https://img5.pic.in.th/file/secure-sv1/punthai_db-1.png', isLiked: false },
        { id: 4, url: 'https://img5.pic.in.th/file/secure-sv1/punthai_db-1.png', isLiked: false },
    ]);

    const [selectedImage, setSelectedImage] = useState(null); // สำหรับ Popup ขยายรูป

    // ฟังก์ชันกดใจ
    const handleLike = (id) => {
        setGeneratedImages(images => 
            images.map(img => img.id === id ? { ...img, isLiked: !img.isLiked } : img)
        );
        // เรียก API ไปอัปเดต DB ด้วย (PUT /api/like-generated-item/:historyId)
    };

    // ฟังก์ชันดาวน์โหลดรูป
    const handleDownload = (url, filename) => {
        const link = document.createElement('a');
        link.href = `http://localhost:3000${url}`; // ต่อ URL ของ Server
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="clg-body-wrapper">
            {/* Navbar */}
            <header className="clg-navbar">
                <div className="clg-logo"><img src={logoImg} alt="logo" className="clg-logo-img" /></div>
                <div className="clg-nav-icons">
                    <button className="clg-btn-world"><iconify-icon icon="iconamoon:search-light"></iconify-icon></button>
                    <button className="clg-btn-world"><iconify-icon icon="ph:bell-ringing-light"></iconify-icon></button>
                    <button className="clg-btn-users"><iconify-icon icon="solar:user-linear"></iconify-icon></button>
                </div>
            </header>

            <div className="clg-container">
                {/* Sidebar (ก๊อปมาจาก CreateLogo เดิม) */}
                <aside className="clg-sidebar">
                    {/* ... (Menu Sidebar เหมือนเดิม) ... */}
                </aside>

                {/* Main Content */}
                <main className="clg-main">
                    <h1 lang="en">Generates logo with AI</h1>
                    <p className="clg-subtitle">โลโก้ที่ AI เจนออกมาตาม DNA ของแบรนด์คุณ</p>

                    {/* 👇 Grid แสดงการ์ดโลโก้ (แถวละ 4) 👇 */}
                    <div className="clg-cards-container" style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'20px'}}>
                        {generatedImages.map((img) => (
                            <div key={img.id} className="clg-result-card" style={{background:'#fff', padding:'15px', borderRadius:'16px', boxShadow:'0 2px 10px rgba(0,0,0,0.05)', textAlign:'center', position:'relative'}}>
                                
                                {/* 1. ปุ่มกดใจ (มุมขวาบน) */}
                                <button 
                                    onClick={() => handleLike(img.id)}
                                    style={{position:'absolute', top:'10px', right:'10px', background:'none', border:'none', cursor:'pointer', fontSize:'24px', color: img.isLiked ? '#d3542b' : '#ccc'}}
                                >
                                    <iconify-icon icon={img.isLiked ? "mdi:heart" : "mdi:heart-outline"}></iconify-icon>
                                </button>

                                {/* 2. รูปโลโก้ */}
                                <div style={{width:'100%', height:'200px', borderRadius:'12px', overflow:'hidden', marginBottom:'15px'}}>
                                    <img 
                                        src={img.url} // ถ้าโหลดมาจาก server ให้ใช้ `http://localhost:3000${img.url}`
                                        alt={`Generated logo ${img.id}`} 
                                        style={{width:'100%', height:'100%', objectFit:'contain'}}
                                    />
                                </div>

                                {/* 3. กลุ่มปุ่มแอคชั่นด้านล่าง */}
                                <div style={{display:'flex', justifyContent:'center', gap:'10px'}}>
                                    {/* ปุ่มขยายรูป */}
                                    <button 
                                        onClick={() => setSelectedImage(img.url)}
                                        className="clg-ai-btn" 
                                        style={{padding:'8px 15px', background:'#eee', color:'#555', fontSize:'18px'}}
                                    >
                                        <iconify-icon icon="mdi:magnify-plus-outline"></iconify-icon>
                                    </button>
                                    {/* ปุ่มดาวน์โหลด */}
                                    <button 
                                        onClick={() => handleDownload(img.url, `logo_${img.id}.png`)}
                                        className="clg-ai-btn" 
                                        style={{padding:'8px 15px', background:'#fff3ee', color:'#d3542b', fontSize:'18px'}}
                                    >
                                        <iconify-icon icon="mdi:download-outline"></iconify-icon>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* 👇 ปุ่มเจนรูปใหม่อีกครั้ง 👇 */}
                    <div style={{textAlign:'center', marginTop:'40px'}}>
                        <button className="clg-ai-btn" style={{padding:'12px 30px', background:'#d3542b'}}>
                            ให้ AI เจนสไตล์โลโก้ใหม่อีกครั้ง
                        </button>
                    </div>

                </main>
            </div>

            {/* 👇 Popup ขยายดูรูปเต็มๆ 👇 */}
            {selectedImage && (
                <div className="clg-modal" onClick={() => setSelectedImage(null)} style={{background:'rgba(0,0,0,0.8)'}}>
                    <div className="clg-modal-box" onClick={e => e.stopPropagation()} style={{padding:'10px', width:'auto', maxWidth:'90%', maxHeight:'90%'}}>
                        <button className="clg-close-modal" onClick={() => setSelectedImage(null)}>&times;</button>
                        <img src={selectedImage} alt="Expanded logo" style={{width:'100%', maxHeight:'80vh', objectFit:'contain', borderRadius:'10px'}} />
                    </div>
                </div>
            )}
        </div>
    );
};