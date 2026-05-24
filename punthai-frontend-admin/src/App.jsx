import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import AdminLayout from './components/layout/AdminLayout';
import Login from './pages/Login';
import HomePage from './pages/home/HomePage';
import DashboardsPage from './pages/dashboards/DashboardsPage';
import NotificationPage from './pages/notifications/NotificationPage';
import PackageListPage from './pages/packages/PackageListPage';
import PackageFormPage from './pages/packages/PackageFormPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<AdminLayout />}>
            <Route index element={<HomePage />} />
            <Route path="dashboards" element={<DashboardsPage />} />
            <Route path="notifications" element={<NotificationPage />} />
            <Route path="packages" element={<PackageListPage />} />
            <Route path="packages/new" element={<PackageFormPage />} />
            <Route path="packages/:id/edit" element={<PackageFormPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: { fontFamily: 'var(--font-family)', fontSize: '14px' },
        }}
      />
    </AuthProvider>
  );
}
