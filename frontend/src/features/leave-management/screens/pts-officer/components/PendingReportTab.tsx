'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TabsContent } from '@/components/ui/tabs';
import { LeaveTable } from '@/features/leave-management/components/table/LeaveTable';
import type { LeaveRecord } from '@/features/leave-management/core/types';
import { UserCheck } from 'lucide-react';

export function PendingReportTab({
  records,
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
}: {
  records: LeaveRecord[];
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
}) {
  return (
    // UX Fix: ป้องกันขอบ Focus สีดำเวลาเปลี่ยน Tab
    <TabsContent value="pending-report" className="m-0 border-none outline-none">
      {/* UX Fix: รักษาความสูงขั้นต่ำไว้เพื่อไม่ให้หน้าจอกระตุกเวลาเปลี่ยน Tab */}
      <Card className="border-border shadow-sm flex flex-col min-h-[600px]">
        <CardHeader className="py-4 px-5 sm:px-6 border-b bg-muted/5 space-y-1.5">
          <CardTitle className="text-base font-semibold flex items-center gap-2.5">
            {/* UX Fix: ใส่สีเน้นให้รู้ว่าเป็น Action ที่ต้องจัดการ */}
            <div className="p-1.5 bg-amber-500/10 text-amber-600 rounded-md shadow-sm">
              <UserCheck className="h-4 w-4" />
            </div>
            รายการรอรายงานตัว
          </CardTitle>
          <CardDescription className="text-xs leading-relaxed max-w-3xl">
            รายการในแท็บนี้ยังต้องติดตามการรายงานตัวครั้งสุดท้าย
            หากมีการรายงานตัวแล้วแต่เป็นการกลับไปศึกษาต่อหรืออบรมต่อ
            รายการจะยังคงอยู่ที่นี่จนกว่าจะมีการรายงานตัวเพื่อ{' '}
            <strong>กลับมาปฏิบัติงานตามปกติ</strong>
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0 flex-1 flex flex-col">
          <div className="flex-1">
            <LeaveTable
              records={records}
              onViewDetail={onViewDetail}
              onEdit={onEdit}
              onDelete={onDelete}
              onRecordReport={onRecordReport}
              getLeaveTypeColor={getLeaveTypeColor}
              formatDateDisplay={formatDateDisplay}
              showReportButton
              showDeleteButton={showDeleteButton}
              isLoading={isLoading}
              isError={isError}
              onRetry={onRetry}
            />
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
