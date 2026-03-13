'use client';

import { Card } from '@/components/ui/card';
import { formatThaiNumber } from '@/shared/utils/thai-locale';
import type { PayrollRow } from '../model/detail.types';
import type { PayrollIssueFilter, PayrollSortBy } from '../model/detail.view-model';
import { PayrollPayoutTable } from './PayrollPayoutTable';
import { PayrollPayoutTableToolbar } from './PayrollPayoutTableToolbar';

type PayrollPayoutTableSectionProps = {
  activeProfessionLabel: string;
  filteredPersonsCount: number;
  sortedPersons: PayrollRow[];
  availableGroups: string[];
  availableDepartments: string[];
  canEditPayout: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  rateFilter: string;
  onRateFilterChange: (value: string) => void;
  departmentFilter: string;
  onDepartmentFilterChange: (value: string) => void;
  issueFilter: PayrollIssueFilter;
  onIssueFilterChange: (value: PayrollIssueFilter) => void;
  sortBy: PayrollSortBy;
  onSortByChange: (value: PayrollSortBy) => void;
  onOpenAllowanceDetail: (person: PayrollRow) => void;
  onOpenChecks: (person: PayrollRow) => void;
  onEditRow: (person: PayrollRow) => void;
};

export function PayrollPayoutTableSection({
  activeProfessionLabel,
  filteredPersonsCount,
  sortedPersons,
  availableGroups,
  availableDepartments,
  canEditPayout,
  searchQuery,
  onSearchChange,
  rateFilter,
  onRateFilterChange,
  departmentFilter,
  onDepartmentFilterChange,
  issueFilter,
  onIssueFilterChange,
  sortBy,
  onSortByChange,
  onOpenAllowanceDetail,
  onOpenChecks,
  onEditRow,
}: PayrollPayoutTableSectionProps) {
  // UX Fix: คำนวณผลรวมสุทธิของข้อมูลที่กำลังแสดงอยู่ (รองรับการ Filter)
  const grandTotalAmount = sortedPersons.reduce((sum, person) => sum + person.totalAmount, 0);

  return (
    // เอา mx-6 md:mx-8 ออก เพื่อให้ Parent Component เป็นตัวคุมระยะห่าง
    <Card className="border-border shadow-sm flex flex-col bg-card overflow-hidden">
      <PayrollPayoutTableToolbar
        activeProfessionLabel={activeProfessionLabel}
        filteredPersonsCount={filteredPersonsCount}
        availableGroups={availableGroups}
        availableDepartments={availableDepartments}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        rateFilter={rateFilter}
        onRateFilterChange={onRateFilterChange}
        departmentFilter={departmentFilter}
        onDepartmentFilterChange={onDepartmentFilterChange}
        issueFilter={issueFilter}
        onIssueFilterChange={onIssueFilterChange}
        sortBy={sortBy}
        onSortByChange={onSortByChange}
      />

      {/* เพิ่ม min-h เพื่อกันไม่ให้หน้าจอกระตุกเวลาค้นหาแล้วข้อมูลสั้นลง */}
      <div className="flex-1 min-h-[400px] bg-background">
        <PayrollPayoutTable
          sortedPersons={sortedPersons}
          canEditPayout={canEditPayout}
          onOpenAllowanceDetail={onOpenAllowanceDetail}
          onOpenChecks={onOpenChecks}
          onEditRow={onEditRow}
        />
      </div>

      {/* UX Fix: Enhanced Footer แสดงยอดรวมของตาราง */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border/60 bg-muted/20 px-6 py-4">
        <div className="text-xs text-muted-foreground">
          แสดง{' '}
          <span className="font-bold text-foreground">
            {formatThaiNumber(sortedPersons.length)}
          </span>{' '}
          รายการ
          {sortedPersons.length !== filteredPersonsCount && (
            <span className="ml-1 opacity-70">
              (จากทั้งหมด {formatThaiNumber(filteredPersonsCount)} รายการ)
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            ยอดรวมสุทธิ (ตามเงื่อนไขที่แสดง)
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-emerald-600 tabular-nums">
              {formatThaiNumber(grandTotalAmount)}
            </span>
            <span className="text-xs font-medium text-muted-foreground">บาท</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
