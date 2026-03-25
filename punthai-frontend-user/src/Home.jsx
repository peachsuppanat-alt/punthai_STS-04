import React, { useState , useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // 1. Import useNavigate เข้ามา
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
  
  // 2. ประกาศตัวแปร navigate เพื่อใช้สำหรับเปลี่ยนหน้า
  const [projects, setProjects] = useState([]);
  const [showPopup, setShowPopup] = useState(false);
  const [projectName, setProjectName] = useState('');

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
    } else {
      setProjects([]); // ถ้าล็อกเอาต์ให้เคลียร์โปรเจกต์ทิ้ง
    }
  }, [user]);

  const handleStartClick = () => {
    if (!user) {
      alert("กรุณาเข้าสู่ระบบก่อนสร้างแบรนด์!");
      return;
    }
    setShowPopup(true); // เปิด Popup
  };
  const handleCreateProject = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:3000/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.user_id, name_concept: projectName })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setShowPopup(false);
        setProjectName('');
        // นำทางไปหน้า MyProject (อาจจะใช้ ID แนบไปด้วยในอนาคต เช่น /project/1)
        navigate('/project', { state: { projectId: data.project_id } }); 
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
    <>
      {/* 🚨 สลับเฉพาะส่วนบนสุด: ถ้าล็อกอินแล้วให้โชว์ Dashboard ถ้ายังไม่ล็อกอินให้โชว์ Hero Section */}
      {user ? (
        <section className="user-projects-dashboard">
          <div className="dashboard-header">
            <h2>ยินดีต้อนรับกลับมา, {user.user_name} 👋</h2>
            <p>เลือกโปรเจกต์ที่คุณต้องการทำต่อ หรือสร้างแบรนด์ใหม่ได้เลย</p>
          </div>
          
          <div className="project-cards-container">
            {/* ปุ่มสร้างโปรเจกต์ใหม่ */}
            <div className="project-card create-new" onClick={() => setShowPopup(true)}>
              <iconify-icon icon="line-md:plus-circle" style={{ fontSize: '50px' }}></iconify-icon>
              <span>สร้างแบรนด์ใหม่</span>
            </div>

            {/* แสดงการ์ดโปรเจกต์ */}
            {projects.map(proj => (
              <div key={proj.project_id} className="project-card" onClick={() => navigate('/project', { state: { projectId: proj.project_id } })}>
                <div className="proj-icon">
                  <iconify-icon icon="solar:folder-with-files-bold-duotone"></iconify-icon>
                </div>
                <h3>{proj.name_concept}</h3>
                <span className={`status-badge ${proj.status === 'ยังไม่ได้เริ่ม' ? 'pending' : 'active'}`}>
                  {proj.status || 'ยังไม่ได้เริ่ม'}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : (
        /* --- Hero Section (แสดงเมื่อยังไม่ล็อกอิน) --- */
        <section className="home">
          <h1>สร้างแบรนด์ของคุณให้โดดเด่นด้วยพลังของคุณ</h1>
          <p>เครื่องมือช่วยผู้ประกอบการคิดคอนเซปต์ ออกแบบโลโก้ และแพ็กเกจครบทุกขั้นตอนในที่เดียว — ง่าย เร็ว และมืออาชีพ</p>

          <div className="home-buttons">
            <button className="btn-create" onClick={handleStartClick}>เริ่มสร้างแบรนด์</button>
            <a href="#" className="btn-howto">วิธีการใช้งาน</a>
          </div>
          <img src={homeImg} alt="hero" className="home-image" />
        </section> 
      )} 
      {/* 🔼 ปิดเงื่อนไข Ternary ตรงนี้ 🔼 */}

      {/* 👇 ส่วนด้านล่างนี้ เอาไว้นอกเงื่อนไข เพื่อให้แสดงเสมอไม่ว่าจะล็อกอินหรือไม่ */}

      {/* --- Features Section --- */}
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

      {/* --- About Section --- */}
      <section className="about">
        <div className="about-container">
          <div className="about-text">
            <h3 className="about-title">About Us</h3>
            <h2 className="about-heading">เพิ่มศักยภาพให้กับผู้ประกอบการท้องถิ่นด้วย AI</h2>
            <p className="about-desc">
              ผู้ผลิตในชุมชนไม่สามารถจ่ายค่าที่ปรึกษาทางการตลาดที่มีราคาแพงได้ แพลตฟอร์มของเราใช้ประโยชน์จาก AI เพื่อช่วยแบรนด์และการขาย ทำให้ผลิตภัณฑ์ในท้องถิ่นเป็นที่รู้จักมากขึ้น
            </p>
          </div>
          <div className="about-image">
            <img src={womenImg} alt="about" />
          </div>
        </div>
      </section>

      {/* --- Steps Section --- */}
      <section className="steps">
        <h2 className="steps-title">
          How it Works: <span>สร้างแบรนด์ของคุณให้โดดเด่นตามขั้นตอน</span>
        </h2>

        <div className="steps-grid">
          <div className={`step-card ${activeCard === 1 ? 'active' : ''}`} onClick={() => handleCardClick(1)}>
            <iconify-icon icon="mdi:lightbulb-on-outline" className="how-icon"></iconify-icon>
            <h3>Brand DNA</h3>
            <p>กำหนดเอกลักษณ์ของแบรนด์ของคุณ</p>
            <div className="step-number">1</div>
            <a href="#" className="btn-get" onClick={(e) => { e.preventDefault(); navigate('/project'); }}>Get Started</a>
          </div>

          <div className={`step-card ${activeCard === 2 ? 'active' : ''}`} onClick={() => handleCardClick(2)}>
            <iconify-icon icon="mdi:pencil-outline" className="how-icon"></iconify-icon>
            <h3>Concept</h3>
            <p>สร้างชื่อ สี และแบบอักษร</p>
            <div className="step-number">2</div>
            <a href="#" className="btn-get" onClick={(e) => { e.preventDefault(); navigate('/project'); }}>Get Started</a>
          </div>

          <div className={`step-card ${activeCard === 3 ? 'active' : ''}`} onClick={() => handleCardClick(3)}>
            <iconify-icon icon="mdi:image-outline" className="how-icon"></iconify-icon>
            <h3>Create Picture</h3>
            <p>สร้างโลโก้ และบรรจุภัณฑ์</p>
            <div className="step-number">3</div>
            <a href="#" className="btn-get" onClick={(e) => { e.preventDefault(); navigate('/project'); }}>Get Started</a>
          </div>

          <div className={`step-card ${activeCard === 4 ? 'active' : ''}`} onClick={() => handleCardClick(4)}>
            <iconify-icon icon="mdi:rocket-launch-outline" className="how-icon"></iconify-icon>
            <h3>OUTPUT</h3>
            <p>สร้างแบรนด์ของคุณ วางแผนการตลาด</p>
            <div className="step-number">4</div>
            <a href="#" className="btn-get" onClick={(e) => { e.preventDefault(); navigate('/project'); }}>Get Started</a>
          </div>
        </div>
      </section>

      {/* --- Gallery Section --- */}
      <section className="gallery">
        <div className="gallery-wrapper">
          <img src={emptyImg} alt="gallery-1" />
          <img src={emptyImg} alt="gallery-2" />
          <img src={emptyImg} alt="gallery-3" />
          <img src={emptyImg} alt="gallery-4" />
          <img src={emptyImg} alt="gallery-5" />
          <img src={emptyImg} alt="gallery-6" />
          <img src={emptyImg} alt="gallery-7" />
          <img src={emptyImg} alt="gallery-8" />
        </div>
      </section>

      {/* --- Footer --- */}
      <footer className="footer">
        <div className="footer-container">
          
          <div className="footer-col">
            <img src={logoImg} alt="Logo" className="footer-logo" />
            <p>
              เครื่องมือช่วยผู้ประกอบการคิดคอนเซปต์ ออกแบบโลโก้ และแพ็กเกจครบทุกขั้นตอนในที่เดียว — ง่าย เร็ว และมืออาชีพ
            </p>
            <div className="socials">
              <a href="#"><iconify-icon icon="ic:baseline-facebook"></iconify-icon></a>
              <a href="#">t</a>
              <a href="#">ig</a>
              <a href="#">yt</a>
            </div>
          </div>

          <div className="footer-col">
            <h4>Company</h4>
            <a href="#">FAQs</a>
            <a href="#">About Us</a>
            <a href="#">Contact Us</a>
          </div>

          <div className="footer-col">
            <h4>Contact</h4>
            <p>+66 00 000 0000</p>
            <p>brabrbra@gmail.com</p>
            <p>Social Media</p>
          </div>

          <div className="footer-col">
            <h4>Get the latest information</h4>
            <div className="subscribe">
              <input type="email" placeholder="Email address" />
              <button>OK</button>
            </div>
          </div>

        </div>
      </footer>

      {/* Popup Overlay ย้ายมาอยู่ล่างสุด */}
      {showPopup && (
        <div className="popup-overlay" style={popupOverlayStyle}>
          <div className="popup-content" style={popupContentStyle}>
            <h2>สร้างแบรนด์ใหม่</h2>
            <form onSubmit={handleCreateProject}>
              <input 
                type="text" 
                placeholder="ชื่อแบรนด์ / คอนเซปต์" 
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                required
                style={{ width: '100%', padding: '10px', margin: '15px 0' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowPopup(false)}>ยกเลิก</button>
                <button type="submit">สร้าง</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

// สไตล์ชั่วคราวสำหรับ Popup (คุณสามารถย้ายไปใส่ใน Home.css ได้)
const popupOverlayStyle = {
  position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
  backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
};
const popupContentStyle = {
  backgroundColor: 'white', padding: '20px', borderRadius: '8px', width: '90%', maxWidth: '400px', color: '#333'
};

export default Home;