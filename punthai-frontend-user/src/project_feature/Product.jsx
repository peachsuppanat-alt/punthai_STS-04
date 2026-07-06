import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import './Product.css';
import { ProductSidebar } from '../components/ProductSidebar';
import logoImg from '../assets/logo.png';
import { API_URL } from '../config';
import NavProfileButton from '../components/NavProfileButton';
import NotificationBell from '../components/NotificationBell';

// ===== ค่าเริ่มต้นของฟิลด์รายละเอียดสินค้า (นำไปใช้ต่อใน Label / Mockup) =====
const EMPTY_DETAILS = {
  tagline: '', netWeight: '', ingredients: '',
  usage: '', storage: '', warnings: '',
  mName: '', mAddress: '', mPhone: '', mLine: '', mFacebook: '', mWebsite: '',
  fdaNumber: '', mfgDate: '', expDate: '', lotNumber: '',
};

// แปลง row จาก label_design → state details ของฟอร์ม
const rowToDetails = (r) => {
  let mi = {};
  try {
    mi = r.manufacturer_info
      ? (typeof r.manufacturer_info === 'string' ? JSON.parse(r.manufacturer_info) : r.manufacturer_info)
      : {};
  } catch { mi = {}; }
  return {
    tagline: r.tagline || '',
    netWeight: r.net_weight || '',
    ingredients: r.ingredients || '',
    usage: r.usage_instruction || '',
    storage: r.storage_instruction || '',
    warnings: r.warnings || '',
    mName: mi.name || '', mAddress: mi.address || '', mPhone: mi.phone || '',
    mLine: mi.line || '', mFacebook: mi.facebook || '', mWebsite: mi.website || '',
    fdaNumber: r.fda_number || '',
    mfgDate: r.mfg_date ? String(r.mfg_date).substring(0, 10) : '',
    expDate: r.exp_date ? String(r.exp_date).substring(0, 10) : '',
    lotNumber: r.lot_number || '',
  };
};

// ===== Presentational components (module scope กันปัญหา input โดน remount แล้วหลุด focus) =====
function FormSection({ title, icon, open, onToggle, children }) {
  return (
    <div className="pd-form-section">
      <button type="button" className="pd-section-head" onClick={onToggle}>
        <span className="pd-section-title">
          <iconify-icon icon={icon}></iconify-icon> {title}
        </span>
        <iconify-icon icon={open ? 'mdi:chevron-up' : 'mdi:chevron-down'}></iconify-icon>
      </button>
      {open && <div className="pd-section-body">{children}</div>}
    </div>
  );
}

