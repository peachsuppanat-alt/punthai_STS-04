import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';
import { getApiCalls, getCreditConsumption, getTopConsumers, getFeatureUsage, getTokenUsage } from '../../api/adminApi';
import ChartCard from '../../components/common/ChartCard';
import DataTable from '../../components/common/DataTable';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import styles from './ApiTokenDashboard.module.css';

const FEATURE_COLORS = ['#d35325', '#82622a', '#d0b555', '#919a4a', '#2563eb', '#7c3aed', '#0891b2'];

const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });

export default function ApiTokenDashboard() {
  const [days, setDays] = useState(7);
  const [tokenData, setTokenData] = useState([]);
  const [apiCalls, setApiCalls] = useState([]);
  const [creditData, setCreditData] = useState([]);
  const [featureData, setFeatureData] = useState([]);
  const [topConsumers, setTopConsumers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [days]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tokenRes, apiRes, creditRes, featureRes, topRes] = await Promise.allSettled([
        getTokenUsage(days), getApiCalls(days), getCreditConsumption(days),
        getFeatureUsage(days), getTopConsumers(10)
      ]);
      if (tokenRes.status === 'fulfilled') setTokenData((tokenRes.value.data || []).map(d => ({ ...d, date: formatDate(d.date) })));
      if (apiRes.status === 'fulfilled') setApiCalls(apiRes.value.data || []);
      if (creditRes.status === 'fulfilled') setCreditData((creditRes.value.data || []).map(d => ({ ...d, date: formatDate(d.date) })));
      if (featureRes.status === 'fulfilled') setFeatureData(featureRes.value.data || []);
      if (topRes.status === 'fulfilled') setTopConsumers(topRes.value.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const consumerColumns = [
    { key: 'user_name', label: 'ชื่อผู้ใช้', sortable: true },
    { key: 'email', label: 'อีเมล' },
    { key: 'subscription_status', label: 'แพ็คเกจ' },
    { key: 'api_calls', label: 'API Calls', sortable: true },
  ];

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className={styles.grid}>
        <div className={styles.full}>
          <ChartCard title="ปริมาณ Token Usage รวม" timeRange={days} onTimeRangeChange={setDays}>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={tokenData}>
                <defs>
                  <linearGradient id="tokenGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d35325" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#d35325" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Area type="monotone" dataKey="count" name="จำนวนครั้ง" stroke="#d35325" fill="url(#tokenGrad2)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <ChartCard title="API Calls แยกตามประเภท">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={apiCalls} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
              <XAxis type="number" />
              <YAxis dataKey="action_type" type="category" tick={{ fontSize: 11 }} width={140} />
              <Tooltip />
              <Bar dataKey="count" name="จำนวน" fill="#82622a" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="การใช้งานแยกตาม Feature">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={featureData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="feature" tick={{ fontSize: 11, angle: -20 }} height={50} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" name="จำนวน" radius={[4, 4, 0, 0]}>
                {featureData.map((_, i) => (
                  <Cell key={i} fill={FEATURE_COLORS[i % FEATURE_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <DataTable
        title="ผู้ใช้ที่ใช้ API มากที่สุด (Top 10)"
        columns={consumerColumns}
        data={topConsumers}
      />
    </div>
  );
}
