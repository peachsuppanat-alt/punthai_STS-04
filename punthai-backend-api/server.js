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

import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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
//const replicate = new Replicate({
  //auth: process.env.REPLICATE_API_TOKEN,
//});


// ================= API LOGIN & REGISTER =================


// ================= API REGISTER =================
app.post('/api/register', upload.single('img_profile'), async (req, res) => {
  const { user_name, password, email } = req.body; 
  const image_profile = req.file ? req.file.filename : null; 
  const subscription_status = 'STANDARD';

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


// ================= 4. API จัดการโปรเจกต์ (Projects) =================

// 4.1 สร้างโปรเจกต์ใหม่ (สร้างทันทีโดยไม่ต้องใส่ชื่อ)
app.post('/api/projects', async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) {
    return res.status(400).json({ status: 'error', message: 'ไม่พบ user_id' });
  }

  try {
    const connection = await pool.getConnection();
    // สร้างโปรเจกต์เปล่าๆ ทิ้งไว้ (project_name เป็น null อัตโนมัติ)
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

// 4.3 อัปเดตชื่อโปรเจกต์ 
app.put('/api/projects/:id', async (req, res) => {
    const projectId = req.params.id;
    const { project_name } = req.body; // 👈 เปลี่ยนมารับตัวแปร project_name

    if (!project_name) {
        return res.status(400).json({ status: 'error', message: 'กรุณาส่งชื่อโปรเจกต์มาด้วย' });
    }

    try {
        const connection = await pool.getConnection();
        // 👈 อัปเดตลงคอลัมน์ project_name ให้ตรงกับ DB ของคุณ
        await connection.query("UPDATE project SET project_name = ? WHERE project_id = ?", [project_name, projectId]);
        connection.release();
        
        return res.json({ status: 'success', message: 'อัปเดตชื่อสำเร็จ' });
    } catch (err) {
        console.error("Database Error (Update Name):", err);
        return res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

// ================= API สำหรับดึงสีและฟอนต์ที่ "ถูกเลือก (is_selected=1)" ไปโชว์หน้า MyProject =================
app.get('/api/projects/:projectId/selected-assets', async (req, res) => {
    const { projectId } = req.params;
    try {
        const connection = await pool.getConnection();
        
        // ดึงชุดสีที่ถูกเลือก (JOIN ตาราง color_concept กับ color)
        const [colorRows] = await connection.query(`
            SELECT c.* FROM color_concept cc
            JOIN color c ON cc.color_id = c.color_id
            WHERE cc.project_id = ? AND cc.is_selected = 1
            LIMIT 1
        `, [projectId]);

        // ดึงฟอนต์ที่ถูกเลือก (JOIN ตาราง font_concept กับ font)
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

// 4.4 ลบโปรเจกต์
app.delete('/api/projects/:id', async (req, res) => {
    const projectId = req.params.id;

    try {
        const connection = await pool.getConnection();
        // ⚠️ หมายเหตุ: หากขึ้น Error ลบไม่ได้ แสดงว่าต้องไปตั้งค่า Foreign Key เป็น ON DELETE CASCADE ใน DBeaver ครับ
        await connection.query("DELETE FROM project WHERE project_id = ?", [projectId]);
        connection.release();
        
        return res.json({ status: 'success', message: 'ลบโปรเจกต์สำเร็จ' });
    } catch (err) {
        console.error("Delete Project Error:", err);
        return res.status(500).json({ status: 'error', message: 'ไม่สามารถลบโปรเจกต์ได้ อาจมีข้อมูลเชื่อมโยงอยู่' });
    }
});


// ดึงรายการสินค้าทั้งหมดของ Project นั้นๆ
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

// บันทึกสินค้าใหม่ พร้อมรูปภาพ
// สังเกตว่าเราใช้ upload.single('image_product') เพราะส่งมาจาก formData ฝั่ง React
app.post('/api/brand_product', upload.single('image_product'), async (req, res) => {
    const { project_id, name_product, type_product } = req.body;
    const image_product = req.file ? req.file.filename : null; // ชื่อไฟล์รูป

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
//************************************************************************* */
//************************************************************************* */
//  API สำหรับวิเคราะห์ Brand DNA ด้วย Gemini (อัปเดตดึงสินค้าทั้งหมด)
//************************************************************************* */
//************************************************************************* */

app.post('/api/generate-brand-dna', async (req, res) => {
    //  ไม่ต้องรับ name_product, type_product จาก req.body  เพราะเราจะดึงจาก DB 
    const { project_id, user_id, business_type, archetype, audience_data } = req.body;

    if (!project_id) {
        return res.status(400).json({ status: 'error', message: 'Missing project_id' });
    }

    try {
        const connection = await pool.getConnection();

        //  ดึงข้อมูลสินค้าทั้งหมดของโปรเจกต์นี้จากฐานข้อมูล
        const [products] = await connection.query(
            "SELECT name_product, type_product FROM brand_product WHERE project_id = ?",
            [project_id]
        );
        
        // จัดรูปแบบข้อความรายการสินค้าเพื่อส่งให้ AI
        let productsText = "ยังไม่มีข้อมูลสินค้า";
        if (products.length > 0) {
            productsText = products.map((p, index) => 
                `        ${index + 1}. ชื่อสินค้า: ${p.name_product} (ประเภท: ${p.type_product})`
            ).join('\n');
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // Prompt 
        const prompt = `
        คุณเป็นผู้เชี่ยวชาญด้านการสร้างแบรนด์ (Brand Strategist) มืออาชีพ
        ข้อมูลเบื้องต้นของแบรนด์นี้:
        - รูปแบบธุรกิจ: ${business_type}
        - ตัวตนของแบรนด์ (Archetype): ${archetype}
        - ข้อมูลลูกค้าเป้าหมายเบื้องต้นที่เจ้าของแบรนด์คิดไว้: ${audience_data}
        - รายการสินค้าทั้งหมดของแบรนด์ที่จะขาย:
${productsText}

        ต้องการให้วิเคราะห์และส่งผลลัพธ์กลับมาเป็นรูปแบบ JSON เท่านั้น ห้ามมีข้อความอธิบายอื่นๆ นอกเหนือจาก JSON โดยให้มีโครงสร้าง Key ดังนี้:
        {
            "target_audience": "วิเคราะห์และเจาะลึกกลุ่มเป้าหมายให้ชัดเจนยิ่งขึ้น",
            "brand_value": "สรุปคุณค่าหลักของแบรนด์ (Brand Value) สั้นๆ กระชับๆ",
            "customer_perception": "เมื่อลูกค้าใช้สินค้าที่ระบุไว้ เขาจะรู้สึกหรือมองเห็นแบรนด์นี้เป็นแบบไหน",
            "design_suggestions": ["คำแนะนำการออกแบบข้อ 1", "คำแนะนำการออกแบบข้อ 2", "คำแนะนำการออกแบบข้อ 3"]
        }
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        const cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const aiData = JSON.parse(cleanedText);

        const sqlDNA = `
            INSERT INTO brand_dna (project_id, business_type, archetype_name, target_audience, brand_value, customer_perception, design_suggestions)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            business_type = VALUES(business_type), archetype_name = VALUES(archetype_name),
            target_audience = VALUES(target_audience), brand_value = VALUES(brand_value),
            customer_perception = VALUES(customer_perception), design_suggestions = VALUES(design_suggestions)
        `;
        await connection.query(sqlDNA, [
            project_id, business_type, archetype, aiData.target_audience, 
            aiData.brand_value, aiData.customer_perception, JSON.stringify(aiData.design_suggestions)
        ]);

        const sqlLog = `INSERT INTO api_logs (user_id, project_id, action_type, prompt_sent, ai_response) VALUES (?, ?, ?, ?, ?)`;
        await connection.query(sqlLog, [user_id || 0, project_id, 'GENERATE_BRAND_DNA', prompt, cleanedText]);

        connection.release();

        res.json({ status: 'success', data: { archetype, ...aiData } });

    } catch (err) {
        console.error("Gemini/DB Error:", err);
        res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดในการประมวลผล AI' });
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
            // แปลง string JSON กลับเป็น Array เพื่อให้ React ใช้งานได้
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
// ================= API สำหรับให้ AI แนะนำสีและฟอนต์ (จากข้อมูล Brand DNA) =================
app.get('/api/recommend-assets/:projectId', async (req, res) => {
    const { projectId } = req.params;
    try {
        const connection = await pool.getConnection();

        // 1. ดึงข้อมูล DNA และ สินค้า
        const [dnaRows] = await connection.query("SELECT * FROM brand_dna WHERE project_id = ?", [projectId]);
        const [prodRows] = await connection.query("SELECT name_product, type_product FROM brand_product WHERE project_id = ?", [projectId]);

        if (dnaRows.length === 0) {
            connection.release();
            return res.status(400).json({ status: 'error', message: 'ไม่พบข้อมูล Brand DNA กรุณาวิเคราะห์ก่อน' });
        }

        const dna = dnaRows[0];
        let productsText = prodRows.map(p => `${p.name_product} (${p.type_product})`).join(', ') || 'ไม่มีข้อมูลสินค้า';

        // 2. ส่ง Prompt ให้ Gemini แนะนำสีและฟอนต์
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
        คุณเป็นนักออกแบบแบรนด์มืออาชีพ
        ข้อมูลแบรนด์:
        - รูปแบบธุรกิจ: ${dna.business_type}
        - ตัวตนแบรนด์ (Archetype): ${dna.archetype_name}
        - กลุ่มเป้าหมาย: ${dna.target_audience}
        - สินค้า: ${productsText}

        กรุณาแนะนำ "1 ชุดสี" (ประกอบด้วย 5 สี) และ "1 ฟอนต์" (ขอเป็น Google Fonts ที่รองรับภาษาไทย เช่น Prompt, Kanit, Sarabun, Noto Sans Thai, Mali, Mitr)
        ตอบกลับเป็น JSON เท่านั้น ห้ามมีข้อความอื่น โครงสร้างดังนี้:
        {
            "color": {
                "name_palette": "ชื่อเรียกชุดสี (เช่น Earth Tone)",
                "hex1": "#...", "hex2": "#...", "hex3": "#...", "hex4": "#...", "hex5": "#..."
            },
            "font": {
                "font_name": "ชื่อฟอนต์"
            }
        }
        `;

        const result = await model.generateContent(prompt);
        const cleanedText = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const aiData = JSON.parse(cleanedText);

        // 3. บันทึกชุดสีลง Database อัตโนมัติ (เพื่อให้พร้อมกด Like / Select)
        const c = aiData.color;
        let color_id, color_concept_id;
        const [exColor] = await connection.query('SELECT color_id FROM color WHERE name_palette = ?', [c.name_palette]);
        if (exColor.length > 0) {
            color_id = exColor[0].color_id;
            await connection.query('UPDATE color SET color_code_1=?, color_code_2=?, color_code_3=?, color_code_4=?, color_code_5=? WHERE color_id=?', 
                [c.hex1, c.hex2, c.hex3, c.hex4, c.hex5, color_id]);
        } else {
            const [rColor] = await connection.query('INSERT INTO color (name_palette, color_code_1, color_code_2, color_code_3, color_code_4, color_code_5) VALUES (?,?,?,?,?,?)', 
                [c.name_palette, c.hex1, c.hex2, c.hex3, c.hex4, c.hex5]);
            color_id = rColor.insertId;
        }
        const [exCConcept] = await connection.query('SELECT id FROM color_concept WHERE project_id = ? AND color_id = ?', [projectId, color_id]);
        if (exCConcept.length > 0) {
            color_concept_id = exCConcept[0].id;
        } else {
            const [rCConcept] = await connection.query('INSERT INTO color_concept (color_id, project_id, is_liked, is_selected) VALUES (?, ?, 0, 0)', [color_id, projectId]);
            color_concept_id = rCConcept.insertId;
        }

        // 4. บันทึกฟอนต์ลง Database อัตโนมัติ
        const f = aiData.font;
        let font_id, font_concept_id;
        const [exFont] = await connection.query('SELECT font_id FROM font WHERE font_name = ?', [f.font_name]);
        if (exFont.length > 0) {
            font_id = exFont[0].font_id;
        } else {
            const [rFont] = await connection.query('INSERT INTO font (font_name) VALUES (?)', [f.font_name]);
            font_id = rFont.insertId;
        }
        const [exFConcept] = await connection.query('SELECT id FROM font_concept WHERE project_id = ? AND font_id = ?', [projectId, font_id]);
        if (exFConcept.length > 0) {
            font_concept_id = exFConcept[0].id;
        } else {
            const [rFConcept] = await connection.query('INSERT INTO font_concept (font_id, project_id, is_liked, is_selected) VALUES (?, ?, 0, 0)', [font_id, projectId]);
            font_concept_id = rFConcept.insertId;
        }

        connection.release();

        // 5. ส่งผลลัพธ์กลับไปให้หน้าเว็บ พร้อม id สำหรับกดถูกใจ
        res.json({
            status: 'success',
            color: { id: color_concept_id, color_id: color_id, ...c },
            font: { id: font_concept_id, font_id: font_id, ...f }
        });

    } catch (err) {
        console.error("Recommend Assets Error:", err);
        res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดจาก AI' });
    }
});






// ================= API สำหรับฟีเจอร์ Create Concept (Brand Name) =================

// 1. API ให้ Gemini สร้างชื่อแบรนด์ 10 ชื่อ
app.post('/api/generate-brand-names', async (req, res) => {
    const { project_id, user_id, product, category, benefit, target, tags, special, use_dna } = req.body;

    try {
        const connection = await pool.getConnection();
        let finalTarget = target;

        // ถ้า User ติ๊กเลือกใช้ข้อมูลจาก Brand DNA
        if (use_dna) {
            const [dnaRows] = await connection.query("SELECT target_audience FROM brand_dna WHERE project_id = ?", [project_id]);
            if (dnaRows.length > 0 && dnaRows[0].target_audience) {
                finalTarget = dnaRows[0].target_audience; // ดึงกลุ่มเป้าหมายจากที่ AI เคยวิเคราะห์ไว้มาใช้
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

        // เรียก Gemini
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const generatedNames = JSON.parse(cleanedText); // จะได้ Array ของชื่อ 10 อัน

        // บันทึกชื่อทั้ง 10 ลงตาราง name_concept
        for (const name of generatedNames) {
            await connection.query(
                "INSERT INTO name_concept (project_id, brand_name) VALUES (?, ?)",
                [project_id, name]
            );
        }

        // บันทึกประวัติลง generated_text_history
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

// 2. API ดึงรายชื่อแบรนด์ทั้งหมดของโปรเจกต์นี้
app.get('/api/brand-names/:projectId', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        // เรียงลำดับ: ตัวที่ถูกเลือกขึ้นก่อน -> ตามด้วยกดใจ -> ตามด้วยไอดีล่าสุด
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

// 3. API สำหรับกด Like ชื่อ
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

// 4. API สำหรับเลือกชื่อนี้ไปใช้ (Select)
app.put('/api/brand-names/select/:conceptId', async (req, res) => {
    const { project_id } = req.body;
    const concept_id = req.params.conceptId;
    try {
        const connection = await pool.getConnection();
        // 4.1 เคลียร์ให้ชื่ออื่นๆ ในโปรเจกต์นี้กลายเป็น ไม่ถูกเลือก (0)
        await connection.query("UPDATE name_concept SET is_selected = FALSE WHERE project_id = ?", [project_id]);
        // 4.2 ตั้งค่าให้ชื่อนี้ถูกเลือก (1)
        await connection.query("UPDATE name_concept SET is_selected = TRUE WHERE concept_id = ?", [concept_id]);
        // 4.3 อัปเดต ID กลับไปที่ตาราง project
        await connection.query("UPDATE project SET name_concept_id = ? WHERE project_id = ?", [concept_id, project_id]);
        connection.release();
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Database error' });
    }
});
// *******************************************//
// ================= API Color Palette (color_concept) =================

// 0. บันทึก palette เดียวลง DB (upsert) — ใช้เมื่อกดหัวใจหรือกดเลือก
app.post('/api/color-palettes/save-one', async (req, res) => {
  const { project_id, name_palette, color_code_1, color_code_2, color_code_3, color_code_4, color_code_5 } = req.body;
  if (!project_id || !name_palette) {
    return res.status(400).json({ status: 'error', message: 'ข้อมูลไม่ครบถ้วน' });
  }
  try {
    const connection = await pool.getConnection();

    // upsert ลง table color
    const [existing] = await connection.query(
      'SELECT color_id FROM color WHERE name_palette = ?',
      [name_palette]
    );
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

    // upsert ลง table color_concept
    const [existingConcept] = await connection.query(
      'SELECT id FROM color_concept WHERE project_id = ? AND color_id = ?',
      [project_id, color_id]
    );
    let concept_id;
    if (existingConcept.length > 0) {
      concept_id = existingConcept[0].id;
    } else {
      const [result] = await connection.query(
        'INSERT INTO color_concept (color_id, project_id, is_liked, is_selected) VALUES (?, ?, 0, 0)',
        [color_id, project_id]
      );
      concept_id = result.insertId;
    }

    connection.release();
    res.json({ status: 'success', color_id, concept_id });
  } catch (err) {
    console.error('❌ Save One Palette Error:', err);
    res.status(500).json({ status: 'error', message: 'บันทึก palette ไม่สำเร็จ', error: err.message });
  }
});

// 1. บันทึก palettes ทั้งหมดลง DB (upsert: ถ้ามีแล้วข้ามไป)
app.post('/api/color-palettes/save', async (req, res) => {
  const { project_id, palettes } = req.body;
  if (!project_id || !Array.isArray(palettes) || palettes.length === 0) {
    return res.status(400).json({ status: 'error', message: 'ข้อมูลไม่ครบถ้วน' });
  }

  try {
    const connection = await pool.getConnection();

    for (const p of palettes) {
      // 1.1 upsert ลง table color (ถ้า name_palette ซ้ำกันให้ update color_code แทน)
      const [existing] = await connection.query(
        'SELECT color_id FROM color WHERE name_palette = ?',
        [p.name_palette]
      );

      let color_id;
      if (existing.length > 0) {
        color_id = existing[0].color_id;
        // อัปเดต color_code ให้เป็นปัจจุบัน (กรณีมีการ re-generate)
        await connection.query(
          'UPDATE color SET color_code_1=?, color_code_2=?, color_code_3=?, color_code_4=?, color_code_5=? WHERE color_id=?',
          [p.color_code_1||'', p.color_code_2||'', p.color_code_3||'', p.color_code_4||'', p.color_code_5||'', color_id]
        );
      } else {
        // insert ใหม่
        const [result] = await connection.query(
          'INSERT INTO color (name_palette, color_code_1, color_code_2, color_code_3, color_code_4, color_code_5) VALUES (?,?,?,?,?,?)',
          [p.name_palette, p.color_code_1||'', p.color_code_2||'', p.color_code_3||'', p.color_code_4||'', p.color_code_5||'']
        );
        color_id = result.insertId;
      }

      // 1.2 upsert ลง table color_concept (project_id + color_id เป็น unique pair)
      const [existingConcept] = await connection.query(
        'SELECT id FROM color_concept WHERE project_id = ? AND color_id = ?',
        [project_id, color_id]
      );

      if (existingConcept.length === 0) {
        await connection.query(
          'INSERT INTO color_concept (color_id, project_id, is_liked, is_selected) VALUES (?, ?, 0, 0)',
          [color_id, project_id]
        );
      }
    }

    connection.release();
    res.json({ status: 'success', message: 'บันทึก palettes สำเร็จ' });
  } catch (err) {
    console.error('❌ Save Color Palettes Error:', err);
    res.status(500).json({ status: 'error', message: 'บันทึก palettes ไม่สำเร็จ', error: err.message });
  }
});

// 2. ดึง palettes ทั้งหมดของโปรเจกต์นี้ (join color + color_concept)
app.get('/api/color-palettes/:projectId', async (req, res) => {
  const { projectId } = req.params;
  if (!projectId || projectId === 'undefined') {
    return res.status(400).json({ status: 'error', message: 'Invalid Project ID' });
  }
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT 
         cc.id        AS concept_id,
         cc.color_id,
         cc.is_liked,
         cc.is_selected,
         cc.created_at,
         c.name_palette,
         c.color_code_1,
         c.color_code_2,
         c.color_code_3,
         c.color_code_4,
         c.color_code_5
       FROM color_concept cc
       JOIN color c ON cc.color_id = c.color_id
       WHERE cc.project_id = ?
       ORDER BY cc.is_selected DESC, cc.is_liked DESC, cc.id DESC`,
      [projectId]
    );
    connection.release();
    res.json({ status: 'success', palettes: rows });
  } catch (err) {
    console.error('❌ Fetch Color Palettes Error:', err);
    res.status(500).json({ status: 'error', message: 'ดึงข้อมูล palettes ไม่สำเร็จ' });
  }
});

// 3. กด Like / Unlike palette (อัปเดต is_liked ใน color_concept ตาม project_id + color_id)
app.put('/api/color-palettes/like/:colorId', async (req, res) => {
  const { colorId } = req.params;
  const { is_liked, project_id } = req.body;
  if (!project_id) {
    return res.status(400).json({ status: 'error', message: 'ต้องการ project_id' });
  }
  try {
    const connection = await pool.getConnection();
    await connection.query(
      'UPDATE color_concept SET is_liked = ? WHERE color_id = ? AND project_id = ?',
      [is_liked ? 1 : 0, colorId, project_id]
    );
    connection.release();
    res.json({ status: 'success' });
  } catch (err) {
    console.error('❌ Like Color Palette Error:', err);
    res.status(500).json({ status: 'error', message: 'Database error' });
  }
});

// 4. เลือก palette (is_selected) + อัปเดต color_id ใน project
app.put('/api/color-palettes/select/:conceptId', async (req, res) => {
  const { conceptId } = req.params;
  const { project_id } = req.body;
  if (!project_id) {
    return res.status(400).json({ status: 'error', message: 'ต้องการ project_id' });
  }
  try {
    const connection = await pool.getConnection();

    // 4.1 ดึง color_id จาก DB โดยตรง (ไม่พึ่ง body เพราะอาจ undefined/stale)
    const [conceptRows] = await connection.query(
      'SELECT color_id FROM color_concept WHERE id = ?',
      [conceptId]
    );
    if (conceptRows.length === 0) {
      connection.release();
      console.error(`❌ ไม่พบ color_concept id = ${conceptId}`);
      return res.status(404).json({ status: 'error', message: 'ไม่พบ concept นี้' });
    }
    const finalColorId = conceptRows[0].color_id;
    console.log(`🔍 concept_id=${conceptId} → color_id=${finalColorId}`);

    // 4.2 เคลียร์ is_selected ทุก palette ของโปรเจกต์นี้ก่อน
    await connection.query(
      'UPDATE color_concept SET is_selected = 0 WHERE project_id = ?',
      [project_id]
    );

    // 4.3 ตั้งค่า is_selected = 1 ให้กับ palette ที่เลือก
    await connection.query(
      'UPDATE color_concept SET is_selected = 1 WHERE id = ?',
      [conceptId]
    );

    // 4.4 อัปเดต project.color_id
    await connection.query(
      'UPDATE project SET color_id = ? WHERE project_id = ?',
      [finalColorId, project_id]
    );
    console.log(`✅ อัปเดต project.color_id = ${finalColorId} สำหรับ project_id = ${project_id}`);

    connection.release();
    res.json({ status: 'success', color_id: finalColorId });
  } catch (err) {
    console.error('❌ Select Color Palette Error:', err);
    res.status(500).json({ status: 'error', message: 'Database error' });
  }
});

// sync Google Fonts ลง table font (เรียกจาก frontend ตอนโหลด Google Fonts API)
app.post('/api/fonts/sync-google', async (req, res) => {
  const { fonts } = req.body; // array ของ { font_name }
  if (!Array.isArray(fonts) || fonts.length === 0) {
    return res.status(400).json({ status: 'error', message: 'ข้อมูลไม่ครบถ้วน' });
  }
  try {
    const connection = await pool.getConnection();
    let inserted = 0;
    for (const f of fonts) {
      const [existing] = await connection.query(
        'SELECT font_id FROM font WHERE font_name = ?', [f.font_name]
      );
      if (existing.length === 0) {
        await connection.query(
          'INSERT INTO font (font_name, file_font) VALUES (?, NULL)',
          [f.font_name]
        );
        inserted++;
      }
    }
    connection.release();
    console.log(`✅ Synced ${inserted} new Google Fonts to DB`);
    res.json({ status: 'success', inserted });
  } catch (err) {
    console.error('❌ Sync Google Fonts Error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ดึง font ทั้งหมดจาก table font พร้อม concept info ของ project นี้
app.get('/api/fonts/all/:projectId', async (req, res) => {
  const { projectId } = req.params;
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT
         f.font_id,
         f.font_name,
         f.file_font,
         fc.id         AS concept_id,
         fc.is_liked,
         fc.is_selected
       FROM font f
       LEFT JOIN font_concept fc ON f.font_id = fc.font_id AND fc.project_id = ?
       ORDER BY f.font_id ASC`,
      [projectId]
    );
    connection.release();
    res.json({ status: 'success', fonts: rows });
  } catch (err) {
    console.error('❌ Fetch All Fonts Error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});


// ================= API Font (font_concept) =================

// 0. บันทึก font เดียวลง DB (upsert) — ใช้เมื่อกดหัวใจหรือกดเลือก
app.post('/api/fonts/save-one', async (req, res) => {
  const { project_id, font_name, file_font } = req.body;
  if (!project_id || !font_name) {
    return res.status(400).json({ status: 'error', message: 'ข้อมูลไม่ครบถ้วน' });
  }
  try {
    const connection = await pool.getConnection();

    // upsert ลง table font
    const [existing] = await connection.query(
      'SELECT font_id FROM font WHERE font_name = ?',
      [font_name]
    );
    let font_id;
    if (existing.length > 0) {
      font_id = existing[0].font_id;
    } else {
      const [result] = await connection.query(
        'INSERT INTO font (font_name, file_font) VALUES (?, ?)',
        [font_name, file_font || null]
      );
      font_id = result.insertId;
    }

    // upsert ลง table font_concept
    const [existingConcept] = await connection.query(
      'SELECT id FROM font_concept WHERE project_id = ? AND font_id = ?',
      [project_id, font_id]
    );
    let concept_id;
    if (existingConcept.length > 0) {
      concept_id = existingConcept[0].id;
    } else {
      const [result] = await connection.query(
        'INSERT INTO font_concept (font_id, project_id, is_liked, is_selected) VALUES (?, ?, 0, 0)',
        [font_id, project_id]
      );
      concept_id = result.insertId;
    }

    connection.release();
    res.json({ status: 'success', font_id, concept_id });
  } catch (err) {
    console.error('❌ Save One Font Error:', err);
    res.status(500).json({ status: 'error', message: 'บันทึก font ไม่สำเร็จ', error: err.message });
  }
});

// 1. ดึง fonts ทั้งหมดของโปรเจกต์นี้ (join font + font_concept)
app.get('/api/fonts/:projectId', async (req, res) => {
  const { projectId } = req.params;
  if (!projectId || projectId === 'undefined') {
    return res.status(400).json({ status: 'error', message: 'Invalid Project ID' });
  }
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT
         fc.id         AS concept_id,
         fc.font_id,
         fc.is_liked,
         fc.is_selected,
         fc.created_at,
         f.font_name,
         f.file_font
       FROM font_concept fc
       JOIN font f ON fc.font_id = f.font_id
       WHERE fc.project_id = ?
       ORDER BY fc.is_selected DESC, fc.is_liked DESC, fc.id DESC`,
      [projectId]
    );
    connection.release();
    res.json({ status: 'success', fonts: rows });
  } catch (err) {
    console.error('❌ Fetch Fonts Error:', err);
    res.status(500).json({ status: 'error', message: 'ดึงข้อมูล fonts ไม่สำเร็จ' });
  }
});

// 2. กด Like / Unlike font
app.put('/api/fonts/like/:fontId', async (req, res) => {
  const { fontId } = req.params;
  const { is_liked, project_id } = req.body;
  if (!project_id) {
    return res.status(400).json({ status: 'error', message: 'ต้องการ project_id' });
  }
  try {
    const connection = await pool.getConnection();
    await connection.query(
      'UPDATE font_concept SET is_liked = ? WHERE font_id = ? AND project_id = ?',
      [is_liked ? 1 : 0, fontId, project_id]
    );
    connection.release();
    res.json({ status: 'success' });
  } catch (err) {
    console.error('❌ Like Font Error:', err);
    res.status(500).json({ status: 'error', message: 'Database error' });
  }
});

// 3. เลือก font (is_selected) + อัปเดต font_id ใน project
app.put('/api/fonts/select/:conceptId', async (req, res) => {
  const { conceptId } = req.params;
  const { project_id } = req.body;
  if (!project_id) {
    return res.status(400).json({ status: 'error', message: 'ต้องการ project_id' });
  }
  try {
    const connection = await pool.getConnection();

    // ดึง font_id จาก DB โดยตรง
    const [conceptRows] = await connection.query(
      'SELECT font_id FROM font_concept WHERE id = ?',
      [conceptId]
    );
    if (conceptRows.length === 0) {
      connection.release();
      console.error(`❌ ไม่พบ font_concept id = ${conceptId}`);
      return res.status(404).json({ status: 'error', message: 'ไม่พบ concept นี้' });
    }
    const finalFontId = conceptRows[0].font_id;
    console.log(`🔍 font concept_id=${conceptId} → font_id=${finalFontId}`);

    // เคลียร์ is_selected ทุก font ของโปรเจกต์นี้
    await connection.query(
      'UPDATE font_concept SET is_selected = 0 WHERE project_id = ?',
      [project_id]
    );

    // ตั้งค่า is_selected = 1
    await connection.query(
      'UPDATE font_concept SET is_selected = 1 WHERE id = ?',
      [conceptId]
    );

    // อัปเดต project.font_id
    await connection.query(
      'UPDATE project SET font_id = ? WHERE project_id = ?',
      [finalFontId, project_id]
    );
    console.log(`✅ อัปเดต project.font_id = ${finalFontId} สำหรับ project_id = ${project_id}`);

    connection.release();
    res.json({ status: 'success', font_id: finalFontId });
  } catch (err) {
    console.error('❌ Select Font Error:', err);
    res.status(500).json({ status: 'error', message: 'Database error' });
  }
});
// *******************************************//



// ================= ฟังก์ชันช่วยเหลือ: ดาวน์โหลดรูปภาพจาก AI URL มาเซฟในเครื่อง =================
// (ฟังก์ชัน downloadImage ยังคงใช้ตัวเดิมของคุณได้เลย)
const downloadImage = async (url, filepath) => {
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream'
    });
    return new Promise((resolve, reject) => {
        response.data.pipe(fs.createWriteStream(filepath))
            .on('error', reject)
            .on('finish', () => resolve(filepath));
    });
};

// ================= API สำหรับสร้างโลโก้ (OpenAI DALL·E 3) =================

// ==================================
app.post('/api/generate-logo', async (req, res) => {
    const { 
        project_id, user_id, brand_name, brand_value, 
        products, styles, details, negative_prompt,
        use_imported_color, use_imported_font 
    } = req.body;

    if (!project_id) return res.status(400).json({ status: 'error', message: 'Project ID is required' });

    //  1. ดักจับ user_id ถ้าเป็น 0 หรือไม่มีค่า ให้เปลี่ยนเป็น null เพื่อไม่ให้ติด Foreign Key
    const finalUserId = (!user_id || user_id === 0) ? null : user_id;

    //  2. ดักจับ products ให้ชัวร์ว่าเป็นข้อความแน่ๆ ป้องกันการเกิด [object Object]
    let productsText = "";
    if (Array.isArray(products)) {
        productsText = products.map(p => p.name_product || p).join(', ');
    } else {
        productsText = products || "";
    }

    
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
                colorText = `STRICT COLOR PALETTE: You MUST strictly use ONLY these exact color hex codes (or visually identical tones): ${hexColors}.`;
            }
        }

        if (use_imported_font) {
            const [fontRows] = await connection.query(`
                SELECT f.* FROM font_concept fc
                JOIN font f ON fc.font_id = f.font_id
                WHERE fc.project_id = ? AND fc.is_selected = 1 LIMIT 1
            `, [project_id]);
            
            if (fontRows.length > 0) {
                fontText = `TYPOGRAPHY STYLE: The text should be styled specifically to look like the font "${fontRows[0].font_name}". Make it clean and highly legible.`;
            }
        }
        connection.release();

        let prompt = `I need a pure, flat, 2D vector logo graphic. YOU MUST STRICTLY FOLLOW THESE RULES:
1. ABSOLUTELY NO MOCKUPS: Do not place the logo on paper, business cards, wood, or walls. Do not draw pens, pencils, clips, or hands.
2. BACKGROUND MUST BE  ONLY WHITE (#FFFFFF) : NO shadows, NO gradients, NO scenes, NO textures.
3. The image must contain ONLY the logo icon and the brand name, placed directly in the center of the white canvas.
"BACKGROUND MUST BE  ONLY WHITE (#FFFFFF)!!!" \n\n`;
        
       

        prompt += `BRAND NAME: EXACTLY "${brand_name}". \n`;
        prompt += `Draw the typography cleanly below or next to the icon. Treat the text as a simple graphic element.\n\n`;
        
        if (brand_value) prompt += `CORE VALUE: ${brand_value}\n`;
        if (styles) prompt += `DESIGN STYLE: ${styles} (Remember: FLAT 2D VECTOR ONLY)\n`;
        if (details) prompt += `SPECIFIC DETAILS: ${details}\n`;
        
        if (colorText) prompt += `\n${colorText}\n`;
        if (fontText) prompt += `\n${fontText}\n`;

        // ย้ำ Negative Prompt ดักทาง DALL-E 3 ขั้นสูงสุด
        prompt += `\nCRITICAL NEGATIVE PROMPT (DO NOT INCLUDE): `;
        prompt += negative_prompt ? `${negative_prompt}, ` : ``;
        prompt += ` mockups, presentation slides, stationery, realistic photography, 3D rendering, drop shadows, lighting effects, messy backgrounds, human hands, coffee shop backgrounds. ONLY THE LOGO ON WHITE.`;

        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: prompt,
            n: 1,
            size: "1024x1024",
            response_format: "b64_json",
        });

        const base64Data = response.data[0].b64_json;
        const fileName = `logo_${Date.now()}.png`;
        const filePath = path.join('uploads', fileName);

        fs.writeFileSync(filePath, base64Data, 'base64');
        const imageUrl = `/uploads/${fileName}`;

        const conn2 = await pool.getConnection();
        await conn2.query(
            //  3. บันทึก prompt และใช้ finalUserId ที่เราเคลียร์ค่าแล้ว 
            "INSERT INTO generated_history (project_id, user_id, generation_type, image_url, prompt, is_selected) VALUES (?, ?, ?, ?, ?, 0)",
            [project_id, finalUserId, 'LOGO', imageUrl, prompt]
        );
        conn2.release();

        res.json({ status: 'success', image_url: imageUrl, prompt: prompt });

    } catch (err) {
        console.error("Generate Logo Error:", err);
        res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดในการ Generate รูปภาพ' });
    }
});

// ================= API สำหรับกด Like/Unlike รูปที่เจน =================
// (ใช้ตัวเดิมของคุณได้เลย)
app.put('/api/like-generated-item/:historyId', async (req, res) => {
    const { historyId } = req.params;
    const { is_liked } = req.body;
    try {
        const connection = await pool.getConnection();
        await connection.query(
            "UPDATE generated_history SET is_liked = ? WHERE history_id = ?", 
            [is_liked, historyId]
        );
        connection.release();
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Database error' });
    }
});
// ================= API สำหรับดึงรูปภาพโลโก้ที่สร้างแล้ว =================
app.get('/api/generated-logos/:projectId', async (req, res) => {
    const { projectId } = req.params;
    try {
        const connection = await pool.getConnection();
        // เรียงรูปที่ถูกเลือกไว้บนสุด -> ตามด้วยกดใจ -> ตามด้วยเจนล่าสุด
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

// ================= API สำหรับเลือกโลโก้ไปใช้งานจริง (ใหม่!) =================
// ================= API สำหรับเลือก/ยกเลิกเลือกโลโก้ (อัปเดตใหม่ รองรับการกดซ้ำเพื่อยกเลิก) =================
app.put('/api/generated-logos/select/:historyId', async (req, res) => {
    const { project_id, image_url, action } = req.body; // 👈 เพิ่มตัวแปร action เพื่อบอกว่า เลือก หรือ ยกเลิก
    const history_id = req.params.historyId;
    try {
        const connection = await pool.getConnection();

        if (action === 'deselect') {
            // ถ้ายกเลิกการเลือก
            await connection.query("UPDATE generated_history SET is_selected = 0 WHERE history_id = ?", [history_id]);
            await connection.query("UPDATE project SET image_logo = NULL WHERE project_id = ?", [project_id]); // 👈 ลบรูปออกจากหน้า Project
        } else {
            // ถ้าเป็นการเลือกรูปใหม่
            // 1. เคลียร์โลโก้อื่นๆ ในโปรเจกต์นี้ให้กลายเป็นไม่ได้เลือก (0)
            await connection.query("UPDATE generated_history SET is_selected = 0 WHERE project_id = ? AND generation_type = 'LOGO'", [project_id]);
            // 2. ตั้งค่าโลโก้นี้เป็นถูกเลือก (1)
            await connection.query("UPDATE generated_history SET is_selected = 1 WHERE history_id = ?", [history_id]);
            // 3. อัปเดต Path รูปภาพลงในตาราง project
            await connection.query("UPDATE project SET image_logo = ? WHERE project_id = ?", [image_url, project_id]);
        }
        
        connection.release();
        res.json({ status: 'success' });
    } catch (err) {
        console.error("Select Logo Error:", err);
        res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

// ================= API สำหรับจัดการ Package Catalog (brand_product + package_catalog) =================
// paaaaaaaaaaaaaaaaaaaaaaaaccccccccccccckkkkkkkkkagggggeeeeeeeeeeeeeeeeeeeee ตรงนี้เป็นต้นไปปปปปปปปปปปปปปปปปปปปปปปปปปปปปปปป
// 1. บันทึก package_id ลง brand_product (เมื่อเลือกแพ็กเกจในหน้า Catalog)
app.patch('/api/brand_product/:id/package', async (req, res) => {
  const { id } = req.params;
  const { package_id } = req.body;

  try {
    const connection = await pool.getConnection();
    await connection.query(
      'UPDATE brand_product SET package_id = ? WHERE product_id = ?',
      [package_id, id]
    );
    connection.release();
    res.json({ status: 'success', message: 'บันทึก package เรียบร้อยแล้ว' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});
// บันทึก is_liked ลง package_catalog (จาก heart picker บนการ์ด)
app.post('/api/package-catalog/like', async (req, res) => {
  const { product_id, package_id, is_liked } = req.body;
  if (!product_id || !package_id) {
    return res.status(400).json({ status: 'error', message: 'ข้อมูลไม่ครบถ้วน' });
  }
  try {
    const connection = await pool.getConnection();
    const [existing] = await connection.query(
      'SELECT id FROM package_catalog WHERE product_id = ? AND package_id = ?',
      [product_id, package_id]
    );
    if (existing.length > 0) {
      await connection.query(
        'UPDATE package_catalog SET is_liked = ? WHERE product_id = ? AND package_id = ?',
        [is_liked ? 1 : 0, product_id, package_id]
      );
    } else {
      await connection.query(
        'INSERT INTO package_catalog (package_id, product_id, is_liked, is_selected) VALUES (?, ?, ?, 0)',
        [package_id, product_id, is_liked ? 1 : 0]
      );
    }
    connection.release();
    res.json({ status: 'success' });
  } catch (err) {
    console.error('❌ Package like error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// บันทึก package_catalog (liked หรือ selected)
app.post('/api/package-catalog', async (req, res) => {
  const { product_id, package_id, action } = req.body;

  if (!product_id || !package_id || !action) {
    return res.status(400).json({ status: 'error', message: 'ข้อมูลไม่ครบถ้วน' });
  }

  try {
    const connection = await pool.getConnection();

    // ถ้าเป็น select → clear is_selected ของ product นี้ก่อน (1 product มีได้ 1 อัน)
    if (action === 'select') {
      await connection.query(
        'UPDATE package_catalog SET is_selected = 0 WHERE product_id = ?',
        [product_id]
      );
    }

    // เช็คว่ามีแถวนี้อยู่แล้วไหม
    const [existing] = await connection.query(
      'SELECT id FROM package_catalog WHERE product_id = ? AND package_id = ?',
      [product_id, package_id]
    );

    if (existing.length > 0) {
      if (action === 'select') {
        await connection.query(
          'UPDATE package_catalog SET is_selected = 1 WHERE product_id = ? AND package_id = ?',
          [product_id, package_id]
        );
      } else {
        // toggle like
        await connection.query(
          'UPDATE package_catalog SET is_liked = NOT is_liked WHERE product_id = ? AND package_id = ?',
          [product_id, package_id]
        );
      }
    } else {
      await connection.query(
        'INSERT INTO package_catalog (package_id, product_id, is_liked, is_selected) VALUES (?, ?, ?, ?)',
        [package_id, product_id, action === 'like' ? 1 : 0, action === 'select' ? 1 : 0]
      );
    }

    connection.release();
    res.json({ status: 'success' });
  } catch (err) {
    console.error('Package catalog error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});








// =====================================================================
// ================= API สำหรับ ADMIN DASHBOARD =========================
// =====================================================================

// 1. Admin Login
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
            // ไม่ส่งรหัสผ่านกลับไปเพื่อความปลอดภัย
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

// 2. ดึงจำนวน User ทั้งหมด
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

// 3. ดึงสถิติการใช้งาน API (Gemini & DALL-E) ย้อนหลัง X วัน
app.get('/api/admin/stats/api-usage', async (req, res) => {
    const days = parseInt(req.query.days) || 7; // ค่าเริ่มต้น 7 วัน
    try {
        const connection = await pool.getConnection();
        
        // สถิติ Gemini (จากตาราง api_logs)
        const [geminiStats] = await connection.query(`
            SELECT DATE(created_at) as date, COUNT(*) as count 
            FROM api_logs 
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            GROUP BY DATE(created_at) ORDER BY date ASC
        `, [days]);

        // สถิติ DALL-E 3 (จากตาราง generated_history)
        const [dalleStats] = await connection.query(`
            SELECT DATE(created_at) as date, COUNT(*) as count 
            FROM generated_history 
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            GROUP BY DATE(created_at) ORDER BY date ASC
        `, [days]);

        connection.release();

        // รวมข้อมูลเพื่อส่งให้ Frontend กราฟ
        res.json({ 
            status: 'success', 
            gemini: geminiStats,
            dalle: dalleStats
        });
    } catch (err) {
        console.error("API Stats Error:", err);
        res.status(500).json({ status: 'error' });
    }
});






const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`รันได้แล้ว Server running on http://localhost:${PORT}`);
});