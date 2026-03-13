import type { OcrBatchResultItem } from '@/modules/ocr/entities/ocr-precheck.entity.js';
import { classifyOcrDocument } from '@/modules/ocr/services/ocr-document-classifier.service.js';
import {
  buildOcrLines,
  evaluateOcrFields,
  parseOcrFields,
} from '@/modules/ocr/services/ocr-document-fields.service.js';

export { classifyOcrDocument } from '@/modules/ocr/services/ocr-document-classifier.service.js';

export const enrichOcrBatchResult = (item: OcrBatchResultItem): OcrBatchResultItem => {
  if (!item.ok || !item.markdown) return item;
  if (item.document_kind && item.fields && item.missing_fields && item.quality) {
    return item;
  }

  const markdown = buildOcrLines(item.markdown).join('\n');
  const lines = buildOcrLines(item.markdown);
  const document_kind = classifyOcrDocument(item);
  const { fields, requiredKeys } = parseOcrFields(document_kind, markdown, lines);
  const { missing_fields, quality } = evaluateOcrFields(fields, requiredKeys);

  return {
    ...item,
    document_kind,
    fields,
    missing_fields,
    fallback_reason: missing_fields.length > 0 ? 'missing_required_fields' : undefined,
    quality,
  };
};
