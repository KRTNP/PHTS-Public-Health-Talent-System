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

export const DB_NAME = 'phts_test';
export const JWT_SECRET =
  process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

export async function createTestPool(): Promise<Pool> {
  // Force app/test to use this DB
  process.env.DB_NAME = DB_NAME;

  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

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
    CREATE TABLE IF NOT EXISTS cfg_payment_rates (
      rate_id INT AUTO_INCREMENT PRIMARY KEY,
      profession_code VARCHAR(20) NOT NULL,
      group_no INT NOT NULL,
      item_no VARCHAR(10) DEFAULT NULL,
      condition_desc TEXT DEFAULT NULL,
      amount DECIMAL(10,2) NOT NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
    CREATE TABLE IF NOT EXISTS req_eligibility (
      eligibility_id INT AUTO_INCREMENT PRIMARY KEY,
      citizen_id VARCHAR(20) NOT NULL,
      master_rate_id INT NOT NULL,
      request_id INT DEFAULT NULL,
      effective_date DATE NOT NULL,
      expiry_date DATE DEFAULT NULL,
      reference_doc_no VARCHAR(100) DEFAULT NULL,
      is_active TINYINT(1) DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS pay_periods (
      period_id INT AUTO_INCREMENT PRIMARY KEY,
      period_month INT NOT NULL,
      period_year INT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
      total_amount DECIMAL(15,2) DEFAULT 0.00,
      total_headcount INT DEFAULT 0,
      closed_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_frozen TINYINT(1) NOT NULL DEFAULT 0,
      frozen_at DATETIME DEFAULT NULL,
      frozen_by INT DEFAULT NULL
    );
    CREATE TABLE IF NOT EXISTS pay_results (
      payout_id BIGINT AUTO_INCREMENT PRIMARY KEY,
      period_id INT NOT NULL,
      citizen_id VARCHAR(20) NOT NULL,
      master_rate_id INT DEFAULT NULL,
      pts_rate_snapshot DECIMAL(10,2) NOT NULL,
      calculated_amount DECIMAL(10,2) NOT NULL,
      retroactive_amount DECIMAL(10,2) DEFAULT 0.00,
      total_payable DECIMAL(10,2) NOT NULL,
      deducted_days DECIMAL(5,2) DEFAULT 0.00,
      eligible_days DECIMAL(5,2) DEFAULT 0.00,
      remark TEXT DEFAULT NULL,
      payment_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      paid_at DATETIME DEFAULT NULL,
      paid_by INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS pay_result_items (
      item_id BIGINT AUTO_INCREMENT PRIMARY KEY,
      payout_id BIGINT NOT NULL,
      reference_month INT NOT NULL,
      reference_year INT NOT NULL,
      item_type VARCHAR(50) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      description VARCHAR(255) DEFAULT NULL
    );
    CREATE TABLE IF NOT EXISTS emp_movements (
      movement_id INT AUTO_INCREMENT PRIMARY KEY,
      citizen_id VARCHAR(20) NOT NULL,
      movement_type VARCHAR(20) NOT NULL,
      effective_date DATE NOT NULL,
      remark TEXT DEFAULT NULL,
      synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS emp_licenses (
      license_id INT AUTO_INCREMENT PRIMARY KEY,
      citizen_id VARCHAR(20) NOT NULL,
      license_no VARCHAR(50) DEFAULT NULL,
      valid_from DATE NOT NULL,
      valid_until DATE NOT NULL,
      status VARCHAR(20) DEFAULT 'ACTIVE',
      synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS leave_records (
      id INT PRIMARY KEY AUTO_INCREMENT,
      citizen_id VARCHAR(20) NOT NULL,
      leave_type VARCHAR(50) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      duration_days DECIMAL(5,2) NOT NULL,
      fiscal_year INT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS leave_quotas (
      quota_id INT PRIMARY KEY AUTO_INCREMENT,
      citizen_id VARCHAR(20) NOT NULL,
      fiscal_year INT NOT NULL,
      quota_vacation DECIMAL(5,2) DEFAULT 10,
      quota_personal DECIMAL(5,2) DEFAULT 45,
      quota_sick DECIMAL(5,2) DEFAULT 60
    );
    CREATE TABLE IF NOT EXISTS cfg_holidays (
      holiday_date DATE PRIMARY KEY,
      holiday_name VARCHAR(255) NOT NULL,
      is_active TINYINT(1) DEFAULT 1
    );
  `);
}

export async function seedBaseData(pool: Pool) {
  await pool.query(`
    INSERT IGNORE INTO cfg_payment_rates (profession_code, group_no, amount) VALUES
    ('DOCTOR', 1, 5000),
    ('DOCTOR', 2, 10000);
  `);
  await pool.query(
    `INSERT IGNORE INTO users (id, citizen_id, role, is_active, password_hash) VALUES (99, 'ADMIN1', 'ADMIN', 1, 'test-hash')`,
  );
  await pool.query(
    `INSERT IGNORE INTO users (citizen_id, role, password_hash) VALUES ('DOC1', 'USER', 'test-hash')`,
  );
  await pool.query(
    `INSERT IGNORE INTO emp_profiles (citizen_id, position_name) VALUES ('DOC1', 'นายแพทย์ปฏิบัติการ')`,
  );
  await pool.query(
    `INSERT IGNORE INTO emp_movements (citizen_id, movement_type, effective_date) VALUES ('DOC1', 'ENTRY', '2023-01-01')`,
  );
  await pool.query(
    `INSERT IGNORE INTO emp_licenses (citizen_id, valid_from, valid_until, status) VALUES ('DOC1', '2023-01-01', '2030-12-31', 'ACTIVE')`,
  );
}

export async function cleanTables(pool: Pool) {
  const tables = [
    'pay_result_items',
    'pay_results',
    'pay_periods',
    'req_eligibility',
    'emp_movements',
    'emp_licenses',
    'cfg_payment_rates',
    'emp_profiles',
    'leave_records',
    'leave_quotas',
    'cfg_holidays',
    'users',
  ];
  const statements = ['SET FOREIGN_KEY_CHECKS = 0'];
  for (const t of tables) {
    statements.push(`TRUNCATE TABLE ${t}`);
  }
  statements.push('SET FOREIGN_KEY_CHECKS = 1');
  await pool.query(statements.join('; '));
}

export async function resetTestData(pool: Pool) {
  const statements = [
    'SET FOREIGN_KEY_CHECKS = 0',
    'TRUNCATE TABLE pay_result_items',
    'TRUNCATE TABLE pay_results',
    'TRUNCATE TABLE pay_periods',
    'TRUNCATE TABLE req_eligibility',
    'TRUNCATE TABLE leave_records',
    'TRUNCATE TABLE leave_quotas',
    'TRUNCATE TABLE cfg_holidays',
    "DELETE FROM emp_movements WHERE citizen_id NOT IN ('DOC1')",
    "DELETE FROM emp_licenses WHERE citizen_id NOT IN ('DOC1')",
    "DELETE FROM emp_profiles WHERE citizen_id NOT IN ('DOC1')",
    "DELETE FROM users WHERE citizen_id NOT IN ('ADMIN1','DOC1')",
    "DELETE FROM cfg_payment_rates WHERE NOT (profession_code = 'DOCTOR' AND group_no IN (1,2) AND amount IN (5000,10000))",
    'SET FOREIGN_KEY_CHECKS = 1',
  ];
  await pool.query(statements.join('; '));

  await pool.query(
    `INSERT IGNORE INTO users (id, citizen_id, role, is_active, password_hash) VALUES (99, 'ADMIN1', 'ADMIN', 1, 'test-hash')`,
  );
  await pool.query(
    `INSERT IGNORE INTO users (citizen_id, role, password_hash) VALUES ('DOC1', 'USER', 'test-hash')`,
  );
  await pool.query(
    `INSERT IGNORE INTO emp_profiles (citizen_id, position_name) VALUES ('DOC1', 'นายแพทย์ปฏิบัติการ')`,
  );
  await pool.query(
    `INSERT IGNORE INTO emp_movements (citizen_id, movement_type, effective_date) VALUES ('DOC1', 'ENTRY', '2023-01-01')`,
  );
  await pool.query(
    `INSERT IGNORE INTO emp_licenses (citizen_id, valid_from, valid_until, status) VALUES ('DOC1', '2023-01-01', '2030-12-31', 'ACTIVE')`,
  );
  await pool.query(`
    INSERT IGNORE INTO cfg_payment_rates (profession_code, group_no, amount) VALUES
    ('DOCTOR', 1, 5000),
    ('DOCTOR', 2, 10000);
  `);
}

export function signAdminToken() {
  return jwt.sign({ userId: 99, citizenId: 'ADMIN1', role: 'ADMIN' }, JWT_SECRET, {
    expiresIn: '1h',
  });
}
