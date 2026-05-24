import client from './client';

// ========== Auth ==========
export const loginAdmin = (data) =>
  client.post('/api/admin/login', data).then((r) => r.data);

// ========== Home Page Stats ==========
export const getUserCount = () =>
  client.get('/api/admin/users/count').then((r) => r.data);

export const getActiveUserCount = () =>
  client.get('/api/admin/users/active').then((r) => r.data);

export const getProUserCount = () =>
  client.get('/api/admin/users/pro-count').then((r) => r.data);

export const getTokenUsage = (days = 7) =>
  client.get('/api/admin/stats/token-usage', { params: { days } }).then((r) => r.data);

export const getTextGeneration = (days = 7) =>
  client.get('/api/admin/stats/text-generation', { params: { days } }).then((r) => r.data);

export const getImageGeneration = (days = 7) =>
  client.get('/api/admin/stats/image-generation', { params: { days } }).then((r) => r.data);

// ========== User Dashboard ==========
export const getUsers = (params) =>
  client.get('/api/admin/users', { params }).then((r) => r.data);

export const getUserAnalytics = () =>
  client.get('/api/admin/users/analytics').then((r) => r.data);

export const getQuotaSummary = () =>
  client.get('/api/admin/users/quota-summary').then((r) => r.data);

// ========== API & Token Dashboard ==========
export const getApiUsage = (days = 7) =>
  client.get('/api/admin/stats/api-usage', { params: { days } }).then((r) => r.data);

export const getApiCalls = (days = 7) =>
  client.get('/api/admin/stats/api-calls', { params: { days } }).then((r) => r.data);

export const getCreditConsumption = (days = 7) =>
  client.get('/api/admin/stats/credit-consumption', { params: { days } }).then((r) => r.data);

export const getTopConsumers = (limit = 10) =>
  client.get('/api/admin/stats/top-consumers', { params: { limit } }).then((r) => r.data);

export const getFeatureUsage = (days = 7) =>
  client.get('/api/admin/stats/feature-usage', { params: { days } }).then((r) => r.data);

// ========== Gemini Usage ==========
export const getGeminiSummary = () =>
  client.get('/api/admin/gemini/summary').then((r) => r.data);

export const getGeminiTimeline = (days = 7) =>
  client.get('/api/admin/gemini/usage-timeline', { params: { days } }).then((r) => r.data);

export const getGeminiByModel = (days = 30) =>
  client.get('/api/admin/gemini/by-model', { params: { days } }).then((r) => r.data);

export const getGeminiByFeature = (days = 30) =>
  client.get('/api/admin/gemini/by-feature', { params: { days } }).then((r) => r.data);

export const getGeminiRecentLogs = (limit = 50, offset = 0) =>
  client.get('/api/admin/gemini/recent-logs', { params: { limit, offset } }).then((r) => r.data);

// ========== Payment Dashboard ==========
export const getSubscriptionSignups = (days = 30) =>
  client.get('/api/admin/subscriptions/signups', { params: { days } }).then((r) => r.data);

export const getRevenue = (days = 30, granularity = 'day') =>
  client.get('/api/admin/subscriptions/revenue', { params: { days, granularity } }).then((r) => r.data);

export const getPayments = (params) =>
  client.get('/api/admin/payments', { params }).then((r) => r.data);

export const getWebhookLogs = (params) =>
  client.get('/api/admin/webhooks', { params }).then((r) => r.data);

// ========== Notifications ==========
export const sendNotification = (data) =>
  client.post('/api/admin/notifications', data).then((r) => r.data);

export const getNotifications = (params) =>
  client.get('/api/admin/notifications', { params }).then((r) => r.data);

// ========== Package Management ==========
export const getPackages = (params) =>
  client.get('/api/admin/packages', { params }).then((r) => r.data);

export const getPackageById = (id) =>
  client.get(`/api/admin/packages/${id}`).then((r) => r.data);

export const createPackage = (formData) =>
  client.post('/api/admin/packages', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);

export const updatePackage = (id, formData) =>
  client.put(`/api/admin/packages/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);

export const deletePackage = (id) =>
  client.delete(`/api/admin/packages/${id}`).then((r) => r.data);
