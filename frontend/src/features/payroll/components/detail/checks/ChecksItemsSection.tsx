'use client';

import { Calendar, List, PenLine } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { PayoutDetail } from '@/features/payroll/api';
import { formatThaiNumber } from '@/shared/utils/thai-locale';
import { cn } from '@/lib/utils';

type ChecksItemsSectionProps = {
  items: PayoutDetail['items'];
};

export function ChecksItemsSection({ items }: ChecksItemsSectionProps) {
  if (!items || items.length === 0) return null;

  return (
    <section className="space-y-3 mt-4 animate-in fade-in duration-500">
      <h3 className="flex items-center gap-2 text-base font-bold text-slate-800 tracking-tight">
        {/* เปลี่ยนไอคอนให้เป็นสี slate-500 เพื่อไม่ให้แย่งความสนใจจาก Alert ด้านบน */}
        <List className="h-5 w-5 text-slate-500" />
        รายการย่อยที่นำมาคำนวณ
      </h3>

      {/* เพิ่ม overflow-x-auto เพื่อป้องกันตารางล้นจอ (Responsive Table) */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
        <table className="w-full text-sm whitespace-nowrap md:whitespace-normal">
          <thead className="bg-slate-50/80 border-b border-border">
            <tr className="text-left">
              <th className="p-3.5 pl-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                รายละเอียดรายการ
              </th>
              <th className="p-3.5 pr-5 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">
                จำนวนเงิน (บาท)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {items.map((item) => {
              const isManualEdit =
                Number(item.reference_month ?? 0) === 0 && Number(item.reference_year ?? 0) === 0;
              const isAdd = item.item_type === 'RETROACTIVE_ADD';
              const isDeduct = item.item_type === 'RETROACTIVE_DEDUCT';

              return (
                <tr key={item.item_id} className="group transition-colors hover:bg-slate-50/80">
                  <td className="p-3.5 pl-5 align-top">
                    {/* อนุญาตให้ Text หักบรรทัดได้หากยาวเกินไป */}
                    <p className="font-semibold text-slate-800 break-words whitespace-normal leading-relaxed">
                      {item.description ?? '-'}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                      {/* Reference Date or Manual Tag */}
                      <div
                        className={cn(
                          'flex items-center gap-1.5 px-2 py-0.5 rounded-md border',
                          isManualEdit
                            ? 'bg-amber-50 text-amber-700 border-amber-200/60 font-medium'
                            : 'bg-slate-100/50 text-slate-600 border-slate-200/60 font-medium'
                        )}
                      >
                        {isManualEdit ? (
                          <>
                            <PenLine className="h-3 w-3 text-amber-600" />
                            <span>แก้ไขข้อมูล/เพิ่มด้วยมือ</span>
                          </>
                        ) : (
                          <>
                            <Calendar className="h-3 w-3 text-slate-400" />
                            <span>
                              อ้างอิง {String(item.reference_month).padStart(2, '0')}/
                              {item.reference_year}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Type Badge - เปลี่ยนสีเงินเข้าเป็น Emerald แทน Blue ให้ล้อกับตารางคำนวณ */}
                      {item.item_type !== 'CURRENT' && (
                        <Badge
                          variant="outline"
                          className={cn(
                            'h-5 px-2 text-[10px] font-bold border rounded-md uppercase tracking-wider',
                            isAdd
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                              : isDeduct
                                ? 'bg-rose-50 text-rose-700 border-rose-200/60'
                                : 'bg-slate-50 text-slate-600 border-slate-200/60',
                          )}
                        >
                          {isAdd
                            ? 'ตกเบิก (บวกเพิ่ม)'
                            : isDeduct
                              ? 'ตกเบิก (หักออก)'
                              : item.item_type}
                        </Badge>
                      )}
                    </div>
                  </td>

                  {/* บังคับทศนิยม 2 ตำแหน่งให้ตรงกัน */}
                  <td className="p-3.5 pr-5 text-right tabular-nums align-top">
                    <div className="flex h-full flex-col justify-start">
                      {(() => {
                        const amount = Number(item.amount ?? 0);
                        if (!Number.isFinite(amount)) return '-';

                        if (isDeduct) {
                          return (
                            <span className="inline-block font-bold text-rose-700 bg-rose-50/50 px-2 py-1 rounded-md border border-rose-100/50 ml-auto">
                              -{formatThaiNumber(amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          );
                        }
                        if (isAdd) {
                          return (
                            <span className="inline-block font-bold text-emerald-700 bg-emerald-50/50 px-2 py-1 rounded-md border border-emerald-100/50 ml-auto">
                              +{formatThaiNumber(amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          );
                        }
                        return (
                          <span className="inline-block font-semibold text-slate-800 py-1 ml-auto">
                            {formatThaiNumber(amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        );
                      })()}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
