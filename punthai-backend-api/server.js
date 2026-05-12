import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
//import Replicate from "replicate"; 
import OpenAI from "openai";
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';

// สร้าง Client สำหรับตรวจสอบ Token จาก Google
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);


import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static('uploads'));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const googleImagen = new OpenAI({
    apiKey: process.env.GEMINI_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});

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

// Setup โฟลเดอร์สำหรับเก็บรูปภาพ
const uploadDir = path.join(process.cwd(), 'uploads');
const generatedDir = path.join(uploadDir, 'generated');

// สร้างโฟลเดอร์อัตโนมัติถ้ายังไม่มี
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(generatedDir)) {
    fs.mkdirSync(generatedDir, { recursive: true });
}

// ตั้งค่า Multer สำหรับรูปภาพที่ User อัปโหลดมาเอง
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/') // 👈 เก็บในโฟลเดอร์ uploads/
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname))
  }
});
const upload = multer({ storage: storage });

// ================= API LOGIN & REGISTER =================
// ================= API LOGIN & REGISTER (อัปเดตใหม่) =================
app.post('/api/register', upload.single('img_profile'), async (req, res) => {
  const { user_name, password, email, first_name, last_name } = req.body; 
  const image_profile = req.file ? req.file.filename : null; 
  const subscription_status = 'STANDARD';

  if (!user_name || !password || !email) {
      return res.status(400).json({ status: 'error', message: 'ข้อมูลไม่ครบถ้วน!' });
  }

  try {
    const connection = await pool.getConnection();
    const [checkUser] = await connection.query('SELECT * FROM user_profile WHERE user_name = ? OR email = ?', [user_name, email]);
    if (checkUser.length > 0) {
      connection.release();
      return res.status(400).json({ status: 'error', message: 'ชื่อผู้ใช้หรืออีเมลนี้มีอยู่ในระบบแล้ว' });
    }

    // 🔒 เข้ารหัสผ่านด้วย bcrypt ก่อนบันทึกลงฐานข้อมูล (เพิ่มความปลอดภัยสูงสุด)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const [result] = await connection.query(
      `INSERT INTO user_profile (user_name, password, email, first_name, last_name, image_profile, subscription_status) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user_name, hashedPassword, email, first_name || null, last_name || null, image_profile, subscription_status]
    );
    const [newUser] = await connection.query('SELECT * FROM user_profile WHERE user_id = ?', [result.insertId]);
    connection.release();
    res.json({ status: 'success', message: 'สมัครสมาชิกสำเร็จ!', user: newUser[0] });
  } catch (error) {
    console.error("❌ Register Error:", error); 
    res.status(500).json({ status: 'error', message: 'Database Error', error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { user_name, password } = req.body;
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT * FROM user_profile WHERE user_name = ?', [user_name]);

    if (rows.length > 0) {
      const user = rows[0];
      let validPassword = false;

      // 🔍 เช็คว่ารหัสผ่านใน Database เป็น Hash หรือยัง?
      // (ปกติ Hash ของ bcrypt จะขึ้นต้นด้วย $2a$, $2b$ หรือ $2y$)
      const isHashed = user.password && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$'));

      if (isHashed) {
        // 🔒 กรณีที่ 1: เป็นบัญชีใหม่ที่เข้ารหัสแล้ว
        validPassword = await bcrypt.compare(password, user.password);
      } else {
        // 🔓 กรณีที่ 2: เป็นบัญชีเก่าที่ยังไม่ได้เข้ารหัส (Plain Text)
        if (password === user.password) {
          validPassword = true;

          // 💡 [อัปเกรดอัตโนมัติ] เมื่อบัญชีเก่าล็อกอินสำเร็จ ให้ทำการ Hash รหัสผ่านเซฟกลับลง Database ทันที
          try {
            const salt = await bcrypt.genSalt(10);
            const newHashedPassword = await bcrypt.hash(password, salt);
            await connection.query('UPDATE user_profile SET password = ? WHERE user_id = ?', [newHashedPassword, user.user_id]);
            console.log(`✅ อัปเกรดความปลอดภัยให้บัญชีเก่า: ${user_name} เรียบร้อยแล้ว!`);
          } catch (hashErr) {
            console.error("Auto-migrate password error:", hashErr);
          }
        }
      }

      connection.release();

      if (validPassword) {
        // เอา password ออกจาก object ก่อนส่งกลับไปให้ Frontend เพื่อความปลอดภัย
        delete user.password; 
        res.json({ status: 'success', message: 'เข้าสู่ระบบสำเร็จ!', user: user });
      } else {
        res.status(401).json({ status: 'error', message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
      }
    } else {
      connection.release();
      res.status(401).json({ status: 'error', message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ status: 'error', message: 'Error Server', error: error.message });
  }
});

// ================= API GOOGLE AUTH (เพิ่มใหม่) =================
app.post('/api/auth/google', async (req, res) => {
  const { token } = req.body;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, given_name, family_name, picture } = payload; // ดึง picture ออกมา

    const connection = await pool.getConnection();
    const [users] = await connection.query('SELECT * FROM user_profile WHERE email = ?', [email]);
    
    if (users.length > 0) {
      // 🟢 ถ้ามีบัญชีอยู่แล้ว ให้ อัปเดต รูปโปรไฟล์จาก Google เข้าไปใหม่
      await connection.query('UPDATE user_profile SET google_id = ?, image_profile = ? WHERE email = ?', [googleId, picture, email]);
      const [updatedUser] = await connection.query('SELECT * FROM user_profile WHERE email = ?', [email]);
      connection.release();
      return res.json({ status: 'success', message: 'เข้าสู่ระบบด้วย Google สำเร็จ', user: updatedUser[0] });
    } else {
      // 🟢 ถ้ายังไม่มีบัญชี ให้เพิ่ม picture ลงในฐานข้อมูลด้วย
      const randomPassword = await bcrypt.hash(Math.random().toString(36).slice(-8), 10);
      const baseUserName = email.split('@')[0];
      
      const [result] = await connection.query(
        `INSERT INTO user_profile (user_name, password, email, first_name, last_name, google_id, image_profile, subscription_status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, 'STANDARD')`,
        [baseUserName, randomPassword, email, given_name, family_name, googleId, picture]
      );
      const [newUser] = await connection.query('SELECT * FROM user_profile WHERE user_id = ?', [result.insertId]);
      connection.release();
      return res.json({ status: 'success', message: 'สมัครสมาชิกด้วย Google สำเร็จ', user: newUser[0] });
    }
  } catch (error) {
    console.error("Google Auth Error:", error);
    res.status(500).json({ status: 'error', message: 'Google Authentication Failed' });
  }
});

// ================= API UPDATE PROFILE =================
app.put('/api/users/profile/:userId', upload.single('image_profile'), async (req, res) => {
    const { userId } = req.params;
    const { first_name, last_name, user_name, password } = req.body;
    const image_profile = req.file ? req.file.filename : null;

    try {
        const connection = await pool.getConnection();

        // 1. สร้าง Query สำหรับอัปเดตข้อมูลพื้นฐาน
        let query = "UPDATE user_profile SET first_name = ?, last_name = ?, user_name = ?";
        let params = [first_name || null, last_name || null, user_name];

        // 2. ถ้าผู้ใช้กรอกรหัสผ่านใหม่มา ให้เข้ารหัสและอัปเดตด้วย
        if (password && password.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            query += ", password = ?";
            params.push(hashedPassword);
        }

        // 3. ถ้าผู้ใช้อัปโหลดรูปใหม่มา ให้อัปเดตชื่อไฟล์รูปด้วย
        if (image_profile) {
            query += ", image_profile = ?";
            params.push(image_profile);
        }

        query += " WHERE user_id = ?";
        params.push(userId);

        await connection.query(query, params);

        // 4. ดึงข้อมูลผู้ใช้ที่อัปเดตแล้วส่งกลับไปให้ Frontend
        const [updatedRows] = await connection.query("SELECT * FROM user_profile WHERE user_id = ?", [userId]);
        connection.release();

        if (updatedRows.length > 0) {
            const updatedUser = updatedRows[0];
            delete updatedUser.password; // ลบรหัสผ่านออกก่อนส่งกลับเพื่อความปลอดภัย
            res.json({ status: 'success', message: 'อัปเดตข้อมูลโปรไฟล์เรียบร้อยแล้ว', user: updatedUser });
        } else {
            res.status(404).json({ status: 'error', message: 'ไม่พบผู้ใช้งานในระบบ' });
        }

    } catch (err) {
        console.error("Update profile error:", err);
        res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดที่ฐานข้อมูล' });
    }
});


// ================= 4. API จัดการโปรเจกต์ (Projects) =================
app.post('/api/projects', async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ status: 'error', message: 'ไม่พบ user_id' });
  try {
    const connection = await pool.getConnection();
    const [result] = await connection.query(
      'INSERT INTO project (user_id, status) VALUES (?, ?)',
      [user_id, 'ยังไม่ได้เริ่ม']
    );
    connection.release();
    res.json({ status: 'success', message: 'สร้างโปรเจกต์สำเร็จ', project_id: result.insertId });
  } catch (error) {
    console.error("❌ Create Project Error:", error);
    res.status(500).json({ status: 'error', message: 'สร้างโปรเจกต์ไม่สำเร็จ', error: error.message });
  }
});

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

app.get('/api/projects/detail/:id', async (req, res) => {
    const projectId = req.params.id;
    if (!projectId || projectId === 'undefined') {
        return res.status(400).json({ status: 'error', message: 'Invalid Project ID' });
    }
    try {
        const connection = await pool.getConnection();
        const [result] = await connection.query("SELECT * FROM project WHERE project_id = ?", [projectId]);
        connection.release();
        if (result.length > 0) {
            return res.json({ status: 'success', project: result[0] });
        } else {
            return res.status(404).json({ status: 'error', message: 'ไม่พบโปรเจกต์นี้' });
        }
    } catch (err) {
        console.error("Database Error (Fetch Detail):", err);
        return res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

app.put('/api/projects/:id', async (req, res) => {
    const projectId = req.params.id;
    const { project_name } = req.body;
    if (!project_name) {
        return res.status(400).json({ status: 'error', message: 'กรุณาส่งชื่อโปรเจกต์มาด้วย' });
    }
    try {
        const connection = await pool.getConnection();
        await connection.query("UPDATE project SET project_name = ? WHERE project_id = ?", [project_name, projectId]);
        connection.release();
        return res.json({ status: 'success', message: 'อัปเดตชื่อสำเร็จ' });
    } catch (err) {
        console.error("Database Error (Update Name):", err);
        return res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

app.get('/api/projects/:projectId/selected-assets', async (req, res) => {
    const { projectId } = req.params;
    try {
        const connection = await pool.getConnection();
        const [colorRows] = await connection.query(`
            SELECT c.* FROM color_concept cc
            JOIN color c ON cc.color_id = c.color_id
            WHERE cc.project_id = ? AND cc.is_selected = 1
            LIMIT 1
        `, [projectId]);
        const [fontRows] = await connection.query(`
            SELECT f.* FROM font_concept fc
            JOIN font f ON fc.font_id = f.font_id
            WHERE fc.project_id = ? AND fc.is_selected = 1
            LIMIT 1
        `, [projectId]);
        connection.release();
        res.json({
            status: 'success',
            color: colorRows.length > 0 ? colorRows[0] : null,
            font: fontRows.length > 0 ? fontRows[0] : null
        });
    } catch (err) {
        console.error("Fetch selected assets error:", err);
        res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

app.delete('/api/projects/:id', async (req, res) => {
    const projectId = req.params.id;
    try {
        const connection = await pool.getConnection();
        await connection.query("DELETE FROM project WHERE project_id = ?", [projectId]);
        connection.release();
        return res.json({ status: 'success', message: 'ลบโปรเจกต์สำเร็จ' });
    } catch (err) {
        console.error("Delete Project Error:", err);
        return res.status(500).json({ status: 'error', message: 'ไม่สามารถลบโปรเจกต์ได้ อาจมีข้อมูลเชื่อมโยงอยู่' });
    }
});

app.get('/api/brand_product/:projectId', async (req, res) => {
    const { projectId } = req.params;
    try {
        const connection = await pool.getConnection();
        const [products] = await connection.query("SELECT * FROM brand_product WHERE project_id = ?", [projectId]);
        connection.release();
        res.json({ status: 'success', products });
    } catch (err) {
        console.error("Fetch products error:", err);
        res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

app.post('/api/brand_product', upload.single('image_product'), async (req, res) => {
    const { project_id, name_product, type_product } = req.body;
    const image_product = req.file ? req.file.filename : null;
    if (!project_id || !name_product || !type_product) {
        return res.status(400).json({ status: 'error', message: 'ข้อมูลไม่ครบถ้วน' });
    }
    try {
        const connection = await pool.getConnection();
        const sql = `INSERT INTO brand_product (project_id, name_product, type_product, image_product) VALUES (?, ?, ?, ?)`;
        await connection.query(sql, [project_id, name_product, type_product, image_product]);
        connection.release();
        res.json({ status: 'success', message: 'เพิ่มสินค้าสำเร็จ' });
    } catch (err) {
        console.error("Insert product error:", err);
        res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

// ================= API วิเคราะห์ Brand DNA ด้วย Gemini =================
// 🎯 รวม DNA + Colors + Fonts ใน Gemini call เดียว → ประหยัด 50%
app.post('/api/generate-brand-dna', async (req, res) => {
    const { project_id, user_id, business_type, archetype, audience_data } = req.body;
    if (!project_id) return res.status(400).json({ status: 'error', message: 'Missing project_id' });

    try {
        const connection = await pool.getConnection();

        const [products] = await connection.query(
            "SELECT name_product, type_product FROM brand_product WHERE project_id = ?",
            [project_id]
        );
        let productsText = "ยังไม่มีข้อมูลสินค้า";
        if (products.length > 0) {
            productsText = products.map((p, i) => `        ${i + 1}. ${p.name_product} (${p.type_product})`).join('\n');
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
        คุณเป็น Brand Strategist และ Designer มืออาชีพ
        ข้อมูลแบรนด์:
        - รูปแบบธุรกิจ: ${business_type}
        - Archetype: ${archetype}
        - กลุ่มเป้าหมายเบื้องต้น: ${audience_data}
        - สินค้า:
${productsText}

        วิเคราะห์และตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่นๆ โครงสร้าง:
        {
            "target_audience": "วิเคราะห์เจาะลึกกลุ่มเป้าหมาย",
            "brand_value": "คุณค่าหลักของแบรนด์ สั้น กระชับ",
            "customer_perception": "ลูกค้ารู้สึก/มองเห็นแบรนด์ยังไง",
            "design_suggestions": ["คำแนะนำการออกแบบ 1", "คำแนะนำ 2", "คำแนะนำ 3"],
            "color": {
                "name_palette": "ชื่อชุดสี เช่น Earth Tone, Ocean Breeze",
                "hex1": "#...", "hex2": "#...", "hex3": "#...", "hex4": "#...", "hex5": "#..."
            },
            "font": {
                "font_name": "ชื่อ Google Font ที่รองรับภาษาไทย เช่น Prompt, Kanit, Sarabun, Noto Sans Thai, Mali, Mitr"
            }
        }
        `;

        const result = await model.generateContent(prompt);
        const cleanedText = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const aiData = JSON.parse(cleanedText);

        // Save brand_dna
        await connection.query(`
            INSERT INTO brand_dna (project_id, business_type, archetype_name, target_audience, brand_value, customer_perception, design_suggestions)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            business_type=VALUES(business_type), archetype_name=VALUES(archetype_name),
            target_audience=VALUES(target_audience), brand_value=VALUES(brand_value),
            customer_perception=VALUES(customer_perception), design_suggestions=VALUES(design_suggestions)
        `, [project_id, business_type, archetype, aiData.target_audience, aiData.brand_value, aiData.customer_perception, JSON.stringify(aiData.design_suggestions)]);

        // Save color (upsert)
        const c = aiData.color;
        let color_id, color_concept_id;
        const [exColor] = await connection.query('SELECT color_id FROM color WHERE name_palette = ?', [c.name_palette]);
        if (exColor.length > 0) {
            color_id = exColor[0].color_id;
            await connection.query('UPDATE color SET color_code_1=?, color_code_2=?, color_code_3=?, color_code_4=?, color_code_5=? WHERE color_id=?',
                [c.hex1, c.hex2, c.hex3, c.hex4, c.hex5, color_id]);
        } else {
            const [r] = await connection.query('INSERT INTO color (name_palette, color_code_1, color_code_2, color_code_3, color_code_4, color_code_5) VALUES (?,?,?,?,?,?)',
                [c.name_palette, c.hex1, c.hex2, c.hex3, c.hex4, c.hex5]);
            color_id = r.insertId;
        }
        const [exCC] = await connection.query('SELECT id FROM color_concept WHERE project_id=? AND color_id=?', [project_id, color_id]);
        if (exCC.length > 0) color_concept_id = exCC[0].id;
        else {
            const [r] = await connection.query('INSERT INTO color_concept (color_id, project_id, is_liked, is_selected) VALUES (?, ?, 0, 0)', [color_id, project_id]);
            color_concept_id = r.insertId;
        }

        // Save font (upsert)
        const f = aiData.font;
        let font_id, font_concept_id;
        const [exFont] = await connection.query('SELECT font_id FROM font WHERE font_name=?', [f.font_name]);
        if (exFont.length > 0) font_id = exFont[0].font_id;
        else {
            const [r] = await connection.query('INSERT INTO font (font_name) VALUES (?)', [f.font_name]);
            font_id = r.insertId;
        }
        const [exFC] = await connection.query('SELECT id FROM font_concept WHERE project_id=? AND font_id=?', [project_id, font_id]);
        if (exFC.length > 0) font_concept_id = exFC[0].id;
        else {
            const [r] = await connection.query('INSERT INTO font_concept (font_id, project_id, is_liked, is_selected) VALUES (?, ?, 0, 0)', [font_id, project_id]);
            font_concept_id = r.insertId;
        }

        await connection.query('INSERT INTO api_logs (user_id, project_id, action_type, prompt_sent, ai_response) VALUES (?, ?, ?, ?, ?)',
            [user_id || 0, project_id, 'GENERATE_BRAND_DNA_FULL', prompt, cleanedText]);

        connection.release();

        res.json({
            status: 'success',
            data: {
                archetype, ...aiData,
                color: { id: color_concept_id, color_id, ...c },
                font: { id: font_concept_id, font_id, ...f }
            }
        });
    } catch (err) {
        console.error("Brand DNA Full Error:", err);
        res.status(500).json({ status: 'error', message: 'AI processing error' });
    }
});

