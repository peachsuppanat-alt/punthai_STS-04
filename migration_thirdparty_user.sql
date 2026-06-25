-- =============================================================
-- Migration: ผูก Third Party (โรงพิมพ์) เข้ากับ user_profile
-- เพื่อให้โรงพิมพ์มี user_id จริง ใช้งานได้ทุกฟีเจอร์เหมือน user ทั่วไป
-- + เพิ่มฟิลด์ที่ตั้ง/ช่องทางติดต่อใน third_party (feature 5)
-- รันครั้งเดียวกับฐานข้อมูล punthai_db
-- =============================================================

-- 1) ประเภทบัญชีใน user_profile : 'user' | 'printshop'
ALTER TABLE `user_profile`
  ADD COLUMN IF NOT EXISTS `account_type` VARCHAR(20) NOT NULL DEFAULT 'user';

-- 2) ลิงก์ third_party -> user_profile + ฟิลด์ที่ตั้ง/ติดต่อ
ALTER TABLE `third_party`
  ADD COLUMN IF NOT EXISTS `user_id`    INT NULL,
  ADD COLUMN IF NOT EXISTS `address`    TEXT NULL,
  ADD COLUMN IF NOT EXISTS `map_url`    TEXT NULL,
  ADD COLUMN IF NOT EXISTS `line_id`    VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS `facebook`   VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS `website`    VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS `about`      TEXT NULL,
  ADD COLUMN IF NOT EXISTS `open_hours` VARCHAR(255) NULL;

-- FK (แยก statement เพราะ ADD CONSTRAINT ไม่รองรับ IF NOT EXISTS)
-- ถ้ารันซ้ำแล้ว error duplicate ให้ข้าม statement นี้ได้
ALTER TABLE `third_party`
  ADD CONSTRAINT `fk_tp_user` FOREIGN KEY (`user_id`)
  REFERENCES `user_profile`(`user_id`) ON DELETE CASCADE;

-- 3) Backfill ข้อมูลเดิม
-- 3.1 โรงพิมพ์ที่ email ตรงกับ user_profile อยู่แล้ว -> ลิงก์ user_id เดิม
UPDATE `third_party` tp
  JOIN `user_profile` up ON tp.`email` = up.`email`
  SET tp.`user_id` = up.`user_id`
  WHERE tp.`user_id` IS NULL;

-- 3.2 โรงพิมพ์ที่ยังไม่มี user_profile -> สร้าง user_profile ใหม่ (account_type='printshop')
INSERT INTO `user_profile`
  (`user_name`, `email`, `password`, `image_profile`, `subscription_status`, `account_type`)
SELECT tp.`third_party_name`, tp.`email`, tp.`password`, tp.`image_profile`, 'STANDARD', 'printshop'
FROM `third_party` tp
WHERE tp.`user_id` IS NULL;

-- 3.3 ลิงก์ user_id ของแถวที่เพิ่งสร้าง
UPDATE `third_party` tp
  JOIN `user_profile` up ON tp.`email` = up.`email`
  SET tp.`user_id` = up.`user_id`
  WHERE tp.`user_id` IS NULL;

-- 3.4 ตั้ง account_type = 'printshop' ให้ทุก user_profile ที่ลิงก์กับโรงพิมพ์
UPDATE `user_profile` up
  JOIN `third_party` tp ON tp.`user_id` = up.`user_id`
  SET up.`account_type` = 'printshop';
