import { useState } from 'react';
import './Auth.css'; // <-- เพิ่มบรรทัดนี้เพื่อให้ Popup ทำงาน

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

      // 2. ส่งข้อมูลไปที่ Backend
      const res = await fetch('http://localhost:3000/api/register', {
        method: 'POST',
        // 🚨 สำคัญมาก: ห้ามใส่ headers { 'Content-Type': 'application/json' } เด็ดขาด!
        body: formData 
      });
      // 👇 2. เพิ่มโค้ดส่วนนี้เพื่อทำการ "เข้าสู่ระบบอัตโนมัติ" ทันที 👇
        const loginRes = await fetch('http://localhost:3000/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // ส่งข้อมูลที่เพิ่งกรอกไปให้ API Login ทันที (เช็คให้ตรงกับ API Login ของคุณว่าใช้อะไรส่งไป)
          body: JSON.stringify({ email: email, password: password }) 
        });
        const loginData = await loginRes.json();

        if (loginData.status === 'success') {
            onLoginSuccess(loginData.user); // อัปเดตข้อมูล user ขึ้นระบบ (App.jsx)
            onClose();                      // ปิด Popup
        } else {
            // เผื่อกรณีผิดพลาด จะได้ให้ผู้ใช้ไปล็อกอินเอง
            alert('เข้าสู่ระบบอัตโนมัติไม่สำเร็จ กรุณาล็อกอินด้วยตัวเอง');
            // setIsLogin(true); // ค่อยให้สลับไปหน้าล็อกอินตรงนี้
        }
      const data = await res.json();
      if (data.status === 'success') {
        alert('✅ สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ');
        setIsLoginMode(true);
      } else {
        alert('❌ ' + data.message);
      }
    } catch (err) {
      console.error(err);
      alert('เชื่อมต่อ Server ไม่ได้');
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => {
      // คลิกพื้นที่ว่างรอบๆ เพื่อปิด
      if (e.target.className === 'modal-overlay') onClose();
    }}>
      <div className="modal-content">
        {/* ปุ่ม X จะย้ายไปอยู่มุมขวาบนของกล่องขาวแล้ว */}
        <button className="close-btn" onClick={onClose}>&times;</button>

        <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#333' }}>
          {isLoginMode ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
        </h2>

        {/* ปุ่มสลับโหมด */}
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