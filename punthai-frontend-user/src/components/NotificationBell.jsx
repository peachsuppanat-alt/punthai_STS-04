// =====================================================================
// NotificationBell.jsx — ปุ่มกระดิ่งแจ้งเตือน (ใช้ซ้ำได้ทุกหน้า)
// - ดึงการแจ้งเตือนของผู้ใช้ปัจจุบัน (จาก localStorage)
// - แสดง dropdown เล็กๆ 5 อันล่าสุด (ไม่ใช่ popup เต็มจอ) จากมุมที่กดปุ่ม
// - มีลิงก์ "ดูการแจ้งเตือนทั้งหมด ->" ไปหน้ารวมการแจ้งเตือน
// โหมด: inline (บน navbar) และ floating (ปุ่มลอยมุมล่างขวา เช่นหน้า Home)
// =====================================================================
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';
import './NotificationBell.css';

function getUser() {
  try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
}

export function formatTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'เมื่อสักครู่';
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  const days = Math.floor(hours / 24);
  return `${days} วันที่แล้ว`;
}

export default function NotificationBell({ className = '', floating = false }) {
  const navigate = useNavigate();
  const user = getUser();
  const userId = user?.user_id;

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef(null);

  const fetchNotifs = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/user/notifications/${userId}?limit=5`);
      const data = await res.json();
      if (data.status === 'success') {
        setItems(data.data || []);
        setUnread(data.unreadCount || 0);
      }
    } catch (e) { /* เงียบไว้ ไม่รบกวนผู้ใช้ */ }
    setLoading(false);
  }, [userId]);

  // โหลดตอน mount + refresh เบาๆ ทุก 60 วินาที (อัปเดตจำนวน unread)
  useEffect(() => {
    if (!userId) return;
    fetchNotifs();
    const t = setInterval(fetchNotifs, 60000);
    return () => clearInterval(t);
  }, [userId, fetchNotifs]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) fetchNotifs();
  };

  // ปิดเมื่อคลิกนอกกล่อง
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const markRead = async (id) => {
    setItems(prev => prev.map(n => (n.id === id ? { ...n, is_read: 1 } : n)));
    setUnread(u => Math.max(0, u - 1));
    try { await fetch(`${API_URL}/api/user/notifications/${id}/read`, { method: 'PUT' }); } catch (e) {}
  };

  const markAll = async () => {
    setItems(prev => prev.map(n => ({ ...n, is_read: 1 })));
    setUnread(0);
    try { await fetch(`${API_URL}/api/user/notifications/${userId}/read-all`, { method: 'PUT' }); } catch (e) {}
  };

  const goAll = () => { setOpen(false); navigate('/notifications'); };

  const dropdown = (
    <div className={`ntf-dropdown${floating ? ' ntf-dropdown-up' : ''}`}>
      <div className="ntf-head">
        <span className="ntf-head-title">การแจ้งเตือน</span>
        {unread > 0 && <button className="ntf-markall" onClick={markAll}>อ่านทั้งหมด</button>}
      </div>

      <div className="ntf-list">
        {loading && items.length === 0 ? (
          <div className="ntf-empty">กำลังโหลด...</div>
        ) : items.length === 0 ? (
          <div className="ntf-empty">
            <iconify-icon icon="ph:bell-slash-light"></iconify-icon>
            <span>ไม่มีการแจ้งเตือน</span>
          </div>
        ) : (
          items.map((n) => (
            <button
              key={n.id}
              className={`ntf-item${!n.is_read ? ' ntf-unread' : ''}`}
              onClick={() => { if (!n.is_read) markRead(n.id); }}
            >
              <span className="ntf-dot-wrap">{!n.is_read && <span className="ntf-dot"></span>}</span>
              <span className="ntf-item-body">
                <span className="ntf-item-title">{n.title || n.message}</span>
                {n.title && n.message && <span className="ntf-item-msg">{n.message}</span>}
                <span className="ntf-item-time">{formatTimeAgo(n.created_at)}</span>
              </span>
            </button>
          ))
        )}
      </div>

      <button className="ntf-viewall" onClick={goAll}>
        ดูการแจ้งเตือนทั้งหมด <iconify-icon icon="mdi:arrow-right"></iconify-icon>
      </button>
    </div>
  );

  // ===== โหมดปุ่มลอย (มุมล่างขวา) =====
  if (floating) {
    return (
      <div className="ntf-floating-wrap" ref={wrapRef}>
        {open && dropdown}
        <button className="ntf-floating-btn" onClick={toggle} aria-label="การแจ้งเตือน">
          <iconify-icon icon="ph:bell-ringing-light"></iconify-icon>
          {unread > 0 && <span className="ntf-badge">{unread > 9 ? '9+' : unread}</span>}
        </button>
      </div>
    );
  }

  // ===== โหมด inline (บน navbar) — ใช้คลาสปุ่มของแต่ละหน้าเพื่อคงสไตล์เดิม =====
  return (
    <div className="ntf-wrap" ref={wrapRef}>
      <button className={className} onClick={toggle} aria-label="การแจ้งเตือน" style={{ position: 'relative' }}>
        <iconify-icon icon="ph:bell-ringing-light"></iconify-icon>
        {unread > 0 && <span className="ntf-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && dropdown}
    </div>
  );
}
