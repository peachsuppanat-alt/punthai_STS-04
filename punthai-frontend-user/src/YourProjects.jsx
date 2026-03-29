import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import './YourProjects.css';

import logoImg from './assets/logo.png';
import helpImg from './assets/help.png';

export const YourProjects = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const projectId = location.state?.projectId;

  // States
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [products, setProducts] = useState([]); // เก็บรายการสินค้า
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form States
  const [productName, setProductName] = useState('');
  const [productType, setProductType] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // Image Upload States
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  const categories = [
    { label: 'อาหาร / ของกินเล่น', value: 'อาหาร / ของกินเล่น' },
    { label: 'เครื่องดื่ม', value: 'เครื่องดื่ม' },
    { label: 'เสื้อผ้า', value: 'เสื้อผ้า' },
    { label: 'ความงาม', value: 'ความงาม' },
    { label: 'ของใช้', value: 'ของใช้' }
  ];

  // ดึงข้อมูลสินค้าเมื่อเปิดหน้า
  useEffect(() => {
    if (projectId) {
      fetchProducts();
    } else {
      alert("ไม่พบรหัสโปรเจกต์ กรุณากลับไปเลือกโปรเจกต์ใหม่");
      navigate('/');
    }
  }, [projectId]);

  const fetchProducts = async () => {
    try {
      const res = await fetch(`http://localhost:3000/api/brand_product/${projectId}`);
      const data = await res.json();
      if (data.status === 'success') {
        setProducts(data.products);
      }
    } catch (err) {
      console.error("Fetch products error:", err);
    }
  };

  // --- Modal Logic ---
  const handleOpenModal = () => setIsModalOpen(true);
  
  const handleCloseModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setProductName('');
    setProductType('');
    setImageFile(null);
    setPreviewUrl(null);
    setIsDropdownOpen(false);
  };

  // --- Image Upload Logic ---
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
  };

  const processFile = (file) => {
    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  // --- Submit Form ---
  const handleSubmit = async () => {
    if (!productName) return alert("กรุณากรอกชื่อสินค้า");
    if (!productType) return alert("กรุณาเลือกประเภทสินค้า");
    // หมายเหตุ: ถ้าบังคับให้อัปโหลดรูปด้วย ให้เพิ่ม if (!imageFile) return alert("กรุณาอัปโหลดรูปภาพ");

    const formData = new FormData();
    formData.append('project_id', projectId);
    formData.append('name_product', productName);
    formData.append('type_product', productType);
    if (imageFile) {
        formData.append('image_product', imageFile);
    }

    try {
      const res = await fetch('http://localhost:3000/api/brand_product', {
        method: 'POST',
        body: formData, // ส่งเป็น FormData เพื่อรองรับไฟล์
      });
      const data = await res.json();

      if (data.status === 'success') {
        fetchProducts(); // โหลดข้อมูลใหม่มาแสดง
        handleCloseModal();
      } else {
        alert("เพิ่มสินค้าไม่สำเร็จ: " + data.message);
      }
    } catch (err) {
      console.error(err);
      alert("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    }
  };

  return (
    <div className="yp-body">
      {/* Navbar */}
      <header className="yp-navbar">
        <div className="yp-logo">
          <Link to="/">
            <img src={logoImg} alt="logo" className="yp-logo-img" />
          </Link>
        </div>
        <div className="yp-nav-icons">
          <button className="yp-btn-world"><iconify-icon icon="iconamoon:search-light"></iconify-icon></button>
          <button className="yp-btn-world"><iconify-icon icon="ph:bell-ringing-light"></iconify-icon></button>
          <button className="yp-btn-users"><iconify-icon icon="solar:user-linear"></iconify-icon></button>
        </div>
      </header>

      <div className="yp-container">
        {/* Sidebar */}
        <aside className={`yp-sidebar ${isSidebarCollapsed ? 'yp-collapsed' : ''}`}>
          <button className="yp-toggle-btn" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>
            {isSidebarCollapsed ? '❯' : '❮'}
          </button>
          
          <ul className="yp-menu">
            {/* กดปุ่มนี้เพื่อกลับไปหน้า MyProject.jsx */}
            <li onClick={() => navigate('/project', { state: { projectId } })}>
              <span className="yp-icon"><iconify-icon icon="mdi:view-dashboard-outline"></iconify-icon></span>
              <span className="yp-text">Projects</span>
            </li>
            <li onClick={() => navigate('/brand-dna', { state: { projectId } })}>
              <span className="yp-icon"><iconify-icon icon="mdi:palette-outline"></iconify-icon></span>
              <span className="yp-text">Brand DNA</span>
            </li>
            <li onClick={() => navigate('/create-concept', { state: { projectId } })}>
              <span className="yp-icon"><iconify-icon icon="mdi:lightbulb-outline"></iconify-icon></span>
              <span className="yp-text">Create Concept</span>
            </li>
            <li onClick={() => navigate('/create-logo', { state: { projectId}})} >
              <span className="yp-icon"><iconify-icon icon="mdi:folder-outline"></iconify-icon></span>
              <span className="yp-text">Create Pictures</span>
            </li>
          </ul>
          <hr className="yp-hr" />
          <ul className="yp-menu">
            {/* แท็บนี้ Active อยู่ */}
            <li className="yp-active" style={{ background: '#f3f6ea', color: '#6b8e23' }}>
              <span className="yp-icon"><iconify-icon icon="mdi:folder-outline"></iconify-icon></span>
              <span className="yp-text">Yours Projects</span>
            </li>
          </ul>

          <div className="yp-help">
            <img src={helpImg} className="yp-help-img" alt="help" />
            <p className="yp-help-text">Having trouble?</p>
            <a href="#" className="yp-contact-link">Contact Us</a>
          </div>
        </aside>

        {/* Main Content */}
        <main className="yp-main">
          <h1 lang="en" className="yp-h1">My Project</h1>
          <p className="yp-subtitle">พัฒนาแบรนด์ของคุณให้ดีกว่าเดิม</p>

          {/* แสดงการ์ดสินค้าถ้ามีข้อมูลใน Database */}
          {/* แสดงการ์ดสินค้าถ้ามีข้อมูลใน Database */}
            <div className="yp-cards-container">
              {products.map((product, index) => (
                <div key={product.product_id || index} className="yp-ai-card">
                  <div className="yp-ai-card-header">
                    <div className="yp-step-number">{index + 1}</div>
                    <h2>{product.name_product}</h2>
                  </div>
                  <div className="yp-image-group">
                    <div className="yp-image-box">
                       {product.image_product ? (
                          <img src={`http://localhost:3000/uploads/${product.image_product}`} alt={product.name_product} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }} />
                       ) : null}
                    </div>
                    {/* กล่องเปล่าเผื่อไว้ใส่รูป mockup ตามดีไซน์ของคุณ */}
                    <div className="yp-image-box"></div>
                    <div className="yp-image-box"></div>
                  </div>
                </div>
              ))}
          </div>

          {/* ปุ่มบวก (+) */}
          <button className="yp-fab" onClick={handleOpenModal}>
            <iconify-icon icon="tabler:plus" width="32" height="32"></iconify-icon>
          </button>
        </main>
      </div>

      {/* Popup Modal */}
      {isModalOpen && (
        <div className="yp-modal" onClick={handleCloseModal}>
          <div className="yp-modal-box" onClick={(e) => e.stopPropagation()}>
            <button className="yp-close-modal" onClick={handleCloseModal}>&times;</button>

            {/* Step 1 */}
            <div className="yp-form-group">
              <label><span className="yp-step">1</span> สินค้าของคุณคืออะไร</label>
              <input 
                type="text" 
                placeholder="เช่น โดนัท" 
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
              />
            </div>

            {/* Step 2 */}
            <div className="yp-form-group">
              <label><span className="yp-step">2</span> ประเภท</label>
              <div className="yp-dropdown">
                <div className="yp-dropdown-selected" onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
                  <span className="yp-selected-text">{productType || '-- เลือกประเภทสินค้า --'}</span>
                  <span className="yp-arrow">⌄</span>
                </div>
                {isDropdownOpen && (
                  <ul className="yp-dropdown-menu" style={{ display: 'block' }}>
                    {categories.map((cat, idx) => (
                      <li key={idx} onClick={() => { setProductType(cat.value); setIsDropdownOpen(false); }}>
                        {cat.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Step 3 */}
            <div className="yp-form-group">
              <label><span className="yp-step">3</span> รูปภาพสินค้าของคุณ</label>
              <div 
                className="yp-upload-box" 
                onDragOver={handleDragOver} 
                onDrop={handleDrop}
                style={{ borderColor: previewUrl ? '#cfcfcf' : '' }}
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
                    <img src={previewUrl} className="yp-preview-img" alt="preview" />
                    <button type="button" className="yp-change-btn" onClick={() => fileInputRef.current.click()}>
                      เปลี่ยนรูป
                    </button>
                  </>
                ) : (
                  <>
                    <p className="yp-drag">Drag & Drop here</p>
                    <p className="yp-sub">รูปภาพของคุณ หรือลิงก์</p>
                    <button type="button" className="yp-upload-btn" onClick={() => fileInputRef.current.click()}>
                      Upload
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="yp-modal-actions">
              <button className="yp-cancel" onClick={handleCloseModal}>ยกเลิก</button>
              <button className="yp-confirm" onClick={handleSubmit}>ตกลง</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};