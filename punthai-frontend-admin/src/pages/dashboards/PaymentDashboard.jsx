import React, { useState, useEffect, useRef } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';
import { getSubscriptionSignups, getRevenue, getPayments, getWebhookLogs } from '../../api/adminApi';
import ChartCard from '../../components/common/ChartCard';
import DataTable, { Badge } from '../../components/common/DataTable';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import styles from './PaymentDashboard.module.css';

const formatDate = (d) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
const formatDateTime = (d) => d ? new Date(d).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
const formatMoney = (v) => Number(v || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 });

const statusBadge = (val) => {
  const map = { successful: 'success', failed: 'danger', pending: 'warning' };
  return <Badge type={map[val] || 'info'}>{val}</Badge>;
};

export default function PaymentDashboard() {
  const [days, setDays] = useState(30);
  const [signups, setSignups] = useState([]);
  const [revenue, setRevenue] = useState({ data: [], total: 0 });
  const [payments, setPayments] = useState({ data: [], total: 0 });
  const [webhooks, setWebhooks] = useState({ data: [], total: 0 });
  const [payPage, setPayPage] = useState(1);
  const [whPage, setWhPage] = useState(1);
  const [payStatus, setPayStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const pollRef = useRef(null);

  useEffect(() => {
    loadCharts();
  }, [days]);

  useEffect(() => {
    loadPayments();
  }, [payPage, payStatus]);

  useEffect(() => {
    loadWebhooks();
    pollRef.current = setInterval(loadWebhooks, 30000);
    return () => clearInterval(pollRef.current);
  }, [whPage]);

  const loadCharts = async () => {
    setLoading(true);
    try {
      const [sRes, rRes] = await Promise.all([
        getSubscriptionSignups(days), getRevenue(days)
      ]);
      setSignups((sRes.data || []).map(d => ({ ...d, date: formatDate(d.date) })));
      setRevenue({ data: (rRes.data || []).map(d => ({ ...d, date: formatDate(d.date) })), total: rRes.totalRevenue || 0 });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadPayments = async () => {
    try {
      const res = await getPayments({ page: payPage, limit: 10, status: payStatus });
      setPayments(res);
    } catch (err) {
      console.error(err);
    }
  };

  const loadWebhooks = async () => {
    try {
      const res = await getWebhookLogs({ page: whPage, limit: 10 });
      setWebhooks(res);
    } catch (err) {
      console.error(err);
    }
  };

  const payColumns = [
    { key: 'payment_id', label: 'ID', width: '60px' },
    { key: 'user_name', label: 'ผู้ใช้', sortable: true },
    { key: 'email', label: 'อีเมล' },
    { key: 'amount_paid', label: 'จำนวนเงิน', sortable: true, render: (v) => `฿${formatMoney(v)}` },
    { key: 'package_selected', label: 'แพ็คเกจ' },
    { key: 'status', label: 'สถานะ', render: statusBadge },
    { key: 'payment_method', label: 'วิธีชำระ' },
    { key: 'created_at', label: 'วันที่', render: formatDateTime },
  ];

  const webhookColumns = [
    { key: 'id', label: 'ID', width: '60px' },
    { key: 'event_key', label: 'Event', sortable: true },
    { key: 'object_id', label: 'Object ID' },
    { key: 'created_at', label: 'เวลา', render: formatDateTime },
  ];

  const statusFilters = ['', 'successful', 'failed', 'pending'];
  const statusLabels = { '': 'ทั้งหมด', successful: 'สำเร็จ', failed: 'ล้มเหลว', pending: 'รอดำเนินการ' };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className={styles.grid}>
        <ChartCard title="การสมัครสมาชิกใหม่" timeRange={days} onTimeRangeChange={setDays}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={signups}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" name="สมัครใหม่" stroke="#d35325" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="รายได้"
          timeRange={days}
          onTimeRangeChange={setDays}
          extra={<span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-gold)' }}>รวม: ฿{formatMoney(revenue.total)}</span>}
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={revenue.data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip formatter={(v) => `฿${formatMoney(v)}`} />
              <Bar dataKey="revenue" name="รายได้" fill="#d0b555" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div style={{ marginBottom: 'var(--spacing-lg)' }}>
        <DataTable
          title="ประวัติการชำระเงิน"
          columns={payColumns}
          data={payments.data || []}
          searchPlaceholder="ค้นหาชื่อหรืออีเมล..."
          pagination={{ total: payments.total || 0, page: payPage, limit: 10 }}
          onPageChange={setPayPage}
          extra={
            <div className={styles.filterRow}>
              {statusFilters.map(s => (
                <button
                  key={s}
                  className={`${styles.filterBtn} ${payStatus === s ? styles.filterBtnActive : ''}`}
                  onClick={() => { setPayStatus(s); setPayPage(1); }}
                >
                  {statusLabels[s]}
                </button>
              ))}
            </div>
          }
        />
      </div>

      <DataTable
        title="Omise Webhook Logs (อัพเดทอัตโนมัติทุก 30 วินาที)"
        columns={webhookColumns}
        data={webhooks.data || []}
        pagination={{ total: webhooks.total || 0, page: whPage, limit: 10 }}
        onPageChange={setWhPage}
      />
    </div>
  );
}
