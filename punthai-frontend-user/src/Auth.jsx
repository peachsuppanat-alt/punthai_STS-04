import { useState } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import './Auth.css';
import logo from "./assets/logo.png"
import { API_URL } from './config';

// --- ไอคอนตาเปิด (SVG) ---
const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  </svg>
);

// --- ไอคอนตาปิดแบบมีเส้นคาด (SVG) ---
const EyeOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
    <line x1="1" y1="1" x2="23" y2="23"></line>
  </svg>
);

const eyeButtonStyle = {
  position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
  background: 'none', border: 'none', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0'
};

const inputStyle = { padding: '12px', borderRadius: '8px', border: '1px solid #ddd', outline: 'none' };

function Auth({ onLoginSuccess, onClose }) {
  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // 🟢 เพิ่ม State สำหรับเก็บข้อความแจ้งเตือน (Error Message) แทน Alert
  const [errorMessage, setErrorMessage] = useState('');

  const [showLoginPass, setShowLoginPass] = useState(false);
  const [showRegPass, setShowRegPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const [regData, setRegData] = useState({
    user_name: '', password: '', confirm_password: '', email: '', first_name: '', last_name: ''
  });
  const [imgProfile, setImgProfile] = useState(null);

  // ฟังก์ชันสลับโหมด พร้อมเคลียร์ข้อความ Error
  const handleSwitchMode = (mode) => {
    setIsLoginMode(mode);
    setErrorMessage('');
  };

  // --- LOGIN FUNCTION ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage(''); // เคลียร์ Error ก่อนเริ่ม
    try {
      const res = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_name: loginUser, password: loginPass })
      });
      const data = await res.json();
      if (data.status === 'success') {
        onLoginSuccess(data.user);
        onClose(); // ปิด Modal ไปเลยโดยไม่ต้องมี Alert
      } else {
        setErrorMessage(data.message); // แสดงข้อความ Error สีแดงแทน
      }
    } catch (err) {
      setErrorMessage('เชื่อมต่อ Server ไม่ได้');
    }
  };

  // --- REGISTER FUNCTION ---
  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (regData.password !== regData.confirm_password) {
      return setErrorMessage('รหัสผ่านทั้งสองช่องไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง');
    }

    try {
      const formData = new FormData();
      formData.append('user_name', regData.user_name);
      formData.append('password', regData.password);
      formData.append('email', regData.email);
      formData.append('first_name', regData.first_name);
      formData.append('last_name', regData.last_name);

      if (imgProfile) {
        formData.append('img_profile', imgProfile);
      }

      const res = await fetch(`${API_URL}/api/register`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (data.status === 'success') {
        // แอบทำการ Login ให้อัตโนมัติเมื่อสมัครเสร็จ
        const loginRes = await fetch(`${API_URL}/api/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_name: regData.user_name, password: regData.password })
        });
        const loginData = await loginRes.json();

        if (loginData.status === 'success') {
          onLoginSuccess(loginData.user);
          onClose(); // ปิด Modal เงียบๆ
        } else {
          setErrorMessage('สมัครสมาชิกสำเร็จ กรุณาล็อกอิน');
          setIsLoginMode(true);
        }
      } else {
        setErrorMessage(data.message);
      }
    } catch (err) {
      setErrorMessage('เชื่อมต่อ Server ไม่ได้');
    }
  };

  // --- GOOGLE LOGIN SUCCESS HANDLER ---
  const handleGoogleSuccess = async (credentialResponse) => {
    setErrorMessage('');
    try {
      const res = await fetch(`${API_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: credentialResponse.credential })
      });
      const data = await res.json();

      if (data.status === 'success') {
        onLoginSuccess(data.user);
        onClose(); // ปิด Modal ไปเลย
      } else {
        setErrorMessage('เข้าสู่ระบบด้วย Google ไม่สำเร็จ');
      }
    } catch (error) {
      setErrorMessage('การเชื่อมต่อกับเซิร์ฟเวอร์ขัดข้อง');
    }
  };

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID} >
      <div className="modal-overlay" onClick={(e) => {
        if (e.target.className === 'modal-overlay') onClose();
      }}>
        <div className="modal-content" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
          <button className="close-btn" onClick={onClose}>&times;</button>
          <div className="logo-login" >
            <img src={logo} alt="logo" className="logo-img" />
          </div>
          <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#333' }}>
            {isLoginMode ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
          </h2>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
            <button onClick={() => handleSwitchMode(true)} style={{ background: isLoginMode ? '#D35325' : '#eee', color: isLoginMode ? '#fff' : '#333', border: 'none', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer' }}>Login</button>
            <button onClick={() => handleSwitchMode(false)} style={{ background: !isLoginMode ? '#D35325' : '#eee', color: !isLoginMode ? '#fff' : '#333', border: 'none', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer' }}>Register</button>
          </div>

          {/* 🔴 ส่วนแสดง Error แบบ Inline สีแดง (ถ้ามี Error จะโชว์ตรงนี้) */}
          {errorMessage && (
            <div style={{ color: '#D35325', textAlign: 'center', marginBottom: '15px', fontSize: '14px', backgroundColor: '#FDF2F0', padding: '8px', borderRadius: '5px' }}>
              {errorMessage}
            </div>
          )}
            

          

          {isLoginMode ? (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <input type="text" placeholder="Username" value={loginUser} onChange={e => setLoginUser(e.target.value)} required style={inputStyle} />
              <div style={{ position: 'relative' }}>
                <input type={showLoginPass ? "text" : "password"} placeholder="Password" value={loginPass} onChange={e => setLoginPass(e.target.value)} required style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
                <button type="button" onClick={() => setShowLoginPass(!showLoginPass)} style={eyeButtonStyle}>
                  {showLoginPass ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              <div style={{ textAlign: 'center', margin: '5px 0', color: '#aaa' , fontSize: '14px'}}>- OR -</div>
          {/* ส่วนเชื่อมต่อบัญชี Google */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setErrorMessage('การเชื่อมต่อ Google ล้มเหลว')}
              text={isLoginMode ? "signin_with" : "signup_with"}
            />
          </div>
              <button type="submit" className="btn-primary" style={{ width: '100%' }}>เข้าสู่ระบบ</button>
            </form>
          ) : (
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="text" placeholder="ชื่อจริง" onChange={e => setRegData({ ...regData, first_name: e.target.value })} required style={{ ...inputStyle, flex: 1 }} />
                <input type="text" placeholder="นามสกุล" onChange={e => setRegData({ ...regData, last_name: e.target.value })} required style={{ ...inputStyle, flex: 1 }} />
              </div>

              <input type="text" placeholder="Username" onChange={e => setRegData({ ...regData, user_name: e.target.value })} required style={inputStyle} />
              <input type="email" placeholder="Email" onChange={e => setRegData({ ...regData, email: e.target.value })} required style={inputStyle} />

              <div style={{ position: 'relative' }}>
                <input type={showRegPass ? "text" : "password"} placeholder="ตั้งรหัสผ่าน" onChange={e => setRegData({ ...regData, password: e.target.value })} required style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
                <button type="button" onClick={() => setShowRegPass(!showRegPass)} style={eyeButtonStyle}>
                  {showRegPass ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>

              <div style={{ position: 'relative' }}>
                <input type={showConfirmPass ? "text" : "password"} placeholder="ยืนยันรหัสผ่าน" onChange={e => setRegData({ ...regData, confirm_password: e.target.value })} required style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
                <button type="button" onClick={() => setShowConfirmPass(!showConfirmPass)} style={eyeButtonStyle}>
                  {showConfirmPass ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>

              <div style={{ textAlign: 'left', fontSize: '14px', color: '#666' }}>
                
                รูปโปรไฟล์: <input type="file" accept="image/*" onChange={e => setImgProfile(e.target.files[0])} style={{ margin:'10px 10px',  }} />
              </div>
              <div style={{ textAlign: 'center', margin: '5px 0', color: '#aaa', fontSize: '14px' }}>- OR -</div>
          {/* ส่วนเชื่อมต่อบัญชี Google */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setErrorMessage('การเชื่อมต่อ Google ล้มเหลว')}
              text={isLoginMode ? "signin_with" : "signup_with"}
            />
          </div>
              <button type="submit" className="btn-primary" style={{ width: '100%' }}>ยืนยันการสมัคร</button>
            </form>
          )}
          
        </div>
      </div>
    </GoogleOAuthProvider>
  );
}

export default Auth;