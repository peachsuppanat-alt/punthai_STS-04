import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie
} from 'recharts';
import { getGeminiSummary, getGeminiTimeline, getGeminiByModel, getGeminiByFeature, getGeminiRecentLogs, getGeminiErrorTimeline, getGeminiErrorSummary } from '../../api/adminApi';
import ChartCard from '../../components/common/ChartCard';
import DataTable from '../../components/common/DataTable';
import { Badge } from '../../components/common/DataTable';
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

const ERROR_COLORS = {
  400: '#f59e0b',
  401: '#a855f7',
  403: '#ec4899',
  404: '#6366f1',
  429: '#f97316',
  500: '#ef4444',
  502: '#dc2626',
  503: '#b91c1c',
  504: '#991b1b',
};

const ERROR_LABELS = {
  400: 'BadRequest',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'NotFound',
  429: 'TooManyRequests',
  500: 'InternalServerError',
  502: 'BadGateway',
  503: 'ServiceUnavailable',
  504: 'GatewayTimeout',
};

const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });

export default function GeminiDashboard() {
  const [days, setDays] = useState(30);
  const [errorDays, setErrorDays] = useState(30);
  const [summary, setSummary] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [byModel, setByModel] = useState([]);
  const [byFeature, setByFeature] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [errorTimeline, setErrorTimeline] = useState([]);
  const [errorSummary, setErrorSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [days]);
  useEffect(() => { loadErrorData(); }, [errorDays]);

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

  const loadErrorData = async () => {
    try {
      const [tlRes, sumRes] = await Promise.allSettled([
        getGeminiErrorTimeline(errorDays),
        getGeminiErrorSummary(errorDays)
      ]);
      if (tlRes.status === 'fulfilled') {
        // Transform: [{date, error_code, count}] → [{date, 400: N, 500: N, ...}]
        const raw = tlRes.value.data || [];
        const grouped = {};
        raw.forEach(r => {
          const d = formatDate(r.date);
          if (!grouped[d]) grouped[d] = { date: d };
          grouped[d][r.error_code] = (grouped[d][r.error_code] || 0) + r.count;
        });
        setErrorTimeline(Object.values(grouped));
      }
      if (sumRes.status === 'fulfilled') setErrorSummary(sumRes.value.data || null);
    } catch (err) {
      console.error(err);
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

  // Collect all unique error codes from timeline data
  const allErrorCodes = [...new Set(errorTimeline.flatMap(d => Object.keys(d).filter(k => k !== 'date').map(Number)))].sort();

  const logColumns = [
    { key: 'user_name', label: 'ผู้ใช้', render: (v) => v || '-' },
    { key: 'feature', label: 'Feature', sortable: true },
    { key: 'usage_type', label: 'ประเภท', sortable: true },
    { key: 'model_name', label: 'Model', render: (v) => v?.replace('gemini-', '') },
    { key: 'status', label: 'สถานะ', render: (v) => <Badge type={v === 'success' ? 'success' : 'danger'}>{v}</Badge> },
    { key: 'created_at', label: 'เวลา', render: (v) => new Date(v).toLocaleString('th-TH') },
  ];

  const errorLogColumns = [
    { key: 'user_name', label: 'ผู้ใช้', render: (v) => v || '-' },
    { key: 'feature', label: 'Feature' },
    { key: 'endpoint', label: 'Endpoint', render: (v) => v?.replace('/api/', '') },
    { key: 'error_code', label: 'Error Code', render: (v) => <Badge type="danger">{v || 500}</Badge> },
    { key: 'error_message', label: 'Error Message', render: (v) => <span className={styles.errorMsgCell}>{v || '-'}</span> },
    { key: 'model_name', label: 'Model', render: (v) => v?.replace('gemini-', '') },
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
          <div className={styles.statBox}>
            <div className={styles.statValue} style={{ color: '#ef4444' }}>{summary.failed?.toLocaleString() || 0}</div>
            <div className={styles.statLabel}>Total Errors</div>
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

      {/* ===== ERROR DASHBOARD SECTION ===== */}
      <div className={styles.errorSection}>
        <div className={styles.errorHeader}>
          <h2 className={styles.errorTitle}>Gemini API Errors</h2>
        </div>

        {errorSummary && (
          <div className={styles.errorStatsRow}>
            <div className={`${styles.statBox} ${styles.errorStatBox}`}>
              <div className={styles.statValue} style={{ color: '#ef4444' }}>{errorSummary.total}</div>
              <div className={styles.statLabel}>Total Errors ({errorDays} วัน)</div>
            </div>
            <div className={`${styles.statBox} ${styles.errorStatBox}`}>
              <div className={styles.statValue} style={{ color: '#ef4444' }}>{errorSummary.today}</div>
              <div className={styles.statLabel}>วันนี้</div>
            </div>
            {(errorSummary.byCode || []).slice(0, 3).map(item => (
              <div key={item.error_code} className={`${styles.statBox} ${styles.errorStatBox}`}>
                <div className={styles.statValue} style={{ color: ERROR_COLORS[item.error_code] || '#ef4444' }}>
                  {item.count}
                </div>
                <div className={styles.statLabel}>
                  {item.error_code} {ERROR_LABELS[item.error_code] || ''}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className={styles.grid}>
          <div className={styles.full}>
            <ChartCard title="Total API Errors (แยกตาม Error Code)" timeRange={errorDays} onTimeRangeChange={setErrorDays}>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={errorTimeline}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  {allErrorCodes.map(code => (
                    <Bar
                      key={code}
                      dataKey={code}
                      name={`${code} ${ERROR_LABELS[code] || ''}`}
                      fill={ERROR_COLORS[code] || '#999'}
                      stackId="errors"
                      radius={code === allErrorCodes[allErrorCodes.length - 1] ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <ChartCard title="Error แยกตาม Code">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={(errorSummary?.byCode || []).map(r => ({
                    name: `${r.error_code} ${ERROR_LABELS[r.error_code] || ''}`,
                    value: r.count,
                    code: r.error_code
                  }))}
                  cx="50%" cy="50%"
                  innerRadius={50} outerRadius={90}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {(errorSummary?.byCode || []).map((r, i) => (
                    <Cell key={i} fill={ERROR_COLORS[r.error_code] || '#999'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Error แยกตาม Feature">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={errorSummary?.byFeature || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="feature" tick={{ fontSize: 11 }} width={120} />
                <Tooltip />
                <Bar dataKey="count" name="Errors" fill="#ef4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {errorSummary?.recentErrors?.length > 0 && (
          <DataTable
            title="Error Logs ล่าสุด"
            columns={errorLogColumns}
            data={errorSummary.recentErrors}
          />
        )}
      </div>

      <DataTable
        title="Gemini Usage Logs ล่าสุด"
        columns={logColumns}
        data={recentLogs}
      />
    </div>
  );
}
