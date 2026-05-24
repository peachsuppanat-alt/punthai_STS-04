import React from 'react';
import styles from './ChartCard.module.css';

const defaultOptions = [
  { label: 'วันนี้', value: 1 },
  { label: '7 วัน', value: 7 },
  { label: '30 วัน', value: 30 },
  { label: '90 วัน', value: 90 },
];

export default function ChartCard({ title, children, timeRange, onTimeRangeChange, options = defaultOptions, extra }) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {extra}
          {onTimeRangeChange && (
            <select
              className={styles.select}
              value={timeRange}
              onChange={(e) => onTimeRangeChange(Number(e.target.value))}
            >
              {options.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          )}
        </div>
      </div>
      <div className={styles.body}>{children}</div>
    </div>
  );
}
