import { API_URL } from '../config';
export const isProUser = (user) => {
    if (!user) return false;
    if (user.subscription_status !== 'PRO') return false;
    if (user.subscription_end_date && new Date(user.subscription_end_date) < new Date()) return false;
    return true;
};

export const getUserFromStorage = () => {
    try {
        return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
        return null;
    }
};

export const STANDARD_ALLOWED = {
    resultLogo: ['jpg', 'pdf'],
    labelEditor: ['preview_png'],
    packageDesign: ['png'],
};

export const isFormatAllowed = (feature, format, user) => {
    if (isProUser(user)) return true;
    const allowed = STANDARD_ALLOWED[feature];
    if (!allowed) return true;
    return allowed.includes(format);
};

export const fetchSubscriptionStatus = async (userId) => {
    try {
        const res = await fetch(`${API_URL}/api/subscription/status/${userId}`);
        const data = await res.json();
        if (data.status === 'success') return data.subscription;
        return null;
    } catch {
        return null;
    }
};
