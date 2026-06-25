import React, { useState, useEffect, useRef } from 'react';
import {
  LineChart, Line, BarChart, Bar, Cell, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';
import { getSubscriptionSignups, getRevenue, getPayments, getWebhookLogs, getWebhookSummary, getPaymentErrorSummary } from '../../api/adminApi';
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

const ERROR_TYPE_COLORS = {
  charge_failed: '#f59e0b',
  server_error: '#ef4444',
  webhook_error: '#a855f7',
  cancel_error: '#6366f1',
  unknown: '#9ca3af',
};

const ERROR_TYPE_LABELS = {
  charge_failed: 'Charge Failed',
  server_error: 'Server Error',
  webhook_error: 'Webhook Error',
  cancel_error: 'Cancel Error',
  unknown: 'Unknown',
};

const WEBHOOK_EVENT_COLORS = {
  'charge.complete': '#16a34a',
  'charge.create': '#2563eb',
  'customer.create': '#7c3aed',
  'customer.update': '#0891b2',
  'schedule.create': '#d0b555',
  'transfer.pay': '#d35325',
};

export default function PaymentDashboard() {
  const [days, setDays] = useState(30);
  const [errorDays, setErrorDays] = useState(30);
  const [webhookDays, setWebhookDays] = useState(30);
  const [signups, setSignups] = useState([]);
  const [revenue, setRevenue] = useState({ data: [], total: 0 });
  const [payments, setPayments] = useState({ data: [], total: 0 });
  const [webhooks, setWebhooks] = useState({ data: [], total: 0 });
  const [webhookSummary, setWebhookSummary] = useState(null);
  const [webhookTimeline, setWebhookTimeline] = useState([]);
  const [errorSummary, setErrorSummary] = useState(null);
  const [errorTimeline, setErrorTimeline] = useState([]);
  const [payPage, setPayPage] = useState(1);
  const [whPage, setWhPage] = useState(1);
  const [whEventFilter, setWhEventFilter] = useState('');
  const [payStatus, setPayStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const pollRef = useRef(null);

  useEffect(() => { loadCharts(); }, [days]);
  useEffect(() => { loadErrorData(); }, [errorDays]);
  useEffect(() => { loadWebhookSummary(); }, [webhookDays]);
  useEffect(() => { loadPayments(); }, [payPage, payStatus]);
  useEffect(() => {
    loadWebhooks();
    pollRef.current = setInterval(loadWebhooks, 30000);
    return () => clearInterval(pollRef.current);
  }, [whPage, whEventFilter]);

  const loadCharts = async () => {
    setLoading(true);
    try {
      const [sRes, rRes] = await Promise.allSettled([
        getSubscriptionSignups(days), getRevenue(days)
      ]);
      if (sRes.status === 'fulfilled') setSignups((sRes.value.data || []).map(d => ({ ...d, date: formatDate(d.date) })));
      if (rRes.status === 'fulfilled') setRevenue({ data: (rRes.value.data || []).map(d => ({ ...d, date: formatDate(d.date) })), total: rRes.value.totalRevenue || 0 });
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadErrorData = async () => {
    try {
      const res = await getPaymentErrorSummary(errorDays);
      if (res.status === 'success' && res.data) {
        setErrorSummary(res.data);
        const raw = res.data.timeline || [];
        const grouped = {};
        raw.forEach(r => {
          const d = formatDate(r.date);
          if (!grouped[d]) grouped[d] = { date: d };
          grouped[d][r.error_type] = (grouped[d][r.error_type] || 0) + r.count;
        });
        setErrorTimeline(Object.values(grouped));
      }
    } catch (err) { console.error('Payment error summary:', err); }
  };

  const loadWebhookSummary = async () => {
    try {
      const res = await getWebhookSummary(webhookDays);
      if (res.status === 'success' && res.data) {
        setWebhookSummary(res.data);
        const raw = res.data.timeline || [];
        const grouped = {};
        raw.forEach(r => {
          const d = formatDate(r.date);
          if (!grouped[d]) grouped[d] = { date: d };
          grouped[d][r.event_key] = (grouped[d][r.event_key] || 0) + r.count;
        });
        setWebhookTimeline(Object.values(grouped));
      }
    } catch (err) { console.error('Webhook summary:', err); }
  };

  const loadPayments = async () => {
    try {
      const res = await getPayments({ page: payPage, limit: 10, status: payStatus });
      setPayments(res);
    } catch (err) { console.error(err); }
  };

  const loadWebhooks = async () => {
    try {
      const res = await getWebhookLogs({ page: whPage, limit: 10, event: whEventFilter });
      setWebhooks(res);
    } catch (err) { console.error(err); }
  };

  // Collect unique keys
  const allErrorTypes = [...new Set(errorTimeline.flatMap(d => Object.keys(d).filter(k => k !== 'date')))];
  const allWebhookEvents = [...new Set(webhookTimeline.flatMap(d => Object.keys(d).filter(k => k !== 'date')))];
  const uniqueWebhookEvents = webhookSummary?.byEvent?.map(e => e.event_key) || [];

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
    { key: 'id', label: 'ID', width: '50px' },
    { key: 'event_key', label: 'Event', sortable: true, render: (v) => {
      const color = v === 'charge.complete' ? 'success' : v?.includes('fail') ? 'danger' : 'info';
      return <Badge type={color}>{v}</Badge>;
    }},
    { key: 'object_id', label: 'Object ID', render: (v) => <span className={styles.chargeIdCell}>{v || '-'}</span> },
    { key: 'charge_status', label: 'Charge Status', render: (v) => v ? statusBadge(v) : '-' },
    { key: 'charge_amount', label: 'จำนวนเงิน', render: (v) => v ? `฿${formatMoney(v)}` : '-' },
    { key: 'metadata_user_id', label: 'User ID', render: (v) => v || '-' },
    { key: 'payment_method', label: 'วิธีชำระ', render: (v) => v || '-' },
    { key: 'failure_code', label: 'Failure', render: (v) => v ? <Badge type="danger">{v}</Badge> : '-' },
    { key: 'created_at', label: 'เวลา', render: formatDateTime },
  ];

  const errorLogColumns = [
    { key: 'user_name', label: 'ผู้ใช้', render: (v) => v || '-' },
    { key: 'error_type', label: 'ประเภท', render: (v) => (
      <Badge type={v === 'charge_failed' ? 'warning' : v === 'server_error' ? 'danger' : 'info'}>
        {ERROR_TYPE_LABELS[v] || v}
      </Badge>
    )},
    { key: 'error_code', label: 'Error Code', render: (v) => v ? <Badge type="danger">{v}</Badge> : '-' },
    { key: 'error_message', label: 'Error Message', render: (v) => <span className={styles.errorMsgCell}>{v || '-'}</span> },
    { key: 'endpoint', label: 'Endpoint', render: (v) => v?.replace('/api/subscription/', '').replace('/api/webhook/', 'webhook/') },
    { key: 'charge_id', label: 'Charge ID', render: (v) => v ? <span className={styles.chargeIdCell}>{v}</span> : '-' },
    { key: 'created_at', label: 'เวลา', render: formatDateTime },
  ];

  const statusFilters = ['', 'successful', 'failed', 'pending'];
  const statusLabels = { '': 'ทั้งหมด', successful: 'สำเร็จ', failed: 'ล้มเหลว', pending: 'รอดำเนินการ' };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      {/* ===== CHARTS: สมัครสมาชิก + รายได้ ===== */}
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

      {/* ===== WEBHOOK SECTION ===== */}
      <div className={styles.webhookSection}>
        <div className={styles.webhookHeader}>
          <h2 className={styles.webhookTitle}>Omise Webhook Logs</h2>
          <span className={styles.webhookAutoRefresh}>อัปเดตอัตโนมัติทุก 30 วินาที</span>
        </div>

        {/* Webhook Stats */}
        <div className={styles.webhookStatsRow}>
          <div className={styles.webhookStatBox}>
            <div className={styles.webhookStatValue}>{webhookSummary?.total || 0}</div>
            <div className={styles.webhookStatLabel}>Total Webhooks</div>
          </div>
          <div className={styles.webhookStatBox}>
            <div className={styles.webhookStatValue}>{webhookSummary?.today || 0}</div>
            <div className={styles.webhookStatLabel}>วันนี้</div>
          </div>
          <div className={styles.webhookStatBox}>
            <div className={styles.webhookStatValue} style={{ color: '#16a34a' }}>{webhookSummary?.chargeResults?.successful || 0}</div>
            <div className={styles.webhookStatLabel}>Charge สำเร็จ</div>
          </div>
          <div className={styles.webhookStatBox}>
            <div className={styles.webhookStatValue} style={{ color: '#ef4444' }}>{webhookSummary?.chargeResults?.failed || 0}</div>
            <div className={styles.webhookStatLabel}>Charge ล้มเหลว</div>
          </div>
          {webhookSummary?.total === 0 && (
            <div className={styles.webhookStatBox} style={{ gridColumn: '1 / -1', background: '#fffbeb', border: '1px solid #fde68a' }}>
              <div style={{ fontSize: 13, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                <span style={{ fontSize: 18 }}>⚠️</span>
                <span>ยังไม่เคยได้รับ Webhook จาก Omise — ต้องตั้ง Webhook URL ใน <strong>Omise Dashboard</strong> ให้ชี้มาที่ <code style={{ background: '#fef3c7', padding: '2px 6px', borderRadius: 4 }}>/api/webhook/omise</code></span>
              </div>
            </div>
          )}
        </div>

        {/* Webhook Charts */}
        {webhookSummary?.total > 0 && (
          <div className={styles.grid}>
            <ChartCard title="Webhook Events Timeline" timeRange={webhookDays} onTimeRangeChange={setWebhookDays}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={webhookTimeline}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  {allWebhookEvents.map((evt, i) => (
                    <Bar
                      key={evt}
                      dataKey={evt}
                      name={evt}
                      fill={WEBHOOK_EVENT_COLORS[evt] || `hsl(${i * 60}, 55%, 50%)`}
                      stackId="wh"
                      radius={i === allWebhookEvents.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="สัดส่วน Webhook Events">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={(webhookSummary?.byEvent || []).map(r => ({
                      name: r.event_key,
                      value: r.count,
                    }))}
                    cx="50%" cy="50%"
                    innerRadius={50} outerRadius={90}
                    dataKey="value"
                    label={({ name, percent }) => `${name.replace('charge.', '')} ${(percent * 100).toFixed(0)}%`}
                  >
                    {(webhookSummary?.byEvent || []).map((r, i) => (
                      <Cell key={i} fill={WEBHOOK_EVENT_COLORS[r.event_key] || `hsl(${i * 60}, 55%, 50%)`} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        )}

        {/* Webhook Logs Table */}
        <DataTable
          title="Webhook Logs ล่าสุด"
          columns={webhookColumns}
          data={webhooks.data || []}
          pagination={{ total: webhooks.total || 0, page: whPage, limit: 10 }}
          onPageChange={setWhPage}
          extra={
            <div className={styles.filterRow}>
              <button
                className={`${styles.filterBtn} ${whEventFilter === '' ? styles.filterBtnActive : ''}`}
                onClick={() => { setWhEventFilter(''); setWhPage(1); }}
              >ทั้งหมด</button>
              {uniqueWebhookEvents.map(evt => (
                <button
                  key={evt}
                  className={`${styles.filterBtn} ${whEventFilter === evt ? styles.filterBtnActive : ''}`}
                  onClick={() => { setWhEventFilter(evt); setWhPage(1); }}
                >{evt}</button>
              ))}
            </div>
          }
        />
      </div>

      {/* ===== PAYMENT ERROR SECTION ===== */}
      <div className={styles.errorSection}>
        <div className={styles.errorHeader}>
          <h2 className={styles.errorTitle}>Payment Errors</h2>
        </div>

        {errorSummary && (
          <div className={styles.errorStatsRow}>
            <div className={styles.errorStatBox}>
              <div className={styles.errorStatValue}>{errorSummary.total}</div>
              <div className={styles.errorStatLabel}>Total Errors ({errorDays} วัน)</div>
            </div>
            <div className={styles.errorStatBox}>
              <div className={styles.errorStatValue}>{errorSummary.today}</div>
              <div className={styles.errorStatLabel}>วันนี้</div>
            </div>
            {(errorSummary.byType || []).map(item => (
              <div key={item.error_type} className={styles.errorStatBox}>
                <div className={styles.errorStatValue} style={{ color: ERROR_TYPE_COLORS[item.error_type] || '#ef4444' }}>
                  {item.count}
                </div>
                <div className={styles.errorStatLabel}>
                  {ERROR_TYPE_LABELS[item.error_type] || item.error_type}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className={styles.grid}>
          <ChartCard title="Payment Errors Timeline" timeRange={errorDays} onTimeRangeChange={setErrorDays}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={errorTimeline}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                {allErrorTypes.map((type, i) => (
                  <Bar
                    key={type}
                    dataKey={type}
                    name={ERROR_TYPE_LABELS[type] || type}
                    fill={ERROR_TYPE_COLORS[type] || '#999'}
                    stackId="errors"
                    radius={i === allErrorTypes.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="สัดส่วน Error ตามประเภท">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={(errorSummary?.byType || []).map(r => ({
                    name: ERROR_TYPE_LABELS[r.error_type] || r.error_type,
                    value: r.count,
                  }))}
                  cx="50%" cy="50%"
                  innerRadius={50} outerRadius={90}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {(errorSummary?.byType || []).map((r, i) => (
                    <Cell key={i} fill={ERROR_TYPE_COLORS[r.error_type] || '#999'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {errorSummary?.recent?.length > 0 && (
          <DataTable
            title="Payment Error Logs ล่าสุด"
            columns={errorLogColumns}
            data={errorSummary.recent}
          />
        )}
      </div>

      {/* ===== PAYMENT HISTORY TABLE ===== */}
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
    </div>
  );
}
