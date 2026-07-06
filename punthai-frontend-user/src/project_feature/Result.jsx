import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import './Result.css';
import './PackageCatalog.css';
import PackageCatalog from './PackageCatalog';
import MockupEditor from './MockupEditor';
import LabelEditor from './LabelEditor';
import logoImg from '../assets/logo.png';
import { ProjectSidebar } from '../components/sidebar';
import { API_URL } from '../config';
import NavProfileButton from '../components/NavProfileButton';
import NotificationBell from '../components/NotificationBell';

const TABS = [
  { id: 'package', label: 'Package' },
  { id: 'label',   label: 'Label'   },
  { id: 'mockup',  label: 'Mockup'  },
];

export const Result = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const projectId = location.state?.projectId;

    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    const userId = userData.user_id || 0;

    const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'package');
    const [projectData, setProjectData] = useState({});

    useEffect(() => {
        if (!projectId) { alert("\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e23\u0e2b\u0e31\u0e2a\u0e42\u0e1b\u0e23\u0e40\u0e08\u0e01\u0e15\u0e4c"); navigate('/'); return; }
        fetchProjectDetails();
    }, [projectId]);

    const fetchProjectDetails = async () => {
        try {
            const res = await fetch(`${API_URL}/api/projects/detail/${projectId}`);
            const data = await res.json();
            if (data.status === 'success') setProjectData(data.project);
        } catch (err) { }
    };

    return (
        <div className="rs-body">
            <header className="rs-navbar">
                <div className="rs-logo">
                    <Link to="/"><img src={logoImg} alt="logo" className="rs-logo-img" /></Link>
                </div>
                <div className="rs-nav-icons">
                    <button className="rs-btn-world"><iconify-icon icon="iconamoon:search-light"></iconify-icon></button>
                    <NotificationBell className="rs-btn-world" />
                    <NavProfileButton className="rs-btn-users" />
                </div>
            </header>

            <div className="rs-container">
                <ProjectSidebar activePage="create-pictures" projectId={projectId} />

                <main className="rs-main-content">
                    {/* ── Tab Bar ── */}
                    <div className="rs-tabs-wrapper">
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                className={`rs-tab${activeTab === tab.id ? ' rs-active' : ''}`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* ── Tab Content ── */}
                    <div className="rs-tab-page">
                        {activeTab === 'package' && <PackageCatalog />}

                        {activeTab === 'label' && (
                            <LabelEditor projectId={projectId} userId={userId} />
                        )}

                        {activeTab === 'mockup' && (
                            <MockupEditor
                                projectId={projectId}
                                userId={userId}
                                projectName={projectData.project_name}
                            />
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Result;