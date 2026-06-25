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
import sharp from 'sharp';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import Omise from 'omise';

// สร้าง Client สำหรับตรวจสอบ Token จาก Google
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);


import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');
dotenv.config();

const app = express();
app.use(cors({
    origin: [
        process.env.FRONTEND_URL,
        process.env.ADMIN_URL,
        'http://localhost:5173',
        'http://localhost:5174'
    ].filter(Boolean),
    credentials: true
}));

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static('uploads'));

// Middleware: track last_active_at สำหรับทุก request ที่มี user_id
const activeUserCache = new Map(); // เก็บ cache ไม่ให้ UPDATE ถี่เกินไป
app.use((req, res, next) => {
    const userId = req.body?.user_id || req.params?.user_id;
    if (userId && !isNaN(userId) && parseInt(userId) > 0 && !req.path.startsWith('/api/admin')) {
        const now = Date.now();
        const lastUpdate = activeUserCache.get(parseInt(userId)) || 0;
        if (now - lastUpdate > 60000) { // update ไม่เกิน 1 ครั้ง/นาที/user
            activeUserCache.set(parseInt(userId), now);
            pool.getConnection().then(conn => {
                conn.query('UPDATE user_profile SET last_active_at = NOW() WHERE user_id = ?', [userId])
                    .catch(() => {}) // ignore if column doesn't exist yet
                    .finally(() => conn.release());
            }).catch(() => {});
        }
    }
    next();
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const googleImagen = new OpenAI({
    apiKey: process.env.GEMINI_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});

const omise = Omise({
    publicKey: process.env.OMISE_PUBLIC_KEY,
    secretKey: process.env.OMISE_SECRET_KEY,
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
    // รองรับช่อง login เดียว: รับได้ทั้ง username หรือ email (feature 1)
    const identifier = req.body.identifier || req.body.user_name || req.body.email;
    const { password } = req.body;
    if (!identifier || !password) {
        return res.status(400).json({ status: 'error', message: 'กรุณากรอกชื่อผู้ใช้/อีเมล และรหัสผ่าน' });
    }
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.query(
            'SELECT * FROM user_profile WHERE user_name = ? OR email = ?',
            [identifier, identifier]
        );

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
                        console.log(`✅ อัปเกรดความปลอดภัยให้บัญชีเก่า: ${user.user_name} เรียบร้อยแล้ว!`);
                    } catch (hashErr) {
                        console.error("Auto-migrate password error:", hashErr);
                    }
                }
            }

            if (validPassword) {
                // อัปเดต last_active_at เมื่อ login สำเร็จ
                try {
                    await connection.query('UPDATE user_profile SET last_active_at = NOW() WHERE user_id = ?', [user.user_id]);
                } catch (e) { /* column อาจยังไม่มี */ }

                // ถ้าเป็นบัญชีโรงพิมพ์ (Third Party) แนบ role + third_party_id ให้ Frontend (feature 1)
                if (user.account_type === 'printshop') {
                    try {
                        const [tpRows] = await connection.query(
                            'SELECT third_party_id, phone, address, map_url, line_id, facebook, website, about, open_hours FROM third_party WHERE user_id = ?',
                            [user.user_id]
                        );
                        if (tpRows.length > 0) {
                            user.role = 'printshop';
                            user.third_party_id = tpRows[0].third_party_id;
                            Object.assign(user, tpRows[0]);
                        }
                    } catch (e) { /* third_party.user_id อาจยังไม่ได้ migrate */ }
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

// ================= API GOOGLE AUTH (รองรับทั้ง access_token และ ID token) =================
app.post('/api/auth/google', async (req, res) => {
    const { token } = req.body;
    try {
        let googleId, email, given_name, family_name, picture;

        // ตรวจว่าเป็น access_token หรือ ID token (JWT)
        const isIdToken = token && token.split('.').length === 3;

        if (isIdToken) {
            // ID token (credential) — ใช้ verifyIdToken
            const ticket = await googleClient.verifyIdToken({
                idToken: token,
                audience: process.env.GOOGLE_CLIENT_ID,
            });
            const payload = ticket.getPayload();
            ({ sub: googleId, email, given_name, family_name, picture } = payload);
        } else {
            // access_token — ใช้ Google UserInfo API
            const userInfoRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const info = userInfoRes.data;
            googleId = info.sub;
            email = info.email;
            given_name = info.given_name || '';
            family_name = info.family_name || '';
            picture = info.picture || null;
        }

        const connection = await pool.getConnection();
        const [users] = await connection.query('SELECT * FROM user_profile WHERE email = ?', [email]);

        if (users.length > 0) {
            try {
                await connection.query('UPDATE user_profile SET google_id = ?, image_profile = ?, last_active_at = NOW() WHERE email = ?', [googleId, picture, email]);
            } catch (e) {
                await connection.query('UPDATE user_profile SET google_id = ?, image_profile = ? WHERE email = ?', [googleId, picture, email]);
            }
            const [updatedUser] = await connection.query('SELECT * FROM user_profile WHERE email = ?', [email]);
            connection.release();
            return res.json({ status: 'success', message: 'เข้าสู่ระบบด้วย Google สำเร็จ', user: updatedUser[0] });
        } else {
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

// ================= PROJECT COMPLETION % =================

app.get('/api/projects/:projectId/completion', async (req, res) => {
    const { projectId } = req.params;
    try {
        const connection = await pool.getConnection();
        const [projRows] = await connection.query('SELECT brand_name, color_id, font_id, image_logo FROM project WHERE project_id = ?', [projectId]);
        if (projRows.length === 0) {
            connection.release();
            return res.status(404).json({ status: 'error', message: 'Project not found' });
        }
        const proj = projRows[0];

        const [productRows] = await connection.query('SELECT product_id, package_id FROM brand_product WHERE project_id = ?', [projectId]);
        const [labelRows] = await connection.query('SELECT label_id FROM label_design WHERE project_id = ? LIMIT 1', [projectId]);
        const [mockupRows] = await connection.query("SELECT mockup_id FROM mockup_design WHERE project_id = ? AND status = 'exported' LIMIT 1", [projectId]);
        connection.release();

        const hasName = !!(proj.brand_name && proj.brand_name.trim() !== '');
        const hasColor = !!proj.color_id;
        const hasFont = !!proj.font_id;
        const hasLogo = !!(proj.image_logo && proj.image_logo.trim() !== '');
        const hasProduct = productRows.length > 0;
        const hasPackaging = productRows.some(p => p.package_id != null);
        const hasLabel = labelRows.length > 0;
        const hasMockupExport = mockupRows.length > 0;

        let percentage = 0;
        if (hasName) percentage += 15;
        if (hasColor) percentage += 15;
        if (hasFont) percentage += 15;
        if (hasLogo) percentage += 30;
        if (hasProduct) percentage += 10;
        if (hasPackaging) percentage += 5;
        if (hasLabel) percentage += 5;
        if (hasMockupExport) percentage += 5;

        res.json({ status: 'success', percentage, details: { hasName, hasColor, hasFont, hasLogo, hasProduct, hasPackaging, hasLabel, hasMockupExport } });
    } catch (err) {
        console.error("Completion calc error:", err);
        res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

app.get('/api/users/:userId/completions', async (req, res) => {
    const { userId } = req.params;
    try {
        const connection = await pool.getConnection();
        const [projects] = await connection.query(`
            SELECT p.project_id, p.brand_name, p.color_id, p.font_id, p.image_logo,
                (SELECT COUNT(*) FROM brand_product bp WHERE bp.project_id = p.project_id) AS product_count,
                (SELECT COUNT(*) FROM brand_product bp WHERE bp.project_id = p.project_id AND bp.package_id IS NOT NULL) AS packaging_count,
                (SELECT COUNT(*) FROM label_design ld WHERE ld.project_id = p.project_id) AS label_count,
                (SELECT COUNT(*) FROM mockup_design md WHERE md.project_id = p.project_id AND md.status = 'exported') AS mockup_export_count
            FROM project p
            WHERE p.user_id = ?
            ORDER BY p.project_id DESC
        `, [userId]);
        connection.release();

        const result = projects.map(proj => {
            const hasName = !!(proj.brand_name && proj.brand_name.trim() !== '');
            const hasColor = !!proj.color_id;
            const hasFont = !!proj.font_id;
            const hasLogo = !!(proj.image_logo && proj.image_logo.trim() !== '');
            const hasProduct = proj.product_count > 0;
            const hasPackaging = proj.packaging_count > 0;
            const hasLabel = proj.label_count > 0;
            const hasMockupExport = proj.mockup_export_count > 0;

            let percentage = 0;
            if (hasName) percentage += 15;
            if (hasColor) percentage += 15;
            if (hasFont) percentage += 15;
            if (hasLogo) percentage += 30;
            if (hasProduct) percentage += 10;
            if (hasPackaging) percentage += 5;
            if (hasLabel) percentage += 5;
            if (hasMockupExport) percentage += 5;

            return { project_id: proj.project_id, percentage, details: { hasName, hasColor, hasFont, hasLogo, hasProduct, hasPackaging, hasLabel, hasMockupExport } };
        });

        res.json({ status: 'success', projects: result });
    } catch (err) {
        console.error("User completions error:", err);
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

    if (user_id) {
        const genCheck = await checkGenerationLimit(user_id, 'text');
        if (!genCheck.allowed) {
            return res.status(403).json({
                status: 'limit_reached',
                message: genCheck.isPro
                    ? 'คุณใช้สิทธิ์สร้างข้อความครบ 80 ครั้งในเดือนนี้แล้ว'
                    : 'คุณใช้สิทธิ์สร้างข้อความฟรีครบ 20 ครั้งแล้ว กรุณาอัปเกรดเป็น PRO',
                ...genCheck
            });
        }
    }

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

        if (user_id) await trackGeneration(user_id, 'brand_dna', project_id, 'text');
        logGeminiUsage({ userId: user_id, projectId: project_id, endpoint: '/api/generate-brand-dna', usageType: 'text', modelName: 'gemini-2.5-flash', feature: 'brand_dna', promptSent: prompt, responseSummary: cleanedText?.substring(0, 500) });

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
            try { dna.design_suggestions = JSON.parse(dna.design_suggestions); } catch (e) { }
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
        logGeminiUsage({ userId: null, projectId: projectId, endpoint: '/api/recommend-assets', usageType: 'text', modelName: 'gemini-2.5-flash', feature: 'recommend_assets', promptSent: prompt, responseSummary: cleanedText?.substring(0, 500) });
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
            try { dna.design_suggestions = JSON.parse(dna.design_suggestions); } catch (e) { }
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

    if (user_id) {
        const genCheck = await checkGenerationLimit(user_id, 'text');
        if (!genCheck.allowed) {
            return res.status(403).json({
                status: 'limit_reached',
                message: genCheck.isPro
                    ? 'คุณใช้สิทธิ์สร้างข้อความครบ 80 ครั้งในเดือนนี้แล้ว'
                    : 'คุณใช้สิทธิ์สร้างข้อความฟรีครบ 20 ครั้งแล้ว กรุณาอัปเกรดเป็น PRO',
                ...genCheck
            });
        }
    }

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
        - กลุ่มเป้าหมาย: ${finalTarget, target}
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
        if (user_id) await trackGeneration(user_id, 'brand_names', project_id, 'text');
        logGeminiUsage({ userId: user_id || null, projectId: project_id, endpoint: '/api/generate-brand-names', usageType: 'text', modelName: 'gemini-2.5-flash', feature: 'brand_names', promptSent: prompt, responseSummary: cleanedText?.substring(0, 500) });
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
        const [rows] = await connection.query("SELECT brand_name FROM name_concept WHERE concept_id = ?", [concept_id]);
        const selectedName = rows[0]?.brand_name || '';
        await connection.query("UPDATE project SET name_concept_id = ?, brand_name = ? WHERE project_id = ?", [concept_id, selectedName, project_id]);
        connection.release();
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

app.put('/api/projects/:projectId/brand-name', async (req, res) => {
    const { brand_name } = req.body;
    const projectId = req.params.projectId;
    if (!brand_name || !brand_name.trim()) return res.status(400).json({ status: 'error', message: 'กรุณาระบุชื่อแบรนด์' });
    try {
        const connection = await pool.getConnection();
        await connection.query("UPDATE project SET brand_name = ? WHERE project_id = ?", [brand_name.trim(), projectId]);
        connection.release();
        res.json({ status: 'success', brand_name: brand_name.trim() });
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
                [color_code_1 || '', color_code_2 || '', color_code_3 || '', color_code_4 || '', color_code_5 || '', color_id]
            );
        } else {
            const [result] = await connection.query(
                'INSERT INTO color (name_palette, color_code_1, color_code_2, color_code_3, color_code_4, color_code_5) VALUES (?,?,?,?,?,?)',
                [name_palette, color_code_1 || '', color_code_2 || '', color_code_3 || '', color_code_4 || '', color_code_5 || '']
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
                    [p.color_code_1 || '', p.color_code_2 || '', p.color_code_3 || '', p.color_code_4 || '', p.color_code_5 || '', color_id]);
            } else {
                const [result] = await connection.query(
                    'INSERT INTO color (name_palette, color_code_1, color_code_2, color_code_3, color_code_4, color_code_5) VALUES (?,?,?,?,?,?)',
                    [p.name_palette, p.color_code_1 || '', p.color_code_2 || '', p.color_code_3 || '', p.color_code_4 || '', p.color_code_5 || '']);
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

/// create logo (SSE streaming + retry)
app.get('/api/generate-logo', async (req, res) => {
    const { project_id, user_id, brand_name, brand_value, products, styles, details, negative_prompt, use_imported_color, use_imported_font, target_audience } = req.query;
    if (!project_id) return res.status(400).json({ status: 'error', message: 'Project ID is required' });
    const finalUserId = (!user_id || Number(user_id) === 0) ? null : Number(user_id);

    if (finalUserId) {
        const genCheck = await checkGenerationLimit(finalUserId);
        if (!genCheck.allowed) {
            return res.status(403).json({
                status: 'limit_reached',
                message: genCheck.isPro
                    ? 'คุณใช้สิทธิ์สร้างรูปภาพครบ 50 ครั้งในเดือนนี้แล้ว'
                    : 'คุณใช้สิทธิ์สร้างรูปภาพฟรีครบ 6 ครั้งแล้ว กรุณาอัปเกรดเป็น PRO',
                ...genCheck
            });
        }
    }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
    });
    const sendEvent = (event, data) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
        sendEvent('progress', { step: 'preparing', message: 'กำลังเตรียมข้อมูลแบรนด์...' });

        const connection = await pool.getConnection();
        let colorText = "";
        let fontText = "";
        if (use_imported_color === 'true' || use_imported_color === true) {
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
        if (use_imported_font === 'true' || use_imported_font === true) {
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

        sendEvent('progress', { step: 'prompt', message: 'กำลังสร้าง prompt สำหรับ AI...' });

        const selectedStyle = styles;

        let styleDirective = "";
        let typographyDirective = `The logo MUST clearly display the exact text: "${brand_name}". Understand the exact structure, anatomy, and spelling of the word "${brand_name}" and render the characters perfectly.`;
        let specificNegative = "";

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

        sendEvent('progress', { step: 'generating', message: 'AI กำลังวาดโลโก้ให้คุณ... อาจใช้เวลา 10-30 วินาที' });

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel(
            { model: "gemini-3.1-flash-image-preview", generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } },
            { timeout: 300000 }
        );

        let base64Data = "";
        let attempts = 0;
        const maxAttempts = 2;

        while (attempts < maxAttempts) {
            attempts++;
            try {
                const result = await model.generateContent(prompt);
                const parts = result.response.candidates?.[0]?.content?.parts;
                if (parts) {
                    for (const part of parts) {
                        if (part.inlineData && part.inlineData.data) {
                            base64Data = part.inlineData.data;
                            break;
                        }
                    }
                }
                if (base64Data) break;
                if (attempts < maxAttempts) {
                    sendEvent('progress', { step: 'retrying', message: 'AI ไม่ส่งรูปกลับมา กำลังลองใหม่...' });
                    await new Promise(r => setTimeout(r, 3000));
                }
            } catch (genErr) {
                console.error(`Logo generation attempt ${attempts} failed:`, genErr.message);
                if (attempts < maxAttempts) {
                    sendEvent('progress', { step: 'retrying', message: 'เกิดข้อผิดพลาด กำลังลองใหม่อีกครั้ง...' });
                    await new Promise(r => setTimeout(r, 3000));
                } else {
                    throw genErr;
                }
            }
        }

        if (!base64Data) {
            throw new Error("ระบบ AI ไม่ส่งรูปภาพกลับมา");
        }

        sendEvent('progress', { step: 'saving', message: 'เกือบเสร็จแล้ว! กำลังบันทึกรูปภาพ...' });

        const fileName = `logo_${Date.now()}.png`;
        const filePath = path.join(process.cwd(), 'uploads', 'generated', fileName);
        fs.writeFileSync(filePath, base64Data, 'base64');
        const imageUrl = `/uploads/generated/${fileName}`;

        const conn2 = await pool.getConnection();
        await conn2.query(
            "INSERT INTO generated_history (project_id, user_id, generation_type, image_url, prompt, is_selected, model_name) VALUES (?, ?, ?, ?, ?, 0, ?)",
            [project_id, finalUserId, 'LOGO', imageUrl, prompt, 'gemini-2.5-flash']
        );
        conn2.release();

        if (finalUserId) await trackGeneration(finalUserId, 'logo', project_id);
        logGeminiUsage({ userId: finalUserId, projectId: project_id, endpoint: '/api/generate-logo', usageType: 'image', modelName: 'gemini-2.5-flash', feature: 'logo', promptSent: prompt?.substring(0, 10000), responseSummary: imageUrl });

        sendEvent('done', { status: 'success', image_url: imageUrl });
        res.end();
    } catch (err) {
        console.error("Generate Logo Error:", err);
        sendEvent('error', { status: 'error', message: 'เกิดข้อผิดพลาดในการสร้างโลโก้: ' + (err.message || 'Unknown error') });
        res.end();
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

// ================= API PACKAGES (public list + third-party create) =================
// GET /api/packages — รายการ package ทั้งหมดที่ active (admin + โรงพิมพ์)
// คืนรูปแบบเดียวกับ PACKAGES array เดิมใน Frontend + ข้อมูลผู้โพสต์ (poster)
app.get('/api/packages', async (req, res) => {
    const { thirdparty_id } = req.query;
    try {
        const connection = await pool.getConnection();

        let where = 'WHERE p.is_active = 1';
        const params = [];
        if (thirdparty_id) { where += ' AND p.thirdparty_id = ?'; params.push(thirdparty_id); }

        const [pkgs] = await connection.query(
            `SELECT p.id, p.name, p.type, p.categories, p.thumbnail, p.thirdparty_id,
                    tp.third_party_name AS poster_name, tp.image_profile AS poster_image
             FROM packages p
             LEFT JOIN third_party tp ON p.thirdparty_id = tp.third_party_id
             ${where}
             ORDER BY p.created_at DESC`, params
        );

        if (pkgs.length === 0) { connection.release(); return res.json({ status: 'success', data: [] }); }

        const pkgIds = pkgs.map(p => p.id);
        const [materials] = await connection.query(
            `SELECT id, package_id, name, detail, package_type, sort_order,
                    dieline_width_mm, dieline_height_mm, panels_json, bleed_mm, safe_zone_mm
             FROM package_materials WHERE package_id IN (?) ORDER BY sort_order ASC`, [pkgIds]
        );
        const matIds = materials.map(m => m.id);
        let sizes = [], images = [];
        if (matIds.length > 0) {
            [sizes] = await connection.query(
                `SELECT material_id, size_label FROM package_material_sizes WHERE material_id IN (?) ORDER BY sort_order ASC`, [matIds]
            );
            [images] = await connection.query(
                `SELECT material_id, image_path FROM package_material_images WHERE material_id IN (?) ORDER BY sort_order ASC`, [matIds]
            );
        }
        connection.release();

        const data = pkgs.map(p => {
            const mats = materials.filter(m => m.package_id === p.id).map(m => ({
                name: m.name,
                detail: m.detail,
                package_type: m.package_type,
                images: images.filter(i => i.material_id === m.id).map(i => i.image_path),
                sizes: sizes.filter(s => s.material_id === m.id).map(s => s.size_label),
            }));
            let cats = [];
            try { cats = typeof p.categories === 'string' ? JSON.parse(p.categories) : (p.categories || []); } catch (e) { cats = []; }
            return {
                id: p.id,
                name: p.name,
                type: p.type,
                categories: cats,
                thumbnail: p.thumbnail,
                thirdparty_id: p.thirdparty_id,
                poster: p.thirdparty_id ? {
                    third_party_id: p.thirdparty_id,
                    third_party_name: p.poster_name,
                    image_profile: p.poster_image,
                } : null,
                materials: mats,
            };
        });
        res.json({ status: 'success', data });
    } catch (err) {
        console.error('Packages list error:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// POST /api/packages — โรงพิมพ์เพิ่ม package เอง (feature 3)
// multipart: thumbnail (1 ไฟล์) + images[] (รูป material) + fields (JSON บางส่วน)
app.post('/api/packages', upload.fields([{ name: 'thumbnail', maxCount: 1 }, { name: 'images', maxCount: 12 }]), async (req, res) => {
    const { thirdparty_id, name, type } = req.body;
    if (!thirdparty_id || !name || !type) {
        return res.status(400).json({ status: 'error', message: 'กรุณากรอก ชื่อ, ประเภท และต้องเป็นบัญชีโรงพิมพ์' });
    }

    // parse JSON fields
    const parseJSON = (v, fb) => { try { return v ? JSON.parse(v) : fb; } catch (e) { return fb; } };
    const categories = parseJSON(req.body.categories, []);
    const sizes = parseJSON(req.body.sizes, []);          // array ของ label เช่น ["50g","100g"]
    const material_name = req.body.material_name || name;
    const material_detail = req.body.material_detail || '';
    const package_type = req.body.package_type || 'flat';
    const dieline_width_mm = req.body.dieline_width_mm || null;
    const dieline_height_mm = req.body.dieline_height_mm || null;

    // panels_json: ถ้าโรงพิมพ์ไม่ได้ส่งมา และมีขนาด ให้สร้าง panel เริ่มต้น 1 ช่อง
    // เพื่อให้ใช้กับ Label Editor ได้ (feature: โพสต์แบบเต็ม)
    let panels_json = req.body.panels_json || null;
    if (!panels_json && dieline_width_mm && dieline_height_mm) {
        panels_json = JSON.stringify([
            { id: 'front', label: 'ด้านหน้า', x_mm: 0, y_mm: 0,
              w_mm: Number(dieline_width_mm), h_mm: Number(dieline_height_mm), is_label_target: true }
        ]);
    }

    const thumbFile = req.files?.thumbnail?.[0];
    const imageFiles = req.files?.images || [];
    const thumbPath = thumbFile ? `/uploads/${thumbFile.filename}` : '';
    const imagePaths = imageFiles.map(f => `/uploads/${f.filename}`);
    // ใช้รูปแรกเป็น thumbnail ถ้าไม่ได้อัปโหลด thumbnail แยก
    const finalThumb = thumbPath || imagePaths[0] || '';

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [pkgResult] = await connection.query(
            `INSERT INTO packages (name, type, categories, thumbnail, thirdparty_id, is_active)
             VALUES (?, ?, ?, ?, ?, 1)`,
            [name, type, JSON.stringify(categories), finalThumb, thirdparty_id]
        );
        const packageId = pkgResult.insertId;

        const [matResult] = await connection.query(
            `INSERT INTO package_materials
                (package_id, name, detail, sort_order, package_type, dieline_width_mm, dieline_height_mm, panels_json)
             VALUES (?, ?, ?, 0, ?, ?, ?, ?)`,
            [packageId, material_name, material_detail, package_type, dieline_width_mm, dieline_height_mm, panels_json]
        );
        const materialId = matResult.insertId;

        for (let j = 0; j < sizes.length; j++) {
            const label = typeof sizes[j] === 'string' ? sizes[j] : sizes[j].size_label;
            if (label) {
                await connection.query(
                    `INSERT INTO package_material_sizes (material_id, size_label, sort_order) VALUES (?, ?, ?)`,
                    [materialId, label, j]
                );
            }
        }
        for (let k = 0; k < imagePaths.length; k++) {
            await connection.query(
                `INSERT INTO package_material_images (material_id, image_path, sort_order) VALUES (?, ?, ?)`,
                [materialId, imagePaths[k], k]
            );
        }

        await connection.commit();
        connection.release();
        res.json({ status: 'success', message: 'เพิ่ม package สำเร็จ', packageId });
    } catch (err) {
        try { await connection.rollback(); } catch (e) {}
        connection.release();
        console.error('Create Package (third-party) error:', err);
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
        res.json({
            status: 'success',
            gemini: geminiStats,
            image: imageStats,
            dalle: imageStats
        });
    } catch (err) {
        console.error("API Stats Error:", err);
        res.status(500).json({ status: 'error' });
    }
});

// ================= ADMIN DASHBOARD - Extended Endpoints =================

// จำนวนผู้ใช้ที่ active (มี activity ใน 30 นาทีล่าสุด)
app.get('/api/admin/users/active', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        let rows;
        try {
            [rows] = await connection.query(`
                SELECT COUNT(*) as activeUsers
                FROM user_profile
                WHERE last_active_at >= DATE_SUB(NOW(), INTERVAL 30 MINUTE)
            `);
        } catch (colErr) {
            // fallback ถ้ายังไม่มีคอลัมน์ last_active_at
            [rows] = await connection.query(`
                SELECT COUNT(DISTINCT user_id) as activeUsers
                FROM api_logs
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 MINUTE)
            `);
        }
        connection.release();
        res.json({ status: 'success', active: rows[0].activeUsers });
    } catch (err) {
        console.error("Active Users Error:", err);
        res.status(500).json({ status: 'error' });
    }
});

// จำนวนผู้ใช้ PRO
app.get('/api/admin/users/pro-count', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.query(
            "SELECT COUNT(*) as proUsers FROM user_profile WHERE subscription_status = 'PRO'"
        );
        connection.release();
        res.json({ status: 'success', proUsers: rows[0].proUsers });
    } catch (err) {
        console.error("Pro Count Error:", err);
        res.status(500).json({ status: 'error' });
    }
});

// Token usage รวม (จาก api_logs)
app.get('/api/admin/stats/token-usage', async (req, res) => {
    const days = parseInt(req.query.days) || 7;
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.query(`
            SELECT DATE(created_at) as date, COUNT(*) as count
            FROM api_logs
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            GROUP BY DATE(created_at) ORDER BY date ASC
        `, [days]);
        const [totalRow] = await connection.query(`
            SELECT COUNT(*) as total FROM api_logs
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        `, [days]);
        connection.release();
        res.json({ status: 'success', data: rows, total: totalRow[0].total });
    } catch (err) {
        console.error("Token Usage Error:", err);
        res.status(500).json({ status: 'error' });
    }
});

// Text generation rate (generation_usage ที่เป็นข้อความ)
app.get('/api/admin/stats/text-generation', async (req, res) => {
    const days = parseInt(req.query.days) || 7;
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.query(`
            SELECT DATE(created_at) as date, COUNT(*) as count
            FROM generation_usage
            WHERE feature NOT LIKE '%image%' AND feature NOT LIKE '%dalle%' AND feature NOT LIKE '%logo%'
              AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            GROUP BY DATE(created_at) ORDER BY date ASC
        `, [days]);
        connection.release();
        res.json({ status: 'success', data: rows });
    } catch (err) {
        console.error("Text Gen Error:", err);
        res.status(500).json({ status: 'error' });
    }
});

// Image generation rate แยกตาม model/feature
app.get('/api/admin/stats/image-generation', async (req, res) => {
    const days = parseInt(req.query.days) || 7;
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.query(`
            SELECT DATE(created_at) as date, feature, COUNT(*) as count
            FROM generation_usage
            WHERE (feature LIKE '%image%' OR feature LIKE '%dalle%' OR feature LIKE '%logo%')
              AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            GROUP BY DATE(created_at), feature ORDER BY date ASC
        `, [days]);
        connection.release();
        const features = [...new Set(rows.map(r => r.feature))];
        const byDate = {};
        rows.forEach(r => {
            const d = r.date;
            if (!byDate[d]) byDate[d] = { date: d };
            byDate[d][r.feature] = r.count;
        });
        res.json({ status: 'success', data: Object.values(byDate), features });
    } catch (err) {
        console.error("Image Gen Error:", err);
        res.status(500).json({ status: 'error' });
    }
});

// User analytics (สำหรับ User Dashboard tab)
app.get('/api/admin/users/analytics', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [regTrend] = await connection.query(`
            SELECT DATE_FORMAT(MIN(created_at), '%Y-%m') as month, COUNT(*) as count
            FROM (SELECT user_id, MIN(created_at) as created_at FROM api_logs GROUP BY user_id) as first_activity
            GROUP BY DATE_FORMAT(created_at, '%Y-%m') ORDER BY month ASC LIMIT 12
        `);
        const [subBreakdown] = await connection.query(`
            SELECT subscription_status as status, COUNT(*) as count
            FROM user_profile GROUP BY subscription_status
        `);
        const [topUsers] = await connection.query(`
            SELECT u.user_id, u.user_name, u.email, u.subscription_status, COUNT(g.id) as usage_count
            FROM user_profile u
            LEFT JOIN generation_usage g ON u.user_id = g.user_id
            GROUP BY u.user_id ORDER BY usage_count DESC LIMIT 10
        `);
        connection.release();
        res.json({ status: 'success', regTrend, subBreakdown, topUsers });
    } catch (err) {
        console.error("User Analytics Error:", err);
        res.status(500).json({ status: 'error' });
    }
});

// รายชื่อ user ทั้งหมด (paginated)
app.get('/api/admin/users', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const offset = (page - 1) * limit;
    try {
        const connection = await pool.getConnection();
        let where = '';
        const params = [];
        if (search) {
            where = "WHERE user_name LIKE ? OR email LIKE ?";
            params.push(`%${search}%`, `%${search}%`);
        }
        const [countRows] = await connection.query(`SELECT COUNT(*) as total FROM user_profile ${where}`, params);
        let rows;
        try {
            [rows] = await connection.query(
                `SELECT user_id, user_name, email, image_profile, subscription_status, google_id,
                        subscription_start_date, subscription_end_date,
                        image_used, text_used, quota_reset_at
                 FROM user_profile ${where} ORDER BY user_id DESC LIMIT ? OFFSET ?`,
                [...params, limit, offset]
            );
        } catch (colErr) {
            [rows] = await connection.query(
                `SELECT user_id, user_name, email, image_profile, subscription_status, google_id,
                        subscription_start_date, subscription_end_date
                 FROM user_profile ${where} ORDER BY user_id DESC LIMIT ? OFFSET ?`,
                [...params, limit, offset]
            );
        }
        connection.release();
        const limits = QUOTA_LIMITS;
        const data = rows.map(u => {
            const tier = (u.subscription_status === 'PRO' && (!u.subscription_end_date || new Date(u.subscription_end_date) > new Date())) ? 'PRO' : 'STANDARD';
            const tl = limits[tier];
            return {
                ...u,
                image_used: u.image_used || 0,
                text_used: u.text_used || 0,
                image_limit: tl.image,
                text_limit: tl.text,
                image_remaining: Math.max(0, tl.image - (u.image_used || 0)),
                text_remaining: Math.max(0, tl.text - (u.text_used || 0)),
                quota_period: tl.period,
            };
        });
        res.json({ status: 'success', data, total: countRows[0].total, page, limit });
    } catch (err) {
        console.error("Users List Error:", err);
        res.status(500).json({ status: 'error' });
    }
});

app.get('/api/admin/users/quota-summary', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        let rows;
        try {
            [rows] = await connection.query(`
                SELECT user_id, user_name, email, subscription_status,
                       subscription_end_date, image_used, text_used, quota_reset_at
                FROM user_profile ORDER BY (image_used + text_used) DESC
            `);
        } catch (colErr) {
            [rows] = await connection.query(`
                SELECT user_id, user_name, email, subscription_status, subscription_end_date
                FROM user_profile ORDER BY user_id DESC
            `);
        }
        connection.release();
        const limits = QUOTA_LIMITS;
        const data = rows.map(u => {
            const isPro = u.subscription_status === 'PRO' && (!u.subscription_end_date || new Date(u.subscription_end_date) > new Date());
            const tier = isPro ? 'PRO' : 'STANDARD';
            const tl = limits[tier];
            return {
                ...u,
                image_used: u.image_used || 0,
                text_used: u.text_used || 0,
                tier,
                image_limit: tl.image,
                text_limit: tl.text,
                image_remaining: Math.max(0, tl.image - (u.image_used || 0)),
                text_remaining: Math.max(0, tl.text - (u.text_used || 0)),
                quota_period: tl.period,
            };
        });
        res.json({ status: 'success', data });
    } catch (err) {
        console.error("Quota Summary Error:", err);
        res.status(500).json({ status: 'error' });
    }
});

// API calls by action_type
app.get('/api/admin/stats/api-calls', async (req, res) => {
    const days = parseInt(req.query.days) || 7;
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.query(`
            SELECT action_type, COUNT(*) as count
            FROM api_logs
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            GROUP BY action_type ORDER BY count DESC
        `, [days]);
        connection.release();
        res.json({ status: 'success', data: rows });
    } catch (err) {
        console.error("API Calls Error:", err);
        res.status(500).json({ status: 'error' });
    }
});

// Credit consumption trend
app.get('/api/admin/stats/credit-consumption', async (req, res) => {
    const days = parseInt(req.query.days) || 7;
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.query(`
            SELECT DATE(created_at) as date, action_type, COUNT(*) as count
            FROM credit_transaction
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            GROUP BY DATE(created_at), action_type ORDER BY date ASC
        `, [days]);
        connection.release();
        res.json({ status: 'success', data: rows });
    } catch (err) {
        console.error("Credit Consumption Error:", err);
        res.status(500).json({ status: 'error' });
    }
});

// Top consumers (users ที่ใช้ API มากที่สุด)
app.get('/api/admin/stats/top-consumers', async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.query(`
            SELECT u.user_id, u.user_name, u.email, u.subscription_status, COUNT(a.log_id) as api_calls
            FROM user_profile u
            LEFT JOIN api_logs a ON u.user_id = a.user_id
            GROUP BY u.user_id ORDER BY api_calls DESC LIMIT ?
        `, [limit]);
        connection.release();
        res.json({ status: 'success', data: rows });
    } catch (err) {
        console.error("Top Consumers Error:", err);
        res.status(500).json({ status: 'error' });
    }
});

// Feature usage breakdown
app.get('/api/admin/stats/feature-usage', async (req, res) => {
    const days = parseInt(req.query.days) || 7;
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.query(`
            SELECT feature, COUNT(*) as count
            FROM generation_usage
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            GROUP BY feature ORDER BY count DESC
        `, [days]);
        connection.release();
        res.json({ status: 'success', data: rows });
    } catch (err) {
        console.error("Feature Usage Error:", err);
        res.status(500).json({ status: 'error' });
    }
});

// ==================== Gemini Usage Logs ====================
// UNION query ดึงข้อมูลจาก 3 ตาราง: gemini_usage_logs, generated_history, generated_text_history

const GEMINI_UNION_VIEW = `(
    SELECT 'gemini_log' as source, user_id, endpoint, usage_type, model_name, feature, prompt_sent, response_summary, status, created_at
    FROM gemini_usage_logs
    UNION ALL
    SELECT 'gen_history' as source, user_id, generation_type as endpoint, 'image' as usage_type,
           COALESCE(model_name, 'gemini (unknown)') as model_name, generation_type as feature,
           prompt as prompt_sent, image_url as response_summary, 'success' as status, created_at
    FROM generated_history WHERE generation_type != 'LABEL_BG_UPLOAD'
    UNION ALL
    SELECT 'gen_text' as source, NULL as user_id, generation_type as endpoint, 'text' as usage_type,
           COALESCE(model_name, 'gemini (unknown)') as model_name, generation_type as feature,
           prompt as prompt_sent, text_result as response_summary, 'success' as status, created_at
    FROM generated_text_history
) combined`;

// Gemini usage timeline (by day, split by usage_type)
app.get('/api/admin/gemini/usage-timeline', async (req, res) => {
    const days = parseInt(req.query.days) || 7;
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.query(`
            SELECT DATE(created_at) as date, usage_type, COUNT(*) as count
            FROM ${GEMINI_UNION_VIEW}
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            GROUP BY DATE(created_at), usage_type ORDER BY date ASC
        `, [days]);
        connection.release();
        const grouped = {};
        rows.forEach(r => {
            const d = r.date;
            if (!grouped[d]) grouped[d] = { date: d, text: 0, image: 0 };
            grouped[d][r.usage_type] = r.count;
        });
        res.json({ status: 'success', data: Object.values(grouped) });
    } catch (err) {
        console.error("Gemini Timeline Error:", err);
        res.status(500).json({ status: 'error' });
    }
});

// Gemini usage by model
app.get('/api/admin/gemini/by-model', async (req, res) => {
    const days = parseInt(req.query.days) || 30;
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.query(`
            SELECT model_name, usage_type, COUNT(*) as count
            FROM ${GEMINI_UNION_VIEW}
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            GROUP BY model_name, usage_type ORDER BY count DESC
        `, [days]);
        connection.release();
        res.json({ status: 'success', data: rows });
    } catch (err) {
        console.error("Gemini By Model Error:", err);
        res.status(500).json({ status: 'error' });
    }
});

