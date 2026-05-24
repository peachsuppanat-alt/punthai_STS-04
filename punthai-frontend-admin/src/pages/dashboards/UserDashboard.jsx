import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';
import { getUserAnalytics, getUsers, getQuotaSummary } from '../../api/adminApi';
import ChartCard from '../../components/common/ChartCard';
import DataTable from '../../components/common/DataTable';
import { Badge } from '../../components/common/DataTable';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import styles from './UserDashboard.module.css';

const PIE_COLORS = ['#d35325', '#d0b555', '#919a4a', '#82622a'];

const QuotaBar = ({ used, limit, color = '#d35325' }) => {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const isHigh = pct >= 80;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 120 }}>
      <div style={{ flex: 1, height: 8, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: isHigh ? '#ef4444' : color, borderRadius: 4, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 12, color: isHigh ? '#ef4444' : '#666', fontWeight: 500, whiteSpace: 'nowrap' }}>
        {used}/{limit}
      </span>
    </div>
  );
};

export default function UserDashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState({ data: [], total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  useEffect(() => {
    loadUsers();
  }, [page, search]);

  const loadAnalytics = async () => {
    try {
      const res = await getUserAnalytics();
      setAnalytics(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await getUsers({ page, limit: 10, search });
      setUsers(res);
    } catch (err) {
      console.error(err);
    }
  };

  const userColumns = [
    { key: 'user_id', label: 'ID', sortable: true, width: '50px' },
    { key: 'user_name', label: 'ชื่อผู้ใช้', sortable: true },
    { key: 'email', label: 'อีเมล', sortable: true },
    {
      key: 'subscription_status', label: 'แพ็คเกจ', sortable: true,
      render: (val) => <Badge type={val === 'PRO' ? 'success' : 'info'}>{val}</Badge>
    },
    {
      key: 'image_used', label: 'โควต้ารูปภาพ',
      render: (_, row) => <QuotaBar used={row.image_used || 0} limit={row.image_limit || 6} color="#2563eb" />
    },
    {
      key: 'text_used', label: 'โควต้าข้อความ',
      render: (_, row) => <QuotaBar used={row.text_used || 0} limit={row.text_limit || 20} color="#919a4a" />
    },
    {
      key: 'quota_period', label: 'ประเภท',
      render: (val) => <Badge type={val === 'monthly' ? 'warning' : 'info'}>{val === 'monthly' ? 'รายเดือน' : 'ตลอดชีพ'}</Badge>
    },
  ];

  const topUserColumns = [
    { key: 'user_name', label: 'ชื่อผู้ใช้', sortable: true },
    { key: 'email', label: 'อีเมล' },
    { key: 'subscription_status', label: 'แพ็คเกจ', render: (val) => <Badge type={val === 'PRO' ? 'success' : 'info'}>{val}</Badge> },
    { key: 'usage_count', label: 'จำนวนใช้งาน', sortable: true },
  ];

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className={styles.grid}>
        <ChartCard title="แนวโน้มการสมัครใหม่ (รายเดือน)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={analytics?.regTrend || []}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" name="ผู้ใช้ใหม่" fill="#d35325" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="สัดส่วนแพ็คเกจผู้ใช้">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={analytics?.subBreakdown || []}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={3}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {(analytics?.subBreakdown || []).map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div style={{ marginBottom: 'var(--spacing-md)' }}>
        <div className={styles.quotaLegend}>
          <h3 style={{ margin: 0, fontSize: 14, color: '#82622a' }}>สรุปโควต้า</h3>
          <div className={styles.quotaInfo}>
            <span><Badge type="info">STANDARD</Badge> รูปภาพ 6 ครั้ง / ข้อความ 20 ครั้ง (ตลอดชีพ)</span>
            <span><Badge type="success">PRO</Badge> รูปภาพ 50 ครั้ง / ข้อความ 80 ครั้ง (ต่อเดือน)</span>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 'var(--spacing-lg)' }}>
        <DataTable
          title="ผู้ใช้ที่ใช้งานมากที่สุด (Top 10)"
          columns={topUserColumns}
          data={analytics?.topUsers || []}
        />
      </div>

      <DataTable
        title="รายชื่อผู้ใช้ทั้งหมด + โควต้า"
        columns={userColumns}
        data={users.data || []}
        searchPlaceholder="ค้นหาชื่อหรืออีเมล..."
        onSearch={(q) => { setSearch(q); setPage(1); }}
        pagination={{ total: users.total, page, limit: 10 }}
        onPageChange={setPage}
      />
    </div>
  );
}
