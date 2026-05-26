import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.png';
import styles from './Login.module.css';

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const [formData, setFormData] = useState({ name_admin: '', password: '', key_password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(formData);
    } catch (err) {
      setError(err.response?.data?.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field) => (e) =>
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <div className={styles.container}>
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <img src={logo} alt="Punthai Logo" className={styles.logo} />
          <h1 className={styles.title}>Punthai Admin</h1>
          <p className={styles.subtitle}>เข้าสู่ระบบเพื่อจัดการแพลตฟอร์ม</p>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>ชื่อผู้ใช้</label>
            <input
              className={styles.input}
              type="text"
              placeholder="Username"
              required
              value={formData.name_admin}
              onChange={handleChange('name_admin')}
            />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.label}>รหัสผ่าน</label>
            <input
              className={styles.input}
              type="password"
              placeholder="Password"
              required
              value={formData.password}
              onChange={handleChange('password')}
            />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Admin Key</label>
            <input
              className={styles.input}
              type="password"
              placeholder="Admin Key"
              required
              value={formData.key_password}
              onChange={handleChange('key_password')}
            />
          </div>
          <button className={styles.submitBtn} type="submit" disabled={loading}>
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
      </div>
    </div>
    </div>
  );
}
