import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import Replicate from "replicate"; // 1. เพิ่มบรรทัดนี้
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';

import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');
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
//  API สำหรับวิเคราะห์ Brand DNA ด้วย Gemini (อัปเดตดึงสินค้าทั้งหมด)
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
        คุณเป็นผู้เชี่ยวชาญด้านการสร้างแบรนด์ (Brand Strategist) ระดับโลก
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
        - กลุ่มเป้าหมาย: ${finalTarget}
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



///********สร้าง logo ******* */

// ================= ฟังก์ชันช่วยเหลือ: ดาวน์โหลดรูปภาพจาก AI URL มาเซฟในเครื่อง =================
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

// ================= API สำหรับสร้างโลโก้ (FLUX.1 Schnell) =================
app.post('/api/generate-logo', async (req, res) => {
    const { 
        project_id, user_id, 
        brand_name, brand_value, products, 
        styles, details, not_want 
    } = req.body;

    if (!project_id) {
        return res.status(400).json({ status: 'error', message: 'Missing project_id' });
    }

    try {
        const connection = await pool.getConnection();

        // 1. 👇 เตรียมข้อมูลเพื่อสร้าง Prompt ภาษาอังกฤษ (ต้องมีลอจิกแปลภาษา หรือใช้ AI แปล)
        // ** สำคัญ **: FLUX เข้าใจภาษาอังกฤษได้ดีที่สุด 
        // ในขั้นตอนนี้คุณควรมีฟังก์ชันแปลความหมายภาษาไทย -> คีย์เวิร์ดภาษาอังกฤษ
        // สมมติว่าแปลแล้วได้ดังนี้:
        const translatedStyle = styles.join(', '); // เช่น "modern, luxury, traditional Thai"
        const productSubject = products.length > 0 ? products[0].name_product : 'abstract symbol'; // เอาสินค้าตัวแรกมาเป็นประธาน
        
        // 2. 👇 ผสม Prompt ภาษาอังกฤษ (ตัวอย่างปรับแต่งสำหรับ FLUX)
        const englishPrompt = `
            professional vector logo, flat design, minimal, clean lines, isolated on solid white background, 
            featuring a stylized icon of ${productSubject} reflecting brand values of ${brand_value}. 
            Style tags: ${translatedStyle}, stylized Thai art elements. 
            Include text "${brand_name}" underneath in a modern clean sans-serif font. 
            ${details ? 'Additional details: ' + details : ''}
            High quality, intricate details.
        `;
        const negativePrompt = not_want || '';

        console.log("Sending Prompt to FLUX:", englishPrompt);

       // 3. 👇 เรียกใช้ AI ของจริง (FLUX.1 Schnell)
        console.log("🎨 กำลังสั่งให้ FLUX.1 Schnell วาดโลโก้...");
        
        const output = await replicate.run(
            "black-forest-labs/flux-schnell",
            {
                input: {
                    prompt: englishPrompt,
                    go_fast: true,
                    megapixels: "1",
                    num_outputs: 1,
                    aspect_ratio: "1:1",
                    output_format: "png", // บังคับให้ออกมาเป็น PNG
                    output_quality: 100
                }
            }
        );

        // ดึง URL รูปภาพแรกที่ AI เจนเสร็จ
        const aiImageUrl = output[0]; 
        console.log("✅ ได้ URL รูปโลโก้จาก AI แล้ว:", aiImageUrl);
        // -------------------------------------------------------------

       // 4. 👇 ดาวน์โหลดรูปภาพจาก AI มาเซฟใน Server ของเรา
        const filename = `logo_${project_id}_${Date.now()}.png`;
        
        // ใช้ process.cwd() แทน __dirname สำหรับโหมด ES Module
        const targetDir = path.join(process.cwd(), 'uploads', 'generated', 'logos');
        
        // เช็คว่ามีโฟลเดอร์รองรับรูปหรือยัง ถ้ายังไม่มีให้สร้างเลย (recursive: true คือสร้างโฟลเดอร์ซ้อนๆ กันให้ครบ)
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        const localPath = path.join(targetDir, filename);
        const dbImagePath = `/uploads/generated/logos/${filename}`; // path สำหรับเก็บใน DB

        await downloadImage(aiImageUrl, localPath);

       // 5. 👇 บันทึกประวัติลงฐานข้อมูล generated_history (ปรับให้ตรงกับ DB ของคุณ)
        const sqlLog = `
            INSERT INTO generated_history 
            (project_id, generation_type, prompt, image_url, credits_used, model_name) 
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        await connection.query(sqlLog, [
            project_id, 
            'LOGO', 
            englishPrompt, 
            dbImagePath, 
            1, // สมมติว่าใช้ 1 เครดิต
            'flux.1-schnell'
        ]);

        connection.release();

        // 6. 👇 ส่ง Path รูปภาพกลับไปให้ Frontend
        res.json({ status: 'success', imageUrl: dbImagePath });
    } catch (err) {
        console.error("Generate Logo Error:", err);
        res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดในการสร้างโลโก้' });
    }
});

// ================= API สำหรับกด Like/Unlike รูปที่เจน =================
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});