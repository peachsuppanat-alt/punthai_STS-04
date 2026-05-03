// ====================================================================
// 🏷️ LABEL FEATURE v2 — Backend Endpoints
// ====================================================================
// 📌 วิธีใช้:
//   1) เปิดไฟล์ punthai-backend-api/server.js
//   2) ลบ endpoint "/api/save-label" เดิม (ราวบรรทัด 1475-1503)
//   3) วางโค้ดทั้งหมดด้านล่างนี้ "ก่อน" บรรทัด `const PORT = process.env.PORT || 3000;`
//   4) endpoint "/api/generate-label-content" เดิมยังใช้ได้ (Gemini สำหรับ tagline/ingredients) ไม่ต้องแก้
//   5) restart server
//
// ⚠️ TODO Future: เพิ่ม Credit Check ตรงจุด POST /api/generate-label-background
//    (ตอนนี้ยังไม่ทำตามที่ตกลงกัน — รอทำพร้อมระบบ Credit ของทั้งแพลตฟอร์ม)
// ====================================================================


// ====================================================================
// 🎨 GET /api/bg-presets
// ดึงรายการ background สำเร็จรูปทั้งหมด (สำหรับให้ผู้ใช้เลือกแบบฟรี)
// ====================================================================
app.get('/api/bg-presets', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.query(
            `SELECT bg_preset_id, name, style, image_url, thumbnail_url
             FROM bg_preset
             WHERE is_active = 1
             ORDER BY bg_preset_id ASC`
        );
        connection.release();
        res.json({ status: 'success', data: rows });
    } catch (err) {
        console.error("Get BG Presets Error:", err);
        res.status(500).json({ status: 'error', message: 'Database error' });
    }
});


