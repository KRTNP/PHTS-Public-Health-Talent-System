-- ================================================================================
-- Phase 7: User Email Support (placeholder for SMTP-based notifications)
-- Run: mysql -h 127.0.0.1 -u root -p<password> phts_system < phase7_email_user.sql
-- ================================================================================

ALTER TABLE users
ADD COLUMN email VARCHAR(255) NULL DEFAULT NULL AFTER citizen_id;
