'use client';

import Link from 'next/link';
import { CalendarDays, ExternalLink, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ReturnReportStatusBadge } from '@/components/common';
import type { PayoutDetail } from '@/features/payroll/api';
import { formatThaiNumber } from '@/shared/utils/thai-locale';
import { cn } from '@/lib/utils';
import {
  formatThaiShortDate,
  leaveTypeLabel,
  normalizeReturnReportStatus,
  quotaUnitLabel,
} from './checks.helpers';

type LeaveImpactSummary = NonNullable<PayoutDetail['leaveImpactSummary']>;

const formatQuotaDisplay = (value: number | null, unitLabel = 'วัน') =>
  value === null ? '-' : `${formatThaiNumber(value)} ${unitLabel}`;

export function LeaveImpactSummarySection({
  summary,
  citizenId,
}: {
  summary: LeaveImpactSummary | undefined;
  citizenId?: string | null;
}) {
  if (!summary) return null;

  const baseLeaveManagementHref = citizenId
    ? `/pts-officer/leave-management?search=${encodeURIComponent(citizenId)}`
    : '/pts-officer/leave-management';

  const leaveTypesInPeriod = new Set(summary.leavesInPeriod.map((leave) => leave.leaveType));

  const relevantQuota = summary.quotaByType.filter(
    (quota) =>
      leaveTypesInPeriod.has(quota.leaveType) &&
      (quota.usedInPeriod > 0 ||
        quota.overQuota ||
        (quota.tracksBalance &&
          quota.remainingAfterPeriod !== null &&
          quota.remainingAfterPeriod <= 0)),
  );

  return (
    <Card className="border-border bg-card shadow-sm overflow-hidden animate-in fade-in duration-500 mt-4">
      <CardHeader className="space-y-4 border-b border-border bg-slate-50/30 pb-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="text-base flex items-center gap-2 text-foreground font-bold tracking-tight">
              <CalendarDays className="h-5 w-5 text-slate-500" />
              สรุปวันลาที่กระทบงวดนี้
            </CardTitle>
            <p className="text-xs text-muted-foreground leading-relaxed">
              แสดงเฉพาะรายการที่มีผลกับยอดจ่ายในงวดนี้
            </p>
          </div>

          <div className="flex flex-col gap-3 md:min-w-[280px] shrink-0">
            <div className="grid grid-cols-2 gap-2.5">
              {/* Highlight สีแดงถ้ายอดหัก > 0 */}
              <div
                className={cn(
                  "rounded-xl border px-3 py-2 shadow-sm transition-colors",
                  summary.deductedDays > 0 ? "bg-rose-50/50 border-rose-200/60" : "bg-white border-slate-200/80"
                )}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
                  วันถูกหักรวม
                </div>
                <div
                  className={cn(
                    'text-sm font-black tabular-nums',
                    summary.deductedDays > 0 ? 'text-rose-700' : 'text-slate-800',
                  )}
                >
                  {formatThaiNumber(summary.deductedDays)}{' '}
                  <span className={cn("text-[10px] font-medium", summary.deductedDays > 0 ? "text-rose-600/70" : "text-slate-400")}>วัน</span>
                </div>
              </div>

              <div
                className={cn(
                  "rounded-xl border px-3 py-2 shadow-sm transition-colors",
                  summary.deductedAmount > 0 ? "bg-rose-50/50 border-rose-200/60" : "bg-white border-slate-200/80"
                )}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
                  ยอดหักรวม
                </div>
                <div
                  className={cn(
                    'text-sm font-black tabular-nums',
                    summary.deductedAmount > 0 ? 'text-rose-700' : 'text-slate-800',
                  )}
                >
                  {formatThaiNumber(summary.deductedAmount)}{' '}
                  <span className={cn("text-[10px] font-medium", summary.deductedAmount > 0 ? "text-rose-600/70" : "text-slate-400")}>บาท</span>
                </div>
              </div>
            </div>

            <Button asChild variant="outline" size="sm" className="w-full justify-center md:justify-between shadow-sm bg-white hover:bg-slate-50 border-slate-200 text-slate-700 font-medium">
              <Link href={baseLeaveManagementHref} className="flex items-center gap-2">
                <span>ไปจัดการวันลา</span>
                <ExternalLink className="h-3.5 w-3.5 text-slate-400 hidden md:block" />
              </Link>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        <section className="space-y-3.5">
          <div className="text-xs font-bold tracking-wider text-slate-700 uppercase flex items-center gap-1.5 border-b border-slate-100 pb-2">
            <FileText className="h-4 w-4 text-slate-400" /> วันลาที่มีผลในงวดนี้
          </div>

          {summary.leavesInPeriod.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-10 text-center text-sm text-muted-foreground font-medium">
              ไม่มีประวัติการลาที่กระทบงวดนี้
            </div>
          ) : (
            <div className="space-y-3">
              {summary.leavesInPeriod.map((leave) => (
                <div
                  key={`${leave.leaveRecordId ?? 'no-id'}-${leave.overlapStartDate}-${leave.overlapEndDate}`}
                  className="rounded-xl border border-border bg-card p-4.5 shadow-sm hover:shadow-md transition-shadow p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <div className="font-bold text-foreground text-sm flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-slate-300" />
                          {leaveTypeLabel(leave.leaveType)}
                        </div>
                        {leave.overQuota && (
                          <Badge
                            variant="outline"
                            className="h-5 px-2 text-[10px] uppercase tracking-wider border-amber-200/60 bg-amber-50 text-amber-700 font-bold rounded-md"
                          >
                            เกินสิทธิ
                          </Badge>
                        )}
                        {leave.returnReportStatus && (
                          <ReturnReportStatusBadge
                            status={normalizeReturnReportStatus(leave.returnReportStatus) ?? undefined}
                            tone="soft"
                          />
                        )}
                      </div>

                      <div className="space-y-1.5 text-[11px] text-muted-foreground bg-slate-50/80 p-2.5 rounded-lg border border-slate-100 w-fit">
                        <div className="flex items-center gap-2">
                          <span className="w-16 font-semibold uppercase tracking-wider text-slate-500">ช่วงที่ลา</span>
                          <span className="font-medium text-slate-700 tabular-nums bg-white px-1.5 py-0.5 rounded border border-slate-200/60 shadow-sm">
                            {formatThaiShortDate(leave.startDate)} - {formatThaiShortDate(leave.endDate)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-16 font-semibold uppercase tracking-wider text-slate-500">กระทบงวด</span>
                          <span className="font-bold text-slate-900 tabular-nums bg-white px-1.5 py-0.5 rounded border border-slate-200/60 shadow-sm">
                            {formatThaiShortDate(leave.overlapStartDate)} - {formatThaiShortDate(leave.overlapEndDate)}
                          </span>
                        </div>
                      </div>

                      {leave.overQuota && leave.exceedDate && (
                        <div className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200/50 w-fit px-2 py-1 rounded-md shadow-sm">
                          เกินสิทธิตั้งแต่ <span className="tabular-nums">{formatThaiShortDate(leave.exceedDate)}</span>
                        </div>
                      )}
                    </div>

                    {/* Calculation Grid - แยกกล่องเงินหักให้ชัดเจน */}
                    <div className="grid min-w-[280px] grid-cols-2 gap-2 text-sm shrink-0 mt-3 lg:mt-0">
                      <div className="flex flex-col justify-center rounded-lg border border-slate-100 bg-slate-50 px-3.5 py-2.5">
                        <div className="text-[10px] tracking-wider uppercase text-slate-500 font-bold mb-0.5">วันในงวดนี้</div>
                        <div className="font-bold tabular-nums text-slate-800">
                          {formatThaiNumber(leave.daysInPeriod)}{' '}
                          <span className="text-[10px] font-medium text-slate-500 uppercase">วัน</span>
                        </div>
                      </div>

                      <div className={cn(
                        "flex flex-col justify-center rounded-lg border px-3.5 py-2.5",
                        leave.deductedDays > 0 ? "bg-rose-50/50 border-rose-100" : "bg-slate-50 border-slate-100"
                      )}>
                        <div className={cn(
                          "text-[10px] tracking-wider uppercase font-bold mb-0.5",
                          leave.deductedDays > 0 ? "text-rose-800/80" : "text-slate-500"
                        )}>วันถูกหัก</div>
                        <div className={cn("font-bold tabular-nums", leave.deductedDays > 0 ? "text-rose-700" : "text-slate-800")}>
                          {formatThaiNumber(leave.deductedDays)}{' '}
                          <span className={cn("text-[10px] font-medium uppercase", leave.deductedDays > 0 ? "text-rose-600/70" : "text-slate-500")}>วัน</span>
                        </div>
                      </div>

                      <div className={cn(
                        "col-span-2 flex items-center justify-between rounded-lg border px-4 py-3",
                        leave.deductedAmount > 0 ? "bg-rose-50 border-rose-200/60 shadow-sm" : "bg-slate-50 border-slate-100"
                      )}>
                        <div className={cn(
                          "text-[10px] tracking-wider uppercase font-bold",
                          leave.deductedAmount > 0 ? "text-rose-800" : "text-slate-500"
                        )}>ยอดหักจากรายการนี้</div>
                        <div className={cn("font-black tabular-nums text-base", leave.deductedAmount > 0 ? "text-rose-700" : "text-slate-800")}>
                          {leave.deductedAmount > 0 && "-"}{formatThaiNumber(leave.deductedAmount)} <span className="text-[10px] font-semibold uppercase opacity-80">บาท</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {relevantQuota.length > 0 ? (
          <section className="space-y-3.5 pt-4 border-t border-border">
            <div className="text-xs font-bold tracking-wider text-slate-700 uppercase flex items-center gap-1.5">
              สรุปสิทธิที่ควรเฝ้าระวัง
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {relevantQuota.map((quota) => (
                <div key={quota.leaveType} className="rounded-xl border border-border bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between border-b border-slate-100 pb-3 gap-2">
                      <div className="font-bold text-slate-800 text-sm">{leaveTypeLabel(quota.leaveType)}</div>
                      <div className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md whitespace-nowrap uppercase tracking-wider border border-slate-200/50">
                        สิทธิ {formatQuotaDisplay(quota.quotaLimit, quotaUnitLabel(quota.quotaUnit ?? ''))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-1">
                      <div className="flex flex-col justify-center bg-slate-50/80 p-2.5 rounded-lg border border-slate-100/50">
                        <div className="text-[10px] tracking-wider uppercase text-slate-500 font-semibold mb-0.5">ใช้ก่อนงวด</div>
                        <div className="font-bold tabular-nums text-sm text-slate-700">
                          {formatThaiNumber(quota.usedBeforePeriod)} <span className="text-[10px] font-medium uppercase text-slate-500">วัน</span>
                        </div>
                      </div>

                      <div className="flex flex-col justify-center bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100/50">
                        <div className="text-[10px] tracking-wider uppercase text-emerald-700 font-bold mb-0.5">ใช้ในงวดนี้</div>
                        <div className="font-black tabular-nums text-sm text-emerald-700">
                          +{formatThaiNumber(quota.usedInPeriod)} <span className="text-[10px] font-semibold uppercase opacity-80">วัน</span>
                        </div>
                      </div>

                      {quota.tracksBalance ? (
                        <div className="col-span-2 flex justify-between items-center mt-1 pt-3 border-t border-slate-100">
                          <div className="text-[11px] tracking-wider uppercase font-bold text-slate-600">คงเหลือปัจจุบัน</div>
                          <div
                            className={cn(
                              'font-black tabular-nums text-sm px-2.5 py-1 rounded-md border shadow-sm',
                              quota.remainingAfterPeriod !== null && quota.remainingAfterPeriod <= 0
                                ? 'text-rose-700 bg-rose-50 border-rose-200/60'
                                : 'text-emerald-700 bg-emerald-50 border-emerald-200/60',
                            )}
                          >
                            {formatQuotaDisplay(quota.remainingAfterPeriod)}
                          </div>
                        </div>
                      ) : (
                        <div className="col-span-2 flex justify-between items-center mt-1 pt-3 border-t border-slate-100">
                          <div className="text-[11px] tracking-wider uppercase font-bold text-slate-600">รูปแบบสิทธิ</div>
                          <div className="font-semibold text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/50">
                            นับโควตาต่อรายการลา
                          </div>
                        </div>
                      )}
                    </div>

                    {quota.overQuota && quota.exceedDate && (
                      <div className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200/50 w-full text-center py-1.5 rounded-md mt-1 shadow-sm">
                        เกินสิทธิตั้งแต่ {formatThaiShortDate(quota.exceedDate)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}
