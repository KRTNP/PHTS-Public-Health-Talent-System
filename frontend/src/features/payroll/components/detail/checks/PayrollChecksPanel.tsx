'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { AlertTriangle, Info, Clock, Calculator, Edit3 } from 'lucide-react';
import type { PayoutDetail } from '@/features/payroll/api';
import { formatThaiDate, formatThaiDateTime, formatThaiNumber } from '@/shared/utils/thai-locale';
import type { PayrollRow } from '../model/detail.types';
import { ChecksCalculationSection } from './ChecksCalculationSection';
import { ChecksIssuesSection } from './ChecksIssuesSection';
import { localizePayrollText } from './checks.helpers';

export function PayrollChecksPanel({
  payoutDetail,
  fallbackRow,
}: {
  payoutDetail: PayoutDetail | undefined;
  fallbackRow: PayrollRow | null;
}) {
  const pathname = usePathname();
  const payout = payoutDetail?.payout;
  const checksRaw = payoutDetail?.checks;
  const checks = useMemo(() => checksRaw ?? [], [checksRaw]);

  const month = Number(payout?.period_month ?? 0);
  const rawYear = Number(payout?.period_year ?? 0);
  const yearAd = rawYear > 2400 ? rawYear - 543 : rawYear;
  const daysInMonth = month > 0 && yearAd > 0 ? new Date(yearAd, month, 0).getDate() : 0;

  const baseRate = Number(payout?.pts_rate_snapshot ?? fallbackRow?.baseRate ?? 0);
  const eligibleDays = Number(payout?.eligible_days ?? fallbackRow?.workDays ?? 0);
  const deductedDays = Number(payout?.deducted_days ?? fallbackRow?.leaveDays ?? 0);
  const calculatedAmount = Number(payout?.calculated_amount ?? 0);
  const retro = Number(payout?.retroactive_amount ?? fallbackRow?.retroactiveAmount ?? 0);
  const totalPayable = Number(payout?.total_payable ?? 0);

  // Logic Fix: ป้องกันปัญหา Floating-point precision ของ JavaScript
  const dailyRate = daysInMonth > 0 ? baseRate / daysInMonth : 0;
  const deductedAmount = dailyRate > 0 ? dailyRate * deductedDays : 0;
  const otherLossRaw = Number((baseRate - calculatedAmount - deductedAmount).toFixed(2));
  const otherLoss = otherLossRaw > 0 ? otherLossRaw : 0;
  const monthlyBaseAmount = Number(
    Math.max(calculatedAmount + deductedAmount + otherLoss, baseRate).toFixed(2),
  );
  const baseAmountDiff = Number((monthlyBaseAmount - baseRate).toFixed(2));
  const rateBreakdown = payoutDetail?.rateBreakdown ?? [];
  const sortedRateBreakdown = [...rateBreakdown].sort((a, b) =>
    String(a.start_date).localeCompare(String(b.start_date)),
  );

  const roleRoot = useMemo(() => {
    const segment = pathname?.split('/').filter(Boolean)[0];
    return segment ? `/${segment}` : '';
  }, [pathname]);
  const isPtsOfficer = roleRoot === '/pts-officer';
  const periodId = payout?.period_id ? String(payout.period_id) : null;
  const canNavigateLeaves = isPtsOfficer && !!periodId;
  const leaveStudyHref = canNavigateLeaves
    ? `${roleRoot}/payroll/${periodId}/leaves?tab=study`
    : null;

  const topImpactCheck = [...checks].sort(
    (a, b) => Math.abs(Number(b.impact_amount ?? 0)) - Math.abs(Number(a.impact_amount ?? 0)),
  )[0];
  const summaryReason = localizePayrollText(
    topImpactCheck?.title ?? 'มีรายการวันที่ไม่มีสิทธิรับเงิน',
  );

  const latestUpdatedAt = [...checks.map((item) => item.created_at)]
    .filter((v): v is string => Boolean(v))
    .sort()
    .at(-1);
  const payoutUpdatedAt = payout?.updated_at ?? null;

  const checksMayBeStale =
    Boolean(payoutUpdatedAt) &&
    (!latestUpdatedAt ||
      new Date(String(payoutUpdatedAt)).getTime() > new Date(String(latestUpdatedAt)).getTime());

  const baseCheckImpactAmount = Number(topImpactCheck?.impact_amount ?? 0);
  const baseCheckImpactDays = Number(topImpactCheck?.impact_days ?? 0);
  const hasUpdatedByOfficer = Number(payout?.updated_by ?? 0) > 0;
  const hasTopImpact = baseCheckImpactAmount > 0 || baseCheckImpactDays > 0;

  // Prefer check impact for the top summary to keep reason + amount/day consistent.
  const summaryDeductedAmount = hasTopImpact ? baseCheckImpactAmount : deductedAmount + otherLoss;
  const summaryDeductedDays = hasTopImpact ? baseCheckImpactDays : deductedDays;
  const hasDeductionImpact = summaryDeductedAmount > 0.01 || summaryDeductedDays > 0.01;
  const shouldShowDeductionSummaryAlert = hasDeductionImpact && !hasTopImpact;

  const conditionDeductedDays =
    dailyRate > 0 && otherLoss > 0 ? Number((otherLoss / dailyRate).toFixed(2)) : 0;
  const totalDeductedDays = Number((deductedDays + conditionDeductedDays).toFixed(2));
  const looksLikeMidMonthRateChange =
    daysInMonth > 0 &&
    Math.abs(eligibleDays - daysInMonth) < 0.01 &&
    totalDeductedDays < 0.01 &&
    Math.abs(baseAmountDiff) >= 0.01;
  const hasRateChangeAlert = looksLikeMidMonthRateChange || sortedRateBreakdown.length > 1;
  const hasManualOverrideSignal = hasUpdatedByOfficer;

  // Date Range Logic
  const eligibleDateRangesLabel = useMemo(() => {
    if (!month || !yearAd || eligibleDays <= 0) return null;
    const monthStart = new Date(yearAd, month - 1, 1);
    const monthEnd = new Date(yearAd, month, 0);
    const deductionRanges = checks
      .filter((check) => Number(check.impact_amount ?? 0) > 0 && check.start_date && check.end_date)
      .map((check) => {
        const start = new Date(String(check.start_date));
        const end = new Date(String(check.end_date));
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
        const rangeStart = start < monthStart ? monthStart : start;
        const rangeEnd = end > monthEnd ? monthEnd : end;
        if (rangeStart > rangeEnd) return null;
        return { start: rangeStart, end: rangeEnd };
      })
      .filter((item): item is { start: Date; end: Date } => item !== null)
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    if (deductionRanges.length === 0) return null;

    const merged: Array<{ start: Date; end: Date }> = [];
    for (const range of deductionRanges) {
      const last = merged[merged.length - 1];
      if (!last) {
        merged.push({ ...range });
        continue;
      }
      const dayAfterLast = new Date(last.end);
      dayAfterLast.setDate(dayAfterLast.getDate() + 1);
      if (range.start <= dayAfterLast) {
        if (range.end > last.end) last.end = range.end;
      } else {
        merged.push({ ...range });
      }
    }

    const eligibleRanges: Array<{ start: Date; end: Date }> = [];
    let cursor = new Date(monthStart);
    for (const blocked of merged) {
      if (cursor < blocked.start) {
        const end = new Date(blocked.start);
        end.setDate(end.getDate() - 1);
        if (cursor <= end) eligibleRanges.push({ start: new Date(cursor), end });
      }
      cursor = new Date(blocked.end);
      cursor.setDate(cursor.getDate() + 1);
    }
    if (cursor <= monthEnd) {
      eligibleRanges.push({ start: new Date(cursor), end: new Date(monthEnd) });
    }

    const eligibleCountByRange = eligibleRanges.reduce((sum, range) => {
      const diff =
        Math.floor((range.end.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return sum + Math.max(0, diff);
    }, 0);
    if (eligibleCountByRange !== eligibleDays) return null;

    return eligibleRanges
      .map((range) => {
        const startLabel = formatThaiDate(range.start);
        const endLabel = formatThaiDate(range.end);
        return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
      })
      .join(', ');
  }, [checks, eligibleDays, month, yearAd]);

  return (
    <div className="flex flex-col gap-6 w-full pb-8 pt-2">
      {/* 0. Smart Alerts Section - ปรับโครงสร้างและเพิ่ม Animation ให้ดูสมูท */}
      <div className="flex flex-col gap-3.5">

        {/* Alert: เคสเปลี่ยนกลุ่ม/อัตรากลางเดือน (สี Purple) */}
        {hasRateChangeAlert && (
          <div className="rounded-xl border border-purple-200 bg-purple-50 text-purple-900 shadow-sm p-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-start gap-3">
              <Calculator className="h-5 w-5 text-purple-600 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1.5">
                <h4 className="text-sm font-bold leading-tight">
                  เคสเปลี่ยนกลุ่ม/อัตรากลางเดือน
                </h4>
                <p className="text-sm text-purple-800/90 leading-relaxed">
                  เดือนนี้มีสิทธิ{' '}
                  <span className="font-bold text-purple-900">
                    {formatThaiNumber(eligibleDays)}/{formatThaiNumber(daysInMonth)}
                  </span>{' '}
                  วัน
                  {eligibleDateRangesLabel ? ` (${eligibleDateRangesLabel})` : ''}
                  {totalDeductedDays > 0 && (
                    <>
                      {' '}และไม่มีสิทธิ <span className="font-bold text-purple-900">{formatThaiNumber(totalDeductedDays)}</span> วัน
                    </>
                  )}
                </p>
                <p className="text-xs text-purple-700/80">
                  ยอดฐานก่อนหัก{' '}
                  <span className="font-semibold text-purple-900">
                    {formatThaiNumber(monthlyBaseAmount, { maximumFractionDigits: 2 })} บาท
                  </span>{' '}
                  {Math.abs(baseAmountDiff) < 0.01
                    ? `เท่ากับอัตราเงินเต็มเดือนที่แสดง (${formatThaiNumber(baseRate)} บาท)`
                    : `${baseAmountDiff > 0 ? 'สูงกว่า' : 'ต่ำกว่า'}อัตราเงินเต็มเดือนที่แสดง (${formatThaiNumber(baseRate)} บาท) อยู่ ${formatThaiNumber(Math.abs(baseAmountDiff), { maximumFractionDigits: 2 })} บาท`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Alert: สรุปยอดหัก (สี Orange) */}
        {shouldShowDeductionSummaryAlert && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-orange-50 border border-orange-200 text-orange-900 shadow-sm animate-in fade-in slide-in-from-top-2">
            <AlertTriangle className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-bold leading-tight">
                งวดนี้ถูกหัก <span className="text-orange-700 text-base mx-1">{formatThaiNumber(summaryDeductedAmount, { maximumFractionDigits: 2 })}</span> บาท{' '}
                ({formatThaiNumber(summaryDeductedDays)} วัน)
              </h4>
              <p className="text-xs text-orange-800/80 mt-1">
                สาเหตุ: {summaryReason}
              </p>
              {latestUpdatedAt && (
                <p className="text-[11px] text-orange-600/90 flex items-center gap-1.5 mt-2.5">
                  <Clock className="h-3 w-3" /> ข้อมูลล่าสุด: {formatThaiDateTime(latestUpdatedAt)}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Alert: การแก้ไขโดยเจ้าหน้าที่ (สี Blue) */}
        {hasManualOverrideSignal && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50/80 border border-blue-200 text-blue-900 shadow-sm animate-in fade-in slide-in-from-top-2">
            <Edit3 className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-3">
              <div>
                <h4 className="text-sm font-bold">รายการนี้มีการแก้ไขเพิ่มเติมโดยเจ้าหน้าที่</h4>
                <p className="text-xs text-blue-800/80 mt-0.5">
                  เหตุผล: {(payout?.remark ?? '').trim() || 'ไม่ได้ระบุเหตุผล'}
                </p>
                {payoutUpdatedAt && (
                  <p className="text-[11px] text-blue-600/90 flex items-center gap-1.5 mt-1.5">
                    <Clock className="h-3 w-3" /> แก้ไขล่าสุด: {formatThaiDateTime(payoutUpdatedAt)}
                  </p>
                )}
              </div>

              {/* ปรับสี Grid ให้อ่านง่ายขึ้น และดู Clean ขึ้น */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-blue-200 rounded-lg overflow-hidden border border-blue-200 shadow-sm">
                <div className="bg-white p-3 flex flex-col justify-center">
                  <span className="text-[11px] text-slate-500 font-medium mb-1">ก่อนแก้ไข (ระบบตรวจสอบเดิม):</span>
                  <span className="font-medium text-slate-700 text-xs">
                    หัก {formatThaiNumber(baseCheckImpactAmount, { maximumFractionDigits: 2 })} บาท ({formatThaiNumber(baseCheckImpactDays)} วัน)
                  </span>
                </div>
                <div className="bg-blue-50/50 p-3 flex flex-col justify-center">
                  <span className="text-[11px] text-blue-600 font-semibold mb-1">หลังแก้ไข (ค่าปัจจุบัน):</span>
                  <span className="font-bold text-blue-800 text-xs">
                    หัก {formatThaiNumber(deductedAmount, { maximumFractionDigits: 2 })} บาท ({formatThaiNumber(deductedDays)} วัน)
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Alert: ข้อมูลอาจไม่อัปเดต (สี Muted) - ปรับให้อยู่ในโหมด Hint */}
        {checksMayBeStale && (
          <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg border border-border bg-muted/30 text-xs text-muted-foreground mt-1 animate-in fade-in">
            <Info className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
            <p className="leading-relaxed">
              มีการแก้ไขข้อมูลการเบิกจ่ายล่าสุดเมื่อ <span className="font-medium text-foreground">{formatThaiDateTime(payoutUpdatedAt)}</span>{' '}
              ส่วน <span className="font-medium text-foreground">&quot;ประเด็นที่ตรวจพบ&quot;</span> ด้านล่างอาจยังไม่อัปเดตตามยอดที่แก้ไข
            </p>
          </div>
        )}
      </div>

      {/* เปลี่ยน <hr> เป็น <div className="h-px bg-border"> ให้สอดคล้องกับโทนของ Shadcn UI */}
      <div className="h-px w-full bg-border my-2" aria-hidden="true" />

      {/* 1. รายการแจ้งเตือน / ข้อควรระวัง */}
      <ChecksIssuesSection
        checks={checks}
        fallbackIssues={fallbackRow?.issues ?? []}
        items={payoutDetail?.items ?? []}
        leaveImpactSummary={payoutDetail?.leaveImpactSummary}
        fallbackRetroAmount={retro}
        fallbackDeductionAmount={deductedAmount + otherLoss}
        fallbackDeductedDays={deductedDays + conditionDeductedDays}
        fallbackLicenseValidUntil={fallbackRow?.licenseValidUntil ?? null}
        fallbackLicenseStatus={fallbackRow?.licenseStatus ?? null}
        fallbackRemark={payout?.remark ?? fallbackRow?.note ?? null}
        overQuotaHref={leaveStudyHref}
        canManageLeaves={isPtsOfficer}
      />

      {/* 2. สรุปตัวเลขคำนวณเงิน */}
      <ChecksCalculationSection
        baseRate={baseRate}
        daysInMonth={daysInMonth}
        dailyRate={dailyRate}
        eligibleDays={eligibleDays}
        eligibleDateRangesLabel={eligibleDateRangesLabel}
        deductedDays={deductedDays}
        conditionDeductedDays={conditionDeductedDays}
        calculatedAmount={calculatedAmount}
        deductedAmount={deductedAmount}
        otherLoss={otherLoss}
        retro={retro}
        totalPayable={totalPayable}
        rateBreakdown={sortedRateBreakdown}
      />
    </div>
  );
}
