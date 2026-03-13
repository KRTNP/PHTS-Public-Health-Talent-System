import type { ReactNode } from 'react';
import { FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type AttachmentListCardProps<T> = {
  title: string;
  count: number;
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  topContent?: ReactNode;
  bottomContent?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
};

export function AttachmentListCard<T>({
  title,
  count,
  items,
  renderItem,
  topContent,
  bottomContent,
  emptyTitle = 'ยังไม่มีไฟล์แนบ',
  emptyDescription,
  className,
}: AttachmentListCardProps<T>) {
  return (
    <Card className={cn('shadow-sm border-border/60 overflow-hidden', className)}>
      {/* ใช้ CardHeader เพื่อรักษาโครงสร้างมาตรฐานและแยกส่วนหัวออกจากเนื้อหาอย่างชัดเจน */}
      <CardHeader className="border-b border-border/40 bg-muted/10 pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span>
            {title} <span className="text-muted-foreground font-normal ml-1">({count})</span>
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-6">
        {topContent && <div className="mb-6">{topContent}</div>}

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed border-border/60">
            {/* เพิ่มกรอบวงกลมรองรับไอคอนเพื่อให้ Empty State ดูสมบูรณ์ขึ้น */}
            <div className="p-3 bg-muted/50 rounded-full mb-3">
              <FileText className="h-8 w-8 opacity-40" />
            </div>
            <p className="text-sm font-medium text-foreground/80">{emptyTitle}</p>
            {emptyDescription ? (
              <p className="mt-1 text-xs text-muted-foreground max-w-sm">{emptyDescription}</p>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
            {items.map((item, index) => renderItem(item, index))}
          </div>
        )}

        {bottomContent && <div className="mt-6">{bottomContent}</div>}
      </CardContent>
    </Card>
  );
}
