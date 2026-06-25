import React, { useState } from 'react';
import PackageCatalog from './PackageCatalog';
import { CATEGORIES } from './PackageCatalog';
import { getStoredUser, isPrintshop } from '../utils/auth';
import './PackagePage.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const PACKAGE_TYPES = [
  { id: 'flat', label: 'แบน (Flat) — ถุง/ฉลากแบน' },
  { id: 'wrap', label: 'หุ้มรอบ (Wrap) — ขวด/กระป๋อง/หลอด' },
  { id: 'box',  label: 'กล่อง (Box) — คลี่กล่อง' },
];

// ── ฟอร์มเพิ่ม package ของโรงพิมพ์ (feature 3) ──
function AddPackageModal({ thirdPartyId, onClose, onSaved }) {
  const selectableCats = CATEGORIES.filter(c => c.id !== 'all');

  const [form, setForm] = useState({
    name: '', type: '', material_name: '', material_detail: '',
    package_type: 'flat', dieline_width_mm: '', dieline_height_mm: '',
  });
  const [cats, setCats]         = useState([]);
  const [sizeInput, setSizeInput] = useState('');
  const [sizes, setSizes]       = useState([]);
  const [thumbnail, setThumbnail] = useState(null);
  const [images, setImages]     = useState([]);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const setF = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const toggleCat = (id) => setCats(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  const addSize = () => {
    const v = sizeInput.trim();
    if (v && !sizes.includes(v)) setSizes(prev => [...prev, v]);
    setSizeInput('');
  };
  const removeSize = (s) => setSizes(prev => prev.filter(x => x !== s));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.type) return setError('กรุณากรอกชื่อและประเภท package');
    if (images.length === 0) return setError('กรุณาอัปโหลดรูป package อย่างน้อย 1 รูป');
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('thirdparty_id', thirdPartyId);
      fd.append('name', form.name);
      fd.append('type', form.type);
      fd.append('categories', JSON.stringify(cats));
      fd.append('material_name', form.material_name || form.name);
      fd.append('material_detail', form.material_detail);
      fd.append('package_type', form.package_type);
      fd.append('sizes', JSON.stringify(sizes));
      if (form.dieline_width_mm) fd.append('dieline_width_mm', form.dieline_width_mm);
      if (form.dieline_height_mm) fd.append('dieline_height_mm', form.dieline_height_mm);
      if (thumbnail) fd.append('thumbnail', thumbnail);
      images.forEach(img => fd.append('images', img));

      const res = await fetch(`${API_BASE}/api/packages`, { method: 'POST', body: fd });
      const data = await res.json();
      if (data.status === 'success') {
        onSaved();
        onClose();
      } else {
        setError(data.message || 'บันทึกไม่สำเร็จ');
      }
    } catch {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ppg-modal-backdrop" onClick={onClose}>
      <div className="ppg-modal" onClick={e => e.stopPropagation()}>
        <div className="ppg-modal-head">
          <h3>เพิ่ม Package ของโรงพิมพ์</h3>
          <button className="ppg-modal-close" onClick={onClose}><iconify-icon icon="mdi:close" /></button>
        </div>

        <form className="ppg-form" onSubmit={handleSubmit}>
          {error && <div className="ppg-error">{error}</div>}

          <label className="ppg-label">ชื่อ Package *</label>
          <input className="ppg-input" value={form.name} onChange={e => setF('name', e.target.value)} placeholder="เช่น Food Pouch" />

          <label className="ppg-label">ประเภท *</label>
          <input className="ppg-input" value={form.type} onChange={e => setF('type', e.target.value)} placeholder="เช่น ถุงอาหารซิปล็อค" />

          <label className="ppg-label">หมวดหมู่</label>
          <div className="ppg-cat-chips">
            {selectableCats.map(c => (
              <button type="button" key={c.id}
                className={`ppg-chip${cats.includes(c.id) ? ' ppg-chip-on' : ''}`}
                onClick={() => toggleCat(c.id)}>
                <iconify-icon icon={c.icon} /> {c.label}
              </button>
            ))}
          </div>

          <label className="ppg-label">ชื่อวัสดุ</label>
          <input className="ppg-input" value={form.material_name} onChange={e => setF('material_name', e.target.value)} placeholder="เช่น ฟิล์มอาหาร" />

          <label className="ppg-label">รายละเอียดวัสดุ</label>
          <textarea className="ppg-input ppg-textarea" value={form.material_detail} onChange={e => setF('material_detail', e.target.value)} placeholder="อธิบายคุณสมบัติของวัสดุ" />

          <label className="ppg-label">รูปแบบ (สำหรับ Label/Mockup)</label>
          <select className="ppg-input" value={form.package_type} onChange={e => setF('package_type', e.target.value)}>
            {PACKAGE_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>

          <div className="ppg-row2">
            <div>
              <label className="ppg-label">กว้าง (mm)</label>
              <input className="ppg-input" type="number" value={form.dieline_width_mm} onChange={e => setF('dieline_width_mm', e.target.value)} placeholder="เช่น 350" />
            </div>
            <div>
              <label className="ppg-label">สูง (mm)</label>
              <input className="ppg-input" type="number" value={form.dieline_height_mm} onChange={e => setF('dieline_height_mm', e.target.value)} placeholder="เช่น 230" />
            </div>
          </div>

          <label className="ppg-label">ขนาดที่มี</label>
          <div className="ppg-size-add">
            <input className="ppg-input" value={sizeInput}
              onChange={e => setSizeInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSize(); } }}
              placeholder="เช่น 50g แล้วกด Enter" />
            <button type="button" className="ppg-size-add-btn" onClick={addSize}>เพิ่ม</button>
          </div>
          {sizes.length > 0 && (
            <div className="ppg-size-tags">
              {sizes.map(s => (
                <span key={s} className="ppg-size-tag">{s}
                  <button type="button" onClick={() => removeSize(s)}><iconify-icon icon="mdi:close" /></button>
                </span>
              ))}
            </div>
          )}

          <label className="ppg-label">รูป Thumbnail (ไม่บังคับ — ถ้าไม่ใส่จะใช้รูปแรก)</label>
          <input className="ppg-file" type="file" accept="image/*" onChange={e => setThumbnail(e.target.files[0])} />

          <label className="ppg-label">รูป Package * (เลือกได้หลายรูป)</label>
          <input className="ppg-file" type="file" accept="image/*" multiple onChange={e => setImages(Array.from(e.target.files))} />
          {images.length > 0 && <span className="ppg-file-count">เลือกแล้ว {images.length} รูป</span>}

          <div className="ppg-actions">
            <button type="button" className="ppg-cancel" onClick={onClose}>ยกเลิก</button>
            <button type="submit" className="ppg-confirm" disabled={saving}>
              {saving ? 'กำลังบันทึก...' : 'บันทึก Package'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PackagePage() {
  const user = getStoredUser();
  const printshop = isPrintshop(user);
  const [showAdd, setShowAdd] = useState(false);
  const [refreshSignal, setRefreshSignal] = useState(0);

  return (
    <div className="ppg-page">
      <div className="ppg-page-head">
        <h1 className="ppg-page-title">Package ทั้งหมด</h1>
        <p className="ppg-page-sub">เลือกดูแพ็คเกจจิงทั้งหมดในแพลตฟอร์ม และเลือกนำไปใช้กับสินค้าในโปรเจกต์ของคุณ</p>
      </div>

      <PackageCatalog refreshSignal={refreshSignal} />

      {/* ปุ่ม + เฉพาะผู้ใช้ที่เป็นโรงพิมพ์ (feature 3) */}
      {printshop && (
        <button className="pkc-fab-add" title="เพิ่ม Package ของคุณ" onClick={() => setShowAdd(true)}>
          <iconify-icon icon="mdi:plus" />
        </button>
      )}

      {showAdd && (
        <AddPackageModal
          thirdPartyId={user.third_party_id}
          onClose={() => setShowAdd(false)}
          onSaved={() => setRefreshSignal(s => s + 1)}
        />
      )}
    </div>
  );
}
