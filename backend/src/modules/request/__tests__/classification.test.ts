import { Pool } from 'mysql2/promise';
import { createTestPool, setupSchema, cleanTables, seedMasterRates, DB_NAME } from './utils.js';

let pool: Pool;
let findRecommendedRate: any;

beforeAll(async () => {
  process.env.DB_NAME = DB_NAME;
  pool = await createTestPool();
  await setupSchema(pool);
  await cleanTables(pool);
  await seedMasterRates(pool);

  const service = await import('../classification.service.js');
  findRecommendedRate = service.findRecommendedRate;
});

afterAll(async () => {
  if (pool) await pool.end();
});

describe('Classification Logic (Strict Check)', () => {
  const createEmp = async (
    cid: string,
    pos: string,
    spec: string = '',
    expert: string = '',
    subDept: string = '',
  ) => {
    await pool.query(
      `INSERT INTO pts_employees (citizen_id, position_name, specialist, expert, sub_department) VALUES (?, ?, ?, ?, ?)`,
      [cid, pos, spec, expert, subDept],
    );
  };

  test('Doctor: Forensic Specialist -> Group 3 Item 3.4 (15,000)', async () => {
    const cid = 'DOC_FORENSIC';
    await createEmp(cid, 'นายแพทย์ชำนาญการ', 'สาขานิติเวชศาสตร์', '', '');
    const rate = await findRecommendedRate(cid);
    expect(rate?.group_no).toBe(3);
    expect(Number(rate?.amount)).toBe(15000);
    expect(rate?.item_no).toBe('3.4');
  });

  test('Doctor: General with Master Degree -> Group 2 (10,000)', async () => {
    const cid = 'DOC_MASTER';
    await createEmp(cid, 'นายแพทย์ปฏิบัติการ', '', 'ได้รับปริญญาโทสาขาสาธารณสุข', '');
    const rate = await findRecommendedRate(cid);
    expect(rate?.group_no).toBe(2);
    expect(Number(rate?.amount)).toBe(10000);
  });

  test('Dentist: With Diploma -> Group 3 (10,000)', async () => {
    const cid = 'DENT_DIP';
    await createEmp(cid, 'ทันตแพทย์ชำนาญการพิเศษ', '', 'ได้รับวุฒิบัตรฯ', '');
    const rate = await findRecommendedRate(cid);
    expect(rate?.group_no).toBe(3);
    expect(Number(rate?.amount)).toBe(10000);
  });

  test('Nurse: ICU -> Group 3 (2,000)', async () => {
    const cid = 'NURSE_ICU';
    await createEmp(cid, 'พยาบาลวิชาชีพ', '', '', 'หออภิบาลผู้ป่วยวิกฤต (ICU)');
    const rate = await findRecommendedRate(cid);
    expect(rate?.group_no).toBe(3);
    expect(Number(rate?.amount)).toBe(2000);
  });

  test('Allied: Physio -> Group 5 (1,000)', async () => {
    const cid = 'ALLIED_PHYSIO';
    await createEmp(cid, 'นักกายภาพบำบัด', '', '', '');
    const rate = await findRecommendedRate(cid);
    expect(rate?.group_no).toBe(5);
    expect(Number(rate?.amount)).toBe(1000);
  });
});
