'use client';

import Link from 'next/link';
import { AlertTriangle, Info, XCircle, ArrowRight, FileText, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { PayoutDetail } from '@/features/payroll/api';
import { formatThaiDate, formatThaiNumber } from '@/shared/utils/thai-locale';
import type { PayrollRow } from '../model/detail.types';
import { EvidenceBlock, SummaryWithBoldMoney } from './ChecksEvidence';
import { localizePayrollText } from './checks.helpers';

type ChecksIssuesSectionProps = {
  checks: PayoutDetail['checks'];
  fallbackIssues: PayrollRow['issues'];
  items?: PayoutDetail['items'];
  leaveImpactSummary?: PayoutDetail['leaveImpactSummary'];
  fallbackRetroAmount?: number;
  fallbackDeductionAmount?: number;
  fallbackDeductedDays?: number;
  fallbackLicenseValidUntil?: string | null;
  fallbackLicenseStatus?: string | null;
  fallbackRemark?: string | null;
  overQuotaHref?: string | null;
  canManageLeaves?: boolean;
};

const MAX_EVIDENCE_PREVIEW = 6;
type DisplayCheck = PayoutDetail['checks'][number] & { _displayKey: string };

function getActionHref(
  code: string | undefined,
  overQuotaHref: string | null | undefined,
): string | null {
  const normalized = String(code ?? '').toUpperCase();
  if (normalized.includes('OVER_QUOTA')) return overQuotaHref ?? null;
  return null;
}

function getActionLabel(code: string | undefined): string {
  const normalized = String(code ?? '').toUpperCase();
  if (normalized.includes('OVER_QUOTA')) return 'ไปตรวจสอบสิทธิลา';
  return 'ดูรายละเอียด'; // ปรับคำให้กระชับ
}

function isPendingReturnIssue(code: string | undefined): boolean {
  return String(code ?? '')
    .toUpperCase()
    .includes('PENDING_RETURN');
}

function getSmartCheckTitle(check: PayoutDetail['checks'][number]): string {
  const originalTitle = localizePayrollText(check.title ?? '');
  const evidence = Array.isArray(check.evidence) ? check.evidence : [];

  const eligibilityCount = evidence.reduce<number>((count, item) => {
    if (!item || typeof item !== 'object') return count;
    const evType = String((item as Record<string, unknown>).type ?? '');
    return evType === 'eligibility' ? count + 1 : count;
  }, 0);
  const hasGap = evidence.some((item) => {
    if (!item || typeof item !== 'object') return false;
    const evType = String((item as Record<string, unknown>).type ?? '');
    return evType === 'eligibility_gap';
  });

  const resolveEligibilityGapTitle = (evList: unknown[]): string => {
    const gap = evList.find((item) => {
      if (!item || typeof item !== 'object') return false;
      return String((item as Record<string, unknown>).type ?? '') === 'eligibility_gap';
    }) as Record<string, unknown> | undefined;
    if (!gap) return 'ตรวจพบช่วงที่สิทธิขาดหาย / ไม่มีสิทธิรับเงิน';

    const workStart = String(gap.work_start_date ?? '');
    const workEnd = String(gap.work_end_date ?? '');
    const missing = Array.isArray(gap.missing_ranges)
      ? (gap.missing_ranges as Array<Record<string, unknown>>)
      : [];

    if (missing.length === 1) {
      const start = String(missing[0]?.start ?? '');
      const end = String(missing[0]?.end ?? '');
      if (start && end && workStart && workEnd && start === workStart && end === workEnd) {
        return 'ไม่มีสิทธิรับเงินทั้งงวด';
      }
      if (start && workStart && start === workStart && end !== workEnd) {
        return 'สิทธิเริ่มมีผลระหว่างเดือน';
      }
      if (end && workEnd && end === workEnd && start !== workStart) {
        return 'สิทธิสิ้นสุดระหว่างเดือน / ไม่มีสิทธิปลายเดือน';
      }
    }
    if (missing.length > 1) {
      return 'สิทธิไม่ครอบคลุมทั้งงวด (มีหลายช่วงที่ไม่มีสิทธิ)';
    }

    return 'ตรวจพบช่วงที่สิทธิขาดหาย / ไม่มีสิทธิรับเงิน';
  };

  if (eligibilityCount > 1) return 'มีการเปลี่ยนกลุ่มหรืออัตรากลางเดือน';
  if (hasGap) return resolveEligibilityGapTitle(evidence);

  return originalTitle;
}

export function ChecksIssuesSection({
  checks,
  fallbackIssues,
  items = [],
  leaveImpactSummary,
  fallbackRetroAmount = 0,
  fallbackDeductionAmount = 0,
  fallbackDeductedDays = 0,
  fallbackLicenseValidUntil = null,
  fallbackLicenseStatus = null,
  fallbackRemark = null,
  overQuotaHref,
  canManageLeaves = false,
}: ChecksIssuesSectionProps) {
  const retroItems = items.filter(
    (item) => item.item_type === 'RETROACTIVE_ADD' || item.item_type === 'RETROACTIVE_DEDUCT',
  );
  const retroAddItems = retroItems.filter((item) => item.item_type === 'RETROACTIVE_ADD');
  const retroDeductItems = retroItems.filter((item) => item.item_type === 'RETROACTIVE_DEDUCT');
  const retroAddAmount = retroAddItems.reduce(
    (sum, item) => sum + Math.abs(Number(item.amount ?? 0)),
    0,
  );
  const retroDeductAmount = retroDeductItems.reduce(
    (sum, item) => sum + Math.abs(Number(item.amount ?? 0)),
    0,
  );

  const visibleChecksBase: DisplayCheck[] = checks
    .filter((check) => !isPendingReturnIssue(check.code))
    .flatMap((check) => {
      const evidence = Array.isArray(check.evidence) ? check.evidence : [];
      const eligibilityEvidence = evidence.filter((item) => {
        if (!item || typeof item !== 'object') return false;
        return String((item as Record<string, unknown>).type ?? '') === 'eligibility';
      });
      const gapEvidence = evidence.filter((item) => {
        if (!item || typeof item !== 'object') return false;
        return String((item as Record<string, unknown>).type ?? '') === 'eligibility_gap';
      });

      if (eligibilityEvidence.length > 1 && gapEvidence.length > 0) {
        const rateCheck: DisplayCheck = {
          ...check,
          _displayKey: `${check.check_id}-rate`,
          title: 'มีการเปลี่ยนกลุ่มหรืออัตรากลางเดือน',
          summary: 'พบการใช้อัตรามากกว่า 1 ช่วงเวลาในงวดนี้',
          impact_amount: 0,
          impact_days: 0,
          evidence: eligibilityEvidence,
        };
        const gapCheck: DisplayCheck = {
          ...check,
          _displayKey: `${check.check_id}-gap`,
          title: getSmartCheckTitle({ ...check, evidence: gapEvidence }),
          evidence: gapEvidence,
        };
        return [rateCheck, gapCheck];
      }

      return [{ ...check, _displayKey: String(check.check_id) }];
    });

  const hasRetroDeductCheckFromBackend = visibleChecksBase.some(
    (check) => String(check.code ?? '').toUpperCase() === 'RETRO_DEDUCT',
  );
  const hasAnyRetroAddSignalFromBackend = visibleChecksBase.some(
    (check) =>
      String(check.code ?? '').toUpperCase().includes('RETRO') &&
      Number(check.impact_amount ?? 0) > 0,
  );

  const syntheticRetroChecks: DisplayCheck[] = [];
  if (retroAddItems.length > 0 && !hasAnyRetroAddSignalFromBackend) {
    syntheticRetroChecks.push({
      check_id: -900001,
      payout_id: 0,
      code: 'RETRO_ADD',
      severity: 'WARNING',
      title: 'มีตกเบิก (บวกเพิ่ม)',
      summary: `ยอดตกเบิกสุทธิ +${formatThaiNumber(retroAddAmount, { maximumFractionDigits: 2 })} บาท จากรายการตกเบิก ${formatThaiNumber(retroAddItems.length)} รายการ`,
      impact_amount: retroAddAmount,
      impact_days: 0,
      start_date: null,
      end_date: null,
      evidence: retroAddItems.map((item) => ({
        type: 'retro',
        reference_month: item.reference_month,
        reference_year: item.reference_year,
        diff: Math.abs(Number(item.amount ?? 0)),
        remark: item.description,
      })),
      created_at: null,
      _displayKey: 'synthetic-retro-add',
    });
  }
  if (retroDeductItems.length > 0 && !hasRetroDeductCheckFromBackend) {
    syntheticRetroChecks.push({
      check_id: -900002,
      payout_id: 0,
      code: 'RETRO_DEDUCT',
      severity: 'WARNING',
      title: 'มีตกเบิก (หักออก)',
      summary: `ยอดตกเบิกสุทธิ -${formatThaiNumber(retroDeductAmount, { maximumFractionDigits: 2 })} บาท จากรายการตกเบิก ${formatThaiNumber(retroDeductItems.length)} รายการ`,
      impact_amount: retroDeductAmount,
      impact_days: 0,
      start_date: null,
      end_date: null,
      evidence: retroDeductItems.map((item) => ({
        type: 'retro',
        reference_month: item.reference_month,
        reference_year: item.reference_year,
        diff: -Math.abs(Number(item.amount ?? 0)),
        remark: item.description,
      })),
      created_at: null,
      _displayKey: 'synthetic-retro-deduct',
    });
  }

  const visibleChecks: DisplayCheck[] = [...visibleChecksBase, ...syntheticRetroChecks];

  if (visibleChecks.length === 0 && fallbackIssues.length === 0) return null;

  const byImpactDesc = (a: DisplayCheck, b: DisplayCheck) =>
    Math.abs(Number(b.impact_amount ?? 0)) - Math.abs(Number(a.impact_amount ?? 0));

  const blockers = visibleChecks.filter((check) => check.severity === 'BLOCKER').sort(byImpactDesc);
  const warnings = visibleChecks.filter((check) => check.severity !== 'BLOCKER').sort(byImpactDesc);

  const hasRetroFallbackIssue = fallbackIssues.some(
    (issue) => issue.key === 'HAS_RETRO' || issue.key === 'HAS_RETRO_DEDUCT',
  );
  const fallbackRetroCards: Array<{
    key: string;
    label: string;
    level: string;
    amount: number;
    entries: PayoutDetail['items'];
  }> = [];

  if (hasRetroFallbackIssue) {
    const fallbackRetroIssue = fallbackIssues.find(
      (issue) => issue.key === 'HAS_RETRO' || issue.key === 'HAS_RETRO_DEDUCT',
    );
    if (retroAddItems.length > 0 && retroDeductItems.length > 0) {
      fallbackRetroCards.push({
        key: 'retro-add',
        label: 'มีตกเบิก (บวกเพิ่ม)',
        level: fallbackRetroIssue?.level ?? 'ควรตรวจ',
        amount: retroAddAmount,
        entries: retroAddItems,
      });
      fallbackRetroCards.push({
        key: 'retro-deduct',
        label: 'มีตกเบิก (หักออก)',
        level: fallbackRetroIssue?.level ?? 'ควรตรวจ',
        amount: -retroDeductAmount,
        entries: retroDeductItems,
      });
    } else if (retroAddItems.length > 0 || retroDeductItems.length > 0) {
      const isDeductOnly = retroDeductItems.length > 0 && retroAddItems.length === 0;
      fallbackRetroCards.push({
        key: 'retro-single',
        label: fallbackRetroIssue?.label ?? (isDeductOnly ? 'มีตกเบิก (หักออก)' : 'มีตกเบิก'),
        level: fallbackRetroIssue?.level ?? 'ควรตรวจ',
        amount: isDeductOnly ? -retroDeductAmount : retroAddAmount,
        entries: isDeductOnly ? retroDeductItems : retroAddItems,
      });
    } else if (Number(fallbackRetroAmount) !== 0) {
      fallbackRetroCards.push({
        key: 'retro-net',
        label: fallbackRetroIssue?.label ?? (Number(fallbackRetroAmount) < 0 ? 'มีตกเบิก (หักออก)' : 'มีตกเบิก'),
        level: fallbackRetroIssue?.level ?? 'ควรตรวจ',
        amount: Number(fallbackRetroAmount),
        entries: [],
      });
    }
  }

  const overQuotaLeaves = (leaveImpactSummary?.leavesInPeriod ?? []).filter(
    (leave) => Boolean(leave.overQuota),
  );
  const hasLeaveOverQuotaFallback = overQuotaLeaves.length > 0;
  const overQuotaDeductedDays = overQuotaLeaves.reduce(
    (sum, leave) => sum + Number(leave.deductedDays ?? 0),
    0,
  );
  const overQuotaDeductedAmount = overQuotaLeaves.reduce(
    (sum, leave) => sum + Number(leave.deductedAmount ?? 0),
    0,
  );
  const nonRetroFallbackIssues = fallbackIssues.filter(
    (issue) =>
      issue.key !== 'HAS_RETRO' &&
      issue.key !== 'HAS_RETRO_DEDUCT' &&
      !(hasLeaveOverQuotaFallback && issue.key === 'HAS_DEDUCTION'),
  );
  const fallbackDisplayCount =
    fallbackRetroCards.length +
    nonRetroFallbackIssues.length +
    (hasLeaveOverQuotaFallback ? 1 : 0);

  return (
    <section className="space-y-4 mt-4 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div
          className={`h-2.5 w-2.5 rounded-full ${
            blockers.length > 0 ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'
          }`}
        />
        <h3 className="text-base font-bold text-slate-800 tracking-tight">
          {canManageLeaves ? 'สิ่งที่ต้องดำเนินการ' : 'ประเด็นที่ตรวจพบ'}
          <span className="text-slate-500 ml-1.5 font-medium text-sm">
            ({visibleChecks.length || fallbackDisplayCount || fallbackIssues.length})
          </span>
        </h3>
      </div>

      {visibleChecks.length > 0 ? (
        <div className="grid gap-4">

          {/* --- BLOCKERS SECTION (สีแดง) --- */}
          {blockers.map((check) => (
            <div
              key={check._displayKey}
              className="relative overflow-hidden rounded-xl border border-rose-200/60 bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col"
            >
              <div className="absolute left-0 top-0 bottom-0 w-[5px] bg-rose-500" />
              <div className="p-5 pl-6 flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
                    <XCircle className="h-5 w-5 text-rose-500 shrink-0" />
                    <h4 className="text-sm font-bold text-slate-900 leading-tight">
                      {getSmartCheckTitle(check)}
                    </h4>
                    <Badge className="h-5 px-2 text-[10px] uppercase tracking-wider bg-rose-100 text-rose-700 border-none rounded-md font-extrabold">
                      ระงับการจ่าย
                    </Badge>
                  </div>
                  {check.summary && (
                    <p className="text-sm text-slate-600 leading-relaxed pl-7">
                      <SummaryWithBoldMoney summary={localizePayrollText(check.summary)} />
                    </p>
                  )}
                </div>

                {canManageLeaves && getActionHref(check.code, overQuotaHref) && (
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="shrink-0 w-full md:w-auto shadow-sm hover:bg-slate-50 border-slate-200 text-slate-700"
                  >
                    <Link
                      href={getActionHref(check.code, overQuotaHref) as string}
                      className="flex items-center justify-center gap-1.5"
                    >
                      {getActionLabel(check.code)}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                )}
              </div>

              {Array.isArray(check.evidence) && check.evidence.length > 0 && (
                <details className="group [&_summary::-webkit-details-marker]:hidden border-t border-slate-100">
                  <summary className="flex cursor-pointer items-center justify-between bg-slate-50/50 p-3 pl-6 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:bg-slate-100">
                    <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 group-hover:text-slate-900 transition-colors">
                      <FileText className="h-4 w-4" /> หลักฐานอ้างอิง ({check.evidence.length} รายการ)
                    </p>
                    <ChevronDown className="h-4 w-4 text-slate-400 transition-transform duration-200 group-open:rotate-180" />
                  </summary>
                  <div className="bg-slate-50/50 px-6 pb-5 space-y-2 pt-2 border-t border-slate-100/50 animate-in fade-in slide-in-from-top-2">
                    {check.evidence.map((ev, idx) => (
                      <EvidenceBlock key={idx} evidence={ev} variant="danger" />
                    ))}
                  </div>
                </details>
              )}
            </div>
          ))}

          {/* --- WARNINGS SECTION (สีเหลือง/ส้ม) --- */}
          {warnings.map((check) => (
            <div
              key={check._displayKey}
              className="relative overflow-hidden rounded-xl border border-amber-200/60 bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col"
            >
              <div className="absolute left-0 top-0 bottom-0 w-[5px] bg-amber-400" />
              <div className="p-5 pl-6 flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
                    <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                    <h4 className="text-sm font-bold text-slate-900 leading-tight">
                      {getSmartCheckTitle(check)}
                    </h4>
                    <Badge className="h-5 px-2 text-[10px] uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200/50 rounded-md font-bold">
                      ควรตรวจสอบ
                    </Badge>
                  </div>
                  {check.summary && (
                    <p className="text-sm text-slate-600 leading-relaxed pl-7">
                      <SummaryWithBoldMoney summary={localizePayrollText(check.summary)} />
                    </p>
                  )}
                </div>

                {canManageLeaves && getActionHref(check.code, overQuotaHref) && (
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="shrink-0 w-full md:w-auto shadow-sm hover:bg-slate-50 border-slate-200 text-slate-700"
                  >
                    <Link
                      href={getActionHref(check.code, overQuotaHref) as string}
                      className="flex items-center justify-center gap-1.5"
                    >
                      {getActionLabel(check.code)}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                )}
              </div>

              {Array.isArray(check.evidence) && check.evidence.length > 0 && (
                <details className="group [&_summary::-webkit-details-marker]:hidden border-t border-slate-100">
                  <summary className="flex cursor-pointer items-center justify-between bg-slate-50/50 p-3 pl-6 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:bg-slate-100">
                    <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 group-hover:text-slate-900 transition-colors">
                      <FileText className="h-4 w-4" /> หลักฐานอ้างอิง ({check.evidence.length} รายการ)
                    </p>
                    <ChevronDown className="h-4 w-4 text-slate-400 transition-transform duration-200 group-open:rotate-180" />
                  </summary>
                  <div className="bg-slate-50/50 px-6 pb-5 space-y-2 pt-2 border-t border-slate-100/50 animate-in fade-in slide-in-from-top-2">
                    {check.evidence.map((ev, idx) => (
                      <EvidenceBlock key={idx} evidence={ev} variant="warning" />
                    ))}
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* --- FALLBACK & EMPTY STATE --- */
        <div className="grid gap-4">

          {hasLeaveOverQuotaFallback && (
            <div className="relative overflow-hidden rounded-xl border border-amber-200/60 bg-white shadow-sm flex flex-col">
              <div className="absolute left-0 top-0 bottom-0 w-[5px] bg-amber-500" />
              <div className="p-5 pl-6 flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
                    <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                    <h4 className="text-sm font-bold text-slate-900 leading-tight">ลาเกินโควตา</h4>
                    <Badge className="h-5 px-2 text-[10px] uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200/50 rounded-md font-bold">
                      ควรตรวจสอบ
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed pl-7">
                    กระทบ <span className="font-bold text-slate-900">{formatThaiNumber(overQuotaDeductedDays, { maximumFractionDigits: 2 })}</span> วัน •
                    ประมาณ <span className="font-bold text-rose-700">-{formatThaiNumber(overQuotaDeductedAmount, { maximumFractionDigits: 2 })}</span> บาท
                  </p>
                </div>
                {canManageLeaves && overQuotaHref && (
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="shrink-0 w-full md:w-auto shadow-sm hover:bg-slate-50 border-slate-200 text-slate-700"
                  >
                    <Link href={overQuotaHref} className="flex items-center justify-center gap-1.5">
                      ไปตรวจสอบสิทธิลา
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                )}
              </div>

              <details className="group [&_summary::-webkit-details-marker]:hidden border-t border-slate-100">
                <summary className="flex cursor-pointer items-center justify-between bg-slate-50/50 p-3 pl-6 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:bg-slate-100">
                  <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 group-hover:text-slate-900 transition-colors">
                    <FileText className="h-4 w-4" /> หลักฐานอ้างอิง ({overQuotaLeaves.length} รายการ)
                  </p>
                  <ChevronDown className="h-4 w-4 text-slate-400 transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <div className="bg-slate-50/50 px-6 pb-5 space-y-2 pt-2 border-t border-slate-100/50 animate-in fade-in slide-in-from-top-2">
                  {overQuotaLeaves.slice(0, MAX_EVIDENCE_PREVIEW).map((leave) => (
                    <EvidenceBlock
                      key={`fallback-overquota-${leave.leaveRecordId ?? `${leave.overlapStartDate}-${leave.overlapEndDate}`}`}
                      variant="warning"
                      evidence={{
                        type: 'leave',
                        leave_record_id: leave.leaveRecordId,
                        leave_type: leave.leaveType,
                        start_date: leave.startDate,
                        end_date: leave.endDate,
                        leave_duration: leave.daysInPeriod,
                        deducted_days: leave.deductedDays,
                        deducted_amount: leave.deductedAmount,
                        over_quota: true,
                        exceed_date: leave.exceedDate,
                        is_no_pay: leave.isNoPay,
                        return_report_status: leave.returnReportStatus,
                      }}
                    />
                  ))}
                </div>
              </details>
            </div>
          )}

          {fallbackRetroCards.map((card) => (
            <div
              key={card.key}
              className="relative overflow-hidden rounded-xl border border-sky-200/60 bg-white shadow-sm flex flex-col"
            >
              <div className="absolute left-0 top-0 bottom-0 w-[5px] bg-sky-500" />
              <div className="p-5 pl-6">
                <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
                  <AlertTriangle className="h-5 w-5 text-sky-500 shrink-0" />
                  <h4 className="text-sm font-bold text-slate-900 leading-tight">{card.label}</h4>
                  <Badge className="h-5 px-2 text-[10px] uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200/50 rounded-md font-bold">
                    {card.level}
                  </Badge>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed pl-7">
                  ยอดตกเบิกสุทธิ{' '}
                  <span
                    className={
                      Number(card.amount) >= 0
                        ? 'font-bold text-emerald-700'
                        : 'font-bold text-rose-700'
                    }
                  >
                    {Number(card.amount) >= 0 ? '+' : ''}
                    {formatThaiNumber(Number(card.amount), {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    บาท
                  </span>{' '}
                  จากรายการตกเบิก {card.entries.length} รายการ
                </p>
              </div>

              <details className="group [&_summary::-webkit-details-marker]:hidden border-t border-slate-100">
                <summary className="flex cursor-pointer items-center justify-between bg-slate-50/50 p-3 pl-6 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:bg-slate-100">
                  <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 group-hover:text-slate-900 transition-colors">
                    <FileText className="h-4 w-4" /> หลักฐานอ้างอิง ({Math.max(card.entries.length, 1)} รายการ)
                  </p>
                  <ChevronDown className="h-4 w-4 text-slate-400 transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <div className="bg-slate-50/50 px-6 pb-5 space-y-2 pt-2 border-t border-slate-100/50 animate-in fade-in slide-in-from-top-2">
                  {card.entries.length > 0 ? (
                    card.entries.slice(0, MAX_EVIDENCE_PREVIEW).map((item) => {
                      const amount = Math.abs(Number(item.amount ?? 0));
                      const signedDiff =
                        item.item_type === 'RETROACTIVE_DEDUCT' ? -amount : amount;
                      return (
                        <EvidenceBlock
                          key={item.item_id}
                          variant="warning"
                          evidence={{
                            type: 'retro',
                            reference_month: item.reference_month,
                            reference_year: item.reference_year,
                            diff: signedDiff,
                            remark: item.description,
                          }}
                        />
                      );
                    })
                  ) : (
                    <EvidenceBlock
                      variant="warning"
                      evidence={{
                        detail: `ไม่พบรายการย่อยตกเบิกในรายละเอียด แต่ยอดตกเบิกสุทธิเป็น ${formatThaiNumber(Number(card.amount), {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })} บาท`,
                      }}
                    />
                  )}
                </div>
              </details>
            </div>
          ))}

          {nonRetroFallbackIssues.map((issue) => (
            issue.key === 'HAS_DEDUCTION' ? (
              <div
                key={issue.key}
                className="relative overflow-hidden rounded-xl border border-orange-200/60 bg-white shadow-sm flex flex-col"
              >
                <div className="absolute left-0 top-0 bottom-0 w-[5px] bg-orange-500" />
                <div className="p-5 pl-6">
                  <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
                    <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" />
                    <h4 className="text-sm font-bold text-slate-900 leading-tight">{issue.label}</h4>
                    <Badge className="h-5 px-2 text-[10px] uppercase tracking-wider bg-orange-50 text-orange-700 border border-orange-200/50 rounded-md font-bold">
                      {issue.level}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed pl-7">
                    งวดนี้ถูกหักประมาณ{' '}
                    <span className="font-bold text-rose-700">
                      -{formatThaiNumber(Number(fallbackDeductionAmount), {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      บาท
                    </span>{' '}
                    ({formatThaiNumber(Number(fallbackDeductedDays), { maximumFractionDigits: 2 })} วัน)
                  </p>
                </div>
              </div>
            ) : issue.key === 'LICENSE_EXPIRED' || issue.key === 'LICENSE_SOON' ? (
              <div
                key={issue.key}
                className="relative overflow-hidden rounded-xl border border-amber-200/60 bg-white shadow-sm flex flex-col"
              >
                <div className="absolute left-0 top-0 bottom-0 w-[5px] bg-amber-500" />
                <div className="p-5 pl-6">
                  <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
                    <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                    <h4 className="text-sm font-bold text-slate-900 leading-tight">{issue.label}</h4>
                    <Badge className="h-5 px-2 text-[10px] uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200/50 rounded-md font-bold">
                      {issue.level}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed pl-7">
                    ใบอนุญาตสิ้นสุดวันที่{' '}
                    <span className="font-semibold text-slate-900">
                      {formatThaiDate(fallbackLicenseValidUntil)}
                    </span>
                    {fallbackLicenseStatus ? (
                      <>
                        {' '}
                        • สถานะล่าสุด{' '}
                        <span className="font-semibold text-slate-700">{fallbackLicenseStatus}</span>
                      </>
                    ) : null}
                  </p>
                </div>
              </div>
            ) : issue.key === 'HAS_NOTE' ? (
              <div
                key={issue.key}
                className="relative overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm flex flex-col"
              >
                <div className="absolute left-0 top-0 bottom-0 w-[5px] bg-slate-500" />
                <div className="p-5 pl-6">
                  <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
                    <Info className="h-5 w-5 text-slate-500 shrink-0" />
                    <h4 className="text-sm font-bold text-slate-900 leading-tight">{issue.label}</h4>
                    <Badge className="h-5 px-2 text-[10px] uppercase tracking-wider bg-slate-50 text-slate-700 border border-slate-200 rounded-md font-bold">
                      {issue.level}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed pl-7">
                    {String(fallbackRemark ?? '').trim() || 'มีหมายเหตุในรายการนี้ (โปรดตรวจสอบในส่วนบันทึกการแก้ไข)'}
                  </p>
                </div>
              </div>
            ) : (
              <div
                key={issue.key}
                className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3">
                  <Info className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-foreground">{issue.label}</span>
                    <span className="text-xs text-muted-foreground">{issue.level}</span>
                  </div>
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </section>
  );
}
