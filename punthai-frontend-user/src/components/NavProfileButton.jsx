// =====================================================================
// NavProfileButton.jsx — ปุ่มโปรไฟล์บน navbar (ใช้ซ้ำได้ทุกหน้า)
// แสดงรูปโปรไฟล์ของผู้ใช้ (ถ้ามี) และคลิกเพื่อไปหน้าโปรไฟล์
// อ่านข้อมูลผู้ใช้จาก localStorage เหมือนที่หน้า MyProject ทำไว้
// =====================================================================
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';

export default function NavProfileButton({ className = '' }) {
  const navigate = useNavigate();

  let user = null;
  try { user = JSON.parse(localStorage.getItem('user') || 'null'); } catch { user = null; }
  const img = user && user.image_profile && user.image_profile !== 'null' ? user.image_profile : null;

  return (
    <button
      className={className}
      onClick={() => navigate('/profile')}
      style={{ overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', padding: 0 }}
    >
      {img ? (
        <img
          src={img.startsWith('http') ? img : `${API_URL}/uploads/${img}`}
          alt="User"
          style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
          onError={(e) => { e.target.onerror = null; e.target.src = 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; }}
        />
      ) : (
        <iconify-icon icon="solar:user-linear" style={{ pointerEvents: 'none' }}></iconify-icon>
      )}
    </button>
  );
}
