/* import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Profile.css';

import logoImg from './assets/logo.png';
import helpImg from './assets/help.png';

export const EditProfile = ({ user, setUser }) => {
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    user_name: '',
    email: '',
    password: '',
    confirm_password: ''
  });
  
  const [userData, setUserData] = useState({});
  const [newImageFile, setNewImageFile] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  
  
  const [alertMsg, setAlertMsg] = useState({ type: '', text: '' });

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
        email: currentUser.email || '', // ให้ email แสดงเฉยๆ ไม่อนุญาตให้แก้ เพราะใช้เป็น Primary Login
        password: '',
        confirm_password: ''
      });
    }
  }, [user, navigate]);

  const toggleSidebar = () => setIsSidebarCollapsed(!isSidebarCollapsed);

  const getProfileImage = (imagePath) => {
    if (!imagePath || imagePath === 'null') return null;
    return imagePath.startsWith('http') 
      ? imagePath 
      : `http://localhost:3000/uploads/${imagePath}`;
  };

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

  const handleSubmit = async (e) => {
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
        method: 'PUT',
        body: submitData
      });
      const data = await res.json();

      if (data.status === 'success') {
       
        localStorage.setItem('user', JSON.stringify(data.user));
        if (setUser) setUser(data.user);
        setUserData(data.user);
        
       
        setFormData({ ...formData, password: '', confirm_password: '' });
        setAlertMsg({ type: 'success', text: 'บันทึกข้อมูลโปรไฟล์เรียบร้อยแล้ว' });
        
       
        setTimeout(() => setAlertMsg({ type: '', text: '' }), 3000);
      } else {
        setAlertMsg({ type: 'error', text: data.message });
      }
    } catch (err) {
      setAlertMsg({ type: 'error', text: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้' });
    }
  };

  
  const displayImage = previewImage || getProfileImage(userData.image_profile);

  return (
    <div className="mp-body-wrapper">
      <header className="pf-navbar">
        <div className="pf-logo">
            <Link to="/">
                <img src={logoImg} alt="logo" className="pf-logo-img" />
            </Link>
        </div>
        <div className="pf-nav-icons">
          <button className="pf-btn-world"><iconify-icon icon="iconamoon:search-light"></iconify-icon></button>
          <button className="pf-btn-world"><iconify-icon icon="ph:bell-ringing-light"></iconify-icon></button>
          <button className="pf-btn-users" style={{ overflow: 'hidden', padding: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {getProfileImage(userData.image_profile) ? (
                <img src={getProfileImage(userData.image_profile)} alt="User" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
                <iconify-icon icon="solar:user-linear"></iconify-icon>
            )}
          </button>
        </div>
      </header>

      <div className="pf-container">
        <button className="pf-toggle-btn" onClick={toggleSidebar} style={{ left: isSidebarCollapsed ? 'calc(80px - 17px)' : 'calc(240px - 17px)' }}>
          {isSidebarCollapsed ? '❯' : '❮'}
        </button>

        <aside className={`pf-sidebar ${isSidebarCollapsed ? 'pf-collapsed' : ''}`}>
          <ul className="pf-menu">
            <li onClick={() => navigate('/profile')} style={{ cursor: 'pointer' }}>
              <span className="pf-icon"><iconify-icon icon="solar:user-linear"></iconify-icon></span>
              <span className="pf-text">Profile</span>
            </li>
            <li onClick={() => navigate('/brandbook')} style={{ cursor: 'pointer' }}>
              <span className="pf-icon"><iconify-icon icon="mdi:book-open-page-variant-outline"></iconify-icon></span>
              <span className="pf-text">Brandbook</span>
            </li>
            <li className="pf-active">
              <span className="pf-icon"><iconify-icon icon="mdi:account-edit-outline"></iconify-icon></span>
              <span className="pf-text">Edit Profile</span>
            </li>
          </ul>
          <div className="pf-help">
            <img src={helpImg} className="pf-help-img" alt="help" />
            <p className="pf-help-text">Having trouble?</p>
            <a href="#" className="pf-contact-link">Contact Us</a>
          </div>
        </aside>

        <main className="pf-main">
          <div className="pf-section-header" style={{ marginBottom: '30px' }}>
            <h2 className="pf-section-title">Edit Your Profile</h2>
            <p style={{ color: '#888', marginTop: '5px' }}>อัปเดตข้อมูลส่วนตัวและตั้งค่าความปลอดภัยของคุณ</p>
          </div>

          <div className="edit-profile-card">
            
            {alertMsg.text && (
                <div className={`alert-box ${alertMsg.type === 'success' ? 'alert-success' : 'alert-error'}`}>
                    <iconify-icon icon={alertMsg.type === 'success' ? 'mdi:check-circle-outline' : 'mdi:alert-circle-outline'} style={{ fontSize: '20px' }}></iconify-icon>
                    <span>{alertMsg.text}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="edit-form-container">
               
                <div className="edit-avatar-section">
                    <div className="edit-avatar-wrapper">
                        {displayImage ? (
                            <img src={displayImage} alt="Profile" className="edit-avatar-img" />
                        ) : (
                            <div className="edit-avatar-placeholder">
                                {formData.user_name ? formData.user_name.substring(0, 2).toUpperCase() : 'PT'}
                            </div>
                        )}
                        <label htmlFor="upload-photo" className="edit-avatar-overlay">
                            <iconify-icon icon="mdi:camera-outline" style={{ fontSize: '28px', color: '#fff' }}></iconify-icon>
                        </label>
                        <input type="file" id="upload-photo" accept="image/*" style={{ display: 'none' }} onChange={handleImageSelect} />
                    </div>
                    <div className="edit-avatar-text">
                        <h3>Profile Picture</h3>
                        
                        
                        <label htmlFor="upload-photo" className="btn-upload-text" >เปลี่ยนรูปโปรไฟล์</label>
                    </div>
                </div>

                <hr className="edit-divider" />

               
                <h3 className="edit-section-title">Personal Information</h3>
                <div className="edit-form-row">
                    <div className="edit-form-group">
                        <label>First Name (ชื่อจริง)</label>
                        <input type="text" name="first_name" value={formData.first_name} onChange={handleInputChange} className="edit-input" placeholder="ชื่อจริงของคุณ" />
                    </div>
                    <div className="edit-form-group">
                        <label>Last Name (นามสกุล)</label>
                        <input type="text" name="last_name" value={formData.last_name} onChange={handleInputChange} className="edit-input" placeholder="นามสกุลของคุณ" />
                    </div>
                </div>

                <div className="edit-form-row">
                    <div className="edit-form-group">
                        <label>Username (ชื่อผู้ใช้งาน) *</label>
                        <input type="text" name="user_name" value={formData.user_name} onChange={handleInputChange} className="edit-input" required />
                    </div>
                    <div className="edit-form-group">
                        <label>Email Address</label>
                        <input type="email" name="email" value={formData.email} className="edit-input input-disabled" disabled title="ไม่สามารถเปลี่ยนอีเมลได้" />
                    </div>
                </div>

                <hr className="edit-divider" />

              
                <h3 className="edit-section-title">Change Password</h3>
                <p style={{ color: '#888', fontSize: '14px', marginBottom: '20px' }}>หากไม่ต้องการเปลี่ยนรหัสผ่าน ให้เว้นว่างไว้</p>
                <div className="edit-form-row">
                    <div className="edit-form-group">
                        <label>New Password</label>
                        <input type="password" name="password" value={formData.password} onChange={handleInputChange} className="edit-input" placeholder="รหัสผ่านใหม่" />
                    </div>
                    <div className="edit-form-group">
                        <label>Confirm New Password</label>
                        <input type="password" name="confirm_password" value={formData.confirm_password} onChange={handleInputChange} className="edit-input" placeholder="ยืนยันรหัสผ่านใหม่" />
                    </div>
                </div>

               
                <div className="edit-action-buttons">
                    <button type="button" className="btn-cancel" onClick={() => navigate('/profile')}>Cancel</button>
                    <button type="submit" className="btn-save">
                        <iconify-icon icon="mdi:content-save-outline" style={{ marginRight: '5px' }}></iconify-icon>
                        Save Changes
                    </button>
                </div>
            </form>
          </div>

        </main>
      </div>
    </div>
  );
}; */