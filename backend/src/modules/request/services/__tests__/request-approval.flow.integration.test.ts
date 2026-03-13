import { getTestConnection, resetRequestSchema } from '@/test/test-db.js';
import { requestApprovalService } from '@/modules/request/services/approval.service.js';
import { reassignRequest } from '@/modules/request/reassign/application/reassign.service.js';

jest.mock('@/modules/notification/services/notification.service.js', () => ({
  NotificationService: {
    notifyRole: jest.fn().mockResolvedValue(undefined),
    notifyUser: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/modules/audit/services/audit.service.js', () => ({
  AuditEventType: {
    REQUEST_APPROVE: 'REQUEST_APPROVE',
    REQUEST_REJECT: 'REQUEST_REJECT',
    REQUEST_RETURN: 'REQUEST_RETURN',
  },
  emitAuditEvent: jest.fn().mockResolvedValue(1),
}));

jest.mock('@/modules/request/scope/application/scope.service.js', () => ({
  canApproverAccessRequest: jest.fn().mockResolvedValue(true),
  isRequestOwner: jest.fn().mockResolvedValue(false),
  getActiveHeadScopeRoles: jest.fn().mockResolvedValue(['WARD_SCOPE', 'DEPT_SCOPE']),
}));

jest.setTimeout(30000);

const addColumnIfMissing = async (
  sql: string,
): Promise<void> => {
  const conn = await getTestConnection();
  try {
    await conn.execute(sql);
  } catch (error: any) {
    const message = String(error?.message ?? '');
    if (!message.includes('Duplicate column name')) {
      throw error;
    }
  } finally {
    await conn.end();
  }
};

const prepareRequestFlowSchema = async (): Promise<void> => {
  await resetRequestSchema();

  await addColumnIfMissing(
    'ALTER TABLE req_submissions ADD COLUMN requested_amount DECIMAL(12,2) NULL',
  );
  await addColumnIfMissing(
    'ALTER TABLE req_submissions ADD COLUMN effective_date DATE NULL',
  );
  await addColumnIfMissing(
    'ALTER TABLE req_submissions ADD COLUMN step_started_at DATETIME NULL',
  );
  await addColumnIfMissing(
    'ALTER TABLE req_submissions ADD COLUMN submission_data JSON NULL',
  );
  await addColumnIfMissing(
    'ALTER TABLE cfg_payment_rates ADD COLUMN group_no INT NOT NULL DEFAULT 1',
  );
  await addColumnIfMissing(
    "ALTER TABLE cfg_payment_rates ADD COLUMN item_no VARCHAR(20) NOT NULL DEFAULT '1'",
  );
  await addColumnIfMissing(
    'ALTER TABLE cfg_payment_rates ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1',
  );

  const conn = await getTestConnection();
  try {
    await conn.execute('DROP TABLE IF EXISTS req_approvals');
    await conn.execute(`
      CREATE TABLE req_approvals (
        approval_id INT AUTO_INCREMENT PRIMARY KEY,
        request_id INT NOT NULL,
        actor_id INT NOT NULL,
        step_no INT NOT NULL,
        action VARCHAR(20) NOT NULL,
        comment TEXT NULL,
        signature_snapshot LONGBLOB NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS req_eligibility (
        eligibility_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        citizen_id VARCHAR(20) NOT NULL,
        master_rate_id INT NOT NULL,
        request_id INT NOT NULL,
        effective_date DATE NOT NULL,
        expiry_date DATE NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await conn.execute('DELETE FROM req_eligibility');

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS cfg_payment_rates (
        rate_id INT AUTO_INCREMENT PRIMARY KEY,
        amount DECIMAL(12,2) NOT NULL,
        profession_code VARCHAR(50) NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1
      )
    `);
    await conn.execute('DELETE FROM cfg_payment_rates');
    await conn.execute(
      'INSERT INTO cfg_payment_rates (amount, group_no, item_no, profession_code, is_active) VALUES (?, ?, ?, ?, ?)',
      [1000, 1, '1.1', 'CIVIL_SERVANT', 1],
    );
  } finally {
    await conn.end();
  }
};

const seedUser = async (
  role: string,
  citizenId: string,
  name: string,
): Promise<number> => {
  const conn = await getTestConnection();
  try {
    const [result] = await conn.execute<any>(
      `INSERT INTO users (citizen_id, password_hash, role, is_active)
       VALUES (?, ?, ?, 1)`,
      [citizenId, 'hash', role],
    );
    await conn.execute(
      `INSERT INTO emp_profiles (citizen_id, first_name, last_name, department, sub_department)
       VALUES (?, ?, ?, ?, ?)`,
      [citizenId, name, 'Test', 'Dept-A', 'Unit-1'],
    );
    return Number(result.insertId);
  } finally {
    await conn.end();
  }
};

const seedRequest = async (data: {
  userId: number;
  citizenId: string;
  status: 'PENDING' | 'RETURNED' | 'REJECTED' | 'DRAFT';
  currentStep: number;
  assignedOfficerId?: number | null;
  requestNo?: string;
}): Promise<number> => {
  const conn = await getTestConnection();
  try {
    const [result] = await conn.execute<any>(
      `INSERT INTO req_submissions (
        user_id, citizen_id, request_no, personnel_type, status, current_step,
        assigned_officer_id, requested_amount, effective_date, submission_data, step_started_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        data.userId,
        data.citizenId,
        data.requestNo ?? `REQ-INT-${Date.now()}`,
        'CIVIL_SERVANT',
        data.status,
        data.currentStep,
        data.assignedOfficerId ?? null,
        1000,
        '2026-01-01',
        JSON.stringify({}),
      ],
    );
    return Number(result.insertId);
  } finally {
    await conn.end();
  }
};

const getRequestRow = async (requestId: number): Promise<any> => {
  const conn = await getTestConnection();
  try {
    const [rows] = await conn.query<any[]>(
      'SELECT * FROM req_submissions WHERE request_id = ?',
      [requestId],
    );
    return rows[0];
  } finally {
    await conn.end();
  }
};

const listActions = async (requestId: number): Promise<string[]> => {
  const conn = await getTestConnection();
  try {
    const [rows] = await conn.query<any[]>(
      'SELECT action FROM req_approvals WHERE request_id = ? ORDER BY approval_id ASC',
      [requestId],
    );
    return rows.map((row) => String(row.action));
  } finally {
    await conn.end();
  }
};

describe('Request & Approval flow integration', () => {
  let requesterId: number;
  let headScopeId: number;
  let officerAId: number;
  let officerBId: number;
  let headHrId: number;
  let headFinanceId: number;
  let directorId: number;

  beforeEach(async () => {
    await prepareRequestFlowSchema();

    requesterId = await seedUser('USER', '1000000000001', 'Requester');
    headScopeId = await seedUser('HEAD_SCOPE', '1000000000002', 'HeadScope');
    officerAId = await seedUser('PTS_OFFICER', '1000000000003', 'OfficerA');
    officerBId = await seedUser('PTS_OFFICER', '1000000000004', 'OfficerB');
    headHrId = await seedUser('HEAD_HR', '1000000000005', 'HeadHR');
    headFinanceId = await seedUser('HEAD_FINANCE', '1000000000006', 'HeadFinance');
    directorId = await seedUser('DIRECTOR', '1000000000007', 'Director');
  });

  test('approves request through step 1->6 and finalizes to APPROVED with eligibility', async () => {
    const requestId = await seedRequest({
      userId: requesterId,
      citizenId: '1000000000001',
      status: 'PENDING',
      currentStep: 1,
      requestNo: 'REQ-APPROVAL-E2E-001',
    });
    const signature = Buffer.from('sig');

    await requestApprovalService.approveRequest(requestId, headScopeId, 'HEAD_SCOPE', 's1', signature);
    let current = await getRequestRow(requestId);
    expect(current.status).toBe('PENDING');
    expect(current.current_step).toBe(2);

    await requestApprovalService.approveRequest(requestId, headScopeId, 'HEAD_SCOPE', 's2', signature);
    current = await getRequestRow(requestId);
    expect(current.status).toBe('PENDING');
    expect(current.current_step).toBe(3);
    expect(current.assigned_officer_id).not.toBeNull();

    await requestApprovalService.approveRequest(requestId, officerAId, 'PTS_OFFICER', 's3', signature);
    current = await getRequestRow(requestId);
    expect(current.current_step).toBe(4);

    await requestApprovalService.approveRequest(requestId, headHrId, 'HEAD_HR', 's4', signature);
    current = await getRequestRow(requestId);
    expect(current.current_step).toBe(5);

    await requestApprovalService.approveRequest(requestId, headFinanceId, 'HEAD_FINANCE', 's5', signature);
    current = await getRequestRow(requestId);
    expect(current.current_step).toBe(6);

    await requestApprovalService.approveRequest(requestId, directorId, 'DIRECTOR', 's6', signature);
    current = await getRequestRow(requestId);
    expect(current.status).toBe('APPROVED');
    expect(current.current_step).toBe(7);

    const actions = await listActions(requestId);
    expect(actions).toEqual(['APPROVE', 'APPROVE', 'APPROVE', 'APPROVE', 'APPROVE', 'APPROVE']);

    const conn = await getTestConnection();
    try {
      const [eligibilities] = await conn.query<any[]>(
        'SELECT * FROM req_eligibility WHERE request_id = ?',
        [requestId],
      );
      expect(eligibilities.length).toBe(1);
      expect(eligibilities[0].is_active).toBe(1);
    } finally {
      await conn.end();
    }
  });

  test('returns and rejects requests with correct terminal status', async () => {
    const returnRequestId = await seedRequest({
      userId: requesterId,
      citizenId: '1000000000001',
      status: 'PENDING',
      currentStep: 4,
      requestNo: 'REQ-RETURN-001',
    });
    await requestApprovalService.returnRequest(
      returnRequestId,
      headHrId,
      'HEAD_HR',
      'need more evidence',
    );
    const returned = await getRequestRow(returnRequestId);
    expect(returned.status).toBe('RETURNED');
    expect(returned.current_step).toBe(1);
    expect(returned.assigned_officer_id).toBeNull();

    const rejectRequestId = await seedRequest({
      userId: requesterId,
      citizenId: '1000000000001',
      status: 'PENDING',
      currentStep: 5,
      requestNo: 'REQ-REJECT-001',
    });
    await requestApprovalService.rejectRequest(
      rejectRequestId,
      headFinanceId,
      'HEAD_FINANCE',
      'budget mismatch',
    );
    const rejected = await getRequestRow(rejectRequestId);
    expect(rejected.status).toBe('REJECTED');

    expect(await listActions(returnRequestId)).toEqual(['RETURN']);
    expect(await listActions(rejectRequestId)).toEqual(['REJECT']);
  });

  test('reassigns pending officer-stage request and writes REASSIGN action', async () => {
    const requestId = await seedRequest({
      userId: requesterId,
      citizenId: '1000000000001',
      status: 'PENDING',
      currentStep: 3,
      assignedOfficerId: officerAId,
      requestNo: 'REQ-REASSIGN-001',
    });

    const result = await reassignRequest(requestId, officerAId, {
      targetOfficerId: officerBId,
      reason: 'balance workload',
    });

    expect(result.fromOfficerId).toBe(officerAId);
    expect(result.toOfficerId).toBe(officerBId);

    const current = await getRequestRow(requestId);
    expect(current.assigned_officer_id).toBe(officerBId);
    expect(await listActions(requestId)).toEqual(['REASSIGN']);
  });
});
