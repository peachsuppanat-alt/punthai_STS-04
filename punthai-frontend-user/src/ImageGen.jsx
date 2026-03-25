import { useState } from 'react';

function ImageGen() {
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);

  const generateImage = async () => {
    if (!prompt) return alert("พิมพ์บอก AI ก่อนว่าจะให้วาดอะไร!");
    
    setLoading(true);
    setImage(null);

    try {
      const res = await fetch('http://localhost:3000/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      const data = await res.json();
      if (data.status === 'success') {
        setImage(data.imageUrl);
      } else {
        alert("เกิดข้อผิดพลาด: " + data.message);
      }
    } catch (error) {
      alert("เชื่อมต่อ Server ไม่ได้");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #444', marginTop: '20px', borderRadius: '10px' }}>
      <h2>🎨 AI สร้างภาพสินค้า (Flux Model)</h2>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <input 
          type="text" 
          placeholder="เช่น: A modern packaging box for organic tea, green theme, realistic, 8k" 
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          style={{ flex: 1, padding: '10px', borderRadius: '5px' }}
        />
        <button onClick={generateImage} disabled={loading} style={{ background: '#646cff', color: 'white' }}>
          {loading ? 'กำลังวาด...' : 'สร้างรูป'}
        </button>
      </div>

      {image && (
        <div>
          <h3>ผลลัพธ์:</h3>
          <img src={image} alt="AI Result" style={{ maxWidth: '100%', borderRadius: '10px', boxShadow: '0 0 10px rgba(0,0,0,0.5)' }} />
        </div>
      )}
    </div>
  );
}

export default ImageGen;