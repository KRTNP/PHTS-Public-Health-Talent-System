import { parseMemoSummary } from './requestDetail.ocrDocuments'

describe('parseMemoSummary normalization', () => {
  test('normalizes memo core fields from noisy OCR (page-1 style)', () => {
    const markdown = [
      'บันทึกข้อความ',
      'ส่วนราชการ โรงพยาบาลอตรดิตถ์ กลุ่มภารกิจด้านการพยาบาล โทร ๒๑๑๒',
      'ที่   อต ๐๐๓๓๑๐๕/๐๐๐๕๓',
      'วันที่  ๑๕ มกราคม ๒๕๒๕',
      'เรื่อง ขอส่งสํา เนาใบอนุญาตประกอบวิชาชีพการพยาบาลและการผดุงครรภ์ ชั้นหนึ่ง',
      'เรียน หัวหน้ากลุ่มงานทรัพยากรบุคคล',
      '๑. นางสาวอัณศยาณัช',
      'แดงไฟ',
      '16/1/2569 14:24 น.',
    ].join('\n')

    const summary = parseMemoSummary(
      { fileName: 'page-1.pdf', markdown },
      'นางสาวอัณศยาณัช แดงไฟ',
    )

    expect(summary).not.toBeNull()
    expect(summary?.documentNo).toBe('อต 0033.105/00053')
    expect(summary?.documentDate).toBe('15 มกราคม 2569')
    expect(summary?.department).toContain('โรงพยาบาลอุตรดิตถ์')
    expect(summary?.subject).toContain('ขอส่งสำเนาใบอนุญาต')
    expect(summary?.personMatched).toBe(true)
  })
})

