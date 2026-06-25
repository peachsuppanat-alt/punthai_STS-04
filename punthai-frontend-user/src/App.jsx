import { useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import './App.css';

import Navbar from './Navbar';
import Home from './Home';
import Auth from './Auth'; 
import { MyProject } from './project_feature/MyProject';
import { Product } from './project_feature/Product';
import { BrandDNA } from './project_feature/BrandDNA'; 
import { CreateConcept } from './project_feature/CreateConcept';
import  { CreateLogo }  from './project_feature/CreateLogo';
import { ResultLogo } from './project_feature/ResultLogo';
import Result from './project_feature/Result';
import PackagePage from './project_feature/PackagePage';
import PrintshopProfile from './PrintshopProfile';
import { Profile } from './Profile';
import { EditProfile } from './EditProfile';
import MarketPlanning from './MarketPlanning';
import ContentOnline from './ContentOnline';
import Subscription from './Subscription';
import { Settings } from './Settings';
import About from './About';





function App() {
  const [user, setUser] = useState(null);       // (null = ยังไม่ Login)
  const [showAuth, setShowAuth] = useState(false); //  Popup

  // ดึงข้อมูล URL 
  const location = useLocation();

  // isProjectPage เพื่อซ่อน Navbar ตัวหลัก
  const isProjectPage = location.pathname === '/project' || 
                      location.pathname === '/your-projects' || 
                      location.pathname === '/brand-dna' || 
                      location.pathname === '/create-concept' || 
                      location.pathname === '/create-logo' ||
                      location.pathname === '/result'||
                      location.pathname === '/result-logo'||
                      location.pathname === '/profile' ||
                      location.pathname === '/edit_profile' ||
                      location.pathname === '/my-package' ||
                      location.pathname === '/settings';




  return (
    <div>
      {/* 4. ใส่เงื่อนไขครอบ Navbar ไว้: จะแสดงก็ต่อเมื่อ ไม่ใช่หน้า Project หรือ YourProjects */}
      {!isProjectPage && (
        <Navbar 
          user={user} 
          onOpenLogin={() => setShowAuth(true)} 
          onLogout={() => { setUser(null); localStorage.removeItem('user'); }}
        />
      )}

      <Routes>
        <Route path="/" element={<Home user={user} />} />
        <Route path="/project" element={<MyProject />} />
        <Route path="/your-projects" element={<MyProject />} />
        <Route path="/brand-dna" element={<BrandDNA />} />
        <Route path="/create-concept" element={<CreateConcept />} />
        <Route path="/create-logo" element={<CreateLogo />} />
        <Route path="/result-logo" element={<ResultLogo />} />
        <Route path="/result" element={<Result />} />
        <Route path="/package" element={<PackagePage />} />
        <Route path="/my-package" element={<PrintshopProfile />} />
        <Route path="/printshop/:thirdPartyId" element={<PrintshopProfile />} />
        <Route path="/product" element={<Product />} />
        <Route path="/profile" element={<Profile user={user} setUser={setUser} />} />
        <Route path="/edit_profile" element={<EditProfile user={user} setUser={setUser} />} />
        <Route path="/market-planning" element={<MarketPlanning user={user} />} />
        <Route path="/content-online" element={<ContentOnline user={user} />} />
        <Route path="/subscription" element={<Subscription user={user} setUser={setUser} />} />
        <Route path="/settings" element={<Settings user={user} setUser={setUser} />} />
        <Route path="/about" element={<About />} />
      </Routes>


      {/* แสดง Popup เมื่อ showAuth เป็น true */}
      {showAuth && (
        <Auth 
          onLoginSuccess={(userData) => { setUser(userData); localStorage.setItem('user', JSON.stringify(userData)); }}
          onClose={() => setShowAuth(false)} 
        />
      )}
    </div>
  );
}

export default App;