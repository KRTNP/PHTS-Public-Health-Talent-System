'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TabsContent } from '@/components/ui/tabs';
import { leaveTypes } from '@/features/leave-management/core/constants';
import { LeaveTable } from '@/features/leave-management/components/table/LeaveTable';
import type { LeaveRecord } from '@/features/leave-management/core/types';
import { FileText, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';

type SortBy = 'start_date' | 'name';
type SortDir = 'asc' | 'desc';

export function AllLeavesTab({
  searchQuery,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  fiscalYearFilter,
  onFiscalYearFilterChange,
  fiscalYearOptions,
  sortBy,
  sortDir,
  onSortChange,
  leaveRecords,
  onViewDetail,
  onEdit,
  onDelete,
  onRecordReport,
  getLeaveTypeColor,
  formatDateDisplay,
  isLoading,
  isError,
  onRetry,
  showDeleteButton = true,
  showingFrom,
  showingTo,
  totalRecords,
  page,
  totalPages,
  canPrevPage,
  canNextPage,
  onPrevPage,
  onNextPage,
}: {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
  fiscalYearFilter: number | 'all';
  onFiscalYearFilterChange: (value: number | 'all') => void;
  fiscalYearOptions: number[];
  sortBy: SortBy;
  sortDir: SortDir;
  onSortChange: (sortBy: SortBy, sortDir: SortDir) => void;
  leaveRecords: LeaveRecord[];
  onViewDetail: (record: LeaveRecord) => void;
  onEdit: (record: LeaveRecord) => void;
  onDelete: (record: LeaveRecord) => void;
  onRecordReport: (record: LeaveRecord) => void;
  getLeaveTypeColor: (type: string) => string;
  formatDateDisplay: (date: string) => string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  showDeleteButton?: boolean;
  showingFrom: number;
  showingTo: number;
  totalRecords: number;
  page: number;
  totalPages: number;
  canPrevPage: boolean;
  canNextPage: boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
}) {
  const fiscalYearLabel = fiscalYearFilter === 'all' ? 'ทุกปีงบประมาณ' : String(fiscalYearFilter);

  return (
    <TabsContent value="all" className="m-0 border-none outline-none">
      <Card className="border-border shadow-sm flex flex-col min-h-[600px]">
        {/* --- Header & Filters --- */}
        <CardHeader className="py-4 px-5 sm:px-6 border-b bg-muted/5 space-y-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              รายการวันลาทั้งหมด
            </CardTitle>
            <span className="text-xs text-muted-foreground hidden sm:inline-block">
              {totalRecords > 0 ? `พบ ${totalRecords} รายการ` : ''}
            </span>
          </div>

          {/* Smart Filter Grid - Handles mobile wrapping perfectly */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-3">
            {/* Search Input (Grows to take available space) */}
            <div className="relative flex-grow sm:min-w-[200px] md:min-w-[250px] max-w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหาด้วยชื่อ หรือแผนก..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="bg-background pl-9 h-9 text-xs sm:text-sm"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap gap-2 shrink-0">
              <Select value={typeFilter} onValueChange={onTypeFilterChange}>
                <SelectTrigger className="w-[130px] sm:w-[140px] bg-background h-9 text-xs">
                  <SelectValue placeholder="ประเภท" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    ทุกประเภท
                  </SelectItem>
                  {leaveTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value} className="text-xs">
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={String(fiscalYearFilter)}
                onValueChange={(value) =>
                  onFiscalYearFilterChange(value === 'all' ? 'all' : Number(value))
                }
              >
                <SelectTrigger className="w-[132px] sm:w-[148px] bg-background h-9 text-xs justify-start">
                  <div className="min-w-0 truncate text-left">
                    <span className="mr-1 text-muted-foreground">ปีงบ:</span>
                    <span className="font-medium text-foreground">{fiscalYearLabel}</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel className="text-[11px] text-muted-foreground">
                      ช่วงการแสดงผล
                    </SelectLabel>
                    <SelectItem value="all" className="text-xs">
                      ทุกปีงบประมาณ
                    </SelectItem>
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel className="text-[11px] text-muted-foreground">
                      เลือกปีงบประมาณ
                    </SelectLabel>
                    {fiscalYearOptions.map((year) => (
                      <SelectItem key={year} value={String(year)} className="text-xs">
                        ปี {year}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Select
                value={`${sortBy}:${sortDir}`}
                onValueChange={(value) => {
                  const [nextSortBy, nextSortDir] = value.split(':') as [SortBy, SortDir];
                  onSortChange(nextSortBy, nextSortDir);
                }}
              >
                <SelectTrigger className="w-[140px] sm:w-[150px] bg-background h-9 text-xs flex gap-2">
                  <Filter className="h-3.5 w-3.5 shrink-0 text-muted-foreground hidden sm:block" />
                  <SelectValue placeholder="เรียงลำดับ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="start_date:desc" className="text-xs">
                    วันที่ลา (ใหม่สุด)
                  </SelectItem>
                  <SelectItem value="start_date:asc" className="text-xs">
                    วันที่ลา (เก่าสุด)
                  </SelectItem>
                  <SelectItem value="name:asc" className="text-xs">
                    ชื่อ (ก-ฮ)
                  </SelectItem>
                  <SelectItem value="name:desc" className="text-xs">
                    ชื่อ (ฮ-ก)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        {/* --- Main Table Content --- */}
        <CardContent className="p-0 flex-1 flex flex-col">
          <div className="flex-1">
            <LeaveTable
              records={leaveRecords}
              onViewDetail={onViewDetail}
              onEdit={onEdit}
              onDelete={onDelete}
              onRecordReport={onRecordReport}
              getLeaveTypeColor={getLeaveTypeColor}
              formatDateDisplay={formatDateDisplay}
              showDeleteButton={showDeleteButton}
              isLoading={isLoading}
              isError={isError}
              onRetry={onRetry}
            />
          </div>

          {/* --- Footer Pagination --- */}
          <div className="border-t bg-muted/10 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 mt-auto">
            <span className="text-xs text-muted-foreground">
              แสดง{' '}
              <span className="font-medium text-foreground">
                {showingFrom}-{showingTo}
              </span>{' '}
              จาก <span className="font-medium text-foreground">{totalRecords}</span> รายการ
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 sm:px-3 text-xs bg-background gap-1"
                disabled={!canPrevPage}
                onClick={onPrevPage}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">ก่อนหน้า</span>
              </Button>

              <span className="text-xs font-medium px-2 text-foreground">
                หน้า {Math.min(page + 1, totalPages)}{' '}
                <span className="text-muted-foreground font-normal">/ {totalPages}</span>
              </span>

              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 sm:px-3 text-xs bg-background gap-1 flex-row-reverse sm:flex-row"
                disabled={!canNextPage}
                onClick={onNextPage}
              >
                <span className="hidden sm:inline">ถัดไป</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
