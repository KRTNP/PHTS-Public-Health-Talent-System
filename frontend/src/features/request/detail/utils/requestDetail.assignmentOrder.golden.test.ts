import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { parseAssignmentOrderSummary } from './requestDetail.assignmentOrder'

const extractDocumentMarkdown = (text: string, fileName: string): string => {
  const escapedName = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const blockPattern = new RegExp(`เอกสาร:\\s*${escapedName}\\s*\\n([\\s\\S]*?)(?=\\nเอกสาร:|$)`)
  const match = text.match(blockPattern)
  return (match?.[1] ?? '').trim()
}

describe('parseAssignmentOrderSummary golden OCR files', () => {
  const tesseractFixture = join(
    process.cwd(),
    '..',
    'ocr',
    'output_text',
    'OCR_tesseract_local_tuned.txt',
  )
  const hasGoldenFixtures = existsSync(tesseractFixture)

  const testIfFixtures = hasGoldenFixtures ? test : test.skip

  testIfFixtures('extracts core assignment data from tesseract output for page-5-6.pdf', () => {
    const tesseractText = readFileSync(tesseractFixture, 'utf8')

    const tesseractSummary = parseAssignmentOrderSummary(
      {
        fileName: 'page-5-6.pdf',
        engineUsed: 'tesseract',
        markdown: extractDocumentMarkdown(tesseractText, 'page-5-6.pdf'),
      },
      'นางสาว จริยา ใจใหญ่',
    )

    expect(tesseractSummary).not.toBeNull()
    expect(tesseractSummary?.personMatched).toBe(true)
    expect(tesseractSummary?.personLine).toContain('นางสาวจริยา')
    expect(tesseractSummary?.personLine).toContain('ใจใหญ่')
    expect(tesseractSummary?.sectionTitle).toMatch(/งานเตรียมหรือผลิตยาเคมีบ(?:ำ|ํา)บัด/)
    expect(tesseractSummary?.signedDate).toMatch(/ตุลาคม/)
    expect(tesseractSummary?.dutyHighlights.length).toBeGreaterThanOrEqual(3)
    expect(tesseractSummary?.dutyHighlights.join('\n')).toMatch(/เคมีบ(?:ำ|ํา)บัด/)
    expect(tesseractSummary?.dutyHighlights.join('\n')).not.toMatch(/วัณโรค/)

  })

  testIfFixtures('matches multiple personnel names on real OCR text with section-specific duties', () => {
    const markdown = extractDocumentMarkdown(readFileSync(tesseractFixture, 'utf8'), 'page-5-6.pdf')

    const hivSummary = parseAssignmentOrderSummary(
      {
        fileName: 'page-5-6.pdf',
        engineUsed: 'tesseract',
        markdown,
      },
      'นางสาวอรจิตรา จันทร์ตระกูล',
    )

    const hivSummary2 = parseAssignmentOrderSummary(
      {
        fileName: 'page-5-6.pdf',
        engineUsed: 'tesseract',
        markdown,
      },
      'นางสาวพิชญ์สินี ฝั้นจักรสาย',
    )

    expect(hivSummary).not.toBeNull()
    expect(hivSummary?.personMatched).toBe(true)
    expect(hivSummary?.sectionTitle).toMatch(/HIV/)
    expect(hivSummary?.dutyHighlights.join('\n')).toMatch(/HIV/)

    expect(hivSummary2).not.toBeNull()
    expect(hivSummary2?.personMatched).toBe(true)
    expect(hivSummary2?.sectionTitle).toMatch(/HIV/)
    expect(hivSummary2?.dutyHighlights.join('\n')).toMatch(/HIV/)
  })
})
