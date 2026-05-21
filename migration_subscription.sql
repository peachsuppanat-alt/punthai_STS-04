-- Migration: Subscription & Payment System
-- Date: 2026-05-20

-- 1. สร้างตาราง generation_usage สำหรับติดตามจำนวนการสร้างรูป AI
CREATE TABLE IF NOT EXISTS generation_usage (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  feature VARCHAR(50) NOT NULL COMMENT 'logo | content_online | label_bg | mockup_pattern | dieline_bg | package_mockup | mockup_ai',
  project_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_feature (user_id, feature),
  INDEX idx_user_created (user_id, created_at),
  FOREIGN KEY (user_id) REFERENCES user_profile(user_id) ON DELETE CASCADE
);

-- 2. เพิ่ม columns ใน user_profile สำหรับ Omise + subscription dates
ALTER TABLE user_profile
  ADD COLUMN IF NOT EXISTS omise_customer_id VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS subscription_start_date DATETIME NULL,
  ADD COLUMN IF NOT EXISTS subscription_end_date DATETIME NULL;

-- 3. เพิ่ม columns ใน payment_logs สำหรับ payment method tracking
ALTER TABLE payment_logs
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) NULL COMMENT 'credit_card | truemoney | internet_banking_scb | internet_banking_kbank | internet_banking_bbl | internet_banking_ktb | internet_banking_bay',
  ADD COLUMN IF NOT EXISTS omise_source_id VARCHAR(255) NULL;
