import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import './Result.css';

import logoImg from './assets/logo.png';
import helpImg from './assets/help.png';

export const Result = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const projectId = location.state?.projectId;

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentTab, setCurrentTab] = useState('package');
  
  // State สำหรับแถบสี (Indicator) ตาม Logic เดิมของคุณ
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0, background: '#c94e1f' });
  const tabsRef = useRef([]);

  const [generatedItems, setGeneratedItems] = useState([
    { id: 1, category: 'package', isFavorite: false, label: 'Logo 1' },
    { id: 2, category: 'package', isFavorite: false, label: 'Logo 2' },
    { id: 3, category: 'package', isFavorite: false, label: 'Logo 3' },
  ]);

  // คืนค่าฟังก์ชัน moveIndicator ให้ทำงานตอนเปลี่ยน Tab หรือโหลดหน้า
  useEffect(() => {
    const tabIndex = ['package', 'label', 'mockup'].indexOf(currentTab);
    const activeElement = tabsRef.current[tabIndex];
    
    if (activeElement) {
      setIndicatorStyle({
        left: activeElement.offsetLeft,
        width: activeElement.offsetWidth,
        background: activeElement.dataset.color
      });
    }
  }, [currentTab]);

  const toggleFavorite = (id) => {
    setGeneratedItems(items => 
      items.map(item => item.id === id ? { ...item, isFavorite: !item.isFavorite } : item)
    );
  };

  const activeItems = generatedItems.filter(item => item.category === currentTab);

  return (
    <div className="rs-body">
      <header className="rs-navbar">
        <div className="rs-logo">
          <Link to="/">
            <img src={logoImg} alt="logo" className="rs-logo-img" />
          </Link>
        </div>
        <div className="rs-nav-icons">
          <button className="rs-btn-world"><iconify-icon icon="iconamoon:search-light"></iconify-icon></button>
          <button className="rs-btn-world"><iconify-icon icon="ph:bell-ringing-light"></iconify-icon></button>
          <button className="rs-btn-users"><iconify-icon icon="solar:user-linear"></iconify-icon></button>
        </div>
      </header>

      <div className="rs-container">
        <aside className={`rs-sidebar ${isSidebarCollapsed ? 'rs-collapsed' : ''}`}>
          <button className="rs-toggle-btn" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>
            {isSidebarCollapsed ? '❯' : '❮'}
          </button>
          <ul className="rs-menu">
            <li onClick={() => navigate('/project', { state: { projectId } })} style={{ cursor: 'pointer' }}>
              <span className="rs-icon">
                <iconify-icon icon="mdi:view-dashboard-outline"></iconify-icon>
                </span>
                <span className="rs-text">Projects</span>
            </li>
            <li onClick={() => navigate('/brand-dna', { state: { projectId } })} style={{ cursor: 'pointer' }}><span className="rs-icon"><iconify-icon icon="mdi:palette-outline"></iconify-icon></span><span className="rs-text">Brand DNA</span>
            </li>
            <li onClick={() => navigate('/create-concept', { state: { projectId } })} style={{ cursor: 'pointer' }}><span className="rs-icon"><iconify-icon icon="mdi:lightbulb-outline"></iconify-icon></span><span className="rs-text">Create Concept</span></li>

            <li onClick={() => navigate('/create-logo', { state: { projectId } })} style={{ cursor: 'pointer' }}>
              <span className="rs-icon">
                <iconify-icon icon="mdi:folder-outline"></iconify-icon>
              </span>
                <span className="rs-text">Create logo</span>
            </li>
             <li onClick={() => navigate('/result', { state: { projectId } })} style={{ cursor: 'pointer' }}>
                            <span className="cncpt-icon"><iconify-icon icon="mdi:folder-outline"></iconify-icon></span>
                            <span className="cncpt-text">Create Pictures</span>
                        </li>
          </ul>
          <hr className="rs-hr" />
          <ul className="rs-menu">
            <li onClick={() => navigate('/your-projects', { state: { projectId } })} style={{ cursor: 'pointer' }}><span className="rs-icon"><iconify-icon icon="mdi:folder-outline"></iconify-icon></span><span className="rs-text">Yours Projects</span></li>
          </ul>
          <div className="rs-help">
            <img src={helpImg} className="rs-help-img" alt="help" />
            <p className="rs-help-text">Having trouble?</p>
            <a href="#" className="rs-contact-link">Contact Us</a>
          </div>
        </aside>

        <div className="rs-main-content">
          {/* ลบปุ่มย้อนกลับส่วนเกินออกแล้ว */}
          <div className="rs-tabs-wrapper">
            <div className="rs-tabs">
              <div className="rs-tab-indicator" style={{ left: `${indicatorStyle.left}px`, width: `${indicatorStyle.width}px`, background: indicatorStyle.background }}></div>
              <button ref={el => tabsRef.current[0] = el} className={`rs-tab ${currentTab === 'package' ? 'rs-active' : ''}`} data-color="#c94e1f" onClick={() => setCurrentTab('package')}>Package</button>
              <button ref={el => tabsRef.current[1] = el} className={`rs-tab ${currentTab === 'label' ? 'rs-active' : ''}`} data-color="#8a9a3c" onClick={() => setCurrentTab('label')}>Label</button>
              <button ref={el => tabsRef.current[2] = el} className={`rs-tab ${currentTab === 'mockup' ? 'rs-active' : ''}`} data-color="#8f1d1d" onClick={() => setCurrentTab('mockup')}>Mockup</button>
            </div>
          </div>

          <div className="rs-tab-page rs-active">
            <div className="rs-logo-grid">
              {activeItems.map((item) => (
                <div key={item.id} className="rs-logo-card">
                  <div className="rs-logo-actions">
                    <button className="rs-action-btn"><iconify-icon icon="wordpress:fullscreen"></iconify-icon></button>
                    <button className="rs-action-btn" onClick={() => toggleFavorite(item.id)}>
                      <iconify-icon icon={item.isFavorite ? "solar:heart-bold" : "solar:heart-linear"} style={{ color: item.isFavorite ? '#D35325' : '#666' }}></iconify-icon>
                    </button>
                    <button className="rs-action-btn"><iconify-icon icon="mynaui:download"></iconify-icon></button>
                  </div>
                  <div className="rs-logo-box">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Result;