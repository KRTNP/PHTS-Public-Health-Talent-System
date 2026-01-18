import { Pool } from 'mysql2/promise';
import { createPerfPool, setupPerfSchema, seedPerfData, PERF_DB_NAME } from './utils.js';

let pool: Pool;

const runPerf = process.env.RUN_PERF === '1';
const describePerf = runPerf ? describe : describe.skip;

describePerf('Perf: realistic integration', () => {
  beforeAll(async () => {
    process.env.DB_NAME = PERF_DB_NAME;
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'perf-test-secret';
    jest.resetModules();

    pool = await createPerfPool();
    await setupPerfSchema(pool);
    await seedPerfData(pool);

  }, 300000);

  afterAll(async () => {
    if (pool) await pool.end();
  });

  test(
    'Payroll calculate on-demand (sampled users)',
    async () => {
      const sampleCount = Number(process.env.PERF_SAMPLE || 30);
      const maxMs = Number(process.env.PERF_PAYROLL_MAX_MS || 20000);
      const { PayrollService } = await import('../../modules/payroll/payroll.service.js');

      const start = Date.now();
      for (let i = 1; i <= sampleCount; i += 1) {
        const citizenId = `CID${i.toString().padStart(6, '0')}`;
        await PayrollService.calculateOnDemand(2024, 7, citizenId);
      }
      const elapsedMs = Date.now() - start;
      console.log(
        `[perf] payroll.calculateOnDemand: ${sampleCount} users in ${elapsedMs} ms (max ${maxMs} ms)`,
      );
      expect(elapsedMs).toBeGreaterThan(0);
      expect(elapsedMs).toBeLessThan(maxMs);
    },
    300000,
  );

  test(
    'Pending requests query (HEAD_FINANCE)',
    async () => {
      const maxMs = Number(process.env.PERF_PENDING_MAX_MS || 5000);
      const { getPendingForApprover } = await import('../../modules/request/request-query.service.js');
      const start = Date.now();
      const results = await getPendingForApprover('HEAD_FINANCE');
      const elapsedMs = Date.now() - start;
      console.log(
        `[perf] request.pending(HEAD_FINANCE): ${results.length} rows in ${elapsedMs} ms (max ${maxMs} ms)`,
      );

      expect(results.length).toBeGreaterThan(0);
      expect(elapsedMs).toBeGreaterThan(0);
      expect(elapsedMs).toBeLessThan(maxMs);
    },
    300000,
  );

  test(
    'Request list + history hydration',
    async () => {
      const maxMs = Number(process.env.PERF_REQUESTS_MAX_MS || 5000);
      const { getMyRequests, getApprovalHistory } = await import(
        '../../modules/request/request-query.service.js'
      );
      const start = Date.now();
      const myRequests = await getMyRequests(1);
      const history = await getApprovalHistory(1);
      const elapsedMs = Date.now() - start;
      console.log(
        `[perf] request.my+history: ${myRequests.length}/${history.length} rows in ${elapsedMs} ms (max ${maxMs} ms)`,
      );
      expect(elapsedMs).toBeGreaterThan(0);
      expect(elapsedMs).toBeLessThan(maxMs);
    },
    300000,
  );

  test(
    'Finance dashboard + payouts',
    async () => {
      const maxMs = Number(process.env.PERF_FINANCE_MAX_MS || 5000);
      const { getFinanceDashboard, getPayoutsByPeriod } = await import(
        '../../modules/finance/finance.service.js'
      );
      const start = Date.now();
      const dashboard = await getFinanceDashboard();
      const payouts = await getPayoutsByPeriod(1);
      const elapsedMs = Date.now() - start;
      console.log(
        `[perf] finance.dashboard+payouts: ${payouts.length} rows in ${elapsedMs} ms (max ${maxMs} ms)`,
      );
      expect(dashboard).toBeDefined();
      expect(elapsedMs).toBeGreaterThan(0);
      expect(elapsedMs).toBeLessThan(maxMs);
    },
    300000,
  );

  test(
    'Snapshot report (frozen + live)',
    async () => {
      const maxMs = Number(process.env.PERF_SNAPSHOT_MAX_MS || 5000);
      const { getPayoutDataForReport, getSummaryDataForReport } = await import(
        '../../modules/snapshot/snapshot.service.js'
      );
      const start = Date.now();
      const frozen = await getSummaryDataForReport(1);
      const live = await getPayoutDataForReport(7);
      const elapsedMs = Date.now() - start;
      console.log(
        `[perf] snapshot.summary+live: ${live.recordCount} rows in ${elapsedMs} ms (max ${maxMs} ms)`,
      );
      expect(frozen).toBeDefined();
      expect(elapsedMs).toBeGreaterThan(0);
      expect(elapsedMs).toBeLessThan(maxMs);
    },
    300000,
  );

  test(
    'Data quality dashboard',
    async () => {
      const maxMs = Number(process.env.PERF_DQ_MAX_MS || 5000);
      const { getDashboard } = await import('../../modules/data-quality/data-quality.service.js');
      const start = Date.now();
      const dashboard = await getDashboard();
      const elapsedMs = Date.now() - start;
      console.log(
        `[perf] data-quality.dashboard: ${dashboard.totalIssues} issues in ${elapsedMs} ms (max ${maxMs} ms)`,
      );
      expect(dashboard.totalIssues).toBeGreaterThan(0);
      expect(elapsedMs).toBeGreaterThan(0);
      expect(elapsedMs).toBeLessThan(maxMs);
    },
    300000,
  );

  test(
    'Audit search',
    async () => {
      const maxMs = Number(process.env.PERF_AUDIT_MAX_MS || 5000);
      const { searchAuditEvents } = await import('../../modules/audit/audit.service.js');
      const start = Date.now();
      const result = await searchAuditEvents({ page: 1, limit: 100 });
      const elapsedMs = Date.now() - start;
      console.log(
        `[perf] audit.search: ${result.total} total in ${elapsedMs} ms (max ${maxMs} ms)`,
      );
      expect(result.total).toBeGreaterThan(0);
      expect(elapsedMs).toBeGreaterThan(0);
      expect(elapsedMs).toBeLessThan(maxMs);
    },
    300000,
  );

  test(
    'Notifications (list + unread count)',
    async () => {
      const maxMs = Number(process.env.PERF_NOTIF_MAX_MS || 3000);
      const { NotificationService } = await import('../../modules/notification/notification.service.js');
      const start = Date.now();
      const list = await NotificationService.getMyNotifications(1, 50);
      const unread = await NotificationService.getUnreadCount(1);
      const elapsedMs = Date.now() - start;
      console.log(
        `[perf] notifications.list+count: ${list.length}/${unread} in ${elapsedMs} ms (max ${maxMs} ms)`,
      );
      expect(elapsedMs).toBeGreaterThan(0);
      expect(elapsedMs).toBeLessThan(maxMs);
    },
    300000,
  );

  test(
    'Delegations (user + delegate checks)',
    async () => {
      const maxMs = Number(process.env.PERF_DELEGATION_MAX_MS || 3000);
      const { getUserDelegations, getActiveDelegationsForDelegate, canActAsRole } = await import(
        '../../modules/delegation/delegation.service.js'
      );
      const start = Date.now();
      const list = await getUserDelegations(1, true);
      const active = await getActiveDelegationsForDelegate(2);
      const canAct = await canActAsRole(2, 'HEAD_FINANCE');
      const elapsedMs = Date.now() - start;
      console.log(
        `[perf] delegations.user+active: ${list.length}/${active.length} in ${elapsedMs} ms (max ${maxMs} ms)`,
      );
      expect(canAct.canAct).toBeDefined();
      expect(elapsedMs).toBeGreaterThan(0);
      expect(elapsedMs).toBeLessThan(maxMs);
    },
    300000,
  );

  test(
    'Access review cycles + items',
    async () => {
      const maxMs = Number(process.env.PERF_ACCESS_REVIEW_MAX_MS || 5000);
      const { getReviewCycles, getReviewItems } = await import(
        '../../modules/access-review/access-review.service.js'
      );
      const start = Date.now();
      const cycles = await getReviewCycles();
      const items = cycles.length ? await getReviewItems(cycles[0].cycle_id) : [];
      const elapsedMs = Date.now() - start;
      console.log(
        `[perf] access-review.cycles+items: ${cycles.length}/${items.length} in ${elapsedMs} ms (max ${maxMs} ms)`,
      );
      expect(cycles.length).toBeGreaterThan(0);
      expect(elapsedMs).toBeGreaterThan(0);
      expect(elapsedMs).toBeLessThan(maxMs);
    },
    300000,
  );
});
