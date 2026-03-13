import type { ReactNode } from "react";
import { FileText } from "lucide-react";

type AttachmentListItemCardProps = {
  fileName: string;
  fileTypeLabel: string;
  badges?: ReactNode;
  notices?: ReactNode;
  actions: ReactNode;
  trailingAction?: ReactNode;
};

export function AttachmentListItemCard({
  fileName,
  fileTypeLabel,
  badges,
  notices,
  actions,
  trailingAction,
}: AttachmentListItemCardProps) {
  return (
    <div className="group flex flex-col p-3 rounded-lg border border-border bg-card hover:bg-muted/40 hover:border-primary/20 transition-all duration-200">
      <div className="flex items-start gap-3 mb-3">
        <div className="h-10 w-10 shrink-0 rounded bg-primary/10 flex items-center justify-center">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate" title={fileName}>
            {fileName}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-muted-foreground">{fileTypeLabel}</p>
            {badges}
          </div>
          {notices}
        </div>
      </div>
      <div className="mt-auto flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">{actions}</div>
        {trailingAction}
      </div>
    </div>
  );
}
