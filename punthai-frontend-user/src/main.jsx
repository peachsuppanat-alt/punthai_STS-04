import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom' // 1. นำเข้า BrowserRouter

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter> {/* 2. ครอบ App ไว้ข้างใน */}
      <App />
    </BrowserRouter>
  </StrictMode>,
)