// Gemini usage by feature
app.get('/api/admin/gemini/by-feature', async (req, res) => {
    const days = parseInt(req.query.days) || 30;
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.query(`
            SELECT feature, usage_type, COUNT(*) as count
            FROM ${GEMINI_UNION_VIEW}
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            GROUP BY feature, usage_type ORDER BY count DESC
        `, [days]);
        connection.release();
        res.json({ status: 'success', data: rows });
    } catch (err) {
        console.error("Gemini By Feature Error:", err);
        res.status(500).json({ status: 'error' });
    }
});

// Gemini recent logs (paginated)
app.get('/api/admin/gemini/recent-logs', async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.query(`
            SELECT combined.user_id, u.user_name, combined.endpoint, combined.usage_type, combined.model_name,
                   combined.feature, combined.prompt_sent, combined.response_summary, combined.status, combined.created_at, combined.source
            FROM ${GEMINI_UNION_VIEW}
            LEFT JOIN user_profile u ON combined.user_id = u.user_id
            ORDER BY combined.created_at DESC LIMIT ? OFFSET ?
        `, [limit, offset]);
        const [countRow] = await connection.query(`SELECT COUNT(*) as total FROM ${GEMINI_UNION_VIEW}`);
        connection.release();
        res.json({ status: 'success', data: rows, total: countRow[0].total });
    } catch (err) {
        console.error("Gemini Recent Logs Error:", err);
        res.status(500).json({ status: 'error' });
    }
});

