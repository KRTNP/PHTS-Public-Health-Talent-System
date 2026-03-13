'use client';

import type { ReactNode } from 'react';
import { Banknote, Calculator, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatThaiDate, formatThaiNumber } from '@/shared/utils/thai-locale';

type ChecksCalculationSectionProps = {
  baseRate: number;
  daysInMonth: number;
  dailyRate: number;
  eligibleDays: number;
  eligibleDateRangesLabel?: string | null;
  deductedDays: number;
  conditionDeductedDays?: number;
  calculatedAmount: number;
  deductedAmount: number;
  otherLoss: number;
  retro: number;
  totalPayable: number;
  rateBreakdown?: Array<{
    start_date: string;
    end_date: string;
    days: number;
    rate: number;
    amount: number;
    group_no?: number | null;
    item_no?: number | null;
    sub_item_no?: number | null;
  }>;
};

type CalcRowProps = {
  label: ReactNode;
  value: string | number;
  unit?: string;
  valueClass?: string;
  labelClass?: string;
  isDeduction?: boolean; // เพิ่ม Prop สำหรับเน้นรายการที่ถูกหักเงิน
};

// ปรับปรุง CalcRow ให้การวางตำแหน่ง Unit ยืดหยุ่นและเนี้ยบขึ้น
function CalcRow({
  label,
  value,
  unit = 'บาท',
  valueClass = '',
  labelClass = 'text-slate-600', // ใช้สี slate-600 ให้อ่านข้อความชัดขึ้น
  isDeduction = false,
}: CalcRowProps) {
  return (
    <div className="flex justify-between items-center text-sm py-2">
      <span className={labelClass}>{label}</span>
      <div className="flex items-center gap-2">
        {/* หุ้มตัวเลขด้วย Box ถ้าเป็นรายการหักเงิน เพื่อดึงความสนใจ */}
        <span
          className={cn(
            'font-medium tabular-nums text-right',
            isDeduction ? 'bg-rose-50 px-2 py-0.5 rounded text-rose-700 font-bold border border-rose-100' : 'text-slate-900',
            valueClass
          )}
        >
          {value}
        </span>
        {/* ปรับ min-w เพื่อให้หน่วยจัดเรียงตรงกันเสมอแม้ข้อความตัวเลขจะยาวไม่เท่ากัน */}
        <span className="text-xs text-slate-500 min-w-[28px] text-left">{unit}</span>
      </div>
    </div>
  );
}

