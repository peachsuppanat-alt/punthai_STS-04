import { useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import './App.css';

import Navbar from './Navbar';
import Home from './Home';
import Auth from './Auth'; 
import { MyProject } from './MyProject';
import { YourProjects } from './YourProjects';
import { BrandDNA } from './BrandDNA'; 

// หน้าชั่วคราว
const Shopping = () => <h2 style={{marginTop: '100px', textAlign: 'center'}}>Shopping Page</h2>;
const About = () => <h2 style={{marginTop: '100px', textAlign: 'center'}}>About Page</h2>;

function App() {
  const [user, setUser] = useState(null);       // เก็บข้อมูลผู้ใช้ (null = ยังไม่ Login)
  const [showAuth, setShowAuth] = useState(false); // ควบคุมการเปิด Popup

  // ดึงข้อมูล URL ปัจจุบัน
  const location = useLocation();

  // isProjectPage เพื่อซ่อน Navbar ตัวหลัก
  const isProjectPage = location.pathname === '/project' || location.pathname === '/your-projects' || location.pathname === '/brand-dna';

  return (
    <div>
      {/* 4. ใส่เงื่อนไขครอบ Navbar ไว้: จะแสดงก็ต่อเมื่อ ไม่ใช่หน้า Project หรือ YourProjects */}
      {!isProjectPage && (
        <Navbar 
          user={user} 
          onOpenLogin={() => setShowAuth(true)} 
          onLogout={() => setUser(null)}
        />
      )}

      <Routes>
        <Route path="/" element={<Home user={user} />} />
        <Route path="/project" element={<MyProject />} /> 
        <Route path="/brand-dna" element={<BrandDNA />} />
        
        <Route path="/your-projects" element={<YourProjects />} /> 
        
        {/* <Route path="/shopping" element={<Shopping />} />
        <Route path="/about" element={<About />} /> */}
      </Routes>

      {/* แสดง Popup เมื่อ showAuth เป็น true */}
      {showAuth && (
        <Auth 
          onLoginSuccess={(userData) => setUser(userData)} 
          onClose={() => setShowAuth(false)} 
        />
      )}
    </div>
  );
}

export default App;