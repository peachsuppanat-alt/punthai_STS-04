import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchSubscriptionStatus } from './utils/subscriptionGuard';
import { API_URL, OMISE_PUBLIC_KEY } from './config';
import './Subscription.css';



const Subscription = ({ user, setUser }) => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [subStatus, setSubStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelLoading, setCancelLoading] = useState(false);

    useEffect(() => {
        if (user?.user_id) {
            fetchSubscriptionStatus(user.user_id).then(setSubStatus);
        }
    }, [user]);

    // Poll payment status when returning from redirect (3DS, internet banking)
    useEffect(() => {
        const paymentPending = searchParams.get('payment');
        const chargeId = searchParams.get('charge_id') || localStorage.getItem('pending_charge_id');
        if (paymentPending === 'pending' && chargeId && user?.user_id) {
            pollPaymentStatus(chargeId);
        }
    }, [searchParams, user]);

    // Setup OmiseCard
    useEffect(() => {
        if (typeof window.OmiseCard !== 'undefined') {
            window.OmiseCard.configure({
                publicKey: OMISE_PUBLIC_KEY,
                currency: 'THB',
                frameLabel: 'Punthai Pro',
                submitLabel: 'ชำระเงิน 129 บาท',
                buttonLabel: 'ชำระเงิน 129 บาท',
            });
        }
    }, []);

    const pollPaymentStatus = async (chargeId) => {
        setLoading(true);
        setError('');
        for (let i = 0; i < 20; i++) {
            try {
                const res = await fetch(`${API_URL}/api/subscription/check-payment/${chargeId}`);
                const data = await res.json();
                if (data.payment_status === 'successful') {
                    setUser(data.user);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    localStorage.removeItem('pending_charge_id');
                    setSuccess(true);
                    setLoading(false);
                    fetchSubscriptionStatus(user.user_id).then(setSubStatus);
                    return;
                }
                if (data.payment_status === 'failed') {
                    setError('การชำระเงินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
                    setLoading(false);
                    localStorage.removeItem('pending_charge_id');
                    return;
                }
            } catch { /* retry */ }
            await new Promise(r => setTimeout(r, 3000));
        }
        setLoading(false);
        setError('หมดเวลารอผลการชำระเงิน กรุณาตรวจสอบสถานะอีกครั้ง');
    };

    const sendTokenToBackend = async (nonce) => {
        setLoading(true);
        setError('');
        try {
            const isSource = nonce.startsWith('src_');
            const res = await fetch(`${API_URL}/api/subscription/create-charge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.user_id,
                    ...(isSource ? { source: nonce } : { token: nonce })
                })
            });
            const data = await res.json();

            if (data.status === 'success') {
                setUser(data.user);
                localStorage.setItem('user', JSON.stringify(data.user));
                setSuccess(true);
                fetchSubscriptionStatus(user.user_id).then(setSubStatus);
            } else if (data.status === 'redirect' && data.authorize_uri) {
                localStorage.setItem('pending_charge_id', data.charge_id);
                window.location.href = data.authorize_uri;
                return;
            } else {
                setError(data.message || 'การชำระเงินไม่สำเร็จ');
            }
        } catch {
            setError('เกิดข้อผิดพลาด กรุณาลองใหม่');
        }
        setLoading(false);
    };

    const handleCancelSubscription = async () => {
        setCancelLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/subscription/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.user_id }),
            });
            const data = await res.json();
            if (data.status === 'success') {
                const updatedUser = { ...user, subscription_status: 'STANDARD' };
                if (setUser) setUser(updatedUser);
                localStorage.setItem('user', JSON.stringify(updatedUser));
                setSubStatus(prev => ({ ...prev, subscription_status: 'STANDARD' }));
                setShowCancelModal(false);
                alert('ยกเลิกสมาชิก Pro สำเร็จ');
            } else {
                alert(data.message || 'เกิดข้อผิดพลาด');
            }
        } catch {
            alert('เชื่อมต่อ Server ไม่ได้');
        }
        setCancelLoading(false);
    };

    const handlePayment = () => {
        if (!user) { navigate('/'); return; }
        setError('');

        if (typeof window.OmiseCard === 'undefined') {
            setError('ไม่สามารถโหลด Omise Checkout ได้ กรุณารีเฟรชหน้าเว็บ');
            return;
        }

        window.OmiseCard.open({
            amount: 12900,
            onCreateTokenSuccess: (nonce) => {
                sendTokenToBackend(nonce);
            },
            onFormClosed: () => {
                // user closed popup without paying
            },
        });
    };

    if (success) {
        return (
            <div className="sub-page">
                <div className="sub-success-container">
                    <div className="sub-success-icon">
                        <iconify-icon icon="solar:check-circle-bold" width="64"></iconify-icon>
                    </div>
                    <h2>สมัครสมาชิก Pro สำเร็จ</h2>
                    <p>คุณสามารถใช้งานฟีเจอร์ทั้งหมดได้แล้ว</p>
                    <button className="sub-success-btn" onClick={() => navigate('/')}>
                        <iconify-icon icon="solar:home-2-linear" width="18"></iconify-icon>
                        กลับหน้าหลัก
                    </button>
                </div>
            </div>
        );
    }

    const isPro = user?.subscription_status === 'PRO' && subStatus?.subscription_status === 'PRO';

    return (
        <div className="sub-page">
            {/* Hero */}
            <section className="sub-hero">
                <div className="sub-hero-content">
                    <div className="sub-hero-badge">
                        <iconify-icon icon="solar:crown-linear" width="16"></iconify-icon>
                        Punthai Pro
                    </div>
                    <h1>อัปเกรดเป็น Punthai Pro</h1>
                    <p>ปลดล็อกทุกฟีเจอร์ สร้างสรรค์ได้ไม่จำกัด</p>
                </div>
            </section>

            {/* Pricing Cards */}
            <section className="sub-pricing">
                <div className="sub-pricing-cards">
                    {/* STANDARD */}
                    <div className="sub-card">
                        <div className="sub-card-header">
                            <span className="sub-card-badge sub-card-badge-std">STANDARD</span>
                            <div className="sub-card-price">
                                <span className="sub-price-amount">ฟรี</span>
                            </div>
                        </div>
                        <ul className="sub-card-features">
                            <li>
                                <iconify-icon icon="solar:check-circle-linear" width="18" className="feat-check"></iconify-icon>
                                สร้างรูปภาพ AI ได้ 6 ครั้งตลอดอายุ Account
                            </li>
                            <li>
                                <iconify-icon icon="solar:check-circle-linear" width="18" className="feat-check"></iconify-icon>
                                ดาวน์โหลดโลโก้ได้เฉพาะ JPG, PDF
                            </li>
                            <li>
                                <iconify-icon icon="solar:check-circle-linear" width="18" className="feat-check"></iconify-icon>
                                ดาวน์โหลดฉลากได้เฉพาะ Preview PNG
                            </li>
                            <li>
                                <iconify-icon icon="solar:check-circle-linear" width="18" className="feat-check"></iconify-icon>
                                ดาวน์โหลดบรรจุภัณฑ์ได้เฉพาะ PNG
                            </li>
                            <li className="feat-disabled">
                                <iconify-icon icon="solar:close-circle-linear" width="18"></iconify-icon>
                                ไม่สามารถดาวน์โหลด Print-Ready, SVG, EPS, AI
                            </li>
                        </ul>
                        {isPro ? (
                            <div className="sub-card-current">แผนปัจจุบันของคุณ</div>
                        ) : (
                            <div className="sub-card-current sub-card-current-active">แผนปัจจุบันของคุณ</div>
                        )}
                    </div>

                    {/* PRO */}
                    <div className="sub-card sub-card-pro">
                        <div className="sub-card-recommended">
                            <iconify-icon icon="solar:star-bold" width="14"></iconify-icon>
                            แนะนำ
                        </div>
                        <div className="sub-card-header">
                            <span className="sub-card-badge sub-card-badge-pro">PRO</span>
                            <div className="sub-card-price">
                                <span className="sub-price-amount">129</span>
                                <span className="sub-price-unit">บาท/เดือน</span>
                            </div>
                        </div>
                        <ul className="sub-card-features">
                            <li>
                                <iconify-icon icon="solar:check-circle-bold" width="18" className="feat-check-pro"></iconify-icon>
                                สร้างรูปภาพ AI ได้ 50 ครั้ง/เดือน
                            </li>
                            <li>
                                <iconify-icon icon="solar:check-circle-bold" width="18" className="feat-check-pro"></iconify-icon>
                                ดาวน์โหลดโลโก้ได้ทุกรูปแบบ (PNG, SVG, EPS, JPG, PDF)
                            </li>
                            <li>
                                <iconify-icon icon="solar:check-circle-bold" width="18" className="feat-check-pro"></iconify-icon>
                                ดาวน์โหลดฉลาก Print-Ready 300 DPI และ PDF
                            </li>
                            <li>
                                <iconify-icon icon="solar:check-circle-bold" width="18" className="feat-check-pro"></iconify-icon>
                                ดาวน์โหลดบรรจุภัณฑ์ได้ทุกรูปแบบ (PNG, PDF, AI)
                            </li>
                            <li>
                                <iconify-icon icon="solar:check-circle-bold" width="18" className="feat-check-pro"></iconify-icon>
                                เข้าถึงฟีเจอร์ทั้งหมดแบบไม่จำกัด
                            </li>
                        </ul>
                        {isPro ? (
                            <div className="sub-card-current sub-card-current-pro">
                                <iconify-icon icon="solar:verified-check-bold" width="18"></iconify-icon>
                                คุณเป็นสมาชิก Pro อยู่แล้ว
                                {subStatus?.subscription_end_date && (
                                    <span className="sub-expire-date">
                                        หมดอายุ: {new Date(subStatus.subscription_end_date).toLocaleDateString('th-TH')}
                                    </span>
                                )}
                            </div>
                        ) : (
                            <button className="sub-card-cta" onClick={handlePayment} disabled={loading}>
                                {loading ? (
                                    <><iconify-icon icon="solar:refresh-linear" width="18" className="spin"></iconify-icon> กำลังดำเนินการ...</>
                                ) : (
                                    <><iconify-icon icon="solar:crown-linear" width="18"></iconify-icon> สมัครเลย</>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* Usage info */}
                {subStatus && (
                    <div className="sub-usage-info">
                        <iconify-icon icon="solar:gallery-check-linear" width="20"></iconify-icon>
                        <span>
                            ใช้ไป {subStatus.generation_used}/{subStatus.generation_limit} ครั้ง
                            ({subStatus.generation_period === 'monthly' ? 'เดือนนี้' : 'ตลอดอายุ Account'})
                        </span>
                    </div>
                )}
            </section>

            {/* Error */}
            {error && (
                <section className="sub-pricing" style={{ paddingTop: 0 }}>
                    <div className="sub-error">
                        <iconify-icon icon="solar:danger-triangle-linear" width="18"></iconify-icon>
                        {error}
                    </div>
                </section>
            )}

            {/* Payment method info */}
            {!isPro && (
                <section className="sub-pricing" style={{ paddingTop: 0 }}>
                    <div className="sub-secure-note">
                        <iconify-icon icon="solar:shield-check-linear" width="16"></iconify-icon>
                        ชำระเงินอย่างปลอดภัยผ่าน Omise Payment Gateway
                        <span style={{ display: 'block', fontSize: 12, marginTop: 4, opacity: 0.7 }}>
                            รองรับบัตรเครดิต/เดบิต (Visa, Mastercard, JCB)
                        </span>
                    </div>
                </section>
            )}

            {/* Cancel Pro Section */}
            {isPro && (
                <section className="sub-cancel-section">
                    <div className="sub-cancel-card">
                        <div className="sub-cancel-icon">
                            <iconify-icon icon="solar:crown-bold-duotone" width="28" style={{ color: '#e53935' }}></iconify-icon>
                        </div>
                        <div className="sub-cancel-info">
                            <h3>ยกเลิกสมาชิก Pro</h3>
                            <p>ยกเลิกการสมัครสมาชิก Pro และกลับไปใช้แผน Standard</p>
                            <div className="sub-cancel-warning">
                                <iconify-icon icon="solar:info-circle-linear" width="16"></iconify-icon>
                                <span>หลังจากยกเลิก คุณจะยังใช้งาน Pro ได้จนถึงวันหมดอายุ</span>
                            </div>
                        </div>
                        <button className="sub-cancel-btn" onClick={() => setShowCancelModal(true)}>
                            <iconify-icon icon="solar:close-circle-linear" width="16"></iconify-icon>
                            ยกเลิกสมาชิก
                        </button>
                    </div>
                </section>
            )}

            {/* Cancel Modal */}
            {showCancelModal && (
                <div className="sub-modal-overlay" onClick={() => setShowCancelModal(false)}>
                    <div className="sub-modal" onClick={e => e.stopPropagation()}>
                        <div className="sub-modal-icon">
                            <iconify-icon icon="solar:danger-triangle-bold" width="48" style={{ color: '#e53935' }}></iconify-icon>
                        </div>
                        <h3 className="sub-modal-title">ยืนยันการยกเลิก Pro</h3>
                        <p className="sub-modal-desc">
                            คุณแน่ใจหรือไม่ว่าต้องการยกเลิกสมาชิก Pro?
                            คุณจะสูญเสียสิทธิ์ทั้งหมดหลังวันหมดอายุ
                        </p>
                        <div className="sub-modal-actions">
                            <button className="sub-modal-cancel" onClick={() => setShowCancelModal(false)}>
                                ยกเลิก
                            </button>
                            <button className="sub-modal-confirm" onClick={handleCancelSubscription} disabled={cancelLoading}>
                                {cancelLoading ? 'กำลังดำเนินการ...' : 'ยืนยันยกเลิก Pro'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {loading && (
                <div className="sub-loading-overlay">
                    <div className="sub-loading-content">
                        <iconify-icon icon="solar:refresh-linear" width="40" className="spin"></iconify-icon>
                        <p>กำลังตรวจสอบสถานะการชำระเงิน...</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Subscription;