export function ChecksCalculationSection({
  baseRate,
  daysInMonth,
  dailyRate,
  eligibleDays,
  eligibleDateRangesLabel,
  deductedDays,
  conditionDeductedDays = 0,
  calculatedAmount,
  deductedAmount,
  otherLoss,
  retro,
  totalPayable,
  rateBreakdown = [],
}: ChecksCalculationSectionProps) {
  const calculatedByDailyRate = dailyRate * eligibleDays;
  const followsDailyFormula = Math.abs(calculatedByDailyRate - calculatedAmount) < 0.01;
  const monthlyBaseAmount = Number(
    Math.max(calculatedAmount + deductedAmount + otherLoss, baseRate).toFixed(2),
  );
  const totalDeductedDays = Number((deductedDays + conditionDeductedDays).toFixed(2));
  const hasRateBreakdown = rateBreakdown.length > 1;

  const formatRangeDate = (value: string) => {
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return formatThaiDate(date);
  };

  const formatCodePart = (value: number | null | undefined) =>
    value === null || value === undefined ? '-' : formatThaiNumber(value);

  const getRateCodeLabel = (segment: NonNullable<ChecksCalculationSectionProps['rateBreakdown']>[number]) => {
    const parts = [
      `กลุ่ม ${formatCodePart(segment.group_no)}`,
      `ข้อ ${formatCodePart(segment.item_no)}`,
    ];
    if (segment.sub_item_no !== null && segment.sub_item_no !== undefined) {
      parts.push(`ย่อย ${formatCodePart(segment.sub_item_no)}`);
    }
    return parts.join(' / ');
  };

  return (
    <section className="space-y-4 mt-4 animate-in fade-in duration-500">
      <h3 className="flex items-center gap-2 text-base font-bold text-slate-800 tracking-tight">
        <Calculator className="h-5 w-5 text-slate-500" />
        สรุปการคำนวณเงินเดือน
      </h3>

      {/* เปลี่ยนจาก sm: เป็น md: หรือ lg: เพื่อป้องกัน Layout แตกในแท็บเล็ต */}
      <div className="grid gap-4 md:gap-6 lg:grid-cols-2 items-start">

        {/* --- LEFT CARD: Base Variables --- */}
        <div className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md">
          <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-3 mb-3">
            <FileText className="h-4 w-4" /> ค่าหลักที่ใช้คำนวณ
          </h4>

          <div className="space-y-1">
            <CalcRow label="อัตราเงินเต็มเดือน" value={formatThaiNumber(baseRate)} />
            <CalcRow
              label="อัตราเฉลี่ยต่อวัน"
              value={formatThaiNumber(dailyRate, { maximumFractionDigits: 2 })}
            />
            <CalcRow
              label={<span className="font-medium text-slate-800">วันมีสิทธิรับเงิน</span>}
              value={formatThaiNumber(eligibleDays)}
              unit="วัน"
              valueClass="text-slate-900 font-bold"
            />

            {eligibleDateRangesLabel && (
              <div className="flex flex-col py-2 space-y-1.5 bg-slate-50 px-3 rounded-lg border border-slate-100 my-1">
                <span className="text-xs font-medium text-slate-500">ช่วงวันที่มีสิทธิรับเงินจริง</span>
                <span className="text-sm font-medium text-slate-800 text-right leading-snug tabular-nums">
                  {eligibleDateRangesLabel}
                </span>
              </div>
            )}

            {/* เพิ่มสี Contrast ให้กรณีที่ไม่มีการหัก (0 วัน) ดูมีมิติขึ้นด้วย text-slate-500 แทน 400 */}
            <CalcRow
              label="วันถูกหักจากวันลา"
              value={formatThaiNumber(deductedDays)}
              unit="วัน"
              valueClass={deductedDays > 0 ? '' : 'text-slate-500'}
              isDeduction={deductedDays > 0}
            />
            <CalcRow
              label="วันถูกหักจากเงื่อนไขสิทธิ"
              value={formatThaiNumber(conditionDeductedDays)}
              unit="วัน"
              valueClass={conditionDeductedDays > 0 ? '' : 'text-slate-500'}
              isDeduction={conditionDeductedDays > 0}
            />

            <div className="h-px w-full bg-border my-2" aria-hidden="true" />

            <CalcRow
              label={<span className="font-semibold text-slate-700">วันที่ไม่ได้รับเงิน (รวม)</span>}
              value={formatThaiNumber(totalDeductedDays)}
              unit="วัน"
              valueClass={totalDeductedDays > 0 ? 'text-rose-600 font-black text-base' : 'text-slate-500 font-medium'}
            />
          </div>

          <div className="mt-5 pt-3 border-t border-border">
            <p className="text-[11px] text-muted-foreground text-right flex justify-end items-center gap-1">
              หมายเหตุ: เดือนนี้มี {formatThaiNumber(daysInMonth)} วัน
            </p>
          </div>
        </div>

        {/* --- RIGHT CARD: Calculation Result --- */}
        <div className="flex flex-col rounded-xl border border-emerald-200 bg-white shadow-sm overflow-hidden transition-all hover:shadow-md">
          <div className="p-5 pb-4">
            <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700 border-b border-emerald-100 pb-3 mb-3">
              <Banknote className="h-4 w-4" /> ผลลัพธ์งวดนี้
            </h4>

            {hasRateBreakdown ? (
              <div className="space-y-4">
                <div className="text-[11px] font-bold text-emerald-800/70 uppercase tracking-wider bg-emerald-50 inline-block px-2 py-1 rounded">
                  คำนวณเงินตามสิทธิ (ทีละช่วง)
                </div>

                <div className="space-y-2.5">
                  {rateBreakdown.map((segment, idx) => {
                    const start = formatRangeDate(segment.start_date);
                    const end = formatRangeDate(segment.end_date);
                    const dateLabel = start === end ? start : `${start} - ${end}`;
                    return (
                      <div
                        key={`${segment.start_date}-${segment.end_date}-${idx}`}
                        className="flex flex-col bg-slate-50 border border-slate-200 p-3 rounded-lg shadow-sm"
                      >
                        <div className="flex justify-between items-center text-[11px] text-slate-500 mb-2 border-b border-slate-100 pb-2">
                          <span className="font-medium text-slate-700">{dateLabel}</span>
                          <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded shadow-sm border border-slate-100">
                            อัตรา {formatThaiNumber(segment.rate)}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mb-2 tabular-nums">
                          {getRateCodeLabel(segment)}
                        </div>
                        <div className="flex items-center justify-between text-xs font-medium">
                          <span className="tabular-nums text-slate-500 text-[11px]">
                            ({formatThaiNumber(segment.rate)} ÷ {formatThaiNumber(daysInMonth)}) × {formatThaiNumber(segment.days)} วัน
                          </span>
                          <span className="tabular-nums font-bold text-emerald-700 text-sm">
                            {formatThaiNumber(segment.amount, { maximumFractionDigits: 2 })} ฿
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="h-px w-full bg-slate-200 my-2" />

                <div className="space-y-1">
                  <CalcRow
                    label={<span className="font-medium text-slate-700">รวมเงินตามสิทธิเดือนนี้</span>}
                    value={formatThaiNumber(calculatedAmount)}
                    valueClass="font-bold text-slate-900"
                  />
                  <CalcRow
                    label="ยอดตกเบิก"
                    value={`${retro > 0 ? '+' : ''}${formatThaiNumber(retro)}`}
                    valueClass={
                      retro > 0
                        ? 'text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded'
                        : retro < 0
                          ? 'text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded'
                          : 'text-slate-500'
                    }
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <CalcRow
                  label="ยอดฐานก่อนหัก"
                  value={formatThaiNumber(monthlyBaseAmount, { maximumFractionDigits: 2 })}
                  valueClass="font-semibold text-slate-800"
                />
                <CalcRow
                  label="ยอดหักตามวันที่ถูกหัก"
                  value={`${deductedAmount > 0 ? '-' : ''}${formatThaiNumber(deductedAmount, { maximumFractionDigits: 2 })}`}
                  valueClass={deductedAmount > 0 ? '' : 'text-slate-500'}
                  isDeduction={deductedAmount > 0}
                />
                <CalcRow
                  label="ยอดหักจากเงื่อนไขอื่น"
                  value={`${otherLoss > 0 ? '-' : ''}${formatThaiNumber(otherLoss, { maximumFractionDigits: 2 })}`}
                  valueClass={otherLoss > 0 ? '' : 'text-slate-500'}
                  isDeduction={otherLoss > 0}
                />

                <div className="h-px w-full bg-slate-200 my-3" />

                <CalcRow
                  label={<span className="font-semibold text-slate-800">ยอดหลังหักเงื่อนไข</span>}
                  value={formatThaiNumber(calculatedAmount)}
                  valueClass="font-bold text-slate-900 text-base"
                />
                <CalcRow
                  label="ยอดตกเบิก"
                  value={`${retro > 0 ? '+' : ''}${formatThaiNumber(retro)}`}
                  valueClass={
                    retro > 0
                      ? 'text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded'
                      : retro < 0
                        ? 'text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded'
                        : 'text-slate-500'
                  }
                />
              </div>
            )}
          </div>

          {/* --- GRAND TOTAL AREA --- */}
          <div className="bg-emerald-50/80 border-t border-emerald-200 p-5 mt-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-emerald-900">รวมจ่ายสุทธิ</span>
              <div className="flex items-baseline gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-emerald-100 shadow-sm">
                <span className="text-3xl font-black text-emerald-600 tabular-nums tracking-tight">
                  {formatThaiNumber(totalPayable)}
                </span>
                <span className="text-sm font-bold text-emerald-700 min-w-[24px]">บาท</span>
              </div>
            </div>

            {!hasRateBreakdown && (
              <p className="text-xs leading-relaxed text-emerald-700 mt-3 border-t border-emerald-200/50 pt-3">
                {followsDailyFormula
                  ? `คิดจาก ${formatThaiNumber(dailyRate, { maximumFractionDigits: 2 })} บาท/วัน × ${formatThaiNumber(eligibleDays)} วันมีสิทธิ`
                  : 'ยอดนี้เป็นผลลัพธ์หลังหักวันไม่มีสิทธิและเงื่อนไขของงวดนี้แล้ว'}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
