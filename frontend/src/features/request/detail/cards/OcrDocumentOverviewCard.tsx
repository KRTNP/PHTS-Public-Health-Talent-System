import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileSearch, Sparkles } from 'lucide-react';

import type { OcrDocumentOverview } from '../utils/requestDetail.ocrDocuments';

// ปรับปรุง Stat Component ให้ฉลาดขึ้นในการแสดงผลค่า 0
const Stat = ({ label, value }: { label: string; value: number }) => {
  const isZero = value === 0;

  return (
    <div
      className={`rounded-lg border border-border/60 p-4 transition-colors ${
        isZero ? 'bg-muted/10 opacity-60' : 'bg-muted/20'
      }`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-1.5 text-2xl font-semibold tracking-tight ${
          isZero ? 'text-muted-foreground' : 'text-foreground'
        }`}
      >
        {value}
      </p>
    </div>
  );
};

export function OcrDocumentOverviewCard({ overview }: { overview: OcrDocumentOverview }) {
  return (
    <Card className="shadow-sm border-border/60 overflow-hidden">
      {/* ใช้ Header Design มาตรฐานเดียวกับการ์ด OCR ตัวอื่นๆ */}
      <CardHeader className="pb-4 bg-muted/10 border-b border-border/40">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <FileSearch className="w-4 h-4 text-muted-foreground" />
              สรุปเอกสารจาก OCR
            </CardTitle>
            <CardDescription className="mt-1">
              สรุปว่า OCR พบเอกสารประเภทใดบ้างในชุดนี้
            </CardDescription>
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

      {/* ปรับ Padding ด้านบนให้สอดคล้องกับเส้นคั่น */}
      <CardContent className="pt-6 grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Stat label="หนังสือนำส่ง" value={overview.memo} />
        <Stat label="ใบอนุญาต" value={overview.license} />
        <Stat label="คำสั่งมอบหมายงาน" value={overview.assignment_order} />
        <Stat label="เอกสารอื่น" value={overview.general} />
      </CardContent>
    </Card>
  );
}
