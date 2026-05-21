import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Profile.css';

// อิมพอร์ตรูปภาพ
import logoImg from './assets/logo.png';

export const Profile = ({ user, setUser }) => {
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  const [userData, setUserData] = useState({});
  const [projects, setProjects] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, message: 'ยินดีต้อนรับสู่ Punthai!', time: 'เมื่อสักครู่', read: false },
    { id: 2, message: 'โปรเจกต์ของคุณถูกสร้างสำเร็จ', time: '5 นาทีที่แล้ว', read: false },
    { id: 3, message: 'อัปเดตระบบใหม่พร้อมใช้งาน', time: '1 ชั่วโมงที่แล้ว', read: true },
  ]);

  // ดึงข้อมูล User และ Projects
  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    // ลำดับความสำคัญ: Props > LocalStorage
    const currentUser = user || (storedUser.user_id ? storedUser : null);

    if (!currentUser) {
      navigate('/');
    } else {
      setUserData(currentUser);
      
      // ดึงข้อมูลโปรเจกต์
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

  // 🟢 ฟังก์ชันช่วยเช็ค URL รูปโปรไฟล์ (ใช้ซ้ำได้หลายจุด)
  const getProfileImage = (imagePath) => {
    if (!imagePath || imagePath === 'null') return null;
    return imagePath.startsWith('http')
      ? imagePath
      : `http://localhost:3000/uploads/${imagePath}`;
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    if (setUser) setUser(null);
    navigate('/');
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  return (
    <>
      {/* ===== PF-NAVBAR (Header) ===== */}
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
          <div className="pf-notif-wrapper">
            <button className="pf-btn-world pf-notif-btn" onClick={() => setShowNotifications(!showNotifications)}>
              <iconify-icon icon="ph:bell-ringing-light"></iconify-icon>
              {unreadCount > 0 && <span className="pf-notif-badge">{unreadCount}</span>}
            </button>
            {showNotifications && (
              <div className="pf-notif-dropdown">
                <div className="pf-notif-header">
                  <span className="pf-notif-title">การแจ้งเตือน</span>
                  {unreadCount > 0 && (
                    <button className="pf-notif-mark-read" onClick={markAllRead}>อ่านทั้งหมด</button>
                  )}
                </div>
                <div className="pf-notif-list">
                  {notifications.map(notif => (
                    <div key={notif.id} className={`pf-notif-item ${!notif.read ? 'pf-notif-unread' : ''}`}>
                      <div className="pf-notif-dot-wrap">
                        {!notif.read && <span className="pf-notif-dot"></span>}
                      </div>
                      <div className="pf-notif-content">
                        <p className="pf-notif-msg">{notif.message}</p>
                        <span className="pf-notif-time">{notif.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button className="pf-btn-users" style={{ overflow: 'hidden', padding: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {getProfileImage(userData.image_profile) ? (
                <img 
                    src={getProfileImage(userData.image_profile)} 
                    alt="User" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
            ) : (
                <iconify-icon icon="solar:user-linear"></iconify-icon>
            )}
          </button>
        </div>
      </header>

      <div className="pf-container">
        {/* ===== SIDEBAR ===== */}
        <button 
          className="pf-toggle-btn" 
          onClick={toggleSidebar}
          style={{ left: isSidebarCollapsed ? 'calc(80px - 17px)' : 'calc(240px - 17px)' }}
        >
          {isSidebarCollapsed ? '❯' : '❮'}
        </button>

        <aside className={`pf-sidebar ${isSidebarCollapsed ? 'pf-collapsed' : ''}`}>
          <ul className="pf-menu">
            <li className="pf-active">
              <span className="pf-icon"><iconify-icon icon="solar:user-linear"></iconify-icon></span>
              <span className="pf-text">Profile</span>
            </li>
            
            <li onClick={() => navigate('/settings')} style={{ cursor: 'pointer' }}>
              <span className="pf-icon"><iconify-icon icon="mdi:cog-outline"></iconify-icon></span>
              <span className="pf-text">Settings</span>
            </li>
          </ul>
          <div className="pf-sidebar-logout">
            <button className="pf-btn-logout" onClick={handleLogout}>
              <iconify-icon icon="solar:logout-2-linear"></iconify-icon>
              <span className="pf-text">ออกจากระบบ</span>
            </button>
          </div>
        </aside>

        {/* ===== Main Content ===== */}
        <main className="pf-main">
          
          {/* Profile Bar */}
          <div className="pf-profile-bar">
            {/* 🟢 แก้ไข Avatar วงกลมใหญ่ให้รองรับ Google 🟢 */}
            <div className="pf-avatar" id="pf-avatarCircle" style={{ overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#eee' }}>
              {getProfileImage(userData.image_profile) ? (
                  <img 
                      src={getProfileImage(userData.image_profile)} 
                      alt="Profile" 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                          e.target.onerror = null; 
                          e.target.src = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
                      }}
                  />
              ) : (
                  <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#666' }}>
                    {userData.user_name ? userData.user_name.substring(0, 2).toUpperCase() : 'PT'}
                  </span>
              )}
            </div>

            <div className="pf-profile-info">
              <div className="pf-username">
                {userData.user_name || 'กำลังโหลด...'}
                <span style={{ 
                    fontSize: '12px', 
                    background: userData.subscription_status === 'PRO' ? 'linear-gradient(45deg, #FFD700, #FFA500)' : '#eee', 
                    color: userData.subscription_status === 'PRO' ? '#000' : '#666', 
                    padding: '2px 8px', 
                    borderRadius: '12px', 
                    marginLeft: '8px'
                }}>
                  {userData.subscription_status || 'STANDARD'}
                </span>
              </div>
              <div className="pf-profile-sub">{userData.email}</div>
            </div>
            
            <div className="pf-profile-actions">
              <button className="pf-btn-primary" onClick={() => navigate('/settings', { state: { editProfile: true } })}>
                <iconify-icon icon="mdi:account-edit-outline"></iconify-icon>
                Edit Profile
              </button>
            </div>
          </div>

          {/* ส่วนอื่นๆ ของโปรเจกต์คงเดิม... */}
          <div className="pf-stats-row">
            <div className="pf-stat-card">
              <div className="pf-stat-icon-wrap pf-orange">
                <iconify-icon icon="mdi:folder-multiple-outline"></iconify-icon>
              </div>
              <div className="pf-stat-num pf-orange">{projects.length}</div>
              <div className="pf-stat-label">total projects</div>
            </div>
          </div>

          <div className="pf-section-header">
            <h2 className="pf-section-title">My Projects</h2>
          </div>

          <div className="pf-projects-grid">
            {projects.map(proj => (
              <div 
                key={proj.project_id} 
                className="pf-home-card" 
                onClick={() => navigate('/project', { state: { projectId: proj.project_id } })}
              >
                <div className="pf-home-card-icon">
                  {proj.image_logo ? (
                    <img src={`http://localhost:3000${proj.image_logo}`} alt="Logo" className="pf-home-logo-img" />
                  ) : (
                    <iconify-icon icon="solar:folder-with-files-bold-duotone"></iconify-icon>
                  )}
                </div>
                <h3>{proj.project_name || 'โปรเจกต์ยังไม่ได้ตั้งชื่อ'}</h3>
              </div>
            ))}

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