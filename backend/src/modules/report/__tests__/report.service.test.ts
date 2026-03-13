import ExcelJS from 'exceljs';

const getPayoutDataForReportMock = jest.fn();
const getPeriodIdMock = jest.fn();
const getMasterRateMapMock = jest.fn();
const getPersonProfileMapMock = jest.fn();

jest.mock('@/modules/snapshot/services/snapshot.service.js', () => ({
  getPayoutDataForReport: getPayoutDataForReportMock,
}));

jest.mock('@/modules/report/repositories/report.repository.js', () => ({
  ReportRepository: {
    getPeriodId: getPeriodIdMock,
    getMasterRateMap: getMasterRateMapMock,
    getPersonProfileMap: getPersonProfileMapMock,
  },
}));

describe('report.service', () => {
  beforeEach(() => {
    getPayoutDataForReportMock.mockReset();
    getPeriodIdMock.mockReset();
    getMasterRateMapMock.mockReset();
    getPersonProfileMapMock.mockReset();
  });

  test('generateSummaryReport does not include director signature row', async () => {
    getPeriodIdMock.mockResolvedValue(38);
    getMasterRateMapMock.mockResolvedValue(new Map());
    getPayoutDataForReportMock.mockResolvedValue({
      data: [
        {
          profession_code: 'NURSE',
          calculated_amount: '5000.00',
          retroactive_amount: '0.00',
          total_payable: '5000.00',
          master_rate_id: null,
        },
      ],
    });

    const { generateSummaryReport } = await import('../services/report.service.js');
    const buffer = await generateSummaryReport(2026, 1);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.getWorksheet('Summary Report');
    const values = worksheet
      ? Array.from({ length: worksheet.rowCount }, (_, index) =>
          worksheet.getRow(index + 1).values,
        )
      : [];
    const flattened = JSON.stringify(values);

    expect(flattened).not.toContain('ผู้อำนวยการโรงพยาบาล');
  });

  test('generateDetailReport does not include preparer or reviewer signature rows', async () => {
    getPeriodIdMock.mockResolvedValue(38);
    getMasterRateMapMock.mockResolvedValue(new Map());
    getPersonProfileMapMock.mockResolvedValue(
      new Map([
        [
          '1234567890123',
          {
            title: 'นางสาว',
            first_name: 'สมหญิง',
            last_name: 'ใจดี',
          },
        ],
      ]),
    );
    getPayoutDataForReportMock.mockResolvedValue({
      data: [
        {
          citizen_id: '1234567890123',
          first_name: 'สมหญิง',
          last_name: 'ใจดี',
          position_name: 'พยาบาลวิชาชีพ',
          profession_code: 'NURSE',
          calculated_amount: '5000.00',
          retroactive_amount: '0.00',
          total_payable: '5000.00',
          pts_rate_snapshot: '5000.00',
          master_rate_id: null,
          remark: null,
        },
      ],
    });

    const { generateDetailReport } = await import('../services/report.service.js');
    const buffer = await generateDetailReport({
      year: 2026,
      month: 1,
      professionCode: 'NURSE',
    });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.getWorksheet('Detail Report');
    const values = worksheet
      ? Array.from({ length: worksheet.rowCount }, (_, index) =>
          worksheet.getRow(index + 1).values,
        )
      : [];
    const flattened = JSON.stringify(values);

    expect(worksheet?.getCell('A3').value).toBe('ลำดับที่');
    expect(worksheet?.getCell('B3').value).toBe('คำนำหน้าชื่อ');
    expect(worksheet?.getCell('C3').value).toBe('ชื่อ');
    expect(worksheet?.getCell('D3').value).toBe('สกุล');
    expect(worksheet?.getCell('E3').value).toBe('ตำแหน่ง');
    expect(worksheet?.getCell('F3').value).toBe('ม.ค.-69');
    expect(worksheet?.getCell('F4').value).toBe('อัตราเงินเพิ่มที่ได้รับ/เดือน(บาท)');
    expect(worksheet?.getCell('G4').value).toBe('ตกเบิก\n(บาท)');
    expect(worksheet?.getCell('H4').value).toBe('รวม\n(บาท)');
    expect(worksheet?.getCell('I3').value).toBe('ประกาศ ก.พ. เรื่อง กำหนดตำแหน่งและเงินเพิ่มสำหรับตำแหน่งที่มีเหตุพิเศษของข้าราชกรพลเรือน(ฉบับที่ 3) พ.ศ. 2560');
    expect(worksheet?.getCell('I4').value).toBe('กลุ่มตำแหน่ง\nตามลักษณะงาน');
    expect(worksheet?.getCell('K4').value).toBe('อัตราเงินเพิ่ม(บาท/เดือน)');
    expect(worksheet?.getCell('I5').value).toBe('กลุ่มที่');
    expect(worksheet?.getCell('J5').value).toBe('ข้อ');
    expect(worksheet?.getCell('L3').value).toBe('หมายเหตุ');
    expect(worksheet?.getCell('B6').value).toBe('นางสาว');
    expect(worksheet?.getCell('C6').value).toBe('สมหญิง');
    expect(worksheet?.getCell('D6').value).toBe('ใจดี');

    expect(flattened).not.toContain('ผู้จัดทำ');
    expect(flattened).not.toContain('ผู้ตรวจสอบ');
  });
});
