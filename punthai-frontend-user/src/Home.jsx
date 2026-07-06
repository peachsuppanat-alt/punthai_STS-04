import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

import img1           from './assets/1.png';
import img2           from './assets/2.png';
import img3           from './assets/3.png';
import img4           from './assets/4.png';
import womenImg       from './assets/women.png';
import emptyImg       from './assets/emtpy.png';
import logoImg        from './assets/logo.png';
import bgBanner       from './assets/banner.png';
import elementDesign  from './assets/home/element_design.png';
import element1       from './assets/home/element1.png';
import element2       from './assets/home/element2.png';
import dnaImg         from './assets/home/dna.png';
import logoServiceImg from './assets/home/logo.png';
import mockupImg      from './assets/home/mockup.png';
import postImg        from './assets/home/post.png';
import people1Img     from './assets/home/people1.png';
import pattern1Img    from './assets/home/pattern1.png';
import elementDot    from './assets/home/element_dot.png'
import marketBg      from './assets/home/market.png'
import elementMarket from './assets/home/element_market.png'
import panelMarket      from './assets/home/panelmarket.png'
import elementContent   from './assets/home/element_content.png'
import bgHeadHome       from './assets/home/BG-headhome.png'
import homeLogo         from './assets/home/homelogo.png'
import { API_URL } from './config';
import NotificationBell from './components/NotificationBell';

