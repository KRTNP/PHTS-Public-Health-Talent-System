'use client';

import { Fragment, memo } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Database,
  Eye,
  UserCog,
  XCircle,
} from 'lucide-react';
import { TableRowMoreActionsTrigger } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getQueueReasonLabel,
  getQueueStatusBadge,
  type AccessReviewPayloadEntry,
} from '@/features/access-review/utils';
import type { AccessReviewQueueRow } from '@/features/access-review/shared';
import { cn } from '@/lib/utils';
import { formatThaiDateTime } from '@/shared/utils/thai-locale';
import { getRoleLabel, ROLE_OPTIONS } from '@/shared/utils/role-label';

type AccessReviewQueueRowProps = {
  row: AccessReviewQueueRow;
  isExpanded: boolean;
  isSelected: boolean;
  draftRole: string;
  payloadEntries: AccessReviewPayloadEntry[];
  isActionPending: boolean;
  onToggleExpanded: (queueId: number) => void;
  onToggleSelection: (queueId: number, checked: boolean) => void;
  onRoleDraftChange: (queueId: number, role: string) => void;
  onFixRoleAndResolve: (row: AccessReviewQueueRow, nextRole: string) => void;
  onResolveQueue: (queueId: number, action: 'RESOLVE' | 'DISMISS') => void;
};

