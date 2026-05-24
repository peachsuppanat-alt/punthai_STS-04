import React, { useState , useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; 
import './Home.css';

import homeImg from './assets/home.png';
import img1 from './assets/1.png';
import img2 from './assets/2.png';
import img3 from './assets/3.png';
import img4 from './assets/4.png';
import womenImg from './assets/women.png';
import emptyImg from './assets/emtpy.png';
import logoImg from './assets/logo.png';

const Home = ({ user }) => {
  const [activeCard, setActiveCard] = useState(null);
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);

  // States สำหรับจัดการเมนูจุด 3 จุด และ Popup แก้ไขชื่อ
  const [openMenuId, setOpenMenuId] = useState(null); 
  const [showEditPopup, setShowEditPopup] = useState(false);
  const [editProjectId, setEditProjectId] = useState(null);
  const [editProjectName, setEditProjectName] = useState('');
  const [completions, setCompletions] = useState({});

  useEffect(() => {
    if (user) {
      fetch(`http://localhost:3000/api/projects/${user.user_id}`)
        .then(res => res.json())
        .then(data => {
          if (data.status === 'success') {
            setProjects(data.projects);
          }
        })
        .catch(err => console.error("Fetch projects error:", err));

      fetch(`http://localhost:3000/api/users/${user.user_id}/completions`)
        .then(res => res.json())
        .then(data => {
          if (data.status === 'success') {
            const map = {};
            data.projects.forEach(p => { map[p.project_id] = p.percentage; });
            setCompletions(map);
          }
        })
        .catch(err => console.error("Fetch completions error:", err));
    } else {
      setProjects([]);
      setCompletions({});
    }
  }, [user]);

  // ฟังก์ชันสร้างโปรเจกต์แบบด่วน
  const handleCreateProjectDirectly = async (e) => {
    if (e) e.preventDefault();
    if (!user) {
      alert("กรุณาเข้าสู่ระบบก่อนสร้างแบรนด์!");
      return;
    }
    try {
      const res = await fetch('http://localhost:3000/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.user_id })
      });
      const data = await res.json();
      if (data.status === 'success') {
        navigate('/project', { state: { projectId: data.project_id } }); 
      } else {
        alert('❌ ' + data.message);
      }
    } catch (err) {
      alert('เชื่อมต่อ Server ไม่ได้');
    }
  };

  // ฟังก์ชันเปิด/ปิด เมนูจุด 3 จุด
  const toggleMenu = (e, projectId) => {
    e.stopPropagation(); 
    setOpenMenuId(openMenuId === projectId ? null : projectId);
  };

  // ฟังก์ชันลบโปรเจกต์
  const handleDeleteProject = async (e, projectId) => {
    e.stopPropagation();
    setOpenMenuId(null); 
    
    if (window.confirm("คุณแน่ใจหรือไม่ว่าต้องการลบโปรเจกต์นี้? ข้อมูลทั้งหมดจะหายไป")) {
        try {
            const res = await fetch(`http://localhost:3000/api/projects/${projectId}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.status === 'success') {
                setProjects(projects.filter(p => p.project_id !== projectId));
            } else {
                alert('❌ ' + data.message);
            }
        } catch (err) {
            alert('เชื่อมต่อ Server ไม่ได้');
        }
    }
  };

  // ฟังก์ชันเปิด Popup แก้ไขชื่อ
  const handleOpenEditPopup = (e, proj) => {
    e.stopPropagation();
    setOpenMenuId(null); 
    setEditProjectId(proj.project_id);
    setEditProjectName(proj.project_name || '');
    setShowEditPopup(true);
  };

  // ฟังก์ชันบันทึกการแก้ไขชื่อ
  const handleSaveEditName = async (e) => {
    e.preventDefault();
    try {
        const res = await fetch(`http://localhost:3000/api/projects/${editProjectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project_name: editProjectName })
        });
        const data = await res.json();
        if (data.status === 'success') {
            setProjects(projects.map(p => p.project_id === editProjectId ? { ...p, project_name: editProjectName } : p));
            setShowEditPopup(false);
        } else {
            alert('❌ ' + data.message);
        }
    } catch (err) {
        alert('เชื่อมต่อ Server ไม่ได้');
    }
  };

  const handleCardClick = (index) => {
    setActiveCard(index);
  };