// ====================================================================
// ✨ POST /api/generate-label-background
// เรียก DALL-E 3 สร้างพื้นหลังเฉพาะตัวให้ฉลาก
// body: { project_id, user_id, style, tone, density }
//   - style    : minimal | thai_traditional | nature | watercolor | geometric | vintage
//   - tone     : auto | bright | dark | pastel
//   - density  : low | medium | high
// ====================================================================
app.post('/api/generate-label-background', async (req, res) => {
    const { project_id, user_id, style = 'minimal', tone = 'auto', density = 'medium' } = req.body;

    if (!project_id) {
        return res.status(400).json({ status: 'error', message: 'project_id is required' });
    }

    let connection;
    try {
        connection = await pool.getConnection();

        // 1) ดึงข้อมูลแบรนด์จาก project + brand_dna
        const [projRows] = await connection.query(
            `SELECT p.project_name, bd.business_type, bd.brand_persona
             FROM project p
             LEFT JOIN brand_dna bd ON bd.project_id = p.project_id
             WHERE p.project_id = ?`,
            [project_id]
        );
        const projInfo = projRows[0] || {};

        // 2) ดึงสีที่ select ไว้
        const [colorRows] = await connection.query(
            `SELECT c.color_code_1, c.color_code_2, c.color_code_3, c.color_code_4, c.color_code_5
             FROM color_concept cc
             JOIN color c ON cc.color_id = c.color_id
             WHERE cc.project_id = ? AND cc.is_selected = 1
             LIMIT 1`,
            [project_id]
        );
        const palette = colorRows[0]
            ? [colorRows[0].color_code_1, colorRows[0].color_code_2, colorRows[0].color_code_3,
               colorRows[0].color_code_4, colorRows[0].color_code_5].filter(Boolean).join(', ')
            : '#F5E6D3, #C9A678, #8B6F47'; // earthy fallback

        connection.release();
        connection = null;

        // 3) Build Prompt — Strict Rules ห้าม text ห้าม mockup
        const styleMap = {
            minimal: 'minimal, lots of empty white space, very subtle small accents on edges only',
            thai_traditional: 'subtle traditional Thai pattern (lai kanok / lotus), elegant, sparse',
            nature: 'soft botanical leaves and small flowers along edges',
            watercolor: 'soft watercolor wash, blurred organic shapes, light',
            geometric: 'simple geometric lines and dots, modern, sparse',
            vintage: 'aged paper texture, faded ornamental corners'
        };
        const toneMap = {
            auto: '',
            bright: 'bright and airy lighting',
            dark: 'rich deep tones',
            pastel: 'soft pastel tones'
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

STRICT RULES (MUST FOLLOW):
- NO text, NO letters, NO numbers, NO words anywhere in the image
- NO logos, NO brand marks, NO icons, NO symbols that look like letters
- 2D flat illustration only — NO 3D, NO mockup, NO realistic photo
- Pattern MUST leave a large clear empty soft area in the CENTER of the image (for text overlay later)
- No people, no faces, no animals, no products
- Background color base must be light/neutral so dark text reads on top
- Plain edges, decoration only as subtle accent
        `.trim();

        // 4) เรียก DALL-E 3
        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: prompt,
            n: 1,
            size: "1024x1024",
            quality: "standard"
        });

        const imageUrl = response.data[0].url;

        // 5) Log การเรียก API
        try {
            const logConn = await pool.getConnection();
            await logConn.query(
                `INSERT INTO api_logs (user_id, api_name, endpoint, status_code, response_time_ms, created_at)
                 VALUES (?, 'dalle-3', '/api/generate-label-background', 200, 0, NOW())`,
                [user_id || null]
            );
            await logConn.query(
                `INSERT INTO generated_history (user_id, project_id, image_url, prompt_used, model_used, created_at)
                 VALUES (?, ?, ?, ?, 'dall-e-3', NOW())`,
                [user_id || null, project_id, imageUrl, prompt]
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


// ====================================================================
// 📥 GET /api/labels/:projectId
// ดึงข้อมูล label ของ project (เอาตัวล่าสุด 1 record)
// ====================================================================
app.get('/api/labels/:projectId', async (req, res) => {
    const { projectId } = req.params;
    if (!projectId || isNaN(projectId)) {
        return res.status(400).json({ status: 'error', message: 'Invalid project_id' });
    }

    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.query(
            `SELECT * FROM label_design
             WHERE project_id = ?
             ORDER BY updated_at DESC
             LIMIT 1`,
            [projectId]
        );
        connection.release();

        if (rows.length === 0) {
            return res.json({ status: 'success', data: null });
        }

        const row = rows[0];
        // Parse JSON fields กลับเป็น object/array
        try {
            if (row.manufacturer_info && typeof row.manufacturer_info === 'string') {
                row.manufacturer_info = JSON.parse(row.manufacturer_info);
            }
            if (row.certifications && typeof row.certifications === 'string') {
                row.certifications = JSON.parse(row.certifications);
            }
        } catch (parseErr) {
            console.warn("JSON parse warning:", parseErr.message);
        }

        res.json({ status: 'success', data: row });
    } catch (err) {
        console.error("Get Label Error:", err);
        res.status(500).json({ status: 'error', message: 'Database error' });
    }
});


// ====================================================================
// 💾 POST /api/labels
// บันทึก / อัปเดต label (Upsert ตาม project_id)
// (มาแทนที่ /api/save-label เดิมที่ field น้อย)
// ====================================================================
app.post('/api/labels', async (req, res) => {
    const {
        project_id,
        product_name, tagline, net_weight,
        ingredients, usage_instruction, storage_instruction, warnings,
        manufacturer_info,
        fda_number, mfg_date, exp_date, lot_number,
        certifications,
        qr_code_value, barcode_value, show_qr, show_barcode,
        layout_type, bg_mode, bg_color, bg_preset_id, bg_image_url, bg_opacity
    } = req.body;

    if (!project_id || !product_name) {
        return res.status(400).json({ status: 'error', message: 'project_id and product_name are required' });
    }

    try {
        const connection = await pool.getConnection();
        const [existing] = await connection.query(
            'SELECT label_id FROM label_design WHERE project_id = ?',
            [project_id]
        );

        const manufacturerJson = manufacturer_info ? JSON.stringify(manufacturer_info) : null;
        const certificationsJson = (certifications && certifications.length > 0) ? JSON.stringify(certifications) : null;

        const fields = [
            product_name,
            tagline || null,
            net_weight || null,
            ingredients || null,
            usage_instruction || null,
            storage_instruction || null,
            warnings || null,
            manufacturerJson,
            fda_number || null,
            mfg_date || null,
            exp_date || null,
            lot_number || null,
            certificationsJson,
            qr_code_value || null,
            barcode_value || null,
            show_qr ? 1 : 0,
            show_barcode ? 1 : 0,
            layout_type || 'centered_classic',
            bg_mode || 'solid',
            bg_color || '#FFFFFF',
            bg_preset_id || null,
            bg_image_url || null,
            (bg_opacity !== undefined && bg_opacity !== null) ? bg_opacity : 1.00
        ];

        if (existing.length > 0) {
            await connection.query(
                `UPDATE label_design SET
                    product_name=?, tagline=?, net_weight=?,
                    ingredients=?, usage_instruction=?, storage_instruction=?, warnings=?,
                    manufacturer_info=?,
                    fda_number=?, mfg_date=?, exp_date=?, lot_number=?,
                    certifications=?,
                    qr_code_value=?, barcode_value=?, show_qr=?, show_barcode=?,
                    layout_type=?, bg_mode=?, bg_color=?, bg_preset_id=?, bg_image_url=?, bg_opacity=?
                 WHERE project_id=?`,
                [...fields, project_id]
            );
            connection.release();
            return res.json({ status: 'success', message: 'อัปเดตฉลากเรียบร้อย', label_id: existing[0].label_id });
        } else {
            const [insertRes] = await connection.query(
                `INSERT INTO label_design (
                    product_name, tagline, net_weight,
                    ingredients, usage_instruction, storage_instruction, warnings,
                    manufacturer_info,
                    fda_number, mfg_date, exp_date, lot_number,
                    certifications,
                    qr_code_value, barcode_value, show_qr, show_barcode,
                    layout_type, bg_mode, bg_color, bg_preset_id, bg_image_url, bg_opacity,
                    project_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [...fields, project_id]
            );
            connection.release();
            return res.json({ status: 'success', message: 'บันทึกฉลากใหม่เรียบร้อย', label_id: insertRes.insertId });
        }
    } catch (err) {
        console.error("Save Label v2 Error:", err);
        res.status(500).json({ status: 'error', message: err.message || 'Database error' });
    }
});

// ====================================================================
// END LABEL v2 ENDPOINTS
// ====================================================================
