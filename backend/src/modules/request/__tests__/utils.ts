import mysql, { Pool } from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

const testEnvPath = process.env.TEST_ENV_FILE
  ? path.resolve(process.env.TEST_ENV_FILE)
  : path.join(process.cwd(), '.env.test');

dotenv.config({ path: testEnvPath, override: true });

process.env.NODE_ENV = 'test';
process.env.START_SERVER = 'false';

// 🔥 แยก Database สำหรับ Request Test โดยเฉพาะ เพื่อไม่ให้ตีกับ Payroll
export const DB_NAME = 'phts_test_request';
export const JWT_SECRET =
  process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

export async function createTestPool(): Promise<Pool> {
  // Force Env เพื่อให้ Service อื่นๆ เชื่อมมาที่นี่
  process.env.DB_NAME = DB_NAME;

  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  // Reset DB: สร้างเฉพาะถ้ายังไม่มี
  await pool.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
  await pool.query(`USE \`${DB_NAME}\``);

  return pool;
}

export async function setupSchema(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      citizen_id VARCHAR(20) NOT NULL,
      email VARCHAR(255) DEFAULT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'USER',
      is_active TINYINT(1) DEFAULT 1,
      last_login_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY idx_citizen_id (citizen_id)
    );

    CREATE TABLE IF NOT EXISTS emp_profiles (
      citizen_id VARCHAR(20) NOT NULL PRIMARY KEY,
      title VARCHAR(50) DEFAULT NULL,
      first_name VARCHAR(100) DEFAULT NULL,
      last_name VARCHAR(100) DEFAULT NULL,
      sex VARCHAR(10) DEFAULT NULL,
      birth_date DATE DEFAULT NULL,
      position_name VARCHAR(255) DEFAULT NULL,
      position_number VARCHAR(50) DEFAULT NULL,
      level VARCHAR(50) DEFAULT NULL,
      special_position TEXT DEFAULT NULL,
      emp_type VARCHAR(50) DEFAULT NULL,
      department VARCHAR(255) DEFAULT NULL,
      sub_department VARCHAR(255) DEFAULT NULL,
      mission_group VARCHAR(100) DEFAULT NULL,
      specialist VARCHAR(255) DEFAULT NULL,
      expert VARCHAR(255) DEFAULT NULL,
      start_work_date DATE DEFAULT NULL,
      first_entry_date DATE DEFAULT NULL,
      original_status VARCHAR(50) DEFAULT NULL,
      email VARCHAR(100) DEFAULT NULL,
      phone VARCHAR(50) DEFAULT NULL,
      last_synced_at DATETIME DEFAULT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS emp_support_staff (
      citizen_id VARCHAR(20) NOT NULL PRIMARY KEY,
      title VARCHAR(50) DEFAULT NULL,
      first_name VARCHAR(100) DEFAULT NULL,
      last_name VARCHAR(100) DEFAULT NULL,
      position_name VARCHAR(100) DEFAULT NULL,
      level VARCHAR(50) DEFAULT NULL,
      special_position TEXT DEFAULT NULL,
      emp_type VARCHAR(50) DEFAULT NULL,
      department VARCHAR(100) DEFAULT NULL,
      last_synced_at DATETIME DEFAULT NULL,
      is_currently_active TINYINT(1) DEFAULT 1,
      is_enable_login TINYINT(1) DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cfg_payment_rates (
      rate_id INT AUTO_INCREMENT PRIMARY KEY,
      profession_code VARCHAR(20) NOT NULL,
      group_no INT NOT NULL,
      item_no VARCHAR(10),
      amount DECIMAL(10,2),
      condition_desc TEXT,
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- [FIXED] เพิ่ม user_id และ applicant_signature_id ให้ครบ
    CREATE TABLE IF NOT EXISTS req_submissions (
      request_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT DEFAULT NULL, 
      citizen_id VARCHAR(20) NOT NULL,
      request_no VARCHAR(20) DEFAULT NULL,
      personnel_type VARCHAR(50) DEFAULT NULL,
      current_position_number VARCHAR(50) DEFAULT NULL,
      current_department VARCHAR(150) DEFAULT NULL,
      request_type VARCHAR(50) NOT NULL,
      target_rate_id INT DEFAULT NULL,
      requested_amount DECIMAL(10,2) DEFAULT 0.00,
      work_attributes JSON DEFAULT NULL,
      main_duty TEXT DEFAULT NULL,
      effective_date DATE NOT NULL,
      submission_data JSON DEFAULT NULL,
      status VARCHAR(50) DEFAULT 'DRAFT',
      current_step INT DEFAULT 0,
      assigned_officer_id INT DEFAULT NULL,
      applicant_signature_id INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      step_started_at DATETIME DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS req_approvals (
      action_id INT AUTO_INCREMENT PRIMARY KEY,
      request_id INT,
      actor_id INT,
      step_no INT,
      action VARCHAR(50),
      comment TEXT,
      signature_snapshot LONGBLOB,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS req_attachments (
      attachment_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      request_id INT NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      file_path VARCHAR(255) NOT NULL,
      file_type VARCHAR(50) DEFAULT NULL,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS req_ocr_results (
      ocr_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      attachment_id INT NOT NULL,
      provider VARCHAR(50) NOT NULL DEFAULT 'TYPHOON',
      status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      extracted_json JSON DEFAULT NULL,
      confidence DECIMAL(5,2) DEFAULT NULL,
      error_message TEXT DEFAULT NULL,
      processed_at DATETIME DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_attachment_ocr (attachment_id)
    );

    CREATE TABLE IF NOT EXISTS sig_images (
      signature_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      signature_image LONGBLOB NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY idx_sig_user (user_id)
    );

    CREATE TABLE IF NOT EXISTS req_eligibility (
      eligibility_id INT AUTO_INCREMENT PRIMARY KEY,
      citizen_id VARCHAR(20) NOT NULL,
      master_rate_id INT NOT NULL,
      request_id INT DEFAULT NULL,
      effective_date DATE NOT NULL,
      expiry_date DATE DEFAULT NULL,
      reference_doc_no VARCHAR(100) DEFAULT NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ntf_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      link VARCHAR(255) DEFAULT NULL,
      is_read TINYINT(1) DEFAULT 0,
      type VARCHAR(20) NOT NULL DEFAULT 'INFO',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export async function cleanTables(pool: Pool) {
  const tables = [
    'req_approvals',
    'req_attachments',
    'req_ocr_results',
    'req_submissions',
    'sig_images',
    'req_eligibility',
    'cfg_payment_rates',
    'emp_profiles',
    'emp_support_staff',
    'ntf_messages',
    'users',
  ];
  const statements = ['SET FOREIGN_KEY_CHECKS = 0'];
  for (const t of tables) {
    statements.push(`TRUNCATE TABLE ${t}`);
  }
  statements.push('SET FOREIGN_KEY_CHECKS = 1');
  await pool.query(statements.join('; '));
}

export async function seedMasterRates(pool: Pool) {
  const rates = [
    { p: 'DOCTOR', g: 1, i: '1.1', a: 5000 },
    { p: 'DOCTOR', g: 2, i: '2.1', a: 10000 },
    { p: 'DOCTOR', g: 3, i: '3.1', a: 15000 },
    { p: 'DOCTOR', g: 3, i: '3.4', a: 15000 }, // นิติเวช
    { p: 'DENTIST', g: 2, i: '2.1', a: 7500 },
    { p: 'DENTIST', g: 3, i: '3.1', a: 10000 },
    { p: 'NURSE', g: 1, i: '1.1', a: 1000 },
    { p: 'NURSE', g: 2, i: '2.1', a: 1500 },
    { p: 'NURSE', g: 3, i: '3.1', a: 2000 },
    { p: 'ALLIED', g: 5, i: '5.1', a: 1000 },
  ];

  for (const r of rates) {
    await pool.query(
      `INSERT INTO cfg_payment_rates (profession_code, group_no, item_no, amount) VALUES (?, ?, ?, ?)`,
      [r.p, r.g, r.i, r.a],
    );
  }
}

export function signToken(user: { userId: number; role: string; citizenId: string }) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });
}
