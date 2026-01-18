import { apiClient } from '@/lib/axios';

const downloadReport = async (
  endpoint: string,
  filenamePrefix: string,
  year: number,
  month: number,
): Promise<void> => {
  const response = await apiClient.get(endpoint, {
    params: { year, month },
    responseType: 'blob',
  });

  if (
    globalThis.window === undefined ||
    globalThis.document === undefined ||
    globalThis.URL?.createObjectURL === undefined
  ) {
    return;
  }
  const url = globalThis.URL.createObjectURL(new Blob([response.data]));
  const link = globalThis.document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filenamePrefix}_${year + 543}_${String(month).padStart(2, '0')}.xlsx`);
  globalThis.document.body.appendChild(link);
  link.click();
  link.remove();
  if (globalThis.URL?.revokeObjectURL !== undefined) {
    globalThis.URL.revokeObjectURL(url);
  }
};

/**
 * ดาวน์โหลดรายงานสรุป (ใบปะหน้า) - Summary Report
 */
export async function downloadSummaryReport(year: number, month: number): Promise<void> {
  try {
    await downloadReport('/api/reports/summary', 'PHTS_Summary', year, month);
  } catch (error) {
    console.error('Download failed:', error);
    throw new Error('ไม่สามารถดาวน์โหลดรายงานได้');
  }
}

/**
 * ดาวน์โหลดรายงานรายละเอียดรายบุคคล - Detail Report
 */
export async function downloadDetailReport(year: number, month: number): Promise<void> {
  try {
    await downloadReport('/api/reports/detail', 'PHTS_Detail', year, month);
  } catch (error) {
    console.error('Download failed:', error);
    throw new Error('ไม่สามารถดาวน์โหลดรายงานได้');
  }
}