const Home = ({ user }) => {
  const [activeCard, setActiveCard]           = useState(null);
  const navigate                               = useNavigate();
  const [projects, setProjects]               = useState([]);
  const [openMenuId, setOpenMenuId]           = useState(null);
  const [showEditPopup, setShowEditPopup]     = useState(false);
  const [editProjectId, setEditProjectId]     = useState(null);
  const [editProjectName, setEditProjectName] = useState('');
  const [completions, setCompletions]         = useState({});

  useEffect(() => {
    if (user) {
      fetch(`${API_URL}/api/projects/${user.user_id}`)
        .then(r => r.json())
        .then(d => { if (d.status === 'success') setProjects(d.projects); })
        .catch(err => console.error('Fetch projects error:', err));

      fetch(`${API_URL}/api/users/${user.user_id}/completions`)
        .then(r => r.json())
        .then(d => {
          if (d.status === 'success') {
            const map = {};
            d.projects.forEach(p => { map[p.project_id] = p.percentage; });
            setCompletions(map);
          }
        })
        .catch(err => console.error('Fetch completions error:', err));
    } else {
      setProjects([]);
      setCompletions({});
    }
  }, [user]);

  const handleCreateProjectDirectly = async (e) => {
    if (e) e.preventDefault();
    if (!user) { alert('กรุณาเข้าสู่ระบบก่อนสร้างแบรนด์!'); return; }
    try {
      const res  = await fetch(`${API_URL}/api/projects`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.user_id }),
      });
      const data = await res.json();
      if (data.status === 'success') navigate('/project', { state: { projectId: data.project_id } });
      else alert('❌ ' + data.message);
    } catch { alert('เชื่อมต่อ Server ไม่ได้'); }
  };

  const toggleMenu = (e, id) => { e.stopPropagation(); setOpenMenuId(openMenuId === id ? null : id); };

  const handleDeleteProject = async (e, id) => {
    e.stopPropagation(); setOpenMenuId(null);
    if (!window.confirm('ลบโปรเจกต์นี้? ข้อมูลทั้งหมดจะหายไป')) return;
    try {
      const res  = await fetch(`${API_URL}/api/projects/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.status === 'success') setProjects(projects.filter(p => p.project_id !== id));
      else alert('❌ ' + data.message);
    } catch { alert('เชื่อมต่อ Server ไม่ได้'); }
  };

  const handleOpenEditPopup = (e, proj) => {
    e.stopPropagation(); setOpenMenuId(null);
    setEditProjectId(proj.project_id);
    setEditProjectName(proj.project_name || '');
    setShowEditPopup(true);
  };

  const handleSaveEditName = async (e) => {
    e.preventDefault();
    try {
      const res  = await fetch(`${API_URL}/api/projects/${editProjectId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_name: editProjectName }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setProjects(projects.map(p => p.project_id === editProjectId ? { ...p, project_name: editProjectName } : p));
        setShowEditPopup(false);
      } else alert('❌ ' + data.message);
    } catch { alert('เชื่อมต่อ Server ไม่ได้'); }
  };

  /* ── feature cards ── */
  const featureCards = [
    { img: img1, title: 'Brand DNA',       desc: 'กำหนดเอกลักษณ์ของแบรนด์\nให้ชัดเจนและแตกต่าง',           color: 'olive'  },
    { img: img2, title: 'Concept',         desc: 'สร้างแนวคิดธุรกิจที่โดดเด่น\nตอบโจทย์กลุ่มเป้าหมาย',      color: 'orange' },
    { img: img3, title: 'Create Picture',  desc: 'สร้างโลโก้และบรรจุภัณฑ์\nด้วย AI ระดับมืออาชีพ',          color: 'orange' },
    { img: img4, title: 'Market Planning', desc: 'วางแผนการตลาดและกิจกรรม\nสำหรับธุรกิจของคุณ',             color: 'olive'  },
  ];

  /* ── market section features ── */
  const marketFeatures = [
    { icon: 'si:search-line',               label: 'ค้นหาอีเวนท์',        desc: 'และตลาดที่เหมาะสม' },
    { icon: 'hugeicons:maps',               label: 'แผนที่อัจฉริยะ',       desc: 'ดูตำแหน่งและระยะทาง' },
    { icon: 'streamline-cyber:package-stack-2', label: 'เชื่อมต่อผู้ให้บริการ', desc: 'โรงพิมพ์และบรรจุภัณฑ์' },
  ];

  return (
    <div onClick={() => setOpenMenuId(null)}>

      {/* ════════════════════════════════
          DASHBOARD (logged-in + projects)
      ════════════════════════════════ */}
      {user && projects.length > 0 ? (
        <section className="user-projects-dashboard">
          <div className="user-projects-dashboard-inner">
          <div className="dashboard-header">
            <h2>
              ยินดีต้อนรับ, {user.user_name}
              <span style={{
                fontSize:13, padding:'4px 12px', borderRadius:20, fontWeight:700,
                background: user.subscription_status === 'PRO' ? 'linear-gradient(45deg,#FFD700,#FFA500)' : '#eee',
                color: user.subscription_status === 'PRO' ? '#000' : '#888',
                boxShadow: user.subscription_status === 'PRO' ? '0 2px 10px rgba(255,165,0,.4)' : 'none',
              }}>
                {user.subscription_status || 'STANDARD'}
              </span>
            </h2>
            <p>เลือกโปรเจกต์ที่คุณต้องการทำต่อ หรือสร้างแบรนด์ใหม่ได้เลย</p>
          </div>
          <div className="project-cards-container">
            <div className="project-card create-new" onClick={handleCreateProjectDirectly}>
              <iconify-icon icon="line-md:plus-circle" style={{ fontSize:48 }}></iconify-icon>
              <span>สร้างแบรนด์ใหม่</span>
            </div>
            {projects.map(proj => (
              <div key={proj.project_id} className="project-card"
                onClick={() => navigate('/project', { state: { projectId: proj.project_id } })}
                style={{ position:'relative' }}>
                <button onClick={e => toggleMenu(e, proj.project_id)}
                  style={{ position:'absolute',top:14,right:14,background:'none',border:'none',cursor:'pointer',fontSize:22,color:'#aaa',zIndex:2 }}>
                  <iconify-icon icon="mdi:dots-vertical"></iconify-icon>
                </button>
                {openMenuId === proj.project_id && (
                  <div style={{ position:'absolute',top:44,right:14,background:'#fff',boxShadow:'0 4px 18px rgba(0,0,0,.12)',borderRadius:12,zIndex:10,overflow:'hidden',minWidth:130 }}>
                    <div onClick={e => handleOpenEditPopup(e, proj)} style={{ padding:'12px 18px',cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',gap:8 }}>
                      <iconify-icon icon="mdi:pencil-outline" style={{ color:'#555' }}></iconify-icon> แก้ไขชื่อ
                    </div>
                    <div onClick={e => handleDeleteProject(e, proj.project_id)} style={{ padding:'12px 18px',cursor:'pointer',fontSize:14,color:'#e53935',display:'flex',alignItems:'center',gap:8 }}>
                      <iconify-icon icon="mdi:delete-outline" style={{ color:'#e53935' }}></iconify-icon> ลบโปรเจกต์
                    </div>
                  </div>
                )}
                <div className="proj-icon" style={{ width:72,height:72,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',borderRadius:14,background:proj.image_logo?'transparent':'#f9f5f2' }}>
                  {proj.image_logo
                    ? <img src={`${API_URL}${proj.image_logo}`} alt="logo" style={{ width:'100%',height:'100%',objectFit:'contain' }} />
                    : <iconify-icon icon="solar:folder-with-files-bold-duotone"></iconify-icon>}
                </div>
                <h3>{proj.project_name || 'โปรเจกต์ยังไม่ได้ตั้งชื่อ'}</h3>
                <div style={{ width:'100%', padding:'0 4px', marginTop:'8px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
                    <span style={{ fontSize:'12px', color:'#888' }}>ความสำเร็จ</span>
                    <span style={{ fontSize:'12px', fontWeight:'bold', color:(completions[proj.project_id] || 0) >= 75 ? '#4CAF50' : '#d75a2a' }}>
                      {completions[proj.project_id] || 0}%
                    </span>
                  </div>
                  <div style={{ width:'100%', height:'6px', background:'#f0f0f0', borderRadius:'3px', overflow:'hidden' }}>
                    <div style={{
                      width:`${completions[proj.project_id] || 0}%`,
                      height:'100%',
                      background:(completions[proj.project_id] || 0) >= 75 ? '#4CAF50' : (completions[proj.project_id] || 0) >= 40 ? '#FF9800' : '#d75a2a',
                      borderRadius:'3px',
                      transition:'width 0.8s ease-in-out'
                    }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          </div>
        </section>

      ) : (

        /* ════════════════════════════════
           HERO — 2 column
        ════════════════════════════════ */
        <section className="home" style={{ backgroundImage: `url(${bgHeadHome})`, backgroundSize: 'cover', backgroundPosition: 'center center', backgroundRepeat: 'no-repeat', backgroundColor: '#f0e8dc', minHeight: '733px' }}>
          {/* LEFT */}
          <div className="home-left">
            <p className="home-eyebrow">เครื่องมือช่วยผู้ประกอบการ</p>
            <h1>
              สร้างแบรนด์ของคุณ<br />
              ให้โดดเด่น<em>ด้วยพลัง</em><br />
              <em>ของคุณ</em>
            </h1>
            <p className="home-desc">
              เครื่องมือช่วยผู้ประกอบการคิดคอนเซปต์ ออกแบบโลโก้ และแพ็กเกจ
              ครบทุกขั้นตอนในที่เดียว — ง่าย เร็ว และมืออาชีพ
            </p>
            <div className="home-buttons">
              <button className="btn-create" onClick={handleCreateProjectDirectly}>
                เริ่มสร้างแบรนด์
              </button>
              <a href="#features" className="btn-howto">ดูผลงานจริง →</a>
            </div>

            {/* Feature highlights */}
            <div className="home-highlights">
              <div className="home-highlight-item">
                <iconify-icon icon="ph:pen-nib-light" style={{ fontSize:28, color:'var(--orange)' }}></iconify-icon>
                <div>
                  <p className="hh-title">โลโก้</p>
                  <p className="hh-desc">ออกแบบเฉพาะแบรนด์</p>
                </div>
              </div>
              <div className="home-highlight-item">
                <iconify-icon icon="ph:package-light" style={{ fontSize:28, color:'var(--orange)' }}></iconify-icon>
                <div>
                  <p className="hh-title">แพ็กเกจจิ้ง</p>
                  <p className="hh-desc">สวยโดดเด่น ใช้งานได้จริง</p>
                </div>
              </div>
              <div className="home-highlight-item">
                <iconify-icon icon="ph:image-light" style={{ fontSize:28, color:'var(--orange)' }}></iconify-icon>
                <div>
                  <p className="hh-title">ภาพสินค้า</p>
                  <p className="hh-desc">พร้อมใช้ทุกช่องทางออนไลน์</p>
                </div>
              </div>
              <div className="home-highlight-item">
                <iconify-icon icon="ph:check-circle-light" style={{ fontSize:28, color:'var(--orange)' }}></iconify-icon>
                <div>
                  <p className="hh-title">พร้อมใช้งานจริง</p>
                  <p className="hh-desc">ส่งไฟล์ครบ จบในที่เดียว</p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT – product mockup image + brand panel */}
          <div className="home-right">
            <div className="hero-mockup-wrap">

              {/* Logo panel floating card */}
              <div className="logo-panel">
                <div className="brand-panel-tabs">
                  <span className="bp-tab">BRAND</span>
                  <span className="bp-tab active">LOGO</span>
                  <span className="bp-tab">PACK</span>
                  <span className="bp-tab">OUTPUT</span>
                </div>
                <div className="brand-panel-body">
                  <p className="bp-label">โลโก้ของแบรนด์</p>
                  <div className="logo-panel-img-wrap">
                    <img src={homeLogo} alt="brand logo" className="logo-panel-img" />
                  </div>
                </div>
              </div>

              {/* Brand panel floating card */}
              <div className="brand-panel">
                <div className="brand-panel-tabs">
                  <span className="bp-tab active">BRAND</span>
                  <span className="bp-tab">LOGO</span>
                  <span className="bp-tab">PACK</span>
                  <span className="bp-tab">OUTPUT</span>
                </div>
                <div className="brand-panel-body">
                  <p className="bp-label">Named</p>
                  <h3 className="bp-name">PunThai</h3>
                  <p className="bp-desc">แบรนด์เครื่องมือสำหรับผู้ประกอบการขนาดเล็กกลางกลาง</p>
                  <p className="bp-section-label">Color</p>
                  <div className="bp-colors">
                    <span className="bp-dot" style={{background:'#D35325'}}></span>
                    <span className="bp-dot" style={{background:'#C97A50'}}></span>
                    <span className="bp-dot" style={{background:'#919A4A'}}></span>
                    <span className="bp-dot" style={{background:'#3B3B2F'}}></span>
                  </div>
                  <div className="bp-row">
                    <div>
                      <p className="bp-section-label">Font</p>
                      <p className="bp-value">Sarabun Bold</p>
                    </div>
                    <div>
                      <p className="bp-section-label">Style</p>
                      <p className="bp-value">Thai Modern</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* gradient fade to next section */}
          <div className="home-gradient-fade" />
        </section>
      )}



      {/* ════════════════════════════════
          FEATURES — new design
      ════════════════════════════════ */}
      <section className="features-new" id="features">
        {/* Header row: icon + label */}
        <div className="fn-header">
          <img src={elementDesign} alt="element" className="fn-element-design" />
          <div className="fn-header-text">
            <span className="fn-label">บริการออกแบบ</span>
            <span className="fn-label-sub">สำหรับสินค้าชุมชน</span>
          </div>
        </div>

        {/* Big heading */}
        <h2 className="fn-heading">
          วันนี้คุณจะ<em>ดีไซน์อะไร?</em>
        </h2>

        {/* Divider element1 */}
        <img src={element1} alt="" className="fn-element1" />

        {/* Sub text */}
        <p className="fn-subtext">
          เลือกประเภทที่คุณต้องการ<br />
          เราช่วยสร้างสรรค์งานดีไซน์ที่ตรงใจคุณด้วย AI
        </p>

        {/* 4 service cards */}
        <div className="fn-grid">
          {[
            { img: dnaImg,         title: 'อัตลักษณ์แบรนด์',    desc: 'สร้างคู่มืออัตลักษณ์แบรนด์|ที่ครบถ้วนและชัดเจน',       btn: 'เริ่มวางแผน →',          imgClass: 'fn-img--dna'     },
            { img: logoServiceImg, title: 'โลโก้',               desc: 'ออกแบบโลโก้ที่เหมาะสม|กับแบรนด์ด้วย AI',               btn: 'เริ่มสร้างแบรนด์ →',     imgClass: 'fn-img--logo'    },
            { img: mockupImg,      title: 'บรรจุภัณฑ์',          desc: 'ออกแบบฉลากและบรรจุภัณฑ์|ที่เหมาะกับสินค้า',            btn: 'เริ่มสร้างคอนเทนต์ →',  imgClass: 'fn-img--mockup'  },
            { img: postImg,        title: 'โพสต์โซเชียลมีเดีย',  desc: 'ออกแบบโพสต์สำหรับ|Facebook, Instagram, LINE',           btn: 'ดูการวิเคราะห์ →',       imgClass: 'fn-img--post'    },
          ].map((card) => (
            <div className="fn-card" key={card.title} onClick={handleCreateProjectDirectly}>
              <div className="fn-card-img-wrap">
                <img src={card.img} alt={card.title} className={card.imgClass} />
              </div>
              <div className="fn-card-body">
                <h3>{card.title}</h3>
                <p>{card.desc.split('|').map((t, i) => <span key={i}>{t}<br /></span>)}</p>
              </div>
              <button className="fn-card-btn" onClick={handleCreateProjectDirectly}>{card.btn}</button>
            </div>
          ))}
        </div>

        {/* Bottom banner */}
        <div className="fn-banner-outer">
        <div className="fn-banner">
          <img src={people1Img} alt="คุณป้า" className="fn-banner-people" />
          <img src={pattern1Img} alt="" className="fn-banner-pattern" />
          <div className="fn-banner-text">
            <img src={elementDot} alt="" className="fn-banner-icon" />
            <div>
              <p className="fn-banner-title">ไม่แน่ใจจะเลือกอะไร ?</p>
              <p className="fn-banner-desc">ลองทำไปตามขั้นตอน<br />เพื่อประสิทธิภาพในการพัฒนาแบรนด์ของคุณสู่ระดับสากล</p>
            </div>
          </div>
          <button className="fn-banner-btn" onClick={handleCreateProjectDirectly}>
            เริ่มโปรเจกต์ &nbsp;＋
          </button>
        </div>

        </div>{/* /fn-banner-outer */}

        {/* Bottom divider element2 */}
        <img src={element2} alt="" className="fn-element2" />
      </section>

      {/* ════════════════════════════════
          MARKET — ตลาดชุมชน และโรงพิมพ์
      ════════════════════════════════ */}
      <section className="market-section" style={{ backgroundImage: `url(${marketBg})` }}>
        <div className="market-section__overlay"></div>

        {/* LEFT — text */}
        <div className="mkt-left">
          {/* Header: element_market + label */}
          <div className="mkt-header">
            <img src={elementMarket} alt="element" className="mkt-element" />
            <div className="mkt-header-text">
              <span className="mkt-label">ตลาดชุมชน และโรงพิมพ์</span>
              <span className="mkt-label-sub">สำหรับสินค้าชุมชน</span>
            </div>
          </div>

          {/* Heading */}
          <h2 className="mkt-heading">
            ค้นหาตลาด <em>และโรงพิมพ์ที่ใช่</em><br />
            <em>โอกาสใหม่ของธุรกิจชุมชน</em>
          </h2>

          {/* Description */}
          <p className="mkt-desc">
            ช่วยคุณค้นหาอีเวนท์ OTOP ตลาดทั่วประเทศ<br />
            และโรงพิมพ์ที่เหมาะสมกับสินค้าใกล้บ้านคุณ
          </p>

          {/* 3 icon features */}
          <div className="mkt-features">
            {marketFeatures.map((mf, i) => (
              <div className="mkt-feat" key={i}>
                <div className="mkt-feat-icon">
                  <iconify-icon icon={mf.icon} style={{ fontSize: 28, color: 'var(--olive-dk)' }}></iconify-icon>
                </div>
                <div>
                  <p className="mkt-feat-label">{mf.label}</p>
                  <p className="mkt-feat-desc">{mf.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA button */}
          <button className="btn-create mkt-btn" onClick={handleCreateProjectDirectly}>
            ลองดูเลย &nbsp;→
          </button>
        </div>

        {/* RIGHT — panelmarket image */}
        <div className="mkt-right">
          <img src={panelMarket} alt="panel market" className="mkt-panel-img" />
        </div>
      </section>

      {/* ════════════════════════════════
          AUTOPOST — Content Online
      ════════════════════════════════ */}
      <section className="autopost">
        {/* Header row — full width, like other sections */}
        <div className="autopost-header">
          <img src={elementContent} alt="element" className="autopost-element" />
          <div className="autopost-header-text">
            <span className="autopost-label-main">สร้างรูปโฆษณาการตลาด</span>
            <span className="autopost-label-sub">สำหรับสินค้าชุมชน</span>
          </div>
        </div>

        {/* BODY — mockups left, text right */}
        <div className="autopost-body">
        {/* LEFT — 4 mock cards */}
        <div className="autopost-mockups">

          {/* Facebook */}
          <div className="mock-card">
            <div className="mock-card-header">
              <div className="mock-social-icon mock-social-icon--facebook">
                <iconify-icon icon="ic:baseline-facebook" style={{ fontSize:28, color:'#fff' }}></iconify-icon>
              </div>
              <span className="mock-card-title mock-card-title--facebook">Facebook</span>
            </div>
            <div className="mock-field w85"></div>
            <div className="mock-field w70"></div>
            <div className="mock-field tall"></div>
            <button className="mock-post-btn mock-post-btn--blue">
              <iconify-icon icon="mingcute:send-plane-fill"></iconify-icon>
              สร้างโพสต์
            </button>
          </div>

          {/* Instagram */}
          <div className="mock-card">
            <div className="mock-card-header">
              <div className="mock-social-icon mock-social-icon--instagram">
                <iconify-icon icon="mdi:instagram" style={{ fontSize:28, color:'#fff' }}></iconify-icon>
              </div>
              <span className="mock-card-title mock-card-title--instagram">Instagram</span>
            </div>
            <div className="mock-field w100"></div>
            <div className="mock-field w75"></div>
            <div className="mock-field tall"></div>
            <button className="mock-post-btn mock-post-btn--instagram">
              <iconify-icon icon="mingcute:send-plane-fill"></iconify-icon>
              สร้างโพสต์
            </button>
          </div>

          {/* LINE OA */}
          <div className="mock-card">
            <div className="mock-card-header">
              <div className="mock-social-icon mock-social-icon--line">
                <iconify-icon icon="simple-icons:line" style={{ fontSize:26, color:'#fff' }}></iconify-icon>
              </div>
              <span className="mock-card-title mock-card-title--line">LINE OA</span>
            </div>
            <div className="mock-field w85"></div>
            <div className="mock-field w60"></div>
            <div className="mock-field tall"></div>
            <button className="mock-post-btn mock-post-btn--green">
              <iconify-icon icon="mingcute:send-plane-fill"></iconify-icon>
              สร้างข้อความ
            </button>
          </div>

          {/* TikTok */}
          <div className="mock-card">
            <div className="mock-card-header">
              <div className="mock-social-icon mock-social-icon--tiktok">
                <iconify-icon icon="simple-icons:tiktok" style={{ fontSize:24, color:'#fff' }}></iconify-icon>
              </div>
              <span className="mock-card-title mock-card-title--tiktok">TikTok</span>
            </div>
            <div className="mock-field w100"></div>
            <div className="mock-field w55"></div>
            <div className="mock-field tall"></div>
            <button className="mock-post-btn mock-post-btn--tiktok">
              <iconify-icon icon="mingcute:send-plane-fill"></iconify-icon>
              สร้างโฆษณา
            </button>
          </div>

        </div>

        {/* RIGHT — text */}
        <div className="autopost-text">
          <h2>
            คอนเทนต์พร้อมโพสต์
            <em>ในไม่กี่นาที</em>
          </h2>

          <p>
            ช่วยให้ผู้ประกอบการสร้างคอนเทนต์โฆษณาได้เร็วขึ้น
            ครบทุกแพลตฟอร์ม <br />ด้วยพลัง AI โดยไม่ต้องมีทีมดีไซน์
          </p>

          <ul className="num-list">
            <li className="num-item">
              <span className="num-badge num-badge--orange">1</span>
              <div className="num-icon-circle">
                <iconify-icon icon="fluent:flash-sparkle-24-filled" style={{ fontSize:26, color:'var(--olive-dk)' }}></iconify-icon>
              </div>
              <div className="num-item-text">
                <h4>สร้างคอนเทนต์ได้เร็วขึ้น</h4>
                <p>AI สร้างภาพโฆษณาและแคปชั่น<br />จาก Brand DNA ของคุณในไม่กี่วินาที</p>
              </div>
            </li>
            <li className="num-item">
              <span className="num-badge num-badge--orange">2</span>
              <div className="num-icon-circle">
                <iconify-icon icon="mdi:layers-triple" style={{ fontSize:26, color:'var(--olive-dk)' }}></iconify-icon>
              </div>
              <div className="num-item-text">
                <h4>ทำภาพหลายแพลตฟอร์มอัตโนมัติ</h4>
                <p>ปรับขนาดและรูปแบบให้เหมาะกับ<br />Facebook, Instagram, LINE และ TikTok ในครั้งเดียว</p>
              </div>
            </li>
            <li className="num-item">
              <span className="num-badge num-badge--orange">3</span>
              <div className="num-icon-circle">
                <iconify-icon icon="mdi:robot-happy-outline" style={{ fontSize:26, color:'var(--olive-dk)' }}></iconify-icon>
              </div>
              <div className="num-item-text">
                <h4>AI ช่วยคิดแคปชั่น</h4>
                <p>ระบบแนะนำข้อความโพสต์ที่ตรงกลุ่มเป้าหมาย<br />ลดเวลาการเขียนและออกแบบได้อย่างมาก</p>
              </div>
            </li>
            <li className="num-item">
              <span className="num-badge num-badge--orange">4</span>
              <div className="num-icon-circle">
                <iconify-icon icon="mdi:history" style={{ fontSize:26, color:'var(--olive-dk)' }}></iconify-icon>
              </div>
              <div className="num-item-text">
                <h4>เก็บประวัติผลงานย้อนหลัง</h4>
                <p>บันทึกงานทุกชิ้นไว้ในระบบ<br />นำกลับมาใช้หรือแก้ไขต่อได้ทุกเมื่อ</p>
              </div>
            </li>
          </ul>
        </div>
        </div>{/* /autopost-body */}
      </section>

      {/* ════════════════════════════════
          CTA BANNER — BG image + text left
      ════════════════════════════════ */}
      <section className="cta-banner" style={{ backgroundImage: `url(${bgBanner})` }}>
        <div className="cta-banner-content">
          <h2>พร้อมสร้างแบรนด์ที่ยั่งยืนไปด้วยกัน</h2>
          <p>เริ่มต้นวันนี้ เพื่ออนาคตที่ดีกว่าของสินค้าชุมชนไทย</p>
          <div className="cta-banner-btns">
            <button className="btn-cta-white" onClick={handleCreateProjectDirectly}>
              <iconify-icon icon="mdi:rocket-launch-outline"></iconify-icon>
              เริ่มสร้างแบรนด์
            </button>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════
          FOOTER
      ════════════════════════════════ */}
      <footer className="footer">
        <div className="footer-container">
          <div className="footer-col">
            <img src={logoImg} alt="Logo" className="footer-logo" />
            <p>เครื่องมือช่วยผู้ประกอบการคิดคอนเซปต์ ออกแบบโลโก้ และแพ็กเกจครบทุกขั้นตอนในที่เดียว</p>
            <div className="socials">
              <a href="#"><iconify-icon icon="ic:baseline-facebook"></iconify-icon></a>
              <a href="#"><iconify-icon icon="mdi:twitter"></iconify-icon></a>
              <a href="#"><iconify-icon icon="mdi:instagram"></iconify-icon></a>
              <a href="#"><iconify-icon icon="mdi:youtube"></iconify-icon></a>
            </div>
          </div>
          <div className="footer-col">
            <h4>Company</h4>
            <a href="#">FAQs</a><a href="#">About Us</a><a href="#">Contact Us</a>
          </div>
          <div className="footer-col">
            <h4>Contact</h4>
            <p>+66 00 000 0000</p><p>hello@punthai.com</p><p>Social Media</p>
          </div>
          <div className="footer-col">
            <h4>รับข่าวสารล่าสุด</h4>
            <p style={{ fontSize:13, marginBottom:10, color:'rgba(255,255,255,.65)' }}>รับข้อมูลอัปเดตและโปรโมชันก่อนใคร</p>
            <div className="subscribe">
              <input type="email" placeholder="อีเมลของคุณ" />
              <button>ส่ง</button>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2025 PunThai. สงวนลิขสิทธิ์ทุกประการ</span>
          <span>Made with ❤️ in Thailand</span>
        </div>
      </footer>

      {/* ════════════════════════════════
          POPUP แก้ไขชื่อ
      ════════════════════════════════ */}
      {showEditPopup && (
        <div style={{ position:'fixed',inset:0,background:'rgba(30,26,21,.65)',display:'flex',justifyContent:'center',alignItems:'center',zIndex:1000,backdropFilter:'blur(4px)' }}
          onClick={() => setShowEditPopup(false)}>
          <div style={{ background:'#fff',padding:32,borderRadius:20,width:'90%',maxWidth:400,boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}
            onClick={e => e.stopPropagation()}>
            <h2 style={{ color:'#D35325',marginBottom:16,fontSize:20 }}>แก้ไขชื่อโปรเจกต์</h2>
            <form onSubmit={handleSaveEditName}>
              <input type="text" placeholder="พิมพ์ชื่อโปรเจกต์ที่นี่..."
                value={editProjectName} onChange={e => setEditProjectName(e.target.value)} required
                style={{ width:'100%',padding:'12px 16px',marginBottom:20,borderRadius:12,border:'1.5px solid #e8dfd4',fontSize:15,outline:'none',fontFamily:'var(--font-th)' }} />
              <div style={{ display:'flex',justifyContent:'flex-end',gap:10 }}>
                <button type="button" onClick={() => setShowEditPopup(false)}
                  style={{ padding:'10px 22px',borderRadius:999,border:'none',cursor:'pointer',background:'#f0ece7',color:'#555',fontFamily:'var(--font-th)',fontWeight:600 }}>ยกเลิก</button>
                <button type="submit"
                  style={{ padding:'10px 22px',borderRadius:999,border:'none',cursor:'pointer',background:'#D35325',color:'#fff',fontFamily:'var(--font-th)',fontWeight:700 }}>บันทึก</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ปุ่มแจ้งเตือนลอย มุมล่างขวา (คงตำแหน่งเมื่อเลื่อนหน้าจอ) */}
      {user && <NotificationBell floating />}
    </div>
  );
};

export default Home;