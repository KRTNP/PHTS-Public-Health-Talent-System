'use client';

import { Pencil, FileSearch, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatThaiNumber } from '@/shared/utils/thai-locale';
import { PayrollIssueStatusBadge } from '../../common/PayrollIssueStatusBadge';
import type { PayrollRow } from '../model/detail.types';

type PayrollPayoutTableProps = {
  sortedPersons: PayrollRow[];
  canEditPayout: boolean;
  onOpenAllowanceDetail: (person: PayrollRow) => void;
  onOpenChecks: (person: PayrollRow) => void;
  onEditRow: (person: PayrollRow) => void;
};

export function PayrollPayoutTable({
  sortedPersons,
  canEditPayout,
  onOpenAllowanceDetail,
  onOpenChecks,
  onEditRow,
}: PayrollPayoutTableProps) {
  return (
    <TooltipProvider>
      <div className="relative rounded-md border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="sticky top-0 z-30 bg-muted/80 backdrop-blur-sm">
              <TableRow className="hover:bg-transparent border-b">
                <TableHead className="w-[48px] text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  #
                </TableHead>
                <TableHead className="sticky left-0 z-40 min-w-[240px] bg-muted/90 backdrop-blur-sm shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  รายละเอียดบุคลากร
                </TableHead>
                <TableHead className="min-w-[180px] text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  ตำแหน่ง / สังกัด
                </TableHead>
                <TableHead className="w-[80px] text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  กลุ่ม
                </TableHead>
                <TableHead className="w-[110px] text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  อัตราเงิน พ.ต.ส.
                </TableHead>
                <TableHead className="w-[110px] text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  ตกเบิก
                </TableHead>
                <TableHead className="w-[110px] text-right text-[11px] font-bold uppercase tracking-wider text-orange-600">
                  หักเงิน
                </TableHead>
                <TableHead className="w-[130px] text-right text-[11px] font-bold uppercase tracking-wider text-foreground">
                  ยอดสุทธิ
                </TableHead>
                <TableHead className="w-[110px] text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  สถานะตรวจสอบ
                </TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>

            <TableBody>
              {sortedPersons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <FileSearch className="h-10 w-10 mb-2 opacity-20" />
                      <p>ไม่พบข้อมูลที่ระบุในเงื่อนไขการค้นหา</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                sortedPersons.map((person, index) => {
                  const hasChecks = person.checkCount > 0 || person.issues.length > 0;
                  const warnCount =
                    person.warningCount > 0 ? person.warningCount : person.issues.length;

                  return (
                    <TableRow key={person.id} className="group transition-colors hover:bg-muted/40">
                      {/* Index */}
                      <TableCell className="text-center text-[11px] font-mono text-muted-foreground/60">
                        {index + 1}
                      </TableCell>

                      {/* Name & ID (Sticky) */}
                      <TableCell className="sticky left-0 z-20 bg-background group-hover:bg-[#fcfcfd] transition-colors shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] border-r p-0">
                        <div
                          className="flex flex-col px-4 py-3 cursor-pointer"
                          onClick={() => onOpenAllowanceDetail(person)}
                        >
                          <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                            {person.name}
                            {person.note && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info className="h-3 w-3 text-muted-foreground/50" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-[200px] text-[11px]">
                                  {person.note}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground/80 tracking-tighter">
                            {person.citizenId}
                          </span>
                        </div>
                      </TableCell>

                      {/* Position & Dept */}
                      <TableCell className="py-3">
                        <div className="flex flex-col space-y-0.5">
                          <span
                            className="truncate text-[11px] font-medium text-foreground/90 leading-tight"
                            title={person.position}
                          >
                            {person.position}
                          </span>
                          <span
                            className="truncate text-[10px] text-muted-foreground leading-tight"
                            title={person.department}
                          >
                            {person.department}
                          </span>
                        </div>
                      </TableCell>

                      {/* Group */}
                      <TableCell className="text-center py-3">
                        <span
                          className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground border border-border/50"
                          title={`${person.groupNo}/${person.itemNo}/${person.subItemNo}`}
                        >
                          {person.groupNo}/{person.itemNo}/{person.subItemNo}
                        </span>
                      </TableCell>

                      {/* Base Rate */}
                      <TableCell className="text-right text-xs tabular-nums text-muted-foreground/80 font-medium py-3">
                        {formatThaiNumber(person.baseRate)}
                      </TableCell>

                      {/* Retroactive */}
                      <TableCell className="text-right text-xs tabular-nums py-3">
                        <span
                          className={cn(
                            'font-bold',
                            person.retroactiveAmount > 0
                              ? 'text-blue-600'
                              : person.retroactiveAmount < 0
                                ? 'text-destructive'
                                : 'text-muted-foreground/30',
                          )}
                        >
                          {person.retroactiveAmount !== 0
                            ? formatThaiNumber(person.retroactiveAmount)
                            : '-'}
                        </span>
                      </TableCell>

                      {/* Deductions */}
                      <TableCell className="text-right text-xs tabular-nums py-3">
                        {person.deductionAmount > 0 ? (
                          <span className="font-bold text-orange-600">
                            -{formatThaiNumber(person.deductionAmount)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/30">-</span>
                        )}
                      </TableCell>

                      {/* Total Net */}
                      <TableCell className="text-right tabular-nums py-3">
                        <div
                          className={cn(
                            'inline-block px-2.5 py-1 rounded-md text-sm font-black',
                            person.totalAmount > 0
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {formatThaiNumber(person.totalAmount)}
                        </div>
                      </TableCell>

                      {/* Audit/Check Status */}
                      <TableCell className="text-center py-3">
                        <button
                          type="button"
                          className={cn(
                            'inline-flex items-center justify-center transition-all active:scale-90',
                            hasChecks
                              ? 'cursor-pointer hover:brightness-90'
                              : 'cursor-default opacity-30 grayscale',
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!hasChecks) return;
                            onOpenChecks(person);
                          }}
                          disabled={!hasChecks}
                        >
                          <PayrollIssueStatusBadge
                            checkCount={person.checkCount}
                            blockerCount={person.blockerCount}
                            warningCount={warnCount}
                          />
                        </button>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right py-3 pr-4">
                        {canEditPayout && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground transition-opacity md:opacity-0 group-hover:opacity-100 hover:text-primary hover:bg-primary/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditRow(person);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </TooltipProvider>
  );
}
