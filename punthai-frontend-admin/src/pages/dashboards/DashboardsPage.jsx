import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users, Activity, CreditCard, Sparkles } from 'lucide-react';
import TabBar from '../../components/common/TabBar';
import UserDashboard from './UserDashboard';
import ApiTokenDashboard from './ApiTokenDashboard';
import PaymentDashboard from './PaymentDashboard';
import GeminiDashboard from './GeminiDashboard';
import styles from './DashboardsPage.module.css';

const tabs = [
  { key: 'users', label: 'ผู้ใช้งาน', icon: Users },
  { key: 'api', label: 'API & Tokens', icon: Activity },
  { key: 'gemini', label: 'Gemini AI', icon: Sparkles },
  { key: 'payments', label: 'การชำระเงิน', icon: CreditCard },
];

export default function DashboardsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'users';

  const handleTabChange = (tab) => {
    setSearchParams({ tab });
  };

  return (
    <div className={styles.page}>
      <TabBar tabs={tabs} activeTab={activeTab} onChange={handleTabChange} />
      {activeTab === 'users' && <UserDashboard />}
      {activeTab === 'api' && <ApiTokenDashboard />}
      {activeTab === 'gemini' && <GeminiDashboard />}
      {activeTab === 'payments' && <PaymentDashboard />}
    </div>
  );
}
