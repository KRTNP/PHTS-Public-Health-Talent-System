import {
  getTestConnection,
  resetRequestSchema,
} from '@/test/test-db.js';

jest.setTimeout(30000);

describe("RequestRepository (integration)", () => {
  let RequestRepository: typeof import("../../request.repository.js").RequestRepository;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    jest.resetModules();
    ({ RequestRepository } = await import("../../request.repository.js"));
  });

  beforeEach(async () => {
    await resetRequestSchema();
  });

  test("findById returns request with employee department", async () => {
    const conn = await getTestConnection();
    let requestId: number;
    try {
      const [userRes] = await conn.execute<any>(
        `INSERT INTO users (citizen_id, password_hash, role, is_active)
         VALUES (?, ?, ?, ?)`,
        ["500", "hash", "USER", 1],
      );
      const userId = Number(userRes.insertId);
      await conn.execute(
        `INSERT INTO emp_profiles
         (citizen_id, first_name, last_name, department, sub_department, position_name)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ["500", "A", "B", "Dept", "Sub", "Nurse"],
      );
      const [res] = await conn.execute<any>(
        `INSERT INTO req_submissions
         (user_id, citizen_id, status, current_step, created_at, updated_at)
         VALUES (?, ?, 'PENDING', 3, NOW(), NOW())`,
        [userId, "500"],
      );
      requestId = Number(res.insertId);
    } finally {
      await conn.end();
    }

    const repo = new RequestRepository();
    const row = await repo.findById(requestId);
    expect(row).not.toBeNull();
    expect((row as any).emp_department).toBe("Dept");
    expect((row as any).emp_sub_department).toBe("Sub");
  });

  test("findById resolves requester profile and license using request citizen_id for on-behalf requests", async () => {
    const conn = await getTestConnection();
    let requestId: number;
    try {
      const [officerRes] = await conn.execute<any>(
        `INSERT INTO users (citizen_id, password_hash, role, is_active)
         VALUES (?, ?, ?, ?)`,
        ["700", "hash", "PTS_OFFICER", 1],
      );
      const officerUserId = Number(officerRes.insertId);

      await conn.execute(
        `INSERT INTO emp_profiles
         (citizen_id, first_name, last_name, department, sub_department, position_name)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ["701", "Target", "User", "Target Dept", "Target Sub", "Nurse"],
      );

      await conn.execute(
        `INSERT INTO emp_licenses
         (citizen_id, license_name, license_no, valid_from, valid_until, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ["701", "พยาบาลวิชาชีพ", "LIC-701", "2025-01-01", "2027-12-31", "ACTIVE"],
      );

      const [res] = await conn.execute<any>(
        `INSERT INTO req_submissions
         (user_id, citizen_id, status, current_step, created_at, updated_at)
         VALUES (?, ?, 'PENDING', 3, NOW(), NOW())`,
        [officerUserId, "701"],
      );
      requestId = Number(res.insertId);
    } finally {
      await conn.end();
    }

    const repo = new RequestRepository();
    const row = await repo.findById(requestId);

    expect(row).not.toBeNull();
    expect((row as any).first_name).toBe("Target");
    expect((row as any).emp_department).toBe("Target Dept");
    expect((row as any).license_no).toBe("LIC-701");
    expect((row as any).license_name).toBe("พยาบาลวิชาชีพ");
  });

  test("findPendingByStepForOfficer returns assigned + unassigned", async () => {
    const conn = await getTestConnection();
    let officerId: number;
    try {
      const [userRes] = await conn.execute<any>(
        `INSERT INTO users (citizen_id, password_hash, role, is_active)
         VALUES (?, ?, ?, ?)`,
        ["501", "hash", "PTS_OFFICER", 1],
      );
      officerId = Number(userRes.insertId);
      await conn.execute(
        `INSERT INTO req_submissions
         (user_id, citizen_id, status, current_step, assigned_officer_id, created_at, updated_at)
         VALUES (?, '501', 'PENDING', 3, ?, NOW(), NOW())`,
        [officerId, officerId],
      );
      await conn.execute(
        `INSERT INTO req_submissions
         (user_id, citizen_id, status, current_step, assigned_officer_id, created_at, updated_at)
         VALUES (?, '501', 'PENDING', 3, NULL, NOW(), NOW())`,
        [officerId],
      );
    } finally {
      await conn.end();
    }

    const repo = new RequestRepository();
    const rows = await repo.findPendingByStepForOfficer(3, officerId);
    expect(rows.length).toBe(2);
  });

  test("findApprovalsWithActor joins actor profile data", async () => {
    const conn = await getTestConnection();
    let requestId: number;
    try {
      const [userRes] = await conn.execute<any>(
        `INSERT INTO users (citizen_id, password_hash, role, is_active)
         VALUES (?, ?, ?, ?)`,
        ["600", "hash", "HEAD_HR", 1],
      );
      const actorId = Number(userRes.insertId);
      await conn.execute(
        `INSERT INTO emp_profiles
         (citizen_id, first_name, last_name, position_name)
         VALUES (?, ?, ?, ?)`,
        ["600", "HR", "User", "HR"],
      );
      const [reqRes] = await conn.execute<any>(
        `INSERT INTO req_submissions
         (user_id, citizen_id, status, current_step, created_at, updated_at)
         VALUES (?, ?, 'PENDING', 4, NOW(), NOW())`,
        [actorId, "600"],
      );
      requestId = Number(reqRes.insertId);
      await conn.execute(
        `INSERT INTO req_approvals
         (request_id, actor_id, step_no, action, created_at)
         VALUES (?, ?, ?, 'APPROVE', NOW())`,
        [requestId, actorId, 4],
      );
    } finally {
      await conn.end();
    }

    const repo = new RequestRepository();
    const approvals = await repo.findApprovalsWithActor(requestId);
    expect(approvals.length).toBe(1);
    expect(approvals[0].actor_first_name).toBe("HR");
  });
});
