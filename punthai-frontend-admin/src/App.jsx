import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import Dashboard from './Dashboard';

function App() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // เช็คว่าเคยล็อคอิน Admin ไว้ไหม
    const adminSession = localStorage.getItem('adminData');
    if (adminSession) setIsAdmin(true);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* หน้า Login */}
        <Route path="/login" element={!isAdmin ? <Login setIsAdmin={setIsAdmin} /> : <Navigate to="/" />} />
        
        {/* หน้า Dashboard (ถ้ายังไม่ล็อคอิน ให้เด้งไป Login) */}
        <Route path="/" element={isAdmin ? <Dashboard setIsAdmin={setIsAdmin} /> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;