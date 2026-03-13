'use client';

import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Calculator,
  Info,
  Lock,
  MessageSquare,
  Unlock,
  User,
  Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { resolveProfessionLabel } from '@/shared/constants/profession';
import { formatThaiNumber } from '@/shared/utils/thai-locale';
import type { PayrollRow } from '../model/detail.types';
import { formatPeriodLabel } from '../model/detail.helpers';
import { isValidCalculation } from './payrollDialog.utils';

type CalcRowProps = {
  label: string;
  value: string;
  isDeduct?: boolean;
  isTotal?: boolean;
};

function CalcRow({ label, value, isDeduct = false, isTotal = false }: CalcRowProps) {
  return (
    <div
      className={cn(
        'flex justify-between items-center text-sm',
        isTotal ? 'pt-2 border-t border-dashed border-border/60' : '',
      )}
    >
      <span
        className={cn(
          isTotal ? 'font-bold text-foreground' : 'text-muted-foreground',
          isDeduct && 'text-destructive/80',
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          'font-medium tabular-nums',
          isTotal ? 'text-base font-bold text-foreground' : '',
          isDeduct && 'text-destructive',
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function PayrollEditDialog({
  open,
  onOpenChange,
  editRow,
  editEligibleDays,
  setEditEligibleDays,
  editDeductedDays,
  setEditDeductedDays,
  editRetroactiveAmount,
  setEditRetroactiveAmount,
  editRemark,
  setEditRemark,
  periodMonth,
  periodYear,
  onSave,
  saving,
  canEditPayout,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editRow: PayrollRow | null;
  editEligibleDays: string;
  setEditEligibleDays: (value: string) => void;
  editDeductedDays: string;
  setEditDeductedDays: (value: string) => void;
  editRetroactiveAmount: string;
  setEditRetroactiveAmount: (value: string) => void;
  editRemark: string;
  setEditRemark: (value: string) => void;
  periodMonth?: number | null;
  periodYear?: number | null;
  onSave: () => void;
  saving: boolean;
  canEditPayout: boolean;
}) {
  const [manualDeductedDays, setManualDeductedDays] = useState(false);
  const eligibleDays = Number(editEligibleDays);
  const deductedDays = Number(editDeductedDays);
  const retroactiveAmount = Number(editRetroactiveAmount);
  const month = Number(periodMonth ?? 0);
  const rawYear = Number(periodYear ?? 0);
  const year = rawYear > 2400 ? rawYear - 543 : rawYear;
  const daysInMonth = month > 0 && year > 0 ? new Date(year, month, 0).getDate() : 0;
  const baseRate = Number(editRow?.baseRate ?? 0);

  useEffect(() => {
    if (manualDeductedDays || !daysInMonth || !Number.isFinite(eligibleDays)) return;
    const nextDeducted = Math.max(0, Number((daysInMonth - eligibleDays).toFixed(2)));
    setEditDeductedDays(String(nextDeducted));
  }, [manualDeductedDays, daysInMonth, eligibleDays, setEditDeductedDays]);

  let validationError: string | null = null;
  if (!canEditPayout) {
    validationError = 'สถานะรอบบิลปัจจุบันไม่อนุญาตให้แก้ไขข้อมูล';
  } else if (eligibleDays < 0 || isNaN(eligibleDays)) {
    validationError = 'วันมีสิทธิต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป';
  } else if (deductedDays < 0 || isNaN(deductedDays)) {
    validationError = 'วันถูกหักต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป';
  } else if (isNaN(retroactiveAmount)) {
    validationError = 'ยอดตกเบิกต้องเป็นตัวเลขที่ถูกต้อง';
  } else if (daysInMonth > 0 && eligibleDays + deductedDays > daysInMonth) {
    validationError = `ผลรวมวันมีสิทธิและวันถูกหัก ต้องไม่เกินจำนวนวันในเดือน (${daysInMonth} วัน)`;
  }

  const dailyRate = daysInMonth > 0 ? baseRate / daysInMonth : 0;
  const calculatedPayout = dailyRate * eligibleDays;
  const calculatedDeduction = dailyRate * deductedDays;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden bg-card border-border shadow-lg">
        {/* Header เรียบหรู */}
        <DialogHeader className="px-6 py-5 border-b bg-slate-50/50">
          <DialogTitle className="text-xl font-bold tracking-tight text-slate-800">
            แก้ไขข้อมูลเบิกจ่ายรายบุคคล
          </DialogTitle>
          <DialogDescription className="text-sm font-medium">
            รอบเบิกจ่าย {formatPeriodLabel(periodMonth ?? null, periodYear ?? null)}
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 overflow-y-auto max-h-[75vh] space-y-7">
          {editRow && (
            <>
              {/* Profile Card แบบคลีน */}
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center shrink-0 border border-blue-100">
                  <User className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="font-bold text-base text-foreground truncate">{editRow.name}</h3>
                    <Badge
                      variant="secondary"
                      className="font-medium text-[10px] tracking-wider uppercase bg-slate-100 text-slate-600 border-none"
                    >
                      {editRow.citizenId}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {resolveProfessionLabel(editRow.professionCode, editRow.professionCode)}
                  </span>
                </div>
              </div>

              {/* Validation Error แบบ Left Accent */}
              {validationError && (
                <div className="relative overflow-hidden rounded-lg border border-destructive/20 bg-destructive/5 p-4 pl-5">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-destructive" />
                  <div className="flex gap-2.5 items-start">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                    <p className="text-sm text-destructive font-medium leading-relaxed">
                      {validationError}
                    </p>
                  </div>
                </div>
              )}

              {/* Form Grid */}
              <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 items-start">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">วันมีสิทธิ (วัน)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    max={daysInMonth || undefined}
                    value={editEligibleDays}
                    onChange={(e) => setEditEligibleDays(e.target.value)}
                    className="h-10 text-base shadow-sm focus-visible:ring-primary/50"
                    placeholder={`เต็มเดือน ${daysInMonth} วัน`}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-slate-700">วันถูกหัก (วัน)</label>
                    <button
                      type="button"
                      onClick={() => setManualDeductedDays(!manualDeductedDays)}
                      className={cn(
                        'text-[10px] font-medium flex items-center gap-1 transition-all px-2 py-0.5 rounded-full border',
                        manualDeductedDays
                          ? 'border-primary/30 text-primary bg-primary/10 hover:bg-primary/20'
                          : 'border-border text-muted-foreground bg-slate-50 hover:bg-slate-100',
                      )}
                    >
                      {manualDeductedDays ? (
                        <Unlock className="h-3 w-3" />
                      ) : (
                        <Lock className="h-3 w-3" />
                      )}
                      {manualDeductedDays ? 'แก้ไขเอง' : 'คำนวณอัตโนมัติ'}
                    </button>
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={editDeductedDays}
                    onChange={(e) => setEditDeductedDays(e.target.value)}
                    disabled={!manualDeductedDays}
                    className={cn(
                      'h-10 text-base transition-all shadow-sm focus-visible:ring-primary/50',
                      !manualDeductedDays &&
                        'bg-slate-50 text-slate-500 border-border/60 cursor-not-allowed',
                    )}
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-semibold text-slate-700">ยอดตกเบิก (บาท)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-medium select-none">
                      ฿
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      value={editRetroactiveAmount}
                      onChange={(e) => setEditRetroactiveAmount(e.target.value)}
                      className="h-10 pl-9 text-base shadow-sm focus-visible:ring-primary/50"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              {/* Simulation Box (Accounting Slip Style) */}
              <div className="rounded-xl border border-border bg-gradient-to-b from-slate-50/50 to-transparent p-5 space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-border/60">
                  <Calculator className="h-4 w-4 text-slate-500" />
                  <span className="text-sm font-bold tracking-tight text-slate-700">
                    จำลองการคำนวณเบื้องต้น
                  </span>
                </div>

                <div className="space-y-2.5">
                  <CalcRow
                    label={`อัตราเต็มเดือน (${daysInMonth} วัน)`}
                    value={formatThaiNumber(baseRate)}
                  />

                  {isValidCalculation(daysInMonth, eligibleDays, deductedDays) ? (
                    <>
                      <CalcRow
                        label={`คำนวณตามสิทธิ (${eligibleDays} วัน)`}
                        value={formatThaiNumber(calculatedPayout, { maximumFractionDigits: 2 })}
                      />
                      {calculatedDeduction > 0 && (
                        <CalcRow
                          label={`หักลบ (${deductedDays} วัน)`}
                          value={`-${formatThaiNumber(calculatedDeduction, { maximumFractionDigits: 2 })}`}
                          isDeduct
                        />
                      )}

                      {/* ผลลัพธ์หลังหัก */}
                      <CalcRow
                        label="ยอดที่คาดว่าจะได้รับ (ก่อนหักอื่นๆ)"
                        value={formatThaiNumber(calculatedPayout - calculatedDeduction, {
                          maximumFractionDigits: 2,
                        })}
                        isTotal
                      />
                    </>
                  ) : (
                    <div className="flex items-start gap-2.5 text-slate-500 text-sm bg-slate-100/50 border border-slate-200 p-3 rounded-lg">
                      <Info className="h-4 w-4 shrink-0 mt-0.5 text-slate-400" />
                      <span className="leading-relaxed">
                        กรุณากรอกวันมีสิทธิและวันถูกหักให้ถูกต้อง เพื่อจำลองผลการคำนวณ
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Remark */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <MessageSquare className="h-4 w-4 text-slate-400" /> หมายเหตุการแก้ไข
                </label>
                <Textarea
                  value={editRemark}
                  onChange={(e) => setEditRemark(e.target.value)}
                  placeholder="เช่น ปรับยอดเนื่องจากลงเวลาผิดพลาด..."
                  className="resize-none min-h-[80px] bg-background shadow-sm focus-visible:ring-primary/50"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t bg-slate-50/50 gap-3 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="border-border"
          >
            ยกเลิก
          </Button>
          <Button
            onClick={onSave}
            disabled={!editRow || saving || !!validationError}
            className="min-w-[140px] shadow-sm"
          >
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            บันทึกการแก้ไข
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
