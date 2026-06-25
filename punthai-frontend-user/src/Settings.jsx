import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { fetchSubscriptionStatus } from './utils/subscriptionGuard';
import './Settings.css';

import logoImg from './assets/logo.png';

const OMISE_PUBLIC_KEY = 'pkey_test_67qqeg96mv9vq9d7jxg';

export const Settings = ({ user, setUser }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [userData, setUserData] = useState({});
  const [subStatus, setSubStatus] = useState(null);
  const [activeSection, setActiveSection] = useState('account');
  const [showEditForm, setShowEditForm] = useState(false);

  // Edit profile form states
  const [formData, setFormData] = useState({
    first_name: '', last_name: '', user_name: '', email: '',
    password: '', confirm_password: ''
  });
  const [newImageFile, setNewImageFile] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [alertMsg, setAlertMsg] = useState({ type: '', text: '' });

  // Notification settings
  const [notifications, setNotifications] = useState({
    emailUpdates: true,
    projectAlerts: true,
    promotions: false,
    newsletter: true,
  });

  // Privacy settings
  const [privacy, setPrivacy] = useState({
    profilePublic: false,
    showEmail: false,
    showProjects: true,
  });

  // Display settings
  const [display, setDisplay] = useState({
    language: 'th',
    theme: 'light',
  });


  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    const currentUser = user || (storedUser.user_id ? storedUser : null);
    if (!currentUser) {
      navigate('/');
    } else {
      setUserData(currentUser);
      setFormData({
        first_name: currentUser.first_name || '',
        last_name: currentUser.last_name || '',
        user_name: currentUser.user_name || '',
        email: currentUser.email || '',
        password: '', confirm_password: ''
      });
      fetchSubscriptionStatus(currentUser.user_id).then(setSubStatus);
    }
  }, [user, navigate]);

  // Open edit form if navigated with editProfile state
  useEffect(() => {
    if (location.state?.editProfile) {
      setActiveSection('account');
      setShowEditForm(true);
      // Clear the state so refreshing doesn't re-trigger
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    if (typeof window.OmiseCard !== 'undefined') {
      window.OmiseCard.configure({
        publicKey: OMISE_PUBLIC_KEY,
        currency: 'THB',
        frameLabel: 'Punthai - เปลี่ยนบัตร',
        submitLabel: 'บันทึกบัตรใหม่',
        buttonLabel: 'บันทึกบัตรใหม่',
      });
    }
  }, []);

  const toggleSidebar = () => setIsSidebarCollapsed(!isSidebarCollapsed);

  const getProfileImage = (imagePath) => {
    if (!imagePath || imagePath === 'null') return null;
    return imagePath.startsWith('http') ? imagePath : `http://localhost:3000/uploads/${imagePath}`;
  };

  const isPro = userData.subscription_status === 'PRO' && subStatus?.subscription_status === 'PRO';

  const handleChangeCard = () => {
    if (typeof window.OmiseCard === 'undefined') {
      alert('ไม่สามารถโหลด Omise ได้ กรุณารีเฟรชหน้าเว็บ');
      return;
    }
    window.OmiseCard.open({
      amount: 0,
      onCreateTokenSuccess: async (nonce) => {
        try {
          const res = await fetch('http://localhost:3000/api/subscription/update-card', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userData.user_id, token: nonce }),
          });
          const data = await res.json();
          if (data.status === 'success') {
            alert('เปลี่ยนบัตรสำเร็จ');
          } else {
            alert(data.message || 'เปลี่ยนบัตรไม่สำเร็จ');
          }
        } catch {
          alert('เชื่อมต่อ Server ไม่ได้');
        }
      },
    });
  };

  const handleSaveNotifications = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/users/settings/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userData.user_id, ...notifications }),
      });
      const data = await res.json();
      alert(data.status === 'success' ? 'บันทึกสำเร็จ' : 'เกิดข้อผิดพลาด');
    } catch {
      alert('บันทึกการตั้งค่าไว้ในเครื่องแล้ว');
    }
  };

  const handleSavePrivacy = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/users/settings/privacy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userData.user_id, ...privacy }),
      });
      const data = await res.json();
      alert(data.status === 'success' ? 'บันทึกสำเร็จ' : 'เกิดข้อผิดพลาด');
    } catch {
      alert('บันทึกการตั้งค่าไว้ในเครื่องแล้ว');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    if (setUser) setUser(null);
    navigate('/');
  };

  // ── Edit Profile Handlers ──
  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewImageFile(file);
      setPreviewImage(URL.createObjectURL(file));
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setAlertMsg({ type: '', text: '' });
    if (formData.password && formData.password !== formData.confirm_password) {
      return setAlertMsg({ type: 'error', text: 'รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน' });
    }
    try {
      const submitData = new FormData();
      submitData.append('first_name', formData.first_name);
      submitData.append('last_name', formData.last_name);
      submitData.append('user_name', formData.user_name);
      if (formData.password) submitData.append('password', formData.password);
      if (newImageFile) submitData.append('image_profile', newImageFile);

      const res = await fetch(`http://localhost:3000/api/users/profile/${userData.user_id}`, {
        method: 'PUT', body: submitData
      });
      const data = await res.json();
      if (data.status === 'success') {
        localStorage.setItem('user', JSON.stringify(data.user));
        if (setUser) setUser(data.user);
        setUserData(data.user);
        setFormData(prev => ({ ...prev, password: '', confirm_password: '' }));
        setAlertMsg({ type: 'success', text: 'บันทึกข้อมูลโปรไฟล์เรียบร้อยแล้ว' });
        setTimeout(() => setAlertMsg({ type: '', text: '' }), 3000);
      } else {
        setAlertMsg({ type: 'error', text: data.message });
      }
    } catch {
      setAlertMsg({ type: 'error', text: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้' });
    }
  };

  const displayImage = previewImage || getProfileImage(userData.image_profile);

  const sections = [
    { id: 'account', icon: 'solar:user-circle-linear', label: 'บัญชีผู้ใช้' },
    { id: 'subscription', icon: 'solar:crown-linear', label: 'การสมัครสมาชิก' },
    { id: 'notifications', icon: 'solar:bell-linear', label: 'การแจ้งเตือน' },
    { id: 'privacy', icon: 'solar:shield-check-linear', label: 'ความเป็นส่วนตัว' },
    { id: 'display', icon: 'solar:pallete-2-linear', label: 'การแสดงผล' },
  ];

  const sectionTitles = {
    account: { title: 'บัญชีผู้ใช้', desc: 'ข้อมูลที่แสดงต่อสาธารณะ กรุณาระวังข้อมูลที่คุณแชร์' },
    subscription: { title: 'การสมัครสมาชิก', desc: 'จัดการแผนสมาชิกและการชำระเงินของคุณ' },
    notifications: { title: 'การแจ้งเตือน', desc: 'เลือกประเภทการแจ้งเตือนที่ต้องการรับ' },
    privacy: { title: 'ความเป็นส่วนตัว', desc: 'ควบคุมการแสดงข้อมูลของคุณ' },
    display: { title: 'การแสดงผล', desc: 'ปรับแต่งภาษาและรูปแบบการแสดงผล' },
  };

  return (
    <>
      {/* NAVBAR */}
      <header className="st-navbar">
        <div className="st-logo">
          <Link to="/"><img src={logoImg} alt="logo" className="st-logo-img" /></Link>
        </div>
        <div className="st-nav-icons">
          <button className="st-btn-world">
            <iconify-icon icon="iconamoon:search-light"></iconify-icon>
          </button>
          <button className="st-btn-world st-notif-btn">
            <iconify-icon icon="ph:bell-ringing-light"></iconify-icon>
            <span className="st-notif-badge">3</span>
          </button>
          <button className="st-btn-users" style={{ overflow: 'hidden', padding: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {getProfileImage(userData.image_profile) ? (
              <img src={getProfileImage(userData.image_profile)} alt="User" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <iconify-icon icon="solar:user-linear"></iconify-icon>
            )}
          </button>
        </div>
      </header>

      <div className="st-container">
        {/* SIDEBAR */}
        <button
          className="st-toggle-btn"
          onClick={toggleSidebar}
          style={{ left: isSidebarCollapsed ? 'calc(80px - 17px)' : 'calc(240px - 17px)' }}
        >
          {isSidebarCollapsed ? '❯' : '❮'}
        </button>

        <aside className={`st-sidebar ${isSidebarCollapsed ? 'st-collapsed' : ''}`}>
          <ul className="st-menu">
            <li onClick={() => navigate('/profile')} style={{ cursor: 'pointer' }}>
              <span className="st-icon"><iconify-icon icon="solar:user-linear"></iconify-icon></span>
              <span className="st-text">Profile</span>
            </li>
            {(userData.role === 'printshop' || userData.account_type === 'printshop') && (
              <li onClick={() => navigate('/my-package')} style={{ cursor: 'pointer' }}>
                <span className="st-icon"><iconify-icon icon="mdi:package-variant-closed"></iconify-icon></span>
                <span className="st-text">My Package</span>
              </li>
            )}
            <li className="st-active">
              <span className="st-icon"><iconify-icon icon="mdi:cog-outline"></iconify-icon></span>
              <span className="st-text">Settings</span>
            </li>
          </ul>
          <div className="st-sidebar-logout">
            <button className="st-btn-logout" onClick={handleLogout}>
              <iconify-icon icon="solar:logout-2-linear"></iconify-icon>
              <span className="st-text">ออกจากระบบ</span>
            </button>
          </div>
        </aside>

        {/* MAIN */}
        <main className="st-main">
          <div className="st-main-inner">
            {/* Settings Navigation (middle column) */}
            <div className="st-settings-nav">
              <h2 className="st-settings-nav-title">ตั้งค่า</h2>
              <nav className="st-settings-nav-list">
                {sections.map(sec => (
                  <button
                    key={sec.id}
                    className={`st-nav-item ${activeSection === sec.id ? 'st-nav-item-active' : ''}`}
                    onClick={() => setActiveSection(sec.id)}
                  >
                    <iconify-icon icon={sec.icon} width="20"></iconify-icon>
                    <span>{sec.label}</span>
                  </button>
                ))}
              </nav>
            </div>

            {/* Content (right column) */}
            <div className="st-settings-content">
              <div className="st-content-header">
                <h1 className="st-content-title">{sectionTitles[activeSection]?.title}</h1>
                <p className="st-content-subtitle">{sectionTitles[activeSection]?.desc}</p>
              </div>

          {/* ==================== บัญชีผู้ใช้ ==================== */}
          {activeSection === 'account' && !showEditForm && (
            <div className="st-section">
              <div className="st-card">
                <div className="st-card-header">
                  <div className="st-card-icon st-icon-orange">
                    <iconify-icon icon="solar:user-circle-bold-duotone"></iconify-icon>
                  </div>
                  <div>
                    <h3 className="st-card-title">ข้อมูลบัญชี</h3>
                    <p className="st-card-desc">ข้อมูลพื้นฐานของบัญชีผู้ใช้</p>
                  </div>
                </div>
                <div className="st-card-body">
                  <div className="st-info-grid">
                    <div className="st-info-item">
                      <div className="st-info-icon"><iconify-icon icon="solar:user-linear"></iconify-icon></div>
                      <div className="st-info-content">
                        <span className="st-info-label">ชื่อผู้ใช้</span>
                        <span className="st-info-value">{userData.user_name || '-'}</span>
                      </div>
                    </div>
                    <div className="st-info-item">
                      <div className="st-info-icon"><iconify-icon icon="solar:letter-linear"></iconify-icon></div>
                      <div className="st-info-content">
                        <span className="st-info-label">อีเมล</span>
                        <span className="st-info-value">{userData.email || '-'}</span>
                      </div>
                    </div>
                    
                  </div>
                </div>
                <div className="st-card-footer">
                  <button className="st-btn-primary" onClick={() => setShowEditForm(true)}>
                    <iconify-icon icon="mdi:account-edit-outline"></iconify-icon>
                    แก้ไขโปรไฟล์
                  </button>
                </div>
              </div>

             

              {/* ลบบัญชี */}
              <div className="st-card st-card-danger">
                <div className="st-card-header">
                  <div className="st-card-icon st-icon-red">
                    <iconify-icon icon="solar:trash-bin-trash-bold-duotone"></iconify-icon>
                  </div>
                  <div>
                    <h3 className="st-card-title">ลบบัญชี</h3>
                    <p className="st-card-desc">ลบบัญชีผู้ใช้และข้อมูลทั้งหมดอย่างถาวร</p>
                  </div>
                </div>
                <div className="st-card-body">
                  <div className="st-danger-info">
                    <iconify-icon icon="solar:danger-triangle-linear"></iconify-icon>
                    <p>การดำเนินการนี้ไม่สามารถย้อนกลับได้ ข้อมูลทั้งหมดรวมถึงโปรเจกต์ รูปภาพ และการตั้งค่าจะถูกลบอย่างถาวร</p>
                  </div>
                </div>
                <div className="st-card-footer">
                  <button className="st-btn-danger" onClick={() => alert('กรุณาติดต่อทีมซัพพอร์ตเพื่อลบบัญชี')}>
                    <iconify-icon icon="solar:trash-bin-trash-linear"></iconify-icon>
                    ลบบัญชีของฉัน
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ==================== แก้ไขโปรไฟล์ (inline) ==================== */}
          {activeSection === 'account' && showEditForm && (
            <div className="st-section">
              <div className="st-edit-back-row">
                <button className="st-btn-back" onClick={() => { setShowEditForm(false); setAlertMsg({ type: '', text: '' }); setPreviewImage(null); setNewImageFile(null); }}>
                  <iconify-icon icon="solar:arrow-left-linear"></iconify-icon>
                  กลับ
                </button>
              </div>

              <div className="st-card">
                <div className="st-card-header">
                  <div className="st-card-icon st-icon-orange">
                    <iconify-icon icon="mdi:account-edit-outline"></iconify-icon>
                  </div>
                  <div>
                    <h3 className="st-card-title">แก้ไขโปรไฟล์</h3>
                    <p className="st-card-desc">อัปเดตข้อมูลส่วนตัวและรูปโปรไฟล์</p>
                  </div>
                </div>
                <div className="st-card-body">
                  {alertMsg.text && (
                    <div className={`st-alert ${alertMsg.type === 'success' ? 'st-alert-success' : 'st-alert-error'}`}>
                      <iconify-icon icon={alertMsg.type === 'success' ? 'mdi:check-circle-outline' : 'mdi:alert-circle-outline'} width="20"></iconify-icon>
                      <span>{alertMsg.text}</span>
                    </div>
                  )}

                  <form onSubmit={handleEditSubmit}>
                    {/* Avatar */}
                    <div className="st-edit-avatar">
                      <div className="st-edit-avatar-img">
                        {displayImage ? (
                          <img src={displayImage} alt="Profile" />
                        ) : (
                          <span className="st-edit-avatar-placeholder">
                            {formData.user_name ? formData.user_name.substring(0, 2).toUpperCase() : 'PT'}
                          </span>
                        )}
                        <label htmlFor="st-upload-photo" className="st-edit-avatar-overlay">
                          <iconify-icon icon="mdi:camera-outline" width="24" style={{ color: '#fff' }}></iconify-icon>
                        </label>
                        <input type="file" id="st-upload-photo" accept="image/*" style={{ display: 'none' }} onChange={handleImageSelect} />
                      </div>
                      <div className="st-edit-avatar-info">
                        <span className="st-edit-avatar-name">{userData.user_name || 'Profile Picture'}</span>
                        <label htmlFor="st-upload-photo" className="st-btn-upload">เปลี่ยนรูปโปรไฟล์</label>
                      </div>
                    </div>

                    <div className="st-edit-divider"></div>

                    {/* Personal Info */}
                    <h4 className="st-edit-section-title">ข้อมูลส่วนตัว</h4>
                    <div className="st-edit-row">
                      <div className="st-edit-field">
                        <label>ชื่อจริง</label>
                        <input type="text" name="first_name" value={formData.first_name} onChange={handleInputChange} placeholder="ชื่อจริง" />
                      </div>
                      <div className="st-edit-field">
                        <label>นามสกุล</label>
                        <input type="text" name="last_name" value={formData.last_name} onChange={handleInputChange} placeholder="นามสกุล" />
                      </div>
                    </div>
                    <div className="st-edit-row">
                      <div className="st-edit-field">
                        <label>ชื่อผู้ใช้ *</label>
                        <input type="text" name="user_name" value={formData.user_name} onChange={handleInputChange} required />
                      </div>
                      <div className="st-edit-field">
                        <label>อีเมล</label>
                        <input type="email" value={formData.email} disabled className="st-input-disabled" title="ไม่สามารถเปลี่ยนอีเมลได้" />
                      </div>
                    </div>

                    <div className="st-edit-divider"></div>

                    {/* Password */}
                    <h4 className="st-edit-section-title">เปลี่ยนรหัสผ่าน</h4>
                    <p className="st-edit-hint">หากไม่ต้องการเปลี่ยนรหัสผ่าน ให้เว้นว่างไว้</p>
                    <div className="st-edit-row">
                      <div className="st-edit-field">
                        <label>รหัสผ่านใหม่</label>
                        <input type="password" name="password" value={formData.password} onChange={handleInputChange} placeholder="รหัสผ่านใหม่" />
                      </div>
                      <div className="st-edit-field">
                        <label>ยืนยันรหัสผ่านใหม่</label>
                        <input type="password" name="confirm_password" value={formData.confirm_password} onChange={handleInputChange} placeholder="ยืนยันรหัสผ่านใหม่" />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="st-edit-actions">
                      <button type="button" className="st-btn-outline" onClick={() => { setShowEditForm(false); setAlertMsg({ type: '', text: '' }); setPreviewImage(null); setNewImageFile(null); }}>
                        ยกเลิก
                      </button>
                      <button type="submit" className="st-btn-primary">
                        <iconify-icon icon="mdi:content-save-outline"></iconify-icon>
                        บันทึกการเปลี่ยนแปลง
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* ==================== การสมัครสมาชิก ==================== */}
          {activeSection === 'subscription' && (
            <div className="st-section">
              {/* Current Plan */}
              <div className={`st-card ${isPro ? 'st-card-pro-glow' : ''}`}>
                <div className="st-card-header">
                  <div className={`st-card-icon ${isPro ? 'st-icon-pro' : 'st-icon-orange'}`}>
                    <iconify-icon icon={isPro ? 'solar:crown-bold' : 'solar:crown-linear'}></iconify-icon>
                  </div>
                  <div>
                    <h3 className="st-card-title">แผนปัจจุบัน</h3>
                    <p className="st-card-desc">รายละเอียดแผนสมาชิกของคุณ</p>
                  </div>
                  <span className={`st-plan-badge ${isPro ? 'st-badge-pro' : 'st-badge-std'}`}>
                    {isPro ? 'PRO' : 'STANDARD'}
                  </span>
                </div>
                <div className="st-card-body">
                  <div className="st-plan-details">
                    <div className="st-plan-row">
                      <span className="st-plan-label">แผนสมาชิก</span>
                      <span className="st-plan-value">{isPro ? 'Punthai Pro — 129 บาท/เดือน' : 'Punthai Standard — ฟรี'}</span>
                    </div>
                    {isPro && subStatus?.subscription_end_date && (
                      <div className="st-plan-row">
                        <span className="st-plan-label">รอบตัดเงินถัดไป</span>
                        <span className="st-plan-value">
                          {new Date(subStatus.subscription_end_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                      </div>
                    )}
                    {subStatus && (
                      <div className="st-plan-row">
                        <span className="st-plan-label">การใช้งาน AI</span>
                        <span className="st-plan-value">
                          {subStatus.generation_used}/{subStatus.generation_limit} ครั้ง
                          ({subStatus.generation_period === 'monthly' ? 'ต่อเดือน' : 'ตลอดอายุ'})
                        </span>
                      </div>
                    )}
                    {subStatus && (
                      <div className="st-usage-bar">
                        <div className="st-usage-track">
                          <div
                            className="st-usage-fill"
                            style={{ width: `${Math.min((subStatus.generation_used / subStatus.generation_limit) * 100, 100)}%` }}
                          ></div>
                        </div>
                        <span className="st-usage-text">
                          {Math.round((subStatus.generation_used / subStatus.generation_limit) * 100)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="st-card-footer">
                  {!isPro && (
                    <button className="st-btn-upgrade" onClick={() => navigate('/subscription')}>
                      <iconify-icon icon="solar:crown-linear"></iconify-icon>
                      อัปเกรดเป็น Pro
                    </button>
                  )}
                  {isPro && (
                    <button className="st-btn-outline" onClick={() => navigate('/subscription')}>
                      <iconify-icon icon="solar:eye-linear"></iconify-icon>
                      ดูรายละเอียดแผน
                    </button>
                  )}
                </div>
              </div>

              {/* Payment Method */}
              {isPro && (
                <div className="st-card">
                  <div className="st-card-header">
                    <div className="st-card-icon st-icon-blue">
                      <iconify-icon icon="solar:card-bold-duotone"></iconify-icon>
                    </div>
                    <div>
                      <h3 className="st-card-title">วิธีการชำระเงิน</h3>
                      <p className="st-card-desc">จัดการบัตรเครดิต/เดบิตที่ใช้ตัดเงิน</p>
                    </div>
                  </div>
                  <div className="st-card-body">
                    <div className="st-payment-card">
                      <div className="st-payment-card-visual">
                        <iconify-icon icon="logos:visa" style={{ fontSize: '40px' }}></iconify-icon>
                        <span className="st-card-number">•••• •••• •••• {subStatus?.card_last4 || '••••'}</span>
                      </div>
                      <div className="st-payment-info">
                        <span className="st-payment-label">บัตรที่ผูกอยู่</span>
                        <span className="st-payment-detail">
                          {subStatus?.card_brand || 'Visa'} ลงท้าย {subStatus?.card_last4 || '••••'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="st-card-footer">
                    <button className="st-btn-outline" onClick={handleChangeCard}>
                      <iconify-icon icon="solar:refresh-linear"></iconify-icon>
                      เปลี่ยนบัตร
                    </button>
                  </div>
                </div>
              )}

              {/* Billing History
              {/* Billing History */}
              <div className="st-card">
                <div className="st-card-header">
                  <div className="st-card-icon st-icon-olive">
                    <iconify-icon icon="solar:document-text-bold-duotone"></iconify-icon>
                  </div>
                  <div>
                    <h3 className="st-card-title">ประวัติการชำระเงิน</h3>
                    <p className="st-card-desc">ดูรายการชำระเงินที่ผ่านมา</p>
                  </div>
                </div>
                <div className="st-card-body">
                  {isPro ? (
                    <div className="st-billing-list">
                      <div className="st-billing-item">
                        <div className="st-billing-left">
                          <iconify-icon icon="solar:check-circle-bold" style={{ color: '#4caf50' }}></iconify-icon>
                          <div>
                            <span className="st-billing-title">Punthai Pro — รายเดือน</span>
                            <span className="st-billing-date">
                              {subStatus?.subscription_start_date
                                ? new Date(subStatus.subscription_start_date).toLocaleDateString('th-TH')
                                : '-'}
                            </span>
                          </div>
                        </div>
                        <span className="st-billing-amount">฿129.00</span>
                      </div>
                    </div>
                  ) : (
                    <div className="st-empty-state">
                      <iconify-icon icon="solar:bill-list-linear" style={{ fontSize: '40px', color: '#ccc' }}></iconify-icon>
                      <p>ยังไม่มีรายการชำระเงิน</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==================== การแจ้งเตือน ==================== */}
          {activeSection === 'notifications' && (
            <div className="st-section">
              <div className="st-card">
                <div className="st-card-header">
                  <div className="st-card-icon st-icon-orange">
                    <iconify-icon icon="solar:bell-bold-duotone"></iconify-icon>
                  </div>
                  <div>
                    <h3 className="st-card-title">การแจ้งเตือนทางอีเมล</h3>
                    <p className="st-card-desc">เลือกประเภทการแจ้งเตือนที่ต้องการรับ</p>
                  </div>
                </div>
                <div className="st-card-body">
                  <div className="st-toggle-list">
                    <div className="st-toggle-item">
                      <div className="st-toggle-info">
                        <span className="st-toggle-title">อัปเดตระบบ</span>
                        <span className="st-toggle-desc">รับแจ้งเตือนเมื่อมีฟีเจอร์ใหม่หรือการอัปเดตระบบ</span>
                      </div>
                      <label className="st-switch">
                        <input type="checkbox" checked={notifications.emailUpdates}
                          onChange={e => setNotifications(p => ({ ...p, emailUpdates: e.target.checked }))} />
                        <span className="st-slider"></span>
                      </label>
                    </div>
                    <div className="st-toggle-item">
                      <div className="st-toggle-info">
                        <span className="st-toggle-title">แจ้งเตือนโปรเจกต์</span>
                        <span className="st-toggle-desc">รับแจ้งเตือนเมื่อโปรเจกต์มีการเปลี่ยนแปลง</span>
                      </div>
                      <label className="st-switch">
                        <input type="checkbox" checked={notifications.projectAlerts}
                          onChange={e => setNotifications(p => ({ ...p, projectAlerts: e.target.checked }))} />
                        <span className="st-slider"></span>
                      </label>
                    </div>
                    <div className="st-toggle-item">
                      <div className="st-toggle-info">
                        <span className="st-toggle-title">โปรโมชั่นและข้อเสนอ</span>
                        <span className="st-toggle-desc">รับข้อเสนอพิเศษและส่วนลดสำหรับสมาชิก</span>
                      </div>
                      <label className="st-switch">
                        <input type="checkbox" checked={notifications.promotions}
                          onChange={e => setNotifications(p => ({ ...p, promotions: e.target.checked }))} />
                        <span className="st-slider"></span>
                      </label>
                    </div>
                    <div className="st-toggle-item">
                      <div className="st-toggle-info">
                        <span className="st-toggle-title">จดหมายข่าว</span>
                        <span className="st-toggle-desc">รับจดหมายข่าวเกี่ยวกับเทรนด์การออกแบบและเคล็ดลับ</span>
                      </div>
                      <label className="st-switch">
                        <input type="checkbox" checked={notifications.newsletter}
                          onChange={e => setNotifications(p => ({ ...p, newsletter: e.target.checked }))} />
                        <span className="st-slider"></span>
                      </label>
                    </div>
                  </div>
                </div>
                <div className="st-card-footer">
                  <button className="st-btn-primary" onClick={handleSaveNotifications}>
                    <iconify-icon icon="solar:diskette-linear"></iconify-icon>
                    บันทึกการตั้งค่า
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ==================== ความเป็นส่วนตัว ==================== */}
          {activeSection === 'privacy' && (
            <div className="st-section">
              <div className="st-card">
                <div className="st-card-header">
                  <div className="st-card-icon st-icon-blue">
                    <iconify-icon icon="solar:shield-check-bold-duotone"></iconify-icon>
                  </div>
                  <div>
                    <h3 className="st-card-title">ความเป็นส่วนตัว</h3>
                    <p className="st-card-desc">ควบคุมการแสดงข้อมูลของคุณ</p>
                  </div>
                </div>
                <div className="st-card-body">
                  <div className="st-toggle-list">
                    <div className="st-toggle-item">
                      <div className="st-toggle-info">
                        <span className="st-toggle-title">โปรไฟล์สาธารณะ</span>
                        <span className="st-toggle-desc">อนุญาตให้ผู้ใช้อื่นเห็นโปรไฟล์ของคุณ</span>
                      </div>
                      <label className="st-switch">
                        <input type="checkbox" checked={privacy.profilePublic}
                          onChange={e => setPrivacy(p => ({ ...p, profilePublic: e.target.checked }))} />
                        <span className="st-slider"></span>
                      </label>
                    </div>
                    <div className="st-toggle-item">
                      <div className="st-toggle-info">
                        <span className="st-toggle-title">แสดงอีเมล</span>
                        <span className="st-toggle-desc">แสดงอีเมลในโปรไฟล์สาธารณะ</span>
                      </div>
                      <label className="st-switch">
                        <input type="checkbox" checked={privacy.showEmail}
                          onChange={e => setPrivacy(p => ({ ...p, showEmail: e.target.checked }))} />
                        <span className="st-slider"></span>
                      </label>
                    </div>
                    <div className="st-toggle-item">
                      <div className="st-toggle-info">
                        <span className="st-toggle-title">แสดงโปรเจกต์</span>
                        <span className="st-toggle-desc">อนุญาตให้ผู้ใช้อื่นเห็นโปรเจกต์ของคุณ</span>
                      </div>
                      <label className="st-switch">
                        <input type="checkbox" checked={privacy.showProjects}
                          onChange={e => setPrivacy(p => ({ ...p, showProjects: e.target.checked }))} />
                        <span className="st-slider"></span>
                      </label>
                    </div>
                  </div>
                </div>
                <div className="st-card-footer">
                  <button className="st-btn-primary" onClick={handleSavePrivacy}>
                    <iconify-icon icon="solar:diskette-linear"></iconify-icon>
                    บันทึกการตั้งค่า
                  </button>
                </div>
              </div>

              {/* Sessions */}
              <div className="st-card">
                <div className="st-card-header">
                  <div className="st-card-icon st-icon-gold">
                    <iconify-icon icon="solar:monitor-smartphone-bold-duotone"></iconify-icon>
                  </div>
                  <div>
                    <h3 className="st-card-title">เซสชันที่ใช้งาน</h3>
                    <p className="st-card-desc">อุปกรณ์ที่ล็อกอินอยู่ในขณะนี้</p>
                  </div>
                </div>
                <div className="st-card-body">
                  <div className="st-session-item st-session-current">
                    <div className="st-session-icon">
                      <iconify-icon icon="solar:monitor-linear"></iconify-icon>
                    </div>
                    <div className="st-session-info">
                      <span className="st-session-name">อุปกรณ์ปัจจุบัน</span>
                      <span className="st-session-detail">เบราว์เซอร์นี้ — กำลังใช้งาน</span>
                    </div>
                    <span className="st-session-badge">ปัจจุบัน</span>
                  </div>
                </div>
                <div className="st-card-footer">
                  <button className="st-btn-outline-danger" onClick={() => alert('ออกจากระบบทุกอุปกรณ์สำเร็จ')}>
                    <iconify-icon icon="solar:logout-2-linear"></iconify-icon>
                    ออกจากระบบทุกอุปกรณ์
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ==================== การแสดงผล ==================== */}
          {activeSection === 'display' && (
            <div className="st-section">
              <div className="st-card">
                <div className="st-card-header">
                  <div className="st-card-icon st-icon-olive">
                    <iconify-icon icon="solar:pallete-2-bold-duotone"></iconify-icon>
                  </div>
                  <div>
                    <h3 className="st-card-title">ภาษาและการแสดงผล</h3>
                    <p className="st-card-desc">ปรับแต่งภาษาและรูปแบบการแสดงผล</p>
                  </div>
                </div>
                <div className="st-card-body">
                  <div className="st-select-group">
                    <label className="st-select-label">ภาษา</label>
                    <div className="st-select-wrapper">
                      <select
                        className="st-select"
                        value={display.language}
                        onChange={e => setDisplay(p => ({ ...p, language: e.target.value }))}
                      >
                        <option value="th">ไทย</option>
                        <option value="en">English</option>
                      </select>
                      <iconify-icon icon="solar:alt-arrow-down-linear" className="st-select-arrow"></iconify-icon>
                    </div>
                  </div>
                  <div className="st-select-group">
                    <label className="st-select-label">ธีม</label>
                    <div className="st-theme-options">
                      <button
                        className={`st-theme-btn ${display.theme === 'light' ? 'st-theme-active' : ''}`}
                        onClick={() => setDisplay(p => ({ ...p, theme: 'light' }))}
                      >
                        <iconify-icon icon="solar:sun-2-linear"></iconify-icon>
                        <span>สว่าง</span>
                      </button>
                      <button
                        className={`st-theme-btn ${display.theme === 'dark' ? 'st-theme-active' : ''}`}
                        onClick={() => setDisplay(p => ({ ...p, theme: 'dark' }))}
                      >
                        <iconify-icon icon="solar:moon-linear"></iconify-icon>
                        <span>มืด</span>
                      </button>
                      <button
                        className={`st-theme-btn ${display.theme === 'auto' ? 'st-theme-active' : ''}`}
                        onClick={() => setDisplay(p => ({ ...p, theme: 'auto' }))}
                      >
                        <iconify-icon icon="solar:monitor-linear"></iconify-icon>
                        <span>ตามระบบ</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

            </div>
          </div>
        </main>
      </div>

    </>
  );
};

export default Settings;
