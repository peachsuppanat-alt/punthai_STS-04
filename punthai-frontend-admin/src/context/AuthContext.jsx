import React, { createContext, useContext, useState, useEffect } from 'react';
import { loginAdmin } from '../api/adminApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem('adminData');
    if (raw) {
      try {
        setAdmin(JSON.parse(raw));
      } catch {
        localStorage.removeItem('adminData');
      }
    }
    setLoading(false);
  }, []);

  const login = async (formData) => {
    const res = await loginAdmin(formData);
    if (res.status === 'success') {
      localStorage.setItem('adminData', JSON.stringify(res.admin));
      setAdmin(res.admin);
    }
    return res;
  };

  const logout = () => {
    localStorage.removeItem('adminData');
    setAdmin(null);
  };

  if (loading) return null;

  return (
    <AuthContext.Provider value={{ admin, login, logout, isAuthenticated: !!admin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
