import React, { useState, useEffect } from 'react';
import { Send, Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import { sendNotification, getNotifications } from '../../api/adminApi';
import DataTable, { Badge } from '../../components/common/DataTable';
import styles from './NotificationPage.module.css';

const channelOptions = [
  { value: 'web', label: 'เว็บไซต์' },
  { value: 'email', label: 'อีเมล' },
  { value: 'both', label: 'ทั้งสองช่องทาง' },
];

const targetOptions = [
  { value: 'all', label: 'ผู้ใช้ทุกคน' },
  { value: 'pro', label: 'เฉพาะ PRO' },
  { value: 'standard', label: 'เฉพาะ Standard' },
];

export default function NotificationPage() {
  const [form, setForm] = useState({ title: '', message: '', channel: 'web', target: 'all' });
  const [showConfirm, setShowConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState({ data: [], total: 0 });
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadHistory();
  }, [page]);

  const loadHistory = async () => {
    try {
      const res = await getNotifications({ page, limit: 10 });
      setHistory(res);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.message.trim()) {
      toast.error('กรุณากรอกหัวข้อและข้อความ');
      return;
    }
    setShowConfirm(true);
  };

  const confirmSend = async () => {
    setShowConfirm(false);
    setSending(true);
    try {
      const res = await sendNotification(form);
      toast.success(`ส่งแจ้งเตือนสำเร็จ (${res.sentTo} คน)`);
      setForm({ title: '', message: '', channel: 'web', target: 'all' });
      loadHistory();
    } catch (err) {
      toast.error(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setSending(false);
    }
  };

  const formatDateTime = (d) => d ? new Date(d).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

  const historyColumns = [
    { key: 'id', label: 'ID', width: '50px' },
    { key: 'title', label: 'หัวข้อ', sortable: true },
    { key: 'channel', label: 'ช่องทาง', render: (v) => {
      const m = { web: 'เว็บ', email: 'อีเมล', both: 'ทั้งสอง' };
      return m[v] || v;
    }},
    { key: 'target', label: 'กลุ่มเป้าหมาย', render: (v) => {
      const m = { all: 'ทุกคน', pro: 'PRO', standard: 'Standard' };
      return m[v] || v;
    }},
    { key: 'sent_count', label: 'จำนวนส่ง', sortable: true },
    { key: 'status', label: 'สถานะ', render: (v) => <Badge type={v === 'sent' ? 'success' : v === 'failed' ? 'danger' : 'warning'}>{v}</Badge> },
    { key: 'sent_at', label: 'เวลาส่ง', render: formatDateTime },
  ];

  return (
    <div className={styles.layout}>
      <div className={styles.formCard}>
        <h2 className={styles.formTitle}><Send size={20} /> สร้างประกาศแจ้งเตือน</h2>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>หัวข้อ</label>
            <input
              className={styles.input}
              type="text"
              placeholder="หัวข้อประกาศ..."
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>ข้อความ</label>
            <textarea
              className={styles.textarea}
              placeholder="เขียนข้อความประกาศที่นี่..."
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>ช่องทางการส่ง</label>
            <div className={styles.radioGroup}>
              {channelOptions.map((opt) => (
                <label key={opt.value} className={`${styles.radioLabel} ${form.channel === opt.value ? styles.radioLabelActive : ''}`}>
                  <input type="radio" name="channel" value={opt.value} checked={form.channel === opt.value}
                    onChange={() => setForm({ ...form, channel: opt.value })} />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>กลุ่มเป้าหมาย</label>
            <div className={styles.radioGroup}>
              {targetOptions.map((opt) => (
                <label key={opt.value} className={`${styles.radioLabel} ${form.target === opt.value ? styles.radioLabelActive : ''}`}>
                  <input type="radio" name="target" value={opt.value} checked={form.target === opt.value}
                    onChange={() => setForm({ ...form, target: opt.value })} />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <button className={styles.submitBtn} type="submit" disabled={sending}>
            {sending ? 'กำลังส่ง...' : 'ส่งแจ้งเตือน'}
          </button>
        </form>
      </div>

      <DataTable
        title="ประวัติการส่งแจ้งเตือน"
        columns={historyColumns}
        data={history.data || []}
        pagination={{ total: history.total || 0, page, limit: 10 }}
        onPageChange={setPage}
      />

      {showConfirm && (
        <div className={styles.confirmOverlay} onClick={() => setShowConfirm(false)}>
          <div className={styles.confirmCard} onClick={(e) => e.stopPropagation()}>
            <Bell size={40} color="var(--color-primary)" style={{ marginBottom: '12px' }} />
            <div className={styles.confirmTitle}>ยืนยันการส่งแจ้งเตือน</div>
            <div className={styles.confirmText}>
              ส่ง "{form.title}" ไปยัง{form.target === 'all' ? 'ผู้ใช้ทุกคน' : form.target === 'pro' ? 'สมาชิก PRO' : 'สมาชิก Standard'}
              ผ่านช่องทาง{form.channel === 'web' ? 'เว็บไซต์' : form.channel === 'email' ? 'อีเมล' : 'ทั้งเว็บและอีเมล'}?
            </div>
            <div className={styles.confirmActions}>
              <button className={styles.cancelBtn} onClick={() => setShowConfirm(false)}>ยกเลิก</button>
              <button className={styles.confirmBtn} onClick={confirmSend}>ยืนยันส่ง</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