function AccessReviewQueueRowComponent({
  row,
  isExpanded,
  isSelected,
  draftRole,
  payloadEntries,
  isActionPending,
  onToggleExpanded,
  onToggleSelection,
  onRoleDraftChange,
  onFixRoleAndResolve,
  onResolveQueue,
}: AccessReviewQueueRowProps) {
  return (
    <Fragment>
      <tr>
        <td className="p-4 align-top">
          <div className="flex items-center justify-center">
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => onToggleSelection(row.queue_id, checked === true)}
              aria-label={`เลือกเคสของ ${row.user_name || row.citizen_id}`}
              disabled={row.status !== 'OPEN'}
            />
          </div>
        </td>
        <td className="p-4 align-top">
          <div className="group flex items-start gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="mt-0.5 h-7 w-7 shrink-0 text-muted-foreground transition-opacity md:opacity-0 md:group-hover:opacity-100"
              onClick={() => onToggleExpanded(row.queue_id)}
              aria-label={isExpanded ? 'ซ่อนรายละเอียด' : 'ดูรายละเอียด'}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-foreground">
                {row.user_name || 'ไม่ระบุชื่อ'}
              </span>
              <span className="w-fit rounded bg-muted/50 px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                {row.citizen_id}
              </span>
            </div>
          </div>
        </td>
        <td className="p-4 align-top">
          <div className="flex flex-col items-start gap-2">
            <span className="text-sm font-medium text-foreground">
              {getQueueReasonLabel(row.reason_code)}
            </span>
            {getQueueStatusBadge(row.status)}
          </div>
        </td>
        <td className="p-4 align-top">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{getRoleLabel(row.current_role)}</span>
            <div className="flex items-center gap-1.5">
              <div
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  row.is_active === 1 ? 'bg-emerald-500' : 'bg-slate-300',
                )}
              />
              <span
                className={cn(
                  'text-xs',
                  row.is_active === 1 ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {row.is_active === 1 ? 'บัญชีเปิดใช้งาน' : 'บัญชีปิดใช้งาน'}
              </span>
            </div>
          </div>
        </td>
        <td className="p-4 align-top">
          <div className="flex flex-col gap-1 text-xs">
            <span className="text-foreground">
              {formatThaiDateTime(row.last_detected_at, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </span>
            <span
              className="text-muted-foreground"
              title={`First seen: Batch #${row.source_batch_id}`}
            >
              Batch: #{row.last_seen_batch_id ?? '-'}
            </span>
          </div>
        </td>
        <td className="p-4 align-top text-right">
          <div className="flex items-center justify-end gap-2">
            {row.status === 'OPEN' ? (
              <Select
                value={draftRole}
                onValueChange={(value) => onRoleDraftChange(row.queue_id, value)}
                disabled={isActionPending}
              >
                <SelectTrigger className="h-8 w-[140px] bg-background text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((role) => (
                    <SelectItem key={role} value={role}>
                      {getRoleLabel(role)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <TableRowMoreActionsTrigger />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href={`/admin/users/${row.user_id}`} className="cursor-pointer">
                    <Eye className="mr-2 h-4 w-4 text-muted-foreground" />
                    ดูรายละเอียดผู้ใช้นี้
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onToggleExpanded(row.queue_id)}>
                  {isExpanded ? (
                    <ChevronUp className="mr-2 h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="mr-2 h-4 w-4 text-muted-foreground" />
                  )}
                  {isExpanded ? 'ซ่อนรายละเอียดเคส' : 'ดูรายละเอียดเคส'}
                </DropdownMenuItem>

                {row.status === 'OPEN' ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onFixRoleAndResolve(row, draftRole)}
                      className="font-medium text-primary focus:text-primary"
                    >
                      <UserCog className="mr-2 h-4 w-4" /> บันทึกสิทธิ์ + ปิดเคส
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onResolveQueue(row.queue_id, 'RESOLVE')}
                      className="text-emerald-600 focus:text-emerald-600"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" /> ปิดเคส (ข้อมูลถูกแล้ว)
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onResolveQueue(row.queue_id, 'DISMISS')}
                      className="text-muted-foreground"
                    >
                      <XCircle className="mr-2 h-4 w-4" /> ยกเลิกเคสนี้
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </td>
      </tr>

      {isExpanded ? (
        <tr className="border-b bg-muted/10">
          <td colSpan={6} className="px-14 py-5">
            <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
              <div className="space-y-4">
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <Database className="h-3 w-3" />
                    ข้อมูลเปรียบเทียบจากระบบตรวจจับ (Payload)
                  </p>
                  {payloadEntries.length > 0 ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {payloadEntries.map((entry) => (
                        <div key={entry.key} className="rounded-md border bg-background px-3 py-2 shadow-sm">
                          <p className="text-[10px] text-muted-foreground">{entry.label}</p>
                          <p className="mt-0.5 break-words text-sm font-medium text-foreground">
                            {entry.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed bg-background px-3 py-4 text-center text-sm text-muted-foreground">
                      ไม่มีรายละเอียดเพิ่มเติมจาก Payload ของคิวนี้
                    </div>
                  )}
                </div>

                {row.note ? (
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <AlertTriangle className="h-3 w-3" />
                      หมายเหตุเพิ่มเติม
                    </p>
                    <div className="rounded-md border bg-amber-50/50 px-3 py-2 text-sm text-amber-800 shadow-sm">
                      {row.note}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-3">
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    แนวทางจัดการ
                  </p>
                  <ul className="mt-2.5 list-outside space-y-2.5 pl-4 text-sm text-foreground/80">
                    <li className="leading-relaxed">
                      หากบทบาทปัจจุบัน <span className="font-semibold text-foreground">ไม่ถูกต้อง</span>{' '}
                      ให้เลือกบทบาทใหม่ใน Dropdown ด้านบน แล้วกด <strong>“บันทึกสิทธิ์ + ปิดเคส”</strong>
                    </li>
                    <li className="leading-relaxed">
                      หากตรวจสอบแล้วข้อมูลปัจจุบัน{' '}
                      <span className="font-semibold text-foreground">ถูกต้องอยู่แล้ว</span>{' '}
                      ให้กดปุ่ม 3 จุด เลือก <strong>“ปิดเคส (ข้อมูลถูกแล้ว)”</strong>
                    </li>
                    <li className="text-xs leading-relaxed text-muted-foreground">
                      หากเคสนี้เป็นข้อมูลซ้ำซ้อนให้ใช้ “ยกเลิกเคสนี้” (Dismiss)
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
}

export const AccessReviewQueueRowItem = memo(AccessReviewQueueRowComponent);
