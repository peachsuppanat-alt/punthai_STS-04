import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import './CreateLogo.css';
import { fetchSubscriptionStatus } from '../utils/subscriptionGuard';
import ProUpgradeModal from '../components/ProUpgradeModal';

import logoImg from '../assets/logo.png';
import helpImg from '../assets/help.png';
import { API_URL } from '../config';
//import createLogoImg from './assets/create logo.png';

export const CreateLogo = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const projectId = location.state?.projectId;
  const forceCreate = location.state?.forceCreate; // รับค่า forceCreate เพื่อเช็คว่าผู้ใช้จงใจกดปุ่ม "เจนรูปใหม่อีกครั้ง" มาหรือไม่
  
  // ดึง User ID
  const userData = JSON.parse(localStorage.getItem('user') || '{}');
  const userId = userData.user_id || 0;
  
  // State สำหรับโชว์หน้าจอโหลดระหว่างเช็คข้อมูล
  const [isChecking, setIsChecking] = useState(true);

  // --- States สำหรับ Layout ---
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  // --- States สำหรับ Form สร้างโลโก้ ---
  const [brandName, setBrandName] = useState('');
  const [brandValue, setBrandValue] = useState('');
  const [importedProducts, setImportedProducts] = useState([]);
  const [selectedStyle, setSelectedStyle] = useState('combination');
  const [detailsInput, setDetailsInput] = useState('');
  const [negativeInput, setNegativeInput] = useState('');

  const styleOptions = [
    { id: 'wordmark', name: 'Wordmark', desc: '(ตัวอักษรล้วน)', icon: 'mdi:format-text' },
    { id: 'lettermark', name: 'Lettermark', desc: '(อักษรย่อ)', icon: 'mdi:format-letter-case' },
    { id: 'combination', name: 'Combination', desc: '(ผสม)', icon: 'mdi:puzzle-outline' },
    { id: 'emblem', name: 'Emblem', desc: '(ตราสัญลักษณ์)', icon: 'mdi:shield-check-outline' },
    { id: 'mascot', name: 'Mascot', desc: '(มาสคอต)', icon: 'mdi:teddy-bear' },
    { id: 'minimal', name: 'Minimal', desc: '(มินิมอล)', icon: 'mdi:shape-outline' }
  ];

  const [useImportedColor, setUseImportedColor] = useState(false);
  const [useImportedFont, setUseImportedFont] = useState(false);
  const [showProModal, setShowProModal] = useState(false);
  const [usageInfo, setUsageInfo] = useState(null);

  useEffect(() => {
    if (userId) {
      fetchSubscriptionStatus(userId).then(data => {
        if (data) setUsageInfo(data);
      });
    }
  }, [userId]);
  
  // ================= 🚨 เพิ่มฟังก์ชันตรวจสอบรูปภาพอัตโนมัติ =================
  useEffect(() => {
      // ถ้าไม่มี projectId หรือ ผู้ใช้จงใจกดปุ่มเจนใหม่ (forceCreate) ให้อยู่หน้านี้ต่อ
      if (!projectId || forceCreate) {
          setIsChecking(false);
          return;
      }

      // ตรวจสอบว่าโปรเจกต์นี้มีโลโก้ในระบบหรือยัง
      fetch(`${API_URL}/api/generated-logos/${projectId}`)
          .then(res => res.json())
          .then(data => {
              // ถ้ามีรูปโลโก้อยู่แล้ว ให้เด้งไปหน้า Result อัตโนมัติ
              if (data.status === 'success' && data.images && data.images.length > 0) {
                  navigate('/result-logo', { state: { projectId } });
              } else {
                  // ถ้ายังไม่มีรูป ให้อยู่หน้า CreateLogo ต่อไป
                  setIsChecking(false);
              }
          })
          .catch(err => {
              console.error("Error checking generated logos:", err);
              setIsChecking(false); // ถึงจะ error ก็ปล่อยให้อยู่หน้านี้เพื่อทำงานต่อ
          });
  }, [projectId, forceCreate, navigate]);

  // ================= ฟังก์ชันนำเข้าข้อมูลจาก DB =================
  const handleImportBrandName = async () => {
    try {
      const res = await fetch(`${API_URL}/api/brand-names/${projectId}`);
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
      const res = await fetch(`${API_URL}/api/brand_dna/${projectId}`);
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
      const res = await fetch(`${API_URL}/api/brand_product/${projectId}`);
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
    setSelectedStyle('combination');
    setDetailsInput('');
    setNegativeInput('');
  };

  // ================= ฟังก์ชันส่งข้อมูลไปให้ DALL-E 3 =================
  const handleSubmitLogo = async () => {
    if (!brandName.trim()) return alert("กรุณาระบุชื่อแบรนด์");
    if (!selectedStyle) return alert("กรุณาเลือกสไตล์ของโลโก้");

    try {
      const status = await fetchSubscriptionStatus(userId);
      if (status?.generation && !status.generation.allowed) {
        setUsageInfo(status);
        setShowProModal(true);
        return;
      }
      if (status) setUsageInfo(status);
    } catch (e) { /* continue — backend guard will catch */ }

    setIsLoading(true);
    setLoadingMessage('กำลังเตรียมข้อมูล...');

    const productsText = Array.isArray(importedProducts)
      ? importedProducts.map(p => p.name_product || p).join(', ')
      : importedProducts;

    const payload = {
      project_id: projectId,
      user_id: userId,
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
    Object.entries(payload).forEach(([k, v]) => { if (v !== undefined && v !== null) params.append(k, v); });

    const eventSource = new EventSource(`${API_URL}/api/generate-logo?${params.toString()}`);

    eventSource.addEventListener('progress', (e) => {
      try {
        const data = JSON.parse(e.data);
        setLoadingMessage(data.message || 'กำลังดำเนินการ...');
      } catch {}
    });

    eventSource.addEventListener('done', (e) => {
      eventSource.close();
      setIsLoading(false);
      setLoadingMessage('');
      try {
        const data = JSON.parse(e.data);
        if (data.status === 'success') {
          resetModal();
          setIsModalOpen(false);
          navigate('/result-logo', { state: { projectId } });
        }
      } catch {}
    });

    eventSource.addEventListener('error', (e) => {
      eventSource.close();
      setIsLoading(false);
      setLoadingMessage('');
      try {
        const data = JSON.parse(e.data);
        alert(data.message || 'เกิดข้อผิดพลาดในการสร้างโลโก้');
      } catch {
        alert('ไม่สามารถติดต่อ AI Server ได้');
      }
    });

    eventSource.onerror = () => {
      eventSource.close();
      setIsLoading(false);
      setLoadingMessage('');
      alert('การเชื่อมต่อกับ Server ขาดหาย กรุณาลองใหม่');
    };
  };

  // 👇 ระหว่างรอเช็คข้อมูลจาก Database ให้ขึ้นหน้าโหลดก่อน ป้องกันหน้าเว็บกะพริบ
  if (isChecking) {
      return (
          <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#f5f5f5' }}>
              <iconify-icon icon="line-md:loading-loop" style={{ fontSize: '50px', color: '#d75a2a' }}></iconify-icon>
              <h3 style={{ marginTop: '20px', color: '#666' }}>กำลังตรวจสอบข้อมูลโปรเจกต์...</h3>
          </div>
      );
  }

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
              <span className="clg-icon"><iconify-icon icon="mdi:folder-outline"></iconify-icon></span><span className="clg-text">Create Logo</span>
            </li>
            <li onClick={() => navigate('/result', { state: { projectId } })} style={{ cursor: 'pointer' }}>
              <span className="clg-icon"><iconify-icon icon="mdi:folder-outline"></iconify-icon></span><span className="clg-text">Create Pictures</span>
            </li>
          </ul>
          <hr className="clg-hr" />
          <ul className="clg-menu">
            <li onClick={() => navigate('/product', { state: { projectId } })} style={{ cursor: 'pointer' }}>
              <span className="clg-icon"><iconify-icon icon="mdi:folder-outline"></iconify-icon></span><span className="clg-text">Yours product</span>
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
              <label><span className="clg-step">4</span> สไตล์โลโก้ <span style={{color:'red'}}>*</span></label>
              <div style={{display:'flex', flexWrap:'wrap', gap:'10px', marginTop:'10px'}}>
                {styleOptions.map(style => (
                  <div
                    key={style.id}
                    onClick={() => setSelectedStyle(style.id)}
                    style={{
                      padding: '15px 10px',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 'calc(33.33% - 7px)',
                      boxSizing: 'border-box',
                      border: selectedStyle === style.id ? '2px solid #d75a2a' : '1px solid #eee',
                      background: selectedStyle === style.id ? '#fff3ee' : '#fafafa',
                      transition: 'all 0.2s ease',
                      gap: '5px'
                    }}
                  >
                    <iconify-icon icon={style.icon} style={{ fontSize: '32px', color: selectedStyle === style.id ? '#d75a2a' : '#888' }}></iconify-icon>
                    <span style={{ fontWeight: 'bold', fontSize: '13px', color: selectedStyle === style.id ? '#d75a2a' : '#444' }}>
                      {style.name}
                    </span>
                    <span style={{ fontSize: '11px', color: '#888', textAlign: 'center' }}>
                      {style.desc}
                    </span>
                  </div>
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
            {/* 👇 เพิ่มข้อ 7 และ 8 👇 */}
            <div className="clg-form-group" style={{ display: 'flex', gap: '20px', marginTop: '15px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', background: '#f9f9f9', padding: '10px 15px', borderRadius: '8px', border: '1px solid #eee', width: '100%' }}>
                    <input type="checkbox" checked={useImportedColor} onChange={(e) => setUseImportedColor(e.target.checked)} style={{ width: '20px', height: '20px', accentColor: '#d3542b' }} />
                    <span style={{ fontWeight: '500', color: '#444' }}>นำเข้า <b>ชุดสี</b> ที่เลือกไว้แล้ว</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', background: '#f9f9f9', padding: '10px 15px', borderRadius: '8px', border: '1px solid #eee', width: '100%' }}>
                    <input type="checkbox" checked={useImportedFont} onChange={(e) => setUseImportedFont(e.target.checked)} style={{ width: '20px', height: '20px', accentColor: '#d3542b' }} />
                    <span style={{ fontWeight: '500', color: '#444' }}>นำเข้า <b>ฟอนต์</b> ที่เลือกไว้แล้ว</span>
                </label>
            </div>

            {usageInfo?.generation && (
              <div style={{ textAlign: 'center', margin: '8px 0', fontSize: 13, color: usageInfo.generation.remaining <= 1 ? '#e53e3e' : '#888' }}>
                <iconify-icon icon="mdi:image-auto-adjust" style={{ verticalAlign: 'middle', marginRight: 4 }}></iconify-icon>
                ใช้ไป {usageInfo.generation.used}/{usageInfo.generation.limit} ครั้ง
                {usageInfo.generation.period === 'lifetime' ? ' (ตลอดชีพ)' : ' (เดือนนี้)'}
              </div>
            )}

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
            <h2 style={{marginTop:'20px', color:'#d75a2a'}}>{loadingMessage || 'AI กำลังวาดโลโก้ให้คุณ...'}</h2>
            <p style={{color:'#666', marginTop:'10px'}}>กรุณารอสักครู่</p>
        </div>
      )}

      <ProUpgradeModal isOpen={showProModal} onClose={() => setShowProModal(false)} feature="generation" />
    </div>
  );
};