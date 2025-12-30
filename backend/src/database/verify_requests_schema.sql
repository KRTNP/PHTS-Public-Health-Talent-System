/*
 * PHTS System - Request & Workflow Schema Verification Queries
 *
 * This file contains SQL queries to verify that the pts_requests,
 * pts_request_actions, and pts_attachments tables were created correctly.
 *
 * Usage: Execute these queries after running migrate_requests.ts
 *
 * Date: 2025-12-30
 */

-- ============================================
-- 1. Verify All Tables Exist
-- ============================================
SELECT
  TABLE_NAME,
  TABLE_ROWS,
  AUTO_INCREMENT,
  TABLE_COLLATION,
  ENGINE,
  TABLE_COMMENT
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'phts_system'
  AND TABLE_NAME IN ('pts_requests', 'pts_request_actions', 'pts_attachments')
ORDER BY TABLE_NAME;

-- ============================================
-- 2. Verify Foreign Key Relationships
-- ============================================
SELECT
  TABLE_NAME,
  CONSTRAINT_NAME,
  COLUMN_NAME,
  REFERENCED_TABLE_NAME,
  REFERENCED_COLUMN_NAME,
  UPDATE_RULE,
  DELETE_RULE
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'phts_system'
  AND REFERENCED_TABLE_NAME IS NOT NULL
  AND TABLE_NAME LIKE 'pts_%'
ORDER BY TABLE_NAME, CONSTRAINT_NAME;

-- Expected Results:
-- pts_requests: 1 FK to users.user_id (DELETE RESTRICT)
-- pts_request_actions: 2 FKs (request_id CASCADE, actor_id RESTRICT)
-- pts_attachments: 1 FK to pts_requests.request_id (DELETE CASCADE)

-- ============================================
-- 3. Verify Indexes
-- ============================================
SELECT
  TABLE_NAME,
  INDEX_NAME,
  GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS COLUMNS,
  CASE WHEN NON_UNIQUE = 0 THEN 'UNIQUE' ELSE 'NON-UNIQUE' END AS UNIQUENESS,
  INDEX_TYPE
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'phts_system'
  AND TABLE_NAME IN ('pts_requests', 'pts_request_actions', 'pts_attachments')
GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE, INDEX_TYPE
ORDER BY TABLE_NAME, INDEX_NAME;

-- Expected Indexes:
-- pts_requests: PRIMARY, idx_pts_requests_user_id, idx_pts_requests_status_step, idx_pts_requests_created_at
-- pts_request_actions: PRIMARY, idx_pts_request_actions_request_id, idx_pts_request_actions_actor_id, idx_pts_request_actions_action_date
-- pts_attachments: PRIMARY, idx_pts_attachments_request_id, idx_pts_attachments_file_type

-- ============================================
-- 4. Verify pts_requests Columns
-- ============================================
SELECT
  COLUMN_NAME,
  DATA_TYPE,
  COLUMN_TYPE,
  IS_NULLABLE,
  COLUMN_DEFAULT,
  COLUMN_COMMENT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'phts_system'
  AND TABLE_NAME = 'pts_requests'
ORDER BY ORDINAL_POSITION;

-- Expected: 8 columns
-- request_id, user_id, request_type, current_step, status, submission_data, created_at, updated_at

-- ============================================
-- 5. Verify pts_request_actions Columns
-- ============================================
SELECT
  COLUMN_NAME,
  DATA_TYPE,
  COLUMN_TYPE,
  IS_NULLABLE,
  COLUMN_DEFAULT,
  COLUMN_COMMENT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'phts_system'
  AND TABLE_NAME = 'pts_request_actions'
ORDER BY ORDINAL_POSITION;

-- Expected: 8 columns
-- action_id, request_id, actor_id, step_no, action, comment, signature_snapshot, action_date

-- ============================================
-- 6. Verify pts_attachments Columns
-- ============================================
SELECT
  COLUMN_NAME,
  DATA_TYPE,
  COLUMN_TYPE,
  IS_NULLABLE,
  COLUMN_DEFAULT,
  COLUMN_COMMENT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'phts_system'
  AND TABLE_NAME = 'pts_attachments'
ORDER BY ORDINAL_POSITION;

-- Expected: 8 columns
-- attachment_id, request_id, file_type, file_path, original_filename, file_size, mime_type, uploaded_at

-- ============================================
-- 7. Verify ENUM Values for request_type
-- ============================================
SELECT COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'phts_system'
  AND TABLE_NAME = 'pts_requests'
  AND COLUMN_NAME = 'request_type';

