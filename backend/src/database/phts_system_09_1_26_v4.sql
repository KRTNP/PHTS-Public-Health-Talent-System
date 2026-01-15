/*
 Navicat Premium Dump SQL

 Source Server         : KRTN-MYSQL-Server
 Source Server Type    : MySQL
 Source Server Version : 90400 (9.4.0)
 Source Host           : localhost:3306
 Source Schema         : phts_system

 Target Server Type    : MySQL
 Target Server Version : 90400 (9.4.0)
 File Encoding         : 65001

 Date: 09/01/2026 07:09:39
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for pts_attachments
-- ----------------------------
DROP TABLE IF EXISTS `pts_attachments`;
CREATE TABLE `pts_attachments`  (
  `attachment_id` int NOT NULL AUTO_INCREMENT,
  `request_id` int NOT NULL,
  `file_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_path` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `uploaded_at` datetime NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`attachment_id`) USING BTREE,
  INDEX `idx_attach_req`(`request_id` ASC) USING BTREE,
  CONSTRAINT `fk_attach_req` FOREIGN KEY (`request_id`) REFERENCES `pts_requests` (`request_id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 2 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of pts_attachments
-- ----------------------------

-- ----------------------------
-- Table structure for pts_attachment_ocr
-- ----------------------------
DROP TABLE IF EXISTS `pts_attachment_ocr`;
CREATE TABLE `pts_attachment_ocr`  (
  `ocr_id` int NOT NULL AUTO_INCREMENT,
  `attachment_id` int NOT NULL,
  `provider` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'TYPHOON',
  `status` enum('PENDING','PROCESSING','COMPLETED','FAILED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `extracted_json` json NULL,
  `confidence` decimal(5,2) NULL,
  `error_message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `processed_at` datetime NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`ocr_id`) USING BTREE,
  UNIQUE INDEX `uk_attachment_ocr`(`attachment_id` ASC) USING BTREE,
  CONSTRAINT `fk_attachment_ocr_attachment` FOREIGN KEY (`attachment_id`) REFERENCES `pts_attachments` (`attachment_id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of pts_attachment_ocr
-- ----------------------------

-- ----------------------------
-- Table structure for pts_employee_eligibility
-- ----------------------------
DROP TABLE IF EXISTS `pts_employee_eligibility`;
CREATE TABLE `pts_employee_eligibility`  (
  `eligibility_id` int NOT NULL AUTO_INCREMENT,
  `citizen_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `master_rate_id` int NOT NULL,
  `request_id` int NULL DEFAULT NULL,
  `effective_date` date NOT NULL,
  `expiry_date` date NULL DEFAULT NULL,
  `reference_doc_no` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `is_active` tinyint(1) NULL DEFAULT 1,
  `created_at` datetime NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`eligibility_id`) USING BTREE,
  INDEX `idx_elig_user`(`citizen_id` ASC) USING BTREE,
  INDEX `idx_elig_active`(`is_active` ASC, `citizen_id` ASC) USING BTREE,
  INDEX `fk_elig_rate`(`master_rate_id` ASC) USING BTREE,
  CONSTRAINT `fk_elig_rate` FOREIGN KEY (`master_rate_id`) REFERENCES `pts_master_rates` (`rate_id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_elig_user` FOREIGN KEY (`citizen_id`) REFERENCES `users` (`citizen_id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of pts_employee_eligibility
-- ----------------------------

-- ----------------------------
-- Table structure for pts_employee_licenses
-- ----------------------------
DROP TABLE IF EXISTS `pts_employee_licenses`;
CREATE TABLE `pts_employee_licenses`  (
  `license_id` int NOT NULL AUTO_INCREMENT,
  `citizen_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `license_no` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `valid_from` date NOT NULL,
  `valid_until` date NOT NULL,
  `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT 'ACTIVE',
  `synced_at` datetime NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`license_id`) USING BTREE,
  INDEX `idx_license_user`(`citizen_id` ASC) USING BTREE,
  CONSTRAINT `fk_license_user` FOREIGN KEY (`citizen_id`) REFERENCES `users` (`citizen_id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 26822 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of pts_employee_licenses
-- ----------------------------

-- ----------------------------
-- Table structure for pts_employee_movements
-- ----------------------------
DROP TABLE IF EXISTS `pts_employee_movements`;
CREATE TABLE `pts_employee_movements`  (
  `movement_id` int NOT NULL AUTO_INCREMENT,
  `citizen_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `movement_type` enum('ENTRY','RESIGN','RETIRE','TRANSFER_OUT','STUDY','DEATH','OTHER') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `effective_date` date NOT NULL,
  `remark` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `synced_at` datetime NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` datetime NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`movement_id`) USING BTREE,
  INDEX `idx_move_user`(`citizen_id` ASC) USING BTREE,
  CONSTRAINT `fk_move_user` FOREIGN KEY (`citizen_id`) REFERENCES `users` (`citizen_id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 35037 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of pts_employee_movements
-- ----------------------------

-- ----------------------------
-- Table structure for pts_employees
-- ----------------------------
DROP TABLE IF EXISTS `pts_employees`;
CREATE TABLE `pts_employees`  (
  `citizen_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `first_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `last_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `sex` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `birth_date` date NULL DEFAULT NULL,
  `position_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `position_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `level` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `special_position` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `emp_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `department` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `sub_department` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `mission_group` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `specialist` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `expert` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `start_work_date` date NULL DEFAULT NULL COMMENT 'วันเริ่มงานในตำแหน่งปัจจุบัน',
  `first_entry_date` date NULL DEFAULT NULL,
  `original_status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `email` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `phone` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `last_synced_at` datetime NULL DEFAULT NULL,
  `updated_at` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`citizen_id`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of pts_employees
-- ----------------------------

-- ----------------------------
-- Table structure for pts_holidays
-- ----------------------------
DROP TABLE IF EXISTS `pts_holidays`;
CREATE TABLE `pts_holidays`  (
  `holiday_date` date NOT NULL,
  `holiday_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NULL DEFAULT 1,
  PRIMARY KEY (`holiday_date`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of pts_holidays
-- ----------------------------

-- ----------------------------
-- Table structure for pts_leave_quotas
-- ----------------------------
DROP TABLE IF EXISTS `pts_leave_quotas`;
CREATE TABLE `pts_leave_quotas`  (
  `quota_id` int NOT NULL AUTO_INCREMENT,
  `citizen_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `fiscal_year` int NOT NULL,
  `quota_vacation` decimal(5, 2) NOT NULL DEFAULT 10.00,
  `quota_personal` decimal(5, 2) NOT NULL DEFAULT 45.00,
  `quota_sick` decimal(5, 2) NOT NULL DEFAULT 60.00,
  `is_new_officer` tinyint(1) NULL DEFAULT 0,
  `updated_at` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`quota_id`) USING BTREE,
  UNIQUE INDEX `idx_quota_user_year`(`citizen_id` ASC, `fiscal_year` ASC) USING BTREE,
  CONSTRAINT `fk_quota_user` FOREIGN KEY (`citizen_id`) REFERENCES `users` (`citizen_id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 71892 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of pts_leave_quotas
-- ----------------------------

-- ----------------------------
-- Table structure for pts_leave_requests
-- ----------------------------
DROP TABLE IF EXISTS `pts_leave_requests`;
CREATE TABLE `pts_leave_requests`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `ref_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT 'ID อ้างอิงจากระบบเดิม',
  `citizen_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `leave_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `duration_days` decimal(5, 2) NULL DEFAULT 0.00,
  `fiscal_year` int NOT NULL,
  `remark` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT 'APPROVED' COMMENT 'สถานะการลา',
  `synced_at` datetime NULL DEFAULT CURRENT_TIMESTAMP,
  `manual_start_date` date NULL DEFAULT NULL COMMENT 'วันเริ่มที่แก้ไขโดย จนท.',
  `manual_end_date` date NULL DEFAULT NULL COMMENT 'วันสิ้นสุดที่แก้ไขโดย จนท.',
  `manual_duration_days` decimal(5, 2) NULL DEFAULT NULL COMMENT 'จำนวนวันที่แก้ไขโดย จนท.',
  `is_adjusted` tinyint(1) NULL DEFAULT 0 COMMENT '0=ใช้ค่าจาก Sync, 1=ใช้ค่าที่แก้ไข',
  `is_no_pay` tinyint(1) NULL DEFAULT 0 COMMENT '1=งดจ่ายเงินเดือน/No Pay',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `idx_leave_ref`(`ref_id` ASC) USING BTREE,
  INDEX `idx_leave_user_year`(`citizen_id` ASC, `fiscal_year` ASC) USING BTREE,
  CONSTRAINT `fk_leave_user` FOREIGN KEY (`citizen_id`) REFERENCES `users` (`citizen_id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 218488 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of pts_leave_requests
-- ----------------------------

-- ----------------------------
-- Table structure for pts_master_rates
-- ----------------------------
DROP TABLE IF EXISTS `pts_master_rates`;
CREATE TABLE `pts_master_rates`  (
  `rate_id` int NOT NULL AUTO_INCREMENT,
  `profession_code` enum('DOCTOR','DENTIST','PHARMACIST','NURSE','ALLIED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `group_no` int NOT NULL COMMENT 'กลุ่มที่ (1, 2, 3)',
  `item_no` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT 'ข้อที่ (เช่น 1, 2.1, 3.9)',
  `condition_desc` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `amount` decimal(10, 2) NOT NULL,
  `is_active` tinyint(1) NULL DEFAULT 1,
  `created_at` datetime NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`rate_id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 37 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of pts_master_rates
-- ----------------------------
INSERT INTO `pts_master_rates` VALUES (1, 'DOCTOR', 1, '1', 'ปฏิบัติหน้าที่หลักตามมาตรฐานกำหนดตำแหน่ง (ทั่วไป)', 5000.00, 1, '2026-01-04 17:34:37');
INSERT INTO `pts_master_rates` VALUES (2, 'DOCTOR', 2, '2.1', 'ได้รับวุฒิบัตร/อนุมัติบัตรฯ (สาขาทั่วไป)', 10000.00, 1, '2026-01-04 17:34:37');
INSERT INTO `pts_master_rates` VALUES (3, 'DOCTOR', 2, '2.2', 'ได้รับปริญญาโท หรือ ปริญญาเอก ทางการแพทย์/สาธารณสุข', 10000.00, 1, '2026-01-04 17:34:37');
INSERT INTO `pts_master_rates` VALUES (4, 'DOCTOR', 2, '2.3', 'เป็นผู้รับผิดชอบหลักงานพัฒนาคุณภาพ (HA/Quality)', 10000.00, 1, '2026-01-04 17:34:37');
INSERT INTO `pts_master_rates` VALUES (5, 'DOCTOR', 2, '2.4', 'ปฏิบัติงานใน รพ.ชุมชน หรือ โครงการเพิ่มพูนทักษะ (>4 ปี)', 10000.00, 1, '2026-01-04 17:34:37');
INSERT INTO `pts_master_rates` VALUES (6, 'DOCTOR', 3, '3.1', 'พยาธิวิทยาทั่วไป', 15000.00, 1, '2026-01-04 17:34:37');
INSERT INTO `pts_master_rates` VALUES (7, 'DOCTOR', 3, '3.2', 'พยาธิวิทยากายวิภาค', 15000.00, 1, '2026-01-04 17:34:37');
INSERT INTO `pts_master_rates` VALUES (8, 'DOCTOR', 3, '3.3', 'พยาธิวิทยาคลินิก', 15000.00, 1, '2026-01-04 17:34:37');
INSERT INTO `pts_master_rates` VALUES (9, 'DOCTOR', 3, '3.4', 'นิติเวชศาสตร์', 15000.00, 1, '2026-01-04 17:34:37');
INSERT INTO `pts_master_rates` VALUES (10, 'DOCTOR', 3, '3.5', 'จิตเวชศาสตร์', 15000.00, 1, '2026-01-04 17:34:37');
INSERT INTO `pts_master_rates` VALUES (11, 'DOCTOR', 3, '3.6', 'จิตเวชศาสตร์เด็กและวัยรุ่น', 15000.00, 1, '2026-01-04 17:34:37');
INSERT INTO `pts_master_rates` VALUES (12, 'DOCTOR', 3, '3.7', 'ประสาทศัลยศาสตร์', 15000.00, 1, '2026-01-04 17:34:37');
INSERT INTO `pts_master_rates` VALUES (13, 'DOCTOR', 3, '3.8', 'ศัลยศาสตร์ทรวงอก', 15000.00, 1, '2026-01-04 17:34:37');
INSERT INTO `pts_master_rates` VALUES (14, 'DOCTOR', 3, '3.9', 'เวชศาสตร์ป้องกัน (แขนงระบาดวิทยา)', 15000.00, 1, '2026-01-04 17:34:37');
INSERT INTO `pts_master_rates` VALUES (15, 'DENTIST', 1, '-', 'ทันตแพทย์ปฏิบัติงานทั่วไป', 5000.00, 1, '2026-01-04 17:34:37');
INSERT INTO `pts_master_rates` VALUES (16, 'DENTIST', 2, '-', 'ได้รับปริญญาโท/เอก ทางทันตกรรม', 7500.00, 1, '2026-01-04 17:34:37');
INSERT INTO `pts_master_rates` VALUES (17, 'DENTIST', 3, '-', 'ทันตแพทย์เฉพาะทาง (วุฒิบัตร/อนุมัติบัตร)', 10000.00, 1, '2026-01-04 17:34:37');
INSERT INTO `pts_master_rates` VALUES (18, 'PHARMACIST', 1, '-', 'เภสัชกรปฏิบัติงานทั่วไป', 1500.00, 1, '2026-01-04 17:34:37');
INSERT INTO `pts_master_rates` VALUES (19, 'PHARMACIST', 2, '2.1', 'หน่วยเคมีบำบัด', 3000.00, 1, '2026-01-04 17:34:37');
INSERT INTO `pts_master_rates` VALUES (20, 'PHARMACIST', 2, '2.2', 'งานดูแลผู้ป่วยโรคเอดส์/วัณโรค', 3000.00, 1, '2026-01-04 17:34:37');
INSERT INTO `pts_master_rates` VALUES (21, 'PHARMACIST', 2, '2.3', 'งานคุ้มครองผู้บริโภค', 3000.00, 1, '2026-01-04 17:34:37');
INSERT INTO `pts_master_rates` VALUES (22, 'NURSE', 1, '1.1', 'ปฏิบัติงานทั่วไป (OPD, ส่งเสริมสุขภาพ, อนามัย)', 1000.00, 1, '2026-01-04 17:34:37');
INSERT INTO `pts_master_rates` VALUES (23, 'NURSE', 1, '1.2', 'อาจารย์พยาบาล (กลุ่มทั่วไป)', 1000.00, 1, '2026-01-04 17:34:37');
INSERT INTO `pts_master_rates` VALUES (24, 'NURSE', 2, '2.1', 'ปฏิบัติงานหน่วยเสี่ยง (OR, ER, LR, ไตเทียม, เคมีบำบัด, จิตเวช) หรือ หอผู้ป่วยใน (IPD)', 1500.00, 1, '2026-01-04 17:34:37');
INSERT INTO `pts_master_rates` VALUES (25, 'NURSE', 2, '2.2', 'งานเฉพาะทางอื่นๆ ตามที่ ก.พ. กำหนด', 1500.00, 1, '2026-01-04 17:34:37');
INSERT INTO `pts_master_rates` VALUES (26, 'NURSE', 2, '2.3', 'อาจารย์พยาบาล (กลุ่มเฉพาะทาง)', 1500.00, 1, '2026-01-04 17:34:37');
INSERT INTO `pts_master_rates` VALUES (27, 'NURSE', 3, '3.1', 'หอผู้ป่วยวิกฤต (ICU/CCU/NICU), วิสัญญีพยาบาล, APN', 2000.00, 1, '2026-01-04 17:34:37');
INSERT INTO `pts_master_rates` VALUES (28, 'NURSE', 3, '3.2', 'หัวหน้าทีมพัฒนาคุณภาพการพยาบาล', 2000.00, 1, '2026-01-04 17:34:37');
INSERT INTO `pts_master_rates` VALUES (29, 'NURSE', 3, '3.3', 'อาจารย์พยาบาล (กลุ่มวิกฤต/วิสัญญี)', 2000.00, 1, '2026-01-04 17:34:37');
INSERT INTO `pts_master_rates` VALUES (30, 'ALLIED', 5, '-', 'นักเทคนิคการแพทย์', 1000.00, 1, '2026-01-04 17:34:37');
INSERT INTO `pts_master_rates` VALUES (31, 'ALLIED', 5, '-', 'นักรังสีการแพทย์', 1000.00, 1, '2026-01-04 17:34:37');
INSERT INTO `pts_master_rates` VALUES (32, 'ALLIED', 5, '-', 'นักกายภาพบำบัด', 1000.00, 1, '2026-01-04 17:34:37');
INSERT INTO `pts_master_rates` VALUES (33, 'ALLIED', 5, '-', 'นักกิจกรรมบำบัด / นักอาชีวบำบัด', 1000.00, 1, '2026-01-04 17:34:37');
INSERT INTO `pts_master_rates` VALUES (34, 'ALLIED', 5, '-', 'นักจิตวิทยาคลินิก', 1000.00, 1, '2026-01-04 17:34:37');
INSERT INTO `pts_master_rates` VALUES (35, 'ALLIED', 5, '-', 'นักเทคโนโลยีหัวใจและทรวงอก', 1000.00, 1, '2026-01-04 17:34:37');
INSERT INTO `pts_master_rates` VALUES (36, 'ALLIED', 5, '-', 'นักวิชาการศึกษาพิเศษ / นักแก้ไขความผิดปกติของการสื่อความหมาย', 1000.00, 1, '2026-01-04 17:34:37');

-- ----------------------------
-- Table structure for pts_notifications
-- ----------------------------
DROP TABLE IF EXISTS `pts_notifications`;
CREATE TABLE `pts_notifications`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL COMMENT 'ส่งหาใคร (User ID)',
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `link` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT 'ลิงก์กดไปหน้างาน (เช่น /dashboard/approver/requests/1)',
  `is_read` tinyint(1) NULL DEFAULT 0,
  `type` enum('INFO','SUCCESS','WARNING','ERROR') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'INFO' COMMENT 'ประเภทการแจ้งเตือน',
  `created_at` datetime NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_notif_user`(`user_id` ASC, `is_read` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 641 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of pts_notifications
-- ----------------------------

-- ----------------------------
-- Table structure for pts_payout_items
-- ----------------------------
DROP TABLE IF EXISTS `pts_payout_items`;
CREATE TABLE `pts_payout_items`  (
  `item_id` bigint NOT NULL AUTO_INCREMENT,
  `payout_id` bigint NOT NULL,
  `reference_month` int NOT NULL,
  `reference_year` int NOT NULL,
  `item_type` enum('CURRENT','RETROACTIVE_ADD','RETROACTIVE_DEDUCT') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(10, 2) NOT NULL,
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  PRIMARY KEY (`item_id`) USING BTREE,
  INDEX `idx_item_payout`(`payout_id` ASC) USING BTREE,
  CONSTRAINT `fk_item_payout` FOREIGN KEY (`payout_id`) REFERENCES `pts_payouts` (`payout_id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of pts_payout_items
-- ----------------------------

-- ----------------------------
-- Table structure for pts_payouts
-- ----------------------------
DROP TABLE IF EXISTS `pts_payouts`;
CREATE TABLE `pts_payouts`  (
  `payout_id` bigint NOT NULL AUTO_INCREMENT,
  `period_id` int NOT NULL,
  `citizen_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `master_rate_id` int NULL DEFAULT NULL,
  `pts_rate_snapshot` decimal(10, 2) NOT NULL,
  `calculated_amount` decimal(10, 2) NOT NULL,
  `retroactive_amount` decimal(10, 2) NULL DEFAULT 0.00,
  `total_payable` decimal(10, 2) NOT NULL,
  `deducted_days` decimal(5, 2) NULL DEFAULT 0.00,
  `eligible_days` decimal(5, 2) NULL DEFAULT 0.00,
  `remark` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `created_at` datetime NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`payout_id`) USING BTREE,
  INDEX `fk_payout_period`(`period_id` ASC) USING BTREE,
  INDEX `fk_payout_user`(`citizen_id` ASC) USING BTREE,
  CONSTRAINT `fk_payout_period` FOREIGN KEY (`period_id`) REFERENCES `pts_periods` (`period_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_payout_user` FOREIGN KEY (`citizen_id`) REFERENCES `users` (`citizen_id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of pts_payouts
-- ----------------------------

-- ----------------------------
-- Table structure for pts_periods
-- ----------------------------
DROP TABLE IF EXISTS `pts_periods`;
CREATE TABLE `pts_periods`  (
  `period_id` int NOT NULL AUTO_INCREMENT,
  `period_month` int NOT NULL,
  `period_year` int NOT NULL,
  `status` enum('OPEN','WAITING_HR','WAITING_HEAD_FINANCE','WAITING_DIRECTOR','CLOSED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'OPEN' COMMENT 'สถานะงวดเดือน',
  `total_amount` decimal(15, 2) NULL DEFAULT 0.00,
  `total_headcount` int NULL DEFAULT 0,
  `closed_at` datetime NULL DEFAULT NULL,
  `created_at` datetime NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`period_id`) USING BTREE,
  UNIQUE INDEX `idx_period_unique`(`period_year` ASC, `period_month` ASC) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of pts_periods
-- ----------------------------

-- ----------------------------
-- Table structure for pts_request_actions
-- ----------------------------
DROP TABLE IF EXISTS `pts_request_actions`;
CREATE TABLE `pts_request_actions`  (
  `action_id` int NOT NULL AUTO_INCREMENT,
  `request_id` int NOT NULL,
  `actor_id` int NOT NULL,
  `step_no` int NOT NULL,
  `action` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `comment` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `signature_snapshot` longblob NULL,
  `created_at` datetime NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`action_id`) USING BTREE,
  INDEX `idx_action_req`(`request_id` ASC) USING BTREE,
  CONSTRAINT `fk_action_req` FOREIGN KEY (`request_id`) REFERENCES `pts_requests` (`request_id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 9 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of pts_request_actions
-- ----------------------------

-- ----------------------------
-- Table structure for pts_requests
-- ----------------------------
DROP TABLE IF EXISTS `pts_requests`;
CREATE TABLE `pts_requests`  (
  `request_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NULL DEFAULT NULL,
  `citizen_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `request_no` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `personnel_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `current_position_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `current_department` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `request_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ประเภท: NEW_ENTRY, EDIT_INFO_SAME_RATE, EDIT_INFO_NEW_RATE',
  `target_rate_id` int NULL DEFAULT NULL,
  `requested_amount` decimal(10, 2) NULL DEFAULT 0.00,
  `work_attributes` json NULL,
  `main_duty` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `effective_date` date NOT NULL,
  `submission_data` json NULL,
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT 'DRAFT' COMMENT 'สถานะ: DRAFT, PENDING, APPROVED, REJECTED, RETURNED, CANCELLED',
  `current_step` int NULL DEFAULT 0,
  `applicant_signature_id` int NULL DEFAULT NULL,
  `created_at` datetime NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`request_id`) USING BTREE,
  INDEX `idx_req_user`(`citizen_id` ASC) USING BTREE,
  INDEX `fk_req_rate`(`target_rate_id` ASC) USING BTREE,
  INDEX `idx_request_user`(`user_id` ASC) USING BTREE,
  INDEX `idx_request_status`(`status` ASC) USING BTREE,
  INDEX `idx_req_signature`(`applicant_signature_id` ASC) USING BTREE,
  CONSTRAINT `fk_req_rate` FOREIGN KEY (`target_rate_id`) REFERENCES `pts_master_rates` (`rate_id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_req_user` FOREIGN KEY (`citizen_id`) REFERENCES `users` (`citizen_id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 8 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of pts_requests
-- ----------------------------

-- ----------------------------
-- Table structure for pts_support_employees
-- ----------------------------
DROP TABLE IF EXISTS `pts_support_employees`;
CREATE TABLE `pts_support_employees`  (
  `citizen_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `first_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `last_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `position_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `level` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `special_position` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `emp_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `department` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `last_synced_at` datetime NULL DEFAULT NULL,
  `is_currently_active` tinyint(1) NULL DEFAULT 1 COMMENT 'สถานะการทำงาน (1=Active, 0=Inactive)',
  `is_enable_login` tinyint(1) NULL DEFAULT 1 COMMENT 'สิทธิ์การ Login',
  `updated_at` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`citizen_id`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of pts_support_employees
-- ----------------------------

-- ----------------------------
-- Table structure for pts_user_signatures
-- ----------------------------
DROP TABLE IF EXISTS `pts_user_signatures`;
CREATE TABLE `pts_user_signatures`  (
  `signature_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `signature_image` longblob NOT NULL,
  `created_at` datetime NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`signature_id`) USING BTREE,
  UNIQUE INDEX `idx_sig_user`(`user_id` ASC) USING BTREE,
  CONSTRAINT `fk_sig_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 11576 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of pts_user_signatures
-- ----------------------------

-- ----------------------------
-- Table structure for users
-- ----------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `citizen_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Key หลักเชื่อม HR',
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `password_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'USER' COMMENT 'Role: USER, HEAD_DEPT, OFFICER, HEAD_HR, HEAD_FINANCE, FINANCE, DIRECTOR, ADMIN',
  `is_active` tinyint(1) NULL DEFAULT 1,
  `last_login_at` datetime NULL DEFAULT NULL,
  `created_at` datetime NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `idx_citizen_id`(`citizen_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 30132 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of users
-- ----------------------------

-- ----------------------------
-- View structure for employee_licenses
-- ----------------------------
DROP VIEW IF EXISTS `employee_licenses`;
CREATE ALGORITHM = UNDEFINED SQL SECURITY DEFINER VIEW `employee_licenses` AS select `t1`.`bp_license_id` AS `bp_license_id`,`t1`.`id` AS `citizen_id`,`t1`.`certificate` AS `license_name`,`t1`.`certificate_number` AS `license_no`,`t1`.`date_start` AS `valid_from`,(case when (cast(`t1`.`date_end` as char charset utf8mb4) = '0000-00-00') then '9999-12-31' else `t1`.`date_end` end) AS `valid_until`,(case when ((`t1`.`certificate` like '%เวชกรรม%') and (not((`t1`.`certificate` like '%แผนไทย%'))) and (not((`t1`.`certificate` like '%ทันตกรรม%')))) then 'DOCTOR' when (`t1`.`certificate` like '%ทันตกรรม%') then 'DENTIST' when ((`t1`.`certificate` like '%เภสัชกรรม%') and (not((`t1`.`certificate` like '%แผนไทย%')))) then 'PHARMACIST' when (`t1`.`certificate` like '%การพยาบาล%') then 'NURSE' else 'OTHER' end) AS `profession_code`,(case when ((cast(`t1`.`date_end` as char charset utf8mb4) = '0000-00-00') or (`t1`.`date_end` >= curdate())) then 'ACTIVE' else 'EXPIRED' end) AS `status` from (`hrms_databases`.`tb_bp_license` `t1` join `employees` `e` on((`t1`.`id` = `e`.`citizen_id`))) where (`t1`.`date_end` is not null);

-- ----------------------------
-- View structure for employee_movements
-- ----------------------------
DROP VIEW IF EXISTS `employee_movements`;
CREATE ALGORITHM = UNDEFINED SQL SECURITY DEFINER VIEW `employee_movements` AS select `t1`.`bp_status_id` AS `movement_id`,`t1`.`id` AS `citizen_id`,`t1`.`date` AS `effective_date`,`t1`.`status_id` AS `status_id`,(case when (`t1`.`status_id` in ('1','2','3')) then 'ENTRY' when (`t1`.`status_id` = '4') then 'RETIRE' when (`t1`.`status_id` = '5') then 'STUDY' when (`t1`.`status_id` = '6') then 'DEATH' when (`t1`.`status_id` in ('7','8')) then 'TRANSFER_OUT' when (`t1`.`status_id` = '9') then 'RESIGN' else 'UNKNOWN' end) AS `movement_type`,`t1`.`comment` AS `remark`,`t1`.`timestamp` AS `created_at` from (`hrms_databases`.`tb_bp_status` `t1` join `employees` `e` on((`t1`.`id` = `e`.`citizen_id`))) where (`t1`.`id` is not null) order by `t1`.`id`,`t1`.`date` desc,`t1`.`timestamp` desc;

-- ----------------------------
-- View structure for employee_signatures
-- ----------------------------
DROP VIEW IF EXISTS `employee_signatures`;
CREATE ALGORITHM = UNDEFINED SQL SECURITY DEFINER VIEW `employee_signatures` AS
-- employees (บุคลากร พ.ต.ส.)
SELECT e.citizen_id AS citizen_id, s.images AS signature_blob
FROM employees e
JOIN hrms_databases.signature s ON e.citizen_id = s.emp_id
WHERE e.is_currently_active = 1
  AND s.images IS NOT NULL AND s.images <> '' AND s.status = 1
UNION
-- support_employees - เช็ค is_enable_login จาก pts_support_employees
SELECT sp.citizen_id AS citizen_id, s.images AS signature_blob
FROM support_employees sp
JOIN hrms_databases.signature s ON sp.citizen_id = s.emp_id
JOIN pts_support_employees ps ON sp.citizen_id = ps.citizen_id
WHERE s.images IS NOT NULL AND s.images <> '' AND s.status = 1
  AND ps.is_enable_login = 1;

-- ----------------------------
-- View structure for employees
-- ----------------------------
DROP VIEW IF EXISTS `employees`;
CREATE ALGORITHM = UNDEFINED SQL SECURITY DEFINER VIEW `employees` AS select `h`.`id` AS `citizen_id`,`h`.`title` AS `title`,`h`.`name` AS `first_name`,`h`.`lastname` AS `last_name`,`h`.`sex` AS `sex`,`h`.`birthday` AS `birth_date`,`h`.`position` AS `position_name`,`h`.`positionnumber` AS `position_number`,`h`.`level` AS `level`,`h`.`specialposition` AS `special_position`,`h`.`type` AS `employee_type`,`h`.`employment_date` AS `start_current_position`,`h`.`entry_date` AS `first_entry_date`,`h`.`missiongroup` AS `mission_group`,`h`.`workgroup_m` AS `department`,`h`.`subworkgroup` AS `sub_department`,`h`.`specialist` AS `specialist`,`h`.`expert` AS `expert`,`h`.`status` AS `original_status`,(case when (`h`.`status` in ('ปฏิบัติงาน (ตรง จ.)','ปฏิบัติงาน (ไม่ตรง จ.)')) then 'ACTIVE' when (`h`.`status` like '%ลาศึกษา%') then 'STUDY' when (`h`.`status` like '%ลาออก%') then 'RESIGN' when (`h`.`status` like '%เกษียณ%') then 'RETIRE' when (`h`.`status` like '%เสียชีวิต%') then 'DEATH' when (`h`.`status` like '%ไปช่วย%') then 'TRANSFER_OUT' else 'INACTIVE' end) AS `current_status_type`,(case when (`h`.`status` in ('ปฏิบัติงาน (ตรง จ.)','ปฏิบัติงาน (ไม่ตรง จ.)')) then 1 when (`h`.`status` like '%ลาศึกษา%') then 1 else 0 end) AS `is_currently_active` from `hrms_databases`.`tb_ap_index_view` `h` where (((`h`.`position` like 'นายแพทย์%') or (`h`.`position` = 'ผู้อำนวยการเฉพาะด้าน (แพทย์)') or (`h`.`position` like 'ทันตแพทย์%') or (`h`.`position` like 'เภสัชกร%') or (`h`.`position` in ('พยาบาลวิชาชีพ','พยาบาล','วิสัญญี')) or (`h`.`position` in ('นักเทคนิคการแพทย์','นักรังสีการแพทย์','นักกายภาพบำบัด','นักแก้ไขความผิดปกติของการสื่อความหมาย','นักกิจกรรมบำบัด','นักอาชีวบำบัด','นักจิตวิทยาคลินิก','นักเทคโนโลยีหัวใจและทรวงอก','นักวิชาการศึกษาพิเศษ'))) and (not((`h`.`type` like '%พนักงานกระทรวงสาธารณสุข%'))) and (not((`h`.`type` like '%พนักงานมหาลัย%'))) and (not((`h`.`type` like '%พนักงานราชการ%'))) and (not((`h`.`type` like '%ลูกจ้างรายวัน%'))) and ((`h`.`status` in ('ปฏิบัติงาน (ตรง จ.)','ปฏิบัติงาน (ไม่ตรง จ.)')) or (`h`.`status` like 'ไม่ปฏิบัติงาน%') or (`h`.`status` like '%ลาศึกษา%')));

-- ----------------------------
-- View structure for leave_quotas
-- ----------------------------
DROP VIEW IF EXISTS `leave_quotas`;
CREATE ALGORITHM = UNDEFINED SQL SECURITY DEFINER VIEW `leave_quotas` AS select `sd`.`emp_id` AS `citizen_id`,`sd`.`year` AS `fiscal_year`,'vacation' AS `leave_type`,cast(`sd`.`setday` as decimal(10,2)) AS `total_quota` from (`hrms_databases`.`setdays` `sd` join `employees` `e` on((`sd`.`emp_id` = `e`.`citizen_id`)));

-- ----------------------------
-- View structure for leave_requests
-- ----------------------------
DROP VIEW IF EXISTS `leave_requests`;
CREATE ALGORITHM = UNDEFINED SQL SECURITY DEFINER VIEW `leave_requests` AS select `t1`.`ref_id` AS `ref_id`,`t1`.`citizen_id` AS `citizen_id`,`t1`.`leave_type` AS `leave_type`,`t1`.`real_start` AS `start_date`,`t1`.`real_end` AS `end_date`,`t1`.`remark` AS `remark`,`t1`.`STATUS` AS `STATUS`,`t1`.`fiscal_year` AS `fiscal_year`,(case when ((`t1`.`real_start` = `t1`.`real_end`) and (`t1`.`end_date_detail` in ('ครึ่งวัน','ครึ่งวัน - เช้า','ครึ่งวัน - บ่าย'))) then 0.5 else `t1`.`duration_days` end) AS `duration_days` from (select `dl`.`ID` AS `ref_id`,`dl`.`EMPLOYEE_ID` AS `citizen_id`,(case when (((`dl`.`search_text` like '%อุปสมบท%') or (`dl`.`search_text` like '%บวช%')) and (not((`dl`.`search_text` like '%งาน%'))) and (not((`dl`.`search_text` like '%ร่วม%')))) then 'ordain' when (((`dl`.`search_text` like '%ภริยา%') or (`dl`.`search_text` like '%คลอด%')) and (`e`.`sex` = 'm')) then 'wife_help' when (((`dl`.`search_text` like '%ดูแล%') or (`dl`.`search_text` like '%เฝ้า%')) and ((`dl`.`search_text` like '%แม่%') or (`dl`.`search_text` like '%พ่อ%') or (`dl`.`search_text` like '%ลูก%'))) then 'personal' when (`dl`.`type_text` like '%พักผ่อน%') then 'vacation' when (`dl`.`type_text` like '%ป่วย%') then 'sick' else 'personal' end) AS `leave_type`,`dl`.`real_start` AS `real_start`,`dl`.`real_end` AS `real_end`,`dl`.`DETAIL` AS `remark`,'approved' AS `STATUS`,(((year(`dl`.`real_start`) - (case when (year(`dl`.`real_start`) >= 2400) then 543 else 0 end)) + 543) + (case when (month(`dl`.`real_start`) >= 10) then 1 else 0 end)) AS `fiscal_year`,((to_days(`dl`.`real_end`) - to_days(`dl`.`real_start`)) + 1) AS `duration_days`,`dl`.`END_DATE_DETAIL` AS `end_date_detail` from ((select `t0`.`ID` AS `ID`,`t0`.`EMPLOYEE_ID` AS `EMPLOYEE_ID`,`t0`.`TYPE_LEAVE` AS `TYPE_LEAVE`,`t0`.`START_DATE` AS `START_DATE`,`t0`.`END_DATE` AS `END_DATE`,`t0`.`DETAIL` AS `DETAIL`,`t0`.`END_DATE_DETAIL` AS `END_DATE_DETAIL`,lower(`t0`.`TYPE_LEAVE`) AS `type_text`,concat_ws(' ',lower(`t0`.`TYPE_LEAVE`),`t0`.`DETAIL`) AS `search_text`,least((case when (year(cast(`t0`.`START_DATE` as date)) > 2400) then (cast(`t0`.`START_DATE` as date) - interval 543 year) else cast(`t0`.`START_DATE` as date) end),(case when (year(cast(`t0`.`END_DATE` as date)) > 2400) then (cast(`t0`.`END_DATE` as date) - interval 543 year) else cast(`t0`.`END_DATE` as date) end)) AS `real_start`,greatest((case when (year(cast(`t0`.`START_DATE` as date)) > 2400) then (cast(`t0`.`START_DATE` as date) - interval 543 year) else cast(`t0`.`START_DATE` as date) end),(case when (year(cast(`t0`.`END_DATE` as date)) > 2400) then (cast(`t0`.`END_DATE` as date) - interval 543 year) else cast(`t0`.`END_DATE` as date) end)) AS `real_end` from `hrms_databases`.`data_leave` `t0` where ((`t0`.`STATUS` = 'Approve') and (`t0`.`USED` = 1))) `dl` join `employees` `e` on((`dl`.`EMPLOYEE_ID` = `e`.`citizen_id`)))) `t1` union all select concat('MT-',`tm`.`meeting_id`) AS `ref_id`,`tm`.`id_card` AS `citizen_id`,'education' AS `leave_type`,`tm`.`real_start` AS `start_date`,`tm`.`real_end` AS `end_date`,`tm`.`meeting_title` AS `remark`,'approved' AS `STATUS`,(((year(`tm`.`real_start`) - (case when (year(`tm`.`real_start`) >= 2400) then 543 else 0 end)) + 543) + (case when (month(`tm`.`real_start`) >= 10) then 1 else 0 end)) AS `fiscal_year`,((to_days(`tm`.`real_end`) - to_days(`tm`.`real_start`)) + 1) AS `duration_days` from (select `tm`.`meeting_id` AS `meeting_id`,`tm`.`id_card` AS `id_card`,`tm`.`meeting_title` AS `meeting_title`,least((case when (year(cast(`tm`.`date_start` as date)) > 2400) then (cast(`tm`.`date_start` as date) - interval 543 year) else cast(`tm`.`date_start` as date) end),(case when (year(cast(`tm`.`date_end` as date)) > 2400) then (cast(`tm`.`date_end` as date) - interval 543 year) else cast(`tm`.`date_end` as date) end)) AS `real_start`,greatest((case when (year(cast(`tm`.`date_start` as date)) > 2400) then (cast(`tm`.`date_start` as date) - interval 543 year) else cast(`tm`.`date_start` as date) end),(case when (year(cast(`tm`.`date_end` as date)) > 2400) then (cast(`tm`.`date_end` as date) - interval 543 year) else cast(`tm`.`date_end` as date) end)) AS `real_end` from (`hrms_databases`.`tb_meeting` `tm` join `employees` `e` on((`tm`.`id_card` = `e`.`citizen_id`))) where (`tm`.`header_approve_status` = 1)) `tm`;

-- ----------------------------
-- View structure for support_employees
-- ----------------------------
DROP VIEW IF EXISTS `support_employees`;
CREATE ALGORITHM = UNDEFINED SQL SECURITY DEFINER VIEW `support_employees` AS
SELECT
  `h`.`id` AS `citizen_id`,
  `h`.`title` AS `title`,
  `h`.`name` AS `first_name`,
  `h`.`lastname` AS `last_name`,
  `h`.`name_eng` AS `name_eng`,
  `h`.`sex` AS `sex`,
  `h`.`position` AS `position_name`,
  `h`.`positionnumber` AS `position_number`,
  `h`.`level` AS `level`,
  TRIM(BOTH ',' FROM REPLACE(REPLACE(`h`.`specialposition`, 'ผู้ดูแลระบบ--', ''), 'ผู้ดูแลระบบ', '')) AS `special_position`,
  `h`.`type` AS `employee_type`,
  `h`.`employment_date` AS `start_current_position`,
  `h`.`entry_date` AS `first_entry_date`,
  `h`.`missiongroup` AS `mission_group`,
  `h`.`workgroup_m` AS `department`,
  CASE WHEN `h`.`status` IN ('ปฏิบัติงาน (ตรง จ.)', 'ปฏิบัติงาน (ไม่ตรง จ.)') THEN 'ACTIVE' ELSE 'UNKNOWN' END AS `current_status_type`,
  1 AS `is_currently_active`
FROM `hrms_databases`.`tb_ap_index_view` `h`
LEFT JOIN `employees` `e` ON `h`.`id` = `e`.`citizen_id`
WHERE `e`.`citizen_id` IS NULL
  AND `h`.`type` IN ('ข้าราชการ', 'พนักงานราชการ', 'พนักงานกระทรวงสาธารณสุข', 'ลูกจ้างรายวัน')
  AND `h`.`status` IN ('ปฏิบัติงาน (ตรง จ.)', 'ปฏิบัติงาน (ไม่ตรง จ.)')
  AND (`h`.`workgroup_m` = 'กลุ่มงานการเงิน' OR `h`.`workgroup_m` LIKE '%ทรัพยากรบุคคล');

-- ----------------------------
-- View structure for users_sync_view
-- ----------------------------
DROP VIEW IF EXISTS `users_sync_view`;
CREATE ALGORITHM = UNDEFINED SQL SECURITY DEFINER VIEW `users_sync_view` AS
-- employees (บุคลากร พ.ต.ส.)
SELECT e.citizen_id AS citizen_id,
       COALESCE(h.password, h.hash_password) AS plain_password,
       'USER' AS role,
       1 AS is_active
FROM employees e
JOIN hrms_databases.tb_ap_index_view h ON e.citizen_id = h.id
WHERE ((h.password IS NOT NULL AND h.password <> '')
    OR (h.hash_password IS NOT NULL AND h.hash_password <> ''))
  AND e.is_currently_active = 1
UNION
-- support_employees - เช็ค is_enable_login จาก pts_support_employees
SELECT s.citizen_id AS citizen_id,
       COALESCE(h.password, h.hash_password) AS plain_password,
       'USER' AS role,
       1 AS is_active
FROM support_employees s
JOIN hrms_databases.tb_ap_index_view h ON s.citizen_id = h.id
JOIN pts_support_employees ps ON s.citizen_id = ps.citizen_id
WHERE ((h.password IS NOT NULL AND h.password <> '')
    OR (h.hash_password IS NOT NULL AND h.hash_password <> ''))
  AND s.is_currently_active = 1
  AND ps.is_enable_login = 1;

SET FOREIGN_KEY_CHECKS = 1;
