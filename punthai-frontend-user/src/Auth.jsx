import { useState } from 'react';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import './Auth.css';
import logo from "./assets/logo.png"
import { API_URL } from './config';

const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  </svg>
);

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

function Auth({ onLoginSuccess, onClose }) {

  // 'login-user' | 'login-printshop' | 'register-user' | 'register-printshop'
  const [activeTab, setActiveTab] = useState('login-user');
  const [errorMessage, setErrorMessage] = useState('');

  // Login fields
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);

  // Register user fields
  const [showRegPass, setShowRegPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [regData, setRegData] = useState({
    user_name: '', password: '', confirm_password: '', email: '', first_name: '', last_name: ''
  });
  const [imgProfile, setImgProfile] = useState(null);

  // Register printshop fields
  const [showShopPass, setShowShopPass] = useState(false);
  const [showShopConfirmPass, setShowShopConfirmPass] = useState(false);
  const [shopData, setShopData] = useState({
    third_party_name: '', email: '', password: '', confirm_password: '', phone: ''
  });
  const [shopLogo, setShopLogo] = useState(null);

  const switchTab = (tab) => {
    setActiveTab(tab);
    setErrorMessage('');
  };

  const isLoginTab = activeTab.startsWith('login');

  // --- LOGIN ช่องเดียว (username หรือ email) — ระบบเช็คเองว่าเป็น user ทั่วไป หรือ โรงพิมพ์ ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    try {
      const res = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: loginUser, password: loginPass })
      });
      const data = await res.json();
      // data.user จะมี role: 'printshop' มาด้วยถ้าเป็นบัญชีโรงพิมพ์
      if (data.status === 'success') { onLoginSuccess(data.user); onClose(); }
      else setErrorMessage(data.message);
    } catch { setErrorMessage('เชื่อมต่อ Server ไม่ได้'); }
  };

  // --- REGISTER ผู้ใช้ทั่วไป ---
  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    if (regData.password !== regData.confirm_password)
      return setErrorMessage('รหัสผ่านทั้งสองช่องไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง');
    try {
      const formData = new FormData();
      formData.append('user_name', regData.user_name);
      formData.append('password', regData.password);
      formData.append('email', regData.email);
      formData.append('first_name', regData.first_name);
      formData.append('last_name', regData.last_name);
      if (imgProfile) formData.append('img_profile', imgProfile);

      const res = await fetch(`${API_URL}/api/register`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.status === 'success') {
        const loginRes = await fetch(`${API_URL}/api/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_name: regData.user_name, password: regData.password })
        });
        const loginData = await loginRes.json();
        if (loginData.status === 'success') { onLoginSuccess(loginData.user); onClose(); }
        else { setErrorMessage('สมัครสมาชิกสำเร็จ กรุณาล็อกอิน'); switchTab('login-user'); }
      } else setErrorMessage(data.message);
    } catch { setErrorMessage('เชื่อมต่อ Server ไม่ได้'); }
  };

  // --- REGISTER โรงพิมพ์ ---
  const handleRegisterPrintshop = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    if (shopData.password !== shopData.confirm_password)
      return setErrorMessage('รหัสผ่านทั้งสองช่องไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง');
    try {
      const formData = new FormData();
      formData.append('third_party_name', shopData.third_party_name);
      formData.append('email', shopData.email);
      formData.append('password', shopData.password);
      formData.append('phone', shopData.phone);
      if (shopLogo) formData.append('image_profile', shopLogo);

      const res = await fetch(`${API_URL}/api/third-party/register`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.status === 'success') {
        const loginRes = await fetch(`${API_URL}/api/third-party/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: shopData.email, password: shopData.password })
        });
        const loginData = await loginRes.json();
        if (loginData.status === 'success') { onLoginSuccess(loginData.user || { ...loginData.third_party, role: 'printshop' }); onClose(); }
        else { setErrorMessage('สมัครสำเร็จ กรุณาเข้าสู่ระบบ'); switchTab('login-user'); }
      } else setErrorMessage(data.message);
    } catch { setErrorMessage('เชื่อมต่อ Server ไม่ได้'); }
  };

  // --- GOOGLE LOGIN ---
  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setErrorMessage('');
      try {
        const res = await fetch(`${API_URL}/api/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: tokenResponse.access_token })
        });
        const data = await res.json();
        if (data.status === 'success') { onLoginSuccess(data.user); onClose(); }
        else setErrorMessage('เข้าสู่ระบบด้วย Google ไม่สำเร็จ');
      } catch { setErrorMessage('การเชื่อมต่อกับเซิร์ฟเวอร์ขัดข้อง'); }
    },
    onError: () => setErrorMessage('การเชื่อมต่อ Google ล้มเหลว'),
  });

  return (
      <div className="modal-overlay" onClick={(e) => { if (e.target.className === 'modal-overlay') onClose(); }}>
        <div className="auth-orb3" />
        <div className="auth-orb4" />
        <div className="modal-content" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
          <button className="close-btn" onClick={onClose}>&times;</button>

          <div className="logo-login">
            <img src={logo} alt="logo" className="logo-img" />
          </div>

          <h2 className="auth-title">
            {isLoginTab ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
          </h2>

          {/* Tab หลัก: Login / Register */}
          <div className="auth-tab-group">
            <button onClick={() => switchTab('login-user')} className={`auth-tab-btn ${isLoginTab ? 'active' : 'inactive'}`}>Login</button>
            <button onClick={() => switchTab('register-user')} className={`auth-tab-btn ${!isLoginTab ? 'active' : 'inactive'}`}>Register</button>
          </div>

          {/* Error */}
          {errorMessage && <div className="error-box">{errorMessage}</div>}

          {/* ===== LOGIN: ผู้ใช้ทั่วไป ===== */}
          {activeTab === 'login-user' && (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <input className="auth-input" type="text" placeholder="Username หรือ Email" value={loginUser} onChange={e => setLoginUser(e.target.value)} required />
              <div style={{ position: 'relative' }}>
                <input className="auth-input" type={showLoginPass ? "text" : "password"} placeholder="Password" value={loginPass} onChange={e => setLoginPass(e.target.value)} required />
                <button type="button" onClick={() => setShowLoginPass(!showLoginPass)} style={eyeButtonStyle}>
                  {showLoginPass ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              <div className="auth-divider">- OR -</div>
              <button type="button" className="btn-google" onClick={() => googleLogin()}>
                <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.08 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-3.59-13.46-8.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                เข้าสู่ระบบด้วย Google
              </button>
              <button type="submit" className="btn-primary" style={{ width: '100%' }}>เข้าสู่ระบบ</button>
            </form>
          )}

          {/* ===== REGISTER: ผู้ใช้ทั่วไป ===== */}
          {activeTab === 'register-user' && (
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input className="auth-input" type="text" placeholder="ชื่อจริง" onChange={e => setRegData({ ...regData, first_name: e.target.value })} required style={{ flex: 1 }} />
                <input className="auth-input" type="text" placeholder="นามสกุล" onChange={e => setRegData({ ...regData, last_name: e.target.value })} required style={{ flex: 1 }} />
              </div>
              <input className="auth-input" type="text" placeholder="Username" onChange={e => setRegData({ ...regData, user_name: e.target.value })} required />
              <input className="auth-input" type="email" placeholder="Email" onChange={e => setRegData({ ...regData, email: e.target.value })} required />
              <div style={{ position: 'relative' }}>
                <input className="auth-input" type={showRegPass ? "text" : "password"} placeholder="ตั้งรหัสผ่าน" onChange={e => setRegData({ ...regData, password: e.target.value })} required />
                <button type="button" onClick={() => setShowRegPass(!showRegPass)} style={eyeButtonStyle}>{showRegPass ? <EyeOffIcon /> : <EyeIcon />}</button>
              </div>
              <div style={{ position: 'relative' }}>
                <input className="auth-input" type={showConfirmPass ? "text" : "password"} placeholder="ยืนยันรหัสผ่าน" onChange={e => setRegData({ ...regData, confirm_password: e.target.value })} required />
                <button type="button" onClick={() => setShowConfirmPass(!showConfirmPass)} style={eyeButtonStyle}>{showConfirmPass ? <EyeOffIcon /> : <EyeIcon />}</button>
              </div>
              <label className="file-upload-label" htmlFor="img-profile-input">
                <div className="file-upload-zone">
                  <iconify-icon icon="mdi:image-plus-outline" width="28"></iconify-icon>
                  <span className="file-upload-main">อัปโหลดรูปโปรไฟล์</span>
                  <span className="file-upload-sub">PNG, JPG ขนาดไม่เกิน 5MB</span>
                </div>
                <input id="img-profile-input" type="file" accept="image/*" hidden onChange={e => setImgProfile(e.target.files[0])} />
              </label>
              <div className="auth-divider">- OR -</div>
              <button type="button" className="btn-google" onClick={() => googleLogin()}>
                <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.08 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-3.59-13.46-8.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                สมัครด้วย Google
              </button>
              <button type="submit" className="btn-primary" style={{ width: '100%' }}>ยืนยันการสมัคร</button>
              <div className="auth-divider" style={{ margin: '4px 0' }}>- หรือ -</div>
              <button
                type="button"
                className="btn-printshop-join"
                onClick={() => switchTab('register-printshop')}
              >
                <iconify-icon icon="lucide:printer" width="16"></iconify-icon> เข้าร่วมในฐานะโรงพิมพ์
              </button>
            </form>
          )}

          {/* ===== REGISTER: โรงพิมพ์ ===== */}
          {activeTab === 'register-printshop' && (
            <form onSubmit={handleRegisterPrintshop} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <button
                type="button"
                className="btn-back-user"
                onClick={() => switchTab('register-user')}
              >
                ← กลับไปหน้าสมัครสมาชิกทั่วไป
              </button>
              <input className="auth-input" type="text" placeholder="ชื่อโรงพิมพ์ / ชื่อร้าน" onChange={e => setShopData({ ...shopData, third_party_name: e.target.value })} required />
              <input className="auth-input" type="email" placeholder="Email" onChange={e => setShopData({ ...shopData, email: e.target.value })} required />
              <input className="auth-input" type="tel" placeholder="เบอร์โทรศัพท์" onChange={e => setShopData({ ...shopData, phone: e.target.value })} required />
              <div style={{ position: 'relative' }}>
                <input className="auth-input" type={showShopPass ? "text" : "password"} placeholder="ตั้งรหัสผ่าน" onChange={e => setShopData({ ...shopData, password: e.target.value })} required />
                <button type="button" onClick={() => setShowShopPass(!showShopPass)} style={eyeButtonStyle}>{showShopPass ? <EyeOffIcon /> : <EyeIcon />}</button>
              </div>
              <div style={{ position: 'relative' }}>
                <input className="auth-input" type={showShopConfirmPass ? "text" : "password"} placeholder="ยืนยันรหัสผ่าน" onChange={e => setShopData({ ...shopData, confirm_password: e.target.value })} required />
                <button type="button" onClick={() => setShowShopConfirmPass(!showShopConfirmPass)} style={eyeButtonStyle}>{showShopConfirmPass ? <EyeOffIcon /> : <EyeIcon />}</button>
              </div>
              <label className="file-upload-label" htmlFor="shop-logo-input">
                <div className="file-upload-zone">
                  <iconify-icon icon="mdi:store-outline" width="28"></iconify-icon>
                  <span className="file-upload-main">อัปโหลดโลโก้ร้าน</span>
                  <span className="file-upload-sub">PNG, JPG ขนาดไม่เกิน 5MB</span>
                </div>
                <input id="shop-logo-input" type="file" accept="image/*" hidden onChange={e => setShopLogo(e.target.files[0])} />
              </label>
              <button type="submit" className="btn-primary" style={{ width: '100%' }}>ยืนยันการสมัครโรงพิมพ์</button>
            </form>
          )}

        </div>
      </div>
  );
}

export default function AuthWithProvider(props) {
  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'placeholder';
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <Auth {...props} />
    </GoogleOAuthProvider>
  );
}