// MarketPlanning.jsx — View Only (redesigned to match hotel booking UI style)
// ดูได้อย่างเดียว: ค้นหางาน / ดูรายละเอียด / ไม่มีการจองแผง

import { useState, useEffect, useRef, useCallback } from "react";
import "./market-planning.css";

// ── Mock data ──────────────────────────────────────────────────────────────
export const MOCK_EVENTS = [
  {
    id: 1,
    name: "ตลาดนัดชุมชนลาดพร้าว",
    type: "ตลาดนัด",
    date: "18 พ.ค. 2568",
    time: "07:00 - 14:00",
    location: "ลาดพร้าว ซ.71 กรุงเทพฯ",
    lat: 13.8121,
    lng: 100.6186,
    slots: 24,
    slotsLeft: 8,
    contact: "095-123-4567",
    fee: "200",
    tags: ["อาหาร", "ของใช้", "เสื้อผ้า"],
    organizer: "ชมรมตลาดชุมชนลาดพร้าว",
    desc: "ตลาดนัดชุมชนประจำสัปดาห์ รับสินค้าหลากหลายประเภท ลูกค้าหนาแน่นช่วงเช้า",
    icon: "mdi:store",
    rating: 4.9,
    status: "active",
  },
  {
    id: 2,
    name: "งานมหกรรม OTOP สินค้าชุมชน",
    type: "อีเวนท์",
    date: "25-27 พ.ค. 2568",
    time: "10:00 - 20:00",
    location: "ศูนย์การค้าเซ็นทรัล ลาดพร้าว",
    lat: 13.8155,
    lng: 100.6041,
    slots: 60,
    slotsLeft: 3,
    contact: "02-234-5678",
    fee: "800",
    tags: ["OTOP", "ของฝาก", "อาหาร"],
    organizer: "กรมพัฒนาชุมชน",
    desc: "งานแสดงและจำหน่ายสินค้า OTOP ระดับภูมิภาค โอกาสดีสำหรับผู้ประกอบการรายใหม่",
    icon: "mdi:tent",
    rating: 4.7,
    status: "active",
  },
  {
    id: 3,
    name: "ตลาดออร์แกนิค สวนจตุจักร",
    type: "ตลาดนัด",
    date: "ทุกเสาร์-อาทิตย์",
    time: "06:00 - 13:00",
    location: "สวนจตุจักร กรุงเทพฯ",
    lat: 13.8,
    lng: 100.5543,
    slots: 40,
    slotsLeft: 12,
    contact: "Line: @jatujak_organic",
    fee: "350",
    tags: ["ออร์แกนิค", "ผัก", "ผลไม้"],
    organizer: "เครือข่ายเกษตรอินทรีย์กรุงเทพ",
    desc: "ตลาดสินค้าออร์แกนิคและเกษตรอินทรีย์ กลุ่มลูกค้าใส่ใจสุขภาพ",
    icon: "mdi:leaf",
    rating: 4.8,
    status: "active",
  },
  {
    id: 4,
    name: "Night Market อารีย์",
    type: "อีเวนท์",
    date: "20 พ.ค. 2568",
    time: "17:00 - 23:00",
    location: "ถนนอารีย์ พหลโยธิน",
    lat: 13.7765,
    lng: 100.5436,
    slots: 35,
    slotsLeft: 15,
    contact: "064-987-6543",
    fee: "500",
    tags: ["Street Food", "ของวินเทจ", "แฮนด์เมด"],
    organizer: "สมาคมผู้ประกอบการย่านอารีย์",
    desc: "ตลาดกลางคืนสไตล์ฮิปสเตอร์ นักท่องเที่ยวและคนรุ่นใหม่จำนวนมาก",
    icon: "mdi:weather-night",
    rating: 4.6,
    status: "active",
  },
  {
    id: 5,
    name: "ตลาดเกษตรกร เกษตร-นวมินทร์",
    type: "ตลาดนัด",
    date: "ทุกอาทิตย์",
    time: "06:00 - 12:00",
    location: "ม.เกษตรศาสตร์ บางเขน",
    lat: 13.8489,
    lng: 100.5694,
    slots: 50,
    slotsLeft: 20,
    contact: "02-579-0113",
    fee: "150",
    tags: ["ผลผลิต", "อาหาร", "พืชผัก"],
    organizer: "มหาวิทยาลัยเกษตรศาสตร์",
    desc: "ตลาดเกษตรกรโดยตรง สดใหม่จากสวน ราคาถูกกว่าตลาดทั่วไป",
    icon: "mdi:sprout",
    rating: 4.5,
    status: "active",
  },
  {
    id: 6,
    name: "Art & Craft Fair รัชดา",
    type: "อีเวนท์",
    date: "1-2 มิ.ย. 2568",
    time: "11:00 - 21:00",
    location: "Esplanade รัชดาภิเษก",
    lat: 13.7712,
    lng: 100.5647,
    slots: 28,
    slotsLeft: 0,
    contact: "089-555-7890",
    fee: "600",
    tags: ["แฮนด์เมด", "ศิลปะ", "งานฝีมือ"],
    organizer: "Craft Community BKK",
    desc: "งานแสดงผลงานงานฝีมือและศิลปะ เหมาะสำหรับสินค้าแฮนด์เมดและของตกแต่ง",
    icon: "mdi:palette",
    rating: 4.9,
    status: "active",
  },
];

