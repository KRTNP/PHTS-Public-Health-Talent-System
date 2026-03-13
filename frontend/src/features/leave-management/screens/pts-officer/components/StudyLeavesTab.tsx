'use client';

import { ReturnReportStatusBadge, TableRowViewAction } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import type { LeaveRecord } from '@/features/leave-management/core/types';
import { Edit, GraduationCap, FileText, Info } from 'lucide-react';

export function StudyLeavesTab({
  records,
  formatDateDisplay,
  onViewDetail,
  onEdit,
  isLoading,
  isError,
  onRetry,
}: {
  records: LeaveRecord[];
  formatDateDisplay: (date: string) => string;
  onViewDetail: (record: LeaveRecord) => void;
  onEdit: (record: LeaveRecord) => void;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  return (
    // UX Fix: ป้องกันขอบ Focus สีดำ
    <TabsContent value="study" className="m-0 border-none outline-none">
      {/* UX Fix: รักษาความสูงขั้นต่ำไว้เพื่อความเสถียรของ Layout */}
      <Card className="border-border shadow-sm flex flex-col min-h-[600px]">
        <CardHeader className="py-4 px-5 sm:px-6 border-b bg-muted/5 space-y-1.5">
          <CardTitle className="text-base font-semibold flex items-center gap-2.5">
            {/* UX Fix: ใส่สีเน้น Icon ให้สอดคล้องกับภาพรวมของแอป */}
            <div className="p-1.5 bg-purple-500/10 text-purple-600 rounded-md shadow-sm">
              <GraduationCap className="h-4 w-4" />
            </div>
            รายการลาศึกษาต่อ/อบรม
          </CardTitle>
          <CardDescription className="text-xs leading-relaxed max-w-3xl">
            ใช้ตรวจสอบรายละเอียดการศึกษาต่อหรืออบรมของแต่ละบุคคล
            พร้อมติดตามสถานะการรายงานตัวกลับเข้าทำงาน
          </CardDescription>
        </CardHeader>

        <CardContent className="p-5 sm:p-6 flex-1 bg-muted/5">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-48 w-full rounded-xl" />
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-16 text-sm">
              <div className="p-4 bg-destructive/10 rounded-full">
                <FileText className="h-8 w-8 text-destructive" />
              </div>
              <span className="text-muted-foreground">ไม่สามารถโหลดข้อมูลได้</span>
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="bg-background shadow-sm"
              >
                ลองใหม่อีกครั้ง
              </Button>
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 text-muted-foreground">
              <GraduationCap className="h-12 w-12 opacity-20 mb-4" />
              <p className="text-sm">ไม่พบรายการลาศึกษาต่อหรืออบรม</p>
            </div>
          ) : (
            <div className="space-y-5">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="rounded-xl border bg-background shadow-sm hover:shadow-md hover:border-primary/20 transition-all overflow-hidden group"
                >
                  {/* Card Top Section */}
                  <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <AvatarPlaceholder name={record.personName} />
                      <div className="space-y-0.5 mt-0.5">
                        <p className="font-semibold text-foreground text-base leading-none">
                          {record.personName}
                        </p>
                        <p className="text-xs text-muted-foreground">{record.personPosition}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      {record.requireReport && (
                        <ReturnReportStatusBadge status={record.reportStatus} tone="soft" />
                      )}
                      {record.documentStartDate && (
                        <Badge variant="outline" className="text-[10px] font-normal bg-muted">
                          มีข้อมูลตามเอกสาร
                        </Badge>
                      )}
                      <div className="flex gap-1 ml-auto sm:ml-2">
                        <TableRowViewAction
                          onClick={() => onViewDetail(record)}
                          className="hover:bg-primary/10 transition-colors"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          onClick={() => onEdit(record)}
                          title="แก้ไขข้อมูล"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="px-4 sm:px-5 pb-5 space-y-4">
                    {/* Study Info Highlight Box */}
                    {record.studyInfo && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-purple-50/50 border border-purple-100/50 p-4 rounded-lg">
                        <div className="space-y-1">
                          <p className="text-purple-600/70 text-[10px] uppercase font-semibold tracking-wider">
                            สถานศึกษา
                          </p>
                          <p
                            className="font-medium text-purple-950 truncate"
                            title={record.studyInfo.institution}
                          >
                            {record.studyInfo.institution || '-'}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-purple-600/70 text-[10px] uppercase font-semibold tracking-wider">
                            หลักสูตร
                          </p>
                          <p
                            className="font-medium text-purple-950 truncate"
                            title={record.studyInfo.program}
                          >
                            {record.studyInfo.program || '-'}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-purple-600/70 text-[10px] uppercase font-semibold tracking-wider">
                            สาขาวิชา
                          </p>
                          <p
                            className="font-medium text-purple-950 truncate"
                            title={record.studyInfo.field}
                          >
                            {record.studyInfo.field || '-'}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-purple-600/70 text-[10px] uppercase font-semibold tracking-wider">
                            เริ่มศึกษา
                          </p>
                          <p className="font-medium text-purple-950 font-mono text-xs mt-0.5">
                            {formatDateDisplay(record.studyInfo.startDate)}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Standard Info Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-5 text-sm pt-2">
                      <div>
                        <p className="text-muted-foreground text-[10px] uppercase font-semibold tracking-wider mb-1">
                          วันที่ลาตามที่ผู้ใช้ลงไว้ในระบบ
                        </p>
                        <p className="font-medium text-xs font-mono">
                          {formatDateDisplay(record.userStartDate)} -{' '}
                          {formatDateDisplay(record.userEndDate)}
                        </p>
                      </div>

                      <div>
                        <p className="text-muted-foreground text-[10px] uppercase font-semibold tracking-wider mb-1">
                          จำนวนวัน
                        </p>
                        <p className="font-medium text-xs">
                          <span className="font-mono text-sm">{record.days}</span> วัน
                        </p>
                      </div>

                      {record.documentStartDate ? (
                        <div className="md:col-span-2">
                          <p className="text-amber-600/80 text-[10px] uppercase font-semibold tracking-wider mb-1">
                            อ้างอิงตามเอกสาร (Document)
                          </p>
                          <p className="font-medium text-amber-700 text-xs font-mono">
                            {formatDateDisplay(record.documentStartDate)} -{' '}
                            {formatDateDisplay(record.documentEndDate || '')}
                            {record.documentDays && (
                              <span className="ml-2 text-muted-foreground font-sans">
                                ({record.documentDays} วัน)
                              </span>
                            )}
                          </p>
                        </div>
                      ) : (
                        <div className="md:col-span-2">
                          <p className="text-muted-foreground text-[10px] uppercase font-semibold tracking-wider mb-1">
                            อ้างอิงตามเอกสาร
                          </p>
                          <p className="text-muted-foreground/50 text-xs italic">- ยังไม่ระบุ -</p>
                        </div>
                      )}
                    </div>

                    {/* Notes & Suggestions */}
                    {(record.note || record.reportStatus === 'pending') && (
                      <div className="pt-4 border-t border-border/40 space-y-3">
                        {record.note && (
                          <div className="bg-muted/30 p-3 rounded-md border border-border/50">
                            <p className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground mb-1">
                              หมายเหตุ
                            </p>
                            <p className="text-xs text-foreground/80 leading-relaxed">
                              {record.note}
                            </p>
                          </div>
                        )}

                        {record.reportStatus === 'pending' && (
                          <div className="flex gap-2 items-start text-xs text-amber-700 bg-amber-50/50 p-2.5 rounded-md border border-amber-200/50">
                            <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                            <p className="leading-relaxed">
                              ควรเปิดดูรายละเอียดเพื่อตรวจสอบว่ามี{' '}
                              <strong>การรายงานตัวคั่นกลาง</strong>{' '}
                              หรือยังต้องบันทึกรายงานตัวเพื่อกลับมาปฏิบัติงานตามปกติ
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}

// Sub Component สำหรับสร้าง Avatar ย่อ เพื่อความสวยงาม
function AvatarPlaceholder({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n.charAt(0))
    .join('')
    .toUpperCase();

  return (
    <div className="h-10 w-10 rounded-full bg-purple-100 border border-purple-200 flex items-center justify-center shrink-0 shadow-sm">
      <span className="text-purple-700 font-semibold text-sm">{initials || '?'}</span>
    </div>
  );
}
