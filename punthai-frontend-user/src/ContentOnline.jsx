import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './content-online.css';
import { fetchSubscriptionStatus } from './utils/subscriptionGuard';
import ProUpgradeModal from './components/ProUpgradeModal';
import { API_URL } from './config';

const API = `${API_URL}`;

const PLATFORMS = [
  { id: 'facebook', name: 'Facebook Post', icon: 'logos:facebook', size: '1200x630' },
  { id: 'ig_feed', name: 'Instagram Feed', icon: 'skill-icons:instagram', size: '1080x1080' },
  { id: 'ig_story', name: 'Instagram Story', icon: 'skill-icons:instagram', size: '1080x1920' },
  { id: 'line', name: 'LINE OA', icon: 'logos:line', size: '1040x1040' },
  { id: 'tiktok', name: 'TikTok', icon: 'logos:tiktok-icon', size: '1080x1920' },
];

const STEP_LABELS = [
  'เลือกโปรเจค',
  'เลือกสินค้า',
  'แพลตฟอร์ม',
  'แบบโฆษณา',
  'รายละเอียด',
  'เลือกรูป',
  'สร้างโฆษณา',
];

const ContentOnline = ({ user }) => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Stepper
  const [step, setStep] = useState(1);

  // Step 1 — Projects
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);

  // Step 2 — Products
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductType, setNewProductType] = useState('');
  const [newProductImage, setNewProductImage] = useState(null);
  const [newProductPreview, setNewProductPreview] = useState(null);
  const addProductFileRef = useRef(null);
  const categories = [
    { label: 'อาหาร / ของกินเล่น', value: 'อาหาร / ของกินเล่น' },
    { label: 'เครื่องดื่ม', value: 'เครื่องดื่ม' },
    { label: 'เสื้อผ้า', value: 'เสื้อผ้า' },
    { label: 'ความงาม', value: 'ความงาม' },
    { label: 'ของใช้', value: 'ของใช้' },
  ];

  // Step 3 — Platform
  const [selectedPlatform, setSelectedPlatform] = useState(null);

  // Step 4 — Templates
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);

  // Step 5 — Details
  const [formData, setFormData] = useState({ productName: '', price: '', slogan: '', details: '' });

  // Step 6 — Image Source
  const [productImages, setProductImages] = useState([]);
  const [mockupImages, setMockupImages] = useState([]);
  const [selectedImageUrl, setSelectedImageUrl] = useState(null);
  const [selectedImageType, setSelectedImageType] = useState(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState(null);

  // Step 7 — Generate & Result
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ step: 0, total: 5, message: '' });
  const [result, setResult] = useState(null); // { image_url, caption_th, caption_en }
  const [copiedField, setCopiedField] = useState(null);

  // History
  const [history, setHistory] = useState([]);
  const [historyDetail, setHistoryDetail] = useState(null);
  const [showProModal, setShowProModal] = useState(false);
  const [usageInfo, setUsageInfo] = useState(null);

  // ===== Fetch generation usage =====
  useEffect(() => {
    if (user?.user_id) {
      fetchSubscriptionStatus(user.user_id).then(data => {
        if (data) setUsageInfo(data);
      });
    }
  }, [user]);

  // ===== Data Fetching =====
  useEffect(() => {
    if (user) fetchProjects();
  }, [user]);

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${API}/api/projects/${user.user_id}`);
      const data = await res.json();
      if (data.status === 'success') setProjects(data.projects);
    } catch (err) { console.error(err); }
  };

  const fetchProducts = async (projId) => {
    try {
      const res = await fetch(`${API}/api/brand_product/${projId}`);
      const data = await res.json();
      if (data.status === 'success') setProducts(data.products);
    } catch (err) { console.error(err); }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch(`${API}/api/ad-templates`);
      const data = await res.json();
      if (data.status === 'success') setTemplates(data.templates);
    } catch (err) { console.error(err); }
  };

  const fetchImages = async (projId, prodId) => {
    try {
      const res = await fetch(`${API}/api/content-online/images/${projId}/${prodId}`);
      const data = await res.json();
      if (data.status === 'success') {
        setProductImages(data.product_images);
        setMockupImages(data.mockup_images);
      }
    } catch (err) { console.error(err); }
  };

  const fetchHistory = async (projId, prodId) => {
    try {
      const res = await fetch(`${API}/api/content-online/history/${projId}/${prodId}`);
      const data = await res.json();
      if (data.status === 'success') setHistory(data.history);
    } catch (err) { console.error(err); }
  };

  // ===== Step Navigation =====
  const goToStep = (s) => {
    if (s <= step) setStep(s);
  };

  const handleSelectProject = (projId) => {
    setSelectedProjectId(projId);
    fetchProducts(projId);
    setStep(2);
  };

  const handleSelectProduct = (product) => {
    setSelectedProductId(product.product_id);
    setSelectedProduct(product);
    setFormData(prev => ({ ...prev, productName: product.name_product || '' }));
    fetchHistory(selectedProjectId, product.product_id);
    setStep(3);
  };

  const handleSelectPlatform = (platformId) => {
    setSelectedPlatform(platformId);
    fetchTemplates();
    setStep(4);
  };

  const handleSelectTemplate = (tplId) => {
    setSelectedTemplateId(tplId);
    setStep(5);
  };

  const handleDetailsNext = () => {
    if (!formData.productName) return alert('กรุณากรอกชื่อสินค้า');
    fetchImages(selectedProjectId, selectedProductId);
    setStep(6);
  };

  const handleSelectImage = (url, type) => {
    setSelectedImageUrl(url);
    setSelectedImageType(type);
  };

  // ===== Add Product Modal =====
  const handleAddProduct = async () => {
    if (!newProductName) return alert('กรุณากรอกชื่อสินค้า');
    if (!newProductType) return alert('กรุณาเลือกประเภทสินค้า');

    const fd = new FormData();
    fd.append('project_id', selectedProjectId);
    fd.append('name_product', newProductName);
    fd.append('type_product', newProductType);
    if (newProductImage) fd.append('image_product', newProductImage);

    try {
      const res = await fetch(`${API}/api/brand_product`, { method: 'POST', body: fd });
      const data = await res.json();
      if (data.status === 'success') {
        fetchProducts(selectedProjectId);
        setShowAddProduct(false);
        setNewProductName('');
        setNewProductType('');
        setNewProductImage(null);
        setNewProductPreview(null);
      } else {
        alert(data.message);
      }
    } catch (err) { alert('เชื่อมต่อ Server ไม่ได้'); }
  };

  // ===== Upload Custom Image =====
  const handleUploadImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('image', file);
    try {
      const res = await fetch(`${API}/api/content-online/upload-image`, { method: 'POST', body: fd });
      const data = await res.json();
      if (data.status === 'success') {
        setUploadedImageUrl(data.image_url);
        setSelectedImageUrl(data.image_url);
        setSelectedImageType('upload');
      }
    } catch (err) { alert('อัพโหลดไม่สำเร็จ'); }
  };

  // ===== Generate =====
  const handleGenerate = async (mode = 'both') => {
    if (mode !== 'caption_only' && user?.user_id) {
      try {
        const status = await fetchSubscriptionStatus(user.user_id);
        if (status && !status.generation.allowed) {
          setUsageInfo(status);
          setShowProModal(true);
          return;
        }
        setUsageInfo(status);
      } catch (e) { /* continue — backend guard will catch */ }
    }
    setIsGenerating(true);
    setProgress({ step: 0, total: 5, message: 'เริ่มต้น...' });
    if (mode === 'both') setResult(null);

    const body = {
      project_id: selectedProjectId,
      product_id: selectedProductId,
      user_id: user.user_id,
      template_id: selectedTemplateId,
      platform: selectedPlatform,
      product_name: formData.productName,
      price: formData.price,
      slogan: formData.slogan,
      additional_details: formData.details,
      source_image_url: selectedImageUrl,
      source_image_type: selectedImageType,
      mode: mode,
      existing_image_url: result?.image_url || null,
    };

    try {
      const response = await fetch(`${API}/api/content-online/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.status === 403) {
        const errData = await response.json();
        if (errData.status === 'limit_reached') {
          setShowProModal(true);
          setIsGenerating(false);
          return;
        }
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const eventType = line.replace('event: ', '');
            continue;
          }
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.replace('data: ', ''));
              if (data.step) {
                setProgress(data);
              }
              if (data.image_url !== undefined) {
                setResult(prev => ({
                  image_url: data.image_url || prev?.image_url || null,
                  caption_th: data.caption_th || prev?.caption_th || null,
                  caption_en: data.caption_en || prev?.caption_en || null,
                }));
                setStep(7);
                fetchHistory(selectedProjectId, selectedProductId);
              }
              if (data.message && !data.step) {
                alert(data.message);
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // ===== Copy & Download =====
  const handleCopy = async (text, field) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch { alert('คัดลอกไม่สำเร็จ'); }
  };

  const handleDownload = async (imageUrl) => {
    try {
      const res = await fetch(`${API}${imageUrl}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ad_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { alert('ดาวน์โหลดไม่สำเร็จ'); }
  };

  // ===== Share =====
  const handleShareFacebook = () => {
    const imgFullUrl = `${API}${result.image_url}`;
    const caption = result.caption_th || '';
    const fbAppId = import.meta.env.VITE_FACEBOOK_APP_ID || '';
    if (fbAppId) {
      const url = `https://www.facebook.com/dialog/feed?app_id=${fbAppId}&link=${encodeURIComponent(imgFullUrl)}&quote=${encodeURIComponent(caption)}&redirect_uri=${encodeURIComponent(window.location.href)}`;
      window.open(url, '_blank', 'width=600,height=400');
    } else {
      const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(imgFullUrl)}&quote=${encodeURIComponent(caption)}`;
      window.open(url, '_blank', 'width=600,height=400');
    }
  };

  const handleShareInstagram = async () => {
    if (result?.caption_th) {
      await navigator.clipboard.writeText(result.caption_th);
    }
    handleDownload(result.image_url);
    alert('ดาวน์โหลดรูปแล้ว + คัดลอกแคปชั่นแล้ว\nกรุณาเปิด Instagram แล้ววางข้อความ');
    window.open('https://www.instagram.com/', '_blank');
  };

  // ===== Login Check =====
  if (!user) {
    return (
      <div className="co-page">
        <div className="co-section" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <iconify-icon icon="mdi:lock-outline" style={{ fontSize: '60px', color: '#ccc' }}></iconify-icon>
          <h2 style={{ marginTop: '15px', color: '#666' }}>กรุณาเข้าสู่ระบบ</h2>
          <p style={{ color: '#999' }}>คุณต้องเข้าสู่ระบบก่อนใช้งานฟีเจอร์ Content Online</p>
        </div>
      </div>
    );
  }

  return (
    <div className="co-page">
      {/* Header */}
      <div className="co-header">
        <h1 lang="en">Content Online</h1>
        <p>สร้างภาพโฆษณาและแคปชั่นสำหรับโพสต์ลงโซเชียลมีเดีย ด้วยพลัง AI</p>
      </div>

      {/* Stepper */}
      <div className="co-stepper">
        {STEP_LABELS.map((label, i) => (
          <React.Fragment key={i}>
            {i > 0 && <div className={`co-step-line ${i < step ? 'done' : ''}`} />}
            <div
              className={`co-step-item ${step === i + 1 ? 'active' : ''} ${i + 1 < step ? 'completed' : ''}`}
              onClick={() => goToStep(i + 1)}
            >
              <div className="co-step-circle">
                {i + 1 < step ? <iconify-icon icon="mdi:check" style={{ fontSize: '16px' }}></iconify-icon> : i + 1}
              </div>
              {label}
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* ===== Step 1: เลือกโปรเจค ===== */}
      {step === 1 && (
        <div className="co-section">
          <h2 className="co-section-title">เลือกโปรเจค</h2>
          <p className="co-section-desc">เลือกโปรเจคที่คุณต้องการสร้างโฆษณา</p>
          {projects.length === 0 ? (
            <div className="co-empty">
              <iconify-icon icon="mdi:folder-plus-outline"></iconify-icon>
              <p>คุณยังไม่มีโปรเจค</p>
              <button className="co-btn-primary" style={{ margin: '15px auto 0' }}
                onClick={async () => {
                  try {
                    const res = await fetch(`${API}/api/projects`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ user_id: user.user_id }),
                    });
                    const data = await res.json();
                    if (data.status === 'success') {
                      fetchProjects();
                    } else { alert(data.message); }
                  } catch { alert('เชื่อมต่อ Server ไม่ได้'); }
                }}>
                <iconify-icon icon="mdi:plus"></iconify-icon> สร้างโปรเจคใหม่
              </button>
            </div>
          ) : (
            <div className="co-card-grid">
              {projects.map(proj => (
                <div key={proj.project_id}
                  className={`co-card ${selectedProjectId === proj.project_id ? 'selected' : ''}`}
                  onClick={() => handleSelectProject(proj.project_id)}>
                  {proj.image_logo ? (
                    <img src={`${API}${proj.image_logo}`} alt="" className="co-card-img" />
                  ) : (
                    <iconify-icon icon="solar:folder-with-files-bold-duotone" style={{ fontSize: '50px', color: '#ccc' }}></iconify-icon>
                  )}
                  <div className="co-card-name">{proj.project_name || 'โปรเจคยังไม่ได้ตั้งชื่อ'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== Step 2: เลือกสินค้า ===== */}
      {step === 2 && (
        <div className="co-section">
          <h2 className="co-section-title">เลือกสินค้า</h2>
          <p className="co-section-desc">เลือกสินค้าที่ต้องการทำโฆษณา</p>
          <div className="co-card-grid">
            <div className="co-card create-new" onClick={() => setShowAddProduct(true)}>
              <iconify-icon icon="mdi:plus-circle-outline"></iconify-icon>
              <div className="co-card-name">เพิ่มสินค้าใหม่</div>
            </div>
            {products.map(prod => (
              <div key={prod.product_id}
                className={`co-card ${selectedProductId === prod.product_id ? 'selected' : ''}`}
                onClick={() => handleSelectProduct(prod)}>
                {prod.image_product ? (
                  <img src={`${API}/uploads/${prod.image_product}`} alt="" className="co-card-img" />
                ) : (
                  <iconify-icon icon="mdi:package-variant" style={{ fontSize: '50px', color: '#ccc' }}></iconify-icon>
                )}
                <div className="co-card-name">{prod.name_product}</div>
                <div className="co-card-sub">{prod.type_product}</div>
              </div>
            ))}
          </div>
          <div className="co-btn-row">
            <button className="co-btn-back" onClick={() => setStep(1)}>
              <iconify-icon icon="mdi:arrow-left"></iconify-icon> ย้อนกลับ
            </button>
          </div>
        </div>
      )}

      {/* ===== Step 3: เลือกแพลตฟอร์ม ===== */}
      {step === 3 && (
        <div className="co-section">
          <h2 className="co-section-title">เลือกแพลตฟอร์ม</h2>
          <p className="co-section-desc">เลือกแพลตฟอร์มที่ต้องการโพสต์ ขนาดภาพจะปรับอัตโนมัติ</p>
          <div className="co-platform-grid">
            {PLATFORMS.map(p => (
              <div key={p.id}
                className={`co-platform-card ${selectedPlatform === p.id ? 'selected' : ''}`}
                onClick={() => handleSelectPlatform(p.id)}>
                <iconify-icon icon={p.icon}></iconify-icon>
                <div className="co-platform-name">{p.name}</div>
                <div className="co-platform-size">{p.size}</div>
              </div>
            ))}
          </div>
          <div className="co-btn-row">
            <button className="co-btn-back" onClick={() => setStep(2)}>
              <iconify-icon icon="mdi:arrow-left"></iconify-icon> ย้อนกลับ
            </button>
          </div>
        </div>
      )}

      {/* ===== Step 4: เลือก Template ===== */}
      {step === 4 && (
        <div className="co-section">
          <h2 className="co-section-title">เลือกแบบโฆษณา</h2>
          <p className="co-section-desc">เลือกสไตล์โฆษณาที่ต้องการ</p>
          <div className="co-template-grid">
            {templates.map(tpl => (
              <div key={tpl.template_id}
                className={`co-template-card ${selectedTemplateId === tpl.template_id ? 'selected' : ''}`}
                onClick={() => handleSelectTemplate(tpl.template_id)}>
                <div className="co-template-thumb">
                  {tpl.thumbnail_url ? (
                    <img src={`${API}${tpl.thumbnail_url}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <iconify-icon icon="mdi:image-filter-vintage"></iconify-icon>
                  )}
                </div>
                <div className="co-template-info">
                  <div className="co-template-name">{tpl.template_name_th}</div>
                  <div className="co-template-cat">{tpl.category}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="co-btn-row">
            <button className="co-btn-back" onClick={() => setStep(3)}>
              <iconify-icon icon="mdi:arrow-left"></iconify-icon> ย้อนกลับ
            </button>
          </div>
        </div>
      )}

      {/* ===== Step 5: กรอกรายละเอียด ===== */}
      {step === 5 && (
        <div className="co-section">
          <h2 className="co-section-title">กรอกรายละเอียดสินค้า</h2>
          <p className="co-section-desc">ข้อมูลเหล่านี้จะถูกใช้ในการสร้างภาพโฆษณาและแคปชั่น</p>

          <div className="co-form-group">
            <label>ชื่อสินค้า</label>
            <input className="co-input" value={formData.productName}
              onChange={e => setFormData({ ...formData, productName: e.target.value })}
              placeholder="เช่น โดนัทช็อกโกแลต" />
          </div>
          <div className="co-form-group">
            <label>ราคา</label>
            <input className="co-input" value={formData.price}
              onChange={e => setFormData({ ...formData, price: e.target.value })}
              placeholder="เช่น 59 บาท" />
          </div>
          <div className="co-form-group">
            <label>สโลแกน <span className="optional">(ไม่บังคับ)</span></label>
            <input className="co-input" value={formData.slogan}
              onChange={e => setFormData({ ...formData, slogan: e.target.value })}
              placeholder="เช่น อร่อยทุกคำ หอมทุกชิ้น" />
          </div>
          <div className="co-form-group">
            <label>รายละเอียดเพิ่มเติม <span className="optional">(ไม่บังคับ)</span></label>
            <textarea className="co-textarea" value={formData.details}
              onChange={e => setFormData({ ...formData, details: e.target.value })}
              placeholder="เช่น ใช้วัตถุดิบพรีเมียม นำเข้าจากเบลเยียม" />
          </div>

          <div className="co-btn-row">
            <button className="co-btn-back" onClick={() => setStep(4)}>
              <iconify-icon icon="mdi:arrow-left"></iconify-icon> ย้อนกลับ
            </button>
            <button className="co-btn-primary" onClick={handleDetailsNext}>
              ถัดไป <iconify-icon icon="mdi:arrow-right"></iconify-icon>
            </button>
          </div>
        </div>
      )}

      {/* ===== Step 6: เลือกรูปภาพ ===== */}
      {step === 6 && (
        <div className="co-section">
          <h2 className="co-section-title">เลือกรูปภาพสินค้า</h2>
          <p className="co-section-desc">เลือกรูปที่จะใช้เป็นต้นแบบในการสร้างภาพโฆษณา</p>

          {/* รูปสินค้าจริง */}
          {productImages.length > 0 && (
            <div className="co-image-source-section">
              <div className="co-image-source-title">
                <iconify-icon icon="mdi:camera"></iconify-icon> รูปสินค้าจริง
              </div>
              <div className="co-image-grid">
                {productImages.map((img, i) => (
                  <div key={`prod-${i}`}
                    className={`co-image-option ${selectedImageUrl === img.url && selectedImageType === 'product' ? 'selected' : ''}`}
                    onClick={() => handleSelectImage(img.url, 'product')}>
                    <img src={`${API}${img.url}`} alt="" />
                    <div className="co-check"><iconify-icon icon="mdi:check"></iconify-icon></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* รูป Mockup AI */}
          {mockupImages.length > 0 && (
            <div className="co-image-source-section">
              <div className="co-image-source-title">
                <iconify-icon icon="mdi:auto-fix"></iconify-icon> รูป Mockup จาก AI
              </div>
              <div className="co-image-grid">
                {mockupImages.map((img, i) => (
                  <div key={`mock-${i}`}
                    className={`co-image-option ${selectedImageUrl === img.url && selectedImageType === 'mockup' ? 'selected' : ''}`}
                    onClick={() => handleSelectImage(img.url, 'mockup')}>
                    <img src={`${API}${img.url}`} alt="" />
                    <div className="co-check"><iconify-icon icon="mdi:check"></iconify-icon></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* อัพโหลดรูปใหม่ */}
          <div className="co-image-source-section">
            <div className="co-image-source-title">
              <iconify-icon icon="mdi:upload"></iconify-icon> อัพโหลดรูปใหม่
            </div>
            <input type="file" accept="image/*" hidden ref={fileInputRef} onChange={handleUploadImage} />
            {uploadedImageUrl ? (
              <div className="co-image-grid">
                <div className={`co-image-option ${selectedImageType === 'upload' ? 'selected' : ''}`}
                  onClick={() => handleSelectImage(uploadedImageUrl, 'upload')}>
                  <img src={`${API}${uploadedImageUrl}`} alt="" />
                  <div className="co-check"><iconify-icon icon="mdi:check"></iconify-icon></div>
                </div>
                <div className="co-upload-zone" onClick={() => fileInputRef.current.click()} style={{ aspectRatio: '1' }}>
                  <iconify-icon icon="mdi:cloud-upload-outline"></iconify-icon>
                  <p style={{ fontSize: '12px' }}>เปลี่ยนรูป</p>
                </div>
              </div>
            ) : (
              <div className="co-upload-zone" onClick={() => fileInputRef.current.click()}>
                <iconify-icon icon="mdi:cloud-upload-outline"></iconify-icon>
                <p>คลิกหรือลากรูปมาวางที่นี่</p>
              </div>
            )}
          </div>

          {usageInfo && (
            <div style={{ textAlign: 'center', margin: '8px 0', fontSize: 13, color: usageInfo.generation.remaining <= 1 ? '#e53e3e' : '#888' }}>
              <iconify-icon icon="mdi:image-auto-adjust" style={{ verticalAlign: 'middle', marginRight: 4 }}></iconify-icon>
              ใช้ไป {usageInfo.generation.used}/{usageInfo.generation.limit} ครั้ง
              {usageInfo.generation.period === 'lifetime' ? ' (ตลอดชีพ)' : ' (เดือนนี้)'}
            </div>
          )}

          <div className="co-btn-row">
            <button className="co-btn-back" onClick={() => setStep(5)}>
              <iconify-icon icon="mdi:arrow-left"></iconify-icon> ย้อนกลับ
            </button>
            <button className="co-btn-primary" disabled={!selectedImageUrl || isGenerating}
              onClick={() => handleGenerate('both')}>
              <iconify-icon icon="mdi:auto-fix"></iconify-icon> สร้างโฆษณา
            </button>
          </div>
        </div>
      )}

      {/* ===== Generating Progress ===== */}
      {isGenerating && (
        <div className="co-section">
          <div className="co-progress">
            <div className="co-spinner"></div>
            <div className="co-progress-bar">
              <div className="co-progress-fill" style={{ width: `${(progress.step / progress.total) * 100}%` }} />
            </div>
            <div className="co-progress-text">{progress.message}</div>
          </div>
        </div>
      )}

      {/* ===== Step 7: ผลลัพธ์ ===== */}
      {step === 7 && result && !isGenerating && (
        <div className="co-section">
          <h2 className="co-section-title">ผลลัพธ์โฆษณาของคุณ</h2>

          <div className="co-result">
            {/* รูปโฆษณา */}
            <div className="co-result-image">
              {result.image_url && (
                <img src={`${API}${result.image_url}`} alt="Ad Result" />
              )}
            </div>

            {/* แคปชั่น */}
            <div className="co-result-captions">
              {result.caption_th && (
                <div className="co-caption-box">
                  <div className="co-caption-label">
                    <span>แคปชั่นภาษาไทย</span>
                    <button className={`co-caption-copy ${copiedField === 'th' ? 'copied' : ''}`}
                      onClick={() => handleCopy(result.caption_th, 'th')}>
                      <iconify-icon icon={copiedField === 'th' ? 'mdi:check' : 'mdi:content-copy'}></iconify-icon>
                      {copiedField === 'th' ? 'คัดลอกแล้ว' : 'คัดลอก'}
                    </button>
                  </div>
                  <div className="co-caption-text">{result.caption_th}</div>
                </div>
              )}
              {result.caption_en && (
                <div className="co-caption-box">
                  <div className="co-caption-label">
                    <span>Caption (English)</span>
                    <button className={`co-caption-copy ${copiedField === 'en' ? 'copied' : ''}`}
                      onClick={() => handleCopy(result.caption_en, 'en')}>
                      <iconify-icon icon={copiedField === 'en' ? 'mdi:check' : 'mdi:content-copy'}></iconify-icon>
                      {copiedField === 'en' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="co-caption-text">{result.caption_en}</div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="co-actions">
            <button className="co-btn-download" onClick={() => handleDownload(result.image_url)}>
              <iconify-icon icon="mdi:download"></iconify-icon> ดาวน์โหลดรูป
            </button>
            <button className="co-btn-share facebook" onClick={handleShareFacebook}>
              <iconify-icon icon="mdi:facebook"></iconify-icon> แชร์ Facebook
            </button>
            <button className="co-btn-share instagram" onClick={handleShareInstagram}>
              <iconify-icon icon="mdi:instagram"></iconify-icon> แชร์ Instagram
            </button>
          </div>

          {/* Regenerate Buttons */}
          <div className="co-actions" style={{ marginTop: '10px' }}>
            <button className="co-btn-regen" onClick={() => handleGenerate('image_only')} disabled={isGenerating}>
              <iconify-icon icon="mdi:image-refresh-outline"></iconify-icon> สร้างภาพใหม่
            </button>
            <button className="co-btn-regen" onClick={() => handleGenerate('caption_only')} disabled={isGenerating}>
              <iconify-icon icon="mdi:text-box-refresh-outline"></iconify-icon> คิดแคปชั่นใหม่
            </button>
            <button className="co-btn-regen" onClick={() => handleGenerate('both')} disabled={isGenerating}>
              <iconify-icon icon="mdi:refresh"></iconify-icon> สร้างทั้งหมดใหม่
            </button>
            <button className="co-btn-back" onClick={() => { setResult(null); setStep(1); }}>
              <iconify-icon icon="mdi:restart"></iconify-icon> เริ่มใหม่
            </button>
          </div>
        </div>
      )}

      {/* ===== History Section ===== */}
      {selectedProductId && history.length > 0 && (
        <div className="co-section co-history">
          <h3 className="co-history-title">
            <iconify-icon icon="mdi:history"></iconify-icon> ประวัติการสร้างโฆษณา
          </h3>
          <div className="co-history-grid">
            {history.map(h => (
              <div key={h.marketing_content_id} className="co-history-card"
                onClick={() => setHistoryDetail(h)}>
                {h.image_content && (
                  <img src={`${API}${h.image_content}`} alt="" />
                )}
                <div className="co-history-info">
                  <span className="template-tag">{h.template_name_th || 'ไม่ระบุ'}</span>
                  <span className="platform-tag">{h.platform || '-'}</span>
                  <span className="date-text">
                    {h.created_at ? new Date(h.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== History Detail Modal ===== */}
      {historyDetail && (
        <div className="co-modal-overlay" onClick={() => setHistoryDetail(null)}>
          <div className="co-modal co-detail-modal" onClick={e => e.stopPropagation()}>
            <button style={{ float: 'right', background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#999' }}
              onClick={() => setHistoryDetail(null)}>&times;</button>
            <h2>รายละเอียดโฆษณา</h2>
            {historyDetail.image_content && (
              <img src={`${API}${historyDetail.image_content}`} alt="" />
            )}
            {historyDetail.caption_th && (
              <div className="co-caption-box" style={{ marginBottom: '10px' }}>
                <div className="co-caption-label">
                  <span>แคปชั่นไทย</span>
                  <button className="co-caption-copy" onClick={() => handleCopy(historyDetail.caption_th, 'detail_th')}>
                    <iconify-icon icon="mdi:content-copy"></iconify-icon> คัดลอก
                  </button>
                </div>
                <div className="co-caption-text">{historyDetail.caption_th}</div>
              </div>
            )}
            {historyDetail.caption_en && (
              <div className="co-caption-box">
                <div className="co-caption-label">
                  <span>Caption EN</span>
                  <button className="co-caption-copy" onClick={() => handleCopy(historyDetail.caption_en, 'detail_en')}>
                    <iconify-icon icon="mdi:content-copy"></iconify-icon> Copy
                  </button>
                </div>
                <div className="co-caption-text">{historyDetail.caption_en}</div>
              </div>
            )}
            <div className="co-actions" style={{ marginTop: '15px' }}>
              {historyDetail.image_content && (
                <button className="co-btn-download" onClick={() => handleDownload(historyDetail.image_content)}>
                  <iconify-icon icon="mdi:download"></iconify-icon> ดาวน์โหลด
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Add Product Modal ===== */}
      {showAddProduct && (
        <div className="co-modal-overlay" onClick={() => setShowAddProduct(false)}>
          <div className="co-modal" onClick={e => e.stopPropagation()}>
            <button style={{ float: 'right', background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#999' }}
              onClick={() => setShowAddProduct(false)}>&times;</button>
            <h2>เพิ่มสินค้าใหม่</h2>

            <div className="co-form-group">
              <label>ชื่อสินค้า</label>
              <input className="co-input" value={newProductName}
                onChange={e => setNewProductName(e.target.value)} placeholder="เช่น โดนัท" />
            </div>
            <div className="co-form-group">
              <label>ประเภท</label>
              <select className="co-input" value={newProductType}
                onChange={e => setNewProductType(e.target.value)}>
                <option value="">-- เลือกประเภท --</option>
                {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="co-form-group">
              <label>รูปภาพสินค้า <span className="optional">(ไม่บังคับ)</span></label>
              <input type="file" accept="image/*" ref={addProductFileRef}
                onChange={e => {
                  const f = e.target.files[0];
                  if (f) { setNewProductImage(f); setNewProductPreview(URL.createObjectURL(f)); }
                }} />
              {newProductPreview && (
                <img src={newProductPreview} alt="" style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '10px', marginTop: '10px' }} />
              )}
            </div>

            <div className="co-modal-actions">
              <button className="co-btn-back" onClick={() => setShowAddProduct(false)}>ยกเลิก</button>
              <button className="co-btn-primary" onClick={handleAddProduct}>เพิ่มสินค้า</button>
            </div>
          </div>
        </div>
      )}
      <ProUpgradeModal isOpen={showProModal} onClose={() => setShowProModal(false)} feature="generation" />
    </div>
  );
};

export default ContentOnline;