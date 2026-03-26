import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import './BrandDNA.css';

import logoImg from './assets/logo.png';
import helpImg from './assets/help.png';

export const BrandDNA = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const projectId = location.state?.projectId;

  // --- State สำหรับ Sidebar ---
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // --- State สำหรับควบคุม Step ของแบบสอบถาม ---
  const [currentStep, setCurrentStep] = useState(1);
  const [showResult, setShowResult] = useState(false); // ควบคุมการโชว์หน้าผลลัพธ์

  // --- State สำหรับเก็บข้อมูลแต่ละ Step ---
  const [q1Form, setQ1Form] = useState("");
  const [q2Form, setQ2Form] = useState({ name: "", category: "" });
  const [q3Form, setQ3Form] = useState({ q1: "", q2: "", q3: "", q4: "", q5: "" });
  const [q4Form, setQ4Form] = useState({ tags: [], noAudience: false, type: "other", desc: "" });

  // เช็กว่ากรอกข้อมูลครบหรือยัง เพื่อเปิดปุ่ม "ต่อไป"
  const isNextEnabled = () => {
    if (currentStep === 1) return q1Form !== "";
    if (currentStep === 2) return q2Form.name.trim() !== "" && q2Form.category !== "";
    if (currentStep === 3) return q3Form.q1 !== "" && q3Form.q2 !== "" && q3Form.q3 !== "" && q3Form.q4 !== "" && q3Form.q5 !== "";
    if (currentStep === 4) return (q4Form.tags.length > 0 || q4Form.noAudience) && q4Form.type !== "";
    return false;
  };

  // ฟังก์ชันกดปุ่มถัดไป
  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    } else {
      setShowResult(true); // โชว์หน้า Result ถ้าอยู่ Step 4
    }
  };

  // ฟังก์ชันกดปุ่มย้อนกลับ
  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  // ฟังก์ชันเลือก Tag ใน Step 4
  const toggleTag = (val) => {
    if (q4Form.tags.includes(val)) {
      setQ4Form({ ...q4Form, tags: q4Form.tags.filter(t => t !== val) });
    } else {
      setQ4Form({ ...q4Form, tags: [...q4Form.tags, val], noAudience: false });
    }
  };

  // ดักจับกรณีไม่มี projectId
  useEffect(() => {
    if (!projectId) {
      alert("ไม่พบรหัสโปรเจกต์ กรุณากลับไปเลือกโปรเจกต์ใหม่");
      navigate('/');
    }
  }, [projectId, navigate]);

  return (
    <div className="bdna-body">
      {/* Navbar */}
      <header className="bdna-navbar">
        <div className="bdna-logo">
          <Link to="/">
            <img src={logoImg} alt="logo" className="bdna-logo-img" />
          </Link>
        </div>
        <div className="bdna-nav-icons">
          <button className="bdna-btn-world"><iconify-icon icon="iconamoon:search-light"></iconify-icon></button>
          <button className="bdna-btn-world"><iconify-icon icon="ph:bell-ringing-light"></iconify-icon></button>
          <button className="bdna-btn-users"><iconify-icon icon="solar:user-linear"></iconify-icon></button>
        </div>
      </header>

      <div className="bdna-container">
        {/* Sidebar */}
        <aside className={`bdna-sidebar ${isSidebarCollapsed ? 'bdna-collapsed' : ''}`} id="bdna-sidebar">
          <button className="bdna-toggle-btn" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>
            {isSidebarCollapsed ? '❯' : '❮'}
          </button>
          <ul className="bdna-menu">
            <li onClick={() => navigate('/project', { state: { projectId } })}>
              <span className="bdna-icon"><iconify-icon icon="mdi:view-dashboard-outline"></iconify-icon></span>
              <span className="bdna-text">Projects</span>
            </li>
            <li className="bdna-active" style={{ background: '#f3f6ea', color: '#6b8e23' }}>
              <span className="bdna-icon"><iconify-icon icon="mdi:palette-outline"></iconify-icon></span>
              <span className="bdna-text">Brand DNA</span>
            </li>
            <li>
              <span className="bdna-icon"><iconify-icon icon="mdi:lightbulb-outline"></iconify-icon></span>
              <span className="bdna-text">Create Concept</span>
            </li>
            <li>
              <span className="bdna-icon"><iconify-icon icon="mdi:folder-outline"></iconify-icon></span>
              <span className="bdna-text">Create Pictures</span>
            </li>
          </ul>
          <hr className="bdna-hr" />
          <ul className="bdna-menu">
            <li onClick={() => navigate('/your-projects', { state: { projectId } })}>
              <span className="bdna-icon"><iconify-icon icon="mdi:folder-outline"></iconify-icon></span>
              <span className="bdna-text">Yours Projects</span>
            </li>
          </ul>
          <div className="bdna-help">
            <img src={helpImg} className="bdna-help-img" alt="help" />
            <p className="bdna-help-text">Having trouble?</p>
            <a href="#" className="bdna-contact-link">Contact Us</a>
          </div>
        </aside>

        {/* Main Content */}
        <main className="bdna-main bdna-dna-main">

          {/* ซ่อนแบบสอบถามเมื่อแสดงผลลัพธ์ */}
          {!showResult && (
            <>
              {/* Title */}
              <div className="bdna-dna-header">
                <h1 className="bdna-dna-title" lang="en">Define Your Brand DNA</h1>
                <p className="bdna-dna-subtitle">Answer the questions below to help define your brand identity and goals</p>
              </div>

              {/* Stepper */}
              <div className="bdna-stepper">
                <div className={`bdna-step ${currentStep === 1 ? 'bdna-active' : ''} ${currentStep > 1 ? 'bdna-completed' : ''}`}>
                  <div className="bdna-step-circle">01</div>
                  <div className="bdna-step-line"></div>
                </div>
                <div className={`bdna-step ${currentStep === 2 ? 'bdna-active' : ''} ${currentStep > 2 ? 'bdna-completed' : ''}`}>
                  <div className="bdna-step-circle">02</div>
                  <div className="bdna-step-line"></div>
                </div>
                <div className={`bdna-step ${currentStep === 3 ? 'bdna-active' : ''} ${currentStep > 3 ? 'bdna-completed' : ''}`}>
                  <div className="bdna-step-circle">03</div>
                  <div className="bdna-step-line"></div>
                </div>
                <div className={`bdna-step bdna-last ${currentStep === 4 ? 'bdna-active' : ''} ${currentStep > 4 ? 'bdna-completed' : ''}`}>
                  <div className="bdna-step-circle">04</div>
                </div>
              </div>

              {/* Form Steps */}
              <div className="bdna-form-area">

                {/* Step 1 */}
                <div className="bdna-form-step" style={{ display: currentStep === 1 ? 'block' : 'none' }}>
                  <div className="bdna-question-block bdna-question-center">
                    <div className="bdna-q-label">
                      <span className="bdna-q-number">1</span>
                      <span className="bdna-q-text">สินค้าของคุณเป็นรูปแบบไหน</span>
                    </div>
                    <div className="bdna-custom-select-wrapper">
                      <select 
                        className="bdna-custom-select" 
                        value={q1Form} 
                        onChange={(e) => setQ1Form(e.target.value)}
                      >
                        <option value="" disabled>เลือกรูปแบบธุรกิจ</option>
                        <option value="sme">ธุรกิจขนาดเล็ก (SMEs)</option>
                        <option value="startup">Startup</option>
                        <option value="enterprise">องค์กรขนาดใหญ่</option>
                        <option value="freelance">Freelance / Solo</option>
                        <option value="nonprofit">องค์กรไม่แสวงหากำไร</option>
                      </select>
                      <iconify-icon icon="mdi:chevron-down" className="bdna-select-arrow"></iconify-icon>
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="bdna-form-step" style={{ display: currentStep === 2 ? 'block' : 'none' }}>
                  <div className="bdna-question-block">
                    <div className="bdna-q-label">
                      <span className="bdna-q-number">1</span>
                      <span className="bdna-q-text">สินค้าของคุณคืออะไร</span>
                    </div>
                    <input 
                      type="text" 
                      className="bdna-text-input" 
                      placeholder="เช่น โดนัท" 
                      value={q2Form.name}
                      onChange={(e) => setQ2Form({ ...q2Form, name: e.target.value })}
                    />
                  </div>

                  <div className="bdna-question-block">
                    <div className="bdna-q-label">
                      <span className="bdna-q-number">2</span>
                      <span className="bdna-q-text">ประเภท</span>
                    </div>
                    <div className="bdna-custom-select-wrapper">
                      <select 
                        className="bdna-custom-select" 
                        value={q2Form.category}
                        onChange={(e) => setQ2Form({ ...q2Form, category: e.target.value })}
                      >
                        <option value="" disabled>-- เลือกประเภทสินค้า --</option>
                        <option value="food">อาหาร / ของกินเล่น</option>
                        <option value="drink">เครื่องดื่ม</option>
                        <option value="clothes">เสื้อผ้า</option>
                        <option value="beauty">ความงาม</option>
                        <option value="home">ของใช้</option>
                      </select>
                      <iconify-icon icon="mdi:chevron-down" className="bdna-select-arrow"></iconify-icon>
                    </div>
                  </div>

                  <div className="bdna-question-block">
                    <div className="bdna-q-label">
                      <span className="bdna-q-number">3</span>
                      <span className="bdna-q-text">รูปภาพสินค้าของคุณ</span>
                    </div>
                    <div className="bdna-upload-box">
                      <input type="file" accept="image/*" hidden />
                      <p className="bdna-upload-drag">Drag & Drop here</p>
                      <iconify-icon icon="mdi:image-plus-outline" className="bdna-upload-icon"></iconify-icon>
                      <p className="bdna-upload-sub">รูปภาพของคุณ หรือลิงก์</p>
                      <button type="button" className="bdna-upload-btn">Upload</button>
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="bdna-form-step" style={{ display: currentStep === 3 ? 'block' : 'none' }}>
                  <div className="bdna-question-block">
                    <div className="bdna-q-label"><span className="bdna-q-number">1</span><span className="bdna-q-text">เหตุผลที่อยากทำสินค้าเหล่านี้ สิ่งสำคัญที่สุดคืออะไร?</span></div>
                    <div className="bdna-radio-options">
                      {[
                        { val: 'heritage', label: 'เพื่อสืบสานสูตรโบราณ หรือภูมิปัญญาจากบรรพบุรุษไม่ให้หายไป' },
                        { val: 'accessible', label: 'อยากให้เป็นของที่คนทั่วไปสามารถซื้อได้ทุกวัน ราคาจับต้องได้' },
                        { val: 'safe', label: 'เพื่อให้คนได้ใช้ของดี ปลอดภัย ไร้สารเคมี ดีต่อสุขภาพ' },
                        { val: 'innovative', label: 'เพื่อสร้างของแปลกใหม่ที่ยังไม่เคยมีใครทำมาก่อน' }
                      ].map(opt => (
                        <label key={opt.val} className="bdna-radio-option">
                          <input type="radio" name="q3-1" value={opt.val} checked={q3Form.q1 === opt.val} onChange={(e) => setQ3Form({ ...q3Form, q1: e.target.value })} />
                          <span className="bdna-radio-custom"></span><span className="bdna-radio-text">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="bdna-question-block">
                    <div className="bdna-q-label"><span className="bdna-q-number">2</span><span className="bdna-q-text">อะไรคือสิ่งที่คุณรู้สึก 'รับไม่ได้' ถ้าต้องทำสิ่งนี้?</span></div>
                    <div className="bdna-radio-options">
                      {[
                        { val: 'recipe', label: 'รับไม่ได้ถ้าผิดเพี้ยนไปจากสูตรต้นตำรับ (เน้นมาตรฐานดั้งเดิม)' },
                        { val: 'value', label: 'รับไม่ได้ถ้าลูกค้ากินแล้วไม่อร่อยหรือรู้สึกไม่คุ้มเงิน' },
                        { val: 'quality', label: 'รับไม่ได้ถ้าสินค้าไม่ได้มาตรฐาน' },
                        { val: 'unique', label: 'รับไม่ได้ถ้าสินค้าไม่มีความโดดเด่นจากสินค้าทั่วไป' }
                      ].map(opt => (
                        <label key={opt.val} className="bdna-radio-option">
                          <input type="radio" name="q3-2" value={opt.val} checked={q3Form.q2 === opt.val} onChange={(e) => setQ3Form({ ...q3Form, q2: e.target.value })} />
                          <span className="bdna-radio-custom"></span><span className="bdna-radio-text">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="bdna-question-block">
                    <div className="bdna-q-label"><span className="bdna-q-number">3</span><span className="bdna-q-text">ถ้าต้องเล่าที่มาของสินค้าให้ลูกค้าฟังคุณจะเริ่มเล่าจากเรื่องอะไร?</span></div>
                    <div className="bdna-radio-options">
                      {[
                        { val: 'history', label: 'เล่าประวัติยาวนานและที่มาของภูมิปัญญาจากรุ่นก่อน' },
                        { val: 'family', label: 'เล่าเรื่องตอนที่เริ่มทำกันเองในครอบครัว' },
                        { val: 'culture', label: 'เล่าถึงที่มาของแหล่งวัตถุดิบและการคัดสรรอย่างพิถีพิถัน' },
                        { val: 'passion', label: 'เล่าถึงแรงบันดาลใจ หรือไอเดียที่ทำให้เกิดสินค้านี้' }
                      ].map(opt => (
                        <label key={opt.val} className="bdna-radio-option">
                          <input type="radio" name="q3-3" value={opt.val} checked={q3Form.q3 === opt.val} onChange={(e) => setQ3Form({ ...q3Form, q3: e.target.value })} />
                          <span className="bdna-radio-custom"></span><span className="bdna-radio-text">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="bdna-question-block">
                    <div className="bdna-q-label"><span className="bdna-q-number">4</span><span className="bdna-q-text">คุณอยากให้ลูกค้าจดจำสินค้าของคุณว่ายังไง?</span></div>
                    <div className="bdna-radio-options">
                      {[
                        { val: 'souvenir', label: 'ของดีประจำจังหวัดที่ต้องซื้อฝาก' },
                        { val: 'everyday', label: 'ของอร่อยติดบ้านที่กินได้เรื่อยๆ' },
                        { val: 'health', label: 'ตัวช่วยดูแลเรื่องสุขภาพ' },
                        { val: 'design', label: 'ของฝากที่มีดีไซน์สวย เป็นเอกลักษณ์ ไม่ซ้ำใคร' }
                      ].map(opt => (
                        <label key={opt.val} className="bdna-radio-option">
                          <input type="radio" name="q3-4" value={opt.val} checked={q3Form.q4 === opt.val} onChange={(e) => setQ3Form({ ...q3Form, q4: e.target.value })} />
                          <span className="bdna-radio-custom"></span><span className="bdna-radio-text">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="bdna-question-block">
                    <div className="bdna-q-label"><span className="bdna-q-number">5</span><span className="bdna-q-text">สุดท้าย..คุณอยากให้ลูกค้า 'รู้สึก' ยังไงเมื่อใช้สินค้าของคุณ?</span></div>
                    <div className="bdna-radio-options">
                      {[
                        { val: 'pride', label: 'รู้สึกชื่นชมและภูมิใจในความเป็นไทย' },
                        { val: 'happy', label: 'รู้สึกสบายใจ และอยากให้มีความสุข' },
                        { val: 'healthy', label: 'สุขภาพที่ดีขึ้น' },
                        { val: 'premium-feel', label: 'รู้สึกได้ยกระดับตัวเอง ดูดีมีฐานะ' }
                      ].map(opt => (
                        <label key={opt.val} className="bdna-radio-option">
                          <input type="radio" name="q3-5" value={opt.val} checked={q3Form.q5 === opt.val} onChange={(e) => setQ3Form({ ...q3Form, q5: e.target.value })} />
                          <span className="bdna-radio-custom"></span><span className="bdna-radio-text">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="bdna-form-step" style={{ display: currentStep === 4 ? 'block' : 'none' }}>
                  <div className="bdna-question-block">
                    <div className="bdna-q-label"><span className="bdna-q-number">1</span><span className="bdna-q-text">กลุ่มเป้าหมายของคุณ</span></div>
                    <div className="bdna-tag-options">
                      {[
                        { val: 'elderly', label: 'ผู้สูงอายุ' }, { val: 'student', label: 'นักเรียน/นักศึกษา' },
                        { val: 'worker', label: 'วัยทำงาน' }, { val: 'office', label: 'พนักงานออฟฟิศ' },
                        { val: 'health', label: 'คนรักสุขภาพ' }, { val: 'female', label: 'เพศหญิง' },
                        { val: 'male', label: 'เพศชาย' }, { val: 'other', label: 'อื่นๆ' }
                      ].map(tag => (
                        <span 
                          key={tag.val} 
                          className={`bdna-tag ${q4Form.tags.includes(tag.val) ? 'bdna-selected' : ''}`}
                          onClick={() => toggleTag(tag.val)}
                        >
                          {tag.label}
                        </span>
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
                        <option value="age">แบ่งตามช่วงอายุ</option>
                        <option value="gender">แบ่งตามเพศ</option>
                        <option value="lifestyle">แบ่งตาม Lifestyle</option>
                        <option value="income">แบ่งตามรายได้</option>
                        <option value="other">อื่น ๆ</option>
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

              {/* Nav Buttons */}
              <div className="bdna-form-nav">
                <button className="bdna-btn-back-form" onClick={handleBack} style={{ visibility: currentStep > 1 ? 'visible' : 'hidden' }}>ย้อน</button>
                <button className="bdna-btn-next-form" onClick={handleNext} disabled={!isNextEnabled()}>ต่อไป</button>
              </div>
            </>
          )}

          {/* ======= RESULT PAGE (โชว์เมื่อทำเสร็จหมดแล้ว) ======= */}
          <div className="bdna-result-page" style={{ display: showResult ? 'block' : 'none' }}>
            <div className="bdna-result-card bdna-result-card--identity">
              <div className="bdna-result-identity-header">
                <div className="bdna-result-archetype-icon"><iconify-icon icon="mdi:home-outline"></iconify-icon></div>
                <div className="bdna-result-archetype-text">
                  <h2 className="bdna-result-archetype-th"></h2><p className="bdna-result-archetype-en"></p>
                </div>
              </div>
              <hr className="bdna-result-divider" />
              <div className="bdna-result-identity-cols">
                <div className="bdna-result-identity-col"><h3 className="bdna-result-col-title">คุณค่าของแบรนด์ของคุณ</h3><p className="bdna-result-col-body"></p></div>
                <div className="bdna-result-identity-col"><h3 className="bdna-result-col-title">สิ่งที่ลูกค้ามองเห็น</h3><p className="bdna-result-col-body"></p></div>
              </div>
            </div>

            <div className="bdna-result-card bdna-result-card--design">
              <h2 className="bdna-result-section-title">คำแนะนำสำหรับการออกแบบ</h2>
              <div className="bdna-result-design-cols">
                <div className="bdna-result-design-left">
                  <h3 className="bdna-result-col-title">ชุดสี</h3>
                  <div className="bdna-result-palette"></div><p className="bdna-result-palette-desc"></p>
                  <button className="bdna-result-palette-btn"><iconify-icon icon="mdi:palette-outline"></iconify-icon> Use this palett <iconify-icon icon="mdi:chevron-right"></iconify-icon></button>
                </div>
                <div className="bdna-result-design-right">
                  <div className="bdna-result-design-block"><h3 className="bdna-result-col-title">ตัวหนังสือ</h3><p className="bdna-result-col-body"></p></div>
                  <div className="bdna-result-design-block"><h3 className="bdna-result-col-title">กลุ่มเป้าหมาย</h3><p className="bdna-result-col-body"></p></div>
                </div>
              </div>
            </div>

            <div className="bdna-result-card bdna-result-card--suggest">
              <div className="bdna-result-suggest-header">
                <iconify-icon icon="mdi:shimmer" className="bdna-result-suggest-icon"></iconify-icon><span className="bdna-result-suggest-title">Suggested for you</span>
              </div>
              <ul className="bdna-result-suggest-list"></ul>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
};