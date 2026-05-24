import React from 'react';
import styles from './TabBar.module.css';

export default function TabBar({ tabs, activeTab, onChange }) {
  return (
    <div className={styles.tabBar}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.icon && <tab.icon size={18} />}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