-- Expected: enum('NEW_ENTRY','EDIT_INFO','RATE_CHANGE')

-- ============================================
-- 8. Verify ENUM Values for status
-- ============================================
SELECT COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'phts_system'
  AND TABLE_NAME = 'pts_requests'
  AND COLUMN_NAME = 'status';

-- Expected: enum('DRAFT','PENDING','APPROVED','REJECTED','CANCELLED','RETURNED')

-- ============================================
-- 9. Verify ENUM Values for action
-- ============================================
SELECT COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'phts_system'
  AND TABLE_NAME = 'pts_request_actions'
  AND COLUMN_NAME = 'action';

-- Expected: enum('SUBMIT','APPROVE','REJECT','RETURN')

-- ============================================
-- 10. Verify ENUM Values for file_type
-- ============================================
SELECT COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'phts_system'
  AND TABLE_NAME = 'pts_attachments'
  AND COLUMN_NAME = 'file_type';

-- Expected: enum('LICENSE','DIPLOMA','ORDER_DOC','OTHER')

-- ============================================
-- 11. Check JSON Column Support
-- ============================================
SELECT
  COLUMN_NAME,
  DATA_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'phts_system'
  AND TABLE_NAME = 'pts_requests'
  AND COLUMN_NAME = 'submission_data';

-- Expected: DATA_TYPE = 'json'

-- ============================================
-- 12. Verify UTF8MB4 Encoding
-- ============================================
SELECT
  TABLE_NAME,
  CCSA.CHARACTER_SET_NAME,
  TABLE_COLLATION
FROM information_schema.TABLES T
LEFT JOIN information_schema.COLLATION_CHARACTER_SET_APPLICABILITY CCSA
  ON T.TABLE_COLLATION = CCSA.COLLATION_NAME
WHERE TABLE_SCHEMA = 'phts_system'
  AND TABLE_NAME IN ('pts_requests', 'pts_request_actions', 'pts_attachments');

-- Expected: CHARACTER_SET_NAME = 'utf8mb4', COLLATION = 'utf8mb4_unicode_ci'

-- ============================================
-- 13. Test INSERT on pts_requests (Dry Run)
-- ============================================
-- NOTE: Uncomment to test if you have a user with user_id = 1
/*
START TRANSACTION;

INSERT INTO pts_requests (user_id, request_type, status, current_step, submission_data)
VALUES (
  1,
  'NEW_ENTRY',
  'DRAFT',
  1,
  JSON_OBJECT(
    'position', 'แพทย์ทั่วไป',
    'salary', 45000,
    'requested_rate', 10000
  )
);

SELECT * FROM pts_requests WHERE request_id = LAST_INSERT_ID();

ROLLBACK; -- Don't actually commit
*/

-- ============================================
-- 14. Test Foreign Key Constraint (Should Fail)
-- ============================================
-- NOTE: Uncomment to test FK constraint (this should fail)
/*
START TRANSACTION;

-- This should fail because user_id = 99999 doesn't exist
INSERT INTO pts_requests (user_id, request_type, status)
VALUES (99999, 'NEW_ENTRY', 'DRAFT');

ROLLBACK;
*/

-- ============================================
-- 15. Summary View of All Tables
-- ============================================
SELECT
  'pts_requests' AS table_name,
  COUNT(*) AS total_records,
  COUNT(CASE WHEN status = 'DRAFT' THEN 1 END) AS draft_count,
  COUNT(CASE WHEN status = 'PENDING' THEN 1 END) AS pending_count,
  COUNT(CASE WHEN status = 'APPROVED' THEN 1 END) AS approved_count
FROM pts_requests
UNION ALL
SELECT
  'pts_request_actions',
  COUNT(*),
  COUNT(CASE WHEN action = 'SUBMIT' THEN 1 END),
  COUNT(CASE WHEN action = 'APPROVE' THEN 1 END),
  COUNT(CASE WHEN action = 'REJECT' THEN 1 END)
FROM pts_request_actions
UNION ALL
SELECT
  'pts_attachments',
  COUNT(*),
  COUNT(CASE WHEN file_type = 'LICENSE' THEN 1 END),
  COUNT(CASE WHEN file_type = 'DIPLOMA' THEN 1 END),
  COUNT(CASE WHEN file_type = 'ORDER_DOC' THEN 1 END)
FROM pts_attachments;

-- ============================================
-- Verification Complete
-- ============================================
-- If all queries return expected results, the schema is correctly implemented.
