-- ================================================================================
-- Phase 7: Attachment OCR (Typhoon OCR scaffolding)
-- Run: mysql -h 127.0.0.1 -u root -p<password> phts_system < phase7_ocr_attachment.sql
-- ================================================================================

CREATE TABLE IF NOT EXISTS pts_attachment_ocr (
  ocr_id INT AUTO_INCREMENT PRIMARY KEY,
  attachment_id INT NOT NULL,
  provider VARCHAR(50) NOT NULL DEFAULT 'TYPHOON',
  status ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
  extracted_json JSON NULL,
  confidence DECIMAL(5,2) NULL,
  error_message TEXT NULL,
  processed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_attachment_ocr (attachment_id),
  CONSTRAINT fk_attachment_ocr_attachment
    FOREIGN KEY (attachment_id) REFERENCES pts_attachments(attachment_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