app.get('/api/brand_dna/:projectId', async (req, res) => {
    const { projectId } = req.params;
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.query("SELECT * FROM brand_dna WHERE project_id = ?", [projectId]);
        connection.release();
        if (rows.length > 0) {
            let dna = rows[0];
            try { dna.design_suggestions = JSON.parse(dna.design_suggestions); } catch (e) {}
            res.json({ status: 'success', data: dna });
        } else {
            res.json({ status: 'not_found' });
        }
    } catch (err) {
        console.error("Fetch DNA error:", err);
        res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

// ================= API แนะนำสีและฟอนต์ =================
// 🛡 Cache-first: คืนของเก่าจาก DB ทันที ไม่เผา token
// ?force=1 = บังคับเรียก Gemini ใหม่ (เฉพาะกรณีผู้ใช้กดปุ่ม "ขอใหม่")
app.get('/api/recommend-assets/:projectId', async (req, res) => {
    const { projectId } = req.params;
    const { force } = req.query;

    try {
        const connection = await pool.getConnection();

        if (!force) {
            const [colorRows] = await connection.query(`
                SELECT c.*, cc.id AS concept_id 
                FROM color_concept cc JOIN color c ON cc.color_id = c.color_id 
                WHERE cc.project_id = ? ORDER BY cc.id DESC LIMIT 1
            `, [projectId]);
            const [fontRows] = await connection.query(`
                SELECT f.*, fc.id AS concept_id 
                FROM font_concept fc JOIN font f ON fc.font_id = f.font_id 
                WHERE fc.project_id = ? ORDER BY fc.id DESC LIMIT 1
            `, [projectId]);

            connection.release();
            console.log(`[CACHE] recommend-assets project=${projectId} (skip Gemini)`);
            return res.json({
                status: 'success', cached: true,
                color: colorRows[0] ? {
                    id: colorRows[0].concept_id, color_id: colorRows[0].color_id,
                    name_palette: colorRows[0].name_palette,
                    hex1: colorRows[0].color_code_1, hex2: colorRows[0].color_code_2,
                    hex3: colorRows[0].color_code_3, hex4: colorRows[0].color_code_4,
                    hex5: colorRows[0].color_code_5
                } : null,
                font: fontRows[0] ? {
                    id: fontRows[0].concept_id, font_id: fontRows[0].font_id,
                    font_name: fontRows[0].font_name
                } : null
            });
        }

        // ===== Force regenerate (call Gemini) — โค้ดเดิมที่เคยมี =====
        const [dnaRows] = await connection.query("SELECT * FROM brand_dna WHERE project_id = ?", [projectId]);
        const [prodRows] = await connection.query("SELECT name_product, type_product FROM brand_product WHERE project_id = ?", [projectId]);
        if (dnaRows.length === 0) {
            connection.release();
            return res.status(400).json({ status: 'error', message: 'ไม่พบข้อมูล Brand DNA' });
        }
        const dna = dnaRows[0];
        const productsText = prodRows.map(p => `${p.name_product} (${p.type_product})`).join(', ') || 'ไม่มี';

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `
        คุณเป็นนักออกแบบแบรนด์มืออาชีพ
        - รูปแบบธุรกิจ: ${dna.business_type}
        - Archetype: ${dna.archetype_name}
        - กลุ่มเป้าหมาย: ${dna.target_audience}
        - สินค้า: ${productsText}

        แนะนำชุดสีใหม่ (5 สี) และฟอนต์ใหม่ (Google Fonts รองรับไทย) ที่ "ต่างจากของเดิม"
        ตอบ JSON: {"color":{"name_palette":"...","hex1":"#...","hex2":"#...","hex3":"#...","hex4":"#...","hex5":"#..."},"font":{"font_name":"..."}}`;
        const result = await model.generateContent(prompt);
        const cleanedText = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const aiData = JSON.parse(cleanedText);

        const c = aiData.color;
        let color_id, color_concept_id;
        const [exColor] = await connection.query('SELECT color_id FROM color WHERE name_palette = ?', [c.name_palette]);
        if (exColor.length > 0) {
            color_id = exColor[0].color_id;
            await connection.query('UPDATE color SET color_code_1=?, color_code_2=?, color_code_3=?, color_code_4=?, color_code_5=? WHERE color_id=?',
                [c.hex1, c.hex2, c.hex3, c.hex4, c.hex5, color_id]);
        } else {
            const [r] = await connection.query('INSERT INTO color (name_palette, color_code_1, color_code_2, color_code_3, color_code_4, color_code_5) VALUES (?,?,?,?,?,?)',
                [c.name_palette, c.hex1, c.hex2, c.hex3, c.hex4, c.hex5]);
            color_id = r.insertId;
        }
        const [exCC] = await connection.query('SELECT id FROM color_concept WHERE project_id=? AND color_id=?', [projectId, color_id]);
        if (exCC.length > 0) color_concept_id = exCC[0].id;
        else {
            const [r] = await connection.query('INSERT INTO color_concept (color_id, project_id, is_liked, is_selected) VALUES (?, ?, 0, 0)', [color_id, projectId]);
            color_concept_id = r.insertId;
        }

        const f = aiData.font;
        let font_id, font_concept_id;
        const [exFont] = await connection.query('SELECT font_id FROM font WHERE font_name = ?', [f.font_name]);
        if (exFont.length > 0) font_id = exFont[0].font_id;
        else {
            const [r] = await connection.query('INSERT INTO font (font_name) VALUES (?)', [f.font_name]);
            font_id = r.insertId;
        }
        const [exFC] = await connection.query('SELECT id FROM font_concept WHERE project_id=? AND font_id=?', [projectId, font_id]);
        if (exFC.length > 0) font_concept_id = exFC[0].id;
        else {
            const [r] = await connection.query('INSERT INTO font_concept (font_id, project_id, is_liked, is_selected) VALUES (?, ?, 0, 0)', [font_id, projectId]);
            font_concept_id = r.insertId;
        }

        connection.release();
        res.json({
            status: 'success', cached: false,
            color: { id: color_concept_id, color_id, ...c },
            font: { id: font_concept_id, font_id, ...f }
        });
    } catch (err) {
        console.error("Recommend assets error:", err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// 📦 อ่าน DNA + Color + Font ของ project จาก DB ครบในครั้งเดียว (0 Gemini)
app.get('/api/brand-dna-full/:projectId', async (req, res) => {
    const { projectId } = req.params;
    try {
        const connection = await pool.getConnection();

        const [dnaRows] = await connection.query("SELECT * FROM brand_dna WHERE project_id = ?", [projectId]);
        let dna = null;
        if (dnaRows.length > 0) {
            dna = dnaRows[0];
            try { dna.design_suggestions = JSON.parse(dna.design_suggestions); } catch (e) {}
        }

        const [colorRows] = await connection.query(`
            SELECT c.*, cc.id AS concept_id 
            FROM color_concept cc JOIN color c ON cc.color_id = c.color_id 
            WHERE cc.project_id = ? ORDER BY cc.id DESC LIMIT 1
        `, [projectId]);
        const [fontRows] = await connection.query(`
            SELECT f.*, fc.id AS concept_id 
            FROM font_concept fc JOIN font f ON fc.font_id = f.font_id 
            WHERE fc.project_id = ? ORDER BY fc.id DESC LIMIT 1
        `, [projectId]);

        connection.release();
        res.json({
            status: 'success',
            dna,
            color: colorRows[0] ? {
                id: colorRows[0].concept_id, color_id: colorRows[0].color_id,
                name_palette: colorRows[0].name_palette,
                hex1: colorRows[0].color_code_1, hex2: colorRows[0].color_code_2,
                hex3: colorRows[0].color_code_3, hex4: colorRows[0].color_code_4,
                hex5: colorRows[0].color_code_5
            } : null,
            font: fontRows[0] ? {
                id: fontRows[0].concept_id, font_id: fontRows[0].font_id,
                font_name: fontRows[0].font_name
            } : null
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});


// ================= API Create Concept (Brand Name) =================
app.post('/api/generate-brand-names', async (req, res) => {
    const { project_id, user_id, product, category, benefit, target, tags, special, use_dna } = req.body;
    try {
        const connection = await pool.getConnection();
        let finalTarget = target;
        if (use_dna) {
            const [dnaRows] = await connection.query("SELECT target_audience FROM brand_dna WHERE project_id = ?", [project_id]);
            if (dnaRows.length > 0 && dnaRows[0].target_audience) {
                finalTarget = dnaRows[0].target_audience;
            }
        }
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `
        คุณเป็นผู้เชี่ยวชาญด้านการตั้งชื่อแบรนด์ (Brand Naming Expert)
        ข้อมูลสินค้า:
        - สินค้า: ${product}
        - ประเภท: ${category}
        - ประโยชน์/จุดเด่น: ${benefit || 'ไม่ระบุ'}
        - กลุ่มเป้าหมาย: ${finalTarget,target}
        - สไตล์ชื่อที่ต้องการ: ${tags.join(', ')}
        - ความต้องการพิเศษ: ${special || 'ไม่ระบุ'}

        กรุณาคิดชื่อแบรนด์ที่เหมาะสมที่สุดมาจำนวน "10 ชื่อ" 
        ส่งผลลัพธ์กลับมาเป็น JSON Array ที่มีแต่ String เท่านั้น ห้ามมีข้อความอื่น เช่น:
        ["ชื่อที่1", "ชื่อที่2", "ชื่อที่3", ...]
        `;
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const generatedNames = JSON.parse(cleanedText);
        for (const name of generatedNames) {
            await connection.query("INSERT INTO name_concept (project_id, brand_name) VALUES (?, ?)", [project_id, name]);
        }
        await connection.query(
            "INSERT INTO generated_text_history (project_id, generation_type, prompt, text_result, model_name) VALUES (?, ?, ?, ?, ?)",
            [project_id, 'BRAND_NAME', prompt, cleanedText, 'gemini-2.5-flash']
        );
        connection.release();
        res.json({ status: 'success', message: 'สร้างชื่อสำเร็จ' });
    } catch (err) {
        console.error("Generate Name Error:", err);
        res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดในการสร้างชื่อ' });
    }
});

app.get('/api/brand-names/:projectId', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.query(
            "SELECT * FROM name_concept WHERE project_id = ? ORDER BY is_selected DESC, is_liked DESC, concept_id DESC",
            [req.params.projectId]
        );
        connection.release();
        res.json({ status: 'success', names: rows });
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

app.put('/api/brand-names/like/:conceptId', async (req, res) => {
    const { is_liked } = req.body;
    try {
        const connection = await pool.getConnection();
        await connection.query("UPDATE name_concept SET is_liked = ? WHERE concept_id = ?", [is_liked, req.params.conceptId]);
        connection.release();
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

app.put('/api/brand-names/select/:conceptId', async (req, res) => {
    const { project_id } = req.body;
    const concept_id = req.params.conceptId;
    try {
        const connection = await pool.getConnection();
        await connection.query("UPDATE name_concept SET is_selected = FALSE WHERE project_id = ?", [project_id]);
        await connection.query("UPDATE name_concept SET is_selected = TRUE WHERE concept_id = ?", [concept_id]);
        await connection.query("UPDATE project SET name_concept_id = ? WHERE project_id = ?", [concept_id, project_id]);
        connection.release();
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

// ================= API Color Palette =================
app.post('/api/color-palettes/save-one', async (req, res) => {
  const { project_id, name_palette, color_code_1, color_code_2, color_code_3, color_code_4, color_code_5 } = req.body;
  if (!project_id || !name_palette) return res.status(400).json({ status: 'error', message: 'ข้อมูลไม่ครบถ้วน' });
  try {
    const connection = await pool.getConnection();
    const [existing] = await connection.query('SELECT color_id FROM color WHERE name_palette = ?', [name_palette]);
    let color_id;
    if (existing.length > 0) {
      color_id = existing[0].color_id;
      await connection.query(
        'UPDATE color SET color_code_1=?, color_code_2=?, color_code_3=?, color_code_4=?, color_code_5=? WHERE color_id=?',
        [color_code_1||'', color_code_2||'', color_code_3||'', color_code_4||'', color_code_5||'', color_id]
      );
    } else {
      const [result] = await connection.query(
        'INSERT INTO color (name_palette, color_code_1, color_code_2, color_code_3, color_code_4, color_code_5) VALUES (?,?,?,?,?,?)',
        [name_palette, color_code_1||'', color_code_2||'', color_code_3||'', color_code_4||'', color_code_5||'']
      );
      color_id = result.insertId;
    }
    const [existingConcept] = await connection.query(
      'SELECT id FROM color_concept WHERE project_id = ? AND color_id = ?', [project_id, color_id]);
    let concept_id;
    if (existingConcept.length > 0) {
      concept_id = existingConcept[0].id;
    } else {
      const [result] = await connection.query(
        'INSERT INTO color_concept (color_id, project_id, is_liked, is_selected) VALUES (?, ?, 0, 0)',
        [color_id, project_id]);
      concept_id = result.insertId;
    }
    connection.release();
    res.json({ status: 'success', color_id, concept_id });
  } catch (err) {
    console.error('❌ Save One Palette Error:', err);
    res.status(500).json({ status: 'error', message: 'บันทึก palette ไม่สำเร็จ', error: err.message });
  }
});

app.post('/api/color-palettes/save', async (req, res) => {
  const { project_id, palettes } = req.body;
  if (!project_id || !Array.isArray(palettes) || palettes.length === 0) {
    return res.status(400).json({ status: 'error', message: 'ข้อมูลไม่ครบถ้วน' });
  }
  try {
    const connection = await pool.getConnection();
    for (const p of palettes) {
      const [existing] = await connection.query('SELECT color_id FROM color WHERE name_palette = ?', [p.name_palette]);
      let color_id;
      if (existing.length > 0) {
        color_id = existing[0].color_id;
        await connection.query(
          'UPDATE color SET color_code_1=?, color_code_2=?, color_code_3=?, color_code_4=?, color_code_5=? WHERE color_id=?',
          [p.color_code_1||'', p.color_code_2||'', p.color_code_3||'', p.color_code_4||'', p.color_code_5||'', color_id]);
      } else {
        const [result] = await connection.query(
          'INSERT INTO color (name_palette, color_code_1, color_code_2, color_code_3, color_code_4, color_code_5) VALUES (?,?,?,?,?,?)',
          [p.name_palette, p.color_code_1||'', p.color_code_2||'', p.color_code_3||'', p.color_code_4||'', p.color_code_5||'']);
        color_id = result.insertId;
      }
      const [existingConcept] = await connection.query(
        'SELECT id FROM color_concept WHERE project_id = ? AND color_id = ?', [project_id, color_id]);
      if (existingConcept.length === 0) {
        await connection.query(
          'INSERT INTO color_concept (color_id, project_id, is_liked, is_selected) VALUES (?, ?, 0, 0)', [color_id, project_id]);
      }
    }
    connection.release();
    res.json({ status: 'success', message: 'บันทึก palettes สำเร็จ' });
  } catch (err) {
    console.error('❌ Save Color Palettes Error:', err);
    res.status(500).json({ status: 'error', message: 'บันทึก palettes ไม่สำเร็จ', error: err.message });
  }
});

app.get('/api/color-palettes/:projectId', async (req, res) => {
  const { projectId } = req.params;
  if (!projectId || projectId === 'undefined') return res.status(400).json({ status: 'error', message: 'Invalid Project ID' });
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT cc.id AS concept_id, cc.color_id, cc.is_liked, cc.is_selected, cc.created_at,
         c.name_palette, c.color_code_1, c.color_code_2, c.color_code_3, c.color_code_4, c.color_code_5
       FROM color_concept cc JOIN color c ON cc.color_id = c.color_id
       WHERE cc.project_id = ?
       ORDER BY cc.is_selected DESC, cc.is_liked DESC, cc.id DESC`, [projectId]);
    connection.release();
    res.json({ status: 'success', palettes: rows });
  } catch (err) {
    console.error('❌ Fetch Color Palettes Error:', err);
    res.status(500).json({ status: 'error', message: 'ดึงข้อมูล palettes ไม่สำเร็จ' });
  }
});

app.put('/api/color-palettes/like/:colorId', async (req, res) => {
  const { colorId } = req.params;
  const { is_liked, project_id } = req.body;
  if (!project_id) return res.status(400).json({ status: 'error', message: 'ต้องการ project_id' });
  try {
    const connection = await pool.getConnection();
    await connection.query(
      'UPDATE color_concept SET is_liked = ? WHERE color_id = ? AND project_id = ?',
      [is_liked ? 1 : 0, colorId, project_id]);
    connection.release();
    res.json({ status: 'success' });
  } catch (err) {
    console.error('❌ Like Color Palette Error:', err);
    res.status(500).json({ status: 'error', message: 'Database error' });
  }
});

app.put('/api/color-palettes/select/:conceptId', async (req, res) => {
  const { conceptId } = req.params;
  const { project_id } = req.body;
  if (!project_id) return res.status(400).json({ status: 'error', message: 'ต้องการ project_id' });
  try {
    const connection = await pool.getConnection();
    const [conceptRows] = await connection.query('SELECT color_id FROM color_concept WHERE id = ?', [conceptId]);
    if (conceptRows.length === 0) {
      connection.release();
      return res.status(404).json({ status: 'error', message: 'ไม่พบ concept นี้' });
    }
    const finalColorId = conceptRows[0].color_id;
    await connection.query('UPDATE color_concept SET is_selected = 0 WHERE project_id = ?', [project_id]);
    await connection.query('UPDATE color_concept SET is_selected = 1 WHERE id = ?', [conceptId]);
    await connection.query('UPDATE project SET color_id = ? WHERE project_id = ?', [finalColorId, project_id]);
    connection.release();
    res.json({ status: 'success', color_id: finalColorId });
  } catch (err) {
    console.error('❌ Select Color Palette Error:', err);
    res.status(500).json({ status: 'error', message: 'Database error' });
  }
});

// ================= API Font =================
app.post('/api/fonts/sync-google', async (req, res) => {
  const { fonts } = req.body;
  if (!Array.isArray(fonts) || fonts.length === 0) return res.status(400).json({ status: 'error', message: 'ข้อมูลไม่ครบถ้วน' });
  try {
    const connection = await pool.getConnection();
    let inserted = 0;
    for (const f of fonts) {
      const [existing] = await connection.query('SELECT font_id FROM font WHERE font_name = ?', [f.font_name]);
      if (existing.length === 0) {
        await connection.query('INSERT INTO font (font_name, file_font) VALUES (?, NULL)', [f.font_name]);
        inserted++;
      }
    }
    connection.release();
    res.json({ status: 'success', inserted });
  } catch (err) {
    console.error('❌ Sync Google Fonts Error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/api/fonts/all/:projectId', async (req, res) => {
  const { projectId } = req.params;
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT f.font_id, f.font_name, f.file_font,
         fc.id AS concept_id, fc.is_liked, fc.is_selected
       FROM font f
       LEFT JOIN font_concept fc ON f.font_id = fc.font_id AND fc.project_id = ?
       ORDER BY f.font_id ASC`, [projectId]);
    connection.release();
    res.json({ status: 'success', fonts: rows });
  } catch (err) {
    console.error('❌ Fetch All Fonts Error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/api/fonts/save-one', async (req, res) => {
  const { project_id, font_name, file_font } = req.body;
  if (!project_id || !font_name) return res.status(400).json({ status: 'error', message: 'ข้อมูลไม่ครบถ้วน' });
  try {
    const connection = await pool.getConnection();
    const [existing] = await connection.query('SELECT font_id FROM font WHERE font_name = ?', [font_name]);
    let font_id;
    if (existing.length > 0) {
      font_id = existing[0].font_id;
    } else {
      const [result] = await connection.query('INSERT INTO font (font_name, file_font) VALUES (?, ?)', [font_name, file_font || null]);
      font_id = result.insertId;
    }
    const [existingConcept] = await connection.query(
      'SELECT id FROM font_concept WHERE project_id = ? AND font_id = ?', [project_id, font_id]);
    let concept_id;
    if (existingConcept.length > 0) {
      concept_id = existingConcept[0].id;
    } else {
      const [result] = await connection.query(
        'INSERT INTO font_concept (font_id, project_id, is_liked, is_selected) VALUES (?, ?, 0, 0)', [font_id, project_id]);
      concept_id = result.insertId;
    }
    connection.release();
    res.json({ status: 'success', font_id, concept_id });
  } catch (err) {
    console.error('❌ Save One Font Error:', err);
    res.status(500).json({ status: 'error', message: 'บันทึก font ไม่สำเร็จ', error: err.message });
  }
});

app.get('/api/fonts/:projectId', async (req, res) => {
  const { projectId } = req.params;
  if (!projectId || projectId === 'undefined') return res.status(400).json({ status: 'error', message: 'Invalid Project ID' });
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT fc.id AS concept_id, fc.font_id, fc.is_liked, fc.is_selected, fc.created_at,
         f.font_name, f.file_font
       FROM font_concept fc JOIN font f ON fc.font_id = f.font_id
       WHERE fc.project_id = ?
       ORDER BY fc.is_selected DESC, fc.is_liked DESC, fc.id DESC`, [projectId]);
    connection.release();
    res.json({ status: 'success', fonts: rows });
  } catch (err) {
    console.error('❌ Fetch Fonts Error:', err);
    res.status(500).json({ status: 'error', message: 'ดึงข้อมูล fonts ไม่สำเร็จ' });
  }
});

app.put('/api/fonts/like/:fontId', async (req, res) => {
  const { fontId } = req.params;
  const { is_liked, project_id } = req.body;
  if (!project_id) return res.status(400).json({ status: 'error', message: 'ต้องการ project_id' });
  try {
    const connection = await pool.getConnection();
    await connection.query(
      'UPDATE font_concept SET is_liked = ? WHERE font_id = ? AND project_id = ?',
      [is_liked ? 1 : 0, fontId, project_id]);
    connection.release();
    res.json({ status: 'success' });
  } catch (err) {
    console.error('❌ Like Font Error:', err);
    res.status(500).json({ status: 'error', message: 'Database error' });
  }
});

app.put('/api/fonts/select/:conceptId', async (req, res) => {
  const { conceptId } = req.params;
  const { project_id } = req.body;
  if (!project_id) return res.status(400).json({ status: 'error', message: 'ต้องการ project_id' });
  try {
    const connection = await pool.getConnection();
    const [conceptRows] = await connection.query('SELECT font_id FROM font_concept WHERE id = ?', [conceptId]);
    if (conceptRows.length === 0) {
      connection.release();
      return res.status(404).json({ status: 'error', message: 'ไม่พบ concept นี้' });
    }
    const finalFontId = conceptRows[0].font_id;
    await connection.query('UPDATE font_concept SET is_selected = 0 WHERE project_id = ?', [project_id]);
    await connection.query('UPDATE font_concept SET is_selected = 1 WHERE id = ?', [conceptId]);
    await connection.query('UPDATE project SET font_id = ? WHERE project_id = ?', [finalFontId, project_id]);
    connection.release();
    res.json({ status: 'success', font_id: finalFontId });
  } catch (err) {
    console.error('❌ Select Font Error:', err);
    res.status(500).json({ status: 'error', message: 'Database error' });
  }
});

// ================= Helper: ดาวน์โหลดรูปภาพ =================
const downloadImage = async (url, filepath) => {
    const response = await axios({ url, method: 'GET', responseType: 'stream' });
    return new Promise((resolve, reject) => {
        response.data.pipe(fs.createWriteStream(filepath))
            .on('error', reject)
            .on('finish', () => resolve(filepath));
    });
};

/// create logo 
app.post('/api/generate-logo', async (req, res) => {
    const { project_id, user_id, brand_name, brand_value, products, styles, details, negative_prompt, use_imported_color, use_imported_font,target_audience } = req.body;
    if (!project_id) return res.status(400).json({ status: 'error', message: 'Project ID is required' });
    const finalUserId = (!user_id || user_id === 0) ? null : user_id;

    try {
        const connection = await pool.getConnection();
        let colorText = "";
        let fontText = "";
        if (use_imported_color) {
            const [colorRows] = await connection.query(`
                SELECT c.* FROM color_concept cc
                JOIN color c ON cc.color_id = c.color_id
                WHERE cc.project_id = ? AND cc.is_selected = 1 LIMIT 1
            `, [project_id]);
            if (colorRows.length > 0) {
                const c = colorRows[0];
                const hexColors = [c.color_code_1, c.color_code_2, c.color_code_3, c.color_code_4, c.color_code_5].filter(Boolean).join(', ');
                colorText = `STRICT COLOR PALETTE: You MUST strictly use ONLY these exact color hex codes: ${hexColors}.`;
            }
        }
        if (use_imported_font) {
            const [fontRows] = await connection.query(`
                SELECT f.* FROM font_concept fc
                JOIN font f ON fc.font_id = f.font_id
                WHERE fc.project_id = ? AND fc.is_selected = 1 LIMIT 1
            `, [project_id]);
            if (fontRows.length > 0) {
                fontText = `TYPOGRAPHY STYLE: The text should be styled specifically to look like the font "${fontRows[0].font_name}".`;
            }
        }
        connection.release();

        // รับค่า style แบบ String (ค่าเดียว) จาก Frontend
        const selectedStyle = styles;

        // ============================================================================
        // ADVANCED PROMPT ENGINEERING (Dynamic Style Injection)
        // ============================================================================
        
        let styleDirective = "";
        let typographyDirective = `The logo MUST clearly display the exact text: "${brand_name}". Understand the exact structure, anatomy, and spelling of the word "${brand_name}" and render the characters perfectly.`;
        let specificNegative = "";

        // กำหนดกฎการวาดภาพตามสไตล์ที่ผู้ใช้เลือก
        switch (selectedStyle) {
            case 'wordmark':
                styleDirective = "Format: Wordmark / Logotype. The logo consists EXCLUSIVELY of typography. NO standalone icons, NO mascots, NO complex graphics. Focus entirely on custom, beautiful, readable font design representing the brand.";
                specificNegative = "icons, mascots, characters, illustrations, emblems, complex graphics, geometric shapes outside text";
                break;
            case 'lettermark':
                styleDirective = "Format: Lettermark / Monogram. Create a striking logo using ONLY the FIRST LETTER or initials of the brand name. The initial should be stylized and form the core logo mark.";
                typographyDirective = `The logo MUST clearly display the INITIAL LETTER(S) of: "${brand_name}". Do not write the full word if it makes the design cluttered. Focus on monogram design.`;
                specificNegative = "full words, long text, mascots, complex illustrations";
                break;
            case 'combination':
                styleDirective = "Format: Combination Mark. The design must seamlessly integrate BOTH a clear, distinct icon/symbol AND the brand typography. The icon should reflect the brand's core value.";
                break;
            case 'emblem':
                styleDirective = "Format: Emblem / Badge Logo. The text and icon must be contained WITHIN a unifying shape (like a badge, shield, seal, stamp, or circle). Classic, authoritative, and integrated.";
                break;
            case 'mascot':
                styleDirective = "Format: Mascot Logo. Design an appealing, illustrated character (animal, person, or object) that acts as the brand's ambassador. The character should be vector-style, flat, and friendly. Place the brand typography nicely alongside or below the mascot.";
                specificNegative = "realistic photo, 3D render, scary, overly complex shading";
                break;
            case 'minimal':
                styleDirective = "Format: Extreme Minimalist Logo. Ultra-clean, modern, using very few lines or shapes. Maximum negative space. Avoid any unnecessary details.";
                specificNegative = "complex patterns, detailed illustrations, many colors, cluttered layouts, realistic";
                break;
            default:
                styleDirective = "Format: Professional flat 2D vector logo design.";
        }

        let prompt = `You are a Master Brand Strategist and Expert Logo Designer. Your task is to deeply understand the brand's context and conceptualize a logo.\n\n`;

        prompt += `[BRAND CONTEXT & CONCEPT]\n`;
        prompt += `- Brand Name: EXACTLY "${brand_name}"\n`;
        if (brand_value) prompt += `- Core Value / Mission: ${brand_value}\n`;
        if (products) prompt += `- Product Type: ${products}\n`;
        if (details) prompt += `- Key Elements & Symbolism: ${details}\n`;

        prompt += `\n[VISUAL EXECUTION RULES]\n`;
        prompt += `- ${styleDirective}\n`;
        prompt += `- Background: Pure solid white background #FFFFFF ONLY. No gradients or transparent backgrounds.\n`;
        
        if (colorText) prompt += `- ${colorText}\n`;
        if (fontText) prompt += `- ${fontText}\n`;

        prompt += `\n[STRICT TYPOGRAPHY RULES]\n`;
        prompt += `${typographyDirective} DO NOT add any other words, slogans, random letters, or gibberish. The typography must blend seamlessly with the logo mark.\n`;
        
        let defaultNegative = `realistic photo, 3D render, drop shadows, gradients, color palettes, design tools, chaotic, messy, extra words, misspelled text, gibberish`;
        
        let finalNegative = negative_prompt 
            ? `${negative_prompt}, ${defaultNegative}, ${specificNegative}` 
            : `${defaultNegative}, ${specificNegative}`;
            
        prompt += `\n[NEGATIVE PROMPT - DO NOT DRAW]: ${finalNegative}`;
        // ============================================================================
        // ============================================================================

       
       const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // 🟢 เปลี่ยนชื่อโมเดลโดยเติม -preview ต่อท้ายครับ
        const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-image-preview" });

        // ใช้คำสั่ง generateContent สำหรับโมเดล Multi-modal
        const result = await model.generateContent(prompt);
        
        // ดึงไฟล์ Base64 ออกมาจาก Response ของ Gemini
        let base64Data = "";
        const parts = result.response.candidates?.[0]?.content?.parts;
        if (parts) {
            for (const part of parts) {
                if (part.inlineData && part.inlineData.data) {
                    base64Data = part.inlineData.data;
                    break;
                }
            }
        }

        if (!base64Data) {
            throw new Error("ระบบ AI ไม่ส่งรูปภาพกลับมา");
        }
        
        // เซฟรูปลงโฟลเดอร์ uploads/generated/
        const fileName = `logo_${Date.now()}.png`;
        const filePath = path.join(process.cwd(), 'uploads', 'generated', fileName);
        fs.writeFileSync(filePath, base64Data, 'base64');
        const imageUrl = `/uploads/generated/${fileName}`;

        const conn2 = await pool.getConnection();
        await conn2.query(
            "INSERT INTO generated_history (project_id, user_id, generation_type, image_url, prompt, is_selected) VALUES (?, ?, ?, ?, ?, 0)",
            [project_id, finalUserId, 'LOGO', imageUrl, prompt]
        );
        conn2.release();
        
        res.json({ status: 'success', image_url: imageUrl, prompt: prompt });
    } catch (err) {
        console.error("Generate Logo Error (Gemini 3.1 Flash Image):", err);
        res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดในการ Generate รูปภาพด้วย Gemini 3.1' });
    }
});

app.put('/api/like-generated-item/:historyId', async (req, res) => {
    const { historyId } = req.params;
    const { is_liked } = req.body;
    try {
        const connection = await pool.getConnection();
        await connection.query("UPDATE generated_history SET is_liked = ? WHERE history_id = ?", [is_liked, historyId]);
        connection.release();
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

app.get('/api/generated-logos/:projectId', async (req, res) => {
    const { projectId } = req.params;
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.query(
            "SELECT * FROM generated_history WHERE project_id = ? AND generation_type = 'LOGO' ORDER BY is_selected DESC, is_liked DESC, history_id DESC", 
            [projectId]
        );
        connection.release();
        res.json({ status: 'success', images: rows });
    } catch (err) {
        console.error("Fetch logos error:", err);
        res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

app.put('/api/generated-logos/select/:historyId', async (req, res) => {
    const { project_id, image_url, action } = req.body;
    const history_id = req.params.historyId;
    try {
        const connection = await pool.getConnection();
        if (action === 'deselect') {
            await connection.query("UPDATE generated_history SET is_selected = 0 WHERE history_id = ?", [history_id]);
            await connection.query("UPDATE project SET image_logo = NULL WHERE project_id = ?", [project_id]);
        } else {
            await connection.query("UPDATE generated_history SET is_selected = 0 WHERE project_id = ? AND generation_type = 'LOGO'", [project_id]);
            await connection.query("UPDATE generated_history SET is_selected = 1 WHERE history_id = ?", [history_id]);
            await connection.query("UPDATE project SET image_logo = ? WHERE project_id = ?", [image_url, project_id]);
        }
        connection.release();
        res.json({ status: 'success' });
    } catch (err) {
        console.error("Select Logo Error:", err);
        res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

// ================= API Package Catalog =================
app.patch('/api/brand_product/:id/package', async (req, res) => {
  const { id } = req.params;
  const { package_id } = req.body;
  try {
    const connection = await pool.getConnection();
    await connection.query('UPDATE brand_product SET package_id = ? WHERE product_id = ?', [package_id, id]);
    connection.release();
    res.json({ status: 'success', message: 'บันทึก package เรียบร้อยแล้ว' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/api/package-catalog/like', async (req, res) => {
  const { product_id, package_id, is_liked } = req.body;
  if (!product_id || !package_id) return res.status(400).json({ status: 'error', message: 'ข้อมูลไม่ครบถ้วน' });
  try {
    const connection = await pool.getConnection();
    const [existing] = await connection.query(
      'SELECT id FROM package_catalog WHERE product_id = ? AND package_id = ?', [product_id, package_id]);
    if (existing.length > 0) {
      await connection.query(
        'UPDATE package_catalog SET is_liked = ? WHERE product_id = ? AND package_id = ?',
        [is_liked ? 1 : 0, product_id, package_id]);
    } else {
      await connection.query(
        'INSERT INTO package_catalog (package_id, product_id, is_liked, is_selected) VALUES (?, ?, ?, 0)',
        [package_id, product_id, is_liked ? 1 : 0]);
    }
    connection.release();
    res.json({ status: 'success' });
  } catch (err) {
    console.error('❌ Package like error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/api/package-catalog', async (req, res) => {
  const { product_id, package_id, action } = req.body;
  if (!product_id || !package_id || !action) return res.status(400).json({ status: 'error', message: 'ข้อมูลไม่ครบถ้วน' });
  try {
    const connection = await pool.getConnection();
    if (action === 'select') {
      await connection.query('UPDATE package_catalog SET is_selected = 0 WHERE product_id = ?', [product_id]);
    }
    const [existing] = await connection.query(
      'SELECT id FROM package_catalog WHERE product_id = ? AND package_id = ?', [product_id, package_id]);
    if (existing.length > 0) {
      if (action === 'select') {
        await connection.query(
          'UPDATE package_catalog SET is_selected = 1 WHERE product_id = ? AND package_id = ?', [product_id, package_id]);
      } else {
        await connection.query(
          'UPDATE package_catalog SET is_liked = NOT is_liked WHERE product_id = ? AND package_id = ?', [product_id, package_id]);
      }
    } else {
      await connection.query(
        'INSERT INTO package_catalog (package_id, product_id, is_liked, is_selected) VALUES (?, ?, ?, ?)',
        [package_id, product_id, action === 'like' ? 1 : 0, action === 'select' ? 1 : 0]);
    }
    connection.release();
    res.json({ status: 'success' });
  } catch (err) {
    console.error('Package catalog error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ================= API ADMIN DASHBOARD =================
app.post('/api/admin/login', async (req, res) => {
    const { name_admin, password, key_password } = req.body;
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.query(
            "SELECT * FROM admin WHERE name_admin = ? AND password = ? AND key_password = ?",
            [name_admin, password, key_password]
        );
        connection.release();
        if (rows.length > 0) {
            const adminData = { admin_id: rows[0].admin_id, name_admin: rows[0].name_admin };
            res.json({ status: 'success', message: 'เข้าสู่ระบบ Admin สำเร็จ', admin: adminData });
        } else {
            res.status(401).json({ status: 'error', message: 'ข้อมูลเข้าสู่ระบบไม่ถูกต้อง' });
        }
    } catch (err) {
        console.error("Admin Login Error:", err);
        res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

app.get('/api/admin/users/count', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.query("SELECT COUNT(*) as totalUsers FROM user_profile");
        connection.release();
        res.json({ status: 'success', total: rows[0].totalUsers });
    } catch (err) {
        res.status(500).json({ status: 'error' });
    }
});

app.get('/api/admin/stats/api-usage', async (req, res) => {
    const days = parseInt(req.query.days) || 7;
    try {
        const connection = await pool.getConnection();
        const [geminiStats] = await connection.query(`
            SELECT DATE(created_at) as date, COUNT(*) as count 
            FROM api_logs 
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            GROUP BY DATE(created_at) ORDER BY date ASC
        `, [days]);
        const [imageStats] = await connection.query(`
            SELECT DATE(created_at) as date, COUNT(*) as count 
            FROM generated_history 
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            GROUP BY DATE(created_at) ORDER BY date ASC
        `, [days]);
        connection.release();
        // ส่งทั้ง 2 keys: image (ใหม่) + dalle (เก่า เพื่อ backward compat กับ frontend เดิม)
        res.json({ 
            status: 'success', 
            gemini: geminiStats, 
            image: imageStats,
            dalle: imageStats  // 👈 alias เก่า ถ้า frontend ยังใช้ key 'dalle' อยู่
        });
        connection.release();
        res.json({ status: 'success', gemini: geminiStats, dalle: dalleStats });
    } catch (err) {
        console.error("API Stats Error:", err);
        res.status(500).json({ status: 'error' });
    }
});

// =====================================================================
// ================= API LABEL DESIGN v2 ================================
// =====================================================================

// 1. ให้ Gemini ช่วยคิดคำโปรย
app.post('/api/generate-label-content', async (req, res) => {
    const { product_name, raw_details } = req.body;
    if (!product_name) return res.status(400).json({ status: 'error', message: 'กรุณาระบุชื่อสินค้า' });
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-8b" });
        const prompt = `
        คุณเป็น Copywriter และนักออกแบบฉลากสินค้าระดับมืออาชีพ
        ชื่อสินค้า: ${product_name}
        ข้อมูลดิบ/ส่วนผสม/จุดเด่น: ${raw_details || 'ไม่ระบุ'}

        กรุณาสร้างเนื้อหาสำหรับนำไปวางบนฉลากสินค้า โดยส่งผลลัพธ์เป็น JSON เท่านั้น โครงสร้างดังนี้:
        {
            "tagline": "คำโปรยสั้นๆ ดึงดูดใจ (ไม่เกิน 2 บรรทัด)",
            "ingredients": "เรียบเรียงส่วนผสม วิธีใช้ หรือคำเตือน ให้อ่านง่าย เป็นทางการแบบกระชับ"
        }
        `;
        const result = await model.generateContent(prompt);
        const cleanedText = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const aiData = JSON.parse(cleanedText);
        res.json({ status: 'success', data: aiData });
    } catch (err) {
        console.error("Gemini Label Error:", err);
        res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดในการประมวลผลข้อความ' });
    }
});

// 2. ดึง bg presets ทั้งหมด
app.get('/api/bg-presets', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.query(
            `SELECT bg_preset_id, name, style, image_url, thumbnail_url
             FROM bg_preset WHERE is_active = 1 ORDER BY bg_preset_id ASC`);
        connection.release();
        res.json({ status: 'success', data: rows });
    } catch (err) {
        console.error("Get BG Presets Error:", err);
        res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

// 3. Generate label background ด้วย DALL-E 3
app.post('/api/generate-label-background', async (req, res) => {
    const { project_id, user_id, style = 'minimal', tone = 'auto', density = 'medium' } = req.body;
    if (!project_id) return res.status(400).json({ status: 'error', message: 'project_id is required' });

    let connection;
    try {
        connection = await pool.getConnection();

        // ดึงสีที่ select ไว้
        const [colorRows] = await connection.query(
            `SELECT c.color_code_1, c.color_code_2, c.color_code_3, c.color_code_4, c.color_code_5
             FROM color_concept cc
             JOIN color c ON cc.color_id = c.color_id
             WHERE cc.project_id = ? AND cc.is_selected = 1 LIMIT 1`,
            [project_id]
        );
        const palette = colorRows[0]
            ? [colorRows[0].color_code_1, colorRows[0].color_code_2, colorRows[0].color_code_3,
               colorRows[0].color_code_4, colorRows[0].color_code_5].filter(Boolean).join(', ')
            : '#F5E6D3, #C9A678, #8B6F47';

        connection.release();
        connection = null;

        const styleMap = {
            minimal: 'minimal, lots of empty white space, very subtle small accents on edges only',
            thai_traditional: 'subtle traditional Thai pattern (lai kanok / lotus), elegant, sparse',
            nature: 'soft botanical leaves and small flowers along edges',
            watercolor: 'soft watercolor wash, blurred organic shapes, light',
            geometric: 'simple geometric lines and dots, modern, sparse',
            vintage: 'aged paper texture, faded ornamental corners'
        };
        const toneMap = {
            auto: '', bright: 'bright and airy lighting',
            dark: 'rich deep tones', pastel: 'soft pastel tones'
        };
        const densityMap = {
            low: 'very sparse pattern, only edges decorated',
            medium: 'balanced sparse pattern, leaving large empty area in center',
            high: 'denser decorative pattern but still leaves clear empty zone in middle'
        };

        const prompt = `
Create a flat 2D vector decorative background pattern for a product label.

DESIGN STYLE: ${styleMap[style] || styleMap.minimal}
COLOR PALETTE: ONLY use these exact hex colors: ${palette}
PATTERN DENSITY: ${densityMap[density] || densityMap.medium}
${toneMap[tone] ? 'TONE: ' + toneMap[tone] : ''}


        `.trim();

        // 🟢 เรียก Nano Banana (Gemini 2.5 Flash Image)
        const response = await googleImagen.images.generate({
            model: "gemini-2.5-flash-image",
            prompt: prompt,
            n: 1,
            size: "1024x1024",
            response_format: "b64_json",
        });

        const base64Data = response.data[0].b64_json;
        const fileName = `labelbg_${Date.now()}.png`;
        // ✅ เปลี่ยนให้เซฟลงโฟลเดอร์ uploads/generated/
        const filePath = path.join(process.cwd(), 'uploads', 'generated', fileName); 
        fs.writeFileSync(filePath, base64Data, 'base64');
        
        // เวลาส่ง URL กลับไปให้ Frontend ต้องมี /generated/ ด้วย
        const imageUrl = `/uploads/generated/${fileName}`;

        // log ลง api_logs และ generated_history
        try {
            const finalUserId = (!user_id || user_id === 0) ? null : user_id;
            const logConn = await pool.getConnection();
            await logConn.query(
                `INSERT INTO api_logs (user_id, project_id, action_type, prompt_sent, ai_response) VALUES (?, ?, ?, ?, ?)`,
                [finalUserId, project_id, 'GENERATE_LABEL_BG', prompt, imageUrl]
            );
            await logConn.query(
                `INSERT INTO generated_history (project_id, user_id, generation_type, image_url, prompt, is_selected) VALUES (?, ?, ?, ?, ?, 0)`,
                [project_id, finalUserId, 'LABEL_BG', imageUrl, prompt]
            );
            logConn.release();
        } catch (logErr) {
            console.warn("Log warning (label-bg):", logErr.message);
        }

        res.json({ status: 'success', data: { image_url: imageUrl, prompt_used: prompt } });
    } catch (err) {
        if (connection) connection.release();
        console.error("Generate Label BG Error:", err);
        res.status(500).json({ status: 'error', message: err.message || 'DALL-E error' });
    }
});

// 4. ดึง label ของ สินค้า (Product)
app.get('/api/labels/product/:productId', async (req, res) => {
    const { productId } = req.params;
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.query(`SELECT * FROM label_design WHERE product_id = ? ORDER BY updated_at DESC LIMIT 1`, [productId]);
        connection.release();
        if (rows.length === 0) return res.json({ status: 'success', data: null });
        const row = rows[0];
        try {
            if (row.text_colors && typeof row.text_colors === 'string') row.text_colors = JSON.parse(row.text_colors);
        } catch (e) {}
        res.json({ status: 'success', data: row });
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

// 5. บันทึก/อัปเดต label (Auto-Save)
app.post('/api/labels', async (req, res) => {
    const {
        project_id, product_id, product_name, tagline, net_weight,
        ingredients, usage_instruction, storage_instruction, warnings,
        manufacturer_info,
        fda_number, mfg_date, exp_date, lot_number,
        certifications,
        qr_code_value, barcode_value, show_qr, show_barcode,
        layout_type, label_width, label_height, text_colors,
        bg_mode, bg_color, bg_preset_id, bg_image_url, bg_opacity
    } = req.body;

    if (!product_id || !product_name) {
        return res.status(400).json({ status: 'error', message: 'product_id and product_name are required' });
    }

    try {
        const connection = await pool.getConnection();
        const [existing] = await connection.query('SELECT label_id FROM label_design WHERE product_id = ?', [product_id]);

        const manufacturerJson = manufacturer_info ? JSON.stringify(manufacturer_info) : null;
        const certificationsJson = (certifications && certifications.length > 0) ? JSON.stringify(certifications) : null;
        const colorsJson = text_colors ? JSON.stringify(text_colors) : null;

        const formattedMfgDate = mfg_date ? mfg_date.split('T')[0] : null;
        const formattedExpDate = exp_date ? exp_date.split('T')[0] : null;

        const fields = [
            project_id, product_name, tagline || null, net_weight || null,
            ingredients || null, usage_instruction || null, storage_instruction || null, warnings || null,
            manufacturerJson, fda_number || null, formattedMfgDate, formattedExpDate, lot_number || null,
            certificationsJson, qr_code_value || null, barcode_value || null,
            show_qr ? 1 : 0, show_barcode ? 1 : 0,
            layout_type || 'centered_classic', label_width || 380, label_height || 500, colorsJson,
            bg_mode || 'solid', bg_color || '#FFFFFF', bg_preset_id || null, bg_image_url || null,
            (bg_opacity !== undefined && bg_opacity !== null) ? bg_opacity : 1.00
        ];

        if (existing.length > 0) {
            await connection.query(
                `UPDATE label_design SET
                    project_id=?, product_name=?, tagline=?, net_weight=?,
                    ingredients=?, usage_instruction=?, storage_instruction=?, warnings=?,
                    manufacturer_info=?, fda_number=?, mfg_date=?, exp_date=?, lot_number=?,
                    certifications=?, qr_code_value=?, barcode_value=?, show_qr=?, show_barcode=?,
                    layout_type=?, label_width=?, label_height=?, text_colors=?,
                    bg_mode=?, bg_color=?, bg_preset_id=?, bg_image_url=?, bg_opacity=?
                 WHERE product_id=?`,
                [...fields, product_id]
            );
        } else {
            await connection.query(
                `INSERT INTO label_design (
                    project_id, product_name, tagline, net_weight, ingredients, usage_instruction, storage_instruction, warnings,
                    manufacturer_info, fda_number, mfg_date, exp_date, lot_number, certifications,
                    qr_code_value, barcode_value, show_qr, show_barcode, layout_type, label_width, label_height, text_colors,
                    bg_mode, bg_color, bg_preset_id, bg_image_url, bg_opacity, product_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [...fields, product_id]
            );
        }

        // 🟢 อัปเดตชื่อสินค้ากลับไปยังตาราง brand_product ด้วย!
        await connection.query('UPDATE brand_product SET name_product = ? WHERE product_id = ?', [product_name, product_id]);

        connection.release();
        return res.json({ status: 'success', message: 'Auto-saved' });
    } catch (err) {
        console.error("Save Label Error:", err);
        res.status(500).json({ status: 'error', message: err.message || 'Database error' });
    }
});
// =====================================================================
// END LABEL v2
// =====================================================================
// =====================================================================
// ============ MOCKUP FEATURE — Phase 1, 2, 4 =========================
// =====================================================================

// ----- Multer สำหรับ admin upload pattern -----
if (!fs.existsSync('./uploads/patterns')) fs.mkdirSync('./uploads/patterns', { recursive: true });
const patternStorage = multer.diskStorage({
    destination: 'uploads/patterns/',
    filename: (req, file, cb) => cb(null, `pat_${Date.now()}${path.extname(file.originalname)}`)
});
const patternUpload = multer({ storage: patternStorage });

// ----- 1) GET selected packages ของ project -----
app.get('/api/mockup/selected-packages/:projectId', async (req, res) => {
    const { projectId } = req.params;
    try {
        const conn = await pool.getConnection();
        const [rows] = await conn.query(
            `SELECT bp.product_id, bp.name_product, bp.image_product,
                    p.id AS package_id, p.name,
                    pm.id AS material_id, pm.name AS material_name, pm.package_type,
                    pm.dieline_width_mm, pm.dieline_height_mm, pm.panels_json,
                    pm.bleed_mm, pm.safe_zone_mm
             FROM brand_product bp
             JOIN package_catalog pc ON pc.product_id = bp.product_id
             JOIN packages p ON p.id = pc.package_id
             LEFT JOIN package_materials pm ON pm.package_id = p.id
             WHERE bp.project_id = ? AND pc.is_selected = 1
             ORDER BY pm.sort_order ASC`,
            [projectId]
        );
        // get image refs for each material
        const materialIds = [...new Set(rows.map(r => r.material_id).filter(Boolean))];
        let imgs = [];
        if (materialIds.length > 0) {
            const [rs] = await conn.query(
                `SELECT material_id, image_path, sort_order FROM package_material_images
                 WHERE material_id IN (?) ORDER BY material_id, sort_order ASC`,
                [materialIds]
            );
            imgs = rs;
        }
        conn.release();
        rows.forEach(r => {
            r.images = imgs.filter(i => i.material_id === r.material_id);
            if (r.panels_json && typeof r.panels_json === 'string') {
                try { r.panels_json = JSON.parse(r.panels_json); } catch(e){}
            }
        });
        res.json({ status: 'success', data: rows });
    } catch (err) {
        console.error('selected-packages error', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ----- 2) GET die-line ของ material -----
app.get('/api/mockup/material/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const conn = await pool.getConnection();
        const [rows] = await conn.query(
            `SELECT id, name, package_type, dieline_svg, dieline_width_mm, dieline_height_mm,
                    panels_json, bleed_mm, safe_zone_mm
             FROM package_materials WHERE id = ?`, [id]);
        const [imgs] = await conn.query(
            `SELECT image_path, sort_order FROM package_material_images
             WHERE material_id = ? ORDER BY sort_order ASC`, [id]);
        conn.release();
        if (rows.length === 0) return res.status(404).json({ status: 'error', message: 'not found' });
        const r = rows[0];
        if (r.panels_json && typeof r.panels_json === 'string') {
            try { r.panels_json = JSON.parse(r.panels_json); } catch(e){}
        }
        r.images = imgs;
        res.json({ status: 'success', data: r });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ----- 3) GET pattern library -----
app.get('/api/pattern-library', async (req, res) => {
    const { category, source } = req.query;
    try {
        const conn = await pool.getConnection();
        let q = 'SELECT * FROM pattern_library WHERE is_active = 1';
        const params = [];
        if (category && category !== 'all') { q += ' AND category = ?'; params.push(category); }
        if (source) { q += ' AND source = ?'; params.push(source); }
        q += ' ORDER BY pattern_id DESC';
        const [rows] = await conn.query(q, params);
        conn.release();
        res.json({ status: 'success', data: rows });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ----- 4) POST admin upload pattern -----
app.post('/api/admin/upload-pattern', patternUpload.single('pattern_image'), async (req, res) => {
    const { name, category } = req.body;
    if (!req.file) return res.status(400).json({ status: 'error', message: 'no file uploaded' });
    const url = `/uploads/patterns/${req.file.filename}`;
    try {
        const conn = await pool.getConnection();
        const [r] = await conn.query(
            `INSERT INTO pattern_library (name, category, source, image_url, thumbnail_url, is_seamless)
             VALUES (?, ?, 'admin', ?, ?, 1)`,
            [name || 'Untitled', category || 'abstract', url, url]
        );
        conn.release();
        res.json({ status: 'success', pattern_id: r.insertId, image_url: url });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ----- 5) POST DALL-E generate pattern -----
app.post('/api/generate-mockup-pattern', async (req, res) => {
    const { project_id, user_id, style = 'thai_traditional' } = req.body;
    if (!project_id) return res.status(400).json({ status: 'error', message: 'project_id required' });
    let conn;
    try {
        conn = await pool.getConnection();
        const [colorRows] = await conn.query(
            `SELECT c.color_code_1, c.color_code_2, c.color_code_3, c.color_code_4, c.color_code_5
             FROM color_concept cc JOIN color c ON cc.color_id = c.color_id
             WHERE cc.project_id = ? AND cc.is_selected = 1 LIMIT 1`, [project_id]);
        const palette = colorRows[0]
            ? [colorRows[0].color_code_1, colorRows[0].color_code_2, colorRows[0].color_code_3,
               colorRows[0].color_code_4, colorRows[0].color_code_5].filter(Boolean).join(', ')
            : '#F5E6D3, #C9A678, #8B6F47';
        conn.release(); conn = null;

        const styleMap = {
            thai_traditional: 'subtle traditional Thai pattern lai kanok lotus motif elegant sparse',
            geometric: 'simple geometric repeating pattern lines dots modern',
            floral: 'soft botanical flowers leaves repeating delicate',
            texture: 'paper texture wash subtle organic',
            abstract: 'abstract organic shapes sparse minimal'
        };
        const prompt = `Create a SEAMLESS REPEATING tile pattern for product packaging background.
Style: ${styleMap[style] || styleMap.thai_traditional}
Colors: ONLY use these hex colors: ${palette}
STRICT RULES:
- Pattern must be seamless (tileable, edges continue)
- 2D flat illustration only
- NO text, NO numbers, NO letters, NO logos, NO photo, NO 3D
- Subtle decorative pattern with consistent density
- Light/neutral base color`;

        // 🟢 เรียก Imagen 3 Fast
        const response = await googleImagen.images.generate({
            model: 'imagen-3.0-fast-generate-001', prompt, n: 1, size: '1024x1024', response_format: 'b64_json'
        });
        const fname = `mockup_pat_${Date.now()}.png`;
        fs.writeFileSync(path.join('uploads', fname), response.data[0].b64_json, 'base64');
        const imageUrl = `/uploads/${fname}`;

        const c2 = await pool.getConnection();
        const [r] = await c2.query(
            `INSERT INTO pattern_library (name, category, source, image_url, thumbnail_url, uploaded_by_user_id)
             VALUES (?, ?, 'user', ?, ?, ?)`,
            [`AI ${style}`, style, imageUrl, imageUrl, user_id || null]);
        await c2.query(
            `INSERT INTO api_logs (user_id, project_id, action_type, prompt_sent, ai_response) VALUES (?, ?, ?, ?, ?)`,
            [user_id || null, project_id, 'GENERATE_MOCKUP_PATTERN', prompt, imageUrl]);
        await c2.query(
            `INSERT INTO generated_history (project_id, user_id, generation_type, image_url, prompt, is_selected) VALUES (?, ?, ?, ?, ?, 0)`,
            [project_id, user_id || null, 'MOCKUP_PATTERN', imageUrl, prompt]);
        c2.release();
        res.json({ status: 'success', data: { image_url: imageUrl, pattern_id: r.insertId } });
    } catch (err) {
        if (conn) conn.release();
        console.error('Pattern Gen Error:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ----- 6) POST user upload pattern (custom จากผู้ใช้) -----
app.post('/api/mockup/upload-pattern', patternUpload.single('pattern_image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ status: 'error', message: 'no file' });
    const { user_id } = req.body;
    const url = `/uploads/patterns/${req.file.filename}`;
    try {
        const conn = await pool.getConnection();
        const [r] = await conn.query(
            `INSERT INTO pattern_library (name, category, source, image_url, thumbnail_url, uploaded_by_user_id, is_seamless)
             VALUES (?, ?, 'user', ?, ?, ?, 0)`,
            ['Custom Upload', 'abstract', url, url, user_id || null]);
        conn.release();
        res.json({ status: 'success', pattern_id: r.insertId, image_url: url });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ----- 7) GET mockup ของ project -----
app.get('/api/mockups/:projectId', async (req, res) => {
    const { projectId } = req.params;
    const { product_id } = req.query;
    try {
        const conn = await pool.getConnection();
        let q = `SELECT * FROM mockup_design WHERE project_id = ?`;
        const params = [projectId];
        if (product_id) { q += ` AND product_id = ?`; params.push(product_id); }
        q += ` ORDER BY updated_at DESC LIMIT 1`;
        const [rows] = await conn.query(q, params);
        if (rows.length === 0) { conn.release(); return res.json({ status: 'success', data: null }); }
        const m = rows[0];
        const [panels] = await conn.query(`SELECT * FROM mockup_panel WHERE mockup_id = ?`, [m.mockup_id]);
        conn.release();
        panels.forEach(p => {
            if (p.elements_json && typeof p.elements_json === 'string') {
                try { p.elements_json = JSON.parse(p.elements_json); } catch(e){}
            }
        });
        m.panels = panels;
        res.json({ status: 'success', data: m });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ----- 8) POST save/update mockup + panels -----
app.post('/api/mockups', async (req, res) => {
    const {
        project_id, product_id, package_material_id, size_id, label_id,
        bleed_mm, resolution_dpi, panels = []
    } = req.body;
    if (!project_id || !package_material_id) {
        return res.status(400).json({ status: 'error', message: 'project_id and package_material_id required' });
    }
    try {
        const conn = await pool.getConnection();
        let existing;
        if (product_id) {
            [existing] = await conn.query(
                'SELECT mockup_id FROM mockup_design WHERE project_id = ? AND product_id = ?',
                [project_id, product_id]);
        } else {
            [existing] = await conn.query(
                'SELECT mockup_id FROM mockup_design WHERE project_id = ? AND product_id IS NULL',
                [project_id]);
        }
        let mockupId;
        if (existing.length > 0) {
            mockupId = existing[0].mockup_id;
            await conn.query(
                `UPDATE mockup_design SET package_material_id=?, size_id=?, label_id=?,
                   bleed_mm=?, resolution_dpi=?, status='saved' WHERE mockup_id=?`,
                [package_material_id, size_id || null, label_id || null,
                 bleed_mm || 3.0, resolution_dpi || 300, mockupId]);
        } else {
            const [r] = await conn.query(
                `INSERT INTO mockup_design (project_id, product_id, package_material_id, size_id, label_id, bleed_mm, resolution_dpi, status)
                 VALUES (?,?,?,?,?,?,?,'saved')`,
                [project_id, product_id || null, package_material_id, size_id || null, label_id || null,
                 bleed_mm || 3.0, resolution_dpi || 300]);
            mockupId = r.insertId;
        }
        for (const p of panels) {
            const elJson = p.elements_json ? JSON.stringify(p.elements_json) : (p.elements ? JSON.stringify(p.elements) : null);
            const [exP] = await conn.query(
                `SELECT panel_id FROM mockup_panel WHERE mockup_id=? AND panel_key=?`, [mockupId, p.panel_key]);
            if (exP.length > 0) {
                await conn.query(
                    `UPDATE mockup_panel SET bg_mode=?, bg_color=?, bg_pattern_id=?, bg_image_url=?, bg_opacity=?, elements_json=?
                     WHERE panel_id=?`,
                    [p.bg_mode||'solid', p.bg_color||'#FFFFFF', p.bg_pattern_id||null,
                     p.bg_image_url||null, p.bg_opacity||1.00, elJson, exP[0].panel_id]);
            } else {
                await conn.query(
                    `INSERT INTO mockup_panel (mockup_id, panel_key, bg_mode, bg_color, bg_pattern_id, bg_image_url, bg_opacity, elements_json)
                     VALUES (?,?,?,?,?,?,?,?)`,
                    [mockupId, p.panel_key, p.bg_mode||'solid', p.bg_color||'#FFFFFF',
                     p.bg_pattern_id||null, p.bg_image_url||null, p.bg_opacity||1.00, elJson]);
            }
        }
        conn.release();
        res.json({ status: 'success', mockup_id: mockupId });
    } catch (err) {
        console.error('Save Mockup Error:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ----- 9) POST export PDF (Phase 4) -----
// body: { panel_images: [{panel_key, image_data: 'data:image/png;base64,...'}], spec_data: {...} }
app.post('/api/mockups/:mockupId/export-pdf', async (req, res) => {
    const { mockupId } = req.params;
    const { panel_images = [], spec_data = {} } = req.body;
    try {
        const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
        const pdfDoc = await PDFDocument.create();

        const conn = await pool.getConnection();
        const [mr] = await conn.query(
            `SELECT m.*, pm.dieline_width_mm, pm.dieline_height_mm, pm.bleed_mm AS mat_bleed,
                    pm.panels_json, pm.name AS material_name, pm.package_type
             FROM mockup_design m JOIN package_materials pm ON m.package_material_id = pm.id
             WHERE m.mockup_id = ?`, [mockupId]);
        if (mr.length === 0) { conn.release(); return res.status(404).json({status:'error',message:'mockup not found'}); }
        const m = mr[0];
        const panels = m.panels_json ? JSON.parse(m.panels_json) : [];
        conn.release();

        const MM_TO_PT = 2.83465;
        const bleed = parseFloat(m.bleed_mm || m.mat_bleed) || 3.0;
        const widthMm  = parseFloat(m.dieline_width_mm)  + bleed * 2;
        const heightMm = parseFloat(m.dieline_height_mm) + bleed * 2;
        const pageW = widthMm * MM_TO_PT;
        const pageH = heightMm * MM_TO_PT;

        // ---- หน้า 1: die-line print-ready ----
        const page = pdfDoc.addPage([pageW, pageH]);
        page.drawRectangle({ x: 0, y: 0, width: pageW, height: pageH, color: rgb(1,1,1) });

        for (const panel of panels) {
            const imgEntry = panel_images.find(pi => pi.panel_key === panel.id);
            if (!imgEntry) continue;
            const b64 = imgEntry.image_data.replace(/^data:image\/\w+;base64,/, '');
            const bytes = Buffer.from(b64, 'base64');
            const img = await pdfDoc.embedPng(bytes);
            page.drawImage(img, {
                x: (panel.x_mm + bleed) * MM_TO_PT,
                y: (heightMm - panel.y_mm - panel.h_mm - bleed) * MM_TO_PT,
                width: panel.w_mm * MM_TO_PT,
                height: panel.h_mm * MM_TO_PT
            });
        }

        // ---- crop marks 4 มุม ----
        const cropLen = 5 * MM_TO_PT;
        const cropOff = bleed * MM_TO_PT;
        const cropColor = rgb(0,0,0);
        const drawCrop = (x, y, dx, dy) => {
            page.drawLine({ start: { x, y }, end: { x: x + dx, y: y + dy }, thickness: 0.25, color: cropColor });
        };
        // bottom-left
        drawCrop(0, cropOff, cropLen, 0);
        drawCrop(cropOff, 0, 0, cropLen);
        // bottom-right
        drawCrop(pageW - cropLen, cropOff, cropLen, 0);
        drawCrop(pageW - cropOff, 0, 0, cropLen);
        // top-left
        drawCrop(0, pageH - cropOff, cropLen, 0);
        drawCrop(cropOff, pageH - cropLen, 0, cropLen);
        // top-right
        drawCrop(pageW - cropLen, pageH - cropOff, cropLen, 0);
        drawCrop(pageW - cropOff, pageH - cropLen, 0, cropLen);

        // ---- fold lines (เส้นประระหว่าง panel) ----
        for (let i = 0; i < panels.length; i++) {
            for (let j = i + 1; j < panels.length; j++) {
                const a = panels[i], b = panels[j];
                // ถ้า panel ติดกัน (ขอบขวา a = ขอบซ้าย b) → วาดเส้นพับ
                if (Math.abs((a.x_mm + a.w_mm) - b.x_mm) < 0.5 &&
                    Math.max(a.y_mm, b.y_mm) < Math.min(a.y_mm + a.h_mm, b.y_mm + b.h_mm)) {
                    const xMm = a.x_mm + a.w_mm + bleed;
                    const y1Mm = Math.max(a.y_mm, b.y_mm) + bleed;
                    const y2Mm = Math.min(a.y_mm + a.h_mm, b.y_mm + b.h_mm) + bleed;
                    page.drawLine({
                        start: { x: xMm * MM_TO_PT, y: (heightMm - y2Mm) * MM_TO_PT },
                        end:   { x: xMm * MM_TO_PT, y: (heightMm - y1Mm) * MM_TO_PT },
                        thickness: 0.5, color: rgb(1, 0, 0), dashArray: [4, 3]
                    });
                }
                // ขอบล่าง a = ขอบบน b
                if (Math.abs((a.y_mm + a.h_mm) - b.y_mm) < 0.5 &&
                    Math.max(a.x_mm, b.x_mm) < Math.min(a.x_mm + a.w_mm, b.x_mm + b.w_mm)) {
                    const yMm = a.y_mm + a.h_mm + bleed;
                    const x1Mm = Math.max(a.x_mm, b.x_mm) + bleed;
                    const x2Mm = Math.min(a.x_mm + a.w_mm, b.x_mm + b.w_mm) + bleed;
                    page.drawLine({
                        start: { x: x1Mm * MM_TO_PT, y: (heightMm - yMm) * MM_TO_PT },
                        end:   { x: x2Mm * MM_TO_PT, y: (heightMm - yMm) * MM_TO_PT },
                        thickness: 0.5, color: rgb(1, 0, 0), dashArray: [4, 3]
                    });
                }
            }
        }

        // ---- หน้า 2: spec sheet (A4) ----
        const specPage = pdfDoc.addPage([595, 842]);
        const helv = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const helvR = await pdfDoc.embedFont(StandardFonts.Helvetica);
        let yy = 800;
        specPage.drawText('PRINT SPECIFICATION SHEET', { x: 50, y: yy, size: 18, font: helv }); yy -= 30;
        specPage.drawText(`Project: ${spec_data.project_name || '-'}`, { x: 50, y: yy, size: 11, font: helvR }); yy -= 18;
        specPage.drawText(`Material: ${m.material_name}`, { x: 50, y: yy, size: 11, font: helvR }); yy -= 18;
        specPage.drawText(`Package Type: ${m.package_type}`, { x: 50, y: yy, size: 11, font: helvR }); yy -= 18;
        specPage.drawText(`Die-line size: ${m.dieline_width_mm} x ${m.dieline_height_mm} mm`, { x: 50, y: yy, size: 11, font: helvR }); yy -= 18;
        specPage.drawText(`Bleed: ${bleed} mm | Resolution: ${m.resolution_dpi} DPI`, { x: 50, y: yy, size: 11, font: helvR }); yy -= 25;
        specPage.drawText('PRINTING NOTES (for printer)', { x: 50, y: yy, size: 13, font: helv }); yy -= 20;
        const notes = [
            '1. Color space: sRGB (please convert to CMYK before printing)',
            '2. Crop marks at 4 corners — trim along marks',
            '3. Red dashed lines = fold lines (do not print, score only)',
            '4. Black solid lines/area = print artwork',
            `5. Die-line outer size with bleed: ${widthMm} x ${heightMm} mm`,
            '6. Recommended paper: 250-300 gsm coated for boxes',
            '7. Recommended finish: Matte or glossy lamination',
            '8. Embedded fonts: outlined as raster (no font issues)'
        ];
        notes.forEach(n => { specPage.drawText(n, { x: 50, y: yy, size: 10, font: helvR }); yy -= 16; });
        if (spec_data.colors_used && spec_data.colors_used.length > 0) {
            yy -= 10;
            specPage.drawText('COLORS USED', { x: 50, y: yy, size: 13, font: helv }); yy -= 18;
            spec_data.colors_used.forEach(hex => {
                const r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255;
                specPage.drawRectangle({ x: 50, y: yy - 10, width: 18, height: 12, color: rgb(r,g,b) });
                specPage.drawText(`${hex.toUpperCase()}  →  CMYK approx (convert at printer)`, { x: 75, y: yy - 8, size: 10, font: helvR });
                yy -= 18;
            });
        }

        const pdfBytes = await pdfDoc.save();
        const fname = `mockup_${mockupId}_${Date.now()}.pdf`;
        const fpath = path.join('uploads', fname);
        fs.writeFileSync(fpath, pdfBytes);
        const url = `/uploads/${fname}`;

        const c2 = await pool.getConnection();
        await c2.query(`UPDATE mockup_design SET print_pdf_url=?, status='exported' WHERE mockup_id=?`, [url, mockupId]);
        c2.release();
        res.json({ status: 'success', pdf_url: url });
    } catch (err) {
        console.error('Export PDF Error:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// =====================================================================
// END MOCKUP FEATURE
// =====================================================================
// ----- NEW: GET products with package status (สำหรับหน้า Mockup Picker) -----
app.get('/api/mockup/products-status/:projectId', async (req, res) => {
    const { projectId } = req.params;
    try {
        const conn = await pool.getConnection();
        const [products] = await conn.query(
            `SELECT product_id, name_product, type_product, image_product
             FROM brand_product WHERE project_id = ?`, [projectId]);

        if (products.length === 0) {
            conn.release();
            return res.json({ status: 'success', data: [] });
        }

        const productIds = products.map(p => p.product_id);
        const [selected] = await conn.query(
    `SELECT pc.product_id, pc.package_id, p.name AS name_package
     FROM package_catalog pc 
     JOIN packages p ON p.id = pc.package_id
     WHERE pc.is_selected = 1 AND pc.product_id IN (?)`,
    [productIds]);

        let materials = [];
        if (selected.length > 0) {
            const packageIds = [...new Set(selected.map(s => s.package_id))];
            const [mats] = await conn.query(
                `SELECT id, package_id, name AS material_name, package_type,
                        dieline_width_mm, dieline_height_mm
                 FROM package_materials WHERE package_id IN (?) ORDER BY sort_order ASC`,
                [packageIds]);
            materials = mats;
        }

        const [mockups] = await conn.query(
            `SELECT product_id, mockup_id, status FROM mockup_design 
             WHERE project_id = ? AND product_id IN (?)`,
            [projectId, productIds]);

        conn.release();

        const result = products.map(p => {
            const sel = selected.find(s => s.product_id === p.product_id);
            const mats = sel ? materials.filter(m => m.package_id === sel.package_id) : [];
            const mockup = mockups.find(m => m.product_id === p.product_id);
            return {
                ...p,
                has_package: !!sel,
                package_id: sel?.package_id || null,
                name: sel?.name || null,
                materials: mats,
                has_mockup: !!mockup,
                mockup_id: mockup?.mockup_id || null,
                mockup_status: mockup?.status || null
            };
        });

        res.json({ status: 'success', data: result });
    } catch (err) {
        console.error('products-status error', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});
// ===== POST: AI สร้างภาพ mockup ผลิตภัณฑ์จริง (DALL-E) =====
app.post('/api/mockup/generate-ai-image', async (req, res) => {
    const { project_id, user_id, product_id, package_name, package_material, label_data = {}, project_name } = req.body;
    if (!project_id) return res.status(400).json({ status: 'error', message: 'project_id required' });

    try {
        const ld = label_data;
        let conn = await pool.getConnection();
        // ดึง brand name ที่ select
        const [nameRows] = await conn.query(
            `SELECT brand_name FROM name_concept WHERE project_id = ? AND is_selected = 1 LIMIT 1`, [project_id]);
        const brandName = nameRows[0]?.brand_name || '';
        conn.release();

        const prompt = `Professional studio product photography of a ${package_name || 'product package'} (${package_material || 'standard material'}).

The package has a custom designed label sticker on the front with these visual characteristics:
- Brand identity colors: ${ld.colors || 'natural earthy tones'}
${brandName ? `- Brand name visible on label: "${brandName}"` : ''}
${ld.product_name ? `- Product name on label: "${ld.product_name}"` : ''}
${ld.tagline ? `- Tagline visible: "${ld.tagline}"` : ''}

STRICT VISUAL RULES:
- Photorealistic professional product photography style
- Soft diffused studio lighting from upper left
- Clean white or very subtle light gray seamless background
- Single product centered in frame, hero shot
- Sharp focus on the package label
- Commercial e-commerce product shot quality
- The label/sticker is clean, well-applied, readable
- Natural shadows beneath product
- High resolution, clean modern aesthetic
- NO people, NO hands holding it, NO extra props or food/decoration around it
- NO text on background, only on the label area`;

        // 🟢 เรียก Nano Banana (Gemini 2.5 Flash Image)
        const response = await googleImagen.images.generate({
            model: 'gemini-2.5-flash-image',
            prompt,
            n: 1,
            size: '1024x1024',
            response_format: 'b64_json'
        });
        const fname = `mockup_ai_${Date.now()}.png`;
        fs.writeFileSync(path.join('uploads', fname), response.data[0].b64_json, 'base64');
        const imageUrl = `/uploads/${fname}`;

        try {
            const finalUserId = (!user_id || user_id === 0) ? null : user_id;
            const c2 = await pool.getConnection();
            await c2.query(
                `INSERT INTO api_logs (user_id, project_id, action_type, prompt_sent, ai_response) VALUES (?, ?, ?, ?, ?)`,
                [finalUserId, project_id, 'GENERATE_MOCKUP_AI', prompt, imageUrl]);
            await c2.query(
                `INSERT INTO generated_history (project_id, user_id, generation_type, image_url, prompt, is_selected) VALUES (?, ?, ?, ?, ?, 0)`,
                [project_id, finalUserId, 'MOCKUP_AI', imageUrl, prompt]);
            c2.release();
        } catch (e) { console.warn('log warning', e.message); }

        res.json({ status: 'success', image_url: imageUrl });
    } catch (err) {
        console.error('AI Mockup Error:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`รันได้แล้ว Server running on http://localhost:${PORT}`);
});