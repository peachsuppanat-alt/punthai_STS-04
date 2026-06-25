import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import './Profile.css';
import './PrintshopProfile.css';
import logoImg from './assets/logo.png';
import { PackageDetailModal, resolveImg } from './project_feature/PackageCatalog';
import { getStoredUser, isPrintshop } from './utils/auth';
import { API_URL } from './config';

const API_BASE = API_URL;

const CONTACT_FIELDS = [
  { key: 'phone',      label: 'เบอร์โทรศัพท์', icon: 'mdi:phone',          type: 'text' },
  { key: 'line_id',    label: 'LINE ID',       icon: 'mdi:chat',           type: 'text' },
  { key: 'facebook',   label: 'Facebook',      icon: 'mdi:facebook',       type: 'text' },
  { key: 'website',    label: 'เว็บไซต์',      icon: 'mdi:web',            type: 'text' },
  { key: 'open_hours', label: 'เวลาทำการ',     icon: 'mdi:clock-outline',  type: 'text' },
];

export default function PrintshopProfile() {
  const navigate = useNavigate();
  const { thirdPartyId } = useParams();
  const user = getStoredUser();
  const ownerId = user.third_party_id;
  const targetId = thirdPartyId || ownerId;
  const isOwner = isPrintshop(user) && String(ownerId) === String(targetId);

  const [shop, setShop]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [packages, setPackages] = useState([]);
  const [selectedPkg, setSelectedPkg] = useState(null);

  const [form, setForm]   = useState({ phone: '', line_id: '', facebook: '', website: '', open_hours: '', address: '', map_url: '', about: '' });
  const [avatarFile, setAvatarFile]       = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const onPickAvatar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  useEffect(() => {
    if (!targetId) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/api/third-party/${targetId}`).then(r => r.json()),
      fetch(`${API_BASE}/api/packages?thirdparty_id=${targetId}`).then(r => r.json()),
    ]).then(([shopRes, pkgRes]) => {
      if (shopRes.status === 'success') {
        const s = shopRes.third_party;
        setShop(s);
        setForm({
          phone: s.phone || '', line_id: s.line_id || '', facebook: s.facebook || '',
          website: s.website || '', open_hours: s.open_hours || '', address: s.address || '',
          map_url: s.map_url || '', about: s.about || '',
        });
      }
      if (pkgRes.status === 'success') setPackages((pkgRes.data || []).filter(p => p.materials?.length > 0));
    }).catch(console.error).finally(() => setLoading(false));
  }, [targetId]);

  const setF = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    setSavedMsg('');
    try {
      // ส่งเป็น FormData เพื่อรองรับการอัปโหลดรูปโปรไฟล์ (image_profile)
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v ?? ''));
      if (avatarFile) fd.append('image_profile', avatarFile);

      const res = await fetch(`${API_BASE}/api/third-party/${targetId}`, {
        method: 'PUT',
        body: fd,
      });
      const data = await res.json();
      if (data.status === 'success') {
        setShop(data.third_party);
        setAvatarFile(null);
        setAvatarPreview(null);
        // อัปเดตรูปใน localStorage user ด้วย (ให้ navbar/โพสต์แสดงรูปใหม่)
        try {
          const u = JSON.parse(localStorage.getItem('user') || '{}');
          if (u.third_party_id && String(u.third_party_id) === String(targetId)) {
            u.image_profile = data.third_party.image_profile;
            localStorage.setItem('user', JSON.stringify(u));
          }
        } catch {}
        setSavedMsg('บันทึกข้อมูลเรียบร้อยแล้ว');
        setTimeout(() => setSavedMsg(''), 2500);
      } else {
        setSavedMsg('บันทึกไม่สำเร็จ: ' + (data.message || ''));
      }
    } catch {
      setSavedMsg('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => { localStorage.removeItem('user'); navigate('/'); };

  if (!targetId) {
    return <div className="psp-standalone"><div className="psp-empty">ไม่พบข้อมูลโรงพิมพ์</div></div>;
  }

  // ── เนื้อหาโปรไฟล์ (ใช้ทั้งโหมดเจ้าของและ public) ──
  const profileContent = (
    <div className="psp-content">
      {loading ? (
        <div className="psp-empty"><iconify-icon icon="mdi:loading" style={{ animation: 'pkc-spin 1s linear infinite', fontSize: 32 }} /> กำลังโหลด...</div>
      ) : !shop ? (
        <div className="psp-empty">ไม่พบข้อมูลโรงพิมพ์นี้</div>
      ) : (
        <>
          {/* การ์ดโปรไฟล์ */}
          <div className="psp-profile-card">
            <div className="psp-avatar">
              {avatarPreview
                ? <img src={avatarPreview} alt="preview" />
                : shop.image_profile
                  ? <img src={resolveImg(shop.image_profile)} alt={shop.third_party_name} />
                  : <iconify-icon icon="solar:shop-2-linear" />
              }
              {isOwner && (
                <label className="psp-avatar-edit" title="เปลี่ยนรูปโปรไฟล์">
                  <iconify-icon icon="mdi:camera" />
                  <input type="file" accept="image/*" hidden onChange={onPickAvatar} />
                </label>
              )}
            </div>
            <div className="psp-profile-info">
              <div className="psp-name-row">
                <h2>{shop.third_party_name}</h2>
                <span className="psp-badge"><iconify-icon icon="mdi:printer" /> โรงพิมพ์</span>
              </div>
              <p className="psp-email"><iconify-icon icon="mdi:email-outline" /> {shop.email}</p>
              {isOwner && avatarPreview && (
                <p className="psp-avatar-hint"><iconify-icon icon="mdi:information-outline" /> เลือกรูปใหม่แล้ว — กด "บันทึกข้อมูล" ด้านล่างเพื่อยืนยัน</p>
              )}
              {shop.about && <p className="psp-about">{shop.about}</p>}
            </div>
          </div>

          {/* ที่ตั้ง + ช่องทางติดต่อ */}
          {isOwner ? (
            <div className="psp-section">
              <h3 className="psp-section-title"><iconify-icon icon="mdi:map-marker-outline" /> ที่ตั้ง & ช่องทางติดต่อ</h3>
              <p className="psp-section-hint">กรอกข้อมูลเพื่อให้ลูกค้าติดต่อและหาที่ตั้งโรงพิมพ์ของคุณได้</p>

              <label className="psp-label">เกี่ยวกับโรงพิมพ์</label>
              <textarea className="psp-input psp-textarea" value={form.about} onChange={e => setF('about', e.target.value)} placeholder="แนะนำโรงพิมพ์ บริการที่รับผลิต ฯลฯ" />

              <label className="psp-label">ที่อยู่</label>
              <textarea className="psp-input psp-textarea" value={form.address} onChange={e => setF('address', e.target.value)} placeholder="บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์" />

              <label className="psp-label">ลิงก์ Google Maps</label>
              <input className="psp-input" value={form.map_url} onChange={e => setF('map_url', e.target.value)} placeholder="https://maps.google.com/..." />

              <div className="psp-grid2">
                {CONTACT_FIELDS.map(f => (
                  <div key={f.key}>
                    <label className="psp-label"><iconify-icon icon={f.icon} /> {f.label}</label>
                    <input className="psp-input" value={form[f.key]} onChange={e => setF(f.key, e.target.value)} />
                  </div>
                ))}
              </div>

              <div className="psp-save-row">
                {savedMsg && <span className="psp-saved-msg">{savedMsg}</span>}
                <button className="psp-save-btn" onClick={handleSave} disabled={saving}>
                  {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                </button>
              </div>
            </div>
          ) : (
            <div className="psp-section">
              <h3 className="psp-section-title"><iconify-icon icon="mdi:map-marker-outline" /> ที่ตั้ง & ช่องทางติดต่อ</h3>
              <div className="psp-contact-view">
                {shop.address && <p><iconify-icon icon="mdi:home-map-marker" /> {shop.address}</p>}
                {shop.map_url && <p><iconify-icon icon="mdi:map" /> <a href={shop.map_url} target="_blank" rel="noreferrer">เปิดใน Google Maps</a></p>}
                {CONTACT_FIELDS.filter(f => shop[f.key]).map(f => (
                  <p key={f.key}><iconify-icon icon={f.icon} /> {shop[f.key]}</p>
                ))}
                {!shop.address && !shop.map_url && !CONTACT_FIELDS.some(f => shop[f.key]) && (
                  <p className="psp-muted">โรงพิมพ์ยังไม่ได้ระบุข้อมูลติดต่อ</p>
                )}
              </div>
            </div>
          )}

          {/* Package ที่โพสต์ */}
          <div className="psp-section">
            <h3 className="psp-section-title"><iconify-icon icon="mdi:package-variant-closed" /> Package ที่โพสต์ ({packages.length})</h3>
            {packages.length === 0 ? (
              <p className="psp-muted">ยังไม่มี package ที่โพสต์</p>
            ) : (
              <div className="psp-pkg-grid">
                {packages.map(pkg => (
                  <div key={pkg.id} className="psp-pkg-card" onClick={() => setSelectedPkg(pkg)}>
                    <div className="psp-pkg-img">
                      <img src={resolveImg(pkg.thumbnail || pkg.materials[0]?.images?.[0])} alt={pkg.name} />
                    </div>
                    <div className="psp-pkg-body">
                      <p className="psp-pkg-type">{pkg.type}</p>
                      <h4 className="psp-pkg-name">{pkg.name}</h4>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {selectedPkg && (
        <PackageDetailModal
          pkg={selectedPkg}
          liked={false}
          onToggleLike={() => {}}
          onClose={() => setSelectedPkg(null)}
        />
      )}
    </div>
  );

  // ── โหมดเจ้าของ: ใช้ layout แบบ Profile (มี sidebar My Package) ──
  if (isOwner) {
    return (
      <>
        <header className="pf-navbar">
          <div className="pf-logo">
            <Link to="/"><img src={logoImg} alt="logo" className="pf-logo-img" /></Link>
          </div>
          <div className="pf-nav-icons">
            <button className="pf-btn-world"><iconify-icon icon="iconamoon:search-light"></iconify-icon></button>
          </div>
        </header>

        <div className="pf-container">
          <aside className="pf-sidebar">
            <ul className="pf-menu">
              <li onClick={() => navigate('/profile')} style={{ cursor: 'pointer' }}>
                <span className="pf-icon"><iconify-icon icon="solar:user-linear"></iconify-icon></span>
                <span className="pf-text">Profile</span>
              </li>
              <li className="pf-active">
                <span className="pf-icon"><iconify-icon icon="mdi:package-variant-closed"></iconify-icon></span>
                <span className="pf-text">My Package</span>
              </li>
              <li onClick={() => navigate('/settings')} style={{ cursor: 'pointer' }}>
                <span className="pf-icon"><iconify-icon icon="mdi:cog-outline"></iconify-icon></span>
                <span className="pf-text">Settings</span>
              </li>
            </ul>
            <div className="pf-sidebar-logout">
              <button className="pf-btn-logout" onClick={handleLogout}>
                <iconify-icon icon="solar:logout-2-linear"></iconify-icon>
                <span className="pf-text">ออกจากระบบ</span>
              </button>
            </div>
          </aside>

          <main className="pf-main">{profileContent}</main>
        </div>
      </>
    );
  }

  // ── โหมด public (visitor): main Navbar ของ App แสดงอยู่แล้ว ──
  return <div className="psp-standalone">{profileContent}</div>;
}
