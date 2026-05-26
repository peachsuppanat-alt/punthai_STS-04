import React, { useState, useMemo, useCallback, useRef, useEffect, useReducer } from 'react';
import { useLocation } from 'react-router-dom';
import './PackageCatalog.css';
import { API_URL } from '../config';

// ─── Categories – icons ทั้งหมดจาก mdi หรือ ph ที่ load แน่นอน ──
export const CATEGORIES = [
  { id: 'all',    label: 'ทั้งหมด',        icon: 'mdi:view-grid-outline' },
  { id: 'pouch',  label: 'Pouch / Bag',    icon: 'mdi:bag-personal-outline' },
  { id: 'box',    label: 'Box',            icon: 'mdi:package-variant-closed' },
  { id: 'bottle', label: 'Bottle',         icon: 'mdi:bottle-soda-outline' },
  { id: 'can',    label: 'Can / Tin',      icon: 'mdi:cup-outline' },
  { id: 'jar',    label: 'Jar',            icon: 'mdi:jar-outline' },
  { id: 'tube',   label: 'Tube',           icon: 'mdi:gesture-tap-hold' },
  { id: 'food',   label: 'Food Packaging', icon: 'mdi:food-takeout-box-outline' },
];

// ─── Dataset ──────────────────────────────────────────────────
export const PACKAGES = [
  {
    id: 1,
    name: 'Food Pouch',
    type: 'ถุงอาหารซิปล็อค',
    categories: ['pouch', 'food'],
    thumbnail: '/package/pouch_food_1/1.png',
    materials: [
      {
        name: 'ฟิล์มอาหาร',
        images: ['/package/pouch_food_1/1.png', '/package/pouch_food_1/2.png', '/package/pouch_food_1/3.png'],
        sizes: ['50g', '100g', '200g', '500g'],
        detail: 'ถุงฟิล์มอาหารเกรดสูง ซิปล็อคกันความชื้น เก็บกลิ่นได้ดี เหมาะกับอาหารแห้งและขนม',
      },
    ],
  },
  {
    id: 2,
    name: 'Stand-Up Food Pouch',
    type: 'ถุงอาหารตั้งได้',
    categories: ['pouch', 'food'],
    thumbnail: '/package/pouch_food_2/1.png',
    materials: [
      {
        name: 'ฟิล์มอาหาร',
        images: ['/package/pouch_food_2/1.png', '/package/pouch_food_2/2.png', '/package/pouch_food_2/3.png'],
        sizes: ['100g', '250g', '500g', '1kg'],
        detail: 'ถุงตั้งได้สำหรับอาหาร ซิปล็อคคุณภาพสูง ดูพรีเมียม เหมาะกับธัญพืช กาแฟ ชา และอาหารเสริม',
      },
    ],
  },
  {
    id: 3,
    name: 'Food Box Bag',
    type: 'กล่องถุงอาหาร',
    categories: ['box', 'food'],
    thumbnail: '/package/boxs_food_3/1.png',
    materials: [
      {
        name: 'กระดาษอาหาร',
        images: ['/package/boxs_food_3/1.png', '/package/boxs_food_3/2.png', '/package/boxs_food_3/3.png'],
        sizes: ['S', 'M', 'L'],
        detail: 'กล่องกระดาษสำหรับอาหาร กันน้ำมัน ปลอดภัยสัมผัสอาหาร เหมาะกับ Takeaway',
      },
    ],
  },
  {
    id: 4,
    name: 'Food Tray Pack',
    type: 'ถุงอาหารตั้งได้',
    categories: ['food'],
    thumbnail: '/package/food_4/1.png',
    materials: [
      {
        name: 'กระดาษ Kraft เคลือบ PE',
        images: ['/package/food_4/1.png', '/package/food_4/2.png', '/package/food_4/3.png'],
        sizes: ['300ml', '500ml', '750ml', '1000ml'],
        detail: 'ถุงตั้งได้สำหรับอาหาร มีหน้าต่างโชว์สินค้า ซิปล็อคคุณภาพสูง',
      },
    ],
  },
  {
    id: 5,
    name: 'Food Paper Box',
    type: 'กล่องกระดาษอาหาร',
    categories: ['box', 'food'],
    thumbnail: '/package/boxs_food_5/1.png',
    materials: [
      {
        name: 'กระดาษเคลือบ PE',
        images: ['/package/boxs_food_5/1.png', '/package/boxs_food_5/2.png', '/package/boxs_food_5/3.png'],
        sizes: ['S', 'M', 'L', 'XL'],
        detail: 'กล่องกระดาษเคลือบ PE กันน้ำ กันน้ำมัน เหมาะกับร้านอาหารและแบรนด์ Delivery พิมพ์สีได้สวยงาม',
      },
    ],
  },
  {
    id: 6,
    name: 'Folding Carton Box',
    type: 'กล่องกระดาษพับ',
    categories: ['box'],
    thumbnail: '/package/boxs_6/1.png',
    materials: [
      {
        name: 'กระดาษอาร์ต',
        images: ['/package/boxs_6/1.png', '/package/boxs_6/2.png', '/package/boxs_6/3.png'],
        sizes: ['S', 'M', 'L', 'XL'],
        detail: 'กล่องกระดาษอาร์ตเคลือบมัน/ด้าน ตัดพับง่าย พิมพ์สีสวย เหมาะกับสินค้าอุปโภคบริโภคและเครื่องสำอาง',
      },
    ],
  },
  {
    id: 7,
    name: 'Rigid Gift Box',
    type: 'กล่องของขวัญแบบแข็ง',
    categories: ['box'],
    thumbnail: '/package/boxs_7/1.png',
    materials: [
      {
        name: 'กระดาษแข็งหนาพิเศษ',
        images: ['/package/boxs_7/1.png', '/package/boxs_7/2.png', '/package/boxs_7/3.png'],
        sizes: ['S', 'M', 'L'],
        detail: 'กล่องแข็งฝาครอบพรีเมียม ทนทาน หรูหรา เหมาะกับของขวัญและสินค้าลักชัวรี',
      },
    ],
  },
  {
    id: 8,
    name: 'Spray Bottle',
    type: 'ขวดสเปรย์',
    categories: ['bottle'],
    thumbnail: '/package/bottles_8/1.png',
    materials: [
      {
        name: 'พลาสติก PET สีทึบ',
        images: ['/package/bottles_8/1.png', '/package/bottles_8/2.png', '/package/bottles_8/3.png'],
        sizes: ['100ml', '250ml', '500ml', '750ml'],
        detail: 'ขวดพลาสติก PET สีทึบคุณภาพสูง เหมาะกับน้ำหอม แอลกอฮอล์ และผลิตภัณฑ์พรีเมียม รีไซเคิลได้',
      },
    ],
  },
  {
    id: 9,
    name: 'PET Bottle',
    type: 'ขวดพลาสติก PET',
    categories: ['bottle'],
    thumbnail: '/package/bottles_9/1.png',
    materials: [
      {
        name: 'PET ใส',
        images: ['/package/bottles_9/1.png', '/package/bottles_9/2.png', '/package/bottles_9/3.png'],
        sizes: ['250ml', '500ml', '1L', '1.5L'],
        detail: 'ขวด PET น้ำหนักเบา แข็งแรง กันกระแทก เหมาะกับเครื่องดื่ม น้ำดื่ม และผลิตภัณฑ์ทำความสะอาด',
      },
    ],
  },
  {
    id: 10,
    name: 'Flat Pouch',
    type: 'ถุงแบน',
    categories: ['pouch'],
    thumbnail: '/package/pouch_10/1.png',
    materials: [
      {
        name: 'ฟิล์มเมทัลไลซ์',
        images: ['/package/pouch_10/1.png', '/package/pouch_10/2.png', '/package/pouch_10/3.png'],
        sizes: ['50g', '100g', '200g', '500g'],
        detail: 'ถุงแบนฟิล์มเมทัลไลซ์ สะท้อนแสงสวยงาม กันความชื้นสูง เหมาะกับของว่าง ขนม และผลิตภัณฑ์ความงาม',
      },
    ],
  },
  {
    id: 11,
    name: 'Window Stand-Up Pouch',
    type: 'ถุงอาหารตั้งได้มีหน้าต่าง',
    categories: ['pouch', 'food'],
    thumbnail: '/package/pouch_food_11/1.png',
    materials: [
      {
        name: 'ฟิล์มใสอาหาร',
        images: ['/package/pouch_food_11/1.png', '/package/pouch_food_11/2.png', '/package/pouch_food_11/3.png'],
        sizes: ['100g', '250g', '500g', '1kg'],
        detail: 'ถุงอาหารตั้งได้พร้อมหน้าต่างโชว์สินค้า ซิปล็อคกันอากาศ เหมาะกับธัญพืช กาแฟ ชา และอาหารเสริม',
      },
    ],
  },
  {
    id: 12,
    name: 'Food Can (Round)',
    type: 'กระป๋องอาหารกลม',
    categories: ['can', 'food'],
    thumbnail: '/package/cans_food_12/1.png',
    materials: [
      {
        name: 'เหล็กเคลือบ TFS',
        images: ['/package/cans_food_12/1.png', '/package/cans_food_12/2.png', '/package/cans_food_12/3.png'],
        sizes: ['150g', '200g', '400g', '800g'],
        detail: 'กระป๋องเหล็กสำหรับอาหาร กันแบคทีเรีย ยืดอายุสินค้าได้นาน เหมาะกับอาหารกระป๋อง อาหารสัตว์ และซอส',
      },
    ],
  },
  {
    id: 13,
    name: 'Beverage Can',
    type: 'กระป๋องเครื่องดื่ม',
    categories: ['can', 'food'],
    thumbnail: '/package/cans_food_13/1.png',
    materials: [
      {
        name: 'อลูมิเนียม',
        images: ['/package/cans_food_13/1.png', '/package/cans_food_13/2.png', '/package/cans_food_13/3.png'],
        sizes: ['150ml', '250ml', '330ml', '500ml'],
        detail: 'กระป๋องอลูมิเนียม น้ำหนักเบา รีไซเคิลได้ 100% เย็นเร็ว เหมาะกับน้ำอัดลม เบียร์ และ Energy drink',
      },
    ],
  },
  {
    id: 14,
    name: 'Flat Jar',
    type: 'กระปุกฝาเดียว',
    categories: ['jar'],
    thumbnail: '/package/jars_14/1.png',
    materials: [
      {
        name: 'พลาสติก PET สีขาวขุ่น',
        images: ['/package/jars_14/1.png', '/package/jars_14/2.png', '/package/jars_14/3.png'],
        sizes: ['100ml', '200ml', '350ml', '500ml'],
        detail: 'โหลแก้วใสฝาเกลียวโลหะ ปิดสนิท กันอากาศ เหมาะกับแยม ครีม ซอส สมุนไพร และเครื่องสำอาง',
      },
    ],
  },
  {
    id: 15,
    name: 'Laminated Tube',
    type: 'หลอดบีบ',
    categories: ['tube'],
    thumbnail: '/package/tudes_15/Metal glossy/1.png',
    materials: [
      {
        name: 'Metal Glossy',
        images: [
          '/package/tudes_15/Metal glossy/1.png',
          '/package/tudes_15/Metal glossy/2.png',
          '/package/tudes_15/Metal glossy/3.png',
        ],
        sizes: ['30ml', '50ml', '100ml', '150ml'],
        detail: 'หลอดบีบผิวมันวาวเงินโลหะ ดูพรีเมียม หรูหรา เหมาะกับเครื่องสำอาง ครีมบำรุง และผลิตภัณฑ์ดูแลผิวระดับสูง',
      },
      {
        name: 'Plastic Matt',
        images: [
          '/package/tudes_15/Plastic Matt/1.png',
          '/package/tudes_15/Plastic Matt/2.png',
          '/package/tudes_15/Plastic Matt/3.png',
        ],
        sizes: ['30ml', '50ml', '100ml', '150ml'],
        detail: 'หลอดบีบพลาสติกผิวด้าน สัมผัสนุ่ม ดูมินิมอล เหมาะกับยาสีฟัน เจล โลชั่น และสกินแคร์ทั่วไป',
      },
    ],
  },
];

