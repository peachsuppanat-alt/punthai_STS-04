// Helper สำหรับอ่านข้อมูลผู้ใช้และเช็คประเภทบัญชี (user ทั่วไป vs โรงพิมพ์/Third Party)

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
}

// บัญชีโรงพิมพ์จะมี role หรือ account_type === 'printshop'
export function isPrintshop(user) {
  const u = user || getStoredUser();
  return u?.role === 'printshop' || u?.account_type === 'printshop';
}
