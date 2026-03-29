import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import './CreateLogo.css';

// นำเข้ารูปภาพ (ปรับ Path ให้ตรงกับโปรเจกต์ของคุณ)
import logoImg from './assets/logo.png';
import helpImg from './assets/help.png';
//import createLogoImg from './assets/create logo.png';

export const CreateLogo = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const projectId = location.state?.projectId;

  // --- States สำหรับ Layout ---
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // --- States สำหรับ Form ใน Modal ---
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // --- States สำหรับระบบ Upload ---
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const defaultCategory = '-- เลือกประเภทสินค้า --';
  const categories = [
    { label: 'อาหาร / ของกินเล่น', value: 'food' },
    { label: 'เครื่องดื่ม', value: 'drink' },
    { label: 'เสื้อผ้า', value: 'clothes' },
    { label: 'ความงาม', value: 'beauty' },
    { label: 'ของใช้', value: 'home' }
  ];

  // --- ฟังก์ชันจัดการ Dropdown ---
  useEffect(() => {
    const handleClickOutside = () => setIsDropdownOpen(false);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleDropdownClick = (e) => {
    e.stopPropagation();
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleCategorySelect = (label) => {
    setCategory(label);
    setIsDropdownOpen(false);
  };

  // --- ฟังก์ชันจัดการ Modal ---
  const handleOpenModal = () => setIsModalOpen(true);
  
  const handleCloseModal = () => {
    setIsModalOpen(false);
    resetModal();
  };

  const resetModal = () => {
    setProductName('');
    setCategory('');
    setIsDropdownOpen(false);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- ฟังก์ชันจัดการ Upload & Drag-Drop ---
  const processFile = (file) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreviewUrl(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleFileChange = (e) => {
    processFile(e.target.files[0]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (fileInputRef.current) {
      // โค้ดนี้ใช้สำหรับการตั้งค่าไฟล์ให้ input type=file ใน React อย่างง่าย
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileInputRef.current.files = dataTransfer.files;
    }
    processFile(file);
  };

  // --- ฟังก์ชันยืนยันข้อมูล ---
  const handleSubmit = () => {
    const trimmedName = productName.trim();
    const currentCategory = category || defaultCategory;

    if (!trimmedName) {
      alert("กรุณากรอกสินค้าของคุณ");
      return;
    }

    if (currentCategory === defaultCategory) {
      alert("กรุณาเลือกประเภทสินค้า");
      setIsDropdownOpen(true);
      return;
    }

    // สร้าง Params ส่งไปหน้าถัดไปตาม Logic เดิม
    const params = new URLSearchParams({
      name: trimmedName,
      type: currentCategory
    });

    resetModal();
    setIsModalOpen(false);

    // นำทางไปหน้า result (ปรับเปลี่ยนให้เข้ากับ React Router)
    navigate(`/result?${params.toString()}`, { state: { projectId } });
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
          <button className="clg-btn-world">
            <iconify-icon icon="iconamoon:search-light"></iconify-icon>
          </button>
          <button className="clg-btn-world">
            <iconify-icon icon="ph:bell-ringing-light"></iconify-icon>
          </button>
          <button className="clg-btn-users">
            <iconify-icon icon="solar:user-linear"></iconify-icon>
          </button>
        </div>
      </header>

      <div className="clg-container">
        {/* Sidebar */}
        <aside className={`clg-sidebar ${isSidebarCollapsed ? 'clg-collapsed' : ''}`} id="clg-sidebar">
          <button className="clg-toggle-btn" id="clg-toggleBtn" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>
            {isSidebarCollapsed ? '❯' : '❮'}
          </button>
          
          {/* Menu */}
          <ul className="clg-menu">
            <li onClick={() => navigate('/project', { state: { projectId } })} style={{ cursor: 'pointer' }}>
              <span className="clg-icon"><iconify-icon icon="mdi:view-dashboard-outline"></iconify-icon></span>
              <span className="clg-text">Projects</span>
            </li>
            <li onClick={() => navigate('/brand-dna', { state: { projectId } })} style={{ cursor: 'pointer' }}>
              <span className="clg-icon"><iconify-icon icon="mdi:palette-outline"></iconify-icon></span>
              <span className="clg-text">Brand DNA</span>
            </li>
            <li onClick={() => navigate('/create-concept', { state: { projectId } })} style={{ cursor: 'pointer' }}>
              <span className="clg-icon"><iconify-icon icon="mdi:lightbulb-outline"></iconify-icon></span>
              <span className="clg-text">Create Concept</span>
            </li>
            <li className="clg-active" style={{ cursor: 'pointer' }}>
              <span className="clg-icon"><iconify-icon icon="mdi:folder-outline"></iconify-icon></span>
              <span className="clg-text">Create Pictures</span>
            </li>
          </ul>
          
          <hr className="clg-hr" />
          
          <ul className="clg-menu">
            <li onClick={() => navigate('/your-projects', { state: { projectId } })} style={{ cursor: 'pointer' }}>
              <span className="clg-icon"><iconify-icon icon="mdi:folder-outline"></iconify-icon></span>
              <span className="clg-text">Yours Projects</span>
            </li>
          </ul>
          
          <div className="clg-help">
            <img src={helpImg} className="clg-help-img" alt="help" />
            <p className="clg-help-text">Having trouble?</p>
            <a href="#" className="clg-contact-link">Contact Us</a>
          </div>
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
          <div className="clg-modal-box" onClick={(e) => e.stopPropagation()}>
            <button className="clg-close-modal" onClick={handleCloseModal}>&times;</button>

            {/* Step 1 */}
            <div className="clg-form-group">
              <label><span className="clg-step">1</span> สินค้าของคุณคืออะไร</label>
              <input 
                type="text" 
                placeholder="เช่น โดนัท" 
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
              />
            </div>

            {/* Step 2 */}
            <div className="clg-form-group">
              <label><span className="clg-step">2</span> ประเภท</label>
              <div className={`clg-dropdown ${isDropdownOpen ? 'clg-active' : ''}`} onClick={handleDropdownClick}>
                <div className="clg-dropdown-selected">
                  <span className="clg-selected-text">{category || defaultCategory}</span>
                  <span className="clg-arrow">⌄</span>
                </div>
                <ul className="clg-dropdown-menu">
                  {categories.map((cat, idx) => (
                    <li key={idx} onClick={() => handleCategorySelect(cat.label)}>
                      {cat.label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Step 3 */}
            <div className="clg-form-group">
              <label><span className="clg-step">3</span> รูปภาพสินค้าของคุณ</label>
              <div 
                className="clg-upload-box" 
                style={{ borderColor: isDragging ? '#d3542b' : (previewUrl ? '#cfcfcf' : ''), backgroundColor: isDragging ? '#fff6f2' : '' }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input 
                  type="file" 
                  accept="image/*" 
                  hidden 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                />
                
                {previewUrl ? (
                  <>
                    <img src={previewUrl} className="clg-preview-img" alt="preview" />
                    <button type="button" className="clg-change-btn" onClick={() => fileInputRef.current.click()}>เปลี่ยนรูป</button>
                  </>
                ) : (
                  <>
                    <p className="clg-drag">Drag & Drop here</p>
                    <p className="clg-sub">รูปภาพของคุณ หรือลิงก์</p>
                    <button type="button" className="clg-upload-btn" onClick={() => fileInputRef.current.click()}>Upload</button>
                  </>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="clg-modal-actions">
              <button className="clg-cancel" onClick={handleCloseModal}>ยกเลิก</button>
              <button className="clg-confirm" onClick={handleSubmit}>ตกลง</button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
