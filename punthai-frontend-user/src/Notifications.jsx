// =====================================================================
// Notifications.jsx — หน้ารวมการแจ้งเตือนทั้งหมด (ล่าสุดลงไปด้านล่าง)
// =====================================================================
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_URL } from './config';
import logoImg from './assets/logo.png';
import { formatTimeAgo } from './components/NotificationBell';
import './Notifications.css';

function getUser() {
  try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
}

export default function Notifications() {
  const navigate = useNavigate();
  const user = getUser();
  const userId = user?.user_id;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/user/notifications/${userId}?limit=50`);
      const data = await res.json();
      if (data.status === 'success') setItems(data.data || []);
    } catch (e) { /* เงียบไว้ */ }
    setLoading(false);
  };

  useEffect(() => {
    if (!userId) { navigate('/'); return; }
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const markRead = async (id, isRead) => {
    if (isRead) return;
    setItems(prev => prev.map(n => (n.id === id ? { ...n, is_read: 1 } : n)));
    try { await fetch(`${API_URL}/api/user/notifications/${id}/read`, { method: 'PUT' }); } catch (e) {}
  };

  const markAll = async () => {
    setItems(prev => prev.map(n => ({ ...n, is_read: 1 })));
    try { await fetch(`${API_URL}/api/user/notifications/${userId}/read-all`, { method: 'PUT' }); } catch (e) {}
  };

  const unread = items.filter(n => !n.is_read).length;

  return (
    <div className="ntfpage-body">
      <header className="ntfpage-navbar">
        <Link to="/"><img src={logoImg} alt="logo" className="ntfpage-logo" /></Link>
        <button className="ntfpage-back" onClick={() => navigate(-1)}>
          <iconify-icon icon="mdi:arrow-left"></iconify-icon> ย้อนกลับ
        </button>
      </header>

      <main className="ntfpage-main">
        <div className="ntfpage-head">
          <div>
            <h1 className="ntfpage-title">การแจ้งเตือนทั้งหมด</h1>
            <p className="ntfpage-sub">{unread > 0 ? `มี ${unread} รายการที่ยังไม่ได้อ่าน` : 'อ่านครบทุกรายการแล้ว'}</p>
          </div>
          {unread > 0 && (
            <button className="ntfpage-markall" onClick={markAll}>
              <iconify-icon icon="mdi:check-all"></iconify-icon> ทำเครื่องหมายอ่านทั้งหมด
            </button>
          )}
        </div>

        {loading ? (
          <div className="ntfpage-empty"><iconify-icon icon="mdi:loading" className="ntfpage-spin"></iconify-icon> กำลังโหลด...</div>
        ) : items.length === 0 ? (
          <div className="ntfpage-empty">
            <iconify-icon icon="ph:bell-slash-light"></iconify-icon>
            <p>ยังไม่มีการแจ้งเตือน</p>
          </div>
        ) : (
          <div className="ntfpage-list">
            {items.map(n => (
              <button
                key={n.id}
                className={`ntfpage-item${!n.is_read ? ' ntfpage-unread' : ''}`}
                onClick={() => markRead(n.id, n.is_read)}
              >
                <span className="ntfpage-icon">
                  <iconify-icon icon="ph:bell-ringing-light"></iconify-icon>
                  {!n.is_read && <span className="ntfpage-dot"></span>}
                </span>
                <span className="ntfpage-item-body">
                  <span className="ntfpage-item-title">{n.title || n.message}</span>
                  {n.title && n.message && <span className="ntfpage-item-msg">{n.message}</span>}
                  <span className="ntfpage-item-time">{formatTimeAgo(n.created_at)}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
