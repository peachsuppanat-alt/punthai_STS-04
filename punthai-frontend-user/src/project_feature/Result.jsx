import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import './Result.css';
import './PackageCatalog.css';
import PackageCatalog from './PackageCatalog';
import MockupEditor from './MockupEditor';
import LabelEditor from './LabelEditor';
import logoImg from '../assets/logo.png';
import { API_URL } from '../config';

export const Result = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const projectId = location.state?.projectId;

    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    const userId = userData.user_id || 0;

    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [currentTab, setCurrentTab] = useState('package');
    const [projectData, setProjectData] = useState({});

    const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0, background: '#c94e1f' });
    const tabsRef = useRef([]);

    // ====== State สำหรับ Mockup (เดิม) ======
    const [generatedItems, setGeneratedItems] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [detailsInput, setDetailsInput] = useState('');
    const [negativeInput, setNegativeInput] = useState('');
    const [useImportedColor, setUseImportedColor] = useState(false);
    const [useImportedFont, setUseImportedFont] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);

    // ============= EFFECTS =============
    useEffect(() => {
        if (!projectId) { alert("ไม่พบรหัสโปรเจกต์"); navigate('/'); return; }
        fetchProjectDetails();
        fetchPictures();
    }, [projectId]);

    useEffect(() => {
        const tabIndex = ['package', 'label', 'mockup'].indexOf(currentTab);
        const activeElement = tabsRef.current[tabIndex];
        if (activeElement) {
            setIndicatorStyle({ left: activeElement.offsetLeft, width: activeElement.offsetWidth, background: activeElement.dataset.color });
        }
    }, [currentTab]);

    // ============= FETCHERS =============
    const fetchProjectDetails = async () => {
        try {
            const res = await fetch(`${API_URL}/api/projects/detail/${projectId}`);
            const data = await res.json();
            if (data.status === 'success') setProjectData(data.project);
        } catch (err) { }
    };

    const fetchPictures = async () => {
        try {
            const res = await fetch(`${API_URL}/api/pictures/${projectId}`);
            const data = await res.json();
            if (data.status === 'success') setGeneratedItems(data.data);
        } catch (err) { }
    };

    // ============= HANDLERS MOCKUP =============
    const handleGenerateMockup = async () => {
        setIsModalOpen(false); setIsLoading(true);
        const payload = {
            project_id: projectId, user_id: userId, brand_name: projectData.project_name, category: currentTab,
            details: detailsInput, negative_prompt: negativeInput, use_imported_color: useImportedColor, use_imported_font: useImportedFont
        };
        const res = await fetch(`${API_URL}/api/generate-picture`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await res.json();
        if (data.status === 'success') fetchPictures();
        setIsLoading(false);
    };

    const toggleFavorite = async (id, currentStatus) => {
        const newStatus = !currentStatus;
        setGeneratedItems(items => items.map(item => item.id === id ? { ...item, isFavorite: newStatus } : item));
        await fetch(`${API_URL}/api/pictures/like/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isFavorite: newStatus }) });
    };

    const activeItems = generatedItems.filter(item => item.category === currentTab);

    // ============= RENDER =============
    return (
        <div className="rs-body">
            <header className="rs-navbar">
                <div className="rs-logo"><Link to="/"><img src={logoImg} alt="logo" className="rs-logo-img" /></Link></div>
                <div className="rs-nav-icons">
                    <button className="rs-btn-world"><iconify-icon icon="iconamoon:search-light"></iconify-icon></button>
                    <button className="rs-btn-world"><iconify-icon icon="ph:bell-ringing-light"></iconify-icon></button>
                    <button className="rs-btn-users"><iconify-icon icon="solar:user-linear"></iconify-icon></button>
                </div>
            </header>

            <div className="rs-container">
                <aside className={`rs-sidebar ${isSidebarCollapsed ? 'rs-collapsed' : ''}`}>
                    <button className="rs-toggle-btn" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>{isSidebarCollapsed ? '❯' : '❮'}</button>
                    <ul className="rs-menu">
                        <li onClick={() => navigate('/project', { state: { projectId } })}><span className="rs-icon"><iconify-icon icon="mdi:view-dashboard-outline"></iconify-icon></span><span className="rs-text">Projects</span></li>
                        <li onClick={() => navigate('/brand-dna', { state: { projectId } })}><span className="rs-icon"><iconify-icon icon="mdi:palette-outline"></iconify-icon></span><span className="rs-text">Brand DNA</span></li>
                        <li onClick={() => navigate('/create-concept', { state: { projectId } })}><span className="rs-icon"><iconify-icon icon="mdi:lightbulb-outline"></iconify-icon></span><span className="rs-text">Create Concept</span></li>
                        <li onClick={() => navigate('/create-logo', { state: { projectId } })}><span className="rs-icon"><iconify-icon icon="mdi:folder-outline"></iconify-icon></span><span className="rs-text">Create logo</span></li>
                        <li className="active" style={{ cursor: 'pointer', background: '#f5f5f5' }}><span className="cncpt-icon" style={{ color: '#d3542b' }}><iconify-icon icon="mdi:image-outline"></iconify-icon></span><span className="cncpt-text" style={{ color: '#d3542b', fontWeight: 'bold' }}>Create Pictures</span></li>
                    </ul>
                </aside>

                <div className="rs-main-content">
                    <div className="rs-tabs-wrapper">
                        <div className="rs-tabs">
                            <div className="rs-tab-indicator" style={{ left: `${indicatorStyle.left}px`, width: `${indicatorStyle.width}px`, background: indicatorStyle.background }}></div>
                            <button ref={el => tabsRef.current[0] = el} className={`rs-tab ${currentTab === 'package' ? 'rs-active' : ''}`} data-color="#c94e1f" onClick={() => setCurrentTab('package')}>Package</button>
                            <button ref={el => tabsRef.current[1] = el} className={`rs-tab ${currentTab === 'label' ? 'rs-active' : ''}`} data-color="#8a9a3c" onClick={() => setCurrentTab('label')}>Label</button>
                            <button ref={el => tabsRef.current[2] = el} className={`rs-tab ${currentTab === 'mockup' ? 'rs-active' : ''}`} data-color="#8f1d1d" onClick={() => setCurrentTab('mockup')}>Mockup</button>
                        </div>
                    </div>

                    <div className="rs-tab-page rs-active" style={{ marginTop: 20 }}>
                        {/* แท็บ Package */}
                        {currentTab === 'package' && <PackageCatalog />}

                        {/* แท็บ Label — เรียกใช้ LabelEditor component */}
                        {currentTab === 'label' && (
                            <LabelEditor projectId={projectId} userId={userId} />
                        )}

                        {/* แท็บ Mockup */}
                        {currentTab === 'mockup' && (
                            <MockupEditor
                                projectId={projectId}
                                userId={userId}
                                projectName={projectData.project_name}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Modal Generate Mockup (เดิม) */}
            {isModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#fff', padding: 30, borderRadius: 12, width: 480 }}>
                        <h3 style={{ marginTop: 0 }}>Generate Mockup</h3>
                        <textarea placeholder="รายละเอียดเพิ่มเติม..." value={detailsInput} onChange={e => setDetailsInput(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', minHeight: 80 }} />
                        <textarea placeholder="Negative prompt (ห้ามมี...)" value={negativeInput} onChange={e => setNegativeInput(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ddd', minHeight: 60, marginTop: 8 }} />
                        <label style={{ display: 'block', marginTop: 8 }}><input type="checkbox" checked={useImportedColor} onChange={e => setUseImportedColor(e.target.checked)} /> ใช้ Color Palette ของแบรนด์</label>
                        <label style={{ display: 'block', marginTop: 4 }}><input type="checkbox" checked={useImportedFont} onChange={e => setUseImportedFont(e.target.checked)} /> ใช้ฟอนต์ของแบรนด์</label>
                        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                            <button onClick={() => setIsModalOpen(false)} style={{ flex: 1, padding: 10, background: '#eee', border: 'none', borderRadius: 6, cursor: 'pointer' }}>ยกเลิก</button>
                            <button onClick={handleGenerateMockup} style={{ flex: 1, padding: 10, background: '#8f1d1d', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Generate</button>
                        </div>
                    </div>
                </div>
            )}

            {previewImage && <div onClick={() => setPreviewImage(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, cursor: 'pointer' }}><img src={previewImage} style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} alt="" /></div>}
            {isLoading && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, color: '#fff', fontSize: 18 }}>กำลังสร้าง Mockup ด้วย AI...</div>}
        </div>
    );
};

export default Result;