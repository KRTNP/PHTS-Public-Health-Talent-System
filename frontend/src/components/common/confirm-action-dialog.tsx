'use client';

import * as React from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

type ConfirmActionDialogProps = {
  trigger: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  /** * Use 'destructive' for delete actions to show red button and warning icon
   */
  variant?: 'default' | 'destructive';
  disabled?: boolean;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmActionDialog({
  trigger,
  title,
  description,
  confirmText = 'ยืนยัน',
  cancelText = 'ยกเลิก',
  variant = 'default',
  disabled = false,
  onConfirm,
}: ConfirmActionDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const handleConfirm = async (e: React.MouseEvent<HTMLButtonElement>) => {
    // Prevent dialog from closing immediately
    e.preventDefault();

    if (pending) return;
    setPending(true);

    try {
      await onConfirm();
      setOpen(false);
    } catch (error) {
      console.error('Confirm action failed:', error);
      // Optional: Add toast error here if needed
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      {/* ใช้ div ครอบเพื่อรองรับกรณีที่ trigger ไม่ได้เป็น button มาตรฐาน ช่วยป้องกันปัญหา disabled state */}
      <div className={cn('inline-block', disabled && 'cursor-not-allowed opacity-50')}>
        <AlertDialogTrigger asChild disabled={disabled}>
          <div className={cn(disabled && 'pointer-events-none')}>{trigger}</div>
        </AlertDialogTrigger>
      </div>

      <AlertDialogContent className="max-w-[450px] gap-6">
        {/* ปรับโครงสร้าง Header ให้แยก Icon และข้อความออกจากกันเพื่อป้องกัน Layout พังเมื่อข้อความยาว */}
        <AlertDialogHeader className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          {variant === 'destructive' && (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
            </div>
          )}
          <div className="flex flex-col gap-2 text-center sm:text-left mt-1">
            <AlertDialogTitle className="text-lg">{title}</AlertDialogTitle>
            {description && (
              <AlertDialogDescription className="text-sm leading-relaxed">
                {description}
              </AlertDialogDescription>
            )}
          </div>
        </AlertDialogHeader>

        <AlertDialogFooter className="sm:justify-end gap-2">
          <AlertDialogCancel disabled={pending} className="mt-0 sm:mt-0">
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={handleConfirm}
            className={cn(
              'min-w-[100px]',
              variant === 'destructive' &&
                'bg-destructive text-destructive-foreground hover:bg-destructive/90',
            )}
          >
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                กำลังดำเนินการ...
              </>
            ) : (
              confirmText
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
