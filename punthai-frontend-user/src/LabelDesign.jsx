import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import html2canvas from 'html2canvas';
import './LabelDesign.css'; // สร้างไฟล์ CSS เปล่าๆ ไว้แต่งทีหลังได้ครับ

export const LabelDesign = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const projectId = location.state?.projectId;

    const labelRef = useRef(null); // ใช้จับ Div เพื่อทำเป็นรูปภาพ

    // States สำหรับเก็บข้อมูล Brand Identity
    const [logoUrl, setLogoUrl] = useState('');
    const [brandColors, setBrandColors] = useState(['#ffffff', '#000000', '#d3542b']); // สีเริ่มต้น
    const [brandFont, setBrandFont] = useState('sans-serif');

    // States สำหรับฟอร์มข้อความ
    const [productName, setProductName] = useState('');
    const [rawDetails, setRawDetails] = useState('');
    const [tagline, setTagline] = useState('สโลแกนสินค้าของคุณจะอยู่ที่นี่');
    const [ingredients, setIngredients] = useState('รายละเอียดส่วนผสมและวิธีใช้...');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!projectId) return navigate('/');
        fetchBrandAssets();
    }, [projectId]);

    const fetchBrandAssets = async () => {
        try {
            // ดึงโลโก้ (สมมติว่าคุณมีฟังก์ชันดึง detail project อยู่แล้ว)
            const projRes = await fetch(`http://localhost:3000/api/projects/detail/${projectId}`);
            const projData = await projRes.json();
            if (projData.project?.image_logo) setLogoUrl(`http://localhost:3000${projData.project.image_logo}`);

            // ดึงสีและฟอนต์ที่เลือกไว้
            const assetRes = await fetch(`http://localhost:3000/api/projects/${projectId}/selected-assets`);
            const assetData = await assetRes.json();
            
            if (assetData.color) {
                setBrandColors([assetData.color.color_code_1, assetData.color.color_code_2, assetData.color.color_code_3]);
            }
            if (assetData.font) {
                setBrandFont(`'${assetData.font.font_name}', sans-serif`);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleGenerateCopy = async () => {
        if (!productName) return alert('กรุณาใส่ชื่อสินค้าก่อนครับ');
        setIsLoading(true);
        try {
            const res = await fetch('http://localhost:3000/api/generate-label-content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ product_name: productName, raw_details: rawDetails })
            });
            const data = await res.json();
            if (data.status === 'success') {
                setTagline(data.data.tagline);
                setIngredients(data.data.ingredients);
            }
        } catch (err) {
            console.error(err);
            alert("เกิดข้อผิดพลาดในการเรียก AI");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownloadLabel = async () => {
        if (!labelRef.current) return;
        try {
            const canvas = await html2canvas(labelRef.current, { scale: 2 }); // scale: 2 ทำให้ภาพชัดขึ้น
            const image = canvas.toDataURL("image/png");
            
            const link = document.createElement("a");
            link.href = image;
            link.download = `Label_${productName || 'Design'}.png`;
            link.click();
        } catch (err) {
            console.error("Download Error", err);
        }
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f5f5', fontFamily: brandFont }}>
            
            {/* ซ้าย: แผงควบคุม (Form) */}
            <div style={{ width: '400px', background: '#fff', padding: '30px', borderRight: '1px solid #ddd', overflowY: 'auto' }}>
                <h2 style={{ color: '#d3542b', marginBottom: '20px' }}>ออกแบบฉลากสินค้า</h2>
                
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>ชื่อสินค้า</label>
                <input 
                    type="text" value={productName} onChange={e => setProductName(e.target.value)}
                    style={{ width: '100%', padding: '10px', marginBottom: '15px', borderRadius: '8px', border: '1px solid #ccc' }} 
                />

                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>ส่วนผสม / จุดเด่น (ข้อมูลดิบ)</label>
                <textarea 
                    rows="3" value={rawDetails} onChange={e => setRawDetails(e.target.value)}
                    style={{ width: '100%', padding: '10px', marginBottom: '15px', borderRadius: '8px', border: '1px solid #ccc' }} 
                />

                <button 
                    onClick={handleGenerateCopy} disabled={isLoading}
                    style={{ width: '100%', padding: '12px', background: '#d3542b', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '30px' }}
                >
                    {isLoading ? 'AI กำลังคิดคำโฆษณา...' : '✨ ให้ AI จัดเรียงคำโฆษณาให้'}
                </button>

                <hr style={{ borderTop: '1px solid #eee', marginBottom: '20px' }} />

                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>คำโปรย (แก้ไขได้)</label>
                <input 
                    type="text" value={tagline} onChange={e => setTagline(e.target.value)}
                    style={{ width: '100%', padding: '10px', marginBottom: '15px', borderRadius: '8px', border: '1px solid #ccc' }} 
                />

                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>ส่วนผสม (แก้ไขได้)</label>
                <textarea 
                    rows="4" value={ingredients} onChange={e => setIngredients(e.target.value)}
                    style={{ width: '100%', padding: '10px', marginBottom: '15px', borderRadius: '8px', border: '1px solid #ccc' }} 
                />

                <button 
                    onClick={handleDownloadLabel}
                    style={{ width: '100%', padding: '12px', background: '#333', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                    ⬇️ ดาวน์โหลดฉลากเป็น PNG
                </button>
            </div>

            {/* ขวา: Live Preview (Render HTML/CSS) */}
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px' }}>
                
                {/* 📌 จุดสำคัญ: กล่องนี้คือตัวฉลากที่จะถูกแคปเจอร์เป็นรูป */}
                <div 
                    ref={labelRef} 
                    style={{ 
                        width: '400px', height: '600px', // ปรับขนาด Aspect Ratio ตาม Packaging ได้ที่นี่
                        background: brandColors[0], // ดึงสีลำดับ 1 มาเป็นพื้นหลัง
                        color: brandColors[1],      // ดึงสีลำดับ 2 มาเป็นตัวอักษร
                        padding: '40px', 
                        borderRadius: '20px', 
                        boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                        position: 'relative', overflow: 'hidden'
                    }}
                >
                    {/* ของตกแต่ง (ดึงสีลำดับ 3 มาใช้) */}
                    <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '150px', height: '150px', background: brandColors[2], borderRadius: '50%', opacity: 0.2 }}></div>

                    {/* โลโก้จริง */}
                    {logoUrl ? (
                        <img src={logoUrl} alt="logo" style={{ width: '120px', height: '120px', objectFit: 'contain', marginBottom: '20px' }} />
                    ) : (
                        <div style={{ width: '120px', height: '120px', background: '#eee', borderRadius: '50%', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>LOGO</div>
                    )}

                    <h1 style={{ fontSize: '32px', margin: '0 0 10px 0' }}>{productName || 'Product Name'}</h1>
                    <p style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 30px 0', color: brandColors[2] }}>{tagline}</p>
                    
                    <div style={{ marginTop: 'auto', width: '100%', textAlign: 'left', background: 'rgba(255,255,255,0.4)', padding: '15px', borderRadius: '10px' }}>
                        <strong style={{ display: 'block', marginBottom: '8px' }}>ส่วนประกอบสำคัญ:</strong>
                        <p style={{ fontSize: '14px', whiteSpace: 'pre-wrap', margin: 0 }}>{ingredients}</p>
                    </div>
                </div>

            </div>
        </div>
    );
};