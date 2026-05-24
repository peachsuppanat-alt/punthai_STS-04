import React from 'react';
import styles from './StatCard.module.css';

const circumference = 2 * Math.PI * 22;

export default function StatCard({ icon: Icon, label, value, unit, trend, color = 'var(--color-primary)', percent }) {
  const bgColor = `${color}15`;

  return (
    <div className={styles.card}>
      <div className={styles.iconWrap} style={{ background: bgColor, color }}>
        {Icon && <Icon size={26} />}
      </div>
      <div className={styles.info}>
        <div className={styles.label}>{label}</div>
        <div className={styles.value}>
          {typeof value === 'number' ? value.toLocaleString() : value}
          {unit && <span className={styles.unit}>{unit}</span>}
        </div>
        {trend !== undefined && (
          <div className={`${styles.trend} ${trend >= 0 ? styles.trendUp : styles.trendDown}`}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
          </div>
        )}
      </div>
      {percent !== undefined && (
        <div className={styles.ring}>
          <svg className={styles.ringSvg} width="56" height="56" viewBox="0 0 56 56">
            <circle className={styles.ringBg} cx="28" cy="28" r="22" />
            <circle
              className={styles.ringFill}
              cx="28" cy="28" r="22"
              stroke={color}
              strokeDasharray={circumference}
              strokeDashoffset={circumference - (circumference * Math.min(percent, 100)) / 100}
            />
          </svg>
          <div className={styles.ringPercent} style={{ color }}>
            {Math.round(percent)}%
          </div>
        </div>
      )}
    </div>
  );
}
