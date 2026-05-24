import React, { useState, useEffect } from 'react';
import { Users, UserCheck, Crown, Activity } from 'lucide-react';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';
import { getUserCount, getActiveUserCount, getProUserCount, getTokenUsage, getTextGeneration, getImageGeneration } from '../../api/adminApi';
import StatCard from '../../components/common/StatCard';
import ChartCard from '../../components/common/ChartCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import styles from './HomePage.module.css';

const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
};

const IMAGE_COLORS = ['#d35325', '#82622a', '#d0b555', '#919a4a', '#2563eb'];

export default function HomePage() {
  const [stats, setStats] = useState({ total: 0, active: 0, pro: 0 });
  const [tokenData, setTokenData] = useState([]);
  const [textData, setTextData] = useState([]);
  const [imageData, setImageData] = useState({ data: [], features: [] });
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    loadCharts();
  }, [days]);

  const loadStats = async () => {
    try {
      const [userRes, activeRes, proRes] = await Promise.all([
        getUserCount(), getActiveUserCount(), getProUserCount()
      ]);
      setStats({
        total: userRes.total || 0,
        active: activeRes.active || 0,
        pro: proRes.proUsers || 0,
      });
    } catch (err) {
      console.error(err);
    }
  };

  const loadCharts = async () => {
    setLoading(true);
    try {
      const [tokenRes, textRes, imageRes] = await Promise.all([
        getTokenUsage(days), getTextGeneration(days), getImageGeneration(days)
      ]);
      setTokenData((tokenRes.data || []).map(d => ({ ...d, date: formatDate(d.date) })));
      setTextData((textRes.data || []).map(d => ({ ...d, date: formatDate(d.date) })));
      setImageData({
        data: (imageRes.data || []).map(d => ({ ...d, date: formatDate(d.date) })),
        features: imageRes.features || [],
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className={styles.statGrid}>
        <StatCard icon={Users} label="ผู้ใช้ทั้งหมด" value={stats.total} unit="คน" color="var(--color-primary)" />
        <StatCard icon={UserCheck} label="ผู้ใช้ Active (30 นาที)" value={stats.active} unit="คน" color="var(--color-green)" />
        <StatCard icon={Crown} label="สมาชิก PRO" value={stats.pro} unit="คน" color="var(--color-gold)" percent={stats.total ? (stats.pro / stats.total * 100) : 0} />
      </div>

      {loading ? <LoadingSpinner /> : (
        <>
          <div className={styles.chartGrid}>
            <ChartCard title="ปริมาณการใช้งาน Token ทั้งหมด" timeRange={days} onTimeRangeChange={setDays}>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={tokenData}>
                  <defs>
                    <linearGradient id="tokenGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#d35325" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#d35325" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="count" name="จำนวนครั้ง" stroke="#d35325" fill="url(#tokenGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className={styles.chartRow}>
            <ChartCard title="อัตราการสร้างข้อความ (Gemini)" timeRange={days} onTimeRangeChange={setDays}>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={textData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" name="ข้อความ" stroke="#919a4a" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="อัตราการสร้างรูปภาพ (แยกตาม Model)" timeRange={days} onTimeRangeChange={setDays}>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={imageData.data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  {imageData.features.map((feature, i) => (
                    <Line
                      key={feature}
                      type="monotone"
                      dataKey={feature}
                      name={feature}
                      stroke={IMAGE_COLORS[i % IMAGE_COLORS.length]}
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}
