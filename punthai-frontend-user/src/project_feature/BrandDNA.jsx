import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import './BrandDNA.css';
import { ProjectSidebar } from '../components/sidebar';

import logoImg from '../assets/logo.png';
import { API_URL } from '../config';
import NavProfileButton from '../components/NavProfileButton';
import NotificationBell from '../components/NotificationBell';

export const BrandDNA = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const projectId = location.state?.projectId;

  //  ดึง user_id จาก LocalStorage (สมมติว่าคุณเก็บข้อมูล user ไว้ตอน Login)
  const userData = JSON.parse(localStorage.getItem('user') || '{}');
  const userId = userData.user_id || 0;

  //สีและฟอนต์  
  const [recommendedColor, setRecommendedColor] = useState(null);
  const [recommendedFont, setRecommendedFont] = useState(null);

  //  State สำหรับควบคุมหน้าจอต่างๆ 
  const [showWelcome, setShowWelcome] = useState(true); // หน้าต่างต้อนรับ
  const [currentStep, setCurrentStep] = useState(1);
  const [showResult, setShowResult] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [dnaResult, setDnaResult] = useState(null);

  const [products, setProducts] = useState([]);
  const [hasNoProduct, setHasNoProduct] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [productName, setProductName] = useState('');
  const [productType, setProductType] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
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

  const [q1Form, setQ1Form] = useState("");
  const [q3Form, setQ3Form] = useState({ q1: "", q2: "", q3: "", q4: "", q5: "" });
  const [q4Form, setQ4Form] = useState({ tags: [], noAudience: false, type: "other", desc: "" });
  const [archetype, setArchetype] = useState("");

  useEffect(() => {
    if (!projectId) {
      alert("ไม่พบรหัสโปรเจกต์ กรุณากลับไปเลือกโปรเจกต์ใหม่");
      navigate('/');
      return;
    }
    fetchProducts();
    fetchExistingDNA(); // เช็คว่าเคยทำ DNA หรือยัง
  }, [projectId, navigate]);

  //  ฟังก์ชันเช็คผลลัพธ์เก่าจาก Database 
  const fetchExistingDNA = async () => {
    try {
      // ใช้ endpoint ใหม่ที่คืน DNA + color + font ใน 1 call (0 Gemini)
      const res = await fetch(`${API_URL}/api/brand-dna-full/${projectId}`);
      const data = await res.json();
      if (data.status === 'success' && data.dna) {
        setDnaResult(data.dna);
        if (data.color) setRecommendedColor(data.color);
        if (data.font) setRecommendedFont(data.font);
        setShowResult(true);
        setShowWelcome(false);
        console.log('[BrandDNA] Loaded from cache (0 Gemini calls)');
      }
    } catch (err) {
      console.error("Fetch existing DNA error:", err);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_URL}/api/brand_product/${projectId}`);
      const data = await res.json();
      if (data.status === 'success') {
        setProducts(data.products);
        if (data.products.length > 0) setHasNoProduct(false);
      }
    } catch (err) {
      console.error("Fetch products error:", err);
    }
  };

  const handleOpenModal = () => setIsModalOpen(true);
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setProductName('');
    setProductType('');
    setImageFile(null);
    setPreviewUrl(null);
    setIsDropdownOpen(false);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleAddProductSubmit = async () => {
    if (!productName) return alert("กรุณากรอกชื่อสินค้า");
    if (!productType) return alert("กรุณาเลือกประเภทสินค้า");

    const formData = new FormData();
    formData.append('project_id', projectId);
    formData.append('name_product', productName);
    formData.append('type_product', productType);
    if (imageFile) formData.append('image_product', imageFile);

    try {
      const res = await fetch(`${API_URL}/api/brand_product`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (data.status === 'success') {
        fetchProducts();
        handleCloseModal();
      } else {
        alert("เพิ่มสินค้าไม่สำเร็จ: " + data.message);
      }
    } catch (err) {
      alert("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    }
  };

  const isNextEnabled = () => {
    if (currentStep === 1) return q1Form !== "";
    if (currentStep === 2) return products.length > 0 || hasNoProduct === true;
    if (currentStep === 3) return q3Form.q1 !== "" && q3Form.q2 !== "" && q3Form.q3 !== "" && q3Form.q4 !== "" && q3Form.q5 !== "";
    if (currentStep === 4) return (q4Form.tags.length > 0 || q4Form.noAudience) && q4Form.type !== "";
    return false;
  };

  const calculateArchetype = () => {
    let scores = { 'สายอนุรักษ์': 0, 'สายเป็นมิตร': 0, 'สายสุขภาพ': 0, 'สายหรูหรา': 0 };
    const scoreMap = {
      'heritage': 'สายอนุรักษ์', 'accessible': 'สายเป็นมิตร', 'safe': 'สายสุขภาพ', 'innovative': 'สายหรูหรา',
      'recipe': 'สายอนุรักษ์', 'value': 'สายเป็นมิตร', 'quality': 'สายสุขภาพ', 'unique': 'สายหรูหรา',
      'history': 'สายอนุรักษ์', 'family': 'สายเป็นมิตร', 'culture': 'สายสุขภาพ', 'passion': 'สายหรูหรา',
      'souvenir': 'สายอนุรักษ์', 'everyday': 'สายเป็นมิตร', 'health': 'สายสุขภาพ', 'design': 'สายหรูหรา',
      'pride': 'สายอนุรักษ์', 'happy': 'สายเป็นมิตร', 'healthy': 'สายสุขภาพ', 'premium-feel': 'สายหรูหรา'
    };

    scores[scoreMap[q3Form.q1]] += 1; scores[scoreMap[q3Form.q2]] += 1; scores[scoreMap[q3Form.q3]] += 1;
    scores[scoreMap[q3Form.q4]] += 1; scores[scoreMap[q3Form.q5]] += 1;

    let maxScore = 0; let finalArchetype = '';
    for (const [key, value] of Object.entries(scores)) {
      if (value > maxScore) { maxScore = value; finalArchetype = key; }
    }

    setArchetype(finalArchetype);
    return finalArchetype;
  };

  //  นี่คือฟังก์ชันหลักที่ประมวลผล DNA ของเดิมของคุณ 
  const handleSubmitDNA = async (currentArchetype) => {
    setIsLoading(true);
    try {
      const payload = {
        project_id: projectId, user_id: userId,
        business_type: q1Form, archetype: currentArchetype,
        audience_data: q4Form.noAudience
          ? "ไม่รู้ / ยังไม่ได้เริ่มขาย"
          : `ลักษณะ: ${q4Form.type}, กลุ่ม: ${q4Form.tags.join(', ')}, รายละเอียดเพิ่มเติม: ${q4Form.desc}`
      };

      const res = await fetch(`${API_URL}/api/generate-brand-dna`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.status === 'success') {
        setDnaResult(data.data);
        // 👇 ใหม่: รับ color + font จาก response เลย ไม่ต้องเรียก Gemini อีก
        if (data.data.color) setRecommendedColor(data.data.color);
        if (data.data.font) setRecommendedFont(data.data.font);
        setShowResult(true);
        console.log('[BrandDNA] Generated all (1 Gemini call total)');
      } else {
        alert("ข้อผิดพลาดจากเซิร์ฟเวอร์: " + data.message);
      }
    } catch (err) {
      console.error(err);
      alert("เกิดปัญหาในการติดต่อ AI เซิร์ฟเวอร์");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => {
    let finalArchetype = archetype;
    if (currentStep === 3) finalArchetype = calculateArchetype();

    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmitDNA(finalArchetype);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const toggleTag = (val) => {
    if (q4Form.tags.includes(val)) {
      setQ4Form({ ...q4Form, tags: q4Form.tags.filter(t => t !== val) });
    } else {
      setQ4Form({ ...q4Form, tags: [...q4Form.tags, val], noAudience: false });
    }
  };

  //  ฟังก์ชันทำแบบทดสอบใหม่
  const handleRetakeQuiz = () => {
    setShowResult(false);
    setShowWelcome(false);
    setCurrentStep(1);
    // เราไม่ Reset State คำตอบ เผื่อผู้ใช้แค่อยากแก้คำตอบบางข้อ
  };


  // =========================================================
  // ฟังก์ชันสำหรับดึงข้อมูลและจัดการ AI แนะนำสี/ฟอนต์
  // =========================================================
  const [isColorLiked, setIsColorLiked] = useState(false);
  const [isFontLiked, setIsFontLiked] = useState(false);

  const fetchAiRecommendations = async () => {
    try {
      const res = await fetch(`${API_URL}/api/recommend-assets/${projectId}`);
      const data = await res.json();
      if (data.status === 'success') {
        setRecommendedColor(data.color);
        setRecommendedFont(data.font);
      }
    } catch (err) {
      console.error("AI Recommend Error:", err);
    }
  };

  // ❌ ลบ useEffect นี้ทิ้ง — auto-fire ทำให้สิ้นเปลือง token
  // useEffect(() => {
  //     if (showResult && dnaResult) {
  //         fetchAiRecommendations();
  //     }
  // }, [showResult, dnaResult]);

  const handleLikeColor = async () => {
    if (!recommendedColor) return;
    const newState = !isColorLiked;
    setIsColorLiked(newState);
    try {
      await fetch(`${API_URL}/api/color-palettes/like/${recommendedColor.color_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_liked: newState ? 1 : 0, project_id: projectId })
      });
    } catch (err) { console.error(err); }
  };

  const handleSelectColor = async () => {
    if (!recommendedColor) return;
    try {
      const res = await fetch(`${API_URL}/api/color-palettes/select/${recommendedColor.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId })
      });
      if (res.ok) alert("✅ เลือกชุดสีนี้เรียบร้อยแล้ว! สามารถไปดูได้ที่หน้า Projects");
    } catch (err) { console.error(err); }
  };

  const handleLikeFont = async () => {
    if (!recommendedFont) return;
    const newState = !isFontLiked;
    setIsFontLiked(newState);
    try {
      await fetch(`${API_URL}/api/fonts/like/${recommendedFont.font_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_liked: newState ? 1 : 0, project_id: projectId })
      });
    } catch (err) { console.error(err); }
  };

  const handleSelectFont = async () => {
    if (!recommendedFont) return;
    try {
      const res = await fetch(`${API_URL}/api/fonts/select/${recommendedFont.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId })
      });
      if (res.ok) alert("✅ เลือกฟอนต์นี้เรียบร้อยแล้ว! สามารถไปดูได้ที่หน้า Projects");
    } catch (err) { console.error(err); }
  };

  return (
    <div className="bdna-body">

      {/* Soft Orbs background — fixed position, ไม่รบกวน layout */}
      <div className="bdna-orb3" aria-hidden="true"></div>
      <div className="bdna-orb4" aria-hidden="true"></div>

      {/* Loading Screen */}
      {isLoading && (
        <div className="bdna-loading-overlay">
          <iconify-icon icon="line-md:loading-loop"></iconify-icon>
          <h2>Gemini AI กำลังวิเคราะห์ Brand DNA ของคุณ...</h2>
          <p>อาจใช้เวลาประมาณ 5 - 10 วินาที กรุณารอสักครู่</p>
        </div>
      )}

      {/* Navbar */}
      <header className="bdna-navbar">
        <div className="bdna-logo"><Link to="/"><img src={logoImg} alt="logo" className="bdna-logo-img" /></Link></div>
        <div className="bdna-nav-icons">
          <button className="bdna-btn-world"><iconify-icon icon="iconamoon:search-light"></iconify-icon></button>
          <NotificationBell className="bdna-btn-world" />
          <NavProfileButton className="bdna-btn-users" />
        </div>
      </header>

      <div className="bdna-layout">

        {/* Sidebar */}
        <ProjectSidebar activePage="brand-dna" projectId={projectId} />

        <main className="bdna-main bdna-dna-main">

          {/* 👇 1. หน้าต่างต้อนรับ Welcome Screen 👇 */}
          {!showResult && showWelcome && (
            <div className="bdna-welcome-box">
              <iconify-icon icon="mdi:dna"></iconify-icon>
              <h1>ค้นหา Brand DNA ในตัวคุณ</h1>
              <p>
                Brand DNA คือแก่นแท้และจุดยืนของแบรนด์ที่จะช่วยสร้างความแตกต่างให้ธุรกิจของคุณ การทำแบบทดสอบนี้จะช่วยให้ <b>AI วิเคราะห์ตัวตนแบรนด์ แนะนำกลุ่มเป้าหมาย และทิศทางการออกแบบ</b> ที่เหมาะสมที่สุดสำหรับแบรนด์ของคุณ
              </p>
              <button className="bdna-btn-next-form" onClick={() => setShowWelcome(false)}>
                เริ่มค้นหา Brand DNA ของคุณ
              </button>
            </div>
          )}

          {/* 👇 2. หน้าแบบสอบถาม (ซ่อนเมื่อเปิด Welcome หรือ Result) 👇 */}
          {!showResult && !showWelcome && (
            <>
              <div className="bdna-dna-header">
                <h1 className="bdna-dna-title">กำหนด Brand DNA ของคุณ</h1>
                <p className="bdna-dna-subtitle">ตอบคำถามด้านล่างเพื่อช่วยกำหนดเอกลักษณ์และทิศทางของแบรนด์คุณ</p>
              </div>

              <div className="bdna-stepper">
                <div className={`bdna-step ${currentStep === 1 ? 'bdna-active' : ''} ${currentStep > 1 ? 'bdna-completed' : ''}`}><div className="bdna-step-circle">01</div><div className="bdna-step-line"></div></div>
                <div className={`bdna-step ${currentStep === 2 ? 'bdna-active' : ''} ${currentStep > 2 ? 'bdna-completed' : ''}`}><div className="bdna-step-circle">02</div><div className="bdna-step-line"></div></div>
                <div className={`bdna-step ${currentStep === 3 ? 'bdna-active' : ''} ${currentStep > 3 ? 'bdna-completed' : ''}`}><div className="bdna-step-circle">03</div><div className="bdna-step-line"></div></div>
                <div className={`bdna-step bdna-last ${currentStep === 4 ? 'bdna-active' : ''} ${currentStep > 4 ? 'bdna-completed' : ''}`}><div className="bdna-step-circle">04</div></div>
              </div>

              <div className="bdna-form-area">
                {/* Step 1 */}
                <div className="bdna-form-step" style={{ display: currentStep === 1 ? 'block' : 'none' }}>
                  <div className="bdna-question-block bdna-question-center">
                    <div className="bdna-q-label"><span className="bdna-q-number">1</span><span className="bdna-q-text">สินค้าของคุณเป็นรูปแบบไหน</span></div>
                    <div className="bdna-custom-select-wrapper">
                      <select className="bdna-custom-select" value={q1Form} onChange={(e) => setQ1Form(e.target.value)}>
                        <option value="" disabled>เลือกรูปแบบธุรกิจ</option><option value="sme">ธุรกิจขนาดเล็ก (SMEs)</option><option value="startup">Startup</option><option value="enterprise">องค์กรขนาดใหญ่</option><option value="freelance">Freelance / Solo</option><option value="nonprofit">องค์กรไม่แสวงหากำไร</option>
                      </select>
                      <iconify-icon icon="mdi:chevron-down" className="bdna-select-arrow"></iconify-icon>
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="bdna-form-step" style={{ display: currentStep === 2 ? 'block' : 'none' }}>
                  {products.length === 0 && !hasNoProduct ? (
                    <div className="bdna-question-block bdna-question-center">
                      <div className="bdna-q-label" style={{ marginBottom: '30px' }}><span className="bdna-q-text" style={{ fontSize: '26px', color: '#d75a2a' }}>คุณมีสินค้าที่จะขายหรือยัง?</span></div>
                      <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
                        <button className="bdna-btn-next-form" style={{ padding: '12px 40px' }} onClick={handleOpenModal}>มี</button>
                        <button className="bdna-btn-back-form" style={{ padding: '12px 40px', border: '1px solid #ccc', borderRadius: '25px' }} onClick={() => { setHasNoProduct(true); handleNext(); }}>ยังไม่มี (ข้าม)</button>
                      </div>
                    </div>
                  ) : hasNoProduct ? (
                    <div className="bdna-question-block bdna-question-center">
                      <h3 style={{ color: '#666', marginBottom: '20px' }}>คุณเลือกข้ามการเพิ่มสินค้า</h3>
                      <button className="bdna-btn-next-form" onClick={handleOpenModal}>เปลี่ยนใจเพิ่มสินค้า</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
                      <h2 style={{ color: '#d75a2a', alignSelf: 'flex-start' }}>รายการสินค้าของคุณ</h2>
                      <div className="bdna-cards-container">
                        {products.map((product, index) => (
                          <div key={product.product_id || index} className="bdna-ai-card">
                            <div className="bdna-ai-card-header"><div className="bdna-step-number" style={{ background: '#c65428', color: 'white', width: '35px', height: '35px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{index + 1}</div><h3 style={{ margin: 0, color: '#c65428' }}>{product.name_product}</h3></div>
                            <div style={{ height: '150px', background: '#f5f5f5', borderRadius: '12px', overflow: 'hidden', marginTop: '15px' }}>{product.image_product ? (<img src={`${API_URL}/uploads/${product.image_product}`} alt={product.name_product} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />) : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa' }}>ไม่มีรูปภาพ</div>}</div>
                          </div>
                        ))}
                      </div>
                      <button className="bdna-btn-next-form" style={{ marginTop: '20px', alignSelf: 'center' }} onClick={handleOpenModal}>+ เพิ่มสินค้าอีก</button>
                    </div>
                  )}
                </div>

                {/* Step 3 */}
                <div className="bdna-form-step" style={{ display: currentStep === 3 ? 'block' : 'none' }}>
                  <div className="bdna-question-block"><div className="bdna-q-label"><span className="bdna-q-number">1</span><span className="bdna-q-text">เหตุผลที่อยากทำสินค้าเหล่านี้ สิ่งสำคัญที่สุดคืออะไร?</span></div><div className="bdna-radio-options">
                    {[{ val: 'heritage', label: 'เพื่อสืบสานสูตรโบราณ หรือภูมิปัญญาจากบรรพบุรุษไม่ให้หายไป' }, { val: 'accessible', label: 'อยากให้เป็นของที่คนทั่วไปสามารถซื้อได้ทุกวัน ราคาจับต้องได้' }, { val: 'safe', label: 'เพื่อให้คนได้ใช้ของดี ปลอดภัย ไร้สารเคมี ดีต่อสุขภาพ' }, { val: 'innovative', label: 'เพื่อสร้างของแปลกใหม่ที่ยังไม่เคยมีใครทำมาก่อน' }].map(opt => (<label key={opt.val} className="bdna-radio-option"><input type="radio" name="q3-1" value={opt.val} checked={q3Form.q1 === opt.val} onChange={(e) => setQ3Form({ ...q3Form, q1: e.target.value })} /><span className="bdna-radio-custom"></span><span className="bdna-radio-text">{opt.label}</span></label>))}
                  </div></div>
                  <div className="bdna-question-block"><div className="bdna-q-label"><span className="bdna-q-number">2</span><span className="bdna-q-text">อะไรคือสิ่งที่คุณรู้สึก 'รับไม่ได้' ถ้าต้องทำสิ่งนี้?</span></div><div className="bdna-radio-options">
                    {[{ val: 'recipe', label: 'รับไม่ได้ถ้าผิดเพี้ยนไปจากสูตรต้นตำรับ (เน้นมาตรฐานดั้งเดิม)' }, { val: 'value', label: 'รับไม่ได้ถ้าลูกค้ากินแล้วไม่อร่อยหรือรู้สึกไม่คุ้มเงิน' }, { val: 'quality', label: 'รับไม่ได้ถ้าสินค้าไม่ได้มาตรฐาน' }, { val: 'unique', label: 'รับไม่ได้ถ้าสินค้าไม่มีความโดดเด่นจากสินค้าทั่วไป' }].map(opt => (<label key={opt.val} className="bdna-radio-option"><input type="radio" name="q3-2" value={opt.val} checked={q3Form.q2 === opt.val} onChange={(e) => setQ3Form({ ...q3Form, q2: e.target.value })} /><span className="bdna-radio-custom"></span><span className="bdna-radio-text">{opt.label}</span></label>))}
                  </div></div>
                  <div className="bdna-question-block"><div className="bdna-q-label"><span className="bdna-q-number">3</span><span className="bdna-q-text">ถ้าต้องเล่าที่มาของสินค้าให้ลูกค้าฟังคุณจะเริ่มเล่าจากเรื่องอะไร?</span></div><div className="bdna-radio-options">
                    {[{ val: 'history', label: 'เล่าประวัติยาวนานและที่มาของภูมิปัญญาจากรุ่นก่อน' }, { val: 'family', label: 'เล่าเรื่องตอนที่เริ่มทำกันเองในครอบครัว' }, { val: 'culture', label: 'เล่าถึงที่มาของแหล่งวัตถุดิบและการคัดสรรอย่างพิถีพิถัน' }, { val: 'passion', label: 'เล่าถึงแรงบันดาลใจ หรือไอเดียที่ทำให้เกิดสินค้านี้' }].map(opt => (<label key={opt.val} className="bdna-radio-option"><input type="radio" name="q3-3" value={opt.val} checked={q3Form.q3 === opt.val} onChange={(e) => setQ3Form({ ...q3Form, q3: e.target.value })} /><span className="bdna-radio-custom"></span><span className="bdna-radio-text">{opt.label}</span></label>))}
                  </div></div>
                  <div className="bdna-question-block"><div className="bdna-q-label"><span className="bdna-q-number">4</span><span className="bdna-q-text">คุณอยากให้ลูกค้าจดจำสินค้าของคุณว่ายังไง?</span></div><div className="bdna-radio-options">
                    {[{ val: 'souvenir', label: 'ของดีประจำจังหวัดที่ต้องซื้อฝาก' }, { val: 'everyday', label: 'ของอร่อยติดบ้านที่กินได้เรื่อยๆ' }, { val: 'health', label: 'ตัวช่วยดูแลเรื่องสุขภาพ' }, { val: 'design', label: 'ของฝากที่มีดีไซน์สวย เป็นเอกลักษณ์ ไม่ซ้ำใคร' }].map(opt => (<label key={opt.val} className="bdna-radio-option"><input type="radio" name="q3-4" value={opt.val} checked={q3Form.q4 === opt.val} onChange={(e) => setQ3Form({ ...q3Form, q4: e.target.value })} /><span className="bdna-radio-custom"></span><span className="bdna-radio-text">{opt.label}</span></label>))}
                  </div></div>
                  <div className="bdna-question-block"><div className="bdna-q-label"><span className="bdna-q-number">5</span><span className="bdna-q-text">สุดท้าย..คุณอยากให้ลูกค้า 'รู้สึก' ยังไงเมื่อใช้สินค้าของคุณ?</span></div><div className="bdna-radio-options">
                    {[{ val: 'pride', label: 'รู้สึกชื่นชมและภูมิใจในความเป็นไทย' }, { val: 'happy', label: 'รู้สึกสบายใจ และอยากให้มีความสุข' }, { val: 'healthy', label: 'สุขภาพที่ดีขึ้น' }, { val: 'premium-feel', label: 'รู้สึกได้ยกระดับตัวเอง ดูดีมีฐานะ' }].map(opt => (<label key={opt.val} className="bdna-radio-option"><input type="radio" name="q3-5" value={opt.val} checked={q3Form.q5 === opt.val} onChange={(e) => setQ3Form({ ...q3Form, q5: e.target.value })} /><span className="bdna-radio-custom"></span><span className="bdna-radio-text">{opt.label}</span></label>))}
                  </div></div>
                </div>

                {/* Step 4 */}
                <div className="bdna-form-step" style={{ display: currentStep === 4 ? 'block' : 'none' }}>
                  <div className="bdna-question-block">
                    <div className="bdna-q-label"><span className="bdna-q-number">1</span><span className="bdna-q-text">กลุ่มเป้าหมายของคุณ</span></div>
                    <div className="bdna-tag-options">
                      {[{ val: 'elderly', label: 'ผู้สูงอายุ' }, { val: 'student', label: 'นักเรียน/นักศึกษา' }, { val: 'worker', label: 'วัยทำงาน' }, { val: 'office', label: 'พนักงานออฟฟิศ' }, { val: 'health', label: 'คนรักสุขภาพ' }, { val: 'female', label: 'เพศหญิง' }, { val: 'male', label: 'เพศชาย' }, { val: 'other', label: 'อื่นๆ' }].map(tag => (
                        <span key={tag.val} className={`bdna-tag ${q4Form.tags.includes(tag.val) ? 'bdna-selected' : ''}`} onClick={() => toggleTag(tag.val)}>{tag.label}</span>
                      ))}
                    </div>
                    <label className="bdna-checkbox-option">
                      <input type="checkbox" checked={q4Form.noAudience} onChange={(e) => setQ4Form({ ...q4Form, noAudience: e.target.checked, tags: e.target.checked ? [] : q4Form.tags })} />
                      <span className="bdna-checkbox-custom"></span><span className="bdna-checkbox-text">ไม่รู้ / ยังไม่ได้เริ่มขาย</span>
                    </label>
                  </div>
                  <div className="bdna-question-block">
                    <div className="bdna-q-label"><span className="bdna-q-number">2</span><span className="bdna-q-text">ลูกค้าที่มาซื้อของคุณมีลักษณะอย่างไร</span></div>
                    <div className="bdna-custom-select-wrapper">
                      <select className="bdna-custom-select" value={q4Form.type} onChange={(e) => setQ4Form({ ...q4Form, type: e.target.value })}>
                        <option value="age">แบ่งตามช่วงอายุ</option><option value="gender">แบ่งตามเพศ</option><option value="lifestyle">แบ่งตาม Lifestyle</option><option value="income">แบ่งตามรายได้</option><option value="other">อื่น ๆ</option>
                      </select>
                      <iconify-icon icon="mdi:chevron-down" className="bdna-select-arrow"></iconify-icon>
                    </div>
                    <div id="bdna-q4-desc-wrap" style={{ marginTop: '15px' }}>
                      <p className="bdna-describe-label">โปรดระบุ: <span className="bdna-required-mark">*</span></p>
                      <textarea className="bdna-text-input bdna-textarea" placeholder="เช่น รักสุขภาพ, ชอบออกกำลังกาย" value={q4Form.desc} onChange={(e) => setQ4Form({ ...q4Form, desc: e.target.value })}></textarea>
                    </div>
                  </div>
                </div>

              </div>

              <div className="bdna-divider"></div>

              <div className="bdna-form-nav">
                <button className="bdna-btn-back-form" onClick={handleBack} style={{ visibility: currentStep > 1 ? 'visible' : 'hidden' }}>ย้อน</button>
                <button className="bdna-btn-next-form" onClick={handleNext} disabled={!isNextEnabled()}>ต่อไป</button>
              </div>
            </>
          )}

          {/* 👇 3. หน้าจอ Result โชว์เมื่อทำเสร็จ หรือดึงมาจาก Database 👇 */}
          <div className="bdna-result-page" style={{ display: showResult && dnaResult ? 'block' : 'none' }}>
            {dnaResult && (
              <>
                <div className="bdna-result-card bdna-result-card--identity">
                  <div className="bdna-result-identity-header">
                    <div className="bdna-result-archetype-icon"><iconify-icon icon="mdi:home-outline"></iconify-icon></div>
                    <div className="bdna-result-archetype-text">
                      <h2 className="bdna-result-archetype-th">{dnaResult.archetype_name || dnaResult.archetype}</h2>
                      <p className="bdna-result-archetype-en">BRAND ARCHETYPE</p>
                    </div>
                  </div>
                  <hr className="bdna-result-divider" />
                  <div className="bdna-result-identity-cols">
                    <div className="bdna-result-identity-col">
                      <h3 className="bdna-result-col-title">คุณค่าของแบรนด์ของคุณ</h3>
                      <p className="bdna-result-col-body">{dnaResult.brand_value}</p>
                    </div>
                    <div className="bdna-result-identity-col">
                      <h3 className="bdna-result-col-title">สิ่งที่ลูกค้ามองเห็น</h3>
                      <p className="bdna-result-col-body">{dnaResult.customer_perception}</p>
                    </div>
                  </div>
                </div>

                {/* 👇 ส่วนแสดงผลสีและฟอนต์ที่ AI แนะนำ พร้อมปุ่มกดใจ/เลือก 👇 */}
                <div className="bdna-result-card bdna-result-card--design">
                  <h2 className="bdna-result-section-title">คำแนะนำสำหรับการออกแบบ (โดย AI)</h2>
                  <div className="bdna-result-design-cols">

                    {/* ฝั่งซ้าย: ชุดสี */}
                    <div className="bdna-result-design-left">
                      <h3 className="bdna-result-col-title">ชุดสี</h3>

                      {recommendedColor ? (
                        <>
                          <div style={{ display: 'flex', gap: '8px', margin: '15px 0' }}>
                            {[recommendedColor.hex1, recommendedColor.hex2, recommendedColor.hex3, recommendedColor.hex4, recommendedColor.hex5].filter(Boolean).map((hex, i) => (
                              <div key={i} style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: hex, border: '1px solid #ddd', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}></div>
                            ))}
                          </div>
                          <p className="bdna-result-palette-desc">ใช้โทนสีที่สอดคล้องกับคุณค่าและสายแบรนด์ของคุณ</p>
                          <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                            <button
                              className="bdna-action-btn"
                              title="ถูกใจ"
                              onClick={handleLikeColor}
                              style={{ background: '#f5f5f5', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer' }}
                            >
                              <iconify-icon icon={isColorLiked ? "solar:heart-bold" : "solar:heart-linear"} style={{ color: '#d75a2a', fontSize: '20px' }}></iconify-icon>
                            </button>
                            <button
                              className="bdna-result-palette-btn"
                              title="เลือกใช้"
                              onClick={handleSelectColor}
                              style={{ border: '1px solid #d75a2a', background: '#fff3ee', color: '#d75a2a', display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer' }}
                            >
                              <iconify-icon icon="mdi:check-circle-outline"></iconify-icon> เลือกใช้พาเลทนี้
                            </button>
                          </div>
                        </>
                      ) : (
                        <p style={{ color: '#888', marginTop: '15px' }}>กำลังประมวลผลพาเลทสีที่เหมาะสม...</p>
                      )}
                    </div>

                    {/* ฝั่งขวา: ฟอนต์ และ กลุ่มเป้าหมาย */}
                    <div className="bdna-result-design-right">

                      <div className="bdna-result-design-block">
                        <h3 className="bdna-result-col-title">ตัวหนังสือ</h3>
                        {recommendedFont ? (
                          <>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', margin: '10px 0', color: '#333', fontFamily: recommendedFont.font_name }}>
                              {recommendedFont.font_name}
                            </div>
                            <p className="bdna-result-col-body">ควรใช้ฟอนต์ที่อ่านง่ายและสื่อถึงความเป็นตัวคุณ</p>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                              <button
                                className="bdna-action-btn"
                                title="ถูกใจ"
                                onClick={handleLikeFont}
                                style={{ background: '#f5f5f5', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer' }}
                              >
                                <iconify-icon icon={isFontLiked ? "solar:heart-bold" : "solar:heart-linear"} style={{ color: '#d75a2a', fontSize: '20px' }}></iconify-icon>
                              </button>
                              <button
                                className="bdna-result-palette-btn"
                                title="เลือกใช้"
                                onClick={handleSelectFont}
                                style={{ border: '1px solid #d75a2a', background: '#fff3ee', color: '#d75a2a', display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer' }}
                              >
                                <iconify-icon icon="mdi:check-circle-outline"></iconify-icon> เลือกใช้ฟอนต์นี้
                              </button>
                            </div>
                          </>
                        ) : (
                          <p style={{ color: '#888', marginTop: '10px' }}>กำลังประมวลผลฟอนต์ที่เหมาะสม...</p>
                        )}
                      </div>

                      <div className="bdna-result-design-block" style={{ marginTop: '20px' }}>
                        <h3 className="bdna-result-col-title">กลุ่มเป้าหมาย (วิเคราะห์โดย AI)</h3>
                        <p className="bdna-result-col-body" style={{ color: '#d75a2a', fontWeight: '500' }}>{dnaResult.target_audience}</p>
                      </div>

                    </div>
                  </div>
                </div>

                <div className="bdna-result-card bdna-result-card--suggest">
                  <div className="bdna-result-suggest-header">
                    <iconify-icon icon="mdi:shimmer" className="bdna-result-suggest-icon"></iconify-icon><span className="bdna-result-suggest-title">Suggested for you (แนะนำกลยุทธ์จาก AI)</span>
                  </div>
                  <ul className="bdna-result-suggest-list">
                    {dnaResult.design_suggestions?.map((sug, idx) => (
                      <li key={idx} className="bdna-result-suggest-item">{sug}</li>
                    ))}
                  </ul>
                </div>

                {/* ปุ่มทำแบบทดสอบใหม่อีกครั้ง */}
                <div style={{ textAlign: 'center', marginTop: '40px' }}>
                  <button className="bdna-btn-back-form" style={{ padding: '12px 30px', border: '1.5px solid #d75a2a', color: '#d75a2a', background: 'transparent', cursor: 'pointer', borderRadius: '8px' }} onClick={handleRetakeQuiz}>
                    <iconify-icon icon="mdi:refresh" style={{ marginRight: '8px', verticalAlign: 'middle', fontSize: '18px' }}></iconify-icon>
                    ทำแบบทดสอบ Brand DNA ใหม่อีกครั้ง
                  </button>
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      {/* Popup Modal สำหรับเพิ่มสินค้า */}
      {isModalOpen && (
        <div className="bdna-modal" onClick={handleCloseModal}>
          <div className="bdna-modal-box" onClick={(e) => e.stopPropagation()}>
            <button className="bdna-close-modal" onClick={handleCloseModal}>&times;</button>
            <div className="bdna-modal-inner">
            <div className="bdna-form-group">
              <label><span className="bdna-step-num">1</span> สินค้าของคุณคืออะไร</label>
              <input type="text" placeholder="เช่น โดนัท" value={productName} onChange={(e) => setProductName(e.target.value)} />
            </div>
            <div className="bdna-form-group">
              <label><span className="bdna-step-num">2</span> ประเภท</label>
              <div className="bdna-dropdown">
                <div className="bdna-dropdown-selected" onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
                  <span className="bdna-selected-text">{productType || '-- เลือกประเภทสินค้า --'}</span>
                  <span className="bdna-arrow">⌄</span>
                </div>
                {isDropdownOpen && (
                  <ul className="bdna-dropdown-menu" style={{ display: 'block' }}>
                    {categories.map((cat, idx) => (
                      <li key={idx} onClick={() => { setProductType(cat.value); setIsDropdownOpen(false); }}>{cat.label}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="bdna-form-group">
              <label><span className="bdna-step-num">3</span> รูปภาพสินค้าของคุณ</label>
              <div className="bdna-upload-box" style={{ borderColor: previewUrl ? '#cfcfcf' : '' }}>
                <input type="file" accept="image/*" hidden ref={fileInputRef} onChange={handleFileChange} />
                {previewUrl ? (
                  <>
                    <img src={previewUrl} className="bdna-preview-img" alt="preview" />
                    <button type="button" className="bdna-change-btn" onClick={() => fileInputRef.current.click()}>เปลี่ยนรูป</button>
                  </>
                ) : (
                  <>
                    <p className="bdna-upload-drag">Drag & Drop here</p>
                    <p className="bdna-upload-sub">รูปภาพของคุณ หรือลิงก์</p>
                    <button type="button" className="bdna-upload-btn" onClick={() => fileInputRef.current.click()}>Upload</button>
                  </>
                )}
              </div>
            </div>
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <button onClick={async () => {
                if (!window.confirm('ขอคำแนะนำสี+ฟอนต์ใหม่จาก AI? (จะใช้ Gemini token)')) return;
                try {
                  const res = await fetch(`${API_URL}/api/recommend-assets/${projectId}?force=1`);
                  const data = await res.json();
                  if (data.status === 'success') {
                    if (data.color) setRecommendedColor(data.color);
                    if (data.font) setRecommendedFont(data.font);
                  }
                } catch (e) { alert('Error: ' + e.message); }
              }} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #d75a2a', color: '#d75a2a', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
                <iconify-icon icon="mdi:refresh" style={{ marginRight: 6 }}></iconify-icon>
                ขอ AI สร้างคำแนะนำสี/ฟอนต์ใหม่
              </button>
            </div>
            <div className="bdna-modal-actions">
              <button className="bdna-cancel" onClick={handleCloseModal}>ยกเลิก</button>
              <button className="bdna-confirm" onClick={handleAddProductSubmit}>ตกลง</button>
            </div>
            </div>{/* end bdna-modal-inner */}
          </div>
        </div>
      )}
    </div>
  );
};