// ── Google Maps Hook ────────────────────────────────────────────────────────
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || "";

function useGoogleMaps() {
  const [isLoaded, setIsLoaded] = useState(false);
  
  useEffect(() => {
    // 🟢 แก้ไข 1: เช็คว่ามี .maps หรือยัง เพื่อไม่ให้ชนกับ Google Login
    if (window.google && window.google.maps) { 
      setIsLoaded(true); 
      return; 
    }

    // ป้องกันการโหลด Script แผนที่ซ้ำ
    if (document.querySelector('script[src*="maps.googleapis.com"]')) {
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
    script.async = true;
    script.defer = true;
    script.onload = () => setIsLoaded(true);
    document.head.appendChild(script);
  }, []);
  
  return isLoaded;
}

// ── Google Map Component ────────────────────────────────────────────────────
function GoogleMapPanel({ events, selected, onSelect }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const infoWindowRef = useRef(null);
  const isLoaded = useGoogleMaps();

  const initMap = useCallback(() => {
    // 🟢 แก้ไข 2: เช็คให้แน่ใจว่า window.google.maps พร้อมใช้งานจริงๆ ก่อนสร้างแผนที่
    if (!mapRef.current || !window.google || !window.google.maps) return;
    
    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: 13.8, lng: 100.58 },
      zoom: 12,
      styles: [
        { elementType: "geometry", stylers: [{ color: "#eaf2fb" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#eaf2fb" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#6b7f9e" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
        { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#dce8f5" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#b3d4f0" }] },
        { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#c8e6c9" }] },
        { featureType: "transit", stylers: [{ visibility: "off" }] },
        { featureType: "poi", stylers: [{ visibility: "simplified" }] },
      ],
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControlOptions: { position: 9 },
    });
    mapInstanceRef.current = map;
    infoWindowRef.current = new window.google.maps.InfoWindow();

    markersRef.current = events.map((event) => {
      const marker = new window.google.maps.Marker({
        position: { lat: event.lat, lng: event.lng },
        map,
        title: event.name,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 11,
          fillColor: "#1565c0",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
        },
      });

      marker.addListener("click", () => {
        onSelect(event);
        infoWindowRef.current.setContent(`
          <div style="font-family:'Sarabun',sans-serif;padding:6px 4px;max-width:220px">
            <div style="font-weight:700;font-size:14px;color:#1a2a4a;margin-bottom:4px">${event.name}</div>
            <div style="font-size:12px;color:#5a6e8e;margin-bottom:4px">${event.location}</div>
            <div style="display:flex;gap:10px;align-items:center">
              <span style="font-size:12px;color:#1565c0;font-weight:700">฿${event.fee}/แผง</span>
              <span style="font-size:12px;color:#e65100;font-weight:600">★ ${event.rating}</span>
            </div>
          </div>
        `);
        infoWindowRef.current.open(map, marker);
      });

      return { marker, eventId: event.id };
    });
  }, [events, onSelect]);

  useEffect(() => { if (isLoaded) initMap(); }, [isLoaded, initMap]);

  useEffect(() => {
    // 🟢 แก้ไข 3: เช็คเพื่อป้องกัน Error ตอนสลับพินบนแผนที่
    if (!window.google || !window.google.maps || !mapInstanceRef.current) return;
    
    markersRef.current.forEach(({ marker, eventId }) => {
      const isActive = selected?.id === eventId;
      marker.setIcon({
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: isActive ? 15 : 11,
        fillColor: isActive ? "#1565c0" : "#ffffff",
        fillOpacity: 1,
        strokeColor: isActive ? "#ffffff" : "#1565c0",
        strokeWeight: isActive ? 3 : 2.5,
      });
      if (isActive) mapInstanceRef.current.panTo(marker.getPosition());
    });
  }, [selected]);

  return (
    <div className="mp-gmap-wrap">
      {!isLoaded && (
        <div className="mp-gmap-loading">
          <iconify-icon icon="mdi:map-outline" style={{ fontSize: 44, color: "#1565c0", marginBottom: 14 }}></iconify-icon>
          <p>กำลังโหลดแผนที่...</p>
          {!GOOGLE_MAPS_API_KEY && (
            <p style={{ fontSize: 12, color: "#aaa", marginTop: 6 }}>⚠️ กรุณาตั้งค่า VITE_GOOGLE_MAPS_KEY ใน .env</p>
          )}
        </div>
      )}
      <div ref={mapRef} className="mp-gmap" style={{ display: isLoaded ? "block" : "none" }} />
    </div>
  );
}

// ── Slot Badge ──────────────────────────────────────────────────────────────
const SlotBadge = ({ slotsLeft }) => {
  if (slotsLeft === 0) return <span className="badge badge--full">แผงเต็ม</span>;
  if (slotsLeft <= 5) return <span className="badge badge--almost">ใกล้เต็ม</span>;
  return <span className="badge badge--open">ว่าง {slotsLeft} แผง</span>;
};

// ── Rating Stars ─────────────────────────────────────────────────────────────
const RatingStar = ({ rating }) => (
  <span className="mp-rating">
    <iconify-icon icon="mdi:star" style={{ color: "#f59e0b", fontSize: 14 }}></iconify-icon>
    <strong>{rating}</strong>
  </span>
);

// ── Event Card ──────────────────────────────────────────────────────────────
function EventCard({ event, isSelected, onSelect }) {
  return (
    <div
      className={`mp-event-card ${isSelected ? "selected" : ""}`}
      onClick={() => onSelect(event)}
    >
      <div className={`mp-event-card__thumb ${event.type === "ตลาดนัด" ? "thumb-market" : "thumb-event"}`}>
        <iconify-icon icon={event.icon} style={{ fontSize: 32 }}></iconify-icon>
        <span className={`type-badge ${event.type === "ตลาดนัด" ? "type-market" : "type-event"}`}>
          {event.type}
        </span>
      </div>

      <div className="mp-event-card__content">
        <div className="mp-event-card__top">
          <div className="mp-event-card__name">{event.name}</div>
          <SlotBadge slotsLeft={event.slotsLeft} />
        </div>

        <div className="mp-event-card__location">
          <iconify-icon icon="mdi:map-marker-outline"></iconify-icon>
          {event.location}
        </div>

        <div className="mp-event-card__meta">
          <span className="mp-meta-item">
            <iconify-icon icon="mdi:calendar-outline"></iconify-icon>
            {event.date}
          </span>
          <span className="mp-meta-item">
            <iconify-icon icon="mdi:clock-outline"></iconify-icon>
            {event.time}
          </span>
        </div>

        <div className="mp-event-card__tags">
          {event.tags.map((t) => (
            <span key={t} className="tag">{t}</span>
          ))}
        </div>

        <div className="mp-event-card__footer">
          <RatingStar rating={event.rating} />
          <div className="mp-event-card__fee">
            <span className="fee-label">ค่าแผง</span>
            <strong className="fee-value">฿{event.fee}</strong>
            <span className="fee-unit">/ แผง</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Detail Popup (under map) — view only ────────────────────────────────────
function MapDetailPanel({ event, onClose }) {
  return (
    <div className="mp-map-detail">
      <div className="mp-map-detail__head">
        <div className={`mp-map-detail__icon ${event.type === "ตลาดนัด" ? "icon-market" : "icon-event"}`}>
          <iconify-icon icon={event.icon} style={{ fontSize: 20 }}></iconify-icon>
        </div>
        <div className="mp-map-detail__name">{event.name}</div>
        <button className="mp-map-detail__close" onClick={onClose}>
          <iconify-icon icon="mdi:close"></iconify-icon>
        </button>
      </div>

      <p className="mp-map-detail__desc">{event.desc}</p>

      <div className="mp-map-detail__grid">
        <div className="mp-map-detail__item">
          <iconify-icon icon="mdi:calendar-outline"></iconify-icon>
          <span>{event.date}</span>
        </div>
        <div className="mp-map-detail__item">
          <iconify-icon icon="mdi:clock-outline"></iconify-icon>
          <span>{event.time}</span>
        </div>
        <div className="mp-map-detail__item">
          <iconify-icon icon="mdi:cash-multiple"></iconify-icon>
          <span>฿{event.fee} / แผง</span>
        </div>
        <div className="mp-map-detail__item">
          <iconify-icon icon="mdi:seat-outline"></iconify-icon>
          <span>ว่าง {event.slotsLeft} แผง</span>
        </div>
        <div className="mp-map-detail__item">
          <iconify-icon icon="mdi:phone-outline"></iconify-icon>
          <span>{event.contact}</span>
        </div>
        <div className="mp-map-detail__item">
          <iconify-icon icon="mdi:account-group-outline"></iconify-icon>
          <span>{event.organizer}</span>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function MarketPlanning({ user }) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [selected, setSelected] = useState(null);
  const [showMapView, setShowMapView] = useState(false);
  const [filterCategory, setFilterCategory] = useState("ทั้งหมด");
  const [priceRange, setPriceRange] = useState([0, 1000]);

  const handleSelect = useCallback((event) => {
    setSelected((prev) => (prev?.id === event.id ? null : event));
  }, []);

  const filtered = MOCK_EVENTS.filter((e) => {
    const matchTab =
      activeTab === "all" ||
      (activeTab === "market" && e.type === "ตลาดนัด") ||
      (activeTab === "event" && e.type === "อีเวนท์");
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      e.name.toLowerCase().includes(q) ||
      e.location.toLowerCase().includes(q) ||
      e.tags.some((t) => t.toLowerCase().includes(q));
    const matchPrice = Number(e.fee) >= priceRange[0] && Number(e.fee) <= priceRange[1];
    return matchTab && matchSearch && matchPrice;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "slots") return b.slotsLeft - a.slotsLeft;
    if (sortBy === "fee") return Number(a.fee) - Number(b.fee);
    if (sortBy === "rating") return b.rating - a.rating;
    return a.id - b.id;
  });

  return (
    <div className="mp-root">

      {/* ── Top Nav Bar ── */}
      <div className="mp-topnav">
        <div className="mp-topnav__inner">
          <div className="mp-topnav__brand">
            <iconify-icon icon="mdi:store-outline" style={{ fontSize: 22, color: "#1565c0" }}></iconify-icon>
            <span>MarketFinder</span>
          </div>
          <div className="mp-topnav__right">
            <span className="mp-topnav__partner">
              <iconify-icon icon="mdi:account-circle-outline"></iconify-icon>
              {user?.name || "ผู้ใช้งาน"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Search Bar ── */}
      <div className="mp-searchbar-wrap">
        <div className="mp-searchbar">
          <div className="mp-searchbar__field">
            <label>สถานที่ / ชื่องาน</label>
            <div className="mp-searchbar__input-wrap">
              <iconify-icon icon="mdi:map-marker-outline" className="sb-icon"></iconify-icon>
              <input
                placeholder="กรุงเทพฯ, ตลาดนัด..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="mp-searchbar__divider" />

          <div className="mp-searchbar__field">
            <label>ประเภท</label>
            <div className="mp-searchbar__input-wrap">
              <iconify-icon icon="mdi:tag-outline" className="sb-icon"></iconify-icon>
              <select value={activeTab} onChange={(e) => setActiveTab(e.target.value)}>
                <option value="all">ทั้งหมด</option>
                <option value="market">ตลาดนัด</option>
                <option value="event">อีเวนท์</option>
              </select>
            </div>
          </div>

          <div className="mp-searchbar__divider" />

          <div className="mp-searchbar__field">
            <label>เรียงตาม</label>
            <div className="mp-searchbar__input-wrap">
              <iconify-icon icon="mdi:sort-variant" className="sb-icon"></iconify-icon>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="date">วันที่</option>
                <option value="slots">ที่ว่างมากสุด</option>
                <option value="fee">ราคาน้อยสุด</option>
                <option value="rating">คะแนนสูงสุด</option>
              </select>
            </div>
          </div>

          <button className="mp-searchbar__btn">
            <iconify-icon icon="mdi:magnify" style={{ fontSize: 20 }}></iconify-icon>
            ค้นหา
          </button>
        </div>
      </div>

      {/* ── Main Layout ── */}
      <div className="mp-layout">

        {/* Left: List */}
        <div className="mp-list-col">
          <div className="mp-result-header">
            <div className="mp-result-header__left">
              <h2>ตลาดและงานอีเวนท์</h2>
              <span className="mp-result-count">พบ <strong>{sorted.length}</strong> รายการ</span>
            </div>
            <div className="mp-result-header__tabs">
              <button
                className={`btn--view-tab ${!showMapView ? "active" : ""}`}
                onClick={() => setShowMapView(false)}
              >
                <iconify-icon icon="mdi:view-list"></iconify-icon>
                รายการ
              </button>
              <button
                className={`btn--view-tab ${showMapView ? "active" : ""}`}
                onClick={() => setShowMapView(true)}
              >
                <iconify-icon icon="mdi:map-outline"></iconify-icon>
                แผนที่
              </button>
            </div>
          </div>

          <div className="mp-event-list">
            {sorted.length === 0 ? (
              <div className="mp-empty">
                <iconify-icon icon="mdi:magnify-remove-outline" style={{ fontSize: 52, color: "#c5d3e8", marginBottom: 14 }}></iconify-icon>
                <p>ไม่พบรายการที่ตรงกับการค้นหา</p>
                <button className="btn btn--outline-sm" onClick={() => { setSearch(""); setActiveTab("all"); }}>
                  ล้างตัวกรอง
                </button>
              </div>
            ) : (
              sorted.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  isSelected={selected?.id === event.id}
                  onSelect={handleSelect}
                />
              ))
            )}
          </div>
        </div>

        {/* Right: Map + Filters */}
        <div className="mp-right-col">

          {/* Map Panel */}
          <div className="mp-map-card">
            <div className="mp-map-header">
              <div className="mp-map-header__left">
                <iconify-icon icon="mdi:map-outline" style={{ fontSize: 18, color: "#1565c0" }}></iconify-icon>
                <div>
                  <div className="mp-map-header__title">แผนที่งานและตลาด</div>
                  <div className="mp-map-header__sub">กรุงเทพมหานครและปริมณฑล</div>
                </div>
              </div>
              <div className="mp-map-header__toggle">
                <iconify-icon icon="mdi:gesture-tap" style={{ fontSize: 14 }}></iconify-icon>
                คลิกพินเพื่อดูรายละเอียด
              </div>
            </div>

            <GoogleMapPanel events={sorted} selected={selected} onSelect={handleSelect} />

            {selected && (
              <MapDetailPanel event={selected} onClose={() => setSelected(null)} />
            )}
          </div>

          {/* Filter Panel */}
          <div className="mp-filter-panel">
            <div className="mp-filter-panel__title">
              <iconify-icon icon="mdi:filter-outline" style={{ fontSize: 18, color: "#1565c0" }}></iconify-icon>
              ตัวกรอง
            </div>

            <div className="mp-filter-section">
              <div className="mp-filter-section__label">
                ค่าแผง (บาท)
                <span className="mp-filter-section__value">฿{priceRange[0]} – ฿{priceRange[1]}</span>
              </div>
              <div className="mp-price-display">
                <span>฿0</span>
                <span>฿1,000</span>
              </div>
              <input
                type="range"
                min={0}
                max={1000}
                step={50}
                value={priceRange[1]}
                className="mp-range"
                onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
              />
            </div>

            <div className="mp-filter-section">
              <div className="mp-filter-section__label">ประเภทงาน</div>
              <div className="mp-filter-select-wrap">
                <select
                  value={activeTab}
                  onChange={(e) => setActiveTab(e.target.value)}
                  className="mp-filter-select"
                >
                  <option value="all">ทั้งหมด</option>
                  <option value="market">ตลาดนัด</option>
                  <option value="event">อีเวนท์</option>
                </select>
              </div>
            </div>

            <div className="mp-filter-section">
              <div className="mp-filter-section__label">ตัวกรองยอดนิยม</div>
              <div className="mp-popular-filters">
                {[
                  { key: "hasSlots", label: "มีที่ว่าง" },
                  { key: "weekend", label: "วันหยุด" },
                  { key: "food", label: "อาหาร" },
                  { key: "organic", label: "ออร์แกนิค" },
                ].map((f) => (
                  <label key={f.key} className="mp-checkbox-label">
                    <input type="checkbox" className="mp-checkbox" />
                    {f.label}
                  </label>
                ))}
              </div>
            </div>

            <button
              className="mp-filter-more"
              onClick={() => {}}
            >
              เพิ่มเติม <iconify-icon icon="mdi:chevron-down"></iconify-icon>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}