// Gemini summary stats
app.get('/api/admin/gemini/summary', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [total] = await connection.query(`SELECT COUNT(*) as count FROM ${GEMINI_UNION_VIEW}`);
        const [today] = await connection.query(`SELECT COUNT(*) as count FROM ${GEMINI_UNION_VIEW} WHERE DATE(created_at) = CURDATE()`);
        const [byType] = await connection.query(`SELECT usage_type, COUNT(*) as count FROM ${GEMINI_UNION_VIEW} GROUP BY usage_type`);
        const [failed] = await connection.query(`SELECT COUNT(*) as count FROM ${GEMINI_UNION_VIEW} WHERE status = 'failed'`);
        connection.release();
        const typeMap = {};
        byType.forEach(r => { typeMap[r.usage_type] = r.count; });
        res.json({
            status: 'success',
            data: {
                total: total[0].count,
                today: today[0].count,
                text: typeMap.text || 0,
                image: typeMap.image || 0,
                failed: failed[0].count
            }
        });
    } catch (err) {
        console.error("Gemini Summary Error:", err);
        res.status(500).json({ status: 'error' });
    }
});

// Subscription signups over time
app.get('/api/admin/subscriptions/signups', async (req, res) => {
    const days = parseInt(req.query.days) || 30;
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.query(`
            SELECT DATE(created_at) as date, COUNT(*) as count
            FROM subscription_history
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            GROUP BY DATE(created_at) ORDER BY date ASC
        `, [days]);
        connection.release();
        res.json({ status: 'success', data: rows });
    } catch (err) {
        console.error("Signups Error:", err);
        res.status(500).json({ status: 'error' });
    }
});

// Revenue
app.get('/api/admin/subscriptions/revenue', async (req, res) => {
    const days = parseInt(req.query.days) || 30;
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.query(`
            SELECT DATE(created_at) as date, SUM(amount) as revenue, COUNT(*) as transactions
            FROM subscription_history
            WHERE status = 'successful' AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            GROUP BY DATE(created_at) ORDER BY date ASC
        `, [days]);
        const [totalRow] = await connection.query(`
            SELECT COALESCE(SUM(amount), 0) as totalRevenue
            FROM subscription_history
            WHERE status = 'successful' AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        `, [days]);
        connection.release();
        res.json({ status: 'success', data: rows, totalRevenue: totalRow[0].totalRevenue });
    } catch (err) {
        console.error("Revenue Error:", err);
        res.status(500).json({ status: 'error' });
    }
});

// Payment logs (paginated)
app.get('/api/admin/payments', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status || '';
    const search = req.query.search || '';
    const offset = (page - 1) * limit;
    try {
        const connection = await pool.getConnection();
        let where = [];
        const params = [];
        if (status) { where.push("p.status = ?"); params.push(status); }
        if (search) { where.push("(u.user_name LIKE ? OR u.email LIKE ?)"); params.push(`%${search}%`, `%${search}%`); }
        const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const [countRows] = await connection.query(
            `SELECT COUNT(*) as total FROM payment_logs p LEFT JOIN user_profile u ON p.user_id = u.user_id ${whereClause}`, params
        );
        const [rows] = await connection.query(
            `SELECT p.*, u.user_name, u.email
             FROM payment_logs p LEFT JOIN user_profile u ON p.user_id = u.user_id
             ${whereClause} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );
        connection.release();
        res.json({ status: 'success', data: rows, total: countRows[0].total, page, limit });
    } catch (err) {
        console.error("Payments Error:", err);
        res.status(500).json({ status: 'error' });
    }
});

// Omise webhook logs (paginated)
app.get('/api/admin/webhooks', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    try {
        const connection = await pool.getConnection();
        const [countRows] = await connection.query("SELECT COUNT(*) as total FROM omise_webhook_logs");
        const [rows] = await connection.query(
            "SELECT * FROM omise_webhook_logs ORDER BY created_at DESC LIMIT ? OFFSET ?",
            [limit, offset]
        );
        connection.release();
        res.json({ status: 'success', data: rows, total: countRows[0].total, page, limit });
    } catch (err) {
        console.error("Webhooks Error:", err);
        res.status(500).json({ status: 'error' });
    }
});

// Notifications - ส่งแจ้งเตือน
app.post('/api/admin/notifications', async (req, res) => {
    const { title, message, channel, target } = req.body;
    const adminId = req.headers['x-admin-id'];
    if (!title || !message) return res.status(400).json({ status: 'error', message: 'กรุณากรอก title และ message' });
    try {
        const connection = await pool.getConnection();
        // นับ + ดึง user_id ที่จะส่ง
        let userWhere = '';
        if (target === 'pro') userWhere = "WHERE subscription_status = 'PRO'";
        else if (target === 'standard') userWhere = "WHERE subscription_status = 'STANDARD'";
        const [targetUsers] = await connection.query(`SELECT user_id FROM user_profile ${userWhere}`);
        // บันทึก admin_notifications
        const [result] = await connection.query(
            `INSERT INTO admin_notifications (admin_id, title, message, channel, target, status, sent_count, sent_at)
             VALUES (?, ?, ?, ?, ?, 'sent', ?, NOW())`,
            [adminId || null, title, message, channel || 'web', target || 'all', targetUsers.length]
        );
        const notifId = result.insertId;
        // Insert notification สำหรับแต่ละ user
        if (targetUsers.length > 0) {
            const values = targetUsers.map(u => [u.user_id, notifId, title, message]);
            await connection.query(
                `INSERT INTO user_notifications (user_id, notification_id, title, message) VALUES ?`,
                [values]
            );
        }
        connection.release();
        res.json({ status: 'success', message: 'ส่งแจ้งเตือนสำเร็จ', notificationId: notifId, sentTo: targetUsers.length });
    } catch (err) {
        console.error("Notification Error:", err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Notifications - ดูประวัติ
app.get('/api/admin/notifications', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    try {
        const connection = await pool.getConnection();
        // ตรวจว่าตารางมีอยู่ไหม
        await connection.query(`
            CREATE TABLE IF NOT EXISTS admin_notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                admin_id INT,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                channel ENUM('web','email','both') DEFAULT 'web',
                target ENUM('all','pro','standard') DEFAULT 'all',
                status ENUM('draft','sent','failed') DEFAULT 'draft',
                sent_count INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                sent_at TIMESTAMP NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        const [countRows] = await connection.query("SELECT COUNT(*) as total FROM admin_notifications");
        const [rows] = await connection.query(
            "SELECT * FROM admin_notifications ORDER BY created_at DESC LIMIT ? OFFSET ?",
            [limit, offset]
        );
        connection.release();
        res.json({ status: 'success', data: rows, total: countRows[0].total, page, limit });
    } catch (err) {
        console.error("Get Notifications Error:", err);
        res.status(500).json({ status: 'error' });
    }
});

// Package Management - รายการ packages
app.get('/api/admin/packages', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const offset = (page - 1) * limit;
    try {
        const connection = await pool.getConnection();
        let where = '';
        const params = [];
        if (search) { where = "WHERE p.name LIKE ? OR p.type LIKE ?"; params.push(`%${search}%`, `%${search}%`); }
        const [countRows] = await connection.query(`SELECT COUNT(*) as total FROM packages p ${where}`, params);
        const [rows] = await connection.query(`
            SELECT p.*, COUNT(pm.id) as material_count
            FROM packages p
            LEFT JOIN package_materials pm ON p.id = pm.package_id
            ${where}
            GROUP BY p.id
            ORDER BY p.created_at DESC LIMIT ? OFFSET ?
        `, [...params, limit, offset]);
        connection.release();
        res.json({ status: 'success', data: rows, total: countRows[0].total, page, limit });
    } catch (err) {
        console.error("Packages List Error:", err);
        res.status(500).json({ status: 'error' });
    }
});

// Package - ดึงรายละเอียด
app.get('/api/admin/packages/:id', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [pkg] = await connection.query("SELECT * FROM packages WHERE id = ?", [req.params.id]);
        if (!pkg.length) { connection.release(); return res.status(404).json({ status: 'error', message: 'ไม่พบ package' }); }
        const [materials] = await connection.query(
            "SELECT * FROM package_materials WHERE package_id = ? ORDER BY sort_order", [req.params.id]
        );
        for (const mat of materials) {
            const [sizes] = await connection.query(
                "SELECT * FROM package_material_sizes WHERE material_id = ? ORDER BY sort_order", [mat.id]
            );
            mat.sizes = sizes;
        }
        connection.release();
        res.json({ status: 'success', data: { ...pkg[0], materials } });
    } catch (err) {
        console.error("Package Detail Error:", err);
        res.status(500).json({ status: 'error' });
    }
});

