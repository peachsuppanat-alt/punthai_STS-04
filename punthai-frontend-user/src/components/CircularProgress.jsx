import React from 'react';

const CircularProgress = ({ percentage = 0, size = 220, strokeWidth = 8, children }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;

    const getColor = (pct) => {
        if (pct >= 75) return '#4CAF50';
        if (pct >= 40) return '#FF9800';
        return '#d75a2a';
    };

    return (
        <div style={{ position: 'relative', width: size, height: size }}>
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="#f0f0f0"
                    strokeWidth={strokeWidth}
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={getColor(percentage)}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    style={{ transition: 'stroke-dashoffset 0.8s ease-in-out, stroke 0.5s ease' }}
                />
            </svg>
            <div style={{
                position: 'absolute',
                top: strokeWidth / 2,
                left: strokeWidth / 2,
                width: size - strokeWidth,
                height: size - strokeWidth,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
            }}>
                {children}
            </div>
        </div>
    );
};

export default CircularProgress;
