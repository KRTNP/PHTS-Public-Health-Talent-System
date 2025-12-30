# Request & Workflow System Migration Guide

## Overview

This guide covers the database migration for Part 2: Request & Workflow System of the PHTS project. The migration creates three core tables that implement a 5-step approval workflow for PTS requests.

## Files Created

### 1. SQL Schema File
**Location:** `backend/src/database/init_requests.sql`
- Size: 9.0 KB
- Contains: CREATE TABLE statements for all three tables
- Encoding: UTF8MB4 with utf8mb4_unicode_ci collation
- Features: Idempotent (uses IF NOT EXISTS)

### 2. Migration Script
**Location:** `backend/src/scripts/migrate_requests.ts`
- Size: 9.4 KB
- Purpose: Executes the SQL schema against the database
- Features: Prerequisite checking, error handling, verification

## Tables Created

### Table 1: `pts_requests` (Request Headers)

**Purpose:** Stores the main request information and tracks workflow state

**Columns:**
- `request_id` - Primary Key (INT, AUTO_INCREMENT)
- `user_id` - Foreign Key to users.user_id (INT, NOT NULL)
- `request_type` - ENUM('NEW_ENTRY', 'EDIT_INFO', 'RATE_CHANGE')
- `current_step` - INT (1-5 during workflow, 6 when completed)
- `status` - ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'RETURNED')
- `submission_data` - JSON (snapshot of form data)
- `created_at` - DATETIME (DEFAULT CURRENT_TIMESTAMP)
- `updated_at` - DATETIME (DEFAULT CURRENT_TIMESTAMP ON UPDATE)

**Indexes:**
- PRIMARY KEY on `request_id`
- INDEX on `user_id`
- COMPOSITE INDEX on `(status, current_step)`
- INDEX on `created_at` DESC

**Foreign Keys:**
- `user_id` -> `users.user_id` (ON DELETE RESTRICT, ON UPDATE CASCADE)

### Table 2: `pts_request_actions` (Approval Audit Log)

**Purpose:** Maintains immutable history of all actions taken on requests

**Columns:**
- `action_id` - Primary Key (INT, AUTO_INCREMENT)
- `request_id` - Foreign Key to pts_requests.request_id (INT, NOT NULL)
- `actor_id` - Foreign Key to users.user_id (INT, NOT NULL)
- `step_no` - INT (which workflow step this action occurred at)
- `action` - ENUM('SUBMIT', 'APPROVE', 'REJECT', 'RETURN')
- `comment` - TEXT (supports Thai characters, nullable)
- `signature_snapshot` - VARCHAR(255) (path to signature image, nullable)
- `action_date` - DATETIME (DEFAULT CURRENT_TIMESTAMP)

**Indexes:**
- PRIMARY KEY on `action_id`
- INDEX on `request_id`
- INDEX on `actor_id`
- INDEX on `action_date` DESC

**Foreign Keys:**
- `request_id` -> `pts_requests.request_id` (ON DELETE CASCADE, ON UPDATE CASCADE)
- `actor_id` -> `users.user_id` (ON DELETE RESTRICT, ON UPDATE CASCADE)

### Table 3: `pts_attachments` (File Metadata)

**Purpose:** Stores metadata for uploaded documents linked to requests

**Columns:**
- `attachment_id` - Primary Key (INT, AUTO_INCREMENT)
- `request_id` - Foreign Key to pts_requests.request_id (INT, NOT NULL)
- `file_type` - ENUM('LICENSE', 'DIPLOMA', 'ORDER_DOC', 'OTHER')
- `file_path` - VARCHAR(255) (relative path in storage)
- `original_filename` - VARCHAR(255) (supports Thai characters)
- `file_size` - INT (size in bytes, max 5MB = 5242880)
- `mime_type` - VARCHAR(100) (e.g., application/pdf, image/jpeg)
- `uploaded_at` - DATETIME (DEFAULT CURRENT_TIMESTAMP)

**Indexes:**
- PRIMARY KEY on `attachment_id`
- INDEX on `request_id`
- INDEX on `file_type`

**Foreign Keys:**
- `request_id` -> `pts_requests.request_id` (ON DELETE CASCADE, ON UPDATE CASCADE)

## Workflow State Machine

### Request Statuses

1. **DRAFT**
   - User is editing the request
   - Can be modified/deleted by owner
   - current_step = 1

2. **PENDING**
   - Submitted and awaiting approval
   - current_step indicates which approver should act (1-5)
   - Moves forward when approved

3. **RETURNED**
   - Sent back for revisions by an approver
   - User can edit and re-submit
   - current_step remains at the step that returned it