// Package - สร้างใหม่
app.post('/api/admin/packages', async (req, res) => {
    const { name, type, categories, thumbnail, is_active, materials } = req.body;
    const adminId = req.headers['x-admin-id'];
    if (!name || !type) return res.status(400).json({ status: 'error', message: 'กรุณากรอก name และ type' });
    try {
        const connection = await pool.getConnection();
        const [result] = await connection.query(
            `INSERT INTO packages (name, type, categories, thumbnail, admin_id, is_active)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [name, type, JSON.stringify(categories || []), thumbnail || '', adminId || null, is_active !== undefined ? is_active : 1]
        );
        const packageId = result.insertId;
        if (materials && Array.isArray(materials)) {
            for (let i = 0; i < materials.length; i++) {
                const mat = materials[i];
                const [matResult] = await connection.query(
                    `INSERT INTO package_materials (package_id, name, detail, sort_order, package_type)
                     VALUES (?, ?, ?, ?, ?)`,
                    [packageId, mat.name, mat.detail || '', mat.sort_order || i, mat.package_type || 'flat']
                );
                if (mat.sizes && Array.isArray(mat.sizes)) {
                    for (let j = 0; j < mat.sizes.length; j++) {
                        await connection.query(
                            `INSERT INTO package_material_sizes (material_id, size_label, sort_order) VALUES (?, ?, ?)`,
                            [matResult.insertId, mat.sizes[j].size_label, mat.sizes[j].sort_order || j]
                        );
                    }
                }
            }
        }
        connection.release();
        res.json({ status: 'success', message: 'สร้าง package สำเร็จ', packageId });
    } catch (err) {
        console.error("Create Package Error:", err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Package - อัพเดท
app.put('/api/admin/packages/:id', async (req, res) => {
    const { name, type, categories, thumbnail, is_active, materials } = req.body;
    try {
        const connection = await pool.getConnection();
        await connection.query(
            `UPDATE packages SET name=?, type=?, categories=?, thumbnail=?, is_active=?, updated_at=NOW() WHERE id=?`,
            [name, type, JSON.stringify(categories || []), thumbnail || '', is_active !== undefined ? is_active : 1, req.params.id]
        );
        if (materials && Array.isArray(materials)) {
            await connection.query("DELETE FROM package_materials WHERE package_id = ?", [req.params.id]);
            for (let i = 0; i < materials.length; i++) {
                const mat = materials[i];
                const [matResult] = await connection.query(
                    `INSERT INTO package_materials (package_id, name, detail, sort_order, package_type)
                     VALUES (?, ?, ?, ?, ?)`,
                    [req.params.id, mat.name, mat.detail || '', mat.sort_order || i, mat.package_type || 'flat']
                );
                if (mat.sizes && Array.isArray(mat.sizes)) {
                    for (let j = 0; j < mat.sizes.length; j++) {
                        await connection.query(
                            `INSERT INTO package_material_sizes (material_id, size_label, sort_order) VALUES (?, ?, ?)`,
                            [matResult.insertId, mat.sizes[j].size_label, mat.sizes[j].sort_order || j]
                        );
                    }
                }
            }
        }
        connection.release();
        res.json({ status: 'success', message: 'อัพเดท package สำเร็จ' });
    } catch (err) {
        console.error("Update Package Error:", err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Package - ลบ (soft delete)
app.delete('/api/admin/packages/:id', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        await connection.query("UPDATE packages SET is_active = 0 WHERE id = ?", [req.params.id]);
        connection.release();
        res.json({ status: 'success', message: 'ลบ package สำเร็จ' });
    } catch (err) {
        console.error("Delete Package Error:", err);
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
        logGeminiUsage({ userId: null, projectId: null, endpoint: '/api/generate-label-content', usageType: 'text', modelName: 'gemini-1.5-flash-8b', feature: 'label_content', promptSent: prompt, responseSummary: cleanedText?.substring(0, 500) });
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

    const finalUserId2 = (!user_id || user_id === 0) ? null : user_id;
    if (finalUserId2) {
        const genCheck = await checkGenerationLimit(finalUserId2);
        if (!genCheck.allowed) {
            return res.status(403).json({
                status: 'limit_reached',
                message: genCheck.isPro
                    ? 'คุณใช้สิทธิ์สร้างรูปภาพครบ 50 ครั้งในเดือนนี้แล้ว'
                    : 'คุณใช้สิทธิ์สร้างรูปภาพฟรีครบ 6 ครั้งแล้ว กรุณาอัปเกรดเป็น PRO',
                ...genCheck
            });
        }
    }

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
                `INSERT INTO generated_history (project_id, user_id, generation_type, image_url, prompt, is_selected, model_name) VALUES (?, ?, ?, ?, ?, 0, ?)`,
                [project_id, finalUserId, 'LABEL_BG', imageUrl, prompt, 'gemini-2.5-flash-image']
            );
            logConn.release();
            if (finalUserId) await trackGeneration(finalUserId, 'label_bg', project_id);
        } catch (logErr) {
            console.warn("Log warning (label-bg):", logErr.message);
        }
        logGeminiUsage({ userId: user_id || null, projectId: project_id, endpoint: '/api/generate-label-background', usageType: 'image', modelName: 'gemini-2.5-flash-image', feature: 'label_bg', promptSent: prompt?.substring(0, 10000), responseSummary: imageUrl });

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
        } catch (e) { }
        try {
            if (row.elem_positions && typeof row.elem_positions === 'string') row.elem_positions = JSON.parse(row.elem_positions);
        } catch (e) { }
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
        bg_mode, bg_color, bg_preset_id, bg_image_url, bg_opacity,
        elem_positions, label_mode, panel_id,
        label_image_base64
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

        const elemPosJson = elem_positions ? JSON.stringify(elem_positions) : null;

        // บันทึกรูป label snapshot ถ้ามี base64 ส่งมา
        let finalLabelUrl = null;
        if (label_image_base64) {
            const base64Clean = label_image_base64.replace(/^data:image\/\w+;base64,/, '');
            const fileName = `label_snap_${product_id}.png`;
            const filePath = path.join(process.cwd(), 'uploads', 'generated', fileName);
            fs.writeFileSync(filePath, base64Clean, 'base64');
            finalLabelUrl = `/uploads/generated/${fileName}`;
        }

        const fields = [
            project_id, product_name, tagline || null, net_weight || null,
            ingredients || null, usage_instruction || null, storage_instruction || null, warnings || null,
            manufacturerJson, fda_number || null, formattedMfgDate, formattedExpDate, lot_number || null,
            certificationsJson, qr_code_value || null, barcode_value || null,
            show_qr ? 1 : 0, show_barcode ? 1 : 0,
            layout_type || 'centered_classic', label_width || 380, label_height || 500, colorsJson,
            bg_mode || 'solid', bg_color || '#FFFFFF', bg_preset_id || null, bg_image_url || null,
            (bg_opacity !== undefined && bg_opacity !== null) ? bg_opacity : 1.00,
            elemPosJson, label_mode || 'sticker', panel_id || null, finalLabelUrl
        ];

        if (existing.length > 0) {
            await connection.query(
                `UPDATE label_design SET
                    project_id=?, product_name=?, tagline=?, net_weight=?,
                    ingredients=?, usage_instruction=?, storage_instruction=?, warnings=?,
                    manufacturer_info=?, fda_number=?, mfg_date=?, exp_date=?, lot_number=?,
                    certifications=?, qr_code_value=?, barcode_value=?, show_qr=?, show_barcode=?,
                    layout_type=?, label_width=?, label_height=?, text_colors=?,
                    bg_mode=?, bg_color=?, bg_preset_id=?, bg_image_url=?, bg_opacity=?,
                    elem_positions=?, label_mode=?, panel_id=?, final_label_url=?
                 WHERE product_id=?`,
                [...fields, product_id]
            );
        } else {
            await connection.query(
                `INSERT INTO label_design (
                    project_id, product_name, tagline, net_weight, ingredients, usage_instruction, storage_instruction, warnings,
                    manufacturer_info, fda_number, mfg_date, exp_date, lot_number, certifications,
                    qr_code_value, barcode_value, show_qr, show_barcode, layout_type, label_width, label_height, text_colors,
                    bg_mode, bg_color, bg_preset_id, bg_image_url, bg_opacity,
                    elem_positions, label_mode, panel_id, final_label_url, product_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [...fields, product_id]
            );
        }

        await connection.query('UPDATE brand_product SET name_product = ? WHERE product_id = ?', [product_name, product_id]);

        connection.release();
        return res.json({ status: 'success', message: 'Auto-saved' });
    } catch (err) {
        console.error("Save Label Error:", err);
        res.status(500).json({ status: 'error', message: err.message || 'Database error' });
    }
});
// 6. ดึงประวัติรูปพื้นหลัง label ของ project
app.get('/api/label-bg-history/:projectId', async (req, res) => {
    const { projectId } = req.params;
    try {
        const conn = await pool.getConnection();
        const [rows] = await conn.query(
            `SELECT history_id, generation_type, image_url, prompt, created_at
             FROM generated_history
             WHERE project_id = ? AND generation_type IN ('LABEL_BG', 'LABEL_BG_UPLOAD')
             ORDER BY created_at DESC`,
            [projectId]
        );
        conn.release();
        res.json({ status: 'success', data: rows });
    } catch (err) {
        console.error("Label BG History Error:", err);
        res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

// 7. อัปโหลดรูปพื้นหลัง label (custom upload)
if (!fs.existsSync('./uploads/generated')) fs.mkdirSync('./uploads/generated', { recursive: true });
const labelBgStorage = multer.diskStorage({
    destination: 'uploads/generated/',
    filename: (req, file, cb) => cb(null, `labelbg_upload_${Date.now()}${path.extname(file.originalname)}`)
});
const labelBgUpload = multer({ storage: labelBgStorage });

app.post('/api/label-bg-upload', labelBgUpload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ status: 'error', message: 'No file uploaded' });
    const { project_id, user_id } = req.body;
    const imageUrl = `/uploads/generated/${req.file.filename}`;

    try {
        const conn = await pool.getConnection();
        await conn.query(
            `INSERT INTO generated_history (project_id, user_id, generation_type, image_url, prompt, is_selected)
             VALUES (?, ?, 'LABEL_BG_UPLOAD', ?, 'User uploaded', 0)`,
            [project_id || null, user_id || null, imageUrl]
        );
        conn.release();
        res.json({ status: 'success', data: { image_url: imageUrl } });
    } catch (err) {
        console.error("Label BG Upload Error:", err);
        res.json({ status: 'success', data: { image_url: imageUrl } });
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
                try { r.panels_json = JSON.parse(r.panels_json); } catch (e) { }
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
            try { r.panels_json = JSON.parse(r.panels_json); } catch (e) { }
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

    if (user_id) {
        const genCheck = await checkGenerationLimit(user_id);
        if (!genCheck.allowed) {
            return res.status(403).json({ status: 'limit_reached', message: genCheck.isPro ? 'คุณใช้สิทธิ์สร้างรูปภาพครบ 50 ครั้งในเดือนนี้แล้ว' : 'คุณใช้สิทธิ์สร้างรูปภาพฟรีครบ 6 ครั้งแล้ว กรุณาอัปเกรดเป็น PRO', ...genCheck });
        }
    }

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
            model: 'Gemini 2.5 Flash Preview Image', prompt, n: 1, size: '1024x1024', response_format: 'b64_json'
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
            `INSERT INTO generated_history (project_id, user_id, generation_type, image_url, prompt, is_selected, model_name) VALUES (?, ?, ?, ?, ?, 0, ?)`,
            [project_id, user_id || null, 'MOCKUP_PATTERN', imageUrl, prompt, 'gemini-2.5-flash-image']);
        c2.release();
        if (user_id) await trackGeneration(user_id, 'mockup_pattern', project_id);
        logGeminiUsage({ userId: user_id || null, projectId: project_id, endpoint: '/api/mockup/generate-pattern', usageType: 'image', modelName: 'gemini-2.5-flash-image', feature: 'mockup_pattern', promptSent: prompt?.substring(0, 10000), responseSummary: imageUrl });
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

// ----- 6b) POST generate AI die-line background (Package Design) -----
app.post('/api/mockup/generate-dieline-bg', async (req, res) => {
    const { project_id, user_id, user_prompt, dieline_width_mm, dieline_height_mm, panels_json, package_type, product_name } = req.body;
    if (!project_id || !user_prompt) return res.status(400).json({ status: 'error', message: 'project_id and user_prompt required' });

    if (user_id) {
        const genCheck = await checkGenerationLimit(user_id);
        if (!genCheck.allowed) {
            return res.status(403).json({ status: 'limit_reached', message: genCheck.isPro ? 'คุณใช้สิทธิ์สร้างรูปภาพครบ 50 ครั้งในเดือนนี้แล้ว' : 'คุณใช้สิทธิ์สร้างรูปภาพฟรีครบ 6 ครั้งแล้ว กรุณาอัปเกรดเป็น PRO', ...genCheck });
        }
    }

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

        const prompt = `Create a SEAMLESS REPEATING surface pattern for product packaging background.
Product: ${product_name || 'consumer product'}
Style: ${user_prompt}
Colors: ONLY use these hex colors: ${palette}
STRICT RULES:
- Create a FLAT, FULL-BLEED pattern that fills the ENTIRE image edge to edge
- The pattern must be seamless and tileable
- 2D flat illustration only, suitable for print
- NO text, NO numbers, NO letters, NO logos, NO mockup, NO box shape, NO die-line
- Do NOT draw any packaging shape, fold lines, or 3D object
- Just a beautiful decorative pattern that covers the whole image uniformly
- The image will be used as a texture/wallpaper to wrap around a package`;

        const response = await googleImagen.images.generate({
            model: 'gemini-2.5-flash-image', prompt, n: 1, size: '1024x1024', response_format: 'b64_json'
        });
        const fname = `dieline_bg_${Date.now()}.png`;
        fs.writeFileSync(path.join('uploads', fname), response.data[0].b64_json, 'base64');
        const imageUrl = `/uploads/${fname}`;

        const c2 = await pool.getConnection();
        await c2.query(
            `INSERT INTO api_logs (user_id, project_id, action_type, prompt_sent, ai_response) VALUES (?, ?, ?, ?, ?)`,
            [user_id || null, project_id, 'GENERATE_DIELINE_BG', prompt, imageUrl]);
        await c2.query(
            `INSERT INTO generated_history (project_id, user_id, generation_type, image_url, prompt, is_selected, model_name) VALUES (?, ?, ?, ?, ?, 0, ?)`,
            [project_id, user_id || null, 'DIELINE_BG', imageUrl, prompt, 'gemini-2.5-flash-image']);
        c2.release();
        if (user_id) await trackGeneration(user_id, 'dieline_bg', project_id);
        logGeminiUsage({ userId: user_id || null, projectId: project_id, endpoint: '/api/mockup/generate-dieline-bg', usageType: 'image', modelName: 'gemini-2.5-flash-image', feature: 'dieline_bg', promptSent: prompt?.substring(0, 10000), responseSummary: imageUrl });
        res.json({ status: 'success', data: { image_url: imageUrl } });
    } catch (err) {
        if (conn) conn.release();
        console.error('Dieline BG Gen Error:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ----- 6.5) GET dieline BG history -----
app.get('/api/mockup/dieline-bg-history/:projectId', async (req, res) => {
    const { projectId } = req.params;
    try {
        const conn = await pool.getConnection();
        const [rows] = await conn.query(
            `SELECT history_id, image_url, prompt, created_at
             FROM generated_history
             WHERE project_id = ? AND generation_type = 'DIELINE_BG'
             ORDER BY history_id DESC LIMIT 20`,
            [projectId]);
        conn.release();
        res.json({ status: 'success', data: rows });
    } catch (err) {
        console.error('Dieline BG History Error:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ----- 6c) POST generate AI package mockup preview (design → realistic photo) -----
app.post('/api/mockup/generate-package-mockup', async (req, res) => {
    const {
        project_id, user_id, product_id,
        package_image_url,
        panel_images,
        package_type, package_material, product_name,
        bg_style = 'white'
    } = req.body;

    if (!project_id || !panel_images?.length) {
        return res.status(400).json({ status: 'error', message: 'project_id and panel_images required' });
    }

    if (user_id) {
        const genCheck = await checkGenerationLimit(user_id);
        if (!genCheck.allowed) {
            return res.status(403).json({ status: 'limit_reached', message: genCheck.isPro ? 'คุณใช้สิทธิ์สร้างรูปภาพครบ 50 ครั้งในเดือนนี้แล้ว' : 'คุณใช้สิทธิ์สร้างรูปภาพฟรีครบ 6 ครั้งแล้ว กรุณาอัปเกรดเป็น PRO', ...genCheck });
        }
    }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
    });
    const sendEvent = (event, data) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
        sendEvent('progress', { step: 1, total: 4, message: 'กำลังเตรียมรูปภาพ...' });

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel(
            { model: 'gemini-3.1-flash-image-preview', generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } },
            { timeout: 300000 }
        );

        // Get brand name
        let conn = await pool.getConnection();
        const [nameRows] = await conn.query(
            `SELECT brand_name FROM project WHERE project_id = ? LIMIT 1`, [project_id]);
        const brandName = nameRows[0]?.brand_name || '';
        conn.release();

        const imageParts = [];
        let imgIdx = 1;

        // Image 1: Package photo (if available)
        if (package_image_url) {
            const possiblePaths = [
                path.join(process.cwd(), package_image_url.replace(/^\//, '')),
                path.join(process.cwd(), '..', 'punthai-frontend-user', 'public', package_image_url.replace(/^\//, ''))
            ];
            for (const pkgPath of possiblePaths) {
                if (fs.existsSync(pkgPath)) {
                    const buf = await sharp(pkgPath)
                        .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
                        .jpeg({ quality: 85 })
                        .toBuffer();
                    imageParts.push({ inlineData: { mimeType: 'image/jpeg', data: buf.toString('base64') } });
                    imgIdx++;
                    break;
                }
            }
        }
        const hasPackageImg = imgIdx > 1;

        // Each selected panel as separate image
        const panelDescs = [];
        for (const pi of panel_images) {
            const clean = pi.image_base64.replace(/^data:image\/\w+;base64,/, '');
            const buf = await sharp(Buffer.from(clean, 'base64'))
                .resize(1536, 1536, { fit: 'inside', withoutEnlargement: true })
                .png()
                .toBuffer();
            imageParts.push({ inlineData: { mimeType: 'image/png', data: buf.toString('base64') } });
            panelDescs.push(`- Image ${imgIdx}: "${pi.label}" panel design (${pi.w_mm}x${pi.h_mm}mm)`);
            imgIdx++;
        }

        sendEvent('progress', { step: 2, total: 4, message: 'กำลังส่งข้อมูลให้ AI...' });

        const bgStyleMap = {
            white: 'Pure clean white seamless studio background',
            wood: 'Natural warm-toned wood table surface as background',
            marble: 'Elegant white marble surface as background',
            nature: 'Fresh green leaves and natural botanical elements arranged around the product',
            linen: 'Soft neutral-toned linen fabric texture as background',
            concrete: 'Modern raw concrete / cement surface as background',
            gradient: 'Professional photography studio with soft gradient backdrop and rim lighting',
        };

        // Map Thai panel labels to English face names
        const mapFace = (label) => {
            const l = (label || '').toLowerCase();
            if (l.includes('หน้า')) return 'FRONT';
            if (l.includes('หลัง')) return 'BACK';
            if (l.includes('ซ้าย')) return 'LEFT SIDE';
            if (l.includes('ขวา')) return 'RIGHT SIDE';
            if (l.includes('บน')) return 'TOP';
            if (l.includes('ล่าง')) return 'BOTTOM';
            return label;
        };

        const panelPlacement = panel_images.map(pi => `- "${pi.label}" (Image) → ${mapFace(pi.label)} face (${pi.w_mm}mm × ${pi.h_mm}mm)`).join('\n');

        let prompt = '';
        if (hasPackageImg) {
            prompt = `You are a product packaging mockup photographer. Your job: take a real package photo and print custom artwork onto its surfaces.

IMAGES PROVIDED:
- Image 1: REFERENCE PHOTO of the actual product package — copy its EXACT shape, angle, proportions, and material
${panelDescs.join('\n')}

TASK:
Recreate the package from Image 1 with the artwork from the other images printed on it.
Use the SAME camera angle and perspective as Image 1.

WHICH FACE GETS WHICH DESIGN:
${panelPlacement}

ABSOLUTE REQUIREMENTS:
1. SHAPE & PROPORTIONS: The package must be IDENTICAL to Image 1 — same width-to-height ratio, same 3D angle, same camera perspective. Do NOT stretch, squeeze, or change the aspect ratio.
2. CAMERA ANGLE: Use the SAME viewing angle as Image 1. If Image 1 shows the package from front-left, your result must also show front-left. Do NOT mirror or flip the orientation.
3. DESIGN STAYS ON PACKAGE ONLY: The artwork must appear ONLY on the package surfaces. The background must be COMPLETELY CLEAN — no pattern, no design bleeding outside the package edges. The design is PRINTED on the package material, it does not extend beyond the package boundary.
4. FACE ORIENTATION: When looking at the front of the package, the LEFT SIDE panel is on the viewer's LEFT, the RIGHT SIDE panel is on the viewer's RIGHT. Do NOT swap left and right.
5. FAITHFUL REPRODUCTION: Copy ALL text, logos, images, patterns from each panel image exactly as shown. Do not add, remove, rearrange, or reinterpret any element.
6. CLEAN BACKGROUND: ${bgStyleMap[bg_style] || bgStyleMap.white}. The background must have ZERO design elements from the package artwork.

${brandName ? `Brand: "${brandName}"` : ''}
${product_name ? `Product: "${product_name}"` : ''}
Package: ${package_type || 'pouch/bag'}, material: ${package_material || 'paper/plastic'}

OUTPUT: Generate a SQUARE image (1:1 aspect ratio). The product should be centered with padding around it.
PHOTOGRAPHY: Professional studio product photo, soft lighting, natural shadow under product, sharp focus, no people/hands/props.`;
        } else {
            prompt = `You are a product packaging mockup photographer. Create a photorealistic 3D mockup of a ${package_type || 'product package'}.

IMAGES PROVIDED:
${panelDescs.join('\n')}

TASK:
Generate a realistic ${package_type || 'pouch/bag'} made of ${package_material || 'paper/plastic'} and print the provided artwork onto it.
Show from a front-left 3/4 angle so the FRONT and LEFT SIDE are visible.

WHICH FACE GETS WHICH DESIGN:
${panelPlacement}

ABSOLUTE REQUIREMENTS:
1. DESIGN STAYS ON PACKAGE ONLY: Artwork appears ONLY on package surfaces. Background must be completely clean — no pattern bleeding outside the package edges.
2. FACE ORIENTATION: LEFT SIDE panel is on the viewer's LEFT when looking at the front. Do NOT swap sides.
3. PROPORTIONS: The package should have realistic proportions for a ${package_type || 'food pouch'}.
4. FAITHFUL REPRODUCTION: Copy ALL text, logos, images, patterns exactly. Do not modify or rearrange.
5. CLEAN BACKGROUND: ${bgStyleMap[bg_style] || bgStyleMap.white}. Zero design elements from the package on the background.

${brandName ? `Brand: "${brandName}"` : ''}
${product_name ? `Product: "${product_name}"` : ''}

OUTPUT: Generate a SQUARE image (1:1 aspect ratio). The product should be centered with padding around it.
PHOTOGRAPHY: Professional studio photo, soft lighting, shadow under product, sharp focus, no people/hands.`;
        }

        sendEvent('progress', { step: 3, total: 4, message: 'AI กำลังสร้างภาพ Mockup...' });

        const contentParts = [...imageParts, { text: prompt }];
        let result;
        try {
            result = await model.generateContent(contentParts);
        } catch (firstErr) {
            console.warn('Package mockup attempt 1 failed, retrying in 5s...', firstErr.message);
            sendEvent('progress', { step: 3, total: 4, message: 'เซิร์ฟเวอร์ AI ยุ่ง กำลังลองใหม่...' });
            await new Promise(r => setTimeout(r, 5000));
            result = await model.generateContent(contentParts);
        }

        let base64Data = '';
        let mimeType = 'image/png';
        const parts = result.response.candidates?.[0]?.content?.parts;
        if (parts) {
            for (const part of parts) {
                if (part.inlineData?.data) {
                    base64Data = part.inlineData.data;
                    mimeType = part.inlineData.mimeType || 'image/png';
                    break;
                }
            }
        }

        if (!base64Data) throw new Error('AI ไม่ส่งรูปภาพกลับมา กรุณาลองใหม่');

        sendEvent('progress', { step: 4, total: 4, message: 'กำลังปรับขนาดและบันทึกภาพ...' });

        // Resize to exactly 1024x1024 for consistent output
        const rawBuf = Buffer.from(base64Data, 'base64');
        const resizedBuf = await sharp(rawBuf)
            .resize(1024, 1024, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
            .png({ quality: 95 })
            .toBuffer();

        const fileName = `package_mockup_${Date.now()}.png`;
        const dirPath = path.join(process.cwd(), 'uploads', 'generated');
        if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
        const filePath = path.join(dirPath, fileName);
        fs.writeFileSync(filePath, resizedBuf);
        const imageUrl = `/uploads/generated/${fileName}`;

        try {
            const finalUserId = (!user_id || user_id === 0) ? null : user_id;
            const c2 = await pool.getConnection();
            await c2.query(
                `INSERT INTO api_logs (user_id, project_id, action_type, prompt_sent, ai_response) VALUES (?, ?, ?, ?, ?)`,
                [finalUserId, project_id, 'GENERATE_PACKAGE_MOCKUP', prompt.substring(0, 2000), imageUrl]);
            await c2.query(
                `INSERT INTO generated_history (project_id, user_id, generation_type, image_url, prompt, is_selected, product_id, model_name) VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
                [project_id, finalUserId, 'PACKAGE_MOCKUP', imageUrl, prompt.substring(0, 2000), product_id || null, 'gemini-3.1-flash-image-preview']);
            c2.release();
            if (finalUserId) await trackGeneration(finalUserId, 'package_mockup', project_id);
        } catch (e) { console.warn('log warning', e.message); }
        logGeminiUsage({ userId: user_id || null, projectId: project_id, endpoint: '/api/mockup/generate-package-mockup', usageType: 'image', modelName: 'gemini-3.1-flash-image-preview', feature: 'package_mockup', promptSent: prompt?.substring(0, 10000), responseSummary: imageUrl });

        sendEvent('done', { status: 'success', image_url: imageUrl });
        res.end();
    } catch (err) {
        console.error('Package Mockup Error:', err);
        sendEvent('error', { message: err.message });
        res.end();
    }
});

// ----- 6d) GET package mockup history (by product_id) -----
app.get('/api/mockup/package-mockup-history/:projectId', async (req, res) => {
    const { projectId } = req.params;
    const { product_id } = req.query;
    try {
        const conn = await pool.getConnection();
        let query, params;
        if (product_id) {
            query = `SELECT history_id, image_url, prompt, created_at
                     FROM generated_history
                     WHERE project_id = ? AND generation_type = 'PACKAGE_MOCKUP' AND product_id = ?
                     ORDER BY history_id DESC LIMIT 20`;
            params = [projectId, product_id];
        } else {
            query = `SELECT history_id, image_url, prompt, created_at
                     FROM generated_history
                     WHERE project_id = ? AND generation_type = 'PACKAGE_MOCKUP'
                     ORDER BY history_id DESC LIMIT 20`;
            params = [projectId];
        }
        const [rows] = await conn.query(query, params);
        conn.release();
        res.json({ status: 'success', data: rows });
    } catch (err) {
        console.error('Package Mockup History Error:', err);
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
                try { p.elements_json = JSON.parse(p.elements_json); } catch (e) { }
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
        bleed_mm, resolution_dpi, panels = [],
        design_mode, ai_dieline_bg_url, ai_bg_prompt
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
                   bleed_mm=?, resolution_dpi=?, status='saved',
                   design_mode=COALESCE(?,design_mode), ai_dieline_bg_url=?, ai_bg_prompt=?
                 WHERE mockup_id=?`,
                [package_material_id, size_id || null, label_id || null,
                    bleed_mm || 3.0, resolution_dpi || 300,
                    design_mode || null, ai_dieline_bg_url || null, ai_bg_prompt || null,
                    mockupId]);
        } else {
            const [r] = await conn.query(
                `INSERT INTO mockup_design (project_id, product_id, package_material_id, size_id, label_id, bleed_mm, resolution_dpi, status, design_mode, ai_dieline_bg_url, ai_bg_prompt)
                 VALUES (?,?,?,?,?,?,?,'saved',?,?,?)`,
                [project_id, product_id || null, package_material_id, size_id || null, label_id || null,
                    bleed_mm || 3.0, resolution_dpi || 300,
                    design_mode || 'sticker', ai_dieline_bg_url || null, ai_bg_prompt || null]);
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
                    [p.bg_mode || 'solid', p.bg_color || '#FFFFFF', p.bg_pattern_id || null,
                    p.bg_image_url || null, p.bg_opacity || 1.00, elJson, exP[0].panel_id]);
            } else {
                await conn.query(
                    `INSERT INTO mockup_panel (mockup_id, panel_key, bg_mode, bg_color, bg_pattern_id, bg_image_url, bg_opacity, elements_json)
                     VALUES (?,?,?,?,?,?,?,?)`,
                    [mockupId, p.panel_key, p.bg_mode || 'solid', p.bg_color || '#FFFFFF',
                        p.bg_pattern_id || null, p.bg_image_url || null, p.bg_opacity || 1.00, elJson]);
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
    const { panel_images = [], spec_data = {}, format = 'pdf' } = req.body; // format: 'pdf' | 'ai'
    try {
        const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
        const pdfDoc = await PDFDocument.create();

        const conn = await pool.getConnection();
        const [mr] = await conn.query(
            `SELECT m.*, pm.dieline_width_mm, pm.dieline_height_mm, pm.bleed_mm AS mat_bleed,
                    pm.panels_json, pm.name AS material_name, pm.package_type
             FROM mockup_design m JOIN package_materials pm ON m.package_material_id = pm.id
             WHERE m.mockup_id = ?`, [mockupId]);
        if (mr.length === 0) { conn.release(); return res.status(404).json({ status: 'error', message: 'mockup not found' }); }
        const m = mr[0];
        const panels = m.panels_json ? JSON.parse(m.panels_json) : [];
        conn.release();

        const MM_TO_PT = 2.83465;
        const bleed = parseFloat(m.bleed_mm || m.mat_bleed) || 3.0;
        const widthMm = parseFloat(m.dieline_width_mm) + bleed * 2;
        const heightMm = parseFloat(m.dieline_height_mm) + bleed * 2;
        const pageW = widthMm * MM_TO_PT;
        const pageH = heightMm * MM_TO_PT;

        // ---- หน้า 1: die-line print-ready (CMYK) ----
        const page = pdfDoc.addPage([pageW, pageH]);
        page.drawRectangle({ x: 0, y: 0, width: pageW, height: pageH, color: rgb(1, 1, 1) });

        for (const panel of panels) {
            const imgEntry = panel_images.find(pi => pi.panel_key === panel.id);
            if (!imgEntry) continue;
            const b64 = imgEntry.image_data.replace(/^data:image\/\w+;base64,/, '');
            const pngBytes = Buffer.from(b64, 'base64');
            // Embed image (JPEG or PNG) — sRGB color preserved for proper CMYK conversion at print RIP
            let embedImg;
            const isJpeg = imgEntry.image_data.startsWith('data:image/jpeg');
            try {
                if (isJpeg) {
                    embedImg = await pdfDoc.embedJpg(pngBytes);
                } else {
                    // Convert PNG → JPEG for smaller PDF
                    const jpegBuf = await sharp(pngBytes).jpeg({ quality: 95 }).toBuffer();
                    embedImg = await pdfDoc.embedJpg(jpegBuf);
                }
            } catch (embedErr) {
                console.warn('Image embed fallback:', embedErr.message);
                try { embedImg = await pdfDoc.embedPng(pngBytes); } catch { continue; }
            }
            page.drawImage(embedImg, {
                x: (panel.x_mm + bleed) * MM_TO_PT,
                y: (heightMm - panel.y_mm - panel.h_mm - bleed) * MM_TO_PT,
                width: panel.w_mm * MM_TO_PT,
                height: panel.h_mm * MM_TO_PT
            });
        }

        // ---- crop marks 4 มุม ----
        const cropLen = 5 * MM_TO_PT;
        const cropOff = bleed * MM_TO_PT;
        const cropColor = rgb(0, 0, 0);
        const drawCrop = (x, y, dx, dy) => {
            page.drawLine({ start: { x, y }, end: { x: x + dx, y: y + dy }, thickness: 0.25, color: cropColor });
        };
        drawCrop(0, cropOff, cropLen, 0);
        drawCrop(cropOff, 0, 0, cropLen);
        drawCrop(pageW - cropLen, cropOff, cropLen, 0);
        drawCrop(pageW - cropOff, 0, 0, cropLen);
        drawCrop(0, pageH - cropOff, cropLen, 0);
        drawCrop(cropOff, pageH - cropLen, 0, cropLen);
        drawCrop(pageW - cropLen, pageH - cropOff, cropLen, 0);
        drawCrop(pageW - cropOff, pageH - cropLen, 0, cropLen);

        // ---- fold lines (เส้นประระหว่าง panel) ----
        for (let i = 0; i < panels.length; i++) {
            for (let j = i + 1; j < panels.length; j++) {
                const a = panels[i], b = panels[j];
                if (Math.abs((a.x_mm + a.w_mm) - b.x_mm) < 0.5 &&
                    Math.max(a.y_mm, b.y_mm) < Math.min(a.y_mm + a.h_mm, b.y_mm + b.h_mm)) {
                    const xMm = a.x_mm + a.w_mm + bleed;
                    const y1Mm = Math.max(a.y_mm, b.y_mm) + bleed;
                    const y2Mm = Math.min(a.y_mm + a.h_mm, b.y_mm + b.h_mm) + bleed;
                    page.drawLine({
                        start: { x: xMm * MM_TO_PT, y: (heightMm - y2Mm) * MM_TO_PT },
                        end: { x: xMm * MM_TO_PT, y: (heightMm - y1Mm) * MM_TO_PT },
                        thickness: 0.5, color: rgb(1, 0, 0), dashArray: [4, 3]
                    });
                }
                if (Math.abs((a.y_mm + a.h_mm) - b.y_mm) < 0.5 &&
                    Math.max(a.x_mm, b.x_mm) < Math.min(a.x_mm + a.w_mm, b.x_mm + b.w_mm)) {
                    const yMm = a.y_mm + a.h_mm + bleed;
                    const x1Mm = Math.max(a.x_mm, b.x_mm) + bleed;
                    const x2Mm = Math.min(a.x_mm + a.w_mm, b.x_mm + b.w_mm) + bleed;
                    page.drawLine({
                        start: { x: x1Mm * MM_TO_PT, y: (heightMm - yMm) * MM_TO_PT },
                        end: { x: x2Mm * MM_TO_PT, y: (heightMm - yMm) * MM_TO_PT },
                        thickness: 0.5, color: rgb(1, 0, 0), dashArray: [4, 3]
                    });
                }
            }
        }

        // ---- หน้า 2: spec sheet (A4) — only for PDF, not AI ----
        if (format !== 'ai') {
            const specPage = pdfDoc.addPage([595, 842]);
            const helv = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            const helvR = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const safeText = (str) => (str || '-').replace(/[^\x20-\x7E]/g, '').trim() || '(non-ASCII name)';
            let yy = 800;
            specPage.drawText('PRINT SPECIFICATION SHEET', { x: 50, y: yy, size: 18, font: helv }); yy -= 30;
            specPage.drawText(`Project: ${safeText(spec_data.project_name)}`, { x: 50, y: yy, size: 11, font: helvR }); yy -= 18;
            specPage.drawText(`Material: ${safeText(m.material_name)}`, { x: 50, y: yy, size: 11, font: helvR }); yy -= 18;
            specPage.drawText(`Package Type: ${safeText(m.package_type)}`, { x: 50, y: yy, size: 11, font: helvR }); yy -= 18;
            specPage.drawText(`Die-line size: ${m.dieline_width_mm} x ${m.dieline_height_mm} mm`, { x: 50, y: yy, size: 11, font: helvR }); yy -= 18;
            specPage.drawText(`Bleed: ${bleed} mm | Resolution: ${m.resolution_dpi} DPI`, { x: 50, y: yy, size: 11, font: helvR }); yy -= 25;
            specPage.drawText('PRINTING NOTES (for printer)', { x: 50, y: yy, size: 13, font: helv }); yy -= 20;
            const notes = [
                '1. Color space: sRGB - convert to CMYK with ICC profile before printing',
                '2. Crop marks at 4 corners - trim along marks',
                '3. Red dashed lines = fold lines (do not print, score only)',
                '4. Black solid lines/area = print artwork',
                `5. Die-line outer size with bleed: ${widthMm.toFixed(1)} x ${heightMm.toFixed(1)} mm`,
                '6. Recommended paper: 250-300 gsm coated for boxes',
                '7. Recommended finish: Matte or glossy lamination',
                '8. Embedded fonts: outlined as raster (no font issues)'
            ];
            notes.forEach(n => { specPage.drawText(safeText(n), { x: 50, y: yy, size: 10, font: helvR }); yy -= 16; });
            if (spec_data.colors_used && spec_data.colors_used.length > 0) {
                yy -= 10;
                specPage.drawText('COLORS USED', { x: 50, y: yy, size: 13, font: helv }); yy -= 18;
                spec_data.colors_used.forEach(hex => {
                    const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
                    specPage.drawRectangle({ x: 50, y: yy - 10, width: 18, height: 12, color: rgb(r, g, b) });
                    specPage.drawText(`${hex.toUpperCase()} -> CMYK approx (convert at printer)`, { x: 75, y: yy - 8, size: 10, font: helvR });
                    yy -= 18;
                });
            }
        }

        const pdfBytes = await pdfDoc.save();
        const ext = format === 'ai' ? 'ai' : 'pdf';
        const fname = `mockup_${mockupId}_${Date.now()}.${ext}`;
        const fpath = path.join('uploads', fname);
        fs.writeFileSync(fpath, pdfBytes);

        const c2 = await pool.getConnection();
        await c2.query(`UPDATE mockup_design SET print_pdf_url=?, status='exported' WHERE mockup_id=?`, [`/uploads/${fname}`, mockupId]);
        c2.release();

        // Send file directly as download
        const mimeType = format === 'ai' ? 'application/illustrator' : 'application/pdf';
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
        res.send(pdfBytes);
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
                        dieline_width_mm, dieline_height_mm, panels_json
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
// ===== POST: AI สร้างภาพ mockup — SSE streaming + compressed images + retry =====
app.post('/api/mockup/generate-ai-image', async (req, res) => {
    const {
        project_id, user_id,
        label_image_url, package_image_url,
        package_name, package_material, package_type, product_name,
        bg_style = 'white',
        label_width_px, label_height_px,
        dieline_width_mm, dieline_height_mm
    } = req.body;

    if (!project_id) return res.status(400).json({ status: 'error', message: 'project_id required' });

    if (user_id) {
        const genCheck = await checkGenerationLimit(user_id);
        if (!genCheck.allowed) {
            return res.status(403).json({ status: 'limit_reached', message: genCheck.isPro ? 'คุณใช้สิทธิ์สร้างรูปภาพครบ 50 ครั้งในเดือนนี้แล้ว' : 'คุณใช้สิทธิ์สร้างรูปภาพฟรีครบ 6 ครั้งแล้ว กรุณาอัปเกรดเป็น PRO', ...genCheck });
        }
    }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
    });
    const sendEvent = (event, data) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
        sendEvent('progress', { step: 1, total: 4, message: 'กำลังเตรียมรูปภาพ...' });

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel(
            { model: 'gemini-3.1-flash-image-preview', generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } },
            { timeout: 300000 }
        );

        let conn = await pool.getConnection();
        const [nameRows] = await conn.query(
            `SELECT brand_name FROM project WHERE project_id = ? LIMIT 1`, [project_id]);
        const brandName = nameRows[0]?.brand_name || '';
        conn.release();

        const imageParts = [];

        // Image 1: บีบอัด package เป็น JPEG 1024px
        if (package_image_url) {
            const possiblePaths = [
                path.join(process.cwd(), package_image_url.replace(/^\//, '')),
                path.join(process.cwd(), '..', 'punthai-frontend-user', 'public', package_image_url.replace(/^\//, ''))
            ];
            for (const pkgPath of possiblePaths) {
                if (fs.existsSync(pkgPath)) {
                    const buf = await sharp(pkgPath)
                        .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
                        .jpeg({ quality: 80 })
                        .toBuffer();
                    imageParts.push({ inlineData: { mimeType: 'image/jpeg', data: buf.toString('base64') } });
                    break;
                }
            }
        }

        // Image 2: บีบอัด label เป็น PNG 2048px (คงคุณภาพสูง)
        if (label_image_url) {
            const lblPath = path.join(process.cwd(), label_image_url.replace(/^\//, ''));
            if (fs.existsSync(lblPath)) {
                const buf = await sharp(lblPath)
                    .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
                    .png()
                    .toBuffer();
                imageParts.push({ inlineData: { mimeType: 'image/png', data: buf.toString('base64') } });
            }
        }

        if (imageParts.length === 0) {
            sendEvent('error', { message: 'ไม่พบรูปภาพฉลากหรือบรรจุภัณฑ์' });
            return res.end();
        }

        sendEvent('progress', { step: 2, total: 4, message: 'กำลังส่งข้อมูลให้ AI...' });

        const EDITOR_DPI = 96;
        const labelW_mm = label_width_px ? Math.round((label_width_px / EDITOR_DPI) * 25.4) : null;
        const labelH_mm = label_height_px ? Math.round((label_height_px / EDITOR_DPI) * 25.4) : null;
        const pkgW_mm = dieline_width_mm || null;
        const pkgH_mm = dieline_height_mm || null;

        let coverageInfo = '';
        if (labelW_mm && pkgW_mm) {
            const widthRatio = Math.round((labelW_mm / pkgW_mm) * 100);
            const heightRatio = labelH_mm && pkgH_mm ? Math.round((labelH_mm / pkgH_mm) * 100) : null;
            coverageInfo = `
REAL-WORLD SCALE (very important):
- Package dimensions: ${pkgW_mm}mm wide × ${pkgH_mm}mm tall
- Label sticker dimensions: ${labelW_mm}mm wide × ${labelH_mm}mm tall
- The label covers approximately ${widthRatio}% of the package width${heightRatio ? ` and ${heightRatio}% of the package height` : ''}
- You MUST respect this proportion — the label is NOT full-size, it is a sticker that covers only part of the package front face
`;
        }

        const bgStyleMap = {
            white: 'Pure clean white seamless studio background',
            wood: 'Natural warm-toned wood table surface as background',
            marble: 'Elegant white marble surface as background',
            nature: 'Fresh green leaves and natural botanical elements arranged around the product',
            linen: 'Soft neutral-toned linen fabric texture as background',
            concrete: 'Modern raw concrete / cement surface as background',
            gradient: 'Professional photography studio with soft gradient backdrop and rim lighting',
        };

        const hasPackageImg = imageParts.length >= 1 && !!package_image_url;
        const hasLabelImg = !!label_image_url;

        let prompt = '';

        if (hasPackageImg && hasLabelImg) {
            prompt = `You are a product packaging mockup artist. Your job is to simulate applying a printed label sticker onto a real product package.

IMAGE REFERENCES:
- Image 1: The ACTUAL product packaging photo — this is the base image
- Image 2: The label sticker design that needs to be applied onto the packaging

YOUR TASK — STICKER APPLICATION SIMULATION:
Take Image 1 (the packaging photo) as your base. Imagine you are physically holding the label from Image 2 as a printed sticker, and you are carefully applying/sticking it onto the front surface of the packaging.

The output image must look like: "Here is the same package from Image 1, but now with the label sticker from Image 2 physically applied onto its front surface."

CRITICAL RULES:
1. The packaging from Image 1 must remain VISUALLY IDENTICAL — same shape, same material appearance, same angle, same proportions. Do NOT redesign or reimagine the packaging.
2. The label from Image 2 must appear as a PHYSICAL STICKER adhered to the packaging surface:
   - It should follow the surface contour of the packaging (slight curve if the package is a pouch/bag, cylindrical wrap if it's a bottle)
   - Show subtle sticker edges — a very faint shadow or slight highlight at the label border showing it's a sticker on a surface
   - The label surface should match the packaging material feel (matte sticker on matte package, glossy on glossy)
3. Reproduce ALL text, logos, barcodes, QR codes, decorative elements from the label EXACTLY as shown. Do not invent, remove, or rearrange any element.
4. The label should be placed CENTERED on the front face of the package, positioned where a product label would naturally go.
${coverageInfo}
PACKAGING CONTEXT:
- Package type: ${package_type || package_name || 'food pouch/bag'}
- Material: ${package_material || 'plastic/foil'}
${brandName ? `- Brand: "${brandName}"` : ''}
${product_name ? `- Product: "${product_name}"` : ''}

BACKGROUND: ${bgStyleMap[bg_style] || bgStyleMap.white}

PHOTOGRAPHY STYLE:
- Professional studio product photography
- Soft diffused lighting, natural shadows beneath product
- Single product, front-facing hero shot (same angle as Image 1)
- Sharp focus, commercial e-commerce quality
- NO people, NO hands, NO extra props

ABSOLUTELY DO NOT:
- Create a completely new or reimagined package design
- Merge/blend the two images like a collage
- Show the label floating or as a flat overlay
- Change the packaging shape, color, or material from Image 1
- Add text or design elements not present in Image 2
- Make the label cover the entire package — respect the sticker size ratio`;
        } else if (hasLabelImg) {
            prompt = `You are a product mockup artist. Create a photorealistic product packaging photo showing this label design applied as a sticker on a ${package_type || package_name || 'food pouch/bag'} made of ${package_material || 'plastic'}.

IMAGE REFERENCE:
- Image 1: The label sticker design to apply on packaging

TASK: Generate a realistic ${package_type || 'food package'} and show this label applied as a physical sticker on its front surface.
${coverageInfo}
${brandName ? `Brand: "${brandName}"` : ''}
${product_name ? `Product: "${product_name}"` : ''}

The label must be reproduced EXACTLY — all text, logos, barcodes, colors, decorative elements.
Place the sticker centered on the front face of the package.
Professional studio photography, white background, soft lighting, no people/hands.`;
        } else if (hasPackageImg) {
            prompt = `Create a professional product mockup photo of this packaging.
${brandName ? `Brand: "${brandName}"` : ''}
${product_name ? `Product: "${product_name}"` : ''}
Professional studio photography, white background, soft lighting, no people/hands.`;
        }

        sendEvent('progress', { step: 3, total: 4, message: 'AI กำลังสร้างภาพ Mockup...' });

        // เรียก Gemini พร้อม retry 1 ครั้งเมื่อเจอ 503/fetch failed
        const contentParts = [...imageParts, { text: prompt }];
        let result;
        try {
            result = await model.generateContent(contentParts);
        } catch (firstErr) {
            console.warn('Gemini attempt 1 failed, retrying in 5s...', firstErr.message);
            sendEvent('progress', { step: 3, total: 4, message: 'เซิร์ฟเวอร์ AI ยุ่ง กำลังลองใหม่...' });
            await new Promise(r => setTimeout(r, 5000));
            result = await model.generateContent(contentParts);
        }

        let base64Data = '';
        let mimeType = 'image/png';
        const parts = result.response.candidates?.[0]?.content?.parts;
        if (parts) {
            for (const part of parts) {
                if (part.inlineData?.data) {
                    base64Data = part.inlineData.data;
                    mimeType = part.inlineData.mimeType || 'image/png';
                    break;
                }
            }
        }

        if (!base64Data) throw new Error('AI ไม่ส่งรูปภาพกลับมา กรุณาลองใหม่');

        sendEvent('progress', { step: 4, total: 4, message: 'กำลังบันทึกภาพ...' });

        const ext = mimeType.includes('jpeg') ? 'jpg' : 'png';
        const fileName = `mockup_ai_${Date.now()}.${ext}`;
        const filePath = path.join(process.cwd(), 'uploads', 'generated', fileName);
        fs.writeFileSync(filePath, base64Data, 'base64');
        const imageUrl = `/uploads/generated/${fileName}`;

        try {
            const finalUserId = (!user_id || user_id === 0) ? null : user_id;
            const c2 = await pool.getConnection();
            await c2.query(
                `INSERT INTO api_logs (user_id, project_id, action_type, prompt_sent, ai_response) VALUES (?, ?, ?, ?, ?)`,
                [finalUserId, project_id, 'GENERATE_MOCKUP_AI', prompt.substring(0, 2000), imageUrl]);
            await c2.query(
                `INSERT INTO generated_history (project_id, user_id, generation_type, image_url, prompt, is_selected, model_name) VALUES (?, ?, ?, ?, ?, 0, ?)`,
                [project_id, finalUserId, 'MOCKUP_AI', imageUrl, prompt.substring(0, 2000), 'gemini-3.1-flash-image-preview']);
            c2.release();
            if (finalUserId) await trackGeneration(finalUserId, 'mockup_ai', project_id);
        } catch (e) { console.warn('log warning', e.message); }
        logGeminiUsage({ userId: user_id || null, projectId: project_id, endpoint: '/api/mockup/generate-ai-image', usageType: 'image', modelName: 'gemini-3.1-flash-image-preview', feature: 'mockup_ai', promptSent: prompt?.substring(0, 2000), responseSummary: imageUrl });

        sendEvent('done', { status: 'success', image_url: imageUrl });
        res.end();
    } catch (err) {
        console.error('AI Mockup Error:', err);
        sendEvent('error', { message: err.message });
        res.end();
    }
});
// =====================================================================
// POST /api/labels/export-pdf — สร้าง PDF ฉลากพร้อมพิมพ์
// =====================================================================
app.post('/api/labels/export-pdf', async (req, res) => {
    const {
        product_id, project_id, label_image,
        label_width_cm, label_height_cm, bleed_mm = 3,
        product_name, colors_used = []
    } = req.body;

    if (!label_image) {
        return res.status(400).json({ status: 'error', message: 'ไม่มีภาพฉลาก' });
    }

    try {
        const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
        const pdfDoc = await PDFDocument.create();

        const MM_TO_PT = 2.83465;
        const CM_TO_MM = 10;
        const labelWidthMm = parseFloat(label_width_cm) * CM_TO_MM;
        const labelHeightMm = parseFloat(label_height_cm) * CM_TO_MM;
        const bleed = parseFloat(bleed_mm) || 3;
        const totalWidthMm = labelWidthMm + bleed * 2;
        const totalHeightMm = labelHeightMm + bleed * 2;
        const pageW = totalWidthMm * MM_TO_PT;
        const pageH = totalHeightMm * MM_TO_PT;

        // ---- หน้า 1: ฉลาก print-ready ----
        const page = pdfDoc.addPage([pageW, pageH]);
        page.drawRectangle({ x: 0, y: 0, width: pageW, height: pageH, color: rgb(1, 1, 1) });

        // Embed label image
        const b64 = label_image.replace(/^data:image\/\w+;base64,/, '');
        const imgBytes = Buffer.from(b64, 'base64');
        let labelImg;
        try {
            labelImg = await pdfDoc.embedPng(imgBytes);
        } catch (e) {
            labelImg = await pdfDoc.embedJpg(imgBytes);
        }

        // วางฉลากตรงกลาง (offset ด้วย bleed)
        page.drawImage(labelImg, {
            x: bleed * MM_TO_PT,
            y: bleed * MM_TO_PT,
            width: labelWidthMm * MM_TO_PT,
            height: labelHeightMm * MM_TO_PT,
        });

        // ---- Crop marks 4 มุม ----
        const cropLen = 5 * MM_TO_PT;
        const cropOff = bleed * MM_TO_PT;
        const cropColor = rgb(0, 0, 0);
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

        // ---- หน้า 2: Spec Sheet (A4) ----
        const specPage = pdfDoc.addPage([595, 842]);
        const helv = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const helvR = await pdfDoc.embedFont(StandardFonts.Helvetica);
        let yy = 800;

        specPage.drawText('LABEL PRINT SPECIFICATION SHEET', { x: 50, y: yy, size: 18, font: helv });
        yy -= 30;
        // กรองเฉพาะตัวอักษรที่ Helvetica รองรับ (Latin/ASCII) เพื่อไม่ให้ crash
        const safeName = (product_name || '-').replace(/[^\x20-\x7E]/g, '');
        specPage.drawText(`Product: ${safeName || `(Product ID: ${product_id})`}`, { x: 50, y: yy, size: 11, font: helvR });
        yy -= 18;
        specPage.drawText(`Label Size: ${label_width_cm} x ${label_height_cm} cm (${labelWidthMm} x ${labelHeightMm} mm)`, { x: 50, y: yy, size: 11, font: helvR });
        yy -= 18;
        specPage.drawText(`Bleed: ${bleed} mm each side`, { x: 50, y: yy, size: 11, font: helvR });
        yy -= 18;
        specPage.drawText(`Total with bleed: ${totalWidthMm} x ${totalHeightMm} mm`, { x: 50, y: yy, size: 11, font: helvR });
        yy -= 30;

        specPage.drawText('PRINTING NOTES', { x: 50, y: yy, size: 13, font: helv });
        yy -= 20;
        const notes = [
            '1. Color space: sRGB (please convert to CMYK before printing)',
            '2. Crop marks at 4 corners - trim along marks',
            `3. Label area: ${labelWidthMm} x ${labelHeightMm} mm (inside crop marks)`,
            `4. Bleed area: ${bleed} mm on each side`,
            '5. Recommended paper: Art card 210-260 gsm',
            '6. Recommended finish: Matte or glossy lamination',
            '7. Content rendered as raster image (no font embedding issues)',
        ];
        notes.forEach(n => {
            specPage.drawText(n, { x: 50, y: yy, size: 10, font: helvR });
            yy -= 16;
        });

        // Colors used
        if (colors_used && colors_used.length > 0) {
            yy -= 15;
            specPage.drawText('COLORS USED', { x: 50, y: yy, size: 13, font: helv });
            yy -= 20;
            colors_used.forEach(hex => {
                if (!hex || hex.length < 7) return;
                const r = parseInt(hex.slice(1, 3), 16) / 255;
                const g = parseInt(hex.slice(3, 5), 16) / 255;
                const b = parseInt(hex.slice(5, 7), 16) / 255;
                specPage.drawRectangle({ x: 50, y: yy - 10, width: 18, height: 12, color: rgb(r, g, b) });
                specPage.drawText(`${hex.toUpperCase()} (convert to CMYK at printer)`, { x: 75, y: yy - 8, size: 10, font: helvR });
                yy -= 18;
            });
        }

        // ---- Thumbnail preview on spec page ----
        yy -= 25;
        specPage.drawText('LABEL PREVIEW', { x: 50, y: yy, size: 13, font: helv });
        yy -= 10;
        const previewMaxW = 200;
        const previewMaxH = 260;
        const aspect = labelWidthMm / labelHeightMm;
        let prevW, prevH;
        if (aspect > previewMaxW / previewMaxH) {
            prevW = previewMaxW;
            prevH = previewMaxW / aspect;
        } else {
            prevH = previewMaxH;
            prevW = previewMaxH * aspect;
        }
        if (yy - prevH > 40) {
            specPage.drawImage(labelImg, {
                x: 50,
                y: yy - prevH,
                width: prevW,
                height: prevH,
            });
        }

        // ---- Save PDF ----
        const pdfBytes = await pdfDoc.save();
        const fname = `label_${product_id || 'design'}_${Date.now()}.pdf`;
        const fpath = path.join('uploads', fname);
        fs.writeFileSync(fpath, pdfBytes);
        const url = `/uploads/${fname}`;

        res.json({ status: 'success', pdf_url: url });
    } catch (err) {
        console.error('Label Export PDF Error:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});
// =====================================================================
// GET /api/package/:packageId/materials — ดึง materials + panels ของ package
// =====================================================================
app.get('/api/package/:packageId/materials', async (req, res) => {
    try {
        const conn = await pool.getConnection();
        const [materials] = await conn.query(
            `SELECT id, package_id, name, detail, package_type,
                    dieline_width_mm, dieline_height_mm, panels_json,
                    bleed_mm, safe_zone_mm
             FROM package_materials
             WHERE package_id = ?
             ORDER BY sort_order ASC`, [req.params.packageId]
        );
        const materialIds = materials.map(m => m.id).filter(Boolean);
        let sizes = [];
        if (materialIds.length > 0) {
            const [sizeRows] = await conn.query(
                `SELECT id, material_id, size_label, sort_order
                 FROM package_material_sizes
                 WHERE material_id IN (?)
                 ORDER BY sort_order ASC`, [materialIds]
            );
            sizes = sizeRows;
        }
        conn.release();
        materials.forEach(m => {
            if (m.panels_json && typeof m.panels_json === 'string') {
                try { m.panels_json = JSON.parse(m.panels_json); } catch (e) { m.panels_json = []; }
            }
            m.sizes = sizes.filter(s => s.material_id === m.id);
        });
        res.json({ status: 'success', data: materials });
    } catch (err) {
        console.error('package materials error:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});
// ===== GET: ดึงประวัติ mockup ที่เคยสร้าง =====
app.get('/api/mockup/history/:projectId', async (req, res) => {
    const { projectId } = req.params;
    try {
        const conn = await pool.getConnection();
        const [rows] = await conn.query(
            `SELECT history_id, image_url, prompt, is_liked, is_selected, created_at
             FROM generated_history 
             WHERE project_id = ? AND generation_type = 'MOCKUP_AI'
             ORDER BY history_id DESC`,
            [projectId]
        );
        conn.release();
        res.json({ status: 'success', data: rows });
    } catch (err) {
        console.error('Mockup history error:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ===== DELETE: ลบ mockup ที่ไม่ต้องการ =====
app.delete('/api/mockup/history/:historyId', async (req, res) => {
    const { historyId } = req.params;
    try {
        const conn = await pool.getConnection();
        const [rows] = await conn.query(
            `SELECT image_url FROM generated_history WHERE history_id = ?`, [historyId]);
        if (rows.length > 0 && rows[0].image_url) {
            const filePath = path.join(process.cwd(), rows[0].image_url.replace(/^\//, ''));
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        await conn.query(`DELETE FROM generated_history WHERE history_id = ?`, [historyId]);
        conn.release();
        res.json({ status: 'success' });
    } catch (err) {
        console.error('Delete mockup error:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});


// ================= API Content Online =================

// 4.1 GET ad-templates
app.get('/api/ad-templates', async (req, res) => {
    try {
        const conn = await pool.getConnection();
        const [rows] = await conn.query('SELECT * FROM ad_template WHERE is_active = 1 ORDER BY sort_order ASC');
        conn.release();
        res.json({ status: 'success', templates: rows });
    } catch (err) {
        console.error('Get ad-templates error:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// 4.2 GET available images for a product (real + mockup)
app.get('/api/content-online/images/:projectId/:productId', async (req, res) => {
    const { projectId, productId } = req.params;
    try {
        const conn = await pool.getConnection();

        // รูปสินค้าจริงจาก brand_product
        const [products] = await conn.query(
            'SELECT product_id, name_product, image_product FROM brand_product WHERE product_id = ? AND project_id = ?',
            [productId, projectId]
        );
        const productImages = products
            .filter(p => p.image_product)
            .map(p => ({ type: 'product', url: `/uploads/${p.image_product}`, label: p.name_product }));

        // รูป mockup จาก generated_history
        const [mockups] = await conn.query(
            `SELECT history_id, image_url, generation_type, prompt, created_at
             FROM generated_history
             WHERE project_id = ? AND generation_type IN ('MOCKUP_AI','PACKAGE_MOCKUP')
               AND (product_id = ? OR product_id IS NULL)
             ORDER BY created_at DESC`,
            [projectId, productId]
        );
        const mockupImages = mockups.map(m => ({
            type: 'mockup',
            url: m.image_url,
            label: m.generation_type === 'PACKAGE_MOCKUP' ? 'Package Mockup' : 'AI Mockup',
            history_id: m.history_id,
            created_at: m.created_at
        }));

        conn.release();
        res.json({ status: 'success', product_images: productImages, mockup_images: mockupImages });
    } catch (err) {
        console.error('Content-online images error:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// 4.3 POST generate ad content (SSE) — supports mode: both | image_only | caption_only
app.post('/api/content-online/generate', async (req, res) => {
    const {
        project_id, product_id, user_id, template_id, platform,
        product_name, price, slogan, additional_details,
        source_image_url, source_image_type,
        mode = 'both', existing_image_url
    } = req.body;

    if (user_id && mode !== 'caption_only') {
        const genCheck = await checkGenerationLimit(user_id, 'image');
        if (!genCheck.allowed) {
            return res.status(403).json({
                status: 'limit_reached',
                message: genCheck.isPro
                    ? 'คุณใช้สิทธิ์สร้างรูปภาพครบ 50 ครั้งในเดือนนี้แล้ว'
                    : 'คุณใช้สิทธิ์สร้างรูปภาพฟรีครบ 6 ครั้งแล้ว กรุณาอัปเกรดเป็น PRO',
                ...genCheck
            });
        }
    }
    if (user_id && (mode === 'caption_only' || mode === 'both')) {
        const textCheck = await checkGenerationLimit(user_id, 'text');
        if (!textCheck.allowed) {
            return res.status(403).json({
                status: 'limit_reached',
                message: textCheck.isPro
                    ? 'คุณใช้สิทธิ์สร้างข้อความครบ 80 ครั้งในเดือนนี้แล้ว'
                    : 'คุณใช้สิทธิ์สร้างข้อความฟรีครบ 20 ครั้งแล้ว กรุณาอัปเกรดเป็น PRO',
                ...textCheck
            });
        }
    }

    // SSE headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
    });
    const sendEvent = (event, data) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
        const conn = await pool.getConnection();

        // Step 1: ดึง template
        sendEvent('progress', { step: 1, total: 5, message: 'กำลังเตรียม template...' });
        const [templates] = await conn.query('SELECT * FROM ad_template WHERE template_id = ?', [template_id]);
        if (templates.length === 0) {
            conn.release();
            sendEvent('error', { message: 'ไม่พบ template ที่เลือก' });
            return res.end();
        }
        const template = templates[0];

        // กำหนด aspect ratio ตาม platform
        const platformSizes = {
            'facebook': { w: 1200, h: 630, ratio: '1200x630 landscape (1.91:1)' },
            'ig_feed': { w: 1080, h: 1080, ratio: '1080x1080 square (1:1)' },
            'ig_story': { w: 1080, h: 1920, ratio: '1080x1920 vertical (9:16)' },
            'line': { w: 1040, h: 1040, ratio: '1040x1040 square (1:1)' },
            'tiktok': { w: 1080, h: 1920, ratio: '1080x1920 vertical (9:16)' }
        };
        const pSize = platformSizes[platform] || platformSizes['ig_feed'];

        // Interpolate prompt placeholders
        const sloganLine = slogan ? `Slogan: "${slogan}".` : '';
        const detailsLine = additional_details ? `Additional details: ${additional_details}.` : '';

        let finalImageUrl = existing_image_url || null;
        let finalCaptionTh = null;
        let finalCaptionEn = null;

        // Step 2: Generate Image (ถ้า mode ไม่ใช่ caption_only)
        if (mode === 'both' || mode === 'image_only') {
            sendEvent('progress', { step: 2, total: 5, message: 'AI กำลังสร้างภาพโฆษณา...' });

            const imagePrompt = template.image_prompt_template
                .replace(/\{product_name\}/g, product_name || '')
                .replace(/\{price\}/g, price || '')
                .replace(/\{slogan\}/g, slogan || '')
                .replace(/\{aspect_ratio\}/g, pSize.ratio);

            // Load source image
            let imageParts = [];
            if (source_image_url) {
                try {
                    let imgPath;
                    if (source_image_url.startsWith('/uploads/')) {
                        imgPath = path.join(process.cwd(), source_image_url);
                    } else {
                        imgPath = path.join(process.cwd(), 'uploads', source_image_url);
                    }

                    if (fs.existsSync(imgPath)) {
                        const imgBuffer = await sharp(imgPath)
                            .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
                            .jpeg({ quality: 85 })
                            .toBuffer();
                        imageParts.push({
                            inlineData: {
                                mimeType: 'image/jpeg',
                                data: imgBuffer.toString('base64')
                            }
                        });
                    }
                } catch (imgErr) {
                    console.warn('Could not load source image:', imgErr.message);
                }
            }

            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel(
                { model: 'gemini-3.1-flash-image-preview', generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } }
            );

            const contentParts = [...imageParts, { text: imagePrompt }];
            let result;
            try {
                result = await model.generateContent(contentParts);
            } catch (firstErr) {
                console.warn('Image gen attempt 1 failed, retrying...', firstErr.message);
                await new Promise(r => setTimeout(r, 5000));
                result = await model.generateContent(contentParts);
            }

            const parts = result.response.candidates?.[0]?.content?.parts;
            let imgBase64 = null;
            let mimeType = 'image/png';
            if (parts) {
                for (const p of parts) {
                    if (p.inlineData) {
                        imgBase64 = p.inlineData.data;
                        mimeType = p.inlineData.mimeType || 'image/png';
                        break;
                    }
                }
            }

            if (!imgBase64) {
                conn.release();
                sendEvent('error', { message: 'AI ไม่สามารถสร้างภาพได้ กรุณาลองใหม่' });
                return res.end();
            }

            const ext = mimeType.includes('jpeg') ? 'jpg' : 'png';
            const fileName = `content_ad_${Date.now()}.${ext}`;
            const filePath = path.join(process.cwd(), 'uploads', 'generated', fileName);
            fs.writeFileSync(filePath, Buffer.from(imgBase64, 'base64'));
            finalImageUrl = `/uploads/generated/${fileName}`;
            logGeminiUsage({ userId: user_id || null, projectId: project_id, endpoint: '/api/content-online/generate', usageType: 'image', modelName: 'gemini-3.1-flash-image-preview', feature: 'content_online_image', promptSent: imagePrompt?.substring(0, 10000), responseSummary: finalImageUrl });
        }

        // Step 3: Generate Caption (ถ้า mode ไม่ใช่ image_only)
        if (mode === 'both' || mode === 'caption_only') {
            sendEvent('progress', { step: 3, total: 5, message: 'AI กำลังคิดแคปชั่น...' });

            const captionPrompt = template.caption_prompt_template
                .replace(/\{product_name\}/g, product_name || '')
                .replace(/\{price\}/g, price || '')
                .replace(/\{slogan_line\}/g, slogan ? `Slogan: "${slogan}".` : '')
                .replace(/\{details_line\}/g, additional_details ? `Details: ${additional_details}.` : '');

            const genAI2 = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const textModel = genAI2.getGenerativeModel({ model: 'gemini-2.5-flash' });
            const captionResult = await textModel.generateContent(captionPrompt);
            const captionRaw = captionResult.response.text();

            try {
                const cleaned = captionRaw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
                const parsed = JSON.parse(cleaned);
                finalCaptionTh = parsed.caption_th || '';
                finalCaptionEn = parsed.caption_en || '';
            } catch (parseErr) {
                finalCaptionTh = captionRaw;
                finalCaptionEn = '';
            }
            if (user_id) await trackGeneration(user_id, 'content_online_caption', project_id, 'text');
            logGeminiUsage({ userId: user_id || null, projectId: project_id, endpoint: '/api/content-online/generate', usageType: 'text', modelName: 'gemini-2.5-flash', feature: 'content_online_caption', promptSent: captionPrompt?.substring(0, 10000), responseSummary: captionRaw?.substring(0, 500) });
        }

        // Step 4: บันทึกลง DB
        sendEvent('progress', { step: 4, total: 5, message: 'กำลังบันทึกผลลัพธ์...' });

        await conn.query(
            `INSERT INTO marketing_content
             (project_id, user_id, product_id, template_id, product_name_display, price, slogan,
              additional_details, source_image_url, source_image_type, platform,
              image_content, caption_th, caption_en, ai_model_image, ai_model_text)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [project_id, user_id, product_id, template_id, product_name, price, slogan,
                additional_details, source_image_url, source_image_type, platform,
                finalImageUrl, finalCaptionTh, finalCaptionEn,
                mode !== 'caption_only' ? 'gemini-3.1-flash-image-preview' : null,
                mode !== 'image_only' ? 'gemini-2.5-flash' : null]
        );

        if (finalImageUrl && mode !== 'caption_only') {
            await conn.query(
                `INSERT INTO generated_history (project_id, user_id, generation_type, image_url, prompt, is_selected, product_id, model_name)
                 VALUES (?, ?, 'CONTENT_ONLINE', ?, ?, 0, ?, ?)`,
                [project_id, user_id, finalImageUrl, `Content Online: ${product_name}`, product_id, 'gemini-3.1-flash-image-preview']
            );
            if (user_id) await trackGeneration(user_id, 'content_online', project_id);
        }

        conn.release();

        // Step 5: ส่งผลลัพธ์
        sendEvent('progress', { step: 5, total: 5, message: 'เสร็จสิ้น!' });
        sendEvent('done', {
            image_url: finalImageUrl,
            caption_th: finalCaptionTh,
            caption_en: finalCaptionEn,
            platform: platform,
            template_name: template.template_name_th
        });
        res.end();

    } catch (err) {
        console.error('Content-online generate error:', err);
        sendEvent('error', { message: err.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่' });
        res.end();
    }
});

// 4.4 POST upload custom image
app.post('/api/content-online/upload-image', upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ status: 'error', message: 'ไม่พบไฟล์รูปภาพ' });
    }
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ status: 'success', image_url: imageUrl });
});

// 4.5 GET history by project + product
app.get('/api/content-online/history/:projectId/:productId', async (req, res) => {
    const { projectId, productId } = req.params;
    try {
        const conn = await pool.getConnection();
        const [rows] = await conn.query(
            `SELECT mc.*, at.template_name_th, at.template_name
             FROM marketing_content mc
             LEFT JOIN ad_template at ON mc.template_id = at.template_id
             WHERE mc.project_id = ? AND mc.product_id = ?
             ORDER BY mc.created_at DESC`,
            [projectId, productId]
        );
        conn.release();
        res.json({ status: 'success', history: rows });
    } catch (err) {
        console.error('Content-online history error:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ================= END Content Online =================


app.get('/api/user/quota/:userId', async (req, res) => {
    const userId = parseInt(req.params.userId);
    if (!userId) return res.status(400).json({ status: 'error', message: 'Missing userId' });
    try {
        const imageQuota = await checkGenerationLimit(userId, 'image');
        const textQuota = await checkGenerationLimit(userId, 'text');
        res.json({
            status: 'success',
            image: { used: imageQuota.used, limit: imageQuota.limit, remaining: imageQuota.remaining },
            text: { used: textQuota.used, limit: textQuota.limit, remaining: textQuota.remaining },
            subscription_status: imageQuota.subscription_status,
            isPro: imageQuota.isPro,
            period: imageQuota.period,
        });
    } catch (err) {
        console.error("Quota Check Error:", err);
        res.status(500).json({ status: 'error' });
    }
});

// ================= USER NOTIFICATIONS =================
// ดึง notifications ของ user
app.get('/api/user/notifications/:userId', async (req, res) => {
    const userId = parseInt(req.params.userId);
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    if (!userId) return res.status(400).json({ status: 'error' });
    try {
        const conn = await pool.getConnection();
        const [rows] = await conn.query(
            `SELECT id, title, message, is_read, created_at
             FROM user_notifications WHERE user_id = ?
             ORDER BY created_at DESC LIMIT ?`,
            [userId, limit]
        );
        const [unreadRow] = await conn.query(
            `SELECT COUNT(*) as cnt FROM user_notifications WHERE user_id = ? AND is_read = 0`,
            [userId]
        );
        conn.release();
        res.json({ status: 'success', data: rows, unreadCount: unreadRow[0].cnt });
    } catch (err) {
        console.error("User Notifications Error:", err);
        res.status(500).json({ status: 'error' });
    }
});

// นับ unread notifications
app.get('/api/user/notifications/:userId/unread-count', async (req, res) => {
    const userId = parseInt(req.params.userId);
    if (!userId) return res.status(400).json({ status: 'error' });
    try {
        const conn = await pool.getConnection();
        const [rows] = await conn.query(
            `SELECT COUNT(*) as cnt FROM user_notifications WHERE user_id = ? AND is_read = 0`,
            [userId]
        );
        conn.release();
        res.json({ status: 'success', unreadCount: rows[0].cnt });
    } catch (err) {
        res.status(500).json({ status: 'error' });
    }
});

// Mark notification as read
app.put('/api/user/notifications/:notifId/read', async (req, res) => {
    const notifId = parseInt(req.params.notifId);
    try {
        const conn = await pool.getConnection();
        await conn.query(
            `UPDATE user_notifications SET is_read = 1, read_at = NOW() WHERE id = ?`,
            [notifId]
        );
        conn.release();
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ status: 'error' });
    }
});

// Mark all notifications as read
app.put('/api/user/notifications/:userId/read-all', async (req, res) => {
    const userId = parseInt(req.params.userId);
    try {
        const conn = await pool.getConnection();
        await conn.query(
            `UPDATE user_notifications SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0`,
            [userId]
        );
        conn.release();
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ status: 'error' });
    }
});

// ================= SUBSCRIPTION & PAYMENT (Omise) =================

const QUOTA_LIMITS = {
    STANDARD: { image: 6, text: 20, period: 'lifetime' },
    PRO:      { image: 50, text: 80, period: 'monthly' },
};

async function resetProQuotaIfNeeded(conn, user, userId) {
    if (user.subscription_status !== 'PRO') return user;
    if (!user.quota_reset_at || new Date(user.quota_reset_at) <= new Date()) {
        const nextReset = user.subscription_end_date
            ? new Date(user.subscription_end_date)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await conn.query(
            'UPDATE user_profile SET image_used = 0, text_used = 0, quota_reset_at = ? WHERE user_id = ?',
            [nextReset, userId]
        );
        user.image_used = 0;
        user.text_used = 0;
        user.quota_reset_at = nextReset;
    }
    return user;
}

async function checkGenerationLimit(userId, usageType = 'image') {
    const conn = await pool.getConnection();
    try {
        let userRows;
        try {
            [userRows] = await conn.query(
                'SELECT subscription_status, subscription_start_date, subscription_end_date, image_used, text_used, quota_reset_at FROM user_profile WHERE user_id = ?',
                [userId]
            );
        } catch (colErr) {
            // fallback ถ้ายังไม่ได้รัน ALTER TABLE
            [userRows] = await conn.query(
                'SELECT subscription_status, subscription_start_date, subscription_end_date FROM user_profile WHERE user_id = ?',
                [userId]
            );
            if (userRows.length) {
                userRows[0].image_used = 0;
                userRows[0].text_used = 0;
                userRows[0].quota_reset_at = null;
            }
        }
        if (!userRows.length) return { allowed: false, reason: 'user_not_found' };

        let user = userRows[0];
        const isPro = user.subscription_status === 'PRO' && (!user.subscription_end_date || new Date(user.subscription_end_date) > new Date());
        const tier = isPro ? 'PRO' : 'STANDARD';
        const limits = QUOTA_LIMITS[tier];

        if (isPro && user.quota_reset_at !== undefined) {
            try { user = await resetProQuotaIfNeeded(conn, user, userId); } catch (e) { /* columns not ready */ }
        }

        const used = usageType === 'text' ? (user.text_used || 0) : (user.image_used || 0);
        const limit = usageType === 'text' ? limits.text : limits.image;

        return {
            allowed: used < limit,
            used,
            limit,
            remaining: Math.max(0, limit - used),
            period: limits.period,
            isPro,
            subscription_status: user.subscription_status,
            usageType,
            image_used: user.image_used,
            image_limit: limits.image,
            text_used: user.text_used,
            text_limit: limits.text,
        };
    } finally {
        conn.release();
    }
}

async function trackGeneration(userId, feature, projectId, usageType = 'image') {
    const conn = await pool.getConnection();
    try {
        await conn.query(
            'INSERT INTO generation_usage (user_id, feature, project_id) VALUES (?, ?, ?)',
            [userId, feature, projectId || null]
        );
        const col = usageType === 'text' ? 'text_used' : 'image_used';
        try {
            await conn.query(`UPDATE user_profile SET ${col} = ${col} + 1 WHERE user_id = ?`, [userId]);
        } catch (e) { /* columns not added yet */ }
    } finally {
        conn.release();
    }
}

// ============ Gemini Usage Logger ============
(async () => {
    const conn = await pool.getConnection();
    try {
        await conn.query(`
            CREATE TABLE IF NOT EXISTS gemini_usage_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT DEFAULT NULL,
                project_id INT DEFAULT NULL,
                endpoint VARCHAR(255) NOT NULL COMMENT 'route path เช่น /api/generate-logo',
                usage_type ENUM('text','image') NOT NULL COMMENT 'ประเภท: text หรือ image',
                model_name VARCHAR(100) NOT NULL COMMENT 'ชื่อโมเดล เช่น gemini-2.5-flash',
                feature VARCHAR(100) DEFAULT NULL COMMENT 'ชื่อฟีเจอร์ เช่น brand_dna, logo, mockup',
                prompt_sent LONGTEXT DEFAULT NULL COMMENT 'prompt ที่ส่งไป',
                response_summary TEXT DEFAULT NULL COMMENT 'สรุปผลลัพธ์ เช่น image_url หรือ text ย่อ',
                tokens_used INT DEFAULT NULL,
                status ENUM('success','failed') DEFAULT 'success',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                KEY idx_user (user_id),
                KEY idx_type (usage_type),
                KEY idx_model (model_name),
                KEY idx_feature (feature),
                KEY idx_created (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
    } finally {
        conn.release();
    }
})();

async function logGeminiUsage({ userId, projectId, endpoint, usageType, modelName, feature, promptSent, responseSummary, status = 'success' }) {
    try {
        const conn = await pool.getConnection();
        await conn.query(
            `INSERT INTO gemini_usage_logs (user_id, project_id, endpoint, usage_type, model_name, feature, prompt_sent, response_summary, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId || null, projectId || null, endpoint, usageType, modelName, feature || null,
             typeof promptSent === 'string' ? promptSent.substring(0, 10000) : null,
             typeof responseSummary === 'string' ? responseSummary.substring(0, 2000) : null,
             status]
        );
        conn.release();
    } catch (err) {
        console.warn('logGeminiUsage warning:', err.message);
    }
}

// 1. GET subscription status
app.get('/api/subscription/status/:userId', async (req, res) => {
    const userId = parseInt(req.params.userId);
    if (!userId) return res.status(400).json({ status: 'error', message: 'Invalid user ID' });

    try {
        const conn = await pool.getConnection();
        const [userRows] = await conn.query(
            'SELECT subscription_status, subscription_start_date, subscription_end_date, omise_customer_id FROM user_profile WHERE user_id = ?',
            [userId]
        );
        if (!userRows.length) {
            conn.release();
            return res.status(404).json({ status: 'error', message: 'User not found' });
        }

        const user = userRows[0];
        const isPro = user.subscription_status === 'PRO' && (!user.subscription_end_date || new Date(user.subscription_end_date) > new Date());

        let countQuery, countParams;
        if (isPro) {
            countQuery = 'SELECT COUNT(*) as cnt FROM generation_usage WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)';
            countParams = [userId];
        } else {
            countQuery = 'SELECT COUNT(*) as cnt FROM generation_usage WHERE user_id = ?';
            countParams = [userId];
        }
        const [countRows] = await conn.query(countQuery, countParams);

        const [paymentRows] = await conn.query(
            'SELECT payment_id, amount_paid, payment_method, status, created_at FROM payment_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 5',
            [userId]
        );

        conn.release();

        const limit = isPro ? 50 : 6;
        const used = countRows[0].cnt;

        res.json({
            status: 'success',
            subscription: {
                subscription_status: isPro ? 'PRO' : user.subscription_status,
                subscription_start_date: user.subscription_start_date,
                subscription_end_date: user.subscription_end_date,
                has_omise_customer: !!user.omise_customer_id,
                generation_used: used,
                generation_limit: limit,
                generation_remaining: Math.max(0, limit - used),
                generation_period: isPro ? 'monthly' : 'lifetime',
                recent_payments: paymentRows
            }
        });
    } catch (err) {
        console.error('Subscription status error:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// 2. POST create charge (Omise)
app.post('/api/subscription/create-charge', async (req, res) => {
    const { user_id, token, source } = req.body;
    if (!user_id) return res.status(400).json({ status: 'error', message: 'user_id is required' });
    if (!token && !source) return res.status(400).json({ status: 'error', message: 'token or source is required' });

    const conn = await pool.getConnection();
    try {
        const [userRows] = await conn.query('SELECT * FROM user_profile WHERE user_id = ?', [user_id]);
        if (!userRows.length) {
            conn.release();
            return res.status(404).json({ status: 'error', message: 'User not found' });
        }
        const user = userRows[0];
        const amount = 12900; //129 บาท
        const returnUri = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/subscription?payment=pending&user_id=${user_id}`;

        const chargeParams = {
            amount,
            currency: 'thb',
            metadata: { user_id: String(user_id), plan: 'PRO_MONTHLY' }
        };

        // สร้าง/อัปเดต Omise Customer (เก็บบัตรไว้สำหรับ recurring)
        if (token) {
            let customerId = user.omise_customer_id;
            if (!customerId) {
                const customer = await omise.customers.create({
                    email: user.email,
                    description: `Punthai User: ${user.user_name}`,
                    card: token
                });
                customerId = customer.id;
                await conn.query('UPDATE user_profile SET omise_customer_id = ? WHERE user_id = ?', [customerId, user_id]);
            } else {
                await omise.customers.update(customerId, { card: token });
            }
            chargeParams.customer = customerId;
        } else if (source) {
            chargeParams.source = source;
            chargeParams.return_uri = returnUri;
        }

        const charge = await omise.charges.create(chargeParams);
        const paymentMethod = charge.source?.type || 'credit_card';

        if (charge.status === 'successful' || (charge.authorized && !charge.authorize_uri)) {
            const now = new Date();
            const endDate = new Date(now);
            endDate.setMonth(endDate.getMonth() + 1);
            const nextBilling = new Date(endDate);

            await conn.query(
                `UPDATE user_profile SET subscription_status = 'PRO', subscription_start_date = ?, subscription_end_date = ?, next_billing_date = ? WHERE user_id = ?`,
                [now, endDate, nextBilling, user_id]
            );
            await conn.query(
                `INSERT INTO payment_logs (user_id, omise_charge_id, amount_paid, package_selected, status, payment_method) VALUES (?, ?, ?, ?, ?, ?)`,
                [user_id, charge.id, 129.00, 'PRO_MONTHLY', 'successful', paymentMethod]
            );
            await conn.query(
                `INSERT INTO subscription_history (user_id, charge_id, amount, billing_period_start, billing_period_end, status, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [user_id, charge.id, 129.00, now, endDate, 'successful', paymentMethod]
            );

            // สร้าง Omise Schedule สำหรับ recurring (เฉพาะบัตรเครดิต)
            if (token && user.omise_customer_id || chargeParams.customer) {
                try {
                    const scheduleEnd = new Date();
                    scheduleEnd.setFullYear(scheduleEnd.getFullYear() + 10);

                    const schedule = await omise.schedules.create({
                        every: 1,
                        period: 'month',
                        start_date: endDate.toISOString().split('T')[0],
                        end_date: scheduleEnd.toISOString().split('T')[0],
                        charge: {
                            amount: amount,
                            currency: 'thb',
                            customer: chargeParams.customer,
                            metadata: { user_id: String(user_id), plan: 'PRO_MONTHLY' }
                        }
                    });
                    await conn.query('UPDATE user_profile SET omise_schedule_id = ? WHERE user_id = ?', [schedule.id, user_id]);
                } catch (schedErr) {
                    console.error('Schedule creation failed (non-blocking):', schedErr.message);
                }
            }

            const [updatedUser] = await conn.query('SELECT * FROM user_profile WHERE user_id = ?', [user_id]);
            conn.release();
            return res.json({ status: 'success', charge_id: charge.id, user: updatedUser[0] });
        }

        if (charge.authorize_uri) {
            await conn.query(
                `INSERT INTO payment_logs (user_id, omise_charge_id, amount_paid, package_selected, status, payment_method) VALUES (?, ?, ?, ?, ?, ?)`,
                [user_id, charge.id, 129.00, 'PRO_MONTHLY', 'pending', paymentMethod]
            );
            conn.release();
            return res.json({ status: 'redirect', authorize_uri: charge.authorize_uri, charge_id: charge.id });
        }

        await conn.query(
            `INSERT INTO payment_logs (user_id, omise_charge_id, amount_paid, package_selected, status, payment_method) VALUES (?, ?, ?, ?, ?, ?)`,
            [user_id, charge.id, 129.00, 'PRO_MONTHLY', charge.status, paymentMethod]
        );
        conn.release();
        return res.status(400).json({ status: 'error', message: 'การชำระเงินไม่สำเร็จ', failure_code: charge.failure_code });
    } catch (err) {
        conn.release();
        console.error('Create charge error:', err);
        res.status(500).json({ status: 'error', message: err.message || 'Payment processing failed' });
    }
});
// 3. POST Omise Webhook
app.post('/api/webhook/omise', async (req, res) => {
    const event = req.body;
    if (!event || !event.data) return res.status(200).send('OK');

    const conn = await pool.getConnection();
    try {
        // บันทึกทุก event ลง omise_webhook_logs
        await conn.query(
            `INSERT INTO omise_webhook_logs (event_key, event_id, object_id, data) VALUES (?, ?, ?, ?)`,
            [event.key || '', event.id || null, event.data?.id || null, JSON.stringify(event)]
        );

        if (event.key === 'charge.complete') {
            const charge = event.data;
            const chargeId = charge.id;
            const userId = charge.metadata?.user_id;

            // อัปเดต payment_logs ถ้ามี
            const [logRows] = await conn.query('SELECT * FROM payment_logs WHERE omise_charge_id = ?', [chargeId]);

            if (charge.status === 'successful') {
                if (logRows.length) {
                    await conn.query('UPDATE payment_logs SET status = ? WHERE omise_charge_id = ?', ['successful', chargeId]);
                }

                // หา user_id จาก payment_logs หรือ metadata
                const targetUserId = logRows.length ? logRows[0].user_id : (userId ? parseInt(userId) : null);

                if (targetUserId) {
                    const now = new Date();
                    const endDate = new Date(now);
                    endDate.setMonth(endDate.getMonth() + 1);
                    const nextBilling = new Date(endDate);

                    await conn.query(
                        `UPDATE user_profile SET subscription_status = 'PRO', subscription_start_date = ?, subscription_end_date = ?, next_billing_date = ? WHERE user_id = ?`,
                        [now, endDate, nextBilling, targetUserId]
                    );

                    // บันทึกลง subscription_history
                    await conn.query(
                        `INSERT INTO subscription_history (user_id, charge_id, amount, billing_period_start, billing_period_end, status, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [targetUserId, chargeId, 129.00, now, endDate, 'successful', charge.source?.type || 'credit_card']
                    );

                    // ถ้าเป็น recurring charge จาก schedule แต่ไม่มี payment_logs → เพิ่มให้
                    if (!logRows.length) {
                        await conn.query(
                            `INSERT INTO payment_logs (user_id, omise_charge_id, amount_paid, package_selected, status, payment_method) VALUES (?, ?, ?, ?, ?, ?)`,
                            [targetUserId, chargeId, 129.00, 'PRO_MONTHLY', 'successful', charge.source?.type || 'credit_card']
                        );
                    }
                }
            } else if (charge.status === 'failed') {
                if (logRows.length) {
                    await conn.query('UPDATE payment_logs SET status = ? WHERE omise_charge_id = ?', ['failed', chargeId]);
                }
                // ถ้า recurring charge fail → บันทึกไว้
                const targetUserId = logRows.length ? logRows[0].user_id : (userId ? parseInt(userId) : null);
                if (targetUserId) {
                    const now = new Date();
                    const endDate = new Date(now);
                    endDate.setMonth(endDate.getMonth() + 1);
                    await conn.query(
                        `INSERT INTO subscription_history (user_id, charge_id, amount, billing_period_start, billing_period_end, status, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [targetUserId, chargeId, 129.00, now, endDate, 'failed', charge.source?.type || 'credit_card']
                    );
                }
            }
        }

        conn.release();
        res.status(200).send('OK');
    } catch (err) {
        conn.release();
        console.error('Webhook error:', err);
        res.status(200).send('OK');
    }
});

// 4. GET check payment status (for polling after redirect)
app.get('/api/subscription/check-payment/:chargeId', async (req, res) => {
    const { chargeId } = req.params;
    try {
        const conn = await pool.getConnection();
        const [rows] = await conn.query('SELECT * FROM payment_logs WHERE omise_charge_id = ?', [chargeId]);
        if (!rows.length) {
            conn.release();
            return res.status(404).json({ status: 'error', message: 'Payment not found' });
        }

        const log = rows[0];
        if (log.status === 'successful') {
            const [userRows] = await conn.query('SELECT * FROM user_profile WHERE user_id = ?', [log.user_id]);
            conn.release();
            return res.json({ status: 'success', payment_status: 'successful', user: userRows[0] });
        }

        const charge = await omise.charges.retrieve(chargeId);
        if (charge.status === 'successful' && log.status !== 'successful') {
            const now = new Date();
            const endDate = new Date(now);
            endDate.setMonth(endDate.getMonth() + 1);

            await conn.query('UPDATE payment_logs SET status = ? WHERE omise_charge_id = ?', ['successful', chargeId]);
            await conn.query(
                `UPDATE user_profile SET subscription_status = 'PRO', subscription_start_date = ?, subscription_end_date = ? WHERE user_id = ?`,
                [now, endDate, log.user_id]
            );

            const [updatedUser] = await conn.query('SELECT * FROM user_profile WHERE user_id = ?', [log.user_id]);
            conn.release();
            return res.json({ status: 'success', payment_status: 'successful', user: updatedUser[0] });
        }

        conn.release();
        res.json({ status: 'success', payment_status: charge.status, failure_code: charge.failure_code });
    } catch (err) {
        console.error('Check payment error:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});



// ดูประวัติ subscription ทุกรอบบิล
app.get('/api/subscription/history/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const conn = await pool.getConnection();
        const [rows] = await conn.query(
            'SELECT * FROM subscription_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 24',
            [userId]
        );
        conn.release();
        res.json({ status: 'success', history: rows });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ยกเลิก subscription (หยุด recurring + เปลี่ยนสถานะเมื่อหมดรอบ)
app.post('/api/subscription/cancel', async (req, res) => {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ status: 'error', message: 'user_id is required' });

    const conn = await pool.getConnection();
    try {
        const [userRows] = await conn.query('SELECT * FROM user_profile WHERE user_id = ?', [user_id]);
        if (!userRows.length) { conn.release(); return res.status(404).json({ status: 'error', message: 'User not found' }); }
        const user = userRows[0];

        // ยกเลิก Omise Schedule ถ้ามี
        if (user.omise_schedule_id) {
            try {
                await omise.schedules.destroy(user.omise_schedule_id);
            } catch (e) {
                console.error('Destroy schedule error (non-blocking):', e.message);
            }
        }

        // ไม่เปลี่ยนเป็น STANDARD ทันที — ให้ใช้ได้จนหมดรอบ
        await conn.query(
            'UPDATE user_profile SET omise_schedule_id = NULL, next_billing_date = NULL WHERE user_id = ?',
            [user_id]
        );

        conn.release();
        res.json({
            status: 'success',
            message: 'ยกเลิกการต่ออายุอัตโนมัติแล้ว ยังใช้ PRO ได้ถึง ' + (user.subscription_end_date ? new Date(user.subscription_end_date).toLocaleDateString('th-TH') : 'สิ้นรอบปัจจุบัน')
        });
    } catch (err) {
        conn.release();
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Daily check: ปรับ user ที่หมดอายุแล้วไม่ได้ต่อกลับเป็น STANDARD (เรียกผ่าน cron หรือ manual)
app.post('/api/subscription/check-expired', async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const [expired] = await conn.query(
            `UPDATE user_profile SET subscription_status = 'STANDARD' WHERE subscription_status = 'PRO' AND subscription_end_date < NOW() AND omise_schedule_id IS NULL`
        );
        conn.release();
        res.json({ status: 'success', updated: expired.affectedRows });
    } catch (err) {
        conn.release();
        res.status(500).json({ status: 'error', message: err.message });
    }
});
// ================= END SUBSCRIPTION & PAYMENT =================


// ================= START API โรงพิมพ์ (Third Party) =================

// POST /api/third-party/register — ลงทะเบียนโรงพิมพ์
app.post('/api/third-party/register', upload.single('image_profile'), async (req, res) => {
    const { third_party_name, email, password, phone } = req.body;
    const image_profile = req.file ? req.file.filename : null;

    if (!third_party_name || !email || !password || !phone) {
        return res.status(400).json({
            status: 'error',
            message: 'กรุณากรอกข้อมูลให้ครบ: ชื่อร้าน, อีเมล, รหัสผ่าน, เบอร์โทร'
        });
    }

    const connection = await pool.getConnection();
    try {
        const [existing] = await connection.query(
            'SELECT third_party_id FROM third_party WHERE email = ?', [email]
        );
        const [existingUser] = await connection.query(
            'SELECT user_id FROM user_profile WHERE email = ?', [email]
        );
        if (existing.length > 0 || existingUser.length > 0) {
            connection.release();
            return res.status(400).json({ status: 'error', message: 'อีเมลนี้ถูกใช้งานแล้ว' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // สร้างบัญชีแบบ transaction: user_profile (account_type='printshop') ก่อน แล้วผูก third_party
        await connection.beginTransaction();

        const [userResult] = await connection.query(
            `INSERT INTO user_profile (user_name, email, password, image_profile, subscription_status, account_type)
             VALUES (?, ?, ?, ?, 'STANDARD', 'printshop')`,
            [third_party_name, email, hashedPassword, image_profile]
        );
        const userId = userResult.insertId;

        const [result] = await connection.query(
            `INSERT INTO third_party (third_party_name, email, password, phone, image_profile, subscription_status, user_id)
             VALUES (?, ?, ?, ?, ?, 'active', ?)`,
            [third_party_name, email, hashedPassword, phone, image_profile, userId]
        );

        await connection.commit();

        const [newShop] = await connection.query(
            'SELECT third_party_id, third_party_name, email, phone, image_profile, subscription_status, user_id FROM third_party WHERE third_party_id = ?',
            [result.insertId]
        );
        connection.release();

        // คืน object พร้อม user_id + role ให้ Frontend ใช้งานได้ทุกฟีเจอร์เหมือน user ทั่วไป
        res.json({
            status: 'success',
            message: 'ลงทะเบียนโรงพิมพ์สำเร็จ!',
            third_party: newShop[0],
            user: { ...newShop[0], user_id: userId, user_name: third_party_name, account_type: 'printshop', role: 'printshop', subscription_status: 'STANDARD' }
        });

    } catch (error) {
        try { await connection.rollback(); } catch (e) {}
        connection.release();
        console.error('Third Party Register Error:', error);
        res.status(500).json({ status: 'error', message: 'Database Error', error: error.message });
    }
});

// POST /api/third-party/login — เข้าสู่ระบบโรงพิมพ์
app.post('/api/third-party/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ status: 'error', message: 'กรุณากรอกอีเมลและรหัสผ่าน' });
    }

    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.query(
            'SELECT * FROM third_party WHERE email = ?', [email]
        );

        if (rows.length === 0) {
            connection.release();
            return res.status(401).json({ status: 'error', message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
        }

        const shop = rows[0];

        if (shop.subscription_status === 'cancelled') {
            connection.release();
            return res.status(403).json({ status: 'error', message: 'บัญชีนี้ถูกยกเลิกแล้ว กรุณาติดต่อผู้ดูแลระบบ' });
        }

        let validPassword = false;
        const isHashed = shop.password && (shop.password.startsWith('$2a$') || shop.password.startsWith('$2b$'));

        if (isHashed) {
            validPassword = await bcrypt.compare(password, shop.password);
        } else {
            if (password === shop.password) {
                validPassword = true;
                try {
                    const salt = await bcrypt.genSalt(10);
                    const newHashed = await bcrypt.hash(password, salt);
                    await connection.query(
                        'UPDATE third_party SET password = ? WHERE third_party_id = ?',
                        [newHashed, shop.third_party_id]
                    );
                } catch (hashErr) {
                    console.error('Auto-migrate password error:', hashErr);
                }
            }
        }

        connection.release();

        if (!validPassword) {
            return res.status(401).json({ status: 'error', message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
        }

        delete shop.password;
        // แนบ role + user_id ให้ Frontend ใช้งานได้เหมือน user ทั่วไป
        shop.role = 'printshop';
        shop.account_type = 'printshop';
        res.json({
            status: 'success',
            message: 'เข้าสู่ระบบสำเร็จ!',
            third_party: shop,
            user: { ...shop }
        });

    } catch (error) {
        console.error('Third Party Login Error:', error);
        res.status(500).json({ status: 'error', message: 'Server Error', error: error.message });
    }
});

// GET /api/third-party/:id — ดูข้อมูลโรงพิมพ์
app.get('/api/third-party/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.query(
            `SELECT third_party_id, third_party_name, email, phone, image_profile, subscription_status,
                    user_id, address, map_url, line_id, facebook, website, about, open_hours
             FROM third_party WHERE third_party_id = ?`,
            [id]
        );
        connection.release();

        if (rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'ไม่พบข้อมูลโรงพิมพ์' });
        }
        res.json({ status: 'success', third_party: rows[0] });
    } catch (error) {
        console.error('Get Third Party Error:', error);
        res.status(500).json({ status: 'error', message: 'Database Error', error: error.message });
    }
});

// PUT /api/third-party/:id — แก้ไขข้อมูลโรงพิมพ์
app.put('/api/third-party/:id', upload.single('image_profile'), async (req, res) => {
    const { id } = req.params;
    const { third_party_name, phone, password, address, map_url, line_id, facebook, website, about, open_hours } = req.body;
    const image_profile = req.file ? req.file.filename : null;

    try {
        const connection = await pool.getConnection();

        const fields = [];
        const params = [];

        if (third_party_name) { fields.push('third_party_name = ?'); params.push(third_party_name); }
        if (phone !== undefined)      { fields.push('phone = ?');      params.push(phone); }
        if (image_profile)            { fields.push('image_profile = ?'); params.push(image_profile); }
        // ฟิลด์ที่ตั้ง/ช่องทางติดต่อ (feature 5) — เจ้าของกรอกเอง
        if (address !== undefined)    { fields.push('address = ?');    params.push(address); }
        if (map_url !== undefined)    { fields.push('map_url = ?');    params.push(map_url); }
        if (line_id !== undefined)    { fields.push('line_id = ?');    params.push(line_id); }
        if (facebook !== undefined)   { fields.push('facebook = ?');   params.push(facebook); }
        if (website !== undefined)    { fields.push('website = ?');    params.push(website); }
        if (about !== undefined)      { fields.push('about = ?');      params.push(about); }
        if (open_hours !== undefined) { fields.push('open_hours = ?'); params.push(open_hours); }
        if (password && password.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            const hashed = await bcrypt.hash(password, salt);
            fields.push('password = ?');
            params.push(hashed);
        }

        if (fields.length === 0) {
            connection.release();
            return res.status(400).json({ status: 'error', message: 'ไม่มีข้อมูลที่ต้องการอัปเดต' });
        }

        params.push(id);
        await connection.query(`UPDATE third_party SET ${fields.join(', ')} WHERE third_party_id = ?`, params);

        const [updated] = await connection.query(
            `SELECT third_party_id, third_party_name, email, phone, image_profile, subscription_status,
                    user_id, address, map_url, line_id, facebook, website, about, open_hours
             FROM third_party WHERE third_party_id = ?`,
            [id]
        );
        connection.release();

        res.json({ status: 'success', message: 'อัปเดตข้อมูลสำเร็จ', third_party: updated[0] });
    } catch (error) {
        console.error('Update Third Party Error:', error);
        res.status(500).json({ status: 'error', message: 'Database Error', error: error.message });
    }
});

// ================= END API โรงพิมพ์ (Third Party) =================


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`รันได้แล้ว Server running on http://localhost:${PORT}`);
});