-- =============================================================
-- Migration: เพิ่มฟิลด์ให้ market_location รองรับข้อมูลที่ตั้งโรงพิมพ์
-- (ให้โรงพิมพ์โพสต์ลงหน้า Market Planning ได้)
-- รันครั้งเดียวกับฐานข้อมูล punthai_db
-- ใช้ location_name = ชื่อ, url_location = ลิงก์ Google Maps (มีอยู่แล้ว)
-- =============================================================

ALTER TABLE `market_location`
  ADD COLUMN IF NOT EXISTS `address`  TEXT NULL,
  ADD COLUMN IF NOT EXISTS `hours`    VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS `province` VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS `region`   VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS `phone`    VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS `tags`     LONGTEXT NULL,
  ADD COLUMN IF NOT EXISTS `lat`      DECIMAL(10,7) NULL,
  ADD COLUMN IF NOT EXISTS `lng`      DECIMAL(10,7) NULL;
