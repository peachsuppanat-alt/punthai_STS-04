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
import { Profile } from './Profile';
import { EditProfile } from './EditProfile';
import MarketPlanning from './MarketPlanning';
import ContentOnline from './ContentOnline';

// หน้าชั่วคราว
const Shopping = () => <h2 style={{marginTop: '100px', textAlign: 'center'}}>Shopping Page</h2>;
const About = () => <h2 style={{marginTop: '100px', textAlign: 'center'}}>About Page</h2>;

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
                      location.pathname === '/profile';




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
        <Route path="/create-concept" element={<CreateConcept />} />
        <Route path="/create-logo" element={<CreateLogo />} />
        <Route path="/result-logo" element={<ResultLogo />} />
        <Route path="/result" element={<Result />} />
        <Route path="/product" element={<Product />} /> 
        <Route path="/profile" element={<Profile user={user} />} />
        <Route path="/edit_profile" element={<EditProfile user={user} setUser={setUser} />} />
        <Route path="/market-planning" element={<MarketPlanning user={user} />} />
        <Route path="/content-online" element={<ContentOnline user={user} />} />
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