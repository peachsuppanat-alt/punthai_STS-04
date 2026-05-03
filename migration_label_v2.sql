-- ====================================================================
-- Punthai Label Feature v2 — Database Migration
-- ====================================================================
-- รันสคริปต์นี้บน MariaDB ของคุณ (HeidiSQL / phpMyAdmin / CLI)
-- ⚠️ DROP TABLE label_design ของเดิมและสร้างใหม่ ข้อมูลเดิมจะหาย
-- ====================================================================

USE `punthai_db`;

-- --------------------------------------------------------------------
-- 1) ลบตาราง label_design เดิม แล้วสร้างใหม่ให้ครอบคลุมข้อมูลทั้งหมด
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `label_design`;

CREATE TABLE `label_design` (
  `label_id` INT(11) NOT NULL AUTO_INCREMENT,
  `project_id` INT(11) NOT NULL,

  -- A. ข้อมูลหลัก
  `product_name` VARCHAR(255) NOT NULL,
  `tagline` VARCHAR(500) DEFAULT NULL,
  `net_weight` VARCHAR(50) DEFAULT NULL,

  -- B. ข้อมูลผลิตภัณฑ์
  `ingredients` TEXT DEFAULT NULL,
  `usage_instruction` TEXT DEFAULT NULL,
  `storage_instruction` TEXT DEFAULT NULL,
  `warnings` TEXT DEFAULT NULL,

  -- C. ข้อมูลผู้ผลิต (JSON: {name, address, phone, line, facebook, website})
  `manufacturer_info` LONGTEXT DEFAULT NULL CHECK (json_valid(`manufacturer_info`) OR `manufacturer_info` IS NULL),

  -- D. ข้อมูลกฎหมาย/วันที่
  `fda_number` VARCHAR(100) DEFAULT NULL,
  `mfg_date` DATE DEFAULT NULL,
  `exp_date` DATE DEFAULT NULL,
  `lot_number` VARCHAR(50) DEFAULT NULL,

  -- E. ตราสัญลักษณ์รับรอง (JSON Array เช่น ["fda","halal","otop"])
  `certifications` LONGTEXT DEFAULT NULL CHECK (json_valid(`certifications`) OR `certifications` IS NULL),

  -- F. QR Code & Barcode
  `qr_code_value` VARCHAR(500) DEFAULT NULL,
  `barcode_value` VARCHAR(50) DEFAULT NULL,
  `show_qr` TINYINT(1) DEFAULT 0,
  `show_barcode` TINYINT(1) DEFAULT 0,

  -- G. Layout & Background
  `layout_type` VARCHAR(50) DEFAULT 'centered_classic',
  `bg_mode` ENUM('solid','preset','dalle') DEFAULT 'solid',
  `bg_color` VARCHAR(20) DEFAULT '#FFFFFF',
  `bg_preset_id` INT(11) DEFAULT NULL,
  `bg_image_url` VARCHAR(500) DEFAULT NULL,
  `bg_opacity` DECIMAL(3,2) DEFAULT 1.00,

  -- H. Output / Meta
  `final_label_url` VARCHAR(500) DEFAULT NULL,
  `is_favorite` TINYINT(1) DEFAULT 0,
  `created_at` TIMESTAMP NULL DEFAULT current_timestamp(),
  `updated_at` TIMESTAMP NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),

  PRIMARY KEY (`label_id`),
  KEY `idx_label_project` (`project_id`),
  CONSTRAINT `fk_label_project` FOREIGN KEY (`project_id`)
    REFERENCES `project` (`project_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


-- --------------------------------------------------------------------
-- 2) ตาราง bg_preset — เก็บ background สำเร็จรูปให้ผู้ใช้เลือก (ฟรี ไม่หักเครดิต)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `bg_preset`;

CREATE TABLE `bg_preset` (
  `bg_preset_id` INT(11) NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `style` VARCHAR(50) DEFAULT NULL,
  `image_url` VARCHAR(500) NOT NULL,
  `thumbnail_url` VARCHAR(500) DEFAULT NULL,
  `is_active` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`bg_preset_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- เพิ่ม Foreign Key bg_preset_id → bg_preset(bg_preset_id) ใน label_design
ALTER TABLE `label_design`
  ADD CONSTRAINT `fk_label_bg_preset` FOREIGN KEY (`bg_preset_id`)
    REFERENCES `bg_preset` (`bg_preset_id`) ON DELETE SET NULL;


-- --------------------------------------------------------------------
-- 3) Seed Data — 8 background presets ตัวอย่าง
--    ใช้ Lorem Picsum (https://picsum.photos) เพราะ stable เป็น placeholder
--    ภายหลัง admin upload ระบบจริงจะแทนที่ด้วยรูปจาก /uploads/bg-presets/
-- --------------------------------------------------------------------
INSERT INTO `bg_preset` (`name`, `style`, `image_url`, `thumbnail_url`) VALUES
('Soft Minimal',      'minimal',          'https://picsum.photos/seed/punthai_bg_01/1024/1024', 'https://picsum.photos/seed/punthai_bg_01/256/256'),
('Thai Lai Kanok',    'thai_traditional', 'https://picsum.photos/seed/punthai_bg_02/1024/1024', 'https://picsum.photos/seed/punthai_bg_02/256/256'),
('Watercolor Bloom',  'watercolor',       'https://picsum.photos/seed/punthai_bg_03/1024/1024', 'https://picsum.photos/seed/punthai_bg_03/256/256'),
('Pastel Wash',       'watercolor',       'https://picsum.photos/seed/punthai_bg_04/1024/1024', 'https://picsum.photos/seed/punthai_bg_04/256/256'),
('Leaves Pattern',    'nature',           'https://picsum.photos/seed/punthai_bg_05/1024/1024', 'https://picsum.photos/seed/punthai_bg_05/256/256'),
('Geometric Lines',   'geometric',        'https://picsum.photos/seed/punthai_bg_06/1024/1024', 'https://picsum.photos/seed/punthai_bg_06/256/256'),
('Vintage Paper',     'vintage',          'https://picsum.photos/seed/punthai_bg_07/1024/1024', 'https://picsum.photos/seed/punthai_bg_07/256/256'),
('Cream Linen',       'minimal',          'https://picsum.photos/seed/punthai_bg_08/1024/1024', 'https://picsum.photos/seed/punthai_bg_08/256/256');

-- ====================================================================
-- จบสคริปต์ — ตรวจสอบด้วย:
--   SELECT * FROM label_design;
--   SELECT * FROM bg_preset;
-- ====================================================================
