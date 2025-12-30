/*
 * PHTS System - Request & Workflow System Tables Initialization
 *
 * This file creates the database tables for Part 2: Request & Workflow System
 * Implements a 5-step approval workflow for PTS requests with audit logging and file attachments.
 *
 * Workflow Steps:
 * - Step 1: Head of Department (Individual approval)
 * - Step 2: PTS Officer (Document verification)
 * - Step 3: Head of HR (Rules verification)
 * - Step 4: Director (Batch approval support)
 * - Step 5: Finance Head (Final check)
 * - Step 6: Completed (Status = APPROVED)
 *
 * Tables Created:
 * 1. pts_requests - Main request header table
 * 2. pts_request_actions - Approval action audit log
 * 3. pts_attachments - File attachments for requests
 *
 * Date: 2025-12-30
 */

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================
-- Table: pts_requests
-- Description: Main table storing PTS request headers
-- Purpose: Tracks request lifecycle, current workflow step, and submission data
-- ============================================
CREATE TABLE IF NOT EXISTS `pts_requests` (
  `request_id` INT NOT NULL AUTO_INCREMENT COMMENT 'Primary key for requests table',
  `user_id` INT NOT NULL COMMENT 'Foreign key to users.user_id - the requester',
  `request_type` ENUM(
    'NEW_ENTRY',
    'EDIT_INFO',
    'RATE_CHANGE'
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Type of PTS request being submitted',
  `current_step` INT NOT NULL DEFAULT 1 COMMENT 'Current workflow step (1-5), 6 when completed',
  `status` ENUM(
    'DRAFT',
    'PENDING',
    'APPROVED',
    'REJECTED',
    'CANCELLED',
    'RETURNED'
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT' COMMENT 'Current status of the request',
  `submission_data` JSON NULL COMMENT 'Snapshot of form data at submission (position, salary, requested_rate, work_attributes)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Timestamp when request was created',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Timestamp when request was last updated',
  PRIMARY KEY (`request_id`) USING BTREE,
  INDEX `idx_pts_requests_user_id` (`user_id` ASC) USING BTREE COMMENT 'Index for querying requests by user',
  INDEX `idx_pts_requests_status_step` (`status` ASC, `current_step` ASC) USING BTREE COMMENT 'Composite index for filtering by status and current step',
  INDEX `idx_pts_requests_created_at` (`created_at` DESC) USING BTREE COMMENT 'Index for sorting by creation date',
  CONSTRAINT `fk_pts_requests_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB
  AUTO_INCREMENT = 1
  CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'PTS request header table - stores main request information and workflow state'
  ROW_FORMAT = Dynamic;

-- ============================================
-- Table: pts_request_actions
-- Description: Audit log for all actions taken on requests
-- Purpose: Maintains complete approval history for compliance and traceability
-- ============================================
CREATE TABLE IF NOT EXISTS `pts_request_actions` (
  `action_id` INT NOT NULL AUTO_INCREMENT COMMENT 'Primary key for actions table',
  `request_id` INT NOT NULL COMMENT 'Foreign key to pts_requests.request_id',
  `actor_id` INT NOT NULL COMMENT 'Foreign key to users.user_id - who performed this action',
  `step_no` INT NOT NULL COMMENT 'Workflow step number when this action occurred (1-5)',
  `action` ENUM(
    'SUBMIT',
    'APPROVE',
    'REJECT',
    'RETURN'
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Type of action performed',
  `comment` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL COMMENT 'Optional comment/note from the actor (supports Thai text)',
  `signature_snapshot` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL COMMENT 'File path to digital signature image if captured',
  `action_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Timestamp when action was performed',
  PRIMARY KEY (`action_id`) USING BTREE,
  INDEX `idx_pts_request_actions_request_id` (`request_id` ASC) USING BTREE COMMENT 'Index for querying actions by request',
  INDEX `idx_pts_request_actions_actor_id` (`actor_id` ASC) USING BTREE COMMENT 'Index for querying actions by actor',
  INDEX `idx_pts_request_actions_action_date` (`action_date` DESC) USING BTREE COMMENT 'Index for sorting by action date',
  CONSTRAINT `fk_pts_request_actions_request_id` FOREIGN KEY (`request_id`) REFERENCES `pts_requests` (`request_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_pts_request_actions_actor_id` FOREIGN KEY (`actor_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB
  AUTO_INCREMENT = 1
  CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Approval action audit log - immutable history of all request actions'
  ROW_FORMAT = Dynamic;

-- ============================================
-- Table: pts_attachments
-- Description: File attachments linked to requests
-- Purpose: Stores metadata for uploaded documents (licenses, diplomas, orders)
-- ============================================
CREATE TABLE IF NOT EXISTS `pts_attachments` (
  `attachment_id` INT NOT NULL AUTO_INCREMENT COMMENT 'Primary key for attachments table',
  `request_id` INT NOT NULL COMMENT 'Foreign key to pts_requests.request_id',
  `file_type` ENUM(
    'LICENSE',
    'DIPLOMA',
    'ORDER_DOC',
    'OTHER'
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Category of the uploaded file',
  `file_path` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Relative path to the file in storage (e.g., uploads/documents/...)',
  `original_filename` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Original filename as uploaded by user (supports Thai characters)',
  `file_size` INT NOT NULL COMMENT 'File size in bytes (max 5MB = 5242880 bytes)',
  `mime_type` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'MIME type of the file (e.g., application/pdf, image/jpeg)',
  `uploaded_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Timestamp when file was uploaded',
  PRIMARY KEY (`attachment_id`) USING BTREE,
  INDEX `idx_pts_attachments_request_id` (`request_id` ASC) USING BTREE COMMENT 'Index for querying attachments by request',
  INDEX `idx_pts_attachments_file_type` (`file_type` ASC) USING BTREE COMMENT 'Index for filtering by file type',
  CONSTRAINT `fk_pts_attachments_request_id` FOREIGN KEY (`request_id`) REFERENCES `pts_requests` (`request_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB
  AUTO_INCREMENT = 1
  CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'File attachment metadata table - stores information about uploaded documents'
  ROW_FORMAT = Dynamic;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================
-- Tables created successfully
-- Next step: Run migrate_requests.ts to execute this schema
-- ============================================

/*
 * Foreign Key Relationships Summary:
 * ===================================
 *
 * pts_requests
 *   -> users.user_id (ON DELETE RESTRICT)
 *      Prevents deletion of users who have submitted requests
 *
 * pts_request_actions
 *   -> pts_requests.request_id (ON DELETE CASCADE)
 *      Automatically deletes action history when request is deleted
 *   -> users.user_id (ON DELETE RESTRICT)
 *      Preserves audit trail even if user account changes
 *
 * pts_attachments
 *   -> pts_requests.request_id (ON DELETE CASCADE)
 *      Automatically deletes attachments when request is deleted
 *
 * Workflow State Machine:
 * =======================
 *
 * Status: DRAFT
 *   - User is still editing the request
 *   - current_step = 1
 *   - User can edit/delete freely
 *
 * Status: PENDING
 *   - Request has been submitted and is awaiting approval
 *   - current_step indicates which approver should act (1-5)
 *   - Moves forward when approved, stays when rejected
 *
 * Status: RETURNED
 *   - Approver sent back for revisions
 *   - User can edit and re-submit
 *
 * Status: REJECTED
 *   - Request was denied by an approver
 *   - Terminal state (cannot be edited)
 *
 * Status: CANCELLED
 *   - User cancelled their own request
 *   - Terminal state
 *
 * Status: APPROVED
 *   - All 5 steps completed successfully
 *   - current_step = 6
 *   - Triggers master data update (Part 3)
 *   - Terminal state
 *
 * Request Types:
 * ==============
 *
 * NEW_ENTRY
 *   - New employee entering PTS system
 *   - Requires: LICENSE, DIPLOMA, ORDER_DOC
 *
 * EDIT_INFO
 *   - Update existing PTS information
 *   - Requires: Supporting documents as needed
 *
 * RATE_CHANGE
 *   - Request to change PTS rate
 *   - Requires: Justification documents (ORDER_DOC)
 */
