'use client'

import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { formatThaiNumber } from '@/shared/utils/thai-locale'
import { formatPeriodLabel } from '../model/detail.helpers'

export function PayrollActionDialog({
  open,
  onClose,
  actionType,
  setComment,
  comment,
  approvalLabel,
  periodMonth,
  periodYear,
  totalHeadcount,
  totalAmount,
  onConfirm,
  isPending,
}: {
  open: boolean
  onClose: () => void
  actionType: 'approve' | 'reject' | null
  setComment: (value: string) => void
  comment: string
  approvalLabel: string
  periodMonth?: number | null
  periodYear?: number | null
  totalHeadcount?: number | null
  totalAmount?: number | null
  onConfirm: () => void
  isPending: boolean
}) {
  const isApprove = actionType === 'approve'

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden bg-card border-border">
        <DialogHeader
          className={cn(
            'px-6 py-6 border-b text-center relative',
            isApprove ? 'bg-emerald-50/30' : 'bg-destructive/5',
          )}
        >
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-full mb-4 bg-background shadow-sm border"
            style={{
              borderColor: isApprove ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
            }}
          >
            {isApprove ? (
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            ) : (
              <XCircle className="h-7 w-7 text-destructive" />
            )}
          </div>
          <DialogTitle className="text-2xl font-semibold">
            {isApprove ? 'ยืนยันการอนุมัติ' : 'ส่งกลับแก้ไข / ปฏิเสธ'}
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm text-foreground/70">
            รอบเบิกจ่าย {formatPeriodLabel(periodMonth ?? null, periodYear ?? null)}
            {isApprove && <span className="block mt-1 font-medium">บทบาทปัจจุบัน: {approvalLabel}</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-6">
          <div className="flex items-center justify-around rounded-xl bg-muted/30 p-5 border border-border/50">
            <div className="text-center space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                จำนวนบุคลากร
              </p>
              <p className="text-3xl font-bold tracking-tight text-foreground">
                {formatThaiNumber(Number(totalHeadcount ?? 0))}{' '}
                <span className="text-sm font-normal text-muted-foreground">คน</span>
              </p>
            </div>
            <div className="w-px h-12 bg-border"></div>
            <div className="text-center space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                ยอดจ่ายสุทธิ
              </p>
              <p className="text-3xl font-bold tracking-tight text-primary">
                {formatThaiNumber(Number(totalAmount ?? 0))}{' '}
                <span className="text-sm font-normal text-muted-foreground">บ.</span>
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center justify-between text-sm font-medium text-foreground">
              <span>{isApprove ? 'หมายเหตุเพิ่มเติม (ถ้ามี)' : 'เหตุผลที่ส่งกลับแก้ไข'}</span>
              {!isApprove && (
                <span className="text-xs font-semibold text-destructive px-1.5 py-0.5 bg-destructive/10 rounded">
                  * จำเป็น
                </span>
              )}
            </label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                isApprove
                  ? 'ข้อความถึงผู้อนุมัติขั้นถัดไป...'
                  : 'ระบุข้อผิดพลาดที่พบเพื่อให้เจ้าหน้าที่นำไปแก้ไข...'
              }
              className={cn(
                'resize-none h-28 bg-background text-base',
                !isApprove && !comment.trim() && 'border-destructive/50 focus-visible:ring-destructive',
              )}
            />
          </div>
        </div>

        <DialogFooter className="p-4 border-t bg-muted/10 gap-3 sm:gap-0">
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            ยกเลิก
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isPending || (!isApprove && !comment.trim())}
            variant={isApprove ? 'success' : 'destructive'}
            className="min-w-[140px] text-base"
          >
            {isPending && <Loader2 className="h-5 w-5 mr-2 animate-spin" />}
            {isApprove ? 'ยืนยันอนุมัติ' : 'ยืนยันส่งกลับ'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
