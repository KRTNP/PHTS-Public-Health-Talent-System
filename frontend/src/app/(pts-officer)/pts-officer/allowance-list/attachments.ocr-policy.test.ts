import {
  buildAllowanceAttachmentOcrPolicy,
  getAllowanceAttachmentOcrDocumentTypeLabel,
  getAllowanceAttachmentOcrUiState,
  shouldShowAllowanceAttachmentOcrAction,
} from './attachments'

describe('allowance attachment OCR policy', () => {
  test('hides OCR action when file already failed OCR or already passed OCR', () => {
    expect(
      shouldShowAllowanceAttachmentOcrAction({
        name: 'general.pdf',
        ok: true,
        document_kind: 'general',
      }),
    ).toBe(false)

    expect(
      shouldShowAllowanceAttachmentOcrAction({
        name: 'failed.pdf',
        ok: false,
        error: 'ocr failed',
      }),
    ).toBe(false)

    expect(
      shouldShowAllowanceAttachmentOcrAction({
        name: 'assignment.pdf',
        ok: true,
        document_kind: 'assignment_order',
      }),
    ).toBe(false)

    expect(
      shouldShowAllowanceAttachmentOcrAction({
        name: 'cleared.pdf',
        suppressed: true,
      }),
    ).toBe(true)

    expect(shouldShowAllowanceAttachmentOcrAction(undefined)).toBe(true)
  })

  test('builds OCR UI state centrally for suppressed warning-only files', () => {
    expect(
      getAllowanceAttachmentOcrUiState({
        fileName: 'page-5-6.pdf',
        result: {
          name: 'page-5-6.pdf',
          ok: true,
          document_kind: 'assignment_order',
        },
        documentLabel: 'คำสั่งมอบหมายงาน',
        suppressActions: true,
        clearableFileNames: new Set(['page-5-6.pdf']),
      }),
    ).toEqual({
      hasOcrResult: true,
      canRunOcr: false,
      canClearOcr: false,
      shouldShowResetHint: false,
    })
  })

  test('builds OCR UI state centrally for license files', () => {
    expect(
      getAllowanceAttachmentOcrUiState({
        fileName: 'page-2.pdf',
        result: {
          name: 'page-2.pdf',
          ok: true,
          document_kind: 'license',
        },
        documentLabel: 'ใบอนุญาต',
        suppressActions: false,
        clearableFileNames: new Set(['page-2.pdf']),
      }),
    ).toEqual({
      hasOcrResult: true,
      canRunOcr: false,
      canClearOcr: false,
      shouldShowResetHint: false,
    })
  })

  test('does not show OCR actions or reset hint for general documents', () => {
    expect(
      getAllowanceAttachmentOcrUiState({
        fileName: 'general.pdf',
        result: {
          name: 'general.pdf',
          ok: true,
          document_kind: 'general',
        },
        documentLabel: 'เอกสารทั่วไป',
        suppressActions: false,
        clearableFileNames: new Set(['general.pdf']),
      }),
    ).toEqual({
      hasOcrResult: true,
      canRunOcr: false,
      canClearOcr: false,
      shouldShowResetHint: false,
    })
  })

  test('prefers backend document kind over noisy markdown re-detection', () => {
    expect(
      getAllowanceAttachmentOcrDocumentTypeLabel({
        name: 'page-2.pdf',
        ok: true,
        markdown: 'ง 1 เร',
        document_kind: 'license',
      }),
    ).toBe('ใบอนุญาต')
  })

  test('falls back to frontend detection when backend still marks noisy assignment order as general', () => {
    expect(
      getAllowanceAttachmentOcrDocumentTypeLabel({
        name: 'page-5-6.pdf',
        ok: true,
        markdown:
          'คําสังกลุ่มงานเภสัชกรรม\nที ๑/๒๕๒๐๕\nเรอง ยกเลิกและมอบหมายเจ้าหน้าที่รับผิดชอบในการปฏิบัติงาน',
        document_kind: 'general',
      }),
    ).toBe('คำสั่งมอบหมายงาน')
  })

  test('falls back to frontend detection when backend still marks noisy license as general', () => {
    expect(
      getAllowanceAttachmentOcrDocumentTypeLabel({
        name: 'page-2.pdf',
        ok: true,
        markdown:
          'ใบอนุญาตปี ๒๕๑๑๓๑๕๐๕๑ ตออายุตรงที ๑\nใบอนุญาตประกอบวิชาจีตการแยายาลและการผดุงครรภ์',
        document_kind: 'general',
      }),
    ).toBe('ใบอนุญาต')
  })

  test('builds unified OCR policy with warning-only state for assignment order that does not match person', () => {
    const policy = buildAllowanceAttachmentOcrPolicy({
      fileName: 'page-5-6.pdf',
      personName: 'นางสาวกันยกร กาญจนวัฒนากุล',
      result: {
        name: 'page-5-6.pdf',
        ok: true,
        document_kind: 'assignment_order',
        markdown:
          'คำสั่งกลุ่มงานเภสัชกรรม\nเรื่อง ยกเลิกและมอบหมายเจ้าหน้าที่รับผิดชอบ\n1.2 นางสาวจริยา ใจใหญ่ เภสัชกรปฏิบัติการ',
      },
      clearableFileNames: new Set(['page-5-6.pdf']),
    })

    expect(policy.documentLabel).toBe('คำสั่งมอบหมายงาน')
    expect(policy.notice).toBe('เป็นคำสั่งมอบหมายงาน แต่ยังไม่พบชื่อบุคลากรคนนี้')
    expect(policy.uiState).toEqual({
      hasOcrResult: true,
      canRunOcr: false,
      canClearOcr: false,
      shouldShowResetHint: false,
    })
  })

  test('does not show assignment-order mismatch warning when OCR splits full name across nearby lines', () => {
    const policy = buildAllowanceAttachmentOcrPolicy({
      fileName: 'page-5-6.pdf',
      personName: 'นางสาว จริยา ใจใหญ่',
      result: {
        name: 'page-5-6.pdf',
        ok: true,
        document_kind: 'assignment_order',
        markdown:
          'คำสั่งกลุ่มงานเภสัชกรรม\nเรื่อง ยกเลิกและมอบหมายเจ้าหน้าที่รับผิดชอบในการปฏิบัติงาน\n1.6 นางสาวจริยา\nเภสัชกรปฏิบัติการ\nใจใหญ่',
      },
      clearableFileNames: new Set(['page-5-6.pdf']),
    })

    expect(policy.notice).toBeNull()
    expect(policy.uiState.canRunOcr).toBe(false)
    expect(policy.uiState.canClearOcr).toBe(true)
    expect(policy.uiState.shouldShowResetHint).toBe(true)
  })

  test('does not show mismatch warning when surname drifts to previous nearby OCR lines', () => {
    const policy = buildAllowanceAttachmentOcrPolicy({
      fileName: 'page-5-6.pdf',
      personName: 'นางสาว จริยา ใจใหญ่',
      result: {
        name: 'page-5-6.pdf',
        ok: true,
        document_kind: 'assignment_order',
        markdown:
          'คำสั่งกลุ่มงานเภสัชกรรม\nเรื่อง ยกเลิกและมอบหมายเจ้าหน้าที่รับผิดชอบในการปฏิบัติงาน\n๑.๕ นางสาวธมลวรรณ,\nเภสัชกรปฏิบัติการ\nใจใหญ่\n๑.6 นางสาวจริยา\nเภสัชกรปฏิบัติการ\nโดยมีหน้าที่ ดังนี้',
      },
      clearableFileNames: new Set(['page-5-6.pdf']),
    })

    expect(policy.notice).toBeNull()
    expect(policy.uiState.canRunOcr).toBe(false)
    expect(policy.uiState.canClearOcr).toBe(true)
    expect(policy.uiState.shouldShowResetHint).toBe(true)
  })

  test('builds unified OCR policy with no run action for license files', () => {
    const policy = buildAllowanceAttachmentOcrPolicy({
      fileName: 'page-2.pdf',
      personName: 'นางสาวอัณศยาณัช แดงไฟ',
      result: {
        name: 'page-2.pdf',
        ok: true,
        document_kind: 'license',
        fields: {
          person_name: 'นางสาวอัณศยาณัช แดงไฟ',
        },
      },
      clearableFileNames: new Set(['page-2.pdf']),
    })

    expect(policy.documentLabel).toBe('ใบอนุญาต')
    expect(policy.notice).toBeNull()
    expect(policy.uiState.canRunOcr).toBe(false)
    expect(policy.uiState.canClearOcr).toBe(false)
    expect(policy.uiState.shouldShowResetHint).toBe(false)
  })

  test('flags assignment order year ambiguity for review queue and allows rerun OCR', () => {
    const policy = buildAllowanceAttachmentOcrPolicy({
      fileName: 'page-5-6.pdf',
      personName: 'นางสาว จริยา ใจใหญ่',
      result: {
        name: 'page-5-6.pdf',
        ok: true,
        document_kind: 'assignment_order',
        markdown:
          'คำสั่งกลุ่มงานเภสัชกรรม\nที่ ๑/ ๒๕๒๐๕\nเรื่อง ยกเลิกและมอบหมายเจ้าหน้าที่รับผิดชอบในการปฏิบัติงาน\n๑.๖ นางสาวจริยา ใจใหญ่ เภสัชกรปฏิบัติการ\nทั้งนี้ ตั้งแต่วันที่ ๑ พฤศจิกายน พ.ศ. ๒๕๐๕\nสั่ง ณ วันที่ ๓ ตุลาคม ๒๕๒๕',
      },
      clearableFileNames: new Set(['page-5-6.pdf']),
    })

    expect(policy.notice).toBe(
      'OCR อ่านปีอาจคลาดเคลื่อน ระบบจัดเข้าคิวควรตรวจยืนยันปีจากเอกสารต้นฉบับ',
    )
    expect(policy.uiState.canRunOcr).toBe(true)
  })

  test('does not show memo mismatch warning when first and last name are split across nearby lines', () => {
    const policy = buildAllowanceAttachmentOcrPolicy({
      fileName: 'page-1.pdf',
      personName: 'นางสาวอัณศยาณัช แดงไฟ',
      result: {
        name: 'page-1.pdf',
        ok: true,
        document_kind: 'memo',
        markdown: [
          'บันทึกข้อความ',
          'ส่วนราชการ โรงพยาบาลอุตรดิตถ์',
          'เรื่อง ขอส่งสำเนาใบอนุญาต',
          '๑. นางสาวอัณศยาณัช',
          '๒. นางนิลยา ธรรมสุทธิ์',
          'แดงไฟ',
        ].join('\n'),
      },
      clearableFileNames: new Set(['page-1.pdf']),
    })

    expect(policy.notice).toBeNull()
    expect(policy.uiState.canRunOcr).toBe(false)
  })

  test('simulation: page-1 memo OCR should match all listed people except genuinely misspelled surname variant', () => {
    const page1Markdown = [
      'บันทึกข้อความ',
      'ส่วนราชการ โรงพยาบาลอตรดิตถ์ กลุ่มภารกิจด้านการพยาบาล โทร ๒๑๑๒',
      'วันที่ ๑๕ มกราคม ๒๕๒๕',
      'เรื่อง ขอส่งสำเนาใบอนุญาต',
      'ดังรายชื่อต่อไปนี้',
      'แดงไฟ',
      '๑. นางสาวอัณศยาณัช',
      '๒. นางนิลยา',
      'ธรรมสุทธิ์',
      '๓. นางชลดา',
      'แขรั้ง',
    ].join('\n')

    const result = {
      name: 'page-1.pdf',
      ok: true,
      document_kind: 'memo',
      markdown: page1Markdown,
    }

    const p1 = buildAllowanceAttachmentOcrPolicy({
      fileName: 'page-1.pdf',
      personName: 'นางสาวอัณศยาณัช แดงไฟ',
      result,
      clearableFileNames: new Set(['page-1.pdf']),
    })
    expect(p1.notice).toBeNull()

    const p2 = buildAllowanceAttachmentOcrPolicy({
      fileName: 'page-1.pdf',
      personName: 'นางนิลยา ธรรมสุทธิ์',
      result,
      clearableFileNames: new Set(['page-1.pdf']),
    })
    expect(p2.notice).toBeNull()

    const p3 = buildAllowanceAttachmentOcrPolicy({
      fileName: 'page-1.pdf',
      personName: 'นางชลดา แขรั้ง',
      result,
      clearableFileNames: new Set(['page-1.pdf']),
    })
    expect(p3.notice).toBeNull()

    const p4 = buildAllowanceAttachmentOcrPolicy({
      fileName: 'page-1.pdf',
      personName: 'นางชลดา แข็ง',
      result,
      clearableFileNames: new Set(['page-1.pdf']),
    })
    expect(p4.notice).toBe('เป็นหนังสือนำส่ง แต่ยังไม่พบชื่อบุคลากรคนนี้')
  })
})
