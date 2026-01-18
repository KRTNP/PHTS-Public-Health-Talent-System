import mysql, { Pool } from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

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
      citizen_id VARCHAR(20) NOT NULL UNIQUE,
      role VARCHAR(20),
      password_hash VARCHAR(100),
      is_active TINYINT(1) DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS cfg_payment_rates (
      rate_id INT AUTO_INCREMENT PRIMARY KEY,
      profession_code VARCHAR(20),
      group_no INT,
      item_no VARCHAR(10),
      amount DECIMAL(10,2),
      is_active TINYINT(1) DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS emp_profiles (
      citizen_id VARCHAR(20) PRIMARY KEY,
      position_name VARCHAR(100),
      department VARCHAR(100)
    );
    CREATE TABLE IF NOT EXISTS req_eligibility (
      eligibility_id INT AUTO_INCREMENT PRIMARY KEY,
      citizen_id VARCHAR(20),
      master_rate_id INT,
      effective_date DATE,
      expiry_date DATE DEFAULT NULL,
      is_active TINYINT(1) DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS pay_periods (
      period_id INT AUTO_INCREMENT PRIMARY KEY,
      period_month INT,
      period_year INT,
      status VARCHAR(20),
      total_amount DECIMAL(15,2) DEFAULT 0,
      total_headcount INT DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS pay_results (
      payout_id INT AUTO_INCREMENT PRIMARY KEY,
      period_id INT,
      citizen_id VARCHAR(20),
      master_rate_id INT,
      pts_rate_snapshot DECIMAL(10,2),
      calculated_amount DECIMAL(10,2),
      retroactive_amount DECIMAL(10,2) DEFAULT 0,
      total_payable DECIMAL(10,2),
      deducted_days DECIMAL(5,2) DEFAULT 0,
      eligible_days DECIMAL(5,2) DEFAULT 0,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS pay_result_items (
      item_id INT AUTO_INCREMENT PRIMARY KEY,
      payout_id INT,
      reference_month INT,
      reference_year INT,
      item_type VARCHAR(50),
      amount DECIMAL(10,2),
      description VARCHAR(255)
    );
    CREATE TABLE IF NOT EXISTS emp_movements (
      movement_id INT AUTO_INCREMENT PRIMARY KEY,
      citizen_id VARCHAR(20),
      movement_type VARCHAR(20),
      effective_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS emp_licenses (
      license_id INT AUTO_INCREMENT PRIMARY KEY,
      citizen_id VARCHAR(20),
      valid_from DATE,
      valid_until DATE,
      status VARCHAR(20),
      license_name VARCHAR(255),
      license_type VARCHAR(255),
      occupation_name VARCHAR(255)
    );
    CREATE TABLE IF NOT EXISTS leave_records (
      id INT PRIMARY KEY AUTO_INCREMENT,
      citizen_id VARCHAR(20),
      leave_type VARCHAR(50),
      start_date DATE,
      end_date DATE,
      duration_days DECIMAL(5,2),
      fiscal_year INT
    );
    CREATE TABLE IF NOT EXISTS leave_quotas (
      id INT PRIMARY KEY AUTO_INCREMENT,
      citizen_id VARCHAR(20),
      fiscal_year INT,
      quota_vacation DECIMAL(5,2) DEFAULT 10,
      quota_personal DECIMAL(5,2) DEFAULT 45,
      quota_sick DECIMAL(5,2) DEFAULT 60
    );
    CREATE TABLE IF NOT EXISTS cfg_holidays (holiday_date DATE PRIMARY KEY);
  `);
}

export async function seedBaseData(pool: Pool) {
  await pool.query(`
    INSERT IGNORE INTO cfg_payment_rates (profession_code, group_no, amount) VALUES
    ('DOCTOR', 1, 5000),
    ('DOCTOR', 2, 10000);
  `);
  await pool.query(
    `INSERT IGNORE INTO users (id, citizen_id, role, is_active) VALUES (99, 'ADMIN1', 'ADMIN', 1)`,
  );
  await pool.query(`INSERT IGNORE INTO users (citizen_id, role) VALUES ('DOC1', 'USER')`);
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
    `INSERT IGNORE INTO users (id, citizen_id, role, is_active) VALUES (99, 'ADMIN1', 'ADMIN', 1)`,
  );
  await pool.query(`INSERT IGNORE INTO users (citizen_id, role) VALUES ('DOC1', 'USER')`);
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
