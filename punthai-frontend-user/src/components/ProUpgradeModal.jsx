import React from 'react';
import { useNavigate } from 'react-router-dom';
import './ProUpgradeModal.css';

const ProUpgradeModal = ({ isOpen, onClose, feature = '' }) => {
    const navigate = useNavigate();

    if (!isOpen) return null;

    const featureMessages = {
        download: 'ดาวน์โหลดไฟล์รูปแบบนี้',
        generation: 'สร้างรูปภาพด้วย AI',
        default: 'ใช้งานฟีเจอร์นี้'
    };

    const message = featureMessages[feature] || featureMessages.default;

    return (
        <div className="pro-modal-overlay" onClick={onClose}>
            <div className="pro-modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="pro-modal-close" onClick={onClose}>
                    <iconify-icon icon="solar:close-circle-linear" width="24"></iconify-icon>
                </button>

                <div className="pro-modal-icon">
                    <iconify-icon icon="solar:lock-keyhole-linear" width="48"></iconify-icon>
                </div>

                <h2 className="pro-modal-title">สำหรับสมาชิก Pro เท่านั้น</h2>
                <p className="pro-modal-desc">
                    การ{message}ต้องอัปเกรดเป็นสมาชิก Pro
                </p>

                <div className="pro-modal-benefits">
                    <div className="pro-modal-benefit-item">
                        <iconify-icon icon="solar:gallery-check-linear" width="20"></iconify-icon>
                        <span>สร้างรูปภาพ AI ได้สูงสุด 50 รูป/เดือน</span>
                    </div>
                    <div className="pro-modal-benefit-item">
                        <iconify-icon icon="solar:download-minimalistic-linear" width="20"></iconify-icon>
                        <span>ดาวน์โหลดได้ทุกรูปแบบ (PNG, SVG, EPS, PDF, AI)</span>
                    </div>
                    <div className="pro-modal-benefit-item">
                        <iconify-icon icon="solar:star-linear" width="20"></iconify-icon>
                        <span>เข้าถึงฟีเจอร์ทั้งหมดแบบไม่จำกัด</span>
                    </div>
                </div>

                <button
                    className="pro-modal-upgrade-btn"
                    onClick={() => { onClose(); navigate('/subscription'); }}
                >
                    <iconify-icon icon="solar:crown-linear" width="20"></iconify-icon>
                    อัปเกรดเป็น Pro — 129 บาท/เดือน
                </button>

                <button className="pro-modal-cancel-btn" onClick={onClose}>
                    ไว้ภายหลัง
                </button>
            </div>
        </div>
    );
};

export default ProUpgradeModal;
