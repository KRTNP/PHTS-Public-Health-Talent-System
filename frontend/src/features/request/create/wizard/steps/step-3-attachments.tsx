'use client';
import { CloudUpload, FileText, Lightbulb, Eye, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AttachmentPreviewDialog } from '@/components/common';
import { toast } from 'sonner';

import { RequestFormData, RequestWithDetails } from '@/types/request.types';
import { detectOcrDocumentKind, getOcrDocumentTypeLabel } from '@/features/request/detail/utils';

interface Step3Props {
  data: RequestFormData;
  onUpload: (file: File) => void;
  onRemove: (index: number) => void;
  onRemoveExisting?: (attachmentId: number) => void;
  showExistingAttachments?: boolean;
  ocrPrecheck?: RequestWithDetails['ocr_precheck'];
}

type OcrResult = NonNullable<
  NonNullable<RequestWithDetails['ocr_precheck']>['results']
>[number];
type ExistingAttachment = NonNullable<RequestFormData['attachments']>[number];

const normalizeFileKey = (value: string): string => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return '';
  const segments = normalized.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? normalized;
};

const formatFileSizeLabel = (size?: number | null): string => {
  if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) {
    return 'ไม่ระบุขนาดไฟล์';
  }
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
};

export function Step3Attachments({
  data,
  onUpload,
  onRemove,
  onRemoveExisting,
  showExistingAttachments = false,
  ocrPrecheck,
}: Step3Props) {
  const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewName, setPreviewName] = useState('');

  const resolveFileUrl = (filePath: string): string => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';
    const baseUrl = apiBase.replace(/\/api\/?$/, '');
    const normalizedPath = filePath.includes('uploads/')
      ? filePath.slice(filePath.indexOf('uploads/'))
      : filePath;
    return `${baseUrl}/${normalizedPath}`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const oversizedFiles: string[] = [];
      Array.from(e.target.files).forEach((file) => {
        if (file.size > MAX_FILE_SIZE_BYTES) {
          oversizedFiles.push(file.name);
          return;
        }
        onUpload(file);
      });
      if (oversizedFiles.length > 0) {
        const previewNames = oversizedFiles.slice(0, 2).join(', ');
        const suffix = oversizedFiles.length > 2 ? ` และอีก ${oversizedFiles.length - 2} ไฟล์` : '';
        toast.error(`ไฟล์เกินขนาด 5MB: ${previewNames}${suffix}`);
      }
      e.target.value = '';
    }
  };

  const handlePreview = (url: string, name: string) => {
    setPreviewUrl(url);
    setPreviewName(name);
    setPreviewOpen(true);
  };

  const existingAttachments = showExistingAttachments ? data.attachments ?? [] : [];
  const dedupedExistingAttachments = useMemo(() => {
    const byName = new Map<string, ExistingAttachment>();
    for (const attachment of existingAttachments) {
      const key = normalizeFileKey(attachment.file_name);
      if (!key) continue;
      const current = byName.get(key);
      if (!current || attachment.attachment_id > current.attachment_id) {
        byName.set(key, attachment);
      }
    }
    return Array.from(byName.values());
  }, [existingAttachments]);
  const totalSelectedCount = data.files.length + dedupedExistingAttachments.length;
  const ocrResultMap = useMemo(() => {
    const map = new Map<string, OcrResult>();
    for (const result of ocrPrecheck?.results ?? []) {
      const normalizedName = String(result?.name ?? '').trim();
      if (!normalizedName) continue;
      const exactKey = normalizedName.toLowerCase();
      const basenameKey = normalizeFileKey(normalizedName);
      map.set(exactKey, result);
      if (basenameKey && basenameKey !== exactKey) {
        map.set(basenameKey, result);
      }
    }
    return map;
  }, [ocrPrecheck?.results]);

  const getOcrLabel = (fileName: string): string | null => {
    const exactKey = String(fileName ?? '').trim().toLowerCase();
    const basenameKey = normalizeFileKey(fileName);
    const result = ocrResultMap.get(exactKey) ?? ocrResultMap.get(basenameKey);
    if (!result) return null;

    const backendKind = String(result.document_kind ?? '').trim().toLowerCase();
    const detectedKind = result.markdown
      ? detectOcrDocumentKind({
          fileName,
          markdown: result.markdown,
        })
      : 'general';

    const kind =
      backendKind === 'general' && detectedKind !== 'general'
        ? detectedKind
        : backendKind || (detectedKind !== 'general' ? detectedKind : '');

    switch (kind) {
      case 'memo':
      case 'assignment_order':
      case 'license':
      case 'general':
        return getOcrDocumentTypeLabel(kind);
      default:
        return kind || null;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-1">
        <h3 className="text-xl font-semibold text-primary">แนบเอกสารประกอบ</h3>
        <p className="text-muted-foreground">
          กรุณาแนบเอกสารที่เกี่ยวข้อง เช่น ใบประกอบวิชาชีพ, คำสั่งแต่งตั้ง หรือหลักฐานอื่นๆ
        </p>
      </div>

      <Alert className="bg-blue-50 border-blue-100 text-blue-800">
        <Lightbulb className="h-4 w-4 text-blue-600" />
        <AlertDescription>
          สามารถแนบไฟล์ได้หลายไฟล์ (รองรับ PDF, JPG, PNG ขนาดไม่เกิน 5MB)
        </AlertDescription>
      </Alert>

      {/* Upload Area */}
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/30 to-blue-300/30 rounded-2xl blur opacity-30 group-hover:opacity-75 transition duration-500"></div>
        <div className="relative border-2 border-dashed border-primary/20 bg-background hover:bg-secondary/20 transition-all rounded-xl p-10 text-center cursor-pointer">
          <input
            type="file"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleFileChange}
            multiple
          />
          <div className="flex flex-col items-center justify-center gap-4 pointer-events-none">
            <div className="p-4 bg-primary/10 rounded-full text-primary group-hover:scale-110 transition-transform duration-300">
              <CloudUpload className="h-10 w-10" />
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                คลิกเพื่อเลือกไฟล์
              </p>
              <p className="text-sm text-muted-foreground mt-1">หรือลากไฟล์มาวางที่นี่</p>
            </div>
          </div>
        </div>
      </div>

      {/* File Lists */}
      <div className="space-y-6">
        {totalSelectedCount > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">ไฟล์แนบ ({totalSelectedCount})</Label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.files.map((file, idx) => (
                <div
                  key={`local-${idx}-${file.name}`}
                  className="relative flex items-start gap-3 p-3 rounded-lg border bg-card shadow-sm hover:shadow-md transition-shadow group"
                >
                  <div className="p-2.5 bg-primary/10 rounded-md shrink-0">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate pr-6">{file.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{formatFileSizeLabel(file.size)}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => handlePreview(URL.createObjectURL(file), file.name)}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" /> ดูตัวอย่าง
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => onRemove(idx)}
                    className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {dedupedExistingAttachments.map((attachment) => {
                const ocrLabel = getOcrLabel(attachment.file_name);
                return (
                  <div
                    key={`existing-${attachment.attachment_id}`}
                    className="relative flex items-start gap-3 p-3 rounded-lg border bg-card shadow-sm hover:shadow-md transition-shadow group"
                  >
                    <div className="p-2.5 bg-primary/10 rounded-md shrink-0">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate pr-6">{attachment.file_name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatFileSizeLabel(attachment.file_size)}
                      </p>
                      {ocrLabel ? (
                        <div className="mt-2">
                          <Badge variant="outline" className="text-[11px]">
                            {ocrLabel}
                          </Badge>
                        </div>
                      ) : null}
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() =>
                            handlePreview(resolveFileUrl(attachment.file_path), attachment.file_name)
                          }
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" /> ดูตัวอย่าง
                        </button>
                      </div>
                    </div>
                    {onRemoveExisting ? (
                      <button
                        onClick={() => onRemoveExisting(attachment.attachment_id)}
                        className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Preview Dialog */}
      <AttachmentPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        previewUrl={previewUrl}
        previewName={previewName}
      />
    </div>
  );
}