4. **REJECTED**
   - Denied by an approver
   - Terminal state (cannot be edited)
   - Preserved for audit purposes

5. **CANCELLED**
   - User cancelled their own request
   - Terminal state

6. **APPROVED**
   - All 5 steps completed successfully
   - current_step = 6
   - Triggers master data update (Part 3)
   - Terminal state

### Workflow Steps

1. **Step 1: Head of Department**
   - Role: HEAD_DEPT
   - Action: Individual approval
   - Next: Step 2

2. **Step 2: PTS Officer**
   - Role: PTS_OFFICER
   - Action: Document verification
   - Next: Step 3

3. **Step 3: Head of HR**
   - Role: HEAD_HR
   - Action: Rules verification
   - Next: Step 4

4. **Step 4: Director**
   - Role: DIRECTOR
   - Action: Batch approval support
   - Next: Step 5

5. **Step 5: Finance Head**
   - Role: HEAD_FINANCE
   - Action: Final check
   - Next: Status = APPROVED, current_step = 6

## Running the Migration

### Prerequisites

1. Ensure the `users` table exists (run `init_users.sql` first if not)
2. Ensure database connection is configured in `.env`:
   ```env
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=phts_system
   ```

### Execute Migration

From the backend directory:

```bash
npx ts-node src/scripts/migrate_requests.ts
```

### Expected Output

```
========================================
PHTS Request & Workflow Tables Migration
========================================

Reading SQL initialization file...
Path: D:\phts-workspace\phts-project\backend\src\database\init_requests.sql

  ✓ SQL file loaded successfully

Connecting to database: phts_system@localhost...
  ✓ Database connection established successfully

Checking prerequisites...
  ✓ Prerequisite check passed: users table exists

Executing SQL migration script...

  ✓ SQL script executed successfully

Verifying table creation...

  ✓ Table 'pts_requests' exists
  ✓ Table 'pts_request_actions' exists
  ✓ Table 'pts_attachments' exists

========================================
Table Structure Summary
========================================

Table: pts_requests
  - Columns: 8
  - Foreign Keys: 1
  - Indexes: 4

Table: pts_request_actions
  - Columns: 8
  - Foreign Keys: 2
  - Indexes: 4

Table: pts_attachments
  - Columns: 8
  - Foreign Keys: 1
  - Indexes: 3

========================================
Migration Completed Successfully
========================================
```

## Verification Queries

### Verify All Tables Exist

```sql
SELECT TABLE_NAME, TABLE_ROWS, AUTO_INCREMENT
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'phts_system'
  AND TABLE_NAME IN ('pts_requests', 'pts_request_actions', 'pts_attachments')
ORDER BY TABLE_NAME;
```

### Verify Foreign Key Relationships

```sql
SELECT
  TABLE_NAME,
  CONSTRAINT_NAME,
  COLUMN_NAME,
  REFERENCED_TABLE_NAME,
  REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'phts_system'
  AND REFERENCED_TABLE_NAME IS NOT NULL
  AND TABLE_NAME LIKE 'pts_%'
ORDER BY TABLE_NAME, CONSTRAINT_NAME;
```

### Verify Indexes

```sql
SELECT
  TABLE_NAME,
  INDEX_NAME,
  GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS COLUMNS,
  NON_UNIQUE,
  INDEX_TYPE
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'phts_system'
  AND TABLE_NAME IN ('pts_requests', 'pts_request_actions', 'pts_attachments')
GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE, INDEX_TYPE
ORDER BY TABLE_NAME, INDEX_NAME;
```

### Verify Column Data Types and ENUMs

```sql
-- pts_requests columns
SELECT
  COLUMN_NAME,
  DATA_TYPE,
  COLUMN_TYPE,
  IS_NULLABLE,
  COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'phts_system'
  AND TABLE_NAME = 'pts_requests'
ORDER BY ORDINAL_POSITION;

-- pts_request_actions columns
SELECT
  COLUMN_NAME,
  DATA_TYPE,
  COLUMN_TYPE,
  IS_NULLABLE,
  COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'phts_system'
  AND TABLE_NAME = 'pts_request_actions'
ORDER BY ORDINAL_POSITION;

-- pts_attachments columns
SELECT
  COLUMN_NAME,
  DATA_TYPE,
  COLUMN_TYPE,
  IS_NULLABLE,
  COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'phts_system'
  AND TABLE_NAME = 'pts_attachments'
ORDER BY ORDINAL_POSITION;
```

### Verify Character Set and Collation

```sql
SELECT
  TABLE_NAME,
  TABLE_COLLATION,
  ENGINE
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'phts_system'
  AND TABLE_NAME IN ('pts_requests', 'pts_request_actions', 'pts_attachments');
```

