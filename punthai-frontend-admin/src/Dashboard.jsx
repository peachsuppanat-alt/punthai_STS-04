import React, { useState, useEffect } from 'react';
import axios from 'axios';
import client from './api/client';
import { Users, LogOut, BarChart2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function Dashboard({ setIsAdmin }) {
  const [userCount, setUserCount] = useState(0);
  const [days, setDays] = useState(7);
  const [geminiData, setGeminiData] = useState([]);
  const [dalleData, setDalleData] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, [days]);

  const fetchDashboardData = async () => {
    try {
      // ดึงจำนวน User
      const userRes = await client.get('/api/admin/users/count');
      setUserCount(userRes.data.total);

      // ดึงข้อมูลกราฟ
      const statsRes = await client.get(`/api/admin/stats/api-usage?days=${days}`);
      
      // แปลงวันที่ให้อ่านง่ายขึ้น
      const formatData = (data) => data.map(item => ({
        ...item,
        date: new Date(item.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
      }));

      setGeminiData(formatData(statsRes.data.gemini));
      setDalleData(formatData(statsRes.data.dalle));
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminData');
    setIsAdmin(false);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8f9fa' }}>
      
      {/* Sidebar */}
      <aside style={{ width: '250px', background: '#fff', borderRight: '1px solid #eee', padding: '20px', display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ color: '#d3542b', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '2px solid #f0f0f0', paddingBottom: '15px' }}>
          <BarChart2 /> Punthai Admin
        </h2>
        <nav style={{ flex: 1, marginTop: '20px' }}>
          <div style={{ padding: '12px 15px', background: '#d3542b', color: '#ffffff', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            Dashboard Overview
          </div>
        </nav>
        <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: '#ffeded', color: '#dc3545', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
          <LogOut size={18} /> ออกจากระบบ
        </button>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '30px' }}>
        <h1 style={{color : '#000'}}>Dashboard Overview</h1>
        
        {/* Card แสดง User (ข้อ 2.1) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginTop: '20px' }}>
          <div style={{ background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '20px', cursor: 'pointer', transition: '0.2s' }} 
               onClick={() => alert('เตรียมทำหน้ารายละเอียด User เร็วๆ นี้!')}>
            <div style={{ background: '#e0f2fe', padding: '15px', borderRadius: '50%', color: '#0284c7' }}>
              <Users size={32} />
            </div>
            <div>
              <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>ผู้ใช้งานทั้งหมด</p>
              <h2 style={{ margin: 0, color: '#333', fontSize: '32px' }}>{userCount} <span style={{fontSize:'16px', fontWeight:'normal', color:'#888'}}>บัญชี</span></h2>
            </div>
          </div>
        </div>

        {/* กราฟสถิติ API (ข้อ 2.2) */}
        <div style={{ marginTop: '40px', background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0 }}>สถิติการเรียกใช้ AI (API Usage)</h3>
            <select value={days} onChange={(e) => setDays(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #ddd', outline: 'none' }}>
              <option value={1}>วันนี้ (1 วัน)</option>
              <option value={7}>ย้อนหลัง 7 วัน</option>
              <option value={30}>ย้อนหลัง 1 เดือน</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
            {/* กราฟ Gemini */}
            <div>
              <h4 style={{ color: '#059669', textAlign: 'center' }}>Gemini (ข้อความ/DNA)</h4>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={geminiData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{fontSize: 12}} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" name="จำนวนครั้ง" stroke="#10b981" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* กราฟ DALL-E 3 */}
            <div>
              <h4 style={{ color: '#d3542b', textAlign: 'center' }}>DALL-E 3 (สร้างรูปภาพ)</h4>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dalleData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{fontSize: 12}} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" name="จำนวนครั้ง" stroke="#d3542b" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}