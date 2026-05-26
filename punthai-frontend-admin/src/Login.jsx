import React, { useState } from 'react';
import axios from 'axios';
import client from './api/client';
import { Lock } from 'lucide-react';

export default function Login({ setIsAdmin }) {
  const [formData, setFormData] = useState({ name_admin: '', password: '', key_password: '' });
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await client.post('/api/admin/login', formData);
      if (res.data.status === 'success') {
        localStorage.setItem('adminData', JSON.stringify(res.data.admin));
        setIsAdmin(true);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f5f5f5' }}>
      <div style={{ background: '#fff', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <Lock size={48} color="#d3542b" style={{ margin: '0 auto' }} />
          <h2 style={{ color: '#333', marginTop: '10px' }}>Admin Portal</h2>
        </div>
        
        {error && <div style={{ color: 'red', background: '#fee', padding: '10px', borderRadius: '6px', marginBottom: '15px', textAlign: 'center', fontSize: '14px' }}>{error}</div>}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <input 
            type="text" placeholder="Username (name_admin)" required
            value={formData.name_admin} onChange={(e) => setFormData({...formData, name_admin: e.target.value})}
            style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }}
          />
          <input 
            type="password" placeholder="Password" required
            value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})}
            style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }}
          />
          <input 
            type="password" placeholder="Admin Key (key_password)" required
            value={formData.key_password} onChange={(e) => setFormData({...formData, key_password: e.target.value})}
            style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }}
          />
          <button type="submit" style={{ padding: '12px', background: '#d3542b', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', marginTop: '10px' }}>
            เข้าสู่ระบบ
          </button>
        </form>
      </div>
    </div>
  );
}