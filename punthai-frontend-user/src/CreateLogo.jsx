import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import './CreateLogo.css';

// นำเข้ารูปภาพ (ปรับ Path ให้ตรงกับโปรเจกต์ของคุณ)
import logoImg from './assets/logo.png';
import helpImg from './assets/help.png';
//mport createLogoImg from './assets/create logo.png'; /

export const CreateLogo = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const projectId = location.state?.projectId;

  // ดึง User ID
  const userData = JSON.parse(localStorage.getItem('user') || '{}');
  const userId = userData.user_id || 0;

  // --- States สำหรับ Layout ---
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // --- States สำหรับ Form สร้างโลโก้ ---
  const [brandName, setBrandName] = useState('');
  const [brandValue, setBrandValue] = useState('');
  const [importedProducts, setImportedProducts] = useState([]);
  const [selectedStyles, setSelectedStyles] = useState([]);
  const [detailsInput, setDetailsInput] = useState('');
  const [negativeInput, setNegativeInput] = useState('');

  const styleOptions = ['ทันสมัย', 'ความเป็นไทย', 'หรูหรา', 'เรียบง่าย', 'มินิมอล', 'เป็นกันเอง', 'การ์ตูน', 'ตัวหนังสือ', 'คลาสสิค'];

  // ================= ฟังก์ชันนำเข้าข้อมูลจาก DB =================
  const handleImportBrandName = async () => {
    try {
      const res = await fetch(`http://localhost:3000/api/brand-names/${projectId}`);
      const data = await res.json();
      if (data.status === 'success' && data.names) {
        const selected = data.names.find(n => n.is_selected === 1 || n.is_selected === true);
        if (selected) {
          setBrandName(selected.brand_name);
        } else {
          alert("ยังไม่มีชื่อแบรนด์ที่ถูกเลือกในโปรเจกต์นี้");
        }
      }
    } catch (err) { console.error(err); alert("ไม่สามารถเชื่อมต่อฐานข้อมูลได้"); }
  };

  const handleImportBrandValue = async () => {
    try {
      const res = await fetch(`http://localhost:3000/api/brand_dna/${projectId}`);
      const data = await res.json();
      if (data.status === 'success' && data.data) {
        setBrandValue(data.data.brand_value || '');
      } else {
        alert("คุณยังไม่ได้ทำแบบทดสอบ Brand DNA ในโปรเจกต์นี้");
      }
    } catch (err) { console.error(err); }
  };

  const handleImportProducts = async () => {
    try {
      const res = await fetch(`http://localhost:3000/api/brand_product/${projectId}`);
      const data = await res.json();
      if (data.status === 'success' && data.products.length > 0) {
        setImportedProducts(data.products);
        alert(`ดึงข้อมูลสินค้ามาแล้ว ${data.products.length} รายการ`);
      } else {
        alert("ยังไม่มีรายการสินค้าในโปรเจกต์นี้");
      }
    } catch (err) { console.error(err); }
  };

  // ================= ฟังก์ชันจัดการ Modal =================
  const handleOpenModal = () => setIsModalOpen(true);
  
  const handleCloseModal = () => {
    setIsModalOpen(false);
    resetModal();
  };

  const resetModal = () => {
    setBrandName('');
    setBrandValue('');
    setImportedProducts([]);
    setSelectedStyles([]);
    setDetailsInput('');
    setNegativeInput('');
  };

  const toggleStyle = (style) => {
    if (selectedStyles.includes(style)) {
      setSelectedStyles(selectedStyles.filter(s => s !== style));
    } else {
      setSelectedStyles([...selectedStyles, style]);
    }
  };

  // ================= ฟังก์ชันส่งข้อมูลไปให้ FLUX =================
  const handleSubmitLogo = async () => {
    if (!brandName.trim()) return alert("กรุณาระบุชื่อแบรนด์");
    if (selectedStyles.length === 0) return alert("กรุณาเลือกสไตล์อย่างน้อย 1 อย่าง");

    setIsLoading(true);
    try {
      const payload = {
        project_id: projectId,
        user_id: userId,
        brand_name: brandName,
        brand_value: brandValue,
        products: importedProducts,
        styles: selectedStyles,
        details: detailsInput,
        not_want: negativeInput
      };

      const res = await fetch('http://localhost:3000/api/generate-logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (data.status === 'success') {
        resetModal();
        setIsModalOpen(false);
        // ไปหน้าโชว์ผลลัพธ์ (สมมติว่าคุณสร้างไฟล์ ResultLogo.jsx ไว้รอแล้ว)
        navigate('/result-logo', { state: { projectId } }); 
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
    <div className="clg-body-wrapper">
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
          <button className="clg-btn-users"><iconify-icon icon="solar:user-linear"></iconify-icon></button>
        </div>
      </header>

      <div className="clg-container">
        {/* Sidebar */}
        <aside className={`clg-sidebar ${isSidebarCollapsed ? 'clg-collapsed' : ''}`} id="clg-sidebar">
          <button className="clg-toggle-btn" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>
            {isSidebarCollapsed ? '❯' : '❮'}
          </button>
          
          <ul className="clg-menu">
            <li onClick={() => navigate('/project', { state: { projectId } })} style={{ cursor: 'pointer' }}>
              <span className="clg-icon">
                <iconify-icon icon="mdi:view-dashboard-outline"></iconify-icon>
                </span>
                <span className="clg-text">Projects</span>
            </li>
            <li onClick={() => navigate('/brand-dna', { state: { projectId } })} style={{ cursor: 'pointer' }}>
              <span className="clg-icon"><iconify-icon icon="mdi:palette-outline"></iconify-icon></span><span className="clg-text">Brand DNA</span>
            </li>
            <li onClick={() => navigate('/create-concept', { state: { projectId } })} style={{ cursor: 'pointer' }}>
              <span className="clg-icon"><iconify-icon icon="mdi:lightbulb-outline"></iconify-icon></span><span className="clg-text">Create Concept</span>
            </li>
            <li className="clg-active" style={{ cursor: 'pointer' }}>
              <span className="clg-icon"><iconify-icon icon="mdi:folder-outline"></iconify-icon></span><span className="clg-text">Create Iogo</span>
            </li>
            <li onClick={() => navigate('/result', { state: { projectId } })} style={{ cursor: 'pointer' }}>
              <span className="clg-icon"><iconify-icon icon="mdi:folder-outline"></iconify-icon></span><span className="clg-text">Create Pictures</span>
            </li>
          </ul>
          <hr className="clg-hr" />
          <ul className="clg-menu">
            <li onClick={() => navigate('/your-projects', { state: { projectId } })} style={{ cursor: 'pointer' }}>
              <span className="clg-icon"><iconify-icon icon="mdi:folder-outline"></iconify-icon></span><span className="clg-text">Yours Projects</span>
            </li>
          </ul>
        </aside>

        {/* Main Content */}
        <main className="clg-main">
          <h1 lang="en">Create Logo</h1>
          <p className="clg-subtitle">เริ่มต้นด้วยการสร้างโลโก้ที่สะท้อนถึงเอกลักษณ์ของแบรนด์ของคุณ</p>

          <div className="clg-ai-card">
            <div className="clg-ai-card-content">
              <h2 lang="en">Generates With AI</h2>
              <p>ให้ AI สร้างโลโก้ที่กำหนดเองตาม DNA ของแบรนด์ของคุณ</p>
              <button className="clg-ai-btn" onClick={handleOpenModal}>Generate with AI</button>
            </div>
            <div className="clg-ai-card-image">
              {/* <img src={createLogoImg} alt="create logo" /> */}
            </div>
          </div>
        </main>
      </div>

      {/* AI Generate Popup Modal */}
      {isModalOpen && (
        <div className="clg-modal" onClick={handleCloseModal}>
          <div className="clg-modal-box" onClick={(e) => e.stopPropagation()} style={{maxHeight: '90vh', overflowY: 'auto'}}>
            <button className="clg-close-modal" onClick={handleCloseModal}>&times;</button>
            <h2 style={{color: '#d3542b', marginBottom: '20px'}}>ตั้งค่าโลโก้ของคุณ</h2>

            {/* 1. ชื่อแบรนด์ */}
            <div className="clg-form-group">
              <label style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <span><span className="clg-step">1</span> ชื่อแบรนด์ <span style={{color:'red'}}>*</span></span>
                <button 
                  onClick={handleImportBrandName}
                  style={{background:'#fff3ee', color:'#d75a2a', border:'none', padding:'5px 12px', borderRadius:'20px', cursor:'pointer', fontSize:'13px', display:'flex', alignItems:'center', gap:'5px'}}
                >
                  <iconify-icon icon="mdi:download"></iconify-icon> นำเข้าชื่อที่เลือก
                </button>
              </label>
              <input 
                type="text" 
                placeholder="ระบุชื่อแบรนด์..." 
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
              />
            </div>

            {/* 2. คุณค่าแบรนด์ */}
            <div className="clg-form-group">
              <label style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <span><span className="clg-step">2</span> คุณค่า/แนวคิดแบรนด์</span>
                <button 
                  onClick={handleImportBrandValue}
                  style={{background:'#fff3ee', color:'#d75a2a', border:'none', padding:'5px 12px', borderRadius:'20px', cursor:'pointer', fontSize:'13px', display:'flex', alignItems:'center', gap:'5px'}}
                >
                  <iconify-icon icon="mdi:dna"></iconify-icon> นำเข้าจาก Brand DNA
                </button>
              </label>
              <textarea 
                rows="3" 
                placeholder="ระบุคุณค่าหรือแนวคิดหลัก..." 
                value={brandValue}
                onChange={(e) => setBrandValue(e.target.value)}
                style={{width:'100%', border:'1px solid #ddd', borderRadius:'14px', padding:'12px', marginTop:'10px', outline:'none', fontFamily:'inherit'}}
              />
            </div>

            {/* 3. สินค้า */}
            <div className="clg-form-group">
              <label style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <span><span className="clg-step">3</span> สินค้าที่จะสร้างโลโก้</span>
                <button 
                  onClick={handleImportProducts}
                  style={{background:'#fff3ee', color:'#d75a2a', border:'none', padding:'5px 12px', borderRadius:'20px', cursor:'pointer', fontSize:'13px', display:'flex', alignItems:'center', gap:'5px'}}
                >
                  <iconify-icon icon="mdi:basket"></iconify-icon> นำเข้ารายการสินค้า
                </button>
              </label>
              <p style={{fontSize:'13px', color:'#888', marginTop:'5px'}}>
                {importedProducts.length > 0 ? `นำเข้าแล้ว: ${importedProducts.map(p => p.name_product).join(', ')}` : '*หากไม่มี จะเจนเป็นโลโก้อาร์ตแบบนามธรรม'}
              </p>
            </div>

            {/* 4. สไตล์ */}
            <div className="clg-form-group">
              <label><span className="clg-step">4</span> สไตล์โลโก้ (เลือกได้หลายคำ) <span style={{color:'red'}}>*</span></label>
              <div style={{display:'flex', flexWrap:'wrap', gap:'10px', marginTop:'10px'}}>
                {styleOptions.map(style => (
                  <span 
                    key={style}
                    onClick={() => toggleStyle(style)}
                    style={{
                      padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontSize: '14px', transition: '0.2s',
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

            {/* 5. รายละเอียดเพิ่มเติม */}
            <div className="clg-form-group">
              <label><span className="clg-step">5</span> รายละเอียดที่อยากได้เพิ่มเติม</label>
              <textarea 
                rows="2" 
                placeholder="เช่น อยากได้รูปช้างยืนบนดอกบัว..." 
                value={detailsInput}
                onChange={(e) => setDetailsInput(e.target.value)}
                style={{width:'100%', border:'1px solid #ddd', borderRadius:'14px', padding:'12px', marginTop:'10px', outline:'none', fontFamily:'inherit'}}
              />
            </div>

            {/* 6. สิ่งที่ไม่อยากได้ */}
            <div className="clg-form-group">
              <label><span className="clg-step">6</span> สิ่งที่ไม่อยากให้มี (Negative Prompt)</label>
              <input 
                type="text" 
                placeholder="เช่น สีดำ, รูปกะโหลก..." 
                value={negativeInput}
                onChange={(e) => setNegativeInput(e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="clg-modal-actions" style={{borderTop:'1px solid #eee', paddingTop:'20px', marginTop:'20px'}}>
              <button className="clg-cancel" onClick={handleCloseModal}>ยกเลิก</button>
              <button className="clg-confirm" onClick={handleSubmitLogo} disabled={isLoading}>
                {isLoading ? 'AI กำลังเจนรูป...' : 'ให้ AI เจนโลโก้'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Loading Overlay ขยายเต็มจอ */}
      {isLoading && (
        <div style={{position:'fixed', inset:0, background:'rgba(255,255,255,0.85)', zIndex:9999, display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center'}}>
            <iconify-icon icon="line-md:loading-loop" style={{fontSize:'60px', color:'#d75a2a'}}></iconify-icon>
            <h2 style={{marginTop:'20px', color:'#d75a2a'}}>FLUX.1 Schnell กำลังวาดโลโก้ให้คุณ...</h2>
            <p style={{color:'#666', marginTop:'10px'}}>อาจใช้เวลาประมาณ 10 - 20 วินาที กรุณารอสักครู่</p>
        </div>
      )}

    </div>
  );
};

