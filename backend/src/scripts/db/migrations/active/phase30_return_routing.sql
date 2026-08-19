-- Approval return routing metadata.
-- Check information_schema before each ALTER because the target MariaDB
-- version does not accept ADD COLUMN IF NOT EXISTS in this form.

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'req_submissions'
     AND COLUMN_NAME = 'return_target') = 0,
  'ALTER TABLE req_submissions ADD COLUMN return_target VARCHAR(20) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'req_submissions'
     AND COLUMN_NAME = 'return_from_step') = 0,
  'ALTER TABLE req_submissions ADD COLUMN return_from_step INT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'req_submissions'
     AND COLUMN_NAME = 'return_to_step') = 0,
  'ALTER TABLE req_submissions ADD COLUMN return_to_step INT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'req_submissions'
     AND INDEX_NAME = 'idx_req_submissions_return_queue') = 0,
  'CREATE INDEX idx_req_submissions_return_queue ON req_submissions (status, return_target, current_step)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'req_approvals'
     AND COLUMN_NAME = 'actor_role') = 0,
  'ALTER TABLE req_approvals ADD COLUMN actor_role VARCHAR(50) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'req_approvals'
     AND COLUMN_NAME = 'return_target') = 0,
  'ALTER TABLE req_approvals ADD COLUMN return_target VARCHAR(20) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'req_approvals'
     AND COLUMN_NAME = 'return_from_step') = 0,
  'ALTER TABLE req_approvals ADD COLUMN return_from_step INT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'req_approvals'
     AND COLUMN_NAME = 'return_to_step') = 0,
  'ALTER TABLE req_approvals ADD COLUMN return_to_step INT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
