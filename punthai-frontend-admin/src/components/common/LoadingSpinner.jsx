import React from 'react';

export default function LoadingSpinner({ size = 40, color = 'var(--color-primary)' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '48px' }}>
      <svg width={size} height={size} viewBox="0 0 40 40" style={{ animation: 'spin 0.8s linear infinite' }}>
        <circle cx="20" cy="20" r="16" fill="none" stroke={color} strokeWidth="3" strokeDasharray="80" strokeLinecap="round" opacity="0.3" />
        <circle cx="20" cy="20" r="16" fill="none" stroke={color} strokeWidth="3" strokeDasharray="80" strokeDashoffset="60" strokeLinecap="round" />
      </svg>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
