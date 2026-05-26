import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './sidebar.css';
import sidebarBg from '../assets/bg_sidebar.png';

/**
 * ProjectSidebar — Sidebar ใช้ร่วมกันทุกหน้าใน project_feature
 *
 * Props:
 *   activePage  : 'project' | 'brand-dna' | 'create-concept' | 'create-logo' | 'create-pictures' | 'product' | 'profile' | 'settings'
 *   projectId   : number | string  — ส่งต่อให้ทุก navigate
 *   onLogout    : function          — (optional) callback logout สำหรับหน้า Profile
 */
export const ProjectSidebar = ({ activePage, projectId, onLogout }) => {
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const go = (path) => {
    if (projectId) {
      navigate(path, { state: { projectId } });
    } else {
      navigate(path);
    }
  };

  const menuItems = [
    {
      key: 'project',
      label: 'Projects',
      icon: 'mdi:view-dashboard-outline',
      path: '/project',
    },
    {
      key: 'brand-dna',
      label: 'Brand DNA',
      icon: 'mdi:palette-outline',
      path: '/brand-dna',
    },
    {
      key: 'create-concept',
      label: 'Create Concept',
      icon: 'mdi:lightbulb-outline',
      path: '/create-concept',
    },
    {
      key: 'create-logo',
      label: 'Create Logo',
      icon: 'mdi:image-edit-outline',
      path: '/create-logo',
    },
    {
      key: 'create-pictures',
      label: 'Create Pictures',
      icon: 'mdi:image-multiple-outline',
      path: '/result',
    },
  ];

  const bottomItems = [
    {
      key: 'product',
      label: 'Yours Product',
      icon: 'mdi:folder-outline',
      path: '/product',
    },
  ];

  return (
    <>
      {/* ปุ่มยืดหด — วางนอก aside เพื่อ position fixed ตาม Profile */}
      <button
        className="psb-toggle-btn"
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{ left: isCollapsed ? 'calc(80px - 17px)' : 'calc(240px - 17px)' }}
        title={isCollapsed ? 'ขยาย Sidebar' : 'ย่อ Sidebar'}
      >
        {isCollapsed ? '❯' : '❮'}
      </button>

      <aside className={`psb-sidebar ${isCollapsed ? 'psb-collapsed' : ''}`}>

        {/* ── เมนูหลัก ── */}
        <ul className="psb-menu">
          {menuItems.map((item) => (
            <li
              key={item.key}
              className={activePage === item.key ? 'psb-active' : ''}
              onClick={() => go(item.path)}
              title={isCollapsed ? item.label : ''}
            >
              <span className="psb-icon">
                <iconify-icon icon={item.icon}></iconify-icon>
              </span>
              <span className="psb-text">{item.label}</span>
            </li>
          ))}
        </ul>

        <hr className="psb-hr" />

        {/* ── เมนูล่าง ── */}
        <ul className="psb-menu">
          {bottomItems.map((item) => (
            <li
              key={item.key}
              className={activePage === item.key ? 'psb-active' : ''}
              onClick={() => go(item.path)}
              title={isCollapsed ? item.label : ''}
            >
              <span className="psb-icon">
                <iconify-icon icon={item.icon}></iconify-icon>
              </span>
              <span className="psb-text">{item.label}</span>
            </li>
          ))}
        </ul>


        {/* ── ภาพพื้นหลังด้านล่าง Sidebar ── */}
        <div className="psb-bg-illustration">
          <img src={sidebarBg} alt="" />
        </div>

      </aside>
    </>
  );
};

export default ProjectSidebar;