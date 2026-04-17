import { ExternalLink, Eye, FileText } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { RequestSectionCard } from "./RequestSectionCard";

type RequestAttachmentFile = {
  attachment_id: string | number;
  file_name: string;
  file_path: string;
  file_type?: string | null;
};

type RequestAttachmentsSectionProps = {
  attachments: RequestAttachmentFile[];
  memoSummary?: ReactNode;
  assignmentOrderSummary?: ReactNode;
  getFileUrl: (file: RequestAttachmentFile) => string;
  isPreviewable: (fileName: string) => boolean;
  getAttachmentLabel: (fileName: string, fileType?: string) => string;
  getOcrMeta?: (fileName: string) => { documentLabel?: string | null; notice?: string | null };
  onPreview: (url: string, name: string) => void;
};

export function RequestAttachmentsSection({
  attachments,
  memoSummary,
  assignmentOrderSummary,
  getFileUrl,
  isPreviewable,
  getAttachmentLabel,
  getOcrMeta,
  onPreview,
}: RequestAttachmentsSectionProps) {
  return (
    <RequestSectionCard title={`ไฟล์แนบ (${attachments.length})`} icon={FileText}>
      {memoSummary}
      {assignmentOrderSummary}
      {attachments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
          <FileText className="h-8 w-8 mb-2 opacity-20" />
          <p className="text-sm">ไม่มีไฟล์เอกสารแนบ</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {attachments.map((file) => {
            const fileUrl = getFileUrl(file);
            const previewable = isPreviewable(file.file_name);
            const ocrMeta = getOcrMeta?.(file.file_name);
            return (
              <div
                key={file.attachment_id}
                className="group relative flex items-start gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/30 hover:border-primary/30 transition-all duration-200"
              >
                <div className="h-10 w-10 shrink-0 rounded bg-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate pr-6" title={file.file_name}>
                    {file.file_name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {getAttachmentLabel(file.file_name, file.file_type ?? undefined)}
                  </p>
                  {ocrMeta?.documentLabel ? (
                    <div className="mt-2">
                      <Badge variant="outline" className="text-[11px]">
                        {ocrMeta.documentLabel}
                      </Badge>
                    </div>
                  ) : null}
                  {ocrMeta?.notice ? (
                    <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                      {ocrMeta.notice}
                    </p>
                  ) : null}
                  <div className="flex items-center gap-2 mt-2 opacity-60 group-hover:opacity-100 transition-opacity">
                    {previewable ? (
                      <button
                        onClick={() => onPreview(fileUrl, file.file_name)}
                        className="text-xs flex items-center hover:text-primary transition-colors hover:underline"
                      >
                        <Eye className="w-3 h-3 mr-1" /> ดูตัวอย่าง
                      </button>
                    ) : null}
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs flex items-center hover:text-primary transition-colors hover:underline"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" /> เปิดไฟล์
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </RequestSectionCard>
  );
}
