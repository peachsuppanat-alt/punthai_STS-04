import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import Replicate from "replicate"; // 1. เพิ่มบรรทัดนี้

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// สร้าง Connection Pool Database
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  ssl: process.env.DB_SSL === 'true' ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Setup การอัปโหลดรูป (Profile)
if (!fs.existsSync('./uploads')){
    fs.mkdirSync('./uploads');
}
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname))
  }
});
const upload = multer({ storage: storage });

// 2. Setup Replicate (AI)
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN, // ต้องมั่นใจว่าใส่ Token ใน .env แล้ว
});


// ================= API LOGIN & REGISTER =================


// ================= API REGISTER =================
app.post('/api/register', upload.single('img_profile'), async (req, res) => {
  const { user_name, password, email } = req.body; 
  const image_profile = req.file ? req.file.filename : null; 
  const subscription_status = 'expired';

  // 1. ดักจับปัญหากรณีส่งข้อมูลมาไม่ครบ
  if (!user_name || !password || !email) {
      return res.status(400).json({ 
          status: 'error', 
          message: 'ข้อมูลไม่ครบถ้วน!' 
      });
  }

  // 2. ต้องมี try { เพื่อครอบการทำงานของ Database
  try {
    const connection = await pool.getConnection();

    // 3. เช็กว่าชื่อผู้ใช้ซ้ำไหม
    const [checkUser] = await connection.query('SELECT * FROM user_profile WHERE user_name = ?', [user_name]);
    if (checkUser.length > 0) {
      connection.release();
      return res.status(400).json({ status: 'error', message: 'ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว' });
    }

    // 4. บันทึกข้อมูลลง Database
    const [result] = await connection.query(
      `INSERT INTO user_profile (user_name, password, email, image_profile, subscription_status) 
       VALUES (?, ?, ?, ?, ?)`,
      [user_name, password, email, image_profile, subscription_status]
    );

    // 5. ดึงข้อมูล User ที่เพิ่งสร้างเสร็จหมาดๆ จาก Database
    const [newUser] = await connection.query('SELECT * FROM user_profile WHERE user_id = ?', [result.insertId]);

    connection.release();

    // 6. ส่งข้อมูล user: newUser[0] กลับไปให้หน้า Auth.jsx ทำ Auto-Login
    res.json({ status: 'success', message: 'สมัครสมาชิกสำเร็จ!', user: newUser[0] });

  } catch (error) {
    console.error("❌ Register Error แบบละเอียด:", error); 
    res.status(500).json({ status: 'error', message: 'Database Error', error: error.message });
  }
});
app.post('/api/login', async (req, res) => {
  const { user_name, password } = req.body;
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      'SELECT * FROM user_profile WHERE user_name = ? AND password = ?', 
      [user_name, password]
    );
    connection.release();

    if (rows.length > 0) {
      res.json({ status: 'success', message: 'เข้าสู่ระบบสำเร็จ!', user: rows[0] });
    } else {
      res.status(401).json({ status: 'error', message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Error Server', error: error.message });
  }
});

// ================= 3. API สร้างรูปภาพ (FLUX) (ใหม่!) =================
app.post('/api/generate-image', async (req, res) => {
    const { prompt } = req.body;
  
    if (!prompt) {
      return res.status(400).json({ status: 'error', message: 'กรุณาระบุคำสั่ง (Prompt)' });
    }
  
    try {
      console.log("🎨 กำลังให้ AI วาดรูป:", prompt);
  
      const output = await replicate.run(
        "black-forest-labs/flux-schnell",
        {
          input: {
            prompt: prompt,
            go_fast: true,
            megapixels: "1",
            num_outputs: 1,
            aspect_ratio: "1:1",
            output_format: "webp",
            output_quality: 90
          }
        }
      );
  
      console.log("✅ ได้รูปมาแล้ว:", output);
      res.json({ status: 'success', imageUrl: output[0] });
  
    } catch (error) {
      console.error("❌ Replicate Error:", error);
      res.status(500).json({ status: 'error', message: 'สร้างรูปไม่สำเร็จ', error: error.message });
    }
  });
// ================= 4. API จัดการโปรเจกต์ (Projects) =================

// 4.1 สร้างโปรเจกต์ใหม่
app.post('/api/projects', async (req, res) => {
  const { user_id, name_concept } = req.body;
  if (!user_id || !name_concept) {
    return res.status(400).json({ status: 'error', message: 'ข้อมูลไม่ครบถ้วน' });
  }

  try {
    const connection = await pool.getConnection();
    const [result] = await connection.query(
      'INSERT INTO project (user_id, name_concept, status) VALUES (?, ?, ?)',
      [user_id, name_concept, 'ยังไม่ได้เริ่ม']
    );
    connection.release();
    res.json({ status: 'success', message: 'สร้างโปรเจกต์สำเร็จ', project_id: result.insertId });
  } catch (error) {
    console.error("❌ Create Project Error:", error);
    res.status(500).json({ status: 'error', message: 'สร้างโปรเจกต์ไม่สำเร็จ', error: error.message });
  }
});

// 4.2 ดึงรายการโปรเจกต์ของ User
app.get('/api/projects/:user_id', async (req, res) => {
  const { user_id } = req.params;
  try {
    const connection = await pool.getConnection();
    const [projects] = await connection.query(
      'SELECT * FROM project WHERE user_id = ? ORDER BY project_id DESC',
      [user_id]
    );
    connection.release();
    res.json({ status: 'success', projects });
  } catch (error) {
    console.error("❌ Fetch Projects Error:", error);
    res.status(500).json({ status: 'error', message: 'ดึงข้อมูลโปรเจกต์ไม่สำเร็จ' });
  }
});
// ดึงข้อมูลโปรเจกต์ตาม ID
app.get('/api/projects/detail/:id', async (req, res) => {
    const projectId = req.params.id;
    
    // ตรวจสอบว่ามี id ส่งมาหรือไม่
    if (!projectId || projectId === 'undefined') {
        return res.status(400).json({ status: 'error', message: 'Invalid Project ID' });
    }

    try {
        const connection = await pool.getConnection();
        const [result] = await connection.query("SELECT * FROM project WHERE project_id = ?", [projectId]);
        connection.release();

        if (result.length > 0) {
            // ส่งข้อมูลกลับไปให้ React
            return res.json({ status: 'success', project: result[0] });
        } else {
            return res.status(404).json({ status: 'error', message: 'ไม่พบโปรเจกต์นี้' });
        }
    } catch (err) {
        console.error("Database Error (Fetch Detail):", err);
        return res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

// อัปเดตชื่อโปรเจกต์
app.put('/api/projects/:id', async (req, res) => {
    const projectId = req.params.id;
    const { name_concept } = req.body;

    if (!name_concept) {
        return res.status(400).json({ status: 'error', message: 'กรุณาส่งชื่อโปรเจกต์มาด้วย' });
    }

    try {
        const connection = await pool.getConnection();
        await connection.query("UPDATE project SET name_concept = ? WHERE project_id = ?", [name_concept, projectId]);
        connection.release();
        
        return res.json({ status: 'success', message: 'อัปเดตชื่อสำเร็จ' });
    } catch (err) {
        console.error("Database Error (Update Name):", err);
        return res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});