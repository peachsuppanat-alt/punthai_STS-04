import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import styles from './Header.module.css';

const pageTitles = {
  '/': 'หน้าหลัก',
  '/dashboards': 'แดชบอร์ด',
  '/notifications': 'แจ้งเตือน',
  '/packages': 'จัดการแพ็คเกจ',
  '/packages/new': 'สร้างแพ็คเกจใหม่',
};

export default function Header() {
  const { admin } = useAuth();
  const location = useLocation();

  const path = location.pathname;
  const title = pageTitles[path] || (path.includes('/packages/') && path.includes('/edit') ? 'แก้ไขแพ็คเกจ' : 'Punthai Admin');
  const initial = admin?.name_admin?.charAt(0)?.toUpperCase() || 'A';

  return (
    <header className={styles.header}>
      <div className={styles.titleSection}>
        <h1 className={styles.pageTitle}>{title}</h1>
        <span className={styles.breadcrumb}>Admin / {title}</span>
      </div>
      <div className={styles.right}>
        <div className={styles.adminInfo}>
          <div className={styles.avatar}>{initial}</div>
          <span className={styles.adminName}>{admin?.name_admin || 'Admin'}</span>
        </div>
      </div>
    </header>
  );
}
