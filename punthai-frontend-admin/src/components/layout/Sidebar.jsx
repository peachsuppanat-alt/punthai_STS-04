import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, BarChart3, Bell, Package, LogOut, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import styles from './Sidebar.module.css';

const navItems = [
  { to: '/', icon: Home, label: 'หน้าหลัก', end: true },
  { to: '/dashboards', icon: BarChart3, label: 'แดชบอร์ด' },
  { to: '/notifications', icon: Bell, label: 'แจ้งเตือน' },
  { to: '/packages', icon: Package, label: 'แพ็คเกจ' },
];

export default function Sidebar() {
  const { logout } = useAuth();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <div className={styles.brandIcon}>
          <LayoutDashboard size={22} />
        </div>
        <div>
          <div className={styles.brandName}>Punthai</div>
          <div className={styles.brandSub}>Admin Panel</div>
        </div>
      </div>

      <nav className={styles.nav}>
        <div className={styles.navLabel}>เมนูหลัก</div>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
            }
          >
            <item.icon size={20} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className={styles.footer}>
        <button className={styles.logoutBtn} onClick={logout}>
          <LogOut size={18} />
          ออกจากระบบ
        </button>
      </div>
    </aside>
  );
}
