'use client';

import { AlertCircle, ClipboardCheck, User, X, RefreshCcw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import type { PayoutDetail } from '@/features/payroll/api';
import { PayrollChecksPanel } from '../checks';
import type { PayrollRow } from '../model/detail.types';

export function PayrollChecksDialog({
  open,
  onOpenChange,
  selectedCheckRow,
  payoutDetailLoading,
  payoutDetailError,
  payoutDetail,
  onRetry, // เพิ่ม Prop สำหรับฟังก์ชันโหลดข้อมูลใหม่เมื่อเกิด Error
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCheckRow: PayrollRow | null;
  payoutDetailLoading: boolean;
  payoutDetailError: boolean;
  payoutDetail: PayoutDetail | undefined;
  onRetry?: () => void; // ทำให้เป็น Optional เผื่อบางจุดเรียกใช้โดยยังไม่ได้ส่งฟังก์ชันนี้มา
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl p-0 gap-0 overflow-hidden bg-background border-border shadow-2xl flex flex-col max-h-[90vh] rounded-2xl">
        {/* Modern Clean Header: Sticky for better context retaining */}
        {/* ใช้ pr-14 md:pr-16 เพื่อเว้นพื้นที่ให้ปุ่ม X (Close) ของ Dialog ดั้งเดิม ไม่ให้ทับกับ Card */}
        <DialogHeader className="px-6 py-5 md:px-8 md:py-6 pr-14 md:pr-16 border-b border-border bg-background/95 backdrop-blur-xl shrink-0 sticky top-0 z-20">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
            {/* Left: Title Area */}
            <div className="space-y-2 text-left">
              <div>
                <DialogTitle className="flex items-center gap-2 text-xl md:text-2xl font-bold tracking-tight text-foreground">
                  <ClipboardCheck className="h-5 w-5 text-primary shrink-0" />
                  <span>รายละเอียดการคำนวณยอดเงิน</span>
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-sm mt-1">
                  ตรวจสอบความถูกต้องของตัวแปรและที่มาของรายได้รายบุคคล
                </DialogDescription>
              </div>
            </div>

            {/* Right: User Context Card - Minimalist Approach */}
            {selectedCheckRow && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border/50">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="flex flex-col text-left pr-2">
                  <span className="text-xs text-muted-foreground font-medium mb-0.5">
                    ข้อมูลผู้รับเงิน
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground text-sm">
                      {selectedCheckRow.name}
                    </span>
                    {/* ปรับ py ให้ฟอนต์ตัวเลขมีพื้นที่หายใจ ไม่อึดอัดจนเกินไป */}
                    <Badge
                      variant="outline"
                      className="font-mono text-xs px-2 py-0.5 h-auto text-muted-foreground bg-background"
                    >
                      {selectedCheckRow.citizenId}
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Dynamic Content Area */}
        <div className="p-6 md:p-8 overflow-y-auto flex-1 bg-muted/10">
          {payoutDetailLoading ? (
            /* Refined Loading State - ใช้ Skeleton ให้ล้อกับ Layout จริง */
            <div className="space-y-8 animate-pulse">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="space-y-3 p-5 rounded-xl border border-border bg-background shadow-sm"
                  >
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-8 w-32" />
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-border bg-background p-6 space-y-4 shadow-sm">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-[300px] w-full rounded-lg" />
              </div>
            </div>
          ) : payoutDetailError ? (
            /* Refined Error State: Added clear actions */
            <div className="flex flex-col items-center justify-center py-20 md:py-28 px-4 text-center animate-in fade-in zoom-in-95 duration-300">
              <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6 ring-8 ring-destructive/5">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">ไม่สามารถโหลดข้อมูลได้</h3>
              <p className="text-muted-foreground mt-2 text-sm max-w-sm leading-relaxed">
                เกิดข้อผิดพลาดในการดึงข้อมูลทวนสอบ กรุณาตรวจสอบการเชื่อมต่อ หรือติดต่อผู้ดูแลระบบ
              </p>

              {/* Action Buttons Container */}
              <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
                {/* ปุ่ม Retry จะโผล่มาเฉพาะเมื่อมีการส่งฟังก์ชัน onRetry เข้ามา */}
                {onRetry && (
                  <button
                    onClick={onRetry}
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    ลองใหม่อีกครั้ง
                  </button>
                )}
                <button
                  onClick={() => onOpenChange(false)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-background border border-input text-foreground rounded-lg text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-4 w-4" />
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>
          ) : (
            /* Success State */
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <PayrollChecksPanel fallbackRow={selectedCheckRow} payoutDetail={payoutDetail} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
