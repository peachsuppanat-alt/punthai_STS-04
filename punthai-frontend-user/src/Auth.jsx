import { useState } from 'react';
import './Auth.css';

function Auth({ onLoginSuccess, onClose }) {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  
  // State สำหรับ Register
  const [regData, setRegData] = useState({ user_name: '', password: '', email: '' });
  const [imgProfile, setImgProfile] = useState(null);

  // --- LOGIN FUNCTION ---
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:3000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_name: loginUser, password: loginPass })
      });
      const data = await res.json();
      if (data.status === 'success') {
        alert(' เข้าสู่ระบบสำเร็จ!');
        onLoginSuccess(data.user); // ส่ง user กลับไปที่ App.jsx
        onClose(); // ปิด Popup ทันที
      } else {
        alert('ไม่สำเร็จ  ' + data.message);
      }
    } catch (err) { alert('เชื่อมต่อ Server ไม่ได้'); }
  };

  // --- REGISTER FUNCTION ---
  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      // 1. แพ็กข้อมูลลง FormData
      const formData = new FormData();
      formData.append('user_name', regData.user_name);
      formData.append('password', regData.password);
      formData.append('email', regData.email);
      
      if (imgProfile) {
        formData.append('img_profile', imgProfile); 
      }

      // 2. ส่งข้อมูลไปที่ Backend เพื่อสมัครสมาชิก
      const res = await fetch('http://localhost:3000/api/register', {
        method: 'POST',
        body: formData 
      });
      
      // 3. รออ่านผลลัพธ์จากการสมัครสมาชิกก่อน!
      const data = await res.json();

      if (data.status === 'success') {
        // 👇 4. ถ้าระบบบอกว่า "สมัครสำเร็จ" ค่อยทำการ "เข้าสู่ระบบอัตโนมัติ" 👇
        const loginRes = await fetch('http://localhost:3000/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // 🚨 สำคัญ: ดึงค่าจาก regData มาใช้ และส่ง user_name เหมือนที่ระบบล็อกอินต้องการ
          body: JSON.stringify({ user_name: regData.user_name, password: regData.password }) 
        });
        const loginData = await loginRes.json();

        if (loginData.status === 'success') {
            alert('✅ สมัครสมาชิกและเข้าสู่ระบบอัตโนมัติสำเร็จ!');
            onLoginSuccess(loginData.user); // อัปเดตข้อมูล user ขึ้นระบบ (App.jsx)
            onClose();                      // ปิด Popup
        } else {
            // กรณีล็อกอินออโต้ไม่ติด (ซึ่งแทบไม่น่าเกิด)
            alert('สมัครสมาชิกสำเร็จ แต่ระบบเข้าสู่ระบบอัตโนมัติขัดข้อง กรุณาล็อกอินด้วยตัวเอง');
            setIsLoginMode(true); // สลับไปหน้าล็อกอินให้ผู้ใช้กรอกเอง
        }

      } else {
        // กรณีสมัครสมาชิกไม่สำเร็จ (เช่น ชื่อซ้ำ, อีเมลซ้ำ)
        alert('❌ สมัครไม่สำเร็จ: ' + data.message);
      }
    } catch (err) {
      console.error("Register Error:", err);
      alert('เชื่อมต่อ Server ไม่ได้');
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => {
      // คลิกพื้นที่ว่างรอบๆ เพื่อปิด
      if (e.target.className === 'modal-overlay') onClose();
    }}>
      <div className="modal-content">
        <button className="close-btn" onClick={onClose}>&times;</button>

        <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#333' }}>
          {isLoginMode ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
        </h2>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
          <button onClick={() => setIsLoginMode(true)} style={{ background: isLoginMode ? '#D35325' : '#eee', color: isLoginMode ? '#fff' : '#333', border: 'none', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer' }}>Login</button>
          <button onClick={() => setIsLoginMode(false)} style={{ background: !isLoginMode ? '#D35325' : '#eee', color: !isLoginMode ? '#fff' : '#333', border: 'none', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer' }}>Register</button>
        </div>

        {isLoginMode ? (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <input type="text" placeholder="Username" value={loginUser} onChange={e => setLoginUser(e.target.value)} required style={inputStyle}/>
            <input type="password" placeholder="Password" value={loginPass} onChange={e => setLoginPass(e.target.value)} required style={inputStyle}/>
            <button type="submit" className="btn-primary" style={{ width: '100%' }}>เข้าสู่ระบบ</button>
          </form>
        ) : (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <input type="text" placeholder="Username" onChange={e => setRegData({...regData, user_name: e.target.value})} required style={inputStyle}/>
            <input type="password" placeholder="Password" onChange={e => setRegData({...regData, password: e.target.value})} required style={inputStyle}/>
            <input type="email" placeholder="Email" onChange={e => setRegData({...regData, email: e.target.value})} required style={inputStyle}/>
            
            <div style={{ textAlign: 'left', fontSize: '14px', color: '#666' }}>
              รูปโปรไฟล์: <input type="file" accept="image/*" onChange={e => setImgProfile(e.target.files[0])} style={{ marginTop: '5px' }} />
            </div>
            <button type="submit" className="btn-primary" style={{ width: '100%' }}>ยืนยันการสมัคร</button>
          </form>
        )}
      </div>
    </div>
  );
}

const inputStyle = { padding: '12px', borderRadius: '8px', border: '1px solid #ddd', outline: 'none' };

export default Auth;