## Test Data Examples

### Example 1: Create a Draft Request

```sql
-- Insert a draft request
INSERT INTO pts_requests (user_id, request_type, status, current_step, submission_data)
VALUES (
  1,
  'NEW_ENTRY',
  'DRAFT',
  1,
  JSON_OBJECT(
    'position', 'แพทย์ทั่วไป',
    'salary', 45000,
    'requested_rate', 10000,
    'work_attributes', JSON_ARRAY('operation', 'planning')
  )
);
```

### Example 2: Submit Request (Log Initial Action)

```sql
-- Update request to PENDING
UPDATE pts_requests
SET status = 'PENDING'
WHERE request_id = 1;

-- Log the SUBMIT action
INSERT INTO pts_request_actions (request_id, actor_id, step_no, action, comment)
VALUES (
  1,
  1,
  1,
  'SUBMIT',
  'ขอเข้าร่วมระบบ PTS ครั้งแรก'
);
```

### Example 3: Add File Attachments

```sql
-- Add a license document
INSERT INTO pts_attachments (request_id, file_type, file_path, original_filename, file_size, mime_type)
VALUES (
  1,
  'LICENSE',
  'uploads/documents/2025/12/license_1234567890123.pdf',
  'ใบอนุญาตประกอบวิชาชีพ.pdf',
  1024576,
  'application/pdf'
);

-- Add a diploma
INSERT INTO pts_attachments (request_id, file_type, file_path, original_filename, file_size, mime_type)
VALUES (
  1,
  'DIPLOMA',
  'uploads/documents/2025/12/diploma_1234567890123.pdf',
  'ปริญญาบัตร.pdf',
  856432,
  'application/pdf'
);
```

### Example 4: Approve at Step 1

```sql
-- Log approval action
INSERT INTO pts_request_actions (request_id, actor_id, step_no, action, comment)
VALUES (
  1,
  5, -- HEAD_DEPT user_id
  1,
  'APPROVE',
  'อนุมัติเรียบร้อย'
);

-- Move request to next step
UPDATE pts_requests
SET current_step = 2
WHERE request_id = 1;
```

### Example 5: Query Pending Requests for Specific Step

```sql
-- Get all pending requests at Step 2 (for PTS_OFFICER)
SELECT
  r.request_id,
  r.request_type,
  r.current_step,
  r.status,
  r.created_at,
  u.citizen_id,
  r.submission_data->>'$.position' AS position,
  r.submission_data->>'$.requested_rate' AS requested_rate
FROM pts_requests r
INNER JOIN users u ON r.user_id = u.user_id
WHERE r.status = 'PENDING'
  AND r.current_step = 2
ORDER BY r.created_at ASC;
```

### Example 6: Get Complete Request History

```sql
-- Get full audit trail for a request
SELECT
  a.action_id,
  a.step_no,
  a.action,
  a.comment,
  a.action_date,
  u.citizen_id AS actor_citizen_id,
  CONCAT(e.first_name, ' ', e.last_name) AS actor_name
FROM pts_request_actions a
INNER JOIN users u ON a.actor_id = u.user_id
LEFT JOIN employees e ON u.citizen_id = e.citizen_id
WHERE a.request_id = 1
ORDER BY a.action_date ASC;
```

## Rollback Procedure

If you need to remove these tables:

```sql
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS pts_attachments;
DROP TABLE IF EXISTS pts_request_actions;
DROP TABLE IF EXISTS pts_requests;

SET FOREIGN_KEY_CHECKS = 1;
```

**WARNING:** This will permanently delete all request data, action history, and attachment metadata. Actual uploaded files in `uploads/documents/` will remain on disk and must be manually cleaned if needed.

## Next Steps

1. **Backend API Development:**
   - Create request submission endpoints
   - Implement workflow state transitions
   - Add file upload middleware (multer)
   - Create approval/rejection endpoints
   - Implement batch approval for Director role

2. **Frontend Development:**
   - Build request form UI (`/dashboard/user/request`)
   - Create approval dashboards for each role
   - Implement file upload components
   - Add request status tracking views

3. **Integration:**
   - Connect to HRMS employees view for auto-fill
   - Implement master data update hook (when status = APPROVED)
   - Add email notifications for workflow events

## Support

For issues or questions:
- Check `init_requests.sql` for detailed table comments
- Review `migrate_requests.ts` for migration logic
- Refer to `doc_2_requirements.md` for business requirements

---

**Database Specialist (Sub-Agent 1)**
Date: 2025-12-30
PHTS Project - Part 2: Request & Workflow System
