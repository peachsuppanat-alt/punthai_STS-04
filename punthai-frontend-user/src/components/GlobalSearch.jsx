// =====================================================================
// GlobalSearch.jsx — แถบค้นหาเมนู/ฟีเจอร์/การตั้งค่าทั้งเว็บ (สไตล์ Google)
// กด icon ค้นหา → แถบ input โผล่ (ไม่มีฉากมืด/ไม่ใช่ popup กลางจอ)
// พิมพ์แล้วจึงแสดงรายการคีย์เวิร์ดที่ใกล้เคียงหล่นลงมาด้านล่าง
// ยังไม่พิมพ์ = ไม่แสดงรายการ | พิมพ์แล้วไม่ตรง = "ไม่พบสิ่งที่คุณค้นหา"
// เปิดได้ 3 ทาง: (1) คลิก icon ค้นหาจุดไหนก็ได้ (event delegation)
//                (2) window event 'punthai:open-search'  (3) Ctrl/Cmd + K
// =====================================================================
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import './GlobalSearch.css';

// path ของเครื่องมือที่ต้องอยู่ในโปรเจกต์ (ต้องเลือกโปรเจกต์ก่อน) → พาไปหน้าเลือกโปรเจกต์
const PROJECT_HUB = '/your-projects';

const SEARCH_INDEX = [
  // ── เมนูหลัก ──────────────────────────────────────────────
  { name: 'Home', path: '/', icon: 'mdi:home-outline', group: 'เมนูหลัก',
    hint: 'หน้าแรกของเว็บไซต์', keywords: ['หน้าแรก', 'หน้าหลัก', 'home', 'เริ่มต้น', 'กลับหน้าหลัก'] },
  { name: 'Market Planning', path: '/market-planning', icon: 'mdi:chart-line', group: 'เมนูหลัก',
    hint: 'วางแผนและกลยุทธ์การตลาด', keywords: ['การตลาด', 'วางแผนการตลาด', 'แผนการตลาด', 'กลยุทธ์', 'การขาย', 'market', 'มาร์เก็ตติ้ง'] },
  { name: 'Package', path: '/package', icon: 'mdi:package-variant-closed', group: 'เมนูหลัก',
    hint: 'เลือกบรรจุภัณฑ์', keywords: ['บรรจุภัณฑ์', 'แพ็คเกจ', 'แพ็กเกจ', 'กล่อง', 'ถุง', 'หีบห่อ', 'package', 'แพคเกจจิ้ง'] },
  { name: 'Content Online', path: '/content-online', icon: 'mdi:post-outline', group: 'เมนูหลัก',
    hint: 'สร้างคอนเทนต์ออนไลน์', keywords: ['คอนเทนต์', 'เนื้อหา', 'โพสต์', 'โซเชียล', 'ออนไลน์', 'สื่อ', 'content', 'โซเชียลมีเดีย'] },
  { name: 'About Us', path: '/about', icon: 'mdi:information-outline', group: 'เมนูหลัก',
    hint: 'เกี่ยวกับเรา', keywords: ['เกี่ยวกับเรา', 'เกี่ยวกับ', 'ทีมงาน', 'บริษัท', 'about', 'ติดต่อ'] },

  // ── บัญชีของฉัน ───────────────────────────────────────────
  { name: 'My Projects', path: PROJECT_HUB, icon: 'mdi:folder-multiple-outline', group: 'บัญชีของฉัน',
    hint: 'โปรเจกต์ทั้งหมดของคุณ', keywords: ['โปรเจกต์', 'โปรเจค', 'โปรเจ็กต์', 'งานของฉัน', 'ผลงาน', 'projects', 'โปรเจกต์ของฉัน'] },
  { name: 'Profile', path: '/profile', icon: 'solar:user-linear', group: 'บัญชีของฉัน',
    hint: 'ข้อมูลบัญชีผู้ใช้', keywords: ['โปรไฟล์', 'บัญชี', 'ข้อมูลส่วนตัว', 'profile', 'ผู้ใช้', 'บัญชีของฉัน'] },
  { name: 'Edit Profile', path: '/edit_profile', icon: 'mdi:account-edit-outline', group: 'บัญชีของฉัน',
    hint: 'แก้ไขข้อมูลส่วนตัว', keywords: ['แก้ไขโปรไฟล์', 'แก้ไขข้อมูล', 'เปลี่ยนข้อมูลส่วนตัว', 'edit profile', 'แก้โปรไฟล์'] },
  { name: 'Subscription', path: '/subscription', icon: 'mdi:crown-outline', group: 'บัญชีของฉัน',
    hint: 'อัปเกรดเป็นสมาชิก Pro', keywords: ['สมาชิก', 'สมัครสมาชิก', 'อัปเกรด', 'แพ็กเกจ', 'ต่ออายุ', 'pro', 'พรีเมียม', 'subscription', 'จ่ายเงิน'] },
  { name: 'Settings', path: '/settings', icon: 'mdi:cog-outline', group: 'บัญชีของฉัน',
    hint: 'ตั้งค่าและปรับแต่ง', keywords: ['ตั้งค่า', 'การตั้งค่า', 'ปรับแต่ง', 'ธีม', 'โหมดมืด', 'settings', 'ภาษา', 'ตั้งค่าบัญชี'] },
  { name: 'My Package', path: '/my-package', icon: 'mdi:printer-outline', group: 'บัญชีของฉัน',
    hint: 'สำหรับบัญชีโรงพิมพ์', keywords: ['โรงพิมพ์', 'งานพิมพ์', 'my package', 'printshop', 'พิมพ์งาน'] },

  // ── เครื่องมือออกแบบ (เลือกโปรเจกต์ก่อน) ───────────────────
  { name: 'Brand DNA', path: PROJECT_HUB, icon: 'mdi:dna', group: 'เครื่องมือออกแบบ',
    hint: 'กำหนดตัวตนแบรนด์ (เลือกโปรเจกต์ก่อน)', keywords: ['แบรนด์', 'ดีเอ็นเอ', 'อัตลักษณ์แบรนด์', 'ตัวตนแบรนด์', 'brand dna', 'สร้างแบรนด์', 'แบรนด์ดีเอ็นเอ'] },
  { name: 'Create Concept', path: PROJECT_HUB, icon: 'mdi:lightbulb-outline', group: 'เครื่องมือออกแบบ',
    hint: 'สร้างคอนเซ็ปต์แบรนด์ (เลือกโปรเจกต์ก่อน)', keywords: ['คอนเซ็ปต์', 'สร้างคอนเซ็ปต์', 'ไอเดีย', 'แนวคิด', 'concept', 'คอนเซป'] },
  { name: 'Create Logo', path: PROJECT_HUB, icon: 'mdi:shape-outline', group: 'เครื่องมือออกแบบ',
    hint: 'ออกแบบโลโก้ (เลือกโปรเจกต์ก่อน)', keywords: ['โลโก้', 'สร้างโลโก้', 'ตราสินค้า', 'logo', 'ออกแบบโลโก้', 'โลโก้แบรนด์'] },
  { name: 'Product', path: PROJECT_HUB, icon: 'mdi:cube-outline', group: 'เครื่องมือออกแบบ',
    hint: 'จัดการสินค้า (เลือกโปรเจกต์ก่อน)', keywords: ['สินค้า', 'ผลิตภัณฑ์', 'รายการสินค้า', 'เพิ่มสินค้า', 'product', 'ข้อมูลสินค้า'] },
  { name: 'Label', path: PROJECT_HUB, icon: 'mdi:label-outline', group: 'เครื่องมือออกแบบ',
    hint: 'ออกแบบฉลากสินค้า (เลือกโปรเจกต์ก่อน)', keywords: ['ฉลาก', 'สติกเกอร์', 'label', 'ฉลากสินค้า', 'ออกแบบฉลาก', 'ป้ายสินค้า'] },
  { name: 'Mockup', path: PROJECT_HUB, icon: 'mdi:cube-scan', group: 'เครื่องมือออกแบบ',
    hint: 'ออกแบบบรรจุภัณฑ์ / Mockup (เลือกโปรเจกต์ก่อน)', keywords: ['ม็อกอัพ', 'ม็อคอัพ', 'ตัวอย่างบรรจุภัณฑ์', 'mockup', 'พรีวิวแพ็คเกจ', 'ออกแบบกล่อง'] },
];

