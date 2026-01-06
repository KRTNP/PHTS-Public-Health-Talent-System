import { apiClient } from '@/lib/axios';

/**
 * ดาวน์โหลดรายงานสรุป (ใบปะหน้า) - Summary Report
 */
export async function downloadSummaryReport(year: number, month: number): Promise<void> {
  try {
    const response = await apiClient.get('/api/reports/summary', {
      params: { year, month },
      responseType: 'blob',
    });

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `PHTS_Summary_${year + 543}_${String(month).padStart(2, '0')}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
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
    const response = await apiClient.get('/api/reports/detail', {
      params: { year, month },
      responseType: 'blob',
    });

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `PHTS_Detail_${year + 543}_${String(month).padStart(2, '0')}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Download failed:', error);
    throw new Error('ไม่สามารถดาวน์โหลดรายงานได้');
  }
}