return (
    <div onClick={() => setOpenMenuId(null)}> {/* ปิดเมนูถ้ายูสเซอร์คลิกที่พื้นที่ว่าง */}
      {user && projects.length > 0 ? (
        <section className="user-projects-dashboard">
          <div className="dashboard-header">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              ยินดีต้อนรับ, {user.user_name} 
              {/* 👇 ป้ายโชว์สถานะในหน้า Home 👇 */}
              <span style={{ 
                  fontSize: '14px', 
                  background: user.subscription_status === 'PRO' ? 'linear-gradient(45deg, #FFD700, #FFA500)' : '#eee', 
                  color: user.subscription_status === 'PRO' ? '#000' : '#666', 
                  padding: '4px 12px', 
                  borderRadius: '20px', 
                  fontWeight: 'bold',
                  boxShadow: user.subscription_status === 'PRO' ? '0 2px 10px rgba(255, 165, 0, 0.4)' : 'none'
              }}>
                {user.subscription_status || 'STANDARD'}
              </span>
            </h2>
            <p>เลือกโปรเจกต์ที่คุณต้องการทำต่อ หรือสร้างแบรนด์ใหม่ได้เลย</p>
          </div>
          
          <div className="project-cards-container">
            <div className="project-card create-new" onClick={handleCreateProjectDirectly}>
              <iconify-icon icon="line-md:plus-circle" style={{ fontSize: '50px' }}></iconify-icon>
              <span>สร้างแบรนด์ใหม่</span>
            </div>

            {projects.map(proj => (
              <div 
                key={proj.project_id} 
                className="project-card" 
                onClick={() => navigate('/project', { state: { projectId: proj.project_id } })}
                style={{ position: 'relative' }} 
              >
                
                {/* ปุ่มจุด 3 จุด */}
                <button 
                    onClick={(e) => toggleMenu(e, proj.project_id)}
                    style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '24px', color: '#888', zIndex: 2 }}
                >
                    <iconify-icon icon="mdi:dots-vertical"></iconify-icon>
                </button>

                {/* Dropdown Menu */}
                {openMenuId === proj.project_id && (
                    <div style={{ position: 'absolute', top: '45px', right: '15px', background: '#fff', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', borderRadius: '10px', zIndex: 10, overflow: 'hidden', minWidth: '130px' }}>
                        <div 
                            onClick={(e) => handleOpenEditPopup(e, proj)} 
                            style={{ padding: '12px 15px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#333' }}
                        >
                            <iconify-icon icon="mdi:pencil-outline" style={{ fontSize: '18px', color: '#d75a2a' }}></iconify-icon>
                            แก้ไขชื่อ
                        </div>
                        <div 
                            onClick={(e) => handleDeleteProject(e, proj.project_id)} 
                            style={{ padding: '12px 15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#dc3545' }}
                        >
                            <iconify-icon icon="mdi:trash-can-outline" style={{ fontSize: '18px' }}></iconify-icon>
                            ลบโปรเจกต์
                        </div>
                    </div>
                )}

                {/* 👇 แก้ไขไอคอนแสดงโลโก้ตรงนี้ (ล็อกขนาด width/height ให้ตายตัว) 👇 */}
                <div 
                  className="proj-icon" 
                  style={{ 
                    width: '80px', 
                    height: '80px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    overflow: 'hidden', 
                    borderRadius: '16px',
                    background: proj.image_logo ? 'transparent' : '#f9f9f9'
                  }}
                >
                  {proj.image_logo ? (
                    <img 
                      src={`http://localhost:3000${proj.image_logo}`} 
                      alt="Project Logo" 
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                    />
                  ) : (
                    <iconify-icon icon="solar:folder-with-files-bold-duotone"></iconify-icon>
                  )}
                </div>

                <h3>{proj.project_name || 'โปรเจกต์ยังไม่ได้ตั้งชื่อ'}</h3>
                <div style={{ width: '100%', padding: '0 15px', marginTop: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', color: '#888' }}>ความสำเร็จ</span>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: (completions[proj.project_id] || 0) >= 75 ? '#4CAF50' : '#d75a2a' }}>
                      {completions[proj.project_id] || 0}%
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: '#f0f0f0', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${completions[proj.project_id] || 0}%`,
                      height: '100%',
                      background: (completions[proj.project_id] || 0) >= 75 ? '#4CAF50' : (completions[proj.project_id] || 0) >= 40 ? '#FF9800' : '#d75a2a',
                      borderRadius: '3px',
                      transition: 'width 0.8s ease-in-out'
                    }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="home">
          <h1>สร้างแบรนด์ของคุณให้โดดเด่นด้วยพลังของคุณ</h1>
          <p>เครื่องมือช่วยผู้ประกอบการคิดคอนเซปต์ ออกแบบโลโก้ และแพ็กเกจครบทุกขั้นตอนในที่เดียว — ง่าย เร็ว และมืออาชีพ</p>

          <div className="home-buttons">
            <button className="btn-create" onClick={handleCreateProjectDirectly}>เริ่มสร้างแบรนด์</button>
            <a href="#" className="btn-howto">วิธีการใช้งาน</a>
          </div>
          <img src={homeImg} alt="hero" className="home-image" />
        </section> 
      )} 

      {/* --- Sections อื่นๆ --- */}
      <section className="features">
        <h2>วันนี้คุณจะดีไซน์อะไร</h2>
        <p>สร้างเอกลักษณ์แบรนด์ที่สะท้อนตัวตนธุรกิจของคุณ ผ่านระบบ AI ให้คุณออกแบบทุกองค์ประกอบได้ตามใจ</p>
        <div className="feature-grid">
          <div className="card">
            <img src={img1} alt="dna" className="image" />
            <h3 className="title">Brand DNA</h3>
            <p className="desc">กำหนดเอกลักษณ์ของแบรนด์ของคุณ</p>
            <button className="card-btn" onClick={() => navigate('/project')}>เริ่มทำงาน</button>
          </div>
          <div className="card">
            <img src={img2} alt="concept" className="image" />
            <h3 className="title">Concept</h3>
            <p className="desc">สร้างชื่อ สี และแบบอักษร</p>
            <button className="card-btn" onClick={() => navigate('/project')}>เริ่มทำงาน</button>
          </div>
          <div className="card">
            <img src={img3} alt="create" className="image" />
            <h3 className="title">Create Picture</h3>
            <p className="desc">สร้างโลโก้ และบรรจุภัณฑ์</p>
            <button className="card-btn" onClick={() => navigate('/project')}>เริ่มทำงาน</button>
          </div>
          <div className="card">
            <img src={img4} alt="market" className="image" />
            <h3 className="title">Market Planning</h3>
            <p className="desc">การวางแผนกิจกรรมสำหรับคุณ</p>
            <button className="card-btn" onClick={() => navigate('/project')}>เริ่มทำงาน</button>
          </div>
        </div>
      </section>

      <section className="about">
        <div className="about-container">
          <div className="about-text">
            <h3 className="about-title">About Us</h3>
            <h2 className="about-heading">เพิ่มศักยภาพให้กับผู้ประกอบการท้องถิ่นด้วย AI</h2>
            <p className="about-desc">
              ผู้ผลิตในชุมชนไม่สามารถจ่ายค่าที่ปรึกษาทางการตลาดที่มีราคาแพงได้ แพลตฟอร์มของเราใช้ประโยชน์จาก AI เพื่อช่วยแบรนด์และการขาย ทำให้ผลิตภัณฑ์ในท้องถิ่นเป็นที่รู้จักมากขึ้น
            </p>
          </div>
          <div className="about-image"><img src={womenImg} alt="about" /></div>
        </div>
      </section>

      <section className="steps">
        <h2 className="steps-title">How it Works: <span>สร้างแบรนด์ของคุณให้โดดเด่นตามขั้นตอน</span></h2>
        <div className="steps-grid">
          <div className={`step-card ${activeCard === 1 ? 'active' : ''}`} onClick={() => handleCardClick(1)}>
            <iconify-icon icon="mdi:lightbulb-on-outline" className="how-icon"></iconify-icon>
            <h3>Brand DNA</h3><p>กำหนดเอกลักษณ์ของแบรนด์ของคุณ</p><div className="step-number">1</div>
            <a href="#" className="btn-get" onClick={(e) => { e.preventDefault(); navigate('/project'); }}>Get Started</a>
          </div>
          <div className={`step-card ${activeCard === 2 ? 'active' : ''}`} onClick={() => handleCardClick(2)}>
            <iconify-icon icon="mdi:pencil-outline" className="how-icon"></iconify-icon>
            <h3>Concept</h3><p>สร้างชื่อ สี และแบบอักษร</p><div className="step-number">2</div>
            <a href="#" className="btn-get" onClick={(e) => { e.preventDefault(); navigate('/project'); }}>Get Started</a>
          </div>
          <div className={`step-card ${activeCard === 3 ? 'active' : ''}`} onClick={() => handleCardClick(3)}>
            <iconify-icon icon="mdi:image-outline" className="how-icon"></iconify-icon>
            <h3>Create Picture</h3><p>สร้างโลโก้ และบรรจุภัณฑ์</p><div className="step-number">3</div>
            <a href="#" className="btn-get" onClick={(e) => { e.preventDefault(); navigate('/project'); }}>Get Started</a>
          </div>
          <div className={`step-card ${activeCard === 4 ? 'active' : ''}`} onClick={() => handleCardClick(4)}>
            <iconify-icon icon="mdi:rocket-launch-outline" className="how-icon"></iconify-icon>
            <h3>OUTPUT</h3><p>สร้างแบรนด์ของคุณ วางแผนการตลาด</p><div className="step-number">4</div>
            <a href="#" className="btn-get" onClick={(e) => { e.preventDefault(); navigate('/project'); }}>Get Started</a>
          </div>
        </div>
      </section>

      <section className="gallery">
        <div className="gallery-wrapper">
          <img src={emptyImg} alt="gallery-1" /><img src={emptyImg} alt="gallery-2" /><img src={emptyImg} alt="gallery-3" /><img src={emptyImg} alt="gallery-4" />
          <img src={emptyImg} alt="gallery-5" /><img src={emptyImg} alt="gallery-6" /><img src={emptyImg} alt="gallery-7" /><img src={emptyImg} alt="gallery-8" />
        </div>
      </section>

      <footer className="footer">
        <div className="footer-container">
          <div className="footer-col">
            <img src={logoImg} alt="Logo" className="footer-logo" />
            <p>เครื่องมือช่วยผู้ประกอบการคิดคอนเซปต์ ออกแบบโลโก้ และแพ็กเกจครบทุกขั้นตอนในที่เดียว — ง่าย เร็ว และมืออาชีพ</p>
            <div className="socials"><a href="#"><iconify-icon icon="ic:baseline-facebook"></iconify-icon></a><a href="#">t</a><a href="#">ig</a><a href="#">yt</a></div>
          </div>
          <div className="footer-col"><h4>Company</h4><a href="#">FAQs</a><a href="#">About Us</a><a href="#">Contact Us</a></div>
          <div className="footer-col"><h4>Contact</h4><p>+66 00 000 0000</p><p>brabrbra@gmail.com</p><p>Social Media</p></div>
          <div className="footer-col">
            <h4>Get the latest information</h4>
            <div className="subscribe"><input type="email" placeholder="Email address" /><button>OK</button></div>
          </div>
        </div>
      </footer>

      {/* 👇 Popup สำหรับเปลี่ยนชื่อโปรเจกต์ 👇 */}
      {showEditPopup && (
        <div className="popup-overlay" style={popupOverlayStyle} onClick={() => setShowEditPopup(false)}>
          <div className="popup-content" style={popupContentStyle} onClick={e => e.stopPropagation()}>
            <h2 style={{ color: '#d75a2a', marginBottom: '15px' }}>แก้ไขชื่อโปรเจกต์</h2>
            <form onSubmit={handleSaveEditName}>
              <input 
                type="text" 
                placeholder="พิมพ์ชื่อโปรเจกต์ที่นี่..." 
                value={editProjectName}
                onChange={(e) => setEditProjectName(e.target.value)}
                required
                style={{ width: '100%', padding: '12px', marginBottom: '20px', borderRadius: '10px', border: '1px solid #ccc', fontSize: '16px' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowEditPopup(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: '#eee', color: '#333' }}>ยกเลิก</button>
                <button type="submit" style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: '#d3542b', color: '#fff', fontWeight: 'bold' }}>บันทึก</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// สไตล์ Popup
const popupOverlayStyle = {
  position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
  backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(3px)'
};
const popupContentStyle = {
  backgroundColor: 'white', padding: '30px', borderRadius: '16px', width: '90%', maxWidth: '400px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
};

export default Home;