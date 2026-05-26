import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './ProductSidebar.css';
import sidebarBg from '../assets/bg_sidebar.png';

export const ProductSidebar = ({ projectId }) => {
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
    { key: 'project',         label: 'Projects',        icon: 'mdi:view-dashboard-outline',  path: '/project' },
    { key: 'brand-dna',       label: 'Brand DNA',       icon: 'mdi:palette-outline',         path: '/brand-dna' },
    { key: 'create-concept',  label: 'Create Concept',  icon: 'mdi:lightbulb-outline',       path: '/create-concept' },
    { key: 'create-logo',     label: 'Create Logo',     icon: 'mdi:image-edit-outline',      path: '/create-logo' },
    { key: 'create-pictures', label: 'Create Pictures', icon: 'mdi:image-multiple-outline',  path: '/result' },
  ];

  const bottomItems = [
    { key: 'product', label: 'Yours Product', icon: 'mdi:folder-outline', path: '/product' },
  ];

  return (
    <>
      <button
        className="psb2-toggle-btn"
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{ left: isCollapsed ? 'calc(80px - 17px)' : 'calc(240px - 17px)' }}
        title={isCollapsed ? 'ขยาย Sidebar' : 'ย่อ Sidebar'}
      >
        {isCollapsed ? '❯' : '❮'}
      </button>

      <aside className={`psb2-sidebar ${isCollapsed ? 'psb2-collapsed' : ''}`}>

        <ul className="psb2-menu">
          {menuItems.map((item) => (
            <li key={item.key} onClick={() => go(item.path)} title={isCollapsed ? item.label : ''}>
              <span className="psb2-icon">
                <iconify-icon icon={item.icon}></iconify-icon>
              </span>
              <span className="psb2-text">{item.label}</span>
            </li>
          ))}
        </ul>

        <hr className="psb2-hr" />

        <ul className="psb2-menu">
          {bottomItems.map((item) => (
            <li key={item.key} className="psb2-active" onClick={() => go(item.path)} title={isCollapsed ? item.label : ''}>
              <span className="psb2-icon">
                <iconify-icon icon={item.icon}></iconify-icon>
              </span>
              <span className="psb2-text">{item.label}</span>
            </li>
          ))}
        </ul>

        <div className="psb2-bg-illustration">
          <img src={sidebarBg} alt="" />
        </div>

      </aside>
    </>
  );
};

export default ProductSidebar;