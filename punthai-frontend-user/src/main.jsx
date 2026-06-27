import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './theme-dark.css' // override สีสำหรับโหมดมืด (อ่าน html[data-theme="dark"])
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom' // 1. นำเข้า BrowserRouter
import { initTheme } from './utils/theme'

// ตั้งธีมตามที่ผู้ใช้เคยเลือกไว้ ก่อน render (กันจอกระพริบ)
initTheme();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter> {/* 2. ครอบ App ไว้ข้างใน */}
      <App />
    </BrowserRouter>
  </StrictMode>,
)