import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Profile.css';

// อิมพอร์ตรูปภาพ
import logoImg from './assets/logo.png';
import helpImg from './assets/help.png';

export const Profile = ({ user }) => {
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  const [userData, setUserData] = useState({});
  // 👇 1. สร้าง State สำหรับเก็บข้อมูลโปรเจกต์
  const [projects, setProjects] = useState([]);

  // ดึงข้อมูล User และ Projects
  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    const currentUser = user || (storedUser.user_id ? storedUser : null);

    if (!currentUser) {
      navigate('/');
    } else {
      setUserData(currentUser);
      
      // 👇 2. ดึงข้อมูลโปรเจกต์ของ User คนนี้ (API เรียงจากใหม่ไปเก่าให้แล้ว)
      fetch(`http://localhost:3000/api/projects/${currentUser.user_id}`)
        .then(res => res.json())
        .then(data => {
          if (data.status === 'success') {
            setProjects(data.projects);
          }
        })
        .catch(err => console.error("Fetch projects error:", err));
    }
  }, [user, navigate]);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  // 👇 3. ฟังก์ชันสร้างโปรเจกต์ใหม่ (เหมือนหน้า Home)
  const handleCreateProjectDirectly = async (e) => {
    if (e) e.preventDefault();
    try {
      const res = await fetch('http://localhost:3000/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userData.user_id })
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

  return (
    <>
      {/* ===== NAVBAR ===== */}
      <header className="pf-navbar">
        <div className="pf-logo">
            <Link to="/">
                <img src={logoImg} alt="logo" className="pf-logo-img" />
            </Link>
        </div>
        <div className="pf-nav-icons">
          <button className="pf-btn-world">
            <iconify-icon icon="iconamoon:search-light"></iconify-icon>
          </button>
          <button className="pf-btn-world">
            <iconify-icon icon="ph:bell-ringing-light"></iconify-icon>
          </button>
          <button className="pf-btn-users">
            <iconify-icon icon="solar:user-linear"></iconify-icon>
          </button>
        </div>
      </header>

      <div className="pf-container">
        {/* ===== SIDEBAR ===== */}
        <button 
          className="pf-toggle-btn" 
          id="pf-toggleBtn" 
          onClick={toggleSidebar}
          style={{ left: isSidebarCollapsed ? 'calc(80px - 17px)' : 'calc(240px - 17px)' }}
        >
          {isSidebarCollapsed ? '❯' : '❮'}
        </button>

        <aside className={`pf-sidebar ${isSidebarCollapsed ? 'pf-collapsed' : ''}`} id="pf-sidebar">
          <ul className="pf-menu">
            <li className="pf-active" style={{ cursor: 'pointer' }}>
              <span className="pf-icon"><iconify-icon icon="solar:user-linear"></iconify-icon></span>
              <span className="pf-text">Profile</span>
            </li>
            <li onClick={() => navigate('/brandbook')} style={{ cursor: 'pointer' }}>
              <span className="pf-icon"><iconify-icon icon="mdi:book-open-page-variant-outline"></iconify-icon></span>
              <span className="pf-text">Brandbook</span>
            </li>
            <li onClick={() => navigate('/settings')} style={{ cursor: 'pointer' }}>
              <span className="pf-icon"><iconify-icon icon="mdi:cog-outline"></iconify-icon></span>
              <span className="pf-text">Settings</span>
            </li>
          </ul>
          <div className="pf-help">
            <img src={helpImg} className="pf-help-img" alt="help" />
            <p className="pf-help-text">Having trouble?</p>
            <a href="#" className="pf-contact-link">Contact Us</a>
          </div>
        </aside>

        {/* ===== Main Content ===== */}
        <main className="pf-main">
          
          {/* Profile Bar */}
          <div className="pf-profile-bar">
            <div className="pf-avatar" id="pf-avatarCircle" style={{ overflow: 'hidden' }}>
              {userData.image_profile && userData.image_profile !== 'null' ? (
                  <img 
                      src={`http://localhost:3000/uploads/${userData.image_profile}`} 
                      alt="Profile" 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                          e.target.onerror = null; 
                          e.target.style.display = 'none'; 
                      }}
                  />
              ) : (
                  userData.user_name ? userData.user_name.substring(0, 2).toUpperCase() : 'PT'
              )}
            </div>

            <div className="pf-profile-info">
              <div className="pf-username">
                {userData.user_name || 'กำลังโหลด...'}
                {/* 👇 ป้ายโชว์สถานะในหน้า Profile 👇 */}
                <span style={{ 
                    fontSize: '12px', 
                    background: userData.subscription_status === 'PRO' ? 'linear-gradient(45deg, #FFD700, #FFA500)' : '#eee', 
                    color: userData.subscription_status === 'PRO' ? '#000' : '#666', 
                    padding: '2px 8px', 
                    borderRadius: '12px', 
                    marginLeft: '8px',
                    boxShadow: userData.subscription_status === 'PRO' ? '0 2px 10px rgba(255, 165, 0, 0.4)' : 'none'
                }}>
                  {userData.subscription_status || 'STANDARD'}
                </span>
                
                <button className="pf-edit-inline-btn" aria-label="Edit username" style={{ marginLeft: '5px' }}>
                  <iconify-icon icon="mdi:pencil-outline"></iconify-icon>
                </button>
              </div>
              <div className="pf-profile-sub">{userData.email || 'Travel & Brand Creator · Bangkok, TH'}</div>
            </div>
            
            <div className="pf-profile-actions">
              <button className="pf-btn-primary" onClick={() => navigate('/edit_profile')}>
                <iconify-icon icon="mdi:account-edit-outline"></iconify-icon>
                Edit Profile
              </button>
              <button className="pf-btn-secondary" onClick={() => navigate('/settings')}>
                <iconify-icon icon="mdi:cog-outline"></iconify-icon>
                Settings
              </button>
            </div>
          </div>

          {/* Stats Row */}
          <div className="pf-stats-row">
            <div className="pf-stat-card">
              <div className="pf-stat-icon-wrap pf-orange">
                <iconify-icon icon="mdi:folder-multiple-outline"></iconify-icon>
              </div>
              <div className="pf-stat-num pf-orange">{projects.length}</div>
              <div className="pf-stat-label">total projects</div>
            </div>
            <div className="pf-stat-card">
              <div className="pf-stat-icon-wrap pf-green">
                <iconify-icon icon="mdi:check-circle-outline"></iconify-icon>
              </div>
              <div className="pf-stat-num pf-green">0</div>
              <div className="pf-stat-label">completed</div>
            </div>
          </div>

          {/* Projects Section */}
          <div className="pf-section-header">
            <h2 className="pf-section-title">My Projects</h2>
            <button className="pf-see-all-btn" onClick={() => navigate('/your-projects')}>see all →</button>
          </div>

          <div className="pf-projects-grid">
            
            {/* 👇 4. โชว์การ์ดโปรเจกต์จาก Database แทน Mockup (แบบหน้า Home) 👇 */}
            {projects.map(proj => (
              <div 
                key={proj.project_id} 
                className="pf-home-card" 
                onClick={() => navigate('/project', { state: { projectId: proj.project_id } })}
              >
                <div className="pf-home-card-icon">
                  {/* เช็คว่ามีรูปโลโก้ไหม ถ้ามีโชว์โลโก้ ถ้าไม่มีโชว์ไอคอนแฟ้ม */}
                  {proj.image_logo ? (
                    <img src={`http://localhost:3000${proj.image_logo}`} alt="Logo" className="pf-home-logo-img" />
                  ) : (
                    <iconify-icon icon="solar:folder-with-files-bold-duotone"></iconify-icon>
                  )}
                </div>
                <h3>{proj.project_name || 'โปรเจกต์ยังไม่ได้ตั้งชื่อ'}</h3>
                <span className={`pf-status-badge ${proj.status === 'ยังไม่ได้เริ่ม' ? 'pending' : 'active'}`}>
                  {proj.status || 'ยังไม่ได้เริ่ม'}
                </span>
              </div>
            ))}

            {/* 👇 5. ปุ่มสร้างโปรเจกต์ใหม่ เอาไว้ต่อท้ายสุดเสมอ 👇 */}
            <div className="pf-home-card pf-create-new" onClick={handleCreateProjectDirectly}>
              <iconify-icon icon="line-md:plus-circle" style={{ fontSize: '50px', color: '#d75a2a' }}></iconify-icon>
              <span style={{ color: '#d75a2a', fontWeight: 'bold', marginTop: '10px' }}>สร้างแบรนด์ใหม่</span>
            </div>

          </div>
        </main>
      </div>
    </>
  );
};