import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Sparkles } from 'lucide-react';

import type { MemoSummary } from '../utils/requestDetail.ocrDocuments';

const Field = ({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) => (
  <div className="space-y-1">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p
      className={`text-sm font-medium text-foreground break-words ${
        multiline ? 'whitespace-pre-wrap leading-relaxed' : ''
      }`}
    >
      {value}
    </p>
  </div>
);

export function MemoSummaryCard({ summary }: { summary: MemoSummary }) {
  return (
    <Card className="shadow-sm border-border/60 overflow-hidden">
      {/* ใช้ Header Design เดียวกับการ์ด OCR ตัวอื่นๆ เพื่อความเป็นมาตรฐาน */}
      <CardHeader className="pb-4 bg-muted/10 border-b border-border/40">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              สรุปหนังสือนำส่ง
            </CardTitle>
            <CardDescription className="mt-1">ข้อมูลสำคัญจากหนังสือนำส่ง</CardDescription>
          </div>
          <Badge
            variant="secondary"
            className="shrink-0 font-normal flex items-center gap-1.5 bg-primary/10 text-primary hover:bg-primary/20"
          >
            <Sparkles className="w-3 h-3" />
            อ่านด้วย OCR
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {/* Group 1: Metadata (จัดเรียงใน Grid เพื่อประหยัดพื้นที่แนวตั้ง) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-4">
          <div className="sm:col-span-2">
            <Field label="ไฟล์ต้นทาง" value={summary.fileName} />
          </div>
          {summary.documentNo && <Field label="เลขที่หนังสือ" value={summary.documentNo} />}
          {summary.documentDate && <Field label="วันที่หนังสือ" value={summary.documentDate} />}
          {summary.department && <Field label="ส่วนราชการ" value={summary.department} />}
          {summary.addressedTo && <Field label="เรียน" value={summary.addressedTo} />}
        </div>

        {/* Group 2: Content (แสดงผลเต็มความกว้างและแยกด้วยเส้นประ) */}
        {(summary.subject || summary.personLine) && (
          <div className="space-y-5 pt-5 border-t border-dashed border-border/60">
            {summary.subject && <Field label="เรื่อง" value={summary.subject} multiline />}
            {summary.personLine && (
              <Field label="บรรทัดที่พบชื่อ" value={summary.personLine} multiline />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
