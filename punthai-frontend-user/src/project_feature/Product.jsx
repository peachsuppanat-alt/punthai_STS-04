import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import './Product.css';
import { ProductSidebar } from '../components/ProductSidebar';
import logoImg from '../assets/logo.png';
import { API_URL } from '../config';

export const Product = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const projectId = location.state?.projectId;

  // States
  const [products, setProducts] = useState([]);
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
    { label: 'ของใช้', value: 'ของใช้' },
  ];

  useEffect(() => {
    if (projectId) {
      fetchProducts();
    } else {
      alert('ไม่พบรหัสโปรเจกต์ กรุณากลับไปเลือกโปรเจกต์ใหม่');
      navigate('/`${API_URL}`success') setProducts(data.products);
    } catch (err) {
      console.error('Fetch products error:', err);
    }
  };

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

  const handleSubmit = async () => {
    if (!productName) return alert('กรุณากรอกชื่อสินค้า');
    if (!productType) return alert('กรุณาเลือกประเภทสินค้า');

    const formData = new FormData();
    formData.append('project_id', projectId);
    formData.append('name_product', productName);
    formData.append('type_product', productType);
    if (imageFile) formData.append('image_product', imageFile);

    try {
      const res = await fetch(`${API_URL}`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.status === 'success') {
        fetchProducts();
        handleCloseModal();
      } else {
        alert('เพิ่มสินค้าไม่สำเร็จ: ' + data.message);
      }
    } catch (err) {
      console.error(err);
      alert('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    }
  };

  return (
    <div className="pd-body">

      {/* Orbs */}
      <div className="pd-orb3" aria-hidden="true"></div>
      <div className="pd-orb4" aria-hidden="true"></div>

      {/* Navbar */}
      <header className="pd-navbar">
        <div className="pd-logo">
          <Link to="/">
            <img src={logoImg} alt="logo" className="pd-logo-img" />
          </Link>
        </div>
        <div className="pd-nav-icons">
          <button className="pd-btn-world"><iconify-icon icon="iconamoon:search-light"></iconify-icon></button>
          <button className="pd-btn-world"><iconify-icon icon="ph:bell-ringing-light"></iconify-icon></button>
          <button className="pd-btn-users" onClick={() => navigate('/profile`${API_URL}` cncpt-open' : ''}`}>
                <div
                  className="cncpt-cc-dd-sel"
                  onClick={(e) => { e.stopPropagation(); setIsDropdownOpen(!isDropdownOpen); }}
                >
                  <span className={productType ? '' : 'cncpt-dd-placeholder'}>
                    {productType || '-- เลือกประเภทสินค้า --'}
                  </span>
                  <iconify-icon icon="mdi:chevron-down"></iconify-icon>
                </div>
                <ul className="cncpt-cc-dd-list">
                  {categories.map((cat) => (
                    <li key={cat.value} onClick={() => { setProductType(cat.value); setIsDropdownOpen(false); }}>
                      {cat.label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Step 3 */}
            <div className="cncpt-form-group">
              <label><span className="cncpt-step">3</span> รูปภาพสินค้าของคุณ</label>
              <div
                className="pd-upload-box"
                onDragOver={handleDragOver}
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
                    <img src={previewUrl} className="pd-preview-img" alt="preview" />
                    <button type="button" className="pd-change-btn" onClick={() => fileInputRef.current.click()}>
                      <iconify-icon icon="mdi:image-edit-outline"></iconify-icon> เปลี่ยนรูป
                    </button>
                  </>
                ) : (
                  <>
                    <div className="pd-upload-icon">
                      <iconify-icon icon="mdi:cloud-upload-outline"></iconify-icon>
                    </div>
                    <p className="pd-drag-text">Drag &amp; Drop here</p>
                    <p className="pd-drag-sub">รูปภาพสินค้าของคุณ</p>
                    <button type="button" className="pd-upload-btn" onClick={() => fileInputRef.current.click()}>
                      เลือกรูปภาพ
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="cncpt-modal-actions">
              <button className="cncpt-cancel-btn" onClick={handleCloseModal}>ยกเลิก</button>
              <button className="cncpt-confirm-btn" onClick={handleSubmit}>เพิ่มสินค้า</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};