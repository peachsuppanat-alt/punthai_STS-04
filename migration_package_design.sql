-- Migration: Package Design feature
-- เพิ่ม columns ใน mockup_design สำหรับ Package Design mode

ALTER TABLE mockup_design ADD COLUMN design_mode VARCHAR(20) DEFAULT 'sticker' COMMENT 'sticker|package_design|ai_mockup';
ALTER TABLE mockup_design ADD COLUMN ai_dieline_bg_url VARCHAR(500) DEFAULT NULL COMMENT 'URL ของภาพ background ทั้ง die-line ที่ AI สร้าง';
ALTER TABLE mockup_design ADD COLUMN ai_bg_prompt TEXT DEFAULT NULL COMMENT 'Prompt ที่ใช้สร้าง AI background';
