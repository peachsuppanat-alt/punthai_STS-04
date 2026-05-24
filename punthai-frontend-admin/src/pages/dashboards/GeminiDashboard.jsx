import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie
} from 'recharts';
import { getGeminiSummary, getGeminiTimeline, getGeminiByModel, getGeminiByFeature, getGeminiRecentLogs } from '../../api/adminApi';
import ChartCard from '../../components/common/ChartCard';
import DataTable from '../../components/common/DataTable';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import styles from './GeminiDashboard.module.css';

const MODEL_COLORS = {
  'gemini-2.5-flash': '#d35325',
  'gemini-3.1-flash-image-preview': '#2563eb',
  'gemini-2.5-flash-image': '#919a4a',
  'gemini-1.5-flash-8b': '#d0b555',
};

const TYPE_COLORS = { text: '#919a4a', image: '#2563eb' };

const FEATURE_COLORS = ['#d35325', '#82622a', '#d0b555', '#919a4a', '#2563eb', '#7c3aed', '#0891b2', '#e11d48', '#ea580c', '#16a34a', '#8b5cf6', '#06b6d4'];

const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });

export default function GeminiDashboard() {
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [byModel, setByModel] = useState([]);
  const [byFeature, setByFeature] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [days]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sumRes, tlRes, modelRes, featRes, logsRes] = await Promise.allSettled([
        getGeminiSummary(), getGeminiTimeline(days), getGeminiByModel(days),
        getGeminiByFeature(days), getGeminiRecentLogs(30)
      ]);
      if (sumRes.status === 'fulfilled') setSummary(sumRes.value.data || {});
      if (tlRes.status === 'fulfilled') setTimeline((tlRes.value.data || []).map(d => ({ ...d, date: formatDate(d.date) })));
      if (modelRes.status === 'fulfilled') setByModel(modelRes.value.data || []);
      if (featRes.status === 'fulfilled') setByFeature(featRes.value.data || []);
      if (logsRes.status === 'fulfilled') setRecentLogs(logsRes.value.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const modelChartData = byModel.reduce((acc, r) => {
    let item = acc.find(a => a.model === r.model_name);
    if (!item) { item = { model: r.model_name, text: 0, image: 0 }; acc.push(item); }
    item[r.usage_type] = r.count;
    return acc;
  }, []);

  const featureChartData = byFeature.reduce((acc, r) => {
    let item = acc.find(a => a.feature === r.feature);
    if (!item) { item = { feature: r.feature, count: 0 }; acc.push(item); }
    item.count += r.count;
    return acc;
  }, []).sort((a, b) => b.count - a.count);

  const typePieData = summary ? [
    { name: 'Text', value: summary.text || 0 },
    { name: 'Image', value: summary.image || 0 },
  ] : [];

  const logColumns = [
    { key: 'user_name', label: 'ผู้ใช้', render: (v) => v || '-' },
    { key: 'feature', label: 'Feature', sortable: true },
    { key: 'usage_type', label: 'ประเภท', sortable: true },
    { key: 'model_name', label: 'Model', render: (v) => v?.replace('gemini-', '') },
    { key: 'status', label: 'สถานะ' },
    { key: 'created_at', label: 'เวลา', render: (v) => new Date(v).toLocaleString('th-TH') },
  ];

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      {summary && (
        <div className={styles.statsRow}>
          <div className={styles.statBox}>
            <div className={styles.statValue}>{summary.total?.toLocaleString()}</div>
            <div className={styles.statLabel}>Total Calls</div>
          </div>
          <div className={styles.statBox}>
            <div className={styles.statValue}>{summary.today?.toLocaleString()}</div>
            <div className={styles.statLabel}>วันนี้</div>
          </div>
          <div className={styles.statBox}>
            <div className={styles.statValue} style={{ color: '#919a4a' }}>{summary.text?.toLocaleString()}</div>
            <div className={styles.statLabel}>Text Generation</div>
          </div>
          <div className={styles.statBox}>
            <div className={styles.statValue} style={{ color: '#2563eb' }}>{summary.image?.toLocaleString()}</div>
            <div className={styles.statLabel}>Image Generation</div>
          </div>
        </div>
      )}

      <div className={styles.grid}>
        <div className={styles.full}>
          <ChartCard title="Gemini Usage Timeline (Text vs Image)" timeRange={days} onTimeRangeChange={setDays}>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={timeline}>
                <defs>
                  <linearGradient id="textGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#919a4a" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#919a4a" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="imgGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="text" name="Text" stroke="#919a4a" fill="url(#textGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="image" name="Image" stroke="#2563eb" fill="url(#imgGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <ChartCard title="การใช้งานแยกตาม Model">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={modelChartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="model" tick={{ fontSize: 10, angle: -15 }} height={60} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="text" name="Text" fill="#919a4a" stackId="a" radius={[0, 0, 0, 0]} />
              <Bar dataKey="image" name="Image" fill="#2563eb" stackId="a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="สัดส่วน Text vs Image">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={typePieData}
                cx="50%" cy="50%"
                innerRadius={60} outerRadius={100}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {typePieData.map((entry, i) => (
                  <Cell key={i} fill={TYPE_COLORS[entry.name.toLowerCase()] || '#ccc'} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className={styles.full}>
          <ChartCard title="การใช้งานแยกตาม Feature">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={featureChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="feature" tick={{ fontSize: 11, angle: -20 }} height={60} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="จำนวน" radius={[4, 4, 0, 0]}>
                  {featureChartData.map((_, i) => (
                    <Cell key={i} fill={FEATURE_COLORS[i % FEATURE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>

      <DataTable
        title="Gemini Usage Logs ล่าสุด"
        columns={logColumns}
        data={recentLogs}
      />
    </div>
  );
}
