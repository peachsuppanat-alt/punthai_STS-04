import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import './CreateConcept.css';

import logoImg from './assets/logo.png';
import helpImg from './assets/help.png';

export const CreateConcept = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const projectId = location.state?.projectId;
  const userData = JSON.parse(localStorage.getItem('user') || '{}');
  const userId = userData.user_id || 0;

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('name');
  const [loading, setLoading] = useState({ show: false, text: '' });
  const [activeDropdown, setActiveDropdown] = useState(null);

  const [modals, setModals] = useState({ name: false });

  const openModal = (type) => setModals({ ...modals, [type]: true });
  const closeModal = (type) => {
    setModals({ ...modals, [type]: false });
    if (type === 'name') setNmErrors({});
  };

  useEffect(() => {
    const handleClickOutside = () => setActiveDropdown(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleDropdownClick = (e, id) => {
    e.stopPropagation();
    setActiveDropdown(activeDropdown === id ? null : id);
  };

  // ==================== NAME SECTION STATES ====================
  const [nmForm, setNmForm] = useState({ product: '', cat: '', benefit: '', target: '', tags: [], special: '' });
  const [useDna, setUseDna] = useState(false); // Checkbox ดึง DNA
  const [nmErrors, setNmErrors] = useState({});
  const [namesList, setNamesList] = useState([]); // รายชื่อแบรนด์ทั้งหมดจาก DB

  // ดึงชื่อแบรนด์จาก DB ตอนโหลดหน้า
  useEffect(() => {
    if (projectId) fetchNames();
  }, [projectId]);

  const fetchNames = async () => {
    try {
      const res = await fetch(`http://localhost:3000/api/brand-names/${projectId}`);
      const data = await res.json();
      if (data.status === 'success') {
        setNamesList(data.names);
      }
    } catch (err) { console.error(err); }
  };

  const toggleNmTag = (tag) => {
    setNmForm(prev => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag]
    }));
    if (nmErrors.tags) setNmErrors(prev => ({ ...prev, tags: false }));
  };

  const submitName = async () => {
    let errs = {};
    if (!nmForm.product.trim()) errs.product = true;
    if (!nmForm.cat) errs.cat = true;
    if (!useDna && !nmForm.target) errs.target = true; // ถัาไม่ดึง DNA ต้องบังคับเลือก target
    if (nmForm.tags.length === 0) errs.tags = true;

    if (Object.keys(errs).length > 0) {
      setNmErrors(errs);
      return;
    }

    closeModal('name');
    setLoading({ show: true, text: 'AI กำลังคิดชื่อแบรนด์ 10 ชื่อให้คุณ...' });

    try {
      const payload = {
        project_id: projectId,
        user_id: userId,
        product: nmForm.product,
        category: nmForm.cat,
        benefit: nmForm.benefit,
        target: nmForm.target,
        tags: nmForm.tags,
        special: nmForm.special,
        use_dna: useDna
      };

      const res = await fetch('http://localhost:3000/api/generate-brand-names', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.status === 'success') {
        fetchNames(); // โหลดข้อมูลใหม่มาแสดง
      } else {
        alert("Error: " + data.message);
      }
    } catch (err) {
      alert("ไม่สามารถติดต่อ AI ได้");
    } finally {
      setLoading({ show: false, text: '' });
    }
  };

  // กด Like
  const handleLike = async (conceptId, currentStatus) => {
    try {
      await fetch(`http://localhost:3000/api/brand-names/like/${conceptId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_liked: !currentStatus })
      });
      fetchNames();
    } catch (err) { console.error(err); }
  };

  // กด Select
  const handleSelect = async (conceptId) => {
    try {
      await fetch(`http://localhost:3000/api/brand-names/select/${conceptId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId })
      });
      fetchNames();
    } catch (err) { console.error(err); }
  };

  // หาชื่อที่ถูกเลือก 1 ชื่อ
  const selectedNameObj = namesList.find(n => n.is_selected);
  const otherNames = namesList.filter(n => !n.is_selected);

  return (
    <div className="cncpt-body">
      <header className="cncpt-navbar">
        <div className="cncpt-logo"><Link to="/"><img src={logoImg} alt="logo" className="cncpt-logo-img" /></Link></div>
        <div className="cncpt-nav-icons">
          <button className="cncpt-btn-world"><iconify-icon icon="iconamoon:search-light"></iconify-icon></button>
          <button className="cncpt-btn-world"><iconify-icon icon="ph:bell-ringing-light"></iconify-icon></button>
          <button className="cncpt-btn-users"><iconify-icon icon="solar:user-linear"></iconify-icon></button>
        </div>
      </header>

      <div className="cncpt-container">
        {/* SIDEBAR */}
        <aside className={`cncpt-sidebar ${isSidebarCollapsed ? 'cncpt-collapsed' : ''}`} id="cncpt-sidebar">
          <button className="cncpt-toggle-btn" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>{isSidebarCollapsed ? '❯' : '❮'}</button>
          <ul className="cncpt-menu">
            <li onClick={() => navigate('/project', { state: { projectId } })}><span className="cncpt-icon"><iconify-icon icon="mdi:view-dashboard-outline"></iconify-icon></span><span className="cncpt-text">Projects</span></li>
            <li onClick={() => navigate('/brand-dna', { state: { projectId } })}><span className="cncpt-icon"><iconify-icon icon="mdi:palette-outline"></iconify-icon></span><span className="cncpt-text">Brand DNA</span></li>
            <li className="cncpt-active"><span className="cncpt-icon"><iconify-icon icon="mdi:lightbulb-outline"></iconify-icon></span><span className="cncpt-text">Create Concept</span></li>
            <li onClick={() => navigate('/create-logo', { state: { projectId } })} style={{ cursor: 'pointer' }}>
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

        {/* MAIN CONTENT */}
        <main className="cncpt-main-content">
          <div className="cncpt-tab-bar">
            <button className={`cncpt-tab ${activeTab === 'name' ? 'cncpt-active' : ''}`} onClick={() => setActiveTab('name')}>Name</button>
            {/* Color & Fonts Tabs hidden for brevity, keep your original HTML here if needed */}
          </div>

          {/* TAB 1: NAME */}
          <div className="cncpt-tab-content" style={{ display: activeTab === 'name' ? 'flex' : 'none', alignItems: 'flex-start', padding: '40px' }}>
            {namesList.length === 0 ? (
              // กรณีเพิ่งเข้ามา ยังไม่มีชื่อเลย
              <div className="cncpt-empty-state" style={{ width: '100%' }}>
                <div className="cncpt-empty-icon"><iconify-icon icon="mdi:pencil-box-outline"></iconify-icon></div>
                <p className="cncpt-empty-title">Find the perfect brand name for you.</p>
                <button className="cncpt-get-start-btn" onClick={() => openModal('name')}>Get Start</button>
              </div>
            ) : (
              // กรณีมีชื่อแล้ว แสดงผลลัพธ์
              <div style={{ width: '100%' }}>

                {/* 1. โชว์ชื่อที่ถูก Select ไว้บนสุด (มีแค่ 1 ชื่อ) */}
                {selectedNameObj && (
                  <div className="cncpt-result-state" style={{ marginBottom: '40px', background: '#fff', padding: '30px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                    <p className="cncpt-result-label" style={{ color: '#d75a2a' }}>ชื่อที่คุณเลือกใช้สำหรับโปรเจกต์นี้</p>
                    <h2 className="cncpt-result-name" style={{ fontSize: '50px', color: '#d75a2a', margin: '15px 0' }}>{selectedNameObj.brand_name}</h2>
                  </div>
                )}

                {/* 2. ปุ่มให้ AI คิดเพิ่ม */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ color: '#333' }}>รายชื่อที่ AI แนะนำ</h3>
                  <button className="cncpt-rename-btn" onClick={() => openModal('name')}>
                    ให้ AI คิดให้อีกครั้ง <iconify-icon icon="mdi:refresh"></iconify-icon>
                  </button>
                </div>

                {/* 3. Grid โชว์รายชื่ออื่นๆ แถวละ 4 ชื่อ */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
                  {otherNames.map((n) => (
                    <div key={n.concept_id} style={{ background: '#fff', padding: '25px 20px', borderRadius: '16px', textAlign: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.04)', position: 'relative' }}>

                      {/* ปุ่มกดใจ มุมขวาบน */}
                      <button
                        onClick={() => handleLike(n.concept_id, n.is_liked)}
                        style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', cursor: 'pointer', color: n.is_liked ? '#d75a2a' : '#ccc', fontSize: '24px' }}
                      >
                        <iconify-icon icon={n.is_liked ? "mdi:heart" : "mdi:heart-outline"}></iconify-icon>
                      </button>

                      <h3 style={{ fontSize: '22px', color: '#333', margin: '20px 0 30px' }}>{n.brand_name}</h3>

                      {/* ปุ่มเลือกชื่อนี้ */}
                      <button
                        onClick={() => handleSelect(n.concept_id)}
                        className="cncpt-select-btn"
                        style={{ width: '100%', background: '#fff3ee', color: '#d75a2a', border: '1px solid #d75a2a' }}
                      >
                        <iconify-icon icon="mdi:check-circle-outline"></iconify-icon> เลือกชื่อนี้
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* NAME MODAL */}
      {modals.name && (
        <div className="cncpt-cc-modal" onClick={() => closeModal('name')}>
          <div className="cncpt-cc-modal-box" onClick={e => e.stopPropagation()}>
            <button className="cncpt-cc-close" onClick={() => closeModal('name')}>✕</button>

            <div className="cncpt-form-group">
              <label><span className="cncpt-step">1</span> สินค้าของคุณคืออะไร <span className="cncpt-req-star">*</span></label>
              <input type="text" placeholder="เช่น โดนัท" className={nmErrors.product ? 'cncpt-input-err' : ''} value={nmForm.product} onChange={e => { setNmForm({ ...nmForm, product: e.target.value }); setNmErrors({ ...nmErrors, product: false }) }} />
            </div>

            <div className="cncpt-form-group">
              <label><span className="cncpt-step">2</span> ประเภท <span className="cncpt-req-star">*</span></label>
              <div className={`cncpt-cc-dd ${activeDropdown === 'dd-nm-cat' ? 'cncpt-open' : ''}`} onClick={(e) => handleDropdownClick(e, 'dd-nm-cat')}>
                <div className="cncpt-cc-dd-sel">
                  <span className={nmForm.cat ? '' : 'cncpt-dd-placeholder'}>{nmForm.cat || '-- เลือกประเภทสินค้า --'}</span>
                  <iconify-icon icon="mdi:chevron-down"></iconify-icon>
                </div>
                <ul className="cncpt-cc-dd-list">
                  {['อาหาร / ของกินเล่น', 'เครื่องดื่ม', 'เสื้อผ้า', 'ความงาม', 'ของใช้'].map(c => (
                    <li key={c} onClick={() => { setNmForm({ ...nmForm, cat: c }); setNmErrors({ ...nmErrors, cat: false }) }}>{c}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="cncpt-form-group">
              <label><span className="cncpt-step">3</span> ประโยชน์และคุณค่าที่โดดเด่น</label>
              <input type="text" placeholder="เช่น สรรพคุณ ช่วยเรื่องอะไร" value={nmForm.benefit} onChange={e => setNmForm({ ...nmForm, benefit: e.target.value })} />
            </div>

            <div className="cncpt-form-group">
              <label><span className="cncpt-step">4</span> กลุ่มเป้าหมาย <span className="cncpt-req-star">{useDna ? '' : '*'}</span></label>

              {/* ซ่อน Dropdown ถ้าเลือกดึงข้อมูลจาก DNA */}
              {!useDna && (
                <div className={`cncpt-cc-dd ${activeDropdown === 'dd-nm-target' ? 'cncpt-open' : ''}`} onClick={(e) => handleDropdownClick(e, 'dd-nm-target')}>
                  <div className="cncpt-cc-dd-sel">
                    <span className={nmForm.target ? '' : 'cncpt-dd-placeholder'}>{nmForm.target || '-- เลือกกลุ่มเป้าหมาย --'}</span>
                    <iconify-icon icon="mdi:chevron-down"></iconify-icon>
                  </div>
                  <ul className="cncpt-cc-dd-list">
                    {['เด็ก', 'วัยรุ่น', 'วัยทำงาน', 'ผู้สูงอายุ', 'ทุกเพศทุกวัย'].map(c => (
                      <li key={c} onClick={() => { setNmForm({ ...nmForm, target: c }); setNmErrors({ ...nmErrors, target: false }) }}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}

              <label className="cncpt-cb-label" style={{ marginTop: '15px' }}>
                <input type="checkbox" checked={useDna} onChange={(e) => { setUseDna(e.target.checked); setNmErrors({ ...nmErrors, target: false }); }} style={{ marginRight: '8px' }} />
                เลือกคำตอบจาก Brand DNA แทน
              </label>
              <p className="cncpt-dna-hint">คิดไม่ออกหรอ? <Link to="/brand-dna" state={{ projectId }}>Brand DNA ›</Link></p>
            </div>

            <div className="cncpt-form-group">
              <label><span className="cncpt-step">5</span> รายละเอียดที่ต้องการ (เลือกได้หลายข้อ) <span className="cncpt-req-star">*</span></label>
              <div className="cncpt-tag-group">
                {['ชื่อไทย', 'ชื่ออังกฤษ', 'ชื่อทันสมัย', 'ชื่อคลาสสิค', 'มงคล', 'เน้นสื่อถึงสินค้า', 'เน้นสื่อถึงประโยชน์และคุณค่า'].map(t => (
                  <span key={t} className={`cncpt-tag ${nmForm.tags.includes(t) ? 'cncpt-active' : ''}`} onClick={() => toggleNmTag(t)}>{t}</span>
                ))}
              </div>
            </div>

            <div className="cncpt-form-group">
              <label><span className="cncpt-step">6</span> ลักษณะชื่อที่ต้องการเป็นพิเศษ (ถ้ามี)</label>
              <textarea rows="3" placeholder="ระบุลักษณะพิเศษ..." value={nmForm.special} onChange={e => setNmForm({ ...nmForm, special: e.target.value })}></textarea>
            </div>

            <div className="cncpt-modal-actions">
              <button className="cncpt-cancel-btn" onClick={() => closeModal('name')}>ยกเลิก</button>
              <button className="cncpt-confirm-btn" onClick={submitName}>ให้ AI ช่วยคิดชื่อ</button>
            </div>
          </div>
        </div>
      )}

      {/* LOADING OVERLAY */}
      {loading.show && (
        <div className="cncpt-loading-overlay">
          <div className="cncpt-loading-box">
            <div className="cncpt-spinner"></div>
            <p id="cncpt-loading-text">{loading.text}</p>
          </div>
        </div>
      )}

    </div>
  );
};