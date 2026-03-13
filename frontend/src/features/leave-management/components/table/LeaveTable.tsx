'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableRowViewAction } from '@/components/common';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarCheck, Edit, Trash2, SearchX, AlertCircle } from 'lucide-react';
import type { LeaveRecord } from '@/features/leave-management/core/types';
import { cn } from '@/lib/utils';

export function LeaveTable({
  records,
  onViewDetail,
  onEdit,
  onDelete,
  onRecordReport,
  getLeaveTypeColor,
  formatDateDisplay,
  showReportButton = false,
  showEditButton = true,
  showDeleteButton = true,
  isLoading = false,
  isError = false,
  onRetry,
}: {
  records: LeaveRecord[];
  onViewDetail: (record: LeaveRecord) => void;
  onEdit: (record: LeaveRecord) => void;
  onDelete: (record: LeaveRecord) => void;
  onRecordReport: (record: LeaveRecord) => void;
  getLeaveTypeColor: (type: string) => string;
  formatDateDisplay: (date: string) => string;
  showReportButton?: boolean;
  showEditButton?: boolean;
  showDeleteButton?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}) {
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm">
        <div className="p-4 bg-destructive/10 rounded-full">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <span className="text-muted-foreground">ไม่สามารถโหลดข้อมูลตารางได้</span>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="bg-background shadow-sm">
            ลองใหม่อีกครั้ง
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/60 overflow-x-auto bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/10 hover:bg-muted/10">
            <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium w-[240px] min-w-[200px]">
              ชื่อ-นามสกุล
            </TableHead>
            <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium w-[180px] min-w-[150px]">
              หน่วยงาน/กลุ่มงาน
            </TableHead>
            <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium w-[140px] min-w-[120px]">
              ประเภทการลา
            </TableHead>
            <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium w-[220px] min-w-[180px]">
              ช่วงวันที่ลา
            </TableHead>
            <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium text-center w-[90px] min-w-[90px]">
              จำนวนวัน
            </TableHead>
            {/* Sticky Action Column on mobile if needed, or just right aligned */}
            <TableHead className="w-[120px] text-right sticky right-0 bg-muted/10 backdrop-blur-sm"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-border/50">
          {isLoading ? (
            // Skeleton Loading State
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={`skeleton-${i}`}>
                <TableCell>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-[150px]" />
                    <Skeleton className="h-3 w-[100px]" />
                  </div>
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-[130px]" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-6 w-[80px] rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-[160px]" />
                </TableCell>
                <TableCell className="text-center">
                  <Skeleton className="h-4 w-6 mx-auto" />
                </TableCell>
                <TableCell className="text-right sticky right-0 bg-card">
                  <Skeleton className="h-8 w-20 ml-auto rounded-md" />
                </TableCell>
              </TableRow>
            ))
          ) : records.length === 0 ? (
            // Empty State
            <TableRow>
              <TableCell colSpan={6} className="h-64 text-center">
                <div className="flex flex-col items-center justify-center text-muted-foreground">
                  <SearchX className="h-10 w-10 opacity-20 mb-3" />
                  <p className="text-sm font-medium text-foreground">ไม่พบรายการวันลา</p>
                  <p className="text-xs mt-1">ลองเปลี่ยนเงื่อนไขการค้นหาหรือเพิ่มรายการใหม่</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            // Actual Data Rows
            records.map((record) => (
              <TableRow key={record.id} className="group hover:bg-muted/20 transition-colors">
                <TableCell className="align-top py-3">
                  <div className="flex flex-col max-w-[220px]">
                    <p
                      className="font-semibold text-sm text-foreground truncate"
                      title={record.personName}
                    >
                      {record.personName}
                    </p>
                    <p
                      className="text-[11px] text-muted-foreground truncate mt-0.5"
                      title={record.personPosition}
                    >
                      {record.personPosition}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="align-top py-3">
                  <span
                    className="block text-sm text-muted-foreground truncate max-w-[160px]"
                    title={record.personDepartment}
                  >
                    {record.personDepartment || '-'}
                  </span>
                </TableCell>
                <TableCell className="align-top py-3">
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] font-medium whitespace-nowrap',
                      getLeaveTypeColor(record.type),
                    )}
                  >
                    {record.typeName}
                  </Badge>
                </TableCell>
                <TableCell className="align-top py-3">
                  <span className="text-xs font-mono text-muted-foreground whitespace-nowrap block mt-0.5">
                    {formatDateDisplay(record.userStartDate)} –{' '}
                    {formatDateDisplay(record.userEndDate)}
                  </span>
                </TableCell>
                <TableCell className="align-top py-3 text-center">
                  <span className="font-semibold text-sm tabular-nums text-foreground">
                    {record.days}
                  </span>
                </TableCell>
                <TableCell className="align-top py-2.5 sticky right-0 bg-card group-hover:bg-muted/30 transition-colors">
                  {/* UX Tweak: Show primary action (Eye) slightly visible, and others on hover for desktop, but always visible on touch devices via md:opacity classes */}
                  <div className="flex items-center justify-end gap-1 md:opacity-40 md:group-hover:opacity-100 transition-opacity focus-within:opacity-100">
                    {showReportButton &&
                      record.requireReport &&
                      record.reportStatus === 'pending' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 text-amber-600 border-amber-200 bg-amber-50 hover:bg-amber-100 hover:text-amber-700 md:opacity-100"
                          onClick={() => onRecordReport(record)}
                          title="บันทึกการรายงานตัว"
                        >
                          <CalendarCheck className="h-3.5 w-3.5" />{' '}
                          <span className="hidden xl:inline text-xs">รายงานตัว</span>
                        </Button>
                      )}
                    <TableRowViewAction
                      onClick={() => onViewDetail(record)}
                      className="hover:bg-primary/10"
                    />
                    {showEditButton && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                        onClick={() => onEdit(record)}
                        title="แก้ไข"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {showDeleteButton && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => onDelete(record)}
                        title="ลบ"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