function LabeledInput({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <div className="pd-field">
      <label className="pd-field-label">{label}</label>
      <input
        className="pd-field-input"
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function LabeledTextarea({ label, value, onChange, placeholder, rows = 2 }) {
  return (
    <div className="pd-field">
      <label className="pd-field-label">{label}</label>
      <textarea
        className="pd-field-input pd-field-textarea"
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="pd-info-row">
      <span className="pd-info-label">{label}</span>
      <span className="pd-info-value">{value}</span>
    </div>
  );
}

export const Product = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const projectId = location.state?.projectId;

  // States
  const [products, setProducts] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = เพิ่มใหม่, มีค่า = แก้ไข
  const [isSaving, setIsSaving] = useState(false);

  // Form States (ข้อมูลพื้นฐาน)
  const [productName, setProductName] = useState('');
  const [productType, setProductType] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Form States (รายละเอียด)
  const [details, setDetails] = useState(EMPTY_DETAILS);
  const setDetail = (key, val) => setDetails((p) => ({ ...p, [key]: val }));
  const [openSection, setOpenSection] = useState({ detail: false, care: false, manufacturer: false, legal: false });
  const toggleSection = (key) => setOpenSection((p) => ({ ...p, [key]: !p[key] }));

  // Image Upload States
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  // Detail popup States
  const [detailProduct, setDetailProduct] = useState(null); // product ที่กำลังดู
  const [detailData, setDetailData] = useState(null);        // ข้อมูล label_design ที่โหลดมา
  const [detailLoading, setDetailLoading] = useState(false);

  // Kebab menu ของการ์ดสินค้า (เก็บ product_id ที่เมนูเปิดอยู่)
  const [menuOpenId, setMenuOpenId] = useState(null);

  // ปิดเมนู kebab เมื่อคลิกที่อื่น
  useEffect(() => {
    if (menuOpenId == null) return;
    const close = () => setMenuOpenId(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menuOpenId]);

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
      navigate('/');
    }
  }, [projectId]);

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_URL}/api/brand_product/${projectId}`);
      const data = await res.json();
      if (data.status === 'success') setProducts(data.products);
    } catch (err) {
      console.error('Fetch products error:', err);
    }
  };

  // โหลดรายละเอียด (label_design) ของสินค้า
  const fetchProductDetails = async (productId) => {
    try {
      const res = await fetch(`${API_URL}/api/labels/product/${productId}`);
      const data = await res.json();
      return data.status === 'success' && data.data ? data.data : null;
    } catch (err) {
      console.error('Fetch product details error:', err);
      return null;
    }
  };

  // ===== เปิด modal เพิ่มสินค้าใหม่ =====
  const handleOpenAdd = () => {
    setEditingId(null);
    resetForm();
    setIsModalOpen(true);
  };

  // ===== เปิด modal แก้ไขสินค้า (จาก popup รายละเอียด หรือเมนู kebab) =====
  const handleOpenEdit = async (product) => {
    setEditingId(product.product_id);
    setProductName(product.name_product || '');
    setProductType(product.type_product || '');
    setImageFile(null);
    setPreviewUrl(product.image_product ? `${API_URL}/uploads/${product.image_product}` : null);
    setIsDropdownOpen(false);
    // ดึงข้อมูลของสินค้านี้เสมอ (กันใช้ detailData ของสินค้าตัวอื่นเมื่อเปิดจากเมนู kebab)
    const r = await fetchProductDetails(product.product_id);
    setDetails(r ? rowToDetails(r) : EMPTY_DETAILS);
    setOpenSection({ detail: true, care: false, manufacturer: false, legal: false });
    setDetailProduct(null); // ปิด popup รายละเอียด (ถ้าเปิดอยู่)
    setIsModalOpen(true);
  };

  // ===== ลบสินค้า =====
  const handleDeleteProduct = async (product) => {
    if (!window.confirm(`ต้องการลบสินค้า "${product.name_product}" ใช่หรือไม่?\nข้อมูลรายละเอียด ฉลาก และคอนเทนต์ที่เกี่ยวข้องจะถูกลบทั้งหมด`)) return;
    try {
      const res = await fetch(`${API_URL}/api/brand_product/${product.product_id}`, { method: 'DELETE' });
      const d = await res.json();
      if (d.status === 'success') {
        await fetchProducts();
      } else {
        alert('ลบไม่สำเร็จ: ' + (d.message || ''));
      }
    } catch (err) {
      console.error(err);
      alert('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    }
  };

  // ===== เปิด popup รายละเอียดเมื่อกดที่การ์ดสินค้า =====
  const handleOpenDetail = async (product) => {
    setDetailProduct(product);
    setDetailData(null);
    setDetailLoading(true);
    const r = await fetchProductDetails(product.product_id);
    setDetailData(r);
    setDetailLoading(false);
  };

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
    setDetails(EMPTY_DETAILS);
    setOpenSection({ detail: false, care: false, manufacturer: false, legal: false });
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

  // บันทึกรายละเอียด (content) ลง label_design ผ่าน endpoint ที่ไม่แตะฟิลด์ดีไซน์
  const saveDetails = async (productId) => {
    const payload = {
      project_id: projectId,
      product_name: productName,
      tagline: details.tagline,
      net_weight: details.netWeight,
      ingredients: details.ingredients,
      usage_instruction: details.usage,
      storage_instruction: details.storage,
      warnings: details.warnings,
      manufacturer_info: {
        name: details.mName, address: details.mAddress, phone: details.mPhone,
        line: details.mLine, facebook: details.mFacebook, website: details.mWebsite,
      },
      fda_number: details.fdaNumber,
      mfg_date: details.mfgDate,
      exp_date: details.expDate,
      lot_number: details.lotNumber,
    };
    await fetch(`${API_URL}/api/product-details/${productId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  };

  const handleSubmit = async () => {
    if (!productName.trim()) return alert('กรุณากรอกชื่อสินค้า');
    if (!productType) return alert('กรุณาเลือกประเภทสินค้า');

    setIsSaving(true);
    try {
      let productId = editingId;

      if (editingId) {
        // แก้ไขข้อมูลพื้นฐาน
        const fd = new FormData();
        fd.append('name_product', productName);
        fd.append('type_product', productType);
        if (imageFile) fd.append('image_product', imageFile);
        const res = await fetch(`${API_URL}/api/brand_product/${editingId}`, { method: 'PATCH', body: fd });
        const d = await res.json();
        if (d.status !== 'success') throw new Error(d.message || 'แก้ไขไม่สำเร็จ');
      } else {
        // เพิ่มสินค้าใหม่
        const fd = new FormData();
        fd.append('project_id', projectId);
        fd.append('name_product', productName);
        fd.append('type_product', productType);
        if (imageFile) fd.append('image_product', imageFile);
        const res = await fetch(`${API_URL}/api/brand_product`, { method: 'POST', body: fd });
        const d = await res.json();
        if (d.status !== 'success') throw new Error(d.message || 'เพิ่มไม่สำเร็จ');
        productId = d.product_id;
      }

      // บันทึกรายละเอียดที่นำไปใช้ต่อใน Label / Mockup
      if (productId) await saveDetails(productId);

      await fetchProducts();
      handleCloseModal();
    } catch (err) {
      console.error(err);
      alert(err.message || 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    } finally {
      setIsSaving(false);
    }
  };

  // ค่ารายละเอียดสำหรับแสดงใน popup
  const dv = detailData ? rowToDetails(detailData) : null;
  const hasDetailSection = dv && (dv.tagline || dv.netWeight || dv.ingredients);
  const hasCareSection = dv && (dv.usage || dv.storage || dv.warnings);
  const hasManufacturer = dv && (dv.mName || dv.mAddress || dv.mPhone || dv.mLine || dv.mFacebook || dv.mWebsite);
  const hasLegal = dv && (dv.fdaNumber || dv.mfgDate || dv.expDate || dv.lotNumber);
  const hasAnyDetail = hasDetailSection || hasCareSection || hasManufacturer || hasLegal;

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
          <NotificationBell className="pd-btn-world" />
          <NavProfileButton className="pd-btn-users" />
        </div>
      </header>

      <div className="pd-container">

        {/* Sidebar */}
        <ProductSidebar projectId={projectId} />

        {/* Main Content */}
        <main className="pd-main">

          <h1 className="pd-page-title" lang="en">My Products</h1>
          <p className="pd-page-subtitle">จัดการรายการสินค้าของโปรเจกต์คุณ</p>

          {products.length === 0 ? (
            <div className="pd-empty-state">
              <div className="pd-empty-icon">
                <iconify-icon icon="mdi:package-variant-closed"></iconify-icon>
              </div>
              <p className="pd-empty-title">ยังไม่มีสินค้าในโปรเจกต์นี้</p>
              <button className="pd-add-first-btn" onClick={handleOpenAdd}>
                <iconify-icon icon="mdi:plus"></iconify-icon> เพิ่มสินค้าแรก
              </button>
            </div>
          ) : (
            <div className="pd-cards-grid">
              {products.map((product, index) => (
                <div
                  key={product.product_id || index}
                  className="pd-product-card pd-card-clickable"
                  onClick={() => handleOpenDetail(product)}
                >
                  <div className="pd-card-index">{index + 1}</div>

                  {/* Kebab menu (มุมขวาบน) */}
                  <button
                    className="pd-card-menu-btn"
                    aria-label="เมนู"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId(menuOpenId === product.product_id ? null : product.product_id);
                    }}
                  >
                    <iconify-icon icon="mdi:dots-vertical"></iconify-icon>
                  </button>
                  {menuOpenId === product.product_id && (
                    <div className="pd-card-menu" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="pd-card-menu-item"
                        onClick={() => { setMenuOpenId(null); handleOpenEdit(product); }}
                      >
                        <iconify-icon icon="mdi:pencil-outline"></iconify-icon> แก้ไขข้อมูล
                      </button>
                      <button
                        className="pd-card-menu-item pd-menu-danger"
                        onClick={() => { setMenuOpenId(null); handleDeleteProduct(product); }}
                      >
                        <iconify-icon icon="mdi:trash-can-outline"></iconify-icon> ลบรายการสินค้า
                      </button>
                    </div>
                  )}

                  {/* แสดงเฉพาะรูปที่มีจริง (ไม่แสดงกรอบว่าง) */}
                  <div className="pd-card-image-row">
                    <div className="pd-image-box pd-image-main">
                      {product.image_product ? (
                        <img
                          src={`${API_URL}/uploads/${product.image_product}`}
                          alt={product.name_product}
                        />
                      ) : (
                        <iconify-icon icon="mdi:image-outline"></iconify-icon>
                      )}
                    </div>
                  </div>
                  <div className="pd-card-footer">
                    <h3 className="pd-card-name">{product.name_product}</h3>
                    {product.type_product && (
                      <span className="pd-card-type">{product.type_product}</span>
                    )}
                  </div>
                  <div className="pd-card-hint">
                    <iconify-icon icon="mdi:eye-outline"></iconify-icon> ดูรายละเอียด
                  </div>
                </div>
              ))}

              {/* Add More Card */}
              <div className="pd-product-card pd-add-card" onClick={handleOpenAdd}>
                <iconify-icon icon="mdi:plus-circle-outline"></iconify-icon>
                <p>เพิ่มสินค้าใหม่</p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* FAB */}
      {products.length > 0 && (
        <button className="pd-fab" onClick={handleOpenAdd}>
          <iconify-icon icon="tabler:plus" width="28" height="28"></iconify-icon>
        </button>
      )}

      {/* ===== Modal: เพิ่ม / แก้ไขสินค้า ===== */}
      {isModalOpen && (
        <div className="cncpt-cc-modal pd-no-blur" onClick={handleCloseModal}>
          <div className="cncpt-cc-modal-box pd-modal-box" onClick={(e) => e.stopPropagation()}>
            <button className="cncpt-cc-close" onClick={handleCloseModal}>✕</button>

            <h2 className="pd-modal-title">
              {editingId ? 'แก้ไขข้อมูลสินค้า' : 'เพิ่มสินค้าใหม่'}
            </h2>

            {/* Step 1 */}
            <div className="cncpt-form-group">
              <label>
                <span className="cncpt-step">1</span>
                สินค้าของคุณคืออะไร
                <span className="cncpt-req-star">*</span>
              </label>
              <input
                type="text"
                placeholder="เช่น โดนัท"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
              />
            </div>

            {/* Step 2 */}
            <div className="cncpt-form-group">
              <label><span className="cncpt-step">2</span> ประเภทสินค้า <span className="cncpt-req-star">*</span></label>
              <div className={`cncpt-cc-dd${isDropdownOpen ? ' cncpt-open' : ''}`}>
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

            {/* ===== ข้อมูลเพิ่มเติม (นำไปใช้ต่อใน Label / Mockup) ===== */}
            <p className="pd-extra-note">
              <iconify-icon icon="mdi:information-outline"></iconify-icon>
              ข้อมูลเพิ่มเติมด้านล่าง (ไม่บังคับ) จะถูกนำไปใช้ในฟีเจอร์ฉลาก (Label) และ Mockup โดยอัตโนมัติ ไม่ต้องกรอกซ้ำ
            </p>

            <FormSection title="รายละเอียดสินค้า" icon="mdi:text-box-outline" open={openSection.detail} onToggle={() => toggleSection('detail')}>
              <LabeledInput label="คำโปรย (Tagline)" value={details.tagline} onChange={(v) => setDetail('tagline', v)} placeholder="เช่น อร่อยทุกคำ หอมกลิ่นใบเตย" />
              <LabeledInput label="ปริมาณสุทธิ" value={details.netWeight} onChange={(v) => setDetail('netWeight', v)} placeholder="เช่น 200 กรัม / 500 ml" />
              <LabeledTextarea label="ส่วนประกอบ" value={details.ingredients} onChange={(v) => setDetail('ingredients', v)} placeholder="เช่น แป้ง 40%, น้ำตาล 30%, กะทิ 20%" rows={3} />
            </FormSection>

            <FormSection title="การใช้งานและการเก็บรักษา" icon="mdi:clipboard-text-outline" open={openSection.care} onToggle={() => toggleSection('care')}>
              <LabeledTextarea label="วิธีใช้ / วิธีรับประทาน" value={details.usage} onChange={(v) => setDetail('usage', v)} placeholder="เช่น ชงในน้ำร้อน, พร้อมรับประทาน" />
              <LabeledTextarea label="วิธีเก็บรักษา" value={details.storage} onChange={(v) => setDetail('storage', v)} placeholder="เช่น เก็บในที่แห้งและเย็น หลีกเลี่ยงแสงแดด" />
              <LabeledTextarea label="คำเตือน" value={details.warnings} onChange={(v) => setDetail('warnings', v)} placeholder="เช่น เก็บให้พ้นมือเด็ก, มีส่วนผสมของถั่ว" />
            </FormSection>

            <FormSection title="ข้อมูลผู้ผลิต" icon="mdi:factory" open={openSection.manufacturer} onToggle={() => toggleSection('manufacturer')}>
              <LabeledInput label="ชื่อผู้ผลิต / ร้าน" value={details.mName} onChange={(v) => setDetail('mName', v)} placeholder="เช่น วิสาหกิจชุมชนบ้านสวน" />
              <LabeledTextarea label="ที่อยู่" value={details.mAddress} onChange={(v) => setDetail('mAddress', v)} placeholder="ที่อยู่ผู้ผลิต" />
              <div className="pd-field-grid">
                <LabeledInput label="เบอร์โทร" value={details.mPhone} onChange={(v) => setDetail('mPhone', v)} placeholder="0xx-xxx-xxxx" />
                <LabeledInput label="LINE" value={details.mLine} onChange={(v) => setDetail('mLine', v)} placeholder="@yourline" />
                <LabeledInput label="Facebook" value={details.mFacebook} onChange={(v) => setDetail('mFacebook', v)} placeholder="ชื่อเพจ" />
                <LabeledInput label="เว็บไซต์" value={details.mWebsite} onChange={(v) => setDetail('mWebsite', v)} placeholder="https://" />
              </div>
            </FormSection>

            <FormSection title="ข้อมูลกฎหมาย / วันที่" icon="mdi:certificate-outline" open={openSection.legal} onToggle={() => toggleSection('legal')}>
              <div className="pd-field-grid">
                <LabeledInput label="เลข อย." value={details.fdaNumber} onChange={(v) => setDetail('fdaNumber', v)} placeholder="xx-x-xxxxx-x-xxxx" />
                <LabeledInput label="LOT" value={details.lotNumber} onChange={(v) => setDetail('lotNumber', v)} placeholder="เช่น A001" />
                <LabeledInput label="วันผลิต" type="date" value={details.mfgDate} onChange={(v) => setDetail('mfgDate', v)} />
                <LabeledInput label="วันหมดอายุ" type="date" value={details.expDate} onChange={(v) => setDetail('expDate', v)} />
              </div>
            </FormSection>

            {/* Actions */}
            <div className="cncpt-modal-actions">
              <button className="cncpt-cancel-btn" onClick={handleCloseModal} disabled={isSaving}>ยกเลิก</button>
              <button className="cncpt-confirm-btn" onClick={handleSubmit} disabled={isSaving}>
                {isSaving ? 'กำลังบันทึก...' : editingId ? 'บันทึกการแก้ไข' : 'เพิ่มสินค้า'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Popup: รายละเอียดสินค้า ===== */}
      {detailProduct && (
        <div className="cncpt-cc-modal pd-no-blur" onClick={() => setDetailProduct(null)}>
          <div className="cncpt-cc-modal-box pd-detail-box" onClick={(e) => e.stopPropagation()}>
            <button className="cncpt-cc-close" onClick={() => setDetailProduct(null)}>✕</button>

            {/* Header */}
            <div className="pd-detail-header">
              <div className="pd-detail-image">
                {detailProduct.image_product ? (
                  <img src={`${API_URL}/uploads/${detailProduct.image_product}`} alt={detailProduct.name_product} />
                ) : (
                  <iconify-icon icon="mdi:image-outline"></iconify-icon>
                )}
              </div>
              <div className="pd-detail-head-info">
                <h2 className="pd-detail-name">{detailProduct.name_product}</h2>
                {detailProduct.type_product && (
                  <span className="pd-card-type">{detailProduct.type_product}</span>
                )}
              </div>
            </div>

            {/* Body */}
            {detailLoading ? (
              <div className="pd-detail-loading">
                <iconify-icon icon="mdi:loading" className="pd-spin"></iconify-icon> กำลังโหลดข้อมูล...
              </div>
            ) : !hasAnyDetail ? (
              <div className="pd-detail-empty">
                <iconify-icon icon="mdi:text-box-remove-outline"></iconify-icon>
                <p>ยังไม่มีรายละเอียดเพิ่มเติม</p>
                <span>กด "แก้ไขข้อมูล" เพื่อเพิ่มรายละเอียดที่จะนำไปใช้ในฉลากและ Mockup</span>
              </div>
            ) : (
              <div className="pd-detail-body">
                {hasDetailSection && (
                  <div className="pd-detail-group">
                    <h4 className="pd-detail-group-title"><iconify-icon icon="mdi:text-box-outline"></iconify-icon> รายละเอียดสินค้า</h4>
                    <InfoRow label="คำโปรย" value={dv.tagline} />
                    <InfoRow label="ปริมาณสุทธิ" value={dv.netWeight} />
                    <InfoRow label="ส่วนประกอบ" value={dv.ingredients} />
                  </div>
                )}
                {hasCareSection && (
                  <div className="pd-detail-group">
                    <h4 className="pd-detail-group-title"><iconify-icon icon="mdi:clipboard-text-outline"></iconify-icon> การใช้งานและการเก็บรักษา</h4>
                    <InfoRow label="วิธีใช้" value={dv.usage} />
                    <InfoRow label="วิธีเก็บรักษา" value={dv.storage} />
                    <InfoRow label="คำเตือน" value={dv.warnings} />
                  </div>
                )}
                {hasManufacturer && (
                  <div className="pd-detail-group">
                    <h4 className="pd-detail-group-title"><iconify-icon icon="mdi:factory"></iconify-icon> ข้อมูลผู้ผลิต</h4>
                    <InfoRow label="ชื่อผู้ผลิต" value={dv.mName} />
                    <InfoRow label="ที่อยู่" value={dv.mAddress} />
                    <InfoRow label="เบอร์โทร" value={dv.mPhone} />
                    <InfoRow label="LINE" value={dv.mLine} />
                    <InfoRow label="Facebook" value={dv.mFacebook} />
                    <InfoRow label="เว็บไซต์" value={dv.mWebsite} />
                  </div>
                )}
                {hasLegal && (
                  <div className="pd-detail-group">
                    <h4 className="pd-detail-group-title"><iconify-icon icon="mdi:certificate-outline"></iconify-icon> ข้อมูลกฎหมาย / วันที่</h4>
                    <InfoRow label="เลข อย." value={dv.fdaNumber} />
                    <InfoRow label="LOT" value={dv.lotNumber} />
                    <InfoRow label="วันผลิต" value={dv.mfgDate} />
                    <InfoRow label="วันหมดอายุ" value={dv.expDate} />
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="cncpt-modal-actions">
              <button className="cncpt-cancel-btn" onClick={() => setDetailProduct(null)}>ปิด</button>
              <button className="cncpt-confirm-btn" onClick={() => handleOpenEdit(detailProduct)}>
                <iconify-icon icon="mdi:pencil"></iconify-icon> แก้ไขข้อมูล
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
