import mysql, { Pool } from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

const perfEnvPath = process.env.PERF_ENV_FILE
  ? path.resolve(process.env.PERF_ENV_FILE)
  : path.join(process.cwd(), '.env.perf');

dotenv.config({ path: perfEnvPath, override: true });

process.env.NODE_ENV = 'test';
process.env.START_SERVER = 'false';

export const PERF_DB_NAME = 'phts_test_perf';

export async function createPerfPool(): Promise<Pool> {
  process.env.DB_NAME = PERF_DB_NAME;
  if (!process.env.DB_PASSWORD && process.env.DB_PASS) {
    process.env.DB_PASSWORD = process.env.DB_PASS;
  }

  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  await pool.query(`CREATE DATABASE IF NOT EXISTS \`${PERF_DB_NAME}\``);
  await pool.query(`USE \`${PERF_DB_NAME}\``);

  return pool;
}

export async function setupPerfSchema(pool: Pool) {
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
      first_name VARCHAR(100) DEFAULT NULL,
      last_name VARCHAR(100) DEFAULT NULL,
      position_name VARCHAR(255) DEFAULT NULL,
      special_position TEXT DEFAULT NULL,
      department VARCHAR(255) DEFAULT NULL,
      sub_department VARCHAR(255) DEFAULT NULL,
      employment_status VARCHAR(50) DEFAULT NULL,
      specialist VARCHAR(255) DEFAULT NULL,
      expert VARCHAR(255) DEFAULT NULL,
      start_work_date DATE DEFAULT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS emp_support_staff (
      citizen_id VARCHAR(20) NOT NULL PRIMARY KEY,
      first_name VARCHAR(100) DEFAULT NULL,
      last_name VARCHAR(100) DEFAULT NULL,
      position_name VARCHAR(100) DEFAULT NULL,
      special_position TEXT DEFAULT NULL,
      department VARCHAR(100) DEFAULT NULL,
      employment_status VARCHAR(50) DEFAULT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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

    CREATE TABLE IF NOT EXISTS req_eligibility (
      eligibility_id INT AUTO_INCREMENT PRIMARY KEY,
      citizen_id VARCHAR(20) NOT NULL,
      master_rate_id INT NOT NULL,
      request_id INT DEFAULT NULL,
      effective_date DATE NOT NULL,
      expiry_date DATE DEFAULT NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

    CREATE TABLE IF NOT EXISTS pay_snapshots (
      snapshot_id INT AUTO_INCREMENT PRIMARY KEY,
      period_id INT NOT NULL,
      snapshot_type VARCHAR(20) NOT NULL,
      snapshot_data JSON NOT NULL,
      record_count INT NOT NULL DEFAULT 0,
      total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS emp_movements (
      movement_id INT AUTO_INCREMENT PRIMARY KEY,
      citizen_id VARCHAR(20) NOT NULL,
      movement_type VARCHAR(20) NOT NULL,
      effective_date DATE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS emp_licenses (
      license_id INT AUTO_INCREMENT PRIMARY KEY,
      citizen_id VARCHAR(20) NOT NULL,
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

    CREATE TABLE IF NOT EXISTS req_submissions (
      request_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT DEFAULT NULL,
      citizen_id VARCHAR(20) NOT NULL,
      request_no VARCHAR(20) DEFAULT NULL,
      request_type VARCHAR(50) NOT NULL,
      requested_amount DECIMAL(10,2) DEFAULT 0.00,
      effective_date DATE NOT NULL,
      status VARCHAR(50) DEFAULT 'DRAFT',
      current_step INT DEFAULT 0,
      applicant_signature_id INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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
      attachment_id INT AUTO_INCREMENT PRIMARY KEY,
      request_id INT NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      file_path VARCHAR(255) NOT NULL,
      file_type VARCHAR(50) DEFAULT NULL,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS req_ocr_results (
      ocr_id INT AUTO_INCREMENT PRIMARY KEY,
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

    CREATE TABLE IF NOT EXISTS dq_issues (
      issue_id INT AUTO_INCREMENT PRIMARY KEY,
      issue_type VARCHAR(50) NOT NULL,
      severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
      entity_type VARCHAR(50) NOT NULL,
      entity_id INT DEFAULT NULL,
      citizen_id VARCHAR(13) DEFAULT NULL,
      description TEXT NOT NULL,
      affected_calculation TINYINT(1) NOT NULL DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
      detected_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME DEFAULT NULL,
      resolved_by INT DEFAULT NULL,
      resolution_note TEXT DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      audit_id INT AUTO_INCREMENT PRIMARY KEY,
      event_type VARCHAR(50) NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      entity_id INT DEFAULT NULL,
      actor_id INT DEFAULT NULL,
      actor_role VARCHAR(30) DEFAULT NULL,
      action_detail JSON DEFAULT NULL,
      ip_address VARCHAR(45) DEFAULT NULL,
      user_agent VARCHAR(500) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS wf_delegations (
      delegation_id INT AUTO_INCREMENT PRIMARY KEY,
      delegator_id INT NOT NULL,
      delegate_id INT NOT NULL,
      delegated_role VARCHAR(30) NOT NULL,
      scope_type VARCHAR(20) NOT NULL DEFAULT 'ALL',
      scope_value VARCHAR(100) DEFAULT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      reason TEXT DEFAULT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      cancelled_at DATETIME DEFAULT NULL,
      cancelled_by INT DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_review_cycles (
      cycle_id INT AUTO_INCREMENT PRIMARY KEY,
      quarter INT NOT NULL,
      year INT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      start_date DATE NOT NULL,
      due_date DATE NOT NULL,
      completed_at DATETIME DEFAULT NULL,
      completed_by INT DEFAULT NULL,
      total_users INT NOT NULL DEFAULT 0,
      reviewed_users INT NOT NULL DEFAULT 0,
      disabled_users INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_review_items (
      item_id INT AUTO_INCREMENT PRIMARY KEY,
      cycle_id INT NOT NULL,
      user_id INT NOT NULL,
      current_role VARCHAR(30) NOT NULL,
      employee_status VARCHAR(50) DEFAULT NULL,
      last_login_at DATETIME DEFAULT NULL,
      review_result VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      reviewed_at DATETIME DEFAULT NULL,
      reviewed_by INT DEFAULT NULL,
      review_note TEXT DEFAULT NULL,
      auto_disabled TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS perf_meta (
      id INT PRIMARY KEY AUTO_INCREMENT,
      seeded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`CREATE OR REPLACE VIEW vw_finance_summary AS
    SELECT p.period_id AS period_id,
           p.period_month AS period_month,
           p.period_year AS period_year,
           p.status AS period_status,
           COUNT(DISTINCT po.citizen_id) AS total_employees,
           SUM(po.total_payable) AS total_amount,
           SUM(CASE WHEN po.payment_status = 'PAID' THEN po.total_payable ELSE 0 END) AS paid_amount,
           SUM(CASE WHEN po.payment_status = 'PENDING' THEN po.total_payable ELSE 0 END) AS pending_amount,
           COUNT(CASE WHEN po.payment_status = 'PAID' THEN 1 END) AS paid_count,
           COUNT(CASE WHEN po.payment_status = 'PENDING' THEN 1 END) AS pending_count
    FROM pay_periods p
    LEFT JOIN pay_results po ON p.period_id = po.period_id
    GROUP BY p.period_id, p.period_month, p.period_year, p.status`);

  await pool.query(`CREATE OR REPLACE VIEW vw_finance_yearly_summary AS
    SELECT period_year,
           SUM(total_employees) AS total_employees,
           SUM(total_amount) AS total_amount,
           SUM(paid_amount) AS paid_amount,
           SUM(pending_amount) AS pending_amount
    FROM vw_finance_summary
    GROUP BY period_year`);

  await pool.query(`CREATE OR REPLACE VIEW vw_data_quality_summary AS
    SELECT issue_type,
           severity,
           COUNT(*) AS issue_count,
           SUM(CASE WHEN affected_calculation = 1 THEN 1 ELSE 0 END) AS affecting_calc_count
    FROM dq_issues
    WHERE status IN ('OPEN','IN_PROGRESS')
    GROUP BY issue_type, severity`);

  await ensureIndex(
    pool,
    'req_submissions',
    'idx_req_status_step_created',
    'CREATE INDEX idx_req_status_step_created ON req_submissions (status, current_step, created_at)',
  );
  await ensureIndex(
    pool,
    'req_submissions',
    'idx_req_user_created',
    'CREATE INDEX idx_req_user_created ON req_submissions (user_id, created_at)',
  );
  await ensureIndex(
    pool,
    'req_approvals',
    'idx_req_request_created',
    'CREATE INDEX idx_req_request_created ON req_approvals (request_id, created_at)',
  );
  await ensureIndex(
    pool,
    'req_attachments',
    'idx_req_attach_uploaded',
    'CREATE INDEX idx_req_attach_uploaded ON req_attachments (request_id, uploaded_at)',
  );
  await ensureIndex(
    pool,
    'req_eligibility',
    'idx_elig_user_active_effective',
    'CREATE INDEX idx_elig_user_active_effective ON req_eligibility (citizen_id, is_active, effective_date, expiry_date)',
  );
  await ensureIndex(
    pool,
    'emp_movements',
    'idx_move_user_effective_created',
    'CREATE INDEX idx_move_user_effective_created ON emp_movements (citizen_id, effective_date, created_at)',
  );
  await ensureIndex(
    pool,
    'emp_licenses',
    'idx_license_user_valid_status',
    'CREATE INDEX idx_license_user_valid_status ON emp_licenses (citizen_id, valid_from, valid_until, status)',
  );
  await ensureIndex(
    pool,
    'leave_records',
    'idx_leave_user_year_start',
    'CREATE INDEX idx_leave_user_year_start ON leave_records (citizen_id, fiscal_year, start_date)',
  );
  await ensureIndex(
    pool,
    'dq_issues',
    'idx_dq_status_severity_detected',
    'CREATE INDEX idx_dq_status_severity_detected ON dq_issues (status, severity, detected_at)',
  );
  await ensureIndex(
    pool,
    'audit_logs',
    'idx_audit_created',
    'CREATE INDEX idx_audit_created ON audit_logs (created_at)',
  );
  await ensureIndex(
    pool,
    'wf_delegations',
    'idx_delegation_delegate_status',
    'CREATE INDEX idx_delegation_delegate_status ON wf_delegations (delegate_id, status)',
  );
  await ensureIndex(
    pool,
    'audit_review_items',
    'idx_review_cycle_result',
    'CREATE INDEX idx_review_cycle_result ON audit_review_items (cycle_id, review_result)',
  );
}

type SeedOptions = {
  userCount: number;
  requestCount: number;
  payrollUserCount: number;
  payResultCount: number;
  auditLogCount: number;
  dqIssueCount: number;
  notifCount: number;
  delegationCount: number;
  reviewItemCount: number;
  attachmentCount: number;
  approvalCount: number;
  batchSize: number;
};

export async function seedPerfData(pool: Pool, opts?: Partial<SeedOptions>) {
  const options: SeedOptions = {
    userCount: Number(process.env.PERF_USERS || 10000),
    requestCount: Number(process.env.PERF_REQUESTS || 50000),
    payrollUserCount: Number(process.env.PERF_PAYROLL_USERS || 4000),
    payResultCount: Number(process.env.PERF_PAY_RESULTS || 8000),
    auditLogCount: Number(process.env.PERF_AUDIT_LOGS || 5000),
    dqIssueCount: Number(process.env.PERF_DQ_ISSUES || 1000),
    notifCount: Number(process.env.PERF_NOTIFICATIONS || 2000),
    delegationCount: Number(process.env.PERF_DELEGATIONS || 1000),
    reviewItemCount: Number(process.env.PERF_REVIEW_ITEMS || 1000),
    attachmentCount: Number(process.env.PERF_ATTACHMENTS || 2000),
    approvalCount: Number(process.env.PERF_APPROVALS || 2000),
    batchSize: Number(process.env.PERF_BATCH || 1000),
    ...opts,
  };
  const adminId = Number(process.env.PERF_ADMIN_ID || options.userCount + 1);

  await pool.query(
    `DELETE FROM users WHERE citizen_id = 'ADMIN1' OR id = ?`,
    [adminId],
  );
  await pool.query(
    `INSERT INTO users (id, citizen_id, role, password_hash, is_active)
     VALUES (?, 'ADMIN1', 'ADMIN', 'test-hash', 1)`,
    [adminId],
  );

  const [seeded] = await pool.query<any[]>('SELECT id FROM perf_meta LIMIT 1');
  if (seeded.length) {
    await ensurePerfBaseline(pool);
    return { ...options, adminId };
  }

  const rateSql = `
    INSERT INTO cfg_payment_rates (profession_code, group_no, item_no, amount)
    VALUES ('DOCTOR', 1, '1.1', 5000),
           ('DOCTOR', 2, '2.1', 10000),
           ('NURSE', 1, '1.1', 1000),
           ('NURSE', 2, '2.1', 1500),
           ('NURSE', 3, '3.1', 2000),
           ('ALLIED', 5, '5.1', 1000)
  `;
  await pool.query(rateSql);

  await pool.query(
    `INSERT INTO cfg_holidays (holiday_date, holiday_name) VALUES ('2024-01-01', 'New Year')`,
  );

  const userRows: Array<[number, string, string, string]> = [];
  for (let i = 1; i <= options.userCount; i += 1) {
    if (i === adminId) continue;
    userRows.push([i, `CID${i.toString().padStart(6, '0')}`, 'USER', 'test-hash']);
  }
  await bulkInsert(pool, 'users', ['id', 'citizen_id', 'role', 'password_hash'], userRows, options.batchSize);

  const profileRows: Array<[string, string, string, string, string, string]> = [];
  for (let i = 1; i <= options.userCount; i += 1) {
    if (i === adminId) continue;
    const citizenId = `CID${i.toString().padStart(6, '0')}`;
    profileRows.push([
      citizenId,
      `First${i}`,
      `Last${i}`,
      'นายแพทย์ปฏิบัติการ',
      'ฝ่ายการแพทย์',
      'active',
    ]);
  }
  await bulkInsert(
    pool,
    'emp_profiles',
    ['citizen_id', 'first_name', 'last_name', 'position_name', 'department', 'employment_status'],
    profileRows,
    options.batchSize,
  );

  const [rateRows] = await pool.query<any[]>(
    `SELECT rate_id FROM cfg_payment_rates WHERE profession_code = 'DOCTOR' AND group_no = 1 LIMIT 1`,
  );
  const rateId = rateRows[0].rate_id as number;

  const eligRows: Array<[string, number, string, number]> = [];
  const movementRows: Array<[string, string, string]> = [];
  const licenseRows: Array<[string, string, string, string]> = [];
  const quotaRows: Array<[string, number, number, number, number]> = [];
  for (let i = 1; i <= options.payrollUserCount; i += 1) {
    const citizenId = `CID${i.toString().padStart(6, '0')}`;
    eligRows.push([citizenId, rateId, '2024-01-01', 1]);
    movementRows.push([citizenId, 'ENTRY', '2020-01-01']);
    licenseRows.push([citizenId, '2020-01-01', '2030-12-31', 'ACTIVE']);
    quotaRows.push([citizenId, 2567, 10, 45, 60]);
  }

  await bulkInsert(
    pool,
    'req_eligibility',
    ['citizen_id', 'master_rate_id', 'effective_date', 'is_active'],
    eligRows,
    options.batchSize,
  );

  await pool.query(
    `INSERT INTO pay_periods (period_month, period_year, status)
     VALUES (1, 2024, 'CLOSED'),
            (2, 2024, 'CLOSED'),
            (7, 2024, 'OPEN')`,
  );
  await pool.query(`UPDATE pay_periods SET is_frozen = 1 WHERE period_month = 1 AND period_year = 2024`);
  await bulkInsert(
    pool,
    'emp_movements',
    ['citizen_id', 'movement_type', 'effective_date'],
    movementRows,
    options.batchSize,
  );
  await bulkInsert(
    pool,
    'emp_licenses',
    ['citizen_id', 'valid_from', 'valid_until', 'status'],
    licenseRows,
    options.batchSize,
  );
  await bulkInsert(
    pool,
    'leave_quotas',
    ['citizen_id', 'fiscal_year', 'quota_vacation', 'quota_personal', 'quota_sick'],
    quotaRows,
    options.batchSize,
  );

  const payResultRows: Array<[number, string, number, number, number, number, string]> = [];
  for (let i = 1; i <= Math.min(options.payResultCount, options.payrollUserCount); i += 1) {
    const citizenId = `CID${i.toString().padStart(6, '0')}`;
    const status = i % 2 === 0 ? 'PAID' : 'PENDING';
    payResultRows.push([1, citizenId, rateId, 5000, 5000, 5000, status]);
    payResultRows.push([2, citizenId, rateId, 5000, 5000, 5000, status]);
    if (i % 3 === 0) {
      payResultRows.push([7, citizenId, rateId, 5000, 5000, 5000, 'PENDING']);
    }
  }
  await bulkInsert(
    pool,
    'pay_results',
    ['period_id', 'citizen_id', 'master_rate_id', 'pts_rate_snapshot', 'calculated_amount', 'total_payable', 'payment_status'],
    payResultRows,
    options.batchSize,
  );

  await pool.query(
    `INSERT INTO pay_snapshots (period_id, snapshot_type, snapshot_data, record_count, total_amount)
     VALUES (1, 'PAYOUT', JSON_ARRAY(), 0, 0.00),
            (1, 'SUMMARY', JSON_OBJECT('period_id', 1, 'total_employees', 0), 0, 0.00)`,
  );

  const requestRows: Array<[number, string, string, string, number, string, number]> = [];
  for (let i = 1; i <= options.requestCount; i += 1) {
    const userId = ((i - 1) % options.userCount) + 1;
    const citizenId = `CID${userId.toString().padStart(6, '0')}`;
    requestRows.push([
      userId,
      citizenId,
      'NEW_ENTRY',
      'PENDING',
      5,
      '2024-01-01',
      1500,
    ]);
  }
  await bulkInsert(
    pool,
    'req_submissions',
    ['user_id', 'citizen_id', 'request_type', 'status', 'current_step', 'effective_date', 'requested_amount'],
    requestRows,
    options.batchSize,
  );

  const approvalRows: Array<[number, number, number, string]> = [];
  for (let i = 1; i <= options.approvalCount; i += 1) {
    approvalRows.push([i, 1, 5, 'APPROVE']);
  }
  await bulkInsert(
    pool,
    'req_approvals',
    ['request_id', 'actor_id', 'step_no', 'action'],
    approvalRows,
    options.batchSize,
  );

  const attachmentRows: Array<[number, string, string]> = [];
  for (let i = 1; i <= options.attachmentCount; i += 1) {
    attachmentRows.push([i, `file_${i}.pdf`, `/tmp/file_${i}.pdf`]);
  }
  await bulkInsert(
    pool,
    'req_attachments',
    ['request_id', 'file_name', 'file_path'],
    attachmentRows,
    options.batchSize,
  );

  const ocrRows: Array<[number, string]> = [];
  for (let i = 1; i <= Math.min(options.attachmentCount, 1000); i += 1) {
    ocrRows.push([i, 'COMPLETED']);
  }
  await bulkInsert(
    pool,
    'req_ocr_results',
    ['attachment_id', 'status'],
    ocrRows,
    options.batchSize,
  );

  const dqRows: Array<[string, string, string, string, number]> = [];
  for (let i = 1; i <= options.dqIssueCount; i += 1) {
    dqRows.push(['LICENSE_EXPIRED', 'HIGH', 'emp_profiles', `CID${i.toString().padStart(6, '0')}`, 1]);
  }
  await bulkInsert(
    pool,
    'dq_issues',
    ['issue_type', 'severity', 'entity_type', 'citizen_id', 'affected_calculation'],
    dqRows,
    options.batchSize,
  );

  const auditRows: Array<[string, string, number, number, string]> = [];
  for (let i = 1; i <= options.auditLogCount; i += 1) {
    auditRows.push(['REQUEST_APPROVE', 'req_submissions', i, 1, 'ADMIN']);
  }
  await bulkInsert(
    pool,
    'audit_logs',
    ['event_type', 'entity_type', 'entity_id', 'actor_id', 'actor_role'],
    auditRows,
    options.batchSize,
  );

  const notifRows: Array<[number, string, string, string, string, number]> = [];
  for (let i = 1; i <= options.notifCount; i += 1) {
    notifRows.push([1, `Title ${i}`, `Message ${i}`, `/link/${i}`, 'INFO', i % 2]);
  }
  await bulkInsert(
    pool,
    'ntf_messages',
    ['user_id', 'title', 'message', 'link', 'type', 'is_read'],
    notifRows,
    options.batchSize,
  );

  const delegationRows: Array<[number, number, string, string, string, string, string, string, string]> = [];
  for (let i = 1; i <= options.delegationCount; i += 1) {
    delegationRows.push([1, 2, 'HEAD_FINANCE', 'ALL', '', '2024-01-01', '2024-12-31', 'perf', 'ACTIVE']);
  }
  await bulkInsert(
    pool,
    'wf_delegations',
    ['delegator_id', 'delegate_id', 'delegated_role', 'scope_type', 'scope_value', 'start_date', 'end_date', 'reason', 'status'],
    delegationRows,
    options.batchSize,
  );

  const [cycleResult] = await pool.query<any[]>(
    `INSERT INTO audit_review_cycles (quarter, year, status, start_date, due_date, total_users)
     VALUES (1, 2024, 'PENDING', '2024-01-01', '2024-01-15', ?)`,
    [options.reviewItemCount],
  );
  const cycleId = (cycleResult as any).insertId;
  const reviewRows: Array<[number, number, string, string]> = [];
  for (let i = 1; i <= options.reviewItemCount; i += 1) {
    reviewRows.push([cycleId, i, 'USER', 'active']);
  }
  await bulkInsert(
    pool,
    'audit_review_items',
    ['cycle_id', 'user_id', 'current_role', 'employee_status'],
    reviewRows,
    options.batchSize,
  );

  await pool.query('INSERT INTO perf_meta (seeded_at) VALUES (NOW())');

  return { ...options, adminId };
}

async function bulkInsert<T extends unknown[]>(
  pool: Pool,
  table: string,
  columns: string[],
  rows: T[],
  batchSize: number,
) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    if (chunk.length === 0) continue;
    const placeholders = chunk.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ');
    const flatValues = chunk.flat();
    await pool.query(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders}`,
      flatValues,
    );
  }
}

async function ensurePerfBaseline(pool: Pool) {
  const [pending] = await pool.query<any[]>(
    `SELECT 1 FROM req_submissions WHERE status = 'PENDING' AND current_step = 5 LIMIT 1`,
  );
  if (pending.length === 0) {
    await pool.query(
      `INSERT INTO req_submissions (user_id, citizen_id, request_type, status, current_step, effective_date, requested_amount)
       VALUES (1, 'CID000001', 'NEW_ENTRY', 'PENDING', 5, '2024-01-01', 1500)`,
    );
  }

  const [periods] = await pool.query<any[]>(
    `SELECT 1 FROM pay_periods WHERE period_month = 1 AND period_year = 2024 LIMIT 1`,
  );
  if (periods.length === 0) {
    await pool.query(
      `INSERT INTO pay_periods (period_month, period_year, status, is_frozen)
       VALUES (1, 2024, 'CLOSED', 1), (7, 2024, 'OPEN', 0)`,
    );
  }

  const [payResults] = await pool.query<any[]>(
    `SELECT 1 FROM pay_results LIMIT 1`,
  );
  if (payResults.length === 0) {
    await pool.query(
      `INSERT INTO pay_results (period_id, citizen_id, master_rate_id, pts_rate_snapshot, calculated_amount, total_payable, payment_status)
       VALUES (1, 'CID000001', 1, 5000, 5000, 5000, 'PAID')`,
    );
  }

  const [snapshots] = await pool.query<any[]>(
    `SELECT 1 FROM pay_snapshots LIMIT 1`,
  );
  if (snapshots.length === 0) {
    await pool.query(
      `INSERT INTO pay_snapshots (period_id, snapshot_type, snapshot_data, record_count, total_amount)
       VALUES (1, 'PAYOUT', JSON_ARRAY(), 0, 0.00),
              (1, 'SUMMARY', JSON_OBJECT('period_id', 1), 0, 0.00)`,
    );
  }

  const [dq] = await pool.query<any[]>(
    `SELECT 1 FROM dq_issues LIMIT 1`,
  );
  if (dq.length === 0) {
    await pool.query(
      `INSERT INTO dq_issues (issue_type, severity, entity_type, description, affected_calculation)
       VALUES ('LICENSE_EXPIRED', 'HIGH', 'emp_profiles', 'perf', 1)`,
    );
  }

  const [audit] = await pool.query<any[]>(
    `SELECT 1 FROM audit_logs LIMIT 1`,
  );
  if (audit.length === 0) {
    await pool.query(
      `INSERT INTO audit_logs (event_type, entity_type, entity_id, actor_id, actor_role)
       VALUES ('REQUEST_APPROVE', 'req_submissions', 1, 1, 'ADMIN')`,
    );
  }

  const [notif] = await pool.query<any[]>(
    `SELECT 1 FROM ntf_messages LIMIT 1`,
  );
  if (notif.length === 0) {
    await pool.query(
      `INSERT INTO ntf_messages (user_id, title, message, type)
       VALUES (1, 'perf', 'perf', 'INFO')`,
    );
  }

  const [delegations] = await pool.query<any[]>(
    `SELECT 1 FROM wf_delegations LIMIT 1`,
  );
  if (delegations.length === 0) {
    await pool.query(
      `INSERT INTO wf_delegations (delegator_id, delegate_id, delegated_role, scope_type, start_date, end_date, status)
       VALUES (1, 2, 'HEAD_FINANCE', 'ALL', '2024-01-01', '2024-12-31', 'ACTIVE')`,
    );
  }

  const [cycles] = await pool.query<any[]>(
    `SELECT cycle_id FROM audit_review_cycles LIMIT 1`,
  );
  if (cycles.length === 0) {
    const [cycleResult] = await pool.query<any[]>(
      `INSERT INTO audit_review_cycles (quarter, year, status, start_date, due_date, total_users)
       VALUES (1, 2024, 'PENDING', '2024-01-01', '2024-01-15', 1)`,
    );
    const cycleId = (cycleResult as any).insertId;
    await pool.query(
      `INSERT INTO audit_review_items (cycle_id, user_id, current_role, employee_status)
       VALUES (?, 1, 'USER', 'active')`,
      [cycleId],
    );
  }
}

async function ensureIndex(pool: Pool, table: string, indexName: string, ddl: string) {
  const [rows] = await pool.query<any[]>(
    `SELECT 1
     FROM information_schema.statistics
     WHERE table_schema = ?
       AND table_name = ?
       AND index_name = ?
     LIMIT 1`,
    [PERF_DB_NAME, table, indexName],
  );
  if (rows.length === 0) {
    await pool.query(ddl);
  }
}
