import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Profile.css';

// อิมพอร์ตรูปภาพ
import logoImg from './assets/logo.png';
import { API_URL } from './config';

export const Profile = ({ user, setUser }) => {
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  const [userData, setUserData] = useState({});
  const [projects, setProjects] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [completions, setCompletions] = useState({});

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
      fetch(`${API_URL}/api/projects/${currentUser.user_id}`)
        .then(res => res.json())
        .then(data => {
          if (data.status === 'success') {
            setProjects(data.projects);
          }
        })
        .catch(err => console.error("Fetch projects error:", err));

      // ดึง completion %
      fetch(`${API_URL}/api/users/${currentUser.user_id}/completions`)
        .then(res => res.json())
        .then(data => {
          if (data.status === 'success') {
            const map = {};
            data.projects.forEach(p => { map[p.project_id] = p.percentage; });
            setCompletions(map);
          }
        })
        .catch(err => console.error("Fetch completions error:", err));

      // ดึง notifications จริงจาก API
      fetch(`${API_URL}/api/user/notifications/${currentUser.user_id}`)
        .then(res => res.json())
        .then(data => {
          if (data.status === 'success') {
            setNotifications(data.data.map(n => ({
              id: n.id,
              title: n.title,
              message: n.message,
              time: formatTimeAgo(n.created_at),
              read: n.is_read === 1,
            })));
          }
        })
        .catch(err => console.error("Fetch notifications error:", err));
    }
  }, [user, navigate]);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const handleCreateProjectDirectly = async (e) => {
    if (e) e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/projects`, {
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
      : `${API_URL}/uploads/${imagePath}`;
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    if (setUser) setUser(null);
    navigate('/');
  };

  const formatTimeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'เมื่อสักครู่';
    if (mins < 60) return `${mins} นาทีที่แล้ว`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
    const days = Math.floor(hours / 24);
    return `${days} วันที่แล้ว`;
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = async () => {
    if (!userData.user_id) return;
    try {
      await fetch(`${API_URL}/api/user/notifications/${userData.user_id}/read-all`, { method: 'PUT' });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error("Mark all read error:", err);
    }
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
                  {notifications.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#999', fontSize: 14 }}>
                      ไม่มีการแจ้งเตือน
                    </div>
                  ) : (
                    notifications.map(notif => (
                      <div key={notif.id} className={`pf-notif-item ${!notif.read ? 'pf-notif-unread' : ''}`}
                        onClick={() => {
                          if (!notif.read) {
                            fetch(`${API_URL}/api/user/notifications/${notif.id}/read`, { method: 'PUT' });
                            setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
                          }
                        }}
                        style={{ cursor: !notif.read ? 'pointer' : 'default' }}
                      >
                        <div className="pf-notif-dot-wrap">
                          {!notif.read && <span className="pf-notif-dot"></span>}
                        </div>
                        <div className="pf-notif-content">
                          <p className="pf-notif-msg" style={{ fontWeight: !notif.read ? 600 : 400 }}>{notif.title || notif.message}</p>
                          {notif.title && <p style={{ fontSize: 12, color: '#888', margin: '2px 0 0' }}>{notif.message}</p>}
                          <span className="pf-notif-time">{notif.time}</span>
                        </div>
                      </div>
                    ))
                  )}
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
            <div className="pf-stat-card">
              <div className="pf-stat-icon-wrap" style={{ background: '#e8f5e9' }}>
                <iconify-icon icon="mdi:chart-arc" style={{ color: '#4CAF50' }}></iconify-icon>
              </div>
              <div className="pf-stat-num" style={{ color: '#4CAF50' }}>
                {projects.length > 0 ? Math.round(Object.values(completions).reduce((a, b) => a + b, 0) / projects.length) : 0}%
              </div>
              <div className="pf-stat-label">avg completion</div>
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
                    <img src={`${API_URL}${proj.image_logo}`} alt="Logo" className="pf-home-logo-img" />
                  ) : (
                    <iconify-icon icon="solar:folder-with-files-bold-duotone"></iconify-icon>
                  )}
                </div>
                <h3>{proj.project_name || 'โปรเจกต์ยังไม่ได้ตั้งชื่อ'}</h3>
                <div style={{ width: '100%', padding: '0 10px', marginTop: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                    <span style={{ fontSize: '11px', color: '#aaa' }}>ความสำเร็จ</span>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: (completions[proj.project_id] || 0) >= 75 ? '#4CAF50' : '#d75a2a' }}>
                      {completions[proj.project_id] || 0}%
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '5px', background: '#f0f0f0', borderRadius: '3px', overflow: 'hidden' }}>
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