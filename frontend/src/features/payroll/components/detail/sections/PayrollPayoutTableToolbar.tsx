'use client';

import { List, Search, RotateCcw, ArrowDownUp, X } from 'lucide-react';
import { CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { PayrollIssueFilter, PayrollSortBy } from '../model/detail.view-model';
import { PAYROLL_ISSUE_FILTER_OPTIONS, PAYROLL_SORT_OPTIONS } from '../model/detail.constants';

type PayrollPayoutTableToolbarProps = {
  activeProfessionLabel: string;
  filteredPersonsCount: number;
  availableGroups: string[];
  availableDepartments: string[];
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
};

export function PayrollPayoutTableToolbar({
  activeProfessionLabel,
  filteredPersonsCount,
  availableGroups,
  availableDepartments,
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
}: PayrollPayoutTableToolbarProps) {
  const currentSortLabel =
    PAYROLL_SORT_OPTIONS.find((option) => option.value === sortBy)?.label ?? 'เลือกการเรียง';
  const issueFilterLabel =
    PAYROLL_ISSUE_FILTER_OPTIONS.find((option) => option.value === issueFilter)?.label ??
    'ทุกสถานะตรวจ';

  // UX: ตรวจสอบว่ามีการใช้ Filter หรือ Search อยู่หรือไม่
  const hasActiveFilters =
    searchQuery !== '' ||
    rateFilter !== 'all' ||
    departmentFilter !== 'all' ||
    issueFilter !== 'all';
  const activeFilterCount = [
    searchQuery !== '',
    rateFilter !== 'all',
    departmentFilter !== 'all',
    issueFilter !== 'all',
  ].filter(Boolean).length;

  // ฟังก์ชันสำหรับล้างค่า Filter ทั้งหมด
  const handleResetFilters = () => {
    onSearchChange('');
    onRateFilterChange('all');
    onDepartmentFilterChange('all');
    onIssueFilterChange('all' as PayrollIssueFilter);
  };

  return (
    <CardHeader className="border-b border-border bg-slate-50/50 px-6 py-5 space-y-5">
      {/* --- Top Section: Header, Title & Reset --- */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1.5">
          <CardTitle className="flex min-w-0 items-center gap-2.5 text-lg">
            <div className="bg-primary/10 p-1.5 rounded-md border border-primary/20 shadow-sm">
              <List className="h-4 w-4 shrink-0 text-primary" />
            </div>
            <span className="shrink-0 font-bold tracking-tight text-slate-800">
              รายชื่อผู้รับเงิน
            </span>

            {activeProfessionLabel && (
              <>
                <Separator orientation="vertical" className="h-4 mx-1 bg-slate-300" />
                <span className="truncate text-slate-500 font-medium text-sm mt-0.5">
                  {activeProfessionLabel}
                </span>
              </>
            )}
          </CardTitle>
          <p className="text-xs text-slate-500 font-medium ml-[38px]">
            ค้นหาหรือกรองรายชื่อ เพื่อตรวจสอบความถูกต้องของการเบิกจ่าย
          </p>
        </div>

        {/* Counter & Reset Button */}
        <div className="flex items-center gap-3 shrink-0">
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-8 px-3 text-xs font-semibold text-slate-500 hover:bg-slate-200/50 hover:text-slate-800 transition-colors"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5 text-slate-400" />
              ล้างตัวกรอง
            </Button>
          )}
          {hasActiveFilters && (
            <Badge
              variant="secondary"
              className="h-8 px-2.5 bg-primary/10 text-primary border border-primary/20"
            >
              เปิดใช้ {activeFilterCount} ตัวกรอง
            </Badge>
          )}
          <Badge
            variant="outline"
            className="h-8 px-3 flex items-center gap-1.5 bg-white shadow-sm border-slate-200"
          >
            <span className="text-xs font-medium text-slate-500">พบ</span>
            <span className="font-bold text-slate-800 text-sm tabular-nums">
              {filteredPersonsCount.toLocaleString()}
            </span>
            <span className="text-xs font-medium text-slate-500">รายการ</span>
          </Badge>
        </div>
      </div>

      {/* --- Bottom Section: Filters & Search --- */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        {/* Search Bar */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="ค้นหาชื่อ, เลขบัตร, ตำแหน่ง..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-9 bg-white pl-9 shadow-sm border-slate-200 focus-visible:ring-primary/50 text-sm transition-all"
          />
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Rate Filter */}
          <Select value={rateFilter} onValueChange={onRateFilterChange}>
            <SelectTrigger
              className={cn(
                'h-9 w-[130px] sm:w-[140px] bg-white text-xs shadow-sm transition-all border-slate-200',
                rateFilter !== 'all' &&
                  'border-primary/40 bg-primary/5 text-primary font-semibold ring-1 ring-primary/20',
              )}
            >
              <SelectValue placeholder="ทุกกลุ่มอัตรา" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกกลุ่มอัตรา</SelectItem>
              {availableGroups.map((group) => (
                <SelectItem key={group} value={group}>
                  กลุ่มที่ {group}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Department Filter */}
          <Select value={departmentFilter} onValueChange={onDepartmentFilterChange}>
            <SelectTrigger
              className={cn(
                'h-9 w-[150px] sm:w-[160px] bg-white text-xs shadow-sm transition-all border-slate-200',
                departmentFilter !== 'all' &&
                  'border-primary/40 bg-primary/5 text-primary font-semibold ring-1 ring-primary/20',
              )}
            >
              <SelectValue placeholder="ทุกหน่วยงาน" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกหน่วยงาน</SelectItem>
              {availableDepartments.map((department) => (
                <SelectItem key={department} value={department}>
                  {department}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Issue Filter (เน้นสีพิเศษเมื่อมีการกรองหาสถานะ) */}
          <Select
            value={issueFilter}
            onValueChange={(v) => onIssueFilterChange(v as PayrollIssueFilter)}
          >
            <SelectTrigger
              className={cn(
                'h-9 w-[150px] sm:w-[160px] bg-white text-xs shadow-sm transition-all border-slate-200',
                issueFilter !== 'all' &&
                  'border-orange-400 bg-orange-50 text-orange-700 font-semibold ring-1 ring-orange-400/30',
              )}
            >
              <SelectValue placeholder="ทุกสถานะตรวจ" />
            </SelectTrigger>
            <SelectContent>
              {PAYROLL_ISSUE_FILTER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Separator orientation="vertical" className="mx-1.5 hidden h-5 bg-slate-300 xl:block" />

          {/* Sorting */}
          <Select value={sortBy} onValueChange={(v) => onSortByChange(v as PayrollSortBy)}>
            <SelectTrigger className="h-9 w-[160px] sm:w-[176px] justify-start gap-2 bg-slate-50/50 hover:bg-white text-xs shadow-sm border-slate-200 border-dashed transition-colors">
              <div className="flex min-w-0 flex-1 items-center gap-1.5 pr-2 text-left">
                <ArrowDownUp className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="shrink-0 text-slate-500 font-medium">เรียง:</span>
                <span className="truncate font-semibold text-slate-700">{currentSortLabel}</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              {PAYROLL_SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Quick Filters: กดครั้งเดียวเพื่อเข้าสถานะที่ใช้บ่อย */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold text-slate-500">ด่วน:</span>
        <Button
          type="button"
          variant={issueFilter === 'needs_attention' ? 'default' : 'outline'}
          size="sm"
          className="h-7 text-xs"
          onClick={() => onIssueFilterChange('needs_attention')}
        >
          มีประเด็นต้องตรวจ
        </Button>
        <Button
          type="button"
          variant={issueFilter === 'blocker' ? 'destructive' : 'outline'}
          size="sm"
          className="h-7 text-xs"
          onClick={() => onIssueFilterChange('blocker')}
        >
          ต้องหยุดจ่าย
        </Button>
        <Button
          type="button"
          variant={issueFilter === 'warning' ? 'secondary' : 'outline'}
          size="sm"
          className="h-7 text-xs"
          onClick={() => onIssueFilterChange('warning')}
        >
          ควรตรวจเพิ่ม
        </Button>
        <Button
          type="button"
          variant={issueFilter === 'clean' ? 'secondary' : 'outline'}
          size="sm"
          className="h-7 text-xs"
          onClick={() => onIssueFilterChange('clean')}
        >
          ไม่มีประเด็น
        </Button>
      </div>

      {/* Active Filter Chips: มองเห็นชัดและล้างรายตัวได้ */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {searchQuery !== '' && (
            <Badge variant="secondary" className="gap-1 bg-white border border-slate-200">
              ค้นหา: {searchQuery}
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="ล้างคำค้นหา"
                className="rounded-sm text-slate-500 hover:text-slate-800"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {rateFilter !== 'all' && (
            <Badge variant="secondary" className="gap-1 bg-white border border-slate-200">
              กลุ่มที่ {rateFilter}
              <button
                type="button"
                onClick={() => onRateFilterChange('all')}
                aria-label="ล้างกลุ่มอัตรา"
                className="rounded-sm text-slate-500 hover:text-slate-800"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {departmentFilter !== 'all' && (
            <Badge variant="secondary" className="gap-1 bg-white border border-slate-200">
              หน่วยงาน: {departmentFilter}
              <button
                type="button"
                onClick={() => onDepartmentFilterChange('all')}
                aria-label="ล้างหน่วยงาน"
                className="rounded-sm text-slate-500 hover:text-slate-800"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {issueFilter !== 'all' && (
            <Badge variant="secondary" className="gap-1 bg-white border border-slate-200">
              สถานะ: {issueFilterLabel}
              <button
                type="button"
                onClick={() => onIssueFilterChange('all')}
                aria-label="ล้างสถานะตรวจ"
                className="rounded-sm text-slate-500 hover:text-slate-800"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </CardHeader>
  );
}
