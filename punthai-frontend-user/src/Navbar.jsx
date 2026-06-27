import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import "./Navbar.css";
import logo from "./assets/logo.png"
import { API_URL } from './config';

const Navbar = ({ user, onOpenLogin, onLogout }) => {
    const navigate = useNavigate();
    0
    const handleProfileClick = () => {
        if (user) {
            navigate('/profile');
        } else {
            if (onOpenLogin) onOpenLogin();
        }
    };

    return (
        <nav className="navbar">
            <div className="logo" >
                <NavLink to="/">
                    <img src={logo} alt="logo" className="logo-img" />
                </NavLink>

                
            </div>

            <div className="menu">
                <NavLink to="/">HOME</NavLink>
                <NavLink to="/market-planning">Market</NavLink>
                <NavLink to="/package">Package</NavLink>
                <NavLink to="/content-online">Content Online</NavLink>
                <NavLink to="/about">About Us</NavLink>
            </div>

            <div className="nav-right">
                {/* 1. ปุ่ม Login/Logout และ แสดงสถานะชื่อ */}
                {!user ? (
                    <button className="btn-outline" onClick={onOpenLogin}>Log in</button>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <span style={{ fontWeight: 'bold', color: '#d35325', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            Hi, {user.user_name}
                            {/*  PRO / STANDARD  */}
                            <span style={{
                                background: user.subscription_status === 'PRO' ? 'linear-gradient(45deg, #FFD700, #FFA500)' : '#ffe6de',
                                color: user.subscription_status === 'PRO' ? '#000' : '#d75a2a',
                                fontSize: '11px', padding: '3px 8px', borderRadius: '10px',
                                border: user.subscription_status === 'PRO' ? 'none' : '1px solid #f4c4aa',
                                fontWeight: 'bold'
                            }}>
                                {user.subscription_status || 'STANDARD'}
                            </span>
                        </span>
                        
                    </div>
                )}

                <div className="nav-icons">
                    <button
                        className="btn-users"
                        onClick={handleProfileClick}
                        style={{ overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', padding: 0 }}
                    >
                        {user && user.image_profile && user.image_profile !== 'null' ? (
                            <img
                                // 🟢 เช็คว่าถ้าเป็นลิงก์ http (จาก Google) ให้ใช้เลย ถ้าไม่ใช่ให้ดึงจากโฟลเดอร์ uploads
                                src={user.image_profile.startsWith('http') ? user.image_profile : `${API_URL}/uploads/${user.image_profile}`}
                                alt="User"
                                style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
                                onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
                                }}
                            />
                        ) : (
                            <iconify-icon icon="solar:user-linear" style={{ pointerEvents: 'none' }}></iconify-icon>
                        )}
                    </button>
                </div>

                <button className="btn-world">
                    <iconify-icon icon="material-symbols-light:language"></iconify-icon>
                </button>


                {(!user || user.subscription_status !== 'PRO') && (
                    <button
                        className="btn-primary"
                        style={{ marginLeft: '10px', background: 'linear-gradient(45deg, #d3542b, #f09060)', border: 'none' }}
                        onClick={() => {
                            if (!user) { onOpenLogin(); return; }
                            navigate('/subscription');
                        }}
                    >
                        รับสิทธิระดับ Pro
                    </button>
                )}
            </div>
        </nav>
    );
};

export default Navbar;