'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink, FileText, Image as ImageIcon, FileQuestion, Download } from 'lucide-react';
import Image from 'next/image';

interface AttachmentPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewUrl: string;
  previewName: string;
}

const isPdfFile = (url: string, name?: string) => {
  const lowerUrl = url.toLowerCase();
  const lowerName = String(name ?? '').toLowerCase();
  return (
    lowerUrl.endsWith('.pdf') ||
    lowerName.endsWith('.pdf') ||
    lowerUrl.startsWith('data:application/pdf')
  );
};

const isImageFile = (url: string, name?: string) => {
  const lowerUrl = url.toLowerCase();
  const lowerName = String(name ?? '').toLowerCase();
  return (
    lowerUrl.startsWith('data:image') ||
    ['.png', '.jpg', '.jpeg', '.gif', '.webp'].some(
      (ext) => lowerUrl.endsWith(ext) || lowerName.endsWith(ext),
    )
  );
};

const sanitizePreviewUrl = (rawUrl: string): string | null => {
  const normalized = rawUrl.trim();
  if (!normalized) return null;

  const lower = normalized.toLowerCase();
  if (
    lower.startsWith('data:image/') ||
    lower.startsWith('data:application/pdf')
  ) {
    return normalized;
  }

  if (normalized.startsWith('/')) {
    return normalized;
  }

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'blob:') {
      return normalized;
    }
  } catch {
    return null;
  }

  return null;
};

export function AttachmentPreviewDialog({
  open,
  onOpenChange,
  previewUrl,
  previewName,
}: AttachmentPreviewDialogProps) {
  if (!previewUrl) return null;
  const safePreviewName = previewName || 'ตัวอย่างไฟล์';
  const safePreviewUrl = sanitizePreviewUrl(previewUrl);
  const encodedPreviewUrl = safePreviewUrl ? encodeURI(safePreviewUrl) : null;

  const isPdf = encodedPreviewUrl ? isPdfFile(encodedPreviewUrl, safePreviewName) : false;
  const isImage = encodedPreviewUrl ? isImageFile(encodedPreviewUrl, safePreviewName) : false;

  // Determine Icon based on type
  const FileIcon = isPdf ? FileText : isImage ? ImageIcon : FileQuestion;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* เพิ่ม pr-10 หรือ pr-12 ที่แผงด้านบนเพื่อไม่ให้เนื้อหาไปชนกับปุ่ม X มาตรฐานของ Shadcn */}
      <DialogContent className="max-w-5xl h-[85vh] p-0 gap-0 flex flex-col overflow-hidden border-border shadow-2xl">
        {/* Header - ย้าย Action มาไว้ตรงนี้เพื่อประหยัดพื้นที่ */}
        <DialogHeader className="px-4 py-3 border-b bg-background shrink-0 flex flex-row items-center justify-between space-y-0 pr-12">
          <DialogTitle className="text-base font-semibold flex items-center gap-2 text-foreground truncate">
            <div className="p-1.5 bg-primary/10 rounded-md text-primary shrink-0">
              <FileIcon className="h-4 w-4" />
            </div>
            <span className="truncate" title={safePreviewName}>
              {safePreviewName}
            </span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            แสดงตัวอย่างไฟล์แนบและเปิดไฟล์ในแท็บใหม่ได้
          </DialogDescription>

          <div className="flex items-center shrink-0">
            <Button asChild variant="outline" size="sm" className="h-8 text-xs">
              <a
                href={encodedPreviewUrl || '#'}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => {
                  if (!encodedPreviewUrl) event.preventDefault();
                }}
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                <span className="hidden sm:inline">เปิดแท็บใหม่</span>
              </a>
            </Button>
          </div>
        </DialogHeader>

        {/* Content Area - ขยายได้เต็มที่เพราะไม่มี Footer แล้ว */}
        <div className="flex-1 overflow-auto bg-slate-50/50 relative flex items-center justify-center p-4 w-full">
          {isPdf && (
            <iframe
              title={safePreviewName}
              src={encodedPreviewUrl || ''}
              className="w-full h-full rounded-lg border bg-white shadow-sm"
            />
          )}

          {isImage && (
            <div className="relative w-full h-full flex items-center justify-center">
              <Image
                src={encodedPreviewUrl || ''}
                alt={safePreviewName}
                unoptimized
                width={1600}
                height={1200}
                className="max-w-full max-h-full object-contain rounded-md shadow-sm"
              />
            </div>
          )}

          {!isPdf && !isImage && (
            <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <div className="p-4 bg-muted rounded-full">
                <FileQuestion className="h-10 w-10 opacity-50" />
              </div>
              <p>ไม่สามารถแสดงตัวอย่างไฟล์ประเภทนี้ได้</p>
              <Button asChild variant="outline" size="sm" className="mt-2">
                <a
                  href={encodedPreviewUrl || '#'}
                  download={safePreviewName}
                  onClick={(event) => {
                    if (!encodedPreviewUrl) event.preventDefault();
                  }}
                >
                  <Download className="mr-2 h-4 w-4" /> ดาวน์โหลดไฟล์
                </a>
              </Button>
            </div>
          )}
        </div>

        {/* ลบ Footer ออกทั้งหมดเพื่อความคลีน */}
      </DialogContent>
    </Dialog>
  );
}
