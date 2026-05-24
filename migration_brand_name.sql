-- =====================================================
-- Migration: เพิ่ม column brand_name ใน table project
-- เพื่อให้ผู้ใช้สามารถพิมพ์ชื่อแบรนด์เอง หรือแก้ไขชื่อที่ AI สร้างให้
-- =====================================================

-- 1. เพิ่ม column brand_name ใน project table
ALTER TABLE `project` ADD COLUMN `brand_name` VARCHAR(255) DEFAULT NULL AFTER `project_name`;

-- 2. Copy ชื่อที่เคย selected ไว้แล้วมาใส่ column ใหม่ (ให้ข้อมูลเก่ายังใช้ได้)
UPDATE `project` p
JOIN `name_concept` nc ON p.name_concept_id = nc.concept_id
SET p.brand_name = nc.brand_name
WHERE p.name_concept_id IS NOT NULL;
