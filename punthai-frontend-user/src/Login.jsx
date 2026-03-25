import { useState } from 'react';

function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setStatus('กำลังตรวจสอบ...');

    try {
      // ยิงไปหา Backend ที่พอร์ต 3000
      const response = await fetch('http://localhost:3000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      
      if (data.status === 'success') {
        setStatus('✅ เข้าสู่ระบบสำเร็จ!');
        onLoginSuccess(data.user); // แจ้ง App.jsx ว่า Login ผ่านแล้ว
      } else {
        setStatus(`❌ ${data.message}`);
      }
    } catch (error) {
      console.error(error);
      setStatus('❌ เชื่อมต่อ Server ไม่ได้ (เปิด node server.js หรือยัง?)');
    }
  };

  return (
    <div className="card" style={{ border: '1px solid #ccc', padding: '20px', maxWidth: '300px', margin: 'auto' }}>
      <h2>เข้าสู่ระบบ</h2>
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <input 
          type="text" 
          placeholder="Username (admin)" 
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{ padding: '10px' }}
        />
        <input 
          type="password" 
          placeholder="Password (1234)" 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: '10px' }}
        />
        <button type="submit">Login</button>
      </form>
      <p style={{ marginTop: '10px', color: status.includes('❌') ? 'red' : 'green' }}>{status}</p>
    </div>
  );
}

export default Login;