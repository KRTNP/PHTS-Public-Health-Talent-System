'use client';

import { FileText, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type AttachmentItem = {
  id: number;
  name: string;
  type?: string;
  path: string;
};

function resolveFileUrl(filePath: string): string {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';
  const baseUrl = apiBase.replace(/\/api\/?$/, '');
  const normalizedPath = filePath.includes('uploads/')
    ? filePath.slice(filePath.indexOf('uploads/'))
    : filePath;
  return `${baseUrl}/${normalizedPath}`;
}

export function AttachmentList({
  title = 'เอกสารแนบ',
  items,
  onPreview,
  onDelete,
}: {
  title?: string;
  items: AttachmentItem[];
  onPreview: (url: string, name: string) => void;
  onDelete?: (id: number) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
      {/* Header section with consistent semantic colors */}
      <div className="flex items-center gap-2 bg-muted/40 px-4 py-3 border-b border-border">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </div>

      <div className="p-2 space-y-1">
        {items.map((item) => {
          const fileUrl = resolveFileUrl(item.path);
          return (
            <div
              key={item.id}
              className="group flex items-center justify-between rounded-md border border-transparent hover:border-border hover:bg-muted/50 transition-all"
            >
              {/* ขยาย Clickable Area ให้ครอบคลุมบริเวณชื่อไฟล์ */}
              <button
                type="button"
                onClick={() => onPreview(fileUrl, item.name)}
                className="flex flex-1 items-center min-w-0 px-3 py-2.5 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
                aria-label={`ดูตัวอย่างเอกสาร ${item.name}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                    {item.name}
                  </p>
                  {item.type && <p className="text-xs text-muted-foreground mt-0.5">{item.type}</p>}
                </div>
              </button>

              {onDelete && (
                <div className="px-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation(); // ป้องกันไม่ให้การคลิกปุ่มลบไป Trigger การเปิด Preview
                      onDelete(item.id);
                    }}
                    // ซ่อนปุ่มลบจนกว่าจะ Hover เพื่อลด Visual Noise และลดการเผลอกดผิด
                    className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                    aria-label="ลบเอกสารแนบ"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
