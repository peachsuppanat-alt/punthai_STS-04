import React from "react";
import { NavLink } from "react-router-dom";
import "./Navbar.css";
import logo from "./assets/logo.png"

// รับ Props: user (ข้อมูลคน Login), onOpenLogin (คำสั่งเปิด popup), onLogout (คำสั่ง logout)
const Navbar = ({ user, onOpenLogin, onLogout }) => {
    return (
        <nav className="navbar">
            <div className="logo">
                <img src={logo} alt="logo" className="logo-img" />
            </div>

            <div className="menu">
                <NavLink to="/">HOME</NavLink>
                <NavLink to="/Shopping">FEATURES</NavLink>
                <NavLink to="/About">CONTACT</NavLink>
            </div>

            <div className="nav-right">
                {/* 1. ปุ่ม Login/Logout */}
                {!user ? (
                    <button className="btn-outline" onClick={onOpenLogin}>Log in</button>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontWeight: 'bold', color: '#333' }}>Hi, {user.user_name}</span>
                        <button className="btn-outline" onClick={onLogout} style={{ fontSize: '12px', height: '35px', padding: '0 15px' }}>Logout</button>
                    </div>
                )}

                <button className="btn-primary">Get Started</button>

                <div className="nav-icons">
                    {/* 2. ปุ่มไอคอน User */}
                    <button className="btn-users" onClick={!user ? onOpenLogin : null} style={{ overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        
                        {/* 🚨 เพิ่มการเช็คให้ชัวร์ว่าไม่ใช่ค่าว่างหรือคำว่า 'null' */}
                        {user && user.image_profile && user.image_profile !== 'null' ? (
                            <img
                                src={`http://localhost:3000/uploads/${user.image_profile}`}
                                alt="User"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                // 🚨 ดัก Error: ถ้าดึงรูปจากหลังบ้านไม่สำเร็จ ให้แสดงรูปลายเส้นคนว่างๆ แทนเพื่อไม่ให้หน้าเว็บพัง
                                onError={(e) => {
                                    e.target.onerror = null; 
                                    e.target.src = "https://cdn-icons-png.flaticon.com/512/149/149071.png"; 
                                }}
                            />
                        ) : (
                            <iconify-icon icon="solar:user-linear"></iconify-icon>
                        )}
                    </button>
                </div>

                <button className="btn-world">
                    <iconify-icon icon="material-symbols-light:language"></iconify-icon>
                </button>
            </div>
        {/* 🚨 เอา </div> ที่เกินมาออกให้แล้วครับ */}
        </nav>
    );
};

export default Navbar;