export default function GlobalSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);

  // ── ช่องทางเปิด: delegation / custom event / ปุ่มลัด ──
  useEffect(() => {
    const openSearch = () => setOpen(true);
    const onOpenEvent = () => openSearch();

    // คลิกที่ปุ่มใดๆ ที่มี iconify-icon ชื่อมีคำว่า "search" → เปิดค้นหา
    const onDocClick = (e) => {
      const btn = e.target.closest && e.target.closest('button, a, [role="button"]');
      if (!btn || !btn.querySelector) return;
      const icon = btn.querySelector('iconify-icon');
      if (icon && (icon.getAttribute('icon') || '').toLowerCase().includes('search')) {
        e.preventDefault();
        openSearch();
      }
    };

    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };

    window.addEventListener('punthai:open-search', onOpenEvent);
    document.addEventListener('click', onDocClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('punthai:open-search', onOpenEvent);
      document.removeEventListener('click', onDocClick);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  // reset + focus เมื่อเปิด
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  // ── กรองผลลัพธ์: ต้องพิมพ์ก่อนถึงจะแสดง (ยังไม่พิมพ์ = ไม่มีรายการ) ──
  const trimmed = query.trim();
  const results = useMemo(() => {
    const q = trimmed.toLowerCase();
    if (!q) return [];  // ยังไม่พิมพ์ → ไม่แสดงอะไร
    const scored = [];
    for (const item of SEARCH_INDEX) {
      const haystacks = [
        item.name.toLowerCase(),
        ...(item.keywords || []).map((k) => k.toLowerCase()),
        (item.hint || '').toLowerCase(),
      ];
      let score = -1;
      let matchedKw = null;
      for (const h of haystacks) {
        const idx = h.indexOf(q);
        if (idx === 0) { score = Math.max(score, 3); if (!matchedKw) matchedKw = h; }
        else if (idx > 0) { score = Math.max(score, 1); if (!matchedKw) matchedKw = h; }
      }
      if (score >= 0) scored.push({ item, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.item);
  }, [trimmed]);

  useEffect(() => { setActiveIdx(0); }, [trimmed]);

  const go = (item) => {
    setOpen(false);
    navigate(item.path);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (!results.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter') { e.preventDefault(); if (results[activeIdx]) go(results[activeIdx]); }
  };

  if (!open) return null;

  const showDropdown = trimmed.length > 0;

  return (
    // ชั้นโปร่งใสสำหรับปิดเมื่อคลิกนอกแถบ (ไม่มีฉากมืด — ไม่ใช่ popup)
    <div className="gs-layer" onMouseDown={() => setOpen(false)}>
      <div className="gs-bar" onMouseDown={(e) => e.stopPropagation()} role="search">
        <div className="gs-input-row">
          <iconify-icon icon="iconamoon:search-light" className="gs-input-icon"></iconify-icon>
          <input
            ref={inputRef}
            className="gs-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="ค้นหาเมนู ฟีเจอร์ หรือการตั้งค่า... (เช่น โลโก้, สินค้า, ตั้งค่า)"
          />
          {query && (
            <button className="gs-clear" onClick={() => { setQuery(''); inputRef.current?.focus(); }} aria-label="ล้าง">
              <iconify-icon icon="mdi:close"></iconify-icon>
            </button>
          )}
          <button className="gs-close" onClick={() => setOpen(false)} aria-label="ปิด">
            <iconify-icon icon="mdi:close"></iconify-icon>
          </button>
        </div>

        {/* dropdown แสดงเฉพาะเมื่อมีการพิมพ์ (เหมือน autocomplete ของ Google) */}
        {showDropdown && (
          <div className="gs-dropdown">
            {results.length === 0 ? (
              <div className="gs-empty">
                <iconify-icon icon="mdi:magnify-close"></iconify-icon>
                <p>ไม่พบสิ่งที่คุณค้นหา</p>
                <span>ลองใช้คำอื่น เช่น "โลโก้", "การตลาด", "ตั้งค่า"</span>
              </div>
            ) : (
              results.map((item, i) => (
                <button
                  key={`${item.name}-${item.path}`}
                  className={`gs-item${i === activeIdx ? ' gs-active' : ''}`}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => go(item)}
                >
                  <span className="gs-item-icon"><iconify-icon icon={item.icon}></iconify-icon></span>
                  <span className="gs-item-text">
                    <span className="gs-item-name">{item.name}</span>
                    {item.hint && <span className="gs-item-hint">{item.hint}</span>}
                  </span>
                  <span className="gs-item-group">{item.group}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
