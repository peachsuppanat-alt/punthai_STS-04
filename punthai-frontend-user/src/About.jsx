import './About.css';
import { useNavigate } from 'react-router-dom';
import BGHeadHome from "./assets/home/BG-headhome.png";

/* ── Icons (inline SVG เพื่อไม่ต้องติดตั้ง library เพิ่ม) ── */
const IconDNA = () => (
  <svg viewBox="0 0 24 24"><path d="M12 3c-1.5 4-1.5 6 0 9s1.5 5 0 9M8 5.5C9.5 7 11 8 12 9.5M8 18.5C9.5 17 11 16 12 14.5M16 5.5C14.5 7 13 8 12 9.5M16 18.5C14.5 17 13 16 12 14.5M6 7h4M14 7h4M6 17h4M14 17h4"/></svg>
);
const IconSpark = () => (
  <svg viewBox="0 0 24 24"><path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6L12 3z"/><path d="M19 16l.9 2.7L22.6 20l-2.7.9L19 23.6l-.9-2.7L15.4 20l2.7-.9L19 16z"/></svg>
);
const IconMap = () => (
  <svg viewBox="0 0 24 24"><path d="M9 3L3 6v15l6-3 6 3 6-3V3l-6 3-6-3z"/><path d="M9 3v15M15 6v15"/></svg>
);
const IconEdit = () => (
  <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
);

const stats = [
  { num: '99,336', lbl: 'ผู้ผลิตชุมชนในไทย' },
  { num: '280B', lbl: 'บาท มูลค่าต่อปี' },
  { num: '97%', lbl: 'ยังขาดแบรนด์แข็งแกร่ง' },
];

const solutions = [
  {
    num: '01',
    title: 'Brand DNA Analysis',
    desc: 'วิเคราะห์อัตลักษณ์แบรนด์ แบ่งบุคลิกภาพ 4 กลุ่ม — Heritage, Neighbor, Caregiver, Creator เพื่อสร้างแบรนด์ที่ตรงกับตัวคุณที่สุด',
    Icon: IconDNA,
  },
  {
    num: '02',
    title: 'AI Logo & Packaging',
    desc: 'สร้างโลโก้และออกแบบบรรจุภัณฑ์อัตโนมัติด้วย AI โดยไม่ต้องมีทักษะดีไซน์หรือโปรแกรมออกแบบใดๆ',
    Icon: IconSpark,
  },
  {
    num: '03',
    title: 'Content & Marketing',
    desc: 'สร้างคอนเทนต์พร้อมใช้สำหรับ Facebook, Instagram, LINE และ TikTok ครบในที่เดียว',
    Icon: IconEdit,
  },
  {
    num: '04',
    title: 'Market Planning',
    desc: 'วางแผนตลาด ค้นหาสถานที่จำหน่าย และเชื่อมต่อโรงพิมพ์ในระบบเดียว พร้อมแผนงานที่ AI สร้างให้',
    Icon: IconMap,
  },
];

const archetypes = [
  { icon: 'solar:diploma-bold-duotone',   name: 'Heritage', tag: 'สายอนุรักษ์', desc: 'เน้นรากเหง้า ภูมิปัญญา และความภาคภูมิใจในท้องถิ่น' },
  { icon: 'solar:users-group-rounded-bold-duotone', name: 'Neighbor', tag: 'สายเป็นมิตร', desc: 'เข้าถึงง่าย ราคาไม่แพง และสร้างความอบอุ่นใจ' },
  { icon: 'solar:leaf-bold-duotone',      name: 'Caregiver', tag: 'สายสุขภาพ', desc: 'ใส่ใจสุขภาพ ธรรมชาติ และวัตถุดิบคุณภาพดี' },
  { icon: 'solar:magic-stick-3-bold-duotone', name: 'Creator', tag: 'สายหรูหรา', desc: 'ดีไซน์โดดเด่น พรีเมียม และสร้างความประทับใจ' },
];

export default function About() {
  const navigate = useNavigate();

  return (
    <div className="about-page">

      {/* ── HERO (คงเดิม) ── */}
      <section className="hero">
        <img src={BGHeadHome} alt="ตลาดสดชุมชนไทย" className="hero-bg" />
        <div className="hero-overlay" />
        <div className="hero-content">
          <p className="hero-eyebrow">PunThai Platform</p>
          <h1>
            เสริมศักยภาพ<br />
            <em>แบรนด์ชุมชน</em><br />
            ด้วย AI
          </h1>
          <button className="btn-cta" onClick={() => navigate('/project')}>
            เริ่มสร้างแบรนด์
          </button>
        </div>
      </section>

      {/* ── ส่วนที่ต่อจาก Hero: orb bg + no images ── */}
      <div className="about-body">

        {/* ── STATS ── */}
        <section className="stats-strip">
          {stats.map((s, i) => (
            <div className="stat-item" key={i}>
              <span className="stat-num">{s.num}</span>
              <span className="stat-lbl">{s.lbl}</span>
            </div>
          ))}
        </section>

        {/* ── INTRO ── */}
        <div className="intro-section">
          <p className="section-overline">เกี่ยวกับเรา</p>
          <h2 className="intro-headline">
            เครื่องมือเดียว<br />ครบทุกขั้นตอน
          </h2>
          <p className="intro-body">
            ปั้นไทยช่วยผู้ผลิตสินค้าชุมชนสร้างอัตลักษณ์แบรนด์
            วางแผนการตลาด และผลิตสื่อดิจิทัล
            โดยไม่ต้องมีพื้นฐานด้านการออกแบบหรือการตลาด
          </p>
        </div>

        {/* ── SOLUTIONS (glass card grid) ── */}
        <section className="about-section" style={{ paddingTop: 0 }}>
          <div className="solutions-grid">
            {solutions.map((s, i) => (
              <div
                className="sol-card"
                key={i}
                style={{ animationDelay: `${i * 0.07}s` }}
              >
                <div className="sol-icon">
                  <s.Icon />
                </div>
                <p className="sol-num">{s.num}</p>
                <h3 className="sol-title">{s.title}</h3>
                <p className="sol-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── ARCHETYPES ── */}
        <section className="archetypes-section">
          <p className="section-overline">บุคลิกภาพแบรนด์</p>
          <h2 className="section-headline">4 กลุ่มแบรนด์<br />ที่คุณเป็นได้</h2>
          <p className="section-sub">
            Brand DNA ของปั้นไทยแบ่งแบรนด์ออกเป็น 4 อาร์คีไทป์
            เพื่อให้ทุก output ที่ AI สร้างสอดคล้องกับตัวตนของคุณจริงๆ
          </p>
          <div className="archetypes-grid">
            {archetypes.map((a, i) => (
              <div
                className="arch-card"
                key={i}
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <iconify-icon icon={a.icon} class="arch-icon" />
                <p className="arch-name">{a.name}</p>
                <span className="arch-tag">{a.tag}</span>
                <p className="arch-desc">{a.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA (no image, dark gradient strip) ── */}
        <div className="cta-strip">
          <div className="cta-text">
            <h2>พร้อมแล้วหรือยัง?</h2>
            <p>สร้างแบรนด์ของคุณในไม่กี่นาที ไม่ต้องมีทักษะพิเศษ</p>
          </div>
          <div className="cta-action">
            <button className="btn-cta--solid" onClick={() => navigate('/project')}>
              เริ่มต้นเลย →
            </button>
          </div>
        </div>

      </div>{/* end about-body */}
    </div>
  );
}