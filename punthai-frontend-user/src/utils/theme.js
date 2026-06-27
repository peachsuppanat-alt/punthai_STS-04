// ===== ระบบจัดการธีม (Light / Dark / Auto) =====
// เก็บค่าที่ผู้ใช้เลือกไว้ใน localStorage และตั้ง attribute data-theme ที่ <html>
// CSS (theme-dark.css) จะอ่าน html[data-theme="dark"] เพื่อสลับสีทั้งเว็บ

const STORAGE_KEY = 'theme'; // ค่า: 'light' | 'dark' | 'auto'

// อ่านค่าที่ผู้ใช้เลือกไว้ (default = 'light')
export const getStoredTheme = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'light';
  } catch {
    return 'light';
  }
};

// ระบบของเครื่องตอนนี้ชอบโหมดมืดไหม
const systemPrefersDark = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;

// แปลงค่าที่เลือก → โหมดจริงที่จะแสดง ('light' | 'dark')
export const resolveTheme = (theme) => {
  if (theme === 'dark') return 'dark';
  if (theme === 'auto') return systemPrefersDark() ? 'dark' : 'light';
  return 'light';
};

// ลงมือเปลี่ยนธีมที่ <html> (ไม่บันทึก)
const setHtmlTheme = (theme) => {
  const resolved = resolveTheme(theme);
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.setAttribute('data-theme', 'dark');
  } else {
    root.removeAttribute('data-theme');
  }
};

// เปลี่ยนธีม + บันทึกค่า (เรียกตอนผู้ใช้กดเลือกในหน้า Settings)
export const applyTheme = (theme) => {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch { /* ignore */ }
  setHtmlTheme(theme);
};

// เรียกครั้งเดียวตอนเปิดเว็บ — ใช้ค่าที่เคยเลือกไว้ + ฟังการเปลี่ยนของระบบ (สำหรับโหมด auto)
let mediaListenerAdded = false;
export const initTheme = () => {
  setHtmlTheme(getStoredTheme());

  if (!mediaListenerAdded && window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (getStoredTheme() === 'auto') setHtmlTheme('auto');
    };
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else if (mq.addListener) mq.addListener(handler); // เผื่อ browser เก่า
    mediaListenerAdded = true;
  }
};
