'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  GraduationCap,
  Pencil,
  Trash2,
  User,
  FileText,
  Activity,
  ClipboardCheck,
  Paperclip,
  ChevronDown,
} from 'lucide-react';
import type {
  LeaveRecord,
  LeaveRecordDocument,
} from '@/features/leave-management/core/types';
import type {
  LeaveQuotaStatusResponse,
  LeaveReturnReportEvent,
} from '@/features/leave-management/core/api';
import { deriveReturnReportStatus } from '@/features/leave-management/utils/reportStatus';
import { describeReturnReportEvent } from '@/features/leave-management/utils/returnReportForm';
import { ReturnReportStatusBadge } from '@/components/common';
import { AttachmentList } from '@/components/common';
import { EntitySummaryCard } from '@/components/common';
import { cn } from '@/lib/utils';

const formatQuotaValue = (value: number | null) =>
  value === null ? 'ไม่มีข้อมูลวันลาคงเหลือ' : `${value} วัน`;

const leaveStatusLabel: Record<'upcoming' | 'active' | 'completed', string> = {
  upcoming: 'ยังไม่เริ่มลา',
  active: 'กำลังลา',
  completed: 'สิ้นสุดการลาแล้ว',
};

export function LeaveDetailContent({
  leave,
  getLeaveTypeColor,
  formatDateDisplay,
  documents,
  returnReportEvents = [],
  quotaStatus,
  onPreview,
  onDeleteDocument,
  onEditReturnReportEvent,
  onDeleteReturnReportEvent,
}: {
  leave: LeaveRecord;
  getLeaveTypeColor: (type: string) => string;
  formatDateDisplay: (date: string) => string;
  documents: LeaveRecordDocument[];
  returnReportEvents?: LeaveReturnReportEvent[];
  quotaStatus?: LeaveQuotaStatusResponse | null;
  onPreview: (url: string, name: string) => void;
  onDeleteDocument: (documentId: number) => void;
  onEditReturnReportEvent?: (event: LeaveReturnReportEvent) => void;
  onDeleteReturnReportEvent?: (event: LeaveReturnReportEvent) => void;
}) {
  const derivedReportStatus = deriveReturnReportStatus({
    requireReport: leave.requireReport,
    returnDate: leave.reportDate,
    events: returnReportEvents,
  });
  const reportStatus = derivedReportStatus ?? leave.reportStatus;
  const latestReturnEvent = returnReportEvents.length
    ? [...returnReportEvents].sort((a, b) => a.report_date.localeCompare(b.report_date)).at(-1)
    : null;
  const latestEventResumesStudy = Boolean(
    latestReturnEvent?.resume_date || latestReturnEvent?.resume_study_program,
  );
  const otherQuotaItems =
    quotaStatus?.quotas.filter(
      (quota) => quota.leave_type !== quotaStatus.current_leave?.leave_type,
    ) ?? [];
  const currentLeaveTracksBalance = Boolean(quotaStatus?.current_leave?.tracks_balance);

  return (
    <div className="space-y-6">
      {/* 1. ข้อมูลผู้ลา */}
      <EntitySummaryCard
        title="ข้อมูลผู้ลา"
        icon={User}
        fields={[
          { label: 'ชื่อ-นามสกุล', value: leave.personName },
          { label: 'ตำแหน่ง', value: leave.personPosition },
          { label: 'หน่วยงาน', value: leave.personDepartment },
        ]}
      />

      {/* 2. รายละเอียดการลา */}
      <div className="bg-card rounded-xl border border-border/80 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border/40 bg-muted/10 flex items-center justify-between">
          <div className="flex items-center gap-2 text-base font-bold text-foreground">
            <FileText className="h-4 w-4 text-primary" /> ข้อมูลการลา
          </div>
          <Badge
            variant="outline"
            className={cn(
              'px-3 py-1 font-bold text-xs shadow-sm bg-background border-border',
              getLeaveTypeColor(leave.type),
            )}
          >
            {leave.typeName}
          </Badge>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-4">
            {/* Highlighted Date & Duration Block */}
            <div className="col-span-2 md:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-4 bg-muted/10 p-4 rounded-xl border border-border/50">
              <div className="space-y-1.5 md:col-span-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  วันที่ลาตามที่ผู้ใช้ลงไว้ในระบบ
                </p>
                <p className="text-[15px] font-semibold text-foreground">
                  {formatDateDisplay(leave.userStartDate)} - {formatDateDisplay(leave.userEndDate)}
                </p>
              </div>

              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  จำนวนวัน
                </p>
                <p className="text-base font-bold tabular-nums text-foreground">
                  {leave.days}{' '}
                  <span className="text-xs font-normal text-muted-foreground">วัน</span>
                </p>
              </div>

              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  ต้องรายงานตัวกลับ
                </p>
                <p className="text-sm font-semibold text-foreground mt-1">
                  {leave.requireReport ? (
                    <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded">ใช่</span>
                  ) : (
                    <span className="text-muted-foreground">ไม่จำเป็น</span>
                  )}
                </p>
              </div>
            </div>

            {leave.documentStartDate && (
              <div className="space-y-1.5 md:col-span-2 pl-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  วันที่ลา (อิงเอกสารตัวจริง)
                </p>
                <p className="text-sm font-semibold text-amber-600">
                  {formatDateDisplay(leave.documentStartDate)} -{' '}
                  {formatDateDisplay(leave.documentEndDate || '')}
                </p>
              </div>
            )}

            {leave.note && (
              <div className="col-span-2 md:col-span-4 space-y-2 mt-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-2">
                  หมายเหตุ / เหตุผลการลา
                </p>
                <div className="text-sm text-foreground/90 leading-relaxed bg-muted/20 px-4 py-3 rounded-r-xl border-l-4 border-l-primary/40 border-y border-r border-border/40 shadow-sm">
                  {leave.note}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. สถานะการรายงานตัว */}
      {leave.requireReport && (
        <div
          className={cn(
            'rounded-xl border shadow-sm overflow-hidden',
            reportStatus === 'pending'
              ? 'border-amber-200/80 bg-amber-50/20'
              : 'border-emerald-200/80 bg-emerald-50/20',
          )}
        >
          <div
            className={cn(
              'px-5 py-3.5 border-b flex items-center justify-between',
              reportStatus === 'pending'
                ? 'border-amber-200/50 bg-amber-100/30'
                : 'border-emerald-200/50 bg-emerald-100/30',
            )}
          >
            <div
              className={cn(
                'flex items-center gap-2 text-base font-bold',
                reportStatus === 'pending' ? 'text-amber-800' : 'text-emerald-800',
              )}
            >
              <ClipboardCheck className="h-4 w-4" /> สถานะการรายงานตัวกลับ
            </div>
            <ReturnReportStatusBadge status={reportStatus} tone="strong" />
          </div>

          <div className="p-5 space-y-5">
            {/* Status Message */}
            <div className="text-sm bg-background/80 p-4 rounded-lg border shadow-sm border-black/5">
              {reportStatus === 'pending' && latestEventResumesStudy && (
                <p className="text-amber-700 leading-relaxed">
                  รายการนี้ยังรอการรายงานตัวครั้งสุดท้าย เนื่องจากมีการรายงานตัวก่อนหน้าแต่เป็นการ
                  <strong className="font-bold ml-1">กลับไปศึกษาต่อหรืออบรมต่อ</strong>
                </p>
              )}
              {reportStatus === 'pending' && !latestEventResumesStudy && (
                <p className="text-amber-700 leading-relaxed">
                  รายการนี้ยัง
                  <strong className="font-bold text-amber-800 mx-1">ไม่มีการรายงานตัว</strong>
                  เพื่อกลับมาปฏิบัติงานตามปกติ
                </p>
              )}
              {reportStatus === 'reported' && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <p className="text-emerald-700 font-medium">
                    บุคลากรรายงานตัวเพื่อกลับมาปฏิบัติงานตามปกติเรียบร้อยแล้ว
                  </p>
                  {leave.reportDate && (
                    <span className="text-emerald-600/70 text-xs font-mono bg-emerald-100/50 px-2 py-1 rounded">
                      อัปเดต: {formatDateDisplay(leave.reportDate)}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Timeline */}
            {returnReportEvents.length > 0 && (
              <div className="space-y-4 pt-2 px-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5" /> ประวัติการรายงานตัว
                </p>

                <div className="relative space-y-5 before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px before:h-full before:w-[2px] before:bg-border/60">
                  {returnReportEvents.map((event) => (
                    <div
                      key={`${event.event_id ?? 'new'}-${event.report_date}`}
                      className="relative flex items-start gap-5"
                    >
                      {/* Timeline Dot */}
                      <div className="relative z-10 flex items-center justify-center w-6 h-6 rounded-full bg-background border-[3px] border-primary/30 shrink-0 mt-1 shadow-sm">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                      </div>

                      {/* Event Card */}
                      <div className="flex-1 rounded-xl border border-border/60 bg-background p-4 shadow-sm transition-all hover:shadow-md hover:border-border/80">
                        <div className="flex justify-between items-start mb-3 border-b border-border/40 pb-2.5">
                          <p className="font-bold text-foreground text-sm leading-tight pt-0.5">
                            {describeReturnReportEvent(event)}
                          </p>
                          <div className="flex items-center gap-1 shrink-0 -mt-1.5 -mr-2">
                            {onEditReturnReportEvent && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                onClick={() => onEditReturnReportEvent(event)}
                                title="แก้ไขประวัติ"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {onDeleteReturnReportEvent && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                onClick={() => onDeleteReturnReportEvent(event)}
                                title="ลบประวัติ"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="grid gap-y-2.5 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground text-xs">วันที่รายงานตัว</span>
                            <span className="font-semibold text-foreground tabular-nums bg-muted/30 px-2 py-0.5 rounded border border-border/40">
                              {formatDateDisplay(event.report_date)}
                            </span>
                          </div>

                          {(event.resume_date || event.resume_study_program) && (
                            <div className="mt-1.5 space-y-2.5 bg-blue-50/40 border border-blue-100 p-3 rounded-lg text-xs">
                              {event.resume_date && (
                                <div className="flex items-center justify-between">
                                  <span className="text-blue-700/80">กลับไปศึกษาต่อเมื่อ</span>
                                  <span className="font-semibold text-blue-900 tabular-nums">
                                    {formatDateDisplay(event.resume_date)}
                                  </span>
                                </div>
                              )}
                              {event.resume_study_program && (
                                <div className="flex flex-col gap-1 border-t border-blue-100/50 pt-2.5 mt-1">
                                  <span className="text-blue-700/80 font-medium">
                                    หลักสูตร / สาขา
                                  </span>
                                  <span className="font-semibold text-blue-900 leading-relaxed">
                                    {event.resume_study_program}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. สิทธิการลา */}
      {quotaStatus && quotaStatus.quotas.length > 0 && (
        <div className="bg-card rounded-xl border border-border/80 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border/40 bg-muted/10 flex items-center justify-between">
            <div className="flex items-center gap-2 text-base font-bold text-foreground">
              <Activity className="h-4 w-4 text-primary" /> ข้อมูลสิทธิการลา
            </div>
            <Badge
              variant="secondary"
              className="text-foreground bg-background border-border/60 shadow-sm px-3 font-semibold"
            >
              ปีงบประมาณ {quotaStatus.fiscal_year}
            </Badge>
          </div>

          <div className="p-5 space-y-6">
            {/* Current Leave Quota */}
            {quotaStatus.current_leave && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary/10 pb-3 mb-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">
                    สิทธิ {quotaStatus.current_leave.type_name}
                  </p>
                  <Badge
                    variant="secondary"
                    className="bg-primary/10 text-primary hover:bg-primary/10 border-primary/20 shadow-none"
                  >
                    {leaveStatusLabel[quotaStatus.current_leave.leave_status]}
                  </Badge>
                </div>

                <div className="rounded-xl border border-border/60 bg-background px-4 py-3.5 shadow-sm">
                  <div className="space-y-3.5 text-[13px]">
                    <div className="flex items-baseline justify-between gap-4 border-b border-border/40 pb-4">
                      <span className="text-muted-foreground font-medium">
                        รายการนี้ใช้วันลาทั้งสิ้น
                      </span>
                      <span className="font-bold text-foreground text-lg tabular-nums">
                        {quotaStatus.current_leave.duration}{' '}
                        <span className="text-[11px] font-medium text-muted-foreground ml-0.5">
                          วัน
                        </span>
                      </span>
                    </div>

                    {currentLeaveTracksBalance ? (
                      <>
                        <div className="flex items-baseline justify-between gap-4 pt-1">
                          <span className="text-muted-foreground">สิทธิที่มี</span>
                          <span className="font-semibold text-foreground tabular-nums text-sm">
                            {formatQuotaValue(quotaStatus.current_leave.limit)}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between gap-4">
                          <span className="text-muted-foreground">
                            คงเหลือ ณ วันที่ {formatDateDisplay(quotaStatus.as_of_date)}
                          </span>
                          <span className="font-semibold text-foreground tabular-nums text-sm">
                            {formatQuotaValue(quotaStatus.current_leave.remaining_as_of_today)}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between gap-4 pt-2 border-t border-border/40">
                          <span className="text-foreground font-semibold">
                            {quotaStatus.current_leave.leave_status === 'upcoming'
                              ? 'คงเหลือหากใช้วันลาตามรายการนี้ครบ'
                              : 'คงเหลือหลังใช้รายการนี้'}
                          </span>
                          <span
                            className={cn(
                              'font-bold tabular-nums text-sm',
                              quotaStatus.current_leave.over_quota_after_leave
                                ? 'text-destructive'
                                : 'text-foreground',
                            )}
                          >
                            {formatQuotaValue(quotaStatus.current_leave.remaining_after_leave)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-baseline justify-between gap-4 pt-1">
                          <span className="text-muted-foreground">สิทธิที่มีต่อรายการลา</span>
                          <span className="font-semibold text-foreground tabular-nums text-sm">
                            {formatQuotaValue(quotaStatus.current_leave.limit)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground pt-2">
                          * ประเภทลานี้นับสิทธิต่อรายการ จึงไม่แสดงวันลาคงเหลือสะสม
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-5 space-y-2.5 text-xs">
                  {quotaStatus.current_leave.leave_status === 'upcoming' && (
                    <p className="text-muted-foreground bg-background/50 p-3 rounded-lg border border-border/30 leading-relaxed">
                      <strong className="text-foreground font-semibold">หมายเหตุ:</strong>{' '}
                      {currentLeaveTracksBalance
                        ? 'ณ วันนี้รายการลานี้ยังไม่เริ่มใช้สิทธิ ระบบจึงแสดงทั้งยอดคงเหลือปัจจุบันและยอดคงเหลือที่คาดว่าจะเหลือ หากใช้วันลาตามรายการนี้ครบ'
                        : 'ณ วันนี้รายการลานี้ยังไม่เริ่มใช้สิทธิ ระบบจะแสดงจำนวนวันที่จะใช้และตรวจว่ารายการนี้คาดว่าจะเกินสิทธิหรือไม่'}
                    </p>
                  )}
                  {quotaStatus.current_leave.over_quota_after_leave &&
                    quotaStatus.current_leave.exceed_date_after_leave && (
                      <p className="text-destructive font-semibold bg-destructive/10 p-3 rounded-lg border border-destructive/20 flex items-start gap-2">
                        <span className="text-base leading-none mt-0.5">*</span>
                        <span>
                          {quotaStatus.current_leave.leave_status === 'upcoming' ||
                          !currentLeaveTracksBalance
                            ? 'คาดว่าจะเริ่มเกินสิทธิในวันที่ '
                            : 'เริ่มเกินสิทธิในวันที่ '}
                          <span className="underline underline-offset-2">
                            {formatDateDisplay(quotaStatus.current_leave.exceed_date_after_leave)}
                          </span>
                        </span>
                      </p>
                    )}
                  {!quotaStatus.current_leave.has_quota_data && (
                    <p className="text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/40">
                      ยังไม่พบข้อมูลวันลาคงเหลือของปีนี้
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Other Quotas (Accordion) */}
            {otherQuotaItems.length > 0 && (
              <details className="group rounded-xl border border-border/60 bg-muted/5 p-4 transition-all [&_summary::-webkit-details-marker]:hidden hover:bg-muted/10">
                <summary className="flex cursor-pointer items-center justify-between text-sm font-bold text-foreground list-none">
                  <span>สิทธิการลาประเภทอื่น ({otherQuotaItems.length} รายการ)</span>
                  <div className="flex items-center gap-1.5 text-muted-foreground bg-background px-2.5 py-1.5 rounded-md border border-border/50 shadow-sm transition-colors group-hover:text-foreground">
                    <span className="text-[10px] font-semibold uppercase tracking-wider group-open:hidden">
                      ขยายดูรายละเอียด
                    </span>
                    <ChevronDown className="h-4 w-4 transition-transform duration-300 group-open:-rotate-180" />
                  </div>
                </summary>

                <div className="mt-5 grid gap-4 md:grid-cols-2 pt-5 border-t border-border/60 animate-in fade-in duration-300">
                  {otherQuotaItems.map((quota) => (
                    <div
                      key={quota.leave_type}
                      className="rounded-xl border border-border/80 bg-background p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3 border-b border-border/40 pb-3 mb-3">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-foreground">{quota.type_name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {quota.tracks_balance ? 'สิทธิที่มี' : 'สิทธิที่มีต่อรายการลา'}:{' '}
                            <span className="font-semibold text-foreground">
                              {formatQuotaValue(quota.limit)}
                            </span>
                          </p>
                        </div>
                        {quota.tracks_balance && quota.over_quota_after_leave ? (
                          <Badge variant="destructive" className="text-[10px] shadow-sm">
                            เกินสิทธิ
                          </Badge>
                        ) : quota.tracks_balance ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] shadow-sm"
                          >
                            อยู่ในสิทธิ
                          </Badge>
                        ) : null}
                      </div>

                      {quota.tracks_balance ? (
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                          <div className="bg-muted/20 px-2.5 py-2 rounded-md border border-border/40">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              ใช้ไปแล้ว
                            </p>
                            <p className="font-semibold tabular-nums text-foreground mt-0.5">
                              {quota.used_as_of_today}{' '}
                              <span className="text-[10px] font-normal text-muted-foreground">
                                วัน
                              </span>
                            </p>
                          </div>
                          <div className="bg-muted/20 px-2.5 py-2 rounded-md border border-border/40">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              ใช้รวม
                            </p>
                            <p className="font-semibold tabular-nums text-foreground mt-0.5">
                              {quota.used_after_leave}{' '}
                              <span className="text-[10px] font-normal text-muted-foreground">
                                วัน
                              </span>
                            </p>
                          </div>
                          <div className="px-1.5 mt-1.5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              คงเหลือวันนี้
                            </p>
                            <p className="font-bold tabular-nums text-foreground mt-0.5">
                              {formatQuotaValue(quota.remaining_as_of_today)}
                            </p>
                          </div>
                          <div className="px-1.5 mt-1.5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              คงเหลือหลังใช้รายการนี้
                            </p>
                            <p className="font-bold tabular-nums text-foreground mt-0.5">
                              {formatQuotaValue(quota.remaining_after_leave)}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground pt-1.5 px-1.5">
                          ประเภทลานี้นับสิทธิต่อรายการ จึงไม่แสดงยอดคงเหลือสะสม
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
      )}

      {/* 5. ข้อมูลการศึกษาต่อ (ถ้ามี) */}
      {leave.studyInfo && (
        <div className="bg-card rounded-xl border border-purple-200/80 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-purple-100 bg-purple-50/50 flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-purple-600" />
            <span className="text-base font-bold text-purple-900">
              ข้อมูลการลาศึกษาต่อ / ฝึกอบรม
            </span>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-4">
              <div className="space-y-1.5 md:col-span-2">
                <p className="text-[10px] font-bold text-purple-600/70 uppercase tracking-wider">
                  สถานศึกษา
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {leave.studyInfo.institution || '-'}
                </p>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <p className="text-[10px] font-bold text-purple-600/70 uppercase tracking-wider">
                  หลักสูตร
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {leave.studyInfo.program || '-'}
                </p>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <p className="text-[10px] font-bold text-purple-600/70 uppercase tracking-wider">
                  สาขาวิชา
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {leave.studyInfo.field || '-'}
                </p>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <p className="text-[10px] font-bold text-purple-600/70 uppercase tracking-wider">
                  วันที่เริ่มศึกษา
                </p>
                <p className="text-sm font-semibold text-foreground tabular-nums">
                  {formatDateDisplay(leave.studyInfo.startDate)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. เอกสารแนบ */}
      <div className="pt-2 bg-card rounded-xl border border-border/80 shadow-sm p-5">
        <h4 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-primary" />
          เอกสารแนบประกอบการลา
          <Badge variant="secondary" className="text-xs font-semibold px-2 py-0.5 ml-1">
            {documents.length} รายการ
          </Badge>
        </h4>
        <AttachmentList
          items={documents.map((doc) => ({
            id: doc.document_id,
            name: doc.file_name,
            type: doc.file_type,
            path: doc.file_path,
          }))}
          onPreview={onPreview}
          onDelete={onDeleteDocument}
        />
      </div>
    </div>
  );
}
