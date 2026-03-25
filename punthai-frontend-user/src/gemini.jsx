import { useState } from 'react';
import { runGeminiTest } from './geminiService';

// เปลี่ยนชื่อจาก gemini เป็น GeminiTest (ตัวแรกต้องใหญ่)
function GeminiTest() {
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const handleTestApi = async () => {
    setLoading(true);
    setResult(""); 
    try {
      // ทดสอบส่งข้อความ
      const text = await runGeminiTest("ขอ 3 คำคมสร้างแรงบันดาลใจ");
      setResult(text);
    } catch (error) {
      setResult("เกิดข้อผิดพลาด: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ border: '1px solid #444', padding: '20px' }}>
      <h2>Gemini AI Test</h2>
      <div style={{ padding: '20px' }}>
        <button onClick={handleTestApi} disabled={loading}>
          {loading ? "กำลังคิด..." : "ถาม Gemini"}
        </button>
      </div>
      
      {result && (
        <div style={{ marginTop: '20px', padding: '15px', background: '#333', borderRadius: '8px', color: '#fff', textAlign: 'left' }}>
          <p style={{ whiteSpace: 'pre-line' }}>{result}</p>
        </div>
      )}
    </div>
  );
}

export default GeminiTest;