import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Sparkles, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

import type { LicenseOcrSummary } from '../utils/requestDetail.licenseOcr';

export function LicenseOcrSummaryCard({ summary }: { summary: LicenseOcrSummary }) {
  return (
    <Card className="shadow-sm border-border/60 overflow-hidden">
      {/* 1. Header มาตรฐานเดียวกับการ์ด OCR อื่นๆ */}
      <CardHeader className="pb-4 bg-muted/10 border-b border-border/40">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              ข้อมูลจาก OCR ของใบอนุญาต
            </CardTitle>
            <CardDescription className="mt-1">
              ใช้เปรียบเทียบกับข้อมูลใบอนุญาตในระบบ
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

      <CardContent className="pt-5 space-y-5">
        {/* 2. Overall Status Banner พร้อม Icon สื่อความหมาย */}
        <div
          className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium ${
            summary.summaryStatus === 'match'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : summary.summaryStatus === 'near'
                ? 'border-blue-200 bg-blue-50 text-blue-800'
                : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}
        >
          {summary.summaryStatus === 'match' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : summary.summaryStatus === 'near' ? (
            <Info className="w-5 h-5 text-blue-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          )}

          <div className="flex-1">
            {summary.summaryStatus === 'match'
              ? 'ข้อมูลทั้งหมดตรงกับระบบ'
              : summary.summaryStatus === 'near'
                ? `มีข้อมูลที่ใกล้เคียง ${summary.nearCount} รายการ (โปรดตรวจสอบ)`
                : `พบจุดที่ข้อมูลไม่ตรงกัน ${summary.reviewCount} รายการ (ต้องตรวจสอบ)`}
          </div>
        </div>

        {/* 3. Metadata Section */}
        <div className="flex justify-between items-center py-2 border-b border-dashed border-border/60">
          <span className="text-sm text-muted-foreground">ไฟล์ต้นทางที่ตรวจพบ</span>
          <span className="text-sm font-medium text-foreground">{summary.fileName}</span>
        </div>

        {/* 4. Comparison List */}
        <div className="space-y-4">
          {summary.checks.map((check) => {
            const isMatch = check.status === 'match';
            const isNear = check.status === 'near';

            return (
              <div
                key={check.label}
                // ลดความเด่นของกล่องที่ Match แล้ว และเน้นกล่องที่มีปัญหา
                className={`rounded-lg border p-4 transition-colors ${
                  isMatch
                    ? 'border-border/40 bg-muted/10'
                    : isNear
                      ? 'border-blue-100 bg-blue-50/30'
                      : 'border-amber-200 bg-amber-50/30'
                }`}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{check.label}</p>
                  <Badge
                    variant="outline"
                    className={
                      isMatch
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : isNear
                          ? 'border-blue-200 bg-blue-50 text-blue-700'
                          : 'border-amber-200 bg-amber-50 text-amber-700'
                    }
                  >
                    {isMatch ? 'ตรงกัน' : isNear ? 'ใกล้เคียง' : 'ควรตรวจสอบ'}
                  </Badge>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 pt-3 border-t border-border/40">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">ข้อมูลในระบบ</p>
                    <p className="text-sm font-medium text-foreground/80">
                      {check.expectedValue || '-'}
                    </p>
                  </div>
                  {/* Highlight ฝั่ง OCR หากข้อมูลไม่ตรงกัน เพื่อดึงดูดสายตา */}
                  <div
                    className={`space-y-1 rounded-md px-2 py-1.5 -mx-2 -my-1.5 ${!isMatch ? (isNear ? 'bg-blue-100/50' : 'bg-amber-100/50') : ''}`}
                  >
                    <p className="text-xs text-muted-foreground">ข้อมูลที่ OCR พบ</p>
                    <p
                      className={`text-sm font-medium ${!isMatch ? (isNear ? 'text-blue-900' : 'text-amber-900') : 'text-foreground'}`}
                    >
                      {check.extractedValue || '-'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