// ─── Pill Dropdown ─────────────────────────────────────────────
function FilterDropdown({ activeFilter, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const active = CATEGORIES.find(c => c.id === activeFilter) || CATEGORIES[0];

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="pkc-dropdown-wrap" ref={ref}>
      <button className="pkc-dropdown-trigger" onClick={() => setOpen(o => !o)}>
        <iconify-icon icon={active.icon} class="pkc-dd-icon" />
        <span className="pkc-dd-label">{active.label}</span>
        <iconify-icon icon="mdi:chevron-down" class={`pkc-dd-arrow${open ? ' pkc-dd-arrow-open' : ''}`} />
      </button>

      {open && (
        <div className="pkc-dropdown-menu">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              className={`pkc-dropdown-item${activeFilter === cat.id ? ' pkc-dd-active' : ''}`}
              onClick={() => { onChange(cat.id); setOpen(false); }}
            >
              <iconify-icon icon={cat.icon} class="pkc-dd-item-icon" />
              <span>{cat.label}</span>
              {activeFilter === cat.id && <iconify-icon icon="mdi:check" class="pkc-dd-check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Category Badges ───────────────────────────────────────────
function CategoryBadges({ categories }) {
  return (
    <div className="pkc-cat-badges">
      {categories.map(cid => {
        const cat = CATEGORIES.find(c => c.id === cid);
        if (!cat) return null;
        return (
          <span key={cid} className={`pkc-cat-badge pkc-cat-${cid}`}>
            <iconify-icon icon={cat.icon} />
            {cat.label}
          </span>
        );
      })}
    </div>
  );
}

// ─── Heart Button ──────────────────────────────────────────────
function HeartBtn({ liked, onToggle }) {
  return (
    <button
      className={`pkc-heart-btn${liked ? ' pkc-heart-active' : ''}`}
      onClick={e => { e.stopPropagation(); onToggle(e); }}
      title={liked ? 'เอาออกจาก Favorite' : 'เพิ่มใน Favorite'}
    >
      <iconify-icon icon={liked ? 'mdi:heart' : 'mdi:heart-outline'} />
    </button>
  );
}

// ─── Like Product Picker (small inline dropdown) ──────────────
function LikeProductPicker({ pkg, anchorRect, onClose, onLiked }) {
  const location = useLocation();
  const projectId = location.state?.projectId;
  const pickerRef = useRef(null);

  const [products, setProducts]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [selected, setSelected]       = useState(null);
  const [saving, setSaving]           = useState(false);
  const [successId, setSuccessId]     = useState(null);

  const [style, setStyle] = useState({});
  useEffect(() => {
    if (!anchorRect) return;
    const pickerW = 260;
    let left = anchorRect.right - pickerW;
    let top  = anchorRect.bottom + 8 + window.scrollY;
    if (left < 8) left = 8;
    setStyle({ position: 'fixed', top: anchorRect.bottom + 8, left });
  }, [anchorRect]);

  useEffect(() => {
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  useEffect(() => {
    if (!projectId) { setLoading(false); return; }
    fetch(`${API_URL}/api/brand_product/${projectId}`)
      .then(r => r.json())
      .then(data => { if (data.status === 'success') setProducts(data.products); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [projectId]);

  const handleConfirm = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/package-catalog/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: selected, package_id: pkg.id, is_liked: true }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setSuccessId(selected);
        onLiked();
        setTimeout(() => onClose(), 1200);
      } else {
        alert('บันทึกไม่สำเร็จ: ' + data.message);
      }
    } catch {
      alert('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pkc-like-picker" style={style} ref={pickerRef} onClick={e => e.stopPropagation()}>
      <div className="pkc-like-picker-arrow" />
      <div className="pkc-like-picker-header">
        <iconify-icon icon="mdi:heart" style={{ color: '#e53935', fontSize: '15px' }} />
        <span>บันทึก Favorite ให้สินค้า</span>
        <button className="pkc-like-picker-close" onClick={onClose}>
          <iconify-icon icon="mdi:close" />
        </button>
      </div>
      <div className="pkc-like-picker-pkg">
        <img src={pkg.thumbnail} alt={pkg.name} className="pkc-like-picker-pkg-img" />
        <span className="pkc-like-picker-pkg-name">{pkg.name}</span>
      </div>
      <div className="pkc-like-picker-list">
        {loading ? (
          <div className="pkc-like-picker-state">
            <iconify-icon icon="mdi:loading" style={{ animation: 'pkc-spin 1s linear infinite', fontSize: '22px', color: '#c94f24' }} />
          </div>
        ) : products.length === 0 ? (
          <div className="pkc-like-picker-state" style={{ fontSize: '12px', color: '#aaa' }}>
            ยังไม่มีสินค้า กรุณาเพิ่มใน Your Projects
          </div>
        ) : products.map(p => {
          const isActive = selected === p.product_id;
          const isDone   = successId === p.product_id;
          return (
            <div
              key={p.product_id}
              className={`pkc-like-picker-item${isActive ? ' pkc-like-picker-item-active' : ''}`}
              onClick={() => setSelected(p.product_id)}
            >
              <div className="pkc-like-picker-item-img">
                {p.image_product
                  ? <img src={`${API_URL}/uploads/${p.image_product}`} alt={p.name_product} />
                  : <iconify-icon icon="mdi:image-off-outline" style={{ fontSize: '18px', color: '#ccc' }} />
                }
              </div>
              <span className="pkc-like-picker-item-name">{p.name_product}</span>
              {isDone
                ? <iconify-icon icon="mdi:check-circle" style={{ color: '#4caf50', fontSize: '18px', flexShrink: 0 }} />
                : isActive
                  ? <iconify-icon icon="mdi:radiobox-marked" style={{ color: '#c94f24', fontSize: '18px', flexShrink: 0 }} />
                  : <iconify-icon icon="mdi:radiobox-blank" style={{ color: '#ccc', fontSize: '18px', flexShrink: 0 }} />
              }
            </div>
          );
        })}
      </div>
      {!successId && (
        <div className="pkc-like-picker-footer">
          <button
            className="pkc-like-picker-confirm"
            onClick={handleConfirm}
            disabled={!selected || saving}
          >
            {saving
              ? <iconify-icon icon="mdi:loading" style={{ animation: 'pkc-spin 1s linear infinite', fontSize: '14px' }} />
              : 'ยืนยัน'
            }
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Lightbox ──────────────────────────────────────────────────
function Lightbox({ images, startIdx, onClose }) {
  const [idx, setIdx] = useState(startIdx);
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIdx(i => (i + 1) % images.length);
      if (e.key === 'ArrowLeft')  setIdx(i => (i - 1 + images.length) % images.length);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [images.length, onClose]);

  return (
    <div className="pkc-lightbox-backdrop" onClick={onClose}>
      <div className="pkc-lightbox-inner" onClick={e => e.stopPropagation()}>
        <button className="pkc-lightbox-close" onClick={onClose}>
          <iconify-icon icon="mdi:close" />
        </button>
        {images.length > 1 && (
          <>
            <button className="pkc-lightbox-nav pkc-lightbox-prev" onClick={() => setIdx(i => (i - 1 + images.length) % images.length)}>
              <iconify-icon icon="mdi:chevron-left" />
            </button>
            <button className="pkc-lightbox-nav pkc-lightbox-next" onClick={() => setIdx(i => (i + 1) % images.length)}>
              <iconify-icon icon="mdi:chevron-right" />
            </button>
          </>
        )}
        <img src={images[idx]} alt="" className="pkc-lightbox-img" />
        {images.length > 1 && (
          <div className="pkc-lightbox-counter">{idx + 1} / {images.length}</div>
        )}
      </div>
    </div>
  );
}

// ─── Select Product Modal ──────────────────────────────────────
function SelectProductModal({ pkg, selectedSize, onBack, onClose }) {
  const location = useLocation();
  const projectId = location.state?.projectId;

  const [products, setProducts]                   = useState([]);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [loading, setLoading]                     = useState(true);
  const [saving, setSaving]                       = useState(false);
  const [successMsg, setSuccessMsg]               = useState('');

  useEffect(() => {
    if (!projectId) { setLoading(false); return; }
    fetch(`${API_URL}/api/brand_product/${projectId}`)
      .then(r => r.json())
      .then(data => { if (data.status === 'success') setProducts(data.products); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [projectId]);

  const handleConfirm = async () => {
    if (!selectedProductId) return alert('กรุณาเลือกสินค้าก่อน');
    setSaving(true);
    try {
      await fetch(`${API_URL}/api/brand_product/${selectedProductId}/package`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package_id: pkg.id }),
      });
      const res2 = await fetch(`${API_URL}/api/package-catalog`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: selectedProductId,
          package_id: pkg.id,
          action: 'select',
        }),
      });
      const data = await res2.json();
      if (data.status === 'success') {
        setSuccessMsg(`เลือก Package "${pkg.name}" ให้กับสินค้าเรียบร้อยแล้ว!`);
        setTimeout(() => onClose(), 1800);
      } else {
        alert('บันทึกไม่สำเร็จ: ' + data.message);
      }
    } catch {
      alert('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pkc-modal-backdrop" onClick={onClose}>
      <div className="pkc-select-product-modal" onClick={e => e.stopPropagation()}>
        <div className="pkc-sp-header">
          <button className="pkc-sp-back-btn" onClick={onBack}>
            <iconify-icon icon="mdi:arrow-left" />
          </button>
          <div className="pkc-sp-title-wrap">
            <p className="pkc-sp-subtitle">
              Package: <strong>{pkg.name}</strong>{selectedSize ? ` · ${selectedSize}` : ''}
            </p>
            <h3 className="pkc-sp-title">เลือกสินค้าที่ต้องการใช้ Package นี้</h3>
          </div>
          <button className="pkc-modal-close" onClick={onClose}>
            <iconify-icon icon="mdi:close" />
          </button>
        </div>
        <div className="pkc-sp-body">
          {successMsg ? (
            <div className="pkc-sp-success">
              <iconify-icon icon="mdi:check-circle" style={{ fontSize: '52px', color: '#4caf50' }} />
              <p>{successMsg}</p>
            </div>
          ) : loading ? (
            <div className="pkc-sp-loading">
              <iconify-icon icon="mdi:loading" style={{ fontSize: '36px', color: '#c94f24', animation: 'pkc-spin 1s linear infinite' }} />
              <p>กำลังโหลดสินค้า...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="pkc-sp-empty">
              <iconify-icon icon="mdi:package-variant-remove" style={{ fontSize: '48px', color: '#ccc' }} />
              <p>ยังไม่มีสินค้าในโปรเจกต์นี้</p>
              <span>กรุณาเพิ่มสินค้าใน "Your Projects" ก่อน</span>
            </div>
          ) : (
            <div className="pkc-sp-product-grid">
              {products.map((product, idx) => {
                const isSelected = selectedProductId === product.product_id;
                return (
                  <div
                    key={product.product_id || idx}
                    className={`pkc-sp-product-card${isSelected ? ' pkc-sp-selected' : ''}`}
                    onClick={() => setSelectedProductId(product.product_id)}
                  >
                    <div className="pkc-sp-product-img">
                      {product.image_product
                        ? <img src={`${API_URL}/uploads/${product.image_product}`} alt={product.name_product} />
                        : <iconify-icon icon="mdi:image-off-outline" style={{ fontSize: '32px', color: '#ccc' }} />
                      }
                    </div>
                    <div className="pkc-sp-product-info">
                      <p className="pkc-sp-product-type">{product.type_product}</p>
                      <h4 className="pkc-sp-product-name">{product.name_product}</h4>
                    </div>
                    {isSelected && (
                      <div className="pkc-sp-check">
                        <iconify-icon icon="mdi:check-circle" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {!successMsg && !loading && products.length > 0 && (
          <div className="pkc-sp-footer">
            <button className="pkc-sp-cancel-btn" onClick={onBack}>ย้อนกลับ</button>
            <button
              className="pkc-sp-confirm-btn"
              onClick={handleConfirm}
              disabled={!selectedProductId || saving}
            >
              {saving
                ? <><iconify-icon icon="mdi:loading" style={{ animation: 'pkc-spin 1s linear infinite', marginRight: '6px' }} />กำลังบันทึก...</>
                : <><iconify-icon icon="mdi:check-circle-outline" style={{ marginRight: '6px', fontSize: '18px', verticalAlign: 'middle' }} />ยืนยันการเลือก</>
              }
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Package Detail Modal ──────────────────────────────────────
function PackageDetailModal({ pkg, liked, onToggleLike, onClose }) {
  const [activeMaterialIdx, setActiveMaterialIdx] = useState(0);
  const [activeImgIdx, setActiveImgIdx]           = useState(0);
  const [activeSize, setActiveSize]               = useState(null);
  const [lightboxOpen, setLightboxOpen]           = useState(false);
  const [showSelectProduct, setShowSelectProduct] = useState(false);
  const mat = pkg.materials[activeMaterialIdx];

  const handleMaterial = useCallback((idx) => {
    setActiveMaterialIdx(idx);
    setActiveImgIdx(0);
    setActiveSize(null);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape' && !lightboxOpen && !showSelectProduct) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, lightboxOpen, showSelectProduct]);

  if (showSelectProduct) {
    return (
      <SelectProductModal
        pkg={pkg}
        selectedSize={activeSize}
        onBack={() => setShowSelectProduct(false)}
        onClose={onClose}
      />
    );
  }

  return (
    <>
    {lightboxOpen && (
      <Lightbox images={mat.images} startIdx={activeImgIdx} onClose={() => setLightboxOpen(false)} />
    )}
    <div className="pkc-modal-backdrop" onClick={onClose}>
      <div className="pkc-modal" onClick={e => e.stopPropagation()}>
        <div className="pkc-modal-actions">
          <HeartBtn liked={liked} onToggle={onToggleLike} />
          <button className="pkc-modal-close" onClick={onClose}>
            <iconify-icon icon="mdi:close" />
          </button>
        </div>
        <div className="pkc-modal-inner">
          {/* LEFT */}
          <div className="pkc-modal-left">
            <div className="pkc-main-img-wrap" onClick={() => setLightboxOpen(true)} style={{cursor:'zoom-in'}}>
              <img
                src={mat.images[activeImgIdx]}
                alt={pkg.name}
                className="pkc-main-img"
                loading="lazy"
              />
              <button className="pkc-zoom-btn" onClick={e => { e.stopPropagation(); setLightboxOpen(true); }}>
                <iconify-icon icon="mdi:magnify-plus-outline" />
              </button>
            </div>
            <div className="pkc-thumbs">
              {mat.images.map((img, i) => (
                <button
                  key={i}
                  className={`pkc-thumb-btn${activeImgIdx === i ? ' pkc-thumb-active' : ''}`}
                  onClick={() => setActiveImgIdx(i)}
                >
                  <img src={img} alt={`view ${i + 1}`} loading="lazy" />
                </button>
              ))}
            </div>
          </div>
          {/* RIGHT */}
          <div className="pkc-modal-right">
            <CategoryBadges categories={pkg.categories} />
            <p className="pkc-modal-type">{pkg.type}</p>
            <h2 className="pkc-modal-name">{pkg.name}</h2>
            {pkg.materials.length > 1 && (
              <div className="pkc-section">
                <p className="pkc-section-label">วัสดุ</p>
                <div className="pkc-material-btns">
                  {pkg.materials.map((m, i) => (
                    <button
                      key={m.name}
                      className={`pkc-mat-btn${activeMaterialIdx === i ? ' pkc-mat-active' : ''}`}
                      onClick={() => handleMaterial(i)}
                    >{m.name}</button>
                  ))}
                </div>
              </div>
            )}
            <div className="pkc-section">
              <p className="pkc-section-label">ประเภทวัสดุ</p>
              <p className="pkc-detail-text">{mat.name}</p>
              <p className="pkc-detail-desc">{mat.detail}</p>
            </div>
            <div className="pkc-section">
              <p className="pkc-section-label">ขนาด</p>
              <div className="pkc-sizes">
                {mat.sizes.map(sz => (
                  <button
                    key={sz}
                    className={`pkc-size-btn${activeSize === sz ? ' pkc-size-active' : ''}`}
                    onClick={() => setActiveSize(sz)}
                  >{sz}</button>
                ))}
              </div>
            </div>
            <button className="pkc-select-btn" onClick={() => setShowSelectProduct(true)}>
              <iconify-icon icon="mdi:check-circle-outline"
                style={{ marginRight: '8px', fontSize: '18px', verticalAlign: 'middle' }} />
              เลือก Package นี้
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

// ─── Package Card with hold-to-cycle ──────────────────────────
function PackageCard({ pkg, liked, onToggleLike, onOpen }) {
  const images = pkg.materials[0].images;
  const imgIdxRef = useRef(0);
  const [imgIdx, setImgIdx] = useState(0);
  const intervalRef = useRef(null);
  const holdTimeoutRef = useRef(null);
  const holdingRef = useRef(false);
  const [pickerAnchor, setPickerAnchor] = useState(null);

  const stopCycle = () => {
    holdingRef.current = false;
    clearTimeout(holdTimeoutRef.current);
    clearInterval(intervalRef.current);
    holdTimeoutRef.current = null;
    intervalRef.current = null;
  };

  const startCycle = (e) => {
    if (images.length <= 1) return;
    holdingRef.current = true;
    holdTimeoutRef.current = setTimeout(() => {
      if (!holdingRef.current) return;
      imgIdxRef.current = (imgIdxRef.current + 1) % images.length;
      setImgIdx(imgIdxRef.current);
      intervalRef.current = setInterval(() => {
        imgIdxRef.current = (imgIdxRef.current + 1) % images.length;
        setImgIdx(imgIdxRef.current);
      }, 700);
    }, 1000);
  };

  useEffect(() => () => stopCycle(), []);

  const handleHeartClick = (e) => {
    e.stopPropagation();
    if (liked) {
      onToggleLike(pkg.id);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setPickerAnchor(rect);
    }
  };

  return (
    <>
    <div
      className="pkc-card"
      onClick={() => onOpen(pkg)}
      onMouseDown={startCycle}
      onMouseUp={stopCycle}
      onMouseLeave={stopCycle}
      onTouchStart={startCycle}
      onTouchEnd={stopCycle}
    >
      <div className="pkc-card-img-wrap">
        <img
          src={images[imgIdx]}
          alt={pkg.name}
          className="pkc-card-img"
          loading="lazy"
          draggable={false}
        />
        <HeartBtn liked={liked} onToggle={handleHeartClick} />
        <div className="pkc-card-badges-overlay">
          {pkg.categories.map(cid => {
            const cat = CATEGORIES.find(c => c.id === cid);
            if (!cat) return null;
            return (
              <span key={cid} className={`pkc-cat-badge pkc-cat-${cid}`}>
                <iconify-icon icon={cat.icon} />
                {cat.label}
              </span>
            );
          })}
        </div>
      </div>
      <div className="pkc-card-body">
        <p className="pkc-card-type">{pkg.type}</p>
        <h3 className="pkc-card-name">{pkg.name}</h3>
        <div className="pkc-card-mats">
          {pkg.materials.map(m => (
            <span key={m.name} className="pkc-mat-tag">{m.name}</span>
          ))}
        </div>
        <button
          className="pkc-card-view-btn"
          onClick={e => { e.stopPropagation(); onOpen(pkg); }}
        >
          ดูรายละเอียด
          <iconify-icon icon="mdi:arrow-right"
            style={{ marginLeft: '5px', verticalAlign: 'middle' }} />
        </button>
      </div>
    </div>
    {pickerAnchor && (
      <LikeProductPicker
        pkg={pkg}
        anchorRect={pickerAnchor}
        onClose={() => setPickerAnchor(null)}
        onLiked={() => { onToggleLike(pkg.id); setPickerAnchor(null); }}
      />
    )}
    </>
  );
}

// ─── PackageCatalog — content only (no navbar/sidebar/tabs) ───
export function PackageCatalog() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [likedIds, setLikedIds] = useState(new Set());

  const filtered = useMemo(() =>
    activeFilter === 'all'
      ? PACKAGES
      : PACKAGES.filter(p => p.categories.includes(activeFilter)),
    [activeFilter]
  );

  const toggleLike = useCallback((id) => {
    setLikedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleOpen  = useCallback((pkg) => setSelectedPackage(pkg), []);
  const handleClose = useCallback(() => setSelectedPackage(null), []);

  return (
    <>
      <div className="pkc-content-card">
        <div className="pkc-filter-row">
          <FilterDropdown activeFilter={activeFilter} onChange={setActiveFilter} />
          {activeFilter !== 'all' && (
            <span className="pkc-result-count">พบ {filtered.length} รายการ</span>
          )}
        </div>
        <div className="pkc-grid">
          {filtered.length === 0 ? (
            <div className="pkc-empty">
              <iconify-icon icon="mdi:package-variant-remove" class="pkc-empty-icon" />
              <div className="pkc-empty-text">ไม่พบ Package ในหมวดนี้</div>
            </div>
          ) : filtered.map(pkg => {
            const liked = likedIds.has(pkg.id);
            return (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                liked={liked}
                onToggleLike={toggleLike}
                onOpen={handleOpen}
              />
            );
          })}
        </div>
      </div>

      {selectedPackage && (
        <PackageDetailModal
          pkg={selectedPackage}
          liked={likedIds.has(selectedPackage.id)}
          onToggleLike={() => toggleLike(selectedPackage.id)}
          onClose={handleClose}
        />
      )}
    </>
  );
}

export { PackageDetailModal };
export default PackageCatalog;