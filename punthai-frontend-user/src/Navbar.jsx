import React from "react";
import { NavLink, useNavigate } from "react-router-dom"; 
import "./Navbar.css";
import logo from "./assets/logo.png"

const Navbar = ({ user, onOpenLogin, onLogout }) => {
    const navigate = useNavigate(); 

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
                <img src={logo} alt="logo" className="logo-img" />
            </div>

            <div className="menu">
                <NavLink to="/">HOME</NavLink>
                <NavLink to="/Shopping">FEATURES</NavLink>
                <NavLink to="/About">CONTACT</NavLink>
            </div>

            <div className="nav-right">
                {/* 1. ปุ่ม Login/Logout และ แสดงสถานะชื่อ */}
                {!user ? (
                    <button className="btn-outline" onClick={onOpenLogin}>Log in</button>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <span style={{ fontWeight: 'bold', color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            Hi, {user.user_name}
                            {/* 👇 ป้ายโชว์สถานะ PRO / STANDARD ใน Navbar 👇 */}
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
                        <button className="btn-outline" onClick={onLogout} style={{ fontSize: '12px', height: '35px', padding: '0 15px' }}>Logout</button>
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
                                src={`http://localhost:3000/uploads/${user.image_profile}`}
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

                {/* 👇 2. ปุ่มอัปเกรดระดับ Pro ให้อยู่ขวาสุด 👇 */}
                <button 
                    className="btn-primary" 
                    style={{ marginLeft: '10px', background: 'linear-gradient(45deg, #d3542b, #f09060)', border: 'none' }} 
                    onClick={() => alert('เตรียมพบกับหน้าระบบสมาชิกเร็วๆ นี้!')}
                >
                    รับสิทธิระดับ Pro
                </button>
            </div>
        </nav>
    );
};

export default Navbar;