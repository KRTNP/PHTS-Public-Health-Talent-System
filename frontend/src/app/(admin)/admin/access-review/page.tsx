'use client';

import { useCallback, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  RefreshCw,
  ShieldCheck,
  Filter,
  Search,
  CheckCircle2,
  XCircle,
  UserCog,
  ChevronLeft,
  ChevronRight,
  X,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AccessReviewQueueRowItem,
  getPayloadEntries,
  getQueueReasonLabel,
  useAccessReviewQueue,
  useResolveAccessReviewQueueItem,
  useResolveAccessReviewQueueItems,
} from '@/features/access-review/queue';
import type { AccessReviewQueueRow, AccessReviewQueueStatus } from '@/features/access-review/shared';
import { useUpdateUserRole } from '@/features/system/users';
import { formatThaiNumber } from '@/shared/utils/thai-locale';
import { getRoleLabel, ROLE_OPTIONS } from '@/shared/utils/role-label';
import { cn } from '@/lib/utils';
import { AdminPageShell } from '@/components/admin/admin-page-shell';

const LIMIT_OPTIONS = [10, 20, 50] as const;

type RoleChangeDialogState = {
  row: AccessReviewQueueRow;
  nextRole: string;
  reason: string;
  hasError?: boolean;
} | null;

type BulkQueueActionDialogState = {
  action: 'RESOLVE' | 'DISMISS';
  queueIds: number[];
  note: string;
} | null;

export default function AccessReviewPage() {
  const [queuePage, setQueuePage] = useState(1);
  const [queueLimit, setQueueLimit] = useState<number>(10);

  // Filters
  const [queueStatusFilter, setQueueStatusFilter] = useState<'all' | AccessReviewQueueStatus>('OPEN');
  const [queueReasonFilter, setQueueReasonFilter] = useState<string>('all');
  const [queueRoleFilter, setQueueRoleFilter] = useState<string>('all');
  const [queueActiveFilter, setQueueActiveFilter] = useState<'all' | '1' | '0'>('all');
  const [queueBatchFilter, setQueueBatchFilter] = useState<string>('');
  const [queueSearchFilter, setQueueSearchFilter] = useState<string>('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [expandedQueueIds, setExpandedQueueIds] = useState<number[]>([]);
  const [selectedQueueIds, setSelectedQueueIds] = useState<number[]>([]);
  const [queueRoleDraft, setQueueRoleDraft] = useState<Record<number, string>>({});
  const [roleChangeDialog, setRoleChangeDialog] = useState<RoleChangeDialogState>(null);
  const [bulkQueueActionDialog, setBulkQueueActionDialog] = useState<BulkQueueActionDialogState>(null);

  const queueQuery = useAccessReviewQueue({
    page: queuePage,
    limit: queueLimit,
    status: queueStatusFilter === 'all' ? undefined : queueStatusFilter,
    reason_code: queueReasonFilter === 'all' ? undefined : queueReasonFilter,
    current_role: queueRoleFilter === 'all' ? undefined : queueRoleFilter,
    is_active: queueActiveFilter === 'all' ? undefined : (Number(queueActiveFilter) as 0 | 1),
    batch_id: queueBatchFilter.trim().length > 0 && !Number.isNaN(Number(queueBatchFilter)) ? Number(queueBatchFilter) : undefined,
    search: queueSearchFilter.trim().length > 0 ? queueSearchFilter.trim() : undefined,
  });

  const resolveQueueMutation = useResolveAccessReviewQueueItem();
  const resolveQueueItemsMutation = useResolveAccessReviewQueueItems();
  const updateUserRoleMutation = useUpdateUserRole();

  const queueResponse = queueQuery.data;
  const queueRows = useMemo(
    () => (queueResponse?.rows ?? []) as AccessReviewQueueRow[],
    [queueResponse?.rows],
  );
  const queueReasonOptions = queueResponse?.reason_options ?? [];
  const queueTotalPages = Math.max(1, Math.ceil(Number(queueResponse?.total ?? 0) / Number(queueResponse?.limit ?? queueLimit)));

  const activeFilterChips = [
    queueRoleFilter !== 'all' ? { key: 'role', label: `บทบาท: ${getRoleLabel(queueRoleFilter)}`, clear: () => { setQueueRoleFilter('all'); setQueuePage(1); } } : null,
    queueReasonFilter !== 'all' ? { key: 'reason', label: `เหตุผล: ${getQueueReasonLabel(queueReasonFilter)}`, clear: () => { setQueueReasonFilter('all'); setQueuePage(1); } } : null,
    queueActiveFilter !== 'all' ? { key: 'active', label: `สถานะบัญชี: ${queueActiveFilter === '1' ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}`, clear: () => { setQueueActiveFilter('all'); setQueuePage(1); } } : null,
    queueBatchFilter.trim() ? { key: 'batch', label: `Batch #${queueBatchFilter.trim()}`, clear: () => { setQueueBatchFilter(''); setQueuePage(1); } } : null,
  ].filter(Boolean) as Array<{ key: string; label: string; clear: () => void }>;

  const expandedQueueIdSet = useMemo(() => new Set(expandedQueueIds), [expandedQueueIds]);
  const selectedQueueIdSet = useMemo(() => new Set(selectedQueueIds), [selectedQueueIds]);
  const openQueueIds = useMemo(
    () => queueRows.filter((row) => row.status === 'OPEN').map((row) => row.queue_id),
    [queueRows],
  );
  const openQueueIdSet = useMemo(() => new Set(openQueueIds), [openQueueIds]);
  const selectedOpenQueueIds = useMemo(
    () => selectedQueueIds.filter((queueId) => openQueueIdSet.has(queueId)),
    [openQueueIdSet, selectedQueueIds],
  );
  const isAllOpenRowsSelected = openQueueIds.length > 0 && selectedOpenQueueIds.length === openQueueIds.length;
  const isPartiallySelected = selectedOpenQueueIds.length > 0 && !isAllOpenRowsSelected;
  const payloadEntriesByQueueId = useMemo(
    () =>
      new Map(queueRows.map((row) => [row.queue_id, getPayloadEntries(row.payload_json)])),
    [queueRows],
  );
  const toggleExpanded = useCallback((queueId: number) => {
    setExpandedQueueIds((prev) => prev.includes(queueId) ? prev.filter((id) => id !== queueId) : [...prev, queueId]);
  }, []);

  const handleRoleDraftChange = useCallback((queueId: number, role: string) => {
    setQueueRoleDraft((prev) => ({ ...prev, [queueId]: role }));
  }, []);

  const toggleQueueSelection = useCallback((queueId: number, checked: boolean) => {
    setSelectedQueueIds((prev) =>
      checked ? [...new Set([...prev, queueId])] : prev.filter((id) => id !== queueId),
    );
  }, []);

  const toggleSelectAllOpenRows = (checked: boolean) => {
    if (!checked) {
      setSelectedQueueIds((prev) => prev.filter((queueId) => !openQueueIds.includes(queueId)));
      return;
    }
    setSelectedQueueIds((prev) => [...new Set([...prev, ...openQueueIds])]);
  };

  const handleResolveQueue = useCallback(async (queueId: number, action: 'RESOLVE' | 'DISMISS') => {
    try {
      await resolveQueueMutation.mutateAsync({ id: queueId, payload: { action } });
      toast.success(action === 'RESOLVE' ? 'ปิดเคสเรียบร้อยแล้ว' : 'ยกเลิกเคสเรียบร้อยแล้ว');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'อัปเดตคิวไม่สำเร็จ');
    }
  }, [resolveQueueMutation]);

  const handleFixRoleAndResolve = useCallback(async (row: AccessReviewQueueRow, nextRole: string) => {
    if (row.status !== 'OPEN') return toast.error('แก้ไขสิทธิ์ได้เฉพาะเคสที่ยังค้างตรวจเท่านั้น');

    if (!nextRole || nextRole === row.current_role) return toast.error('กรุณาเลือกบทบาทใหม่ที่แตกต่างจากเดิม');

    setRoleChangeDialog({ row, nextRole, reason: '' });
  }, []);

  const handleBulkQueueAction = async () => {
    if (!bulkQueueActionDialog || bulkQueueActionDialog.queueIds.length === 0) return;

    try {
      const result = await resolveQueueItemsMutation.mutateAsync({
        payload: {
          queue_ids: bulkQueueActionDialog.queueIds,
          action: bulkQueueActionDialog.action,
          note: bulkQueueActionDialog.note.trim() || undefined,
        },
      });
      toast.success(
        bulkQueueActionDialog.action === 'RESOLVE'
          ? `ปิดเคสพร้อมกันแล้ว ${formatThaiNumber(result.updatedCount)} รายการ`
          : `ยกเลิกเคสพร้อมกันแล้ว ${formatThaiNumber(result.updatedCount)} รายการ`,
      );
      setSelectedQueueIds((prev) =>
        prev.filter((queueId) => !bulkQueueActionDialog.queueIds.includes(queueId)),
      );
      setBulkQueueActionDialog(null);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'อัปเดตคิวแบบชุดไม่สำเร็จ');
    }
  };

  const submitRoleChangeAndResolve = async () => {
    if (!roleChangeDialog) return;
    const { row, nextRole, reason } = roleChangeDialog;

    const normalizedReason = reason.trim();
    if (!normalizedReason) {
      setRoleChangeDialog({ ...roleChangeDialog, hasError: true });
      toast.error('กรุณาระบุเหตุผลการเปลี่ยนสิทธิ์');
      return;
    }

    try {
      await updateUserRoleMutation.mutateAsync({ userId: row.user_id, payload: { role: nextRole }});
      await resolveQueueMutation.mutateAsync({
        id: row.queue_id,
        payload: { action: 'RESOLVE', note: `ROLE_UPDATED ${row.current_role} -> ${nextRole} | ${normalizedReason}` },
      });
      toast.success('อัปเดตสิทธิ์และปิดเคสเรียบร้อย');
      setRoleChangeDialog(null);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'แก้ไขสิทธิ์ไม่สำเร็จ');
    }
  };

  const clearFilters = () => {
    setQueueStatusFilter('OPEN');
    setQueueReasonFilter('all');
    setQueueRoleFilter('all');
    setQueueActiveFilter('all');
    setQueueBatchFilter('');
    setQueueSearchFilter('');
    setQueuePage(1);
  };

  return (
    <AdminPageShell
      eyebrow="Review Queue"
      title="ตรวจสอบสิทธิ์การใช้งาน"
      description="จัดการคิวแจ้งเตือนความผิดปกติของสิทธิ์ผู้ใช้งานที่ตรวจพบหลังจากการซิงก์ข้อมูล"
      icon={ShieldCheck}
      actions={
        <Button
          size="sm"
          variant="outline"
          className="gap-2 bg-background/90 shadow-sm"
          onClick={() => queueQuery.refetch()}
          disabled={queueQuery.isFetching}
        >
          <RefreshCw className={cn("h-4 w-4 text-muted-foreground", queueQuery.isFetching && "animate-spin")} /> ดึงข้อมูลล่าสุด
        </Button>
      }
    >

      <Card className="border-border shadow-sm flex flex-col">
        <CardHeader className="border-b bg-muted/5 pb-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-lg">คิวตรวจสอบปัจจุบัน</CardTitle>
              <CardDescription>รายการความขัดแย้งของข้อมูลที่ต้องการการตัดสินใจจากผู้ดูแลระบบ</CardDescription>
            </div>

            {/* Clean Status Summary Badges */}
            <div className="flex bg-background border rounded-lg p-1 shadow-sm overflow-hidden">
              <div className="px-3 py-1 flex flex-col items-center border-r">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">ค้างตรวจ</span>
                <span className="font-bold text-amber-600">{formatThaiNumber(queueResponse?.summary?.open_count ?? 0)}</span>
              </div>
              <div className="px-3 py-1 flex flex-col items-center border-r">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">กำลังตรวจ</span>
                <span className="font-bold text-blue-600">{formatThaiNumber(queueResponse?.summary?.in_review_count ?? 0)}</span>
              </div>
              <div className="px-3 py-1 flex flex-col items-center">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">ปิดแล้ว</span>
                <span className="font-bold text-emerald-600">{formatThaiNumber(queueResponse?.summary?.resolved_count ?? 0)}</span>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 flex-1 flex flex-col">
          {selectedOpenQueueIds.length > 0 && (
            <div className="border-b bg-amber-50/60 px-4 py-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="text-sm text-amber-900">
                  เลือกไว้ <span className="font-semibold">{formatThaiNumber(selectedOpenQueueIds.length)}</span> เคส
                  <span className="text-amber-700"> จากหน้าปัจจุบัน</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2 border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
                    onClick={() =>
                      setBulkQueueActionDialog({
                        action: 'RESOLVE',
                        queueIds: selectedOpenQueueIds,
                        note: '',
                      })
                    }
                  >
                    <CheckCircle2 className="h-4 w-4" /> ปิดเคสที่เลือก
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2 bg-white"
                    onClick={() =>
                      setBulkQueueActionDialog({
                        action: 'DISMISS',
                        queueIds: selectedOpenQueueIds,
                        note: '',
                      })
                    }
                  >
                    <XCircle className="h-4 w-4" /> ยกเลิกเคสที่เลือก
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedQueueIds([])}>
                    ล้างการเลือก
                  </Button>
                </div>
              </div>
            </div>
          )}
          {/* Smart Filter Bar */}
          <div className="p-4 border-b bg-muted/10 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ค้นหาด้วยชื่อ หรือเลขบัตรประชาชน..."
                  value={queueSearchFilter}
                  onChange={(e) => { setQueueSearchFilter(e.target.value); setQueuePage(1); }}
                  className="pl-9 h-9 bg-background"
                />
              </div>

              <div className="flex gap-2 shrink-0">
                <Select value={queueStatusFilter} onValueChange={(v: 'all' | AccessReviewQueueStatus) => { setQueueStatusFilter(v); setQueuePage(1); }}>
                  <SelectTrigger className="h-9 w-[130px] bg-background text-xs"><SelectValue placeholder="สถานะ" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกสถานะ</SelectItem>
                    <SelectItem value="OPEN">ค้างตรวจ</SelectItem>
                    <SelectItem value="IN_REVIEW">กำลังตรวจ</SelectItem>
                    <SelectItem value="RESOLVED">ปิดแล้ว</SelectItem>
                    <SelectItem value="DISMISSED">ยกเลิกเคส</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant={showAdvancedFilters ? "secondary" : "outline"} size="sm" className="h-9 px-3 gap-2 bg-background shadow-sm" onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}>
                  <Filter className="h-3.5 w-3.5" /> <span className="hidden sm:inline">ตัวกรองอื่น</span>
                </Button>
              </div>
            </div>

            {/* Collapsible Advanced Filters */}
            {showAdvancedFilters && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 animate-in slide-in-from-top-2">
                <Select value={queueReasonFilter} onValueChange={(v) => { setQueueReasonFilter(v); setQueuePage(1); }}>
                  <SelectTrigger className="h-8 text-xs bg-background"><SelectValue placeholder="เหตุผลการแจ้งเตือน" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกเหตุผล</SelectItem>
                    {queueReasonOptions.map((code) => <SelectItem key={code} value={code}>{getQueueReasonLabel(code)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={queueRoleFilter} onValueChange={(v) => { setQueueRoleFilter(v); setQueuePage(1); }}>
                  <SelectTrigger className="h-8 text-xs bg-background"><SelectValue placeholder="บทบาทปัจจุบัน" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกบทบาท</SelectItem>
                    {ROLE_OPTIONS.map((role) => <SelectItem key={role} value={role}>{getRoleLabel(role)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={queueActiveFilter} onValueChange={(v: 'all' | '1' | '0') => { setQueueActiveFilter(v); setQueuePage(1); }}>
                  <SelectTrigger className="h-8 text-xs bg-background"><SelectValue placeholder="สถานะบัญชี" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกสถานะบัญชี</SelectItem>
                    <SelectItem value="1">บัญชีเปิดใช้งาน</SelectItem>
                    <SelectItem value="0">บัญชีปิดใช้งาน</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="number" placeholder="ค้นหาด้วย Batch ID" value={queueBatchFilter} onChange={(e) => { setQueueBatchFilter(e.target.value); setQueuePage(1); }} className="h-8 text-xs bg-background" />
                <Button size="sm" variant="ghost" onClick={clearFilters} className="h-8 text-xs text-muted-foreground hover:text-foreground">ล้างตัวกรองทั้งหมด</Button>
              </div>
            )}

            {activeFilterChips.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {activeFilterChips.map((chip) => (
                  <Badge key={chip.key} variant="secondary" className="gap-1 rounded-full px-2.5 py-1 bg-background border">
                    <span className="font-normal text-muted-foreground">{chip.label.split(':')[0]}:</span>
                    <span className="font-medium text-foreground">{chip.label.split(':')[1]}</span>
                    <button
                      type="button"
                      onClick={chip.clear}
                      className="rounded-full p-0.5 ml-0.5 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Clean Data Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground border-b border-border/60">
                <tr>
                  <th className="px-4 py-3 w-[52px]">
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={isAllOpenRowsSelected ? true : isPartiallySelected ? 'indeterminate' : false}
                        onCheckedChange={(checked) => toggleSelectAllOpenRows(checked === true)}
                        aria-label="เลือกทุกเคสที่เปิดอยู่ในหน้านี้"
                        disabled={openQueueIds.length === 0}
                      />
                    </div>
                  </th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap w-[25%]">ผู้ใช้งาน</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap w-[25%]">รายละเอียดปัญหา</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">ข้อมูลปัจจุบัน</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">เวลาตรวจพบ</th>
                  <th className="px-4 py-3 font-medium text-right whitespace-nowrap">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {queueQuery.isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="p-4"><Skeleton className="h-4 w-4 rounded-sm" /></td>
                      <td className="p-4"><div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-24" /></div></td>
                      <td className="p-4"><div className="space-y-2"><Skeleton className="h-4 w-40" /><Skeleton className="h-5 w-20 rounded-full" /></div></td>
                      <td className="p-4"><div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-16" /></div></td>
                      <td className="p-4"><Skeleton className="h-4 w-28" /></td>
                      <td className="p-4 text-right"><Skeleton className="h-8 w-8 ml-auto rounded-md" /></td>
                    </tr>
                  ))
                ) : queueRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="h-48 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <ShieldCheck className="h-10 w-10 text-muted-foreground/30 mb-2" />
                        <p>ไม่พบคิวค้างตรวจตามเงื่อนไขที่กำหนด</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  queueRows.map((row) => (
                    <AccessReviewQueueRowItem
                      key={row.queue_id}
                      row={row}
                      isExpanded={expandedQueueIdSet.has(row.queue_id)}
                      isSelected={selectedQueueIdSet.has(row.queue_id)}
                      draftRole={queueRoleDraft[row.queue_id] ?? row.current_role}
                      payloadEntries={payloadEntriesByQueueId.get(row.queue_id) ?? []}
                      isActionPending={
                        resolveQueueMutation.isPending || updateUserRoleMutation.isPending
                      }
                      onToggleExpanded={toggleExpanded}
                      onToggleSelection={toggleQueueSelection}
                      onRoleDraftChange={handleRoleDraftChange}
                      onFixRoleAndResolve={handleFixRoleAndResolve}
                      onResolveQueue={handleResolveQueue}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Pagination */}
          <div className="border-t bg-muted/10 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 mt-auto">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">แสดงผล</span>
              <Select value={String(queueLimit)} onValueChange={(v) => { setQueueLimit(Number(v)); setQueuePage(1); }}>
                <SelectTrigger className="h-8 w-[70px] text-xs bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LIMIT_OPTIONS.map(v => <SelectItem key={v} value={String(v)}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">จากทั้งหมด <span className="font-medium text-foreground">{formatThaiNumber(queueResponse?.total ?? 0)}</span> รายการ</span>
            </div>

            <div className="flex gap-2 items-center">
              <Button variant="outline" size="sm" className="h-8 px-2 bg-background" onClick={() => setQueuePage(p => Math.max(1, p - 1))} disabled={queuePage <= 1 || queueQuery.isLoading}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs font-medium px-2">หน้า {queuePage} / {queueTotalPages}</span>
              <Button variant="outline" size="sm" className="h-8 px-2 bg-background" onClick={() => setQueuePage(p => Math.min(queueTotalPages, p + 1))} disabled={queuePage >= queueTotalPages || queueQuery.isLoading}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Role Change Confirmation Dialog */}
      <Dialog open={!!roleChangeDialog} onOpenChange={(open) => { if (!open) setRoleChangeDialog(null); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <UserCog className="h-5 w-5" /> ยืนยันการแก้สิทธิ์และปิดเคส
            </DialogTitle>
            <DialogDescription>
              ใช้สำหรับเคสที่ตรวจสอบแล้วว่าจำเป็นต้องเปลี่ยนบทบาทของผู้ใช้ (Role) และปิดคิวการแจ้งเตือนนี้
            </DialogDescription>
          </DialogHeader>

          {roleChangeDialog && (
            <div className="space-y-5 py-2">
              <div className="rounded-lg border bg-muted/20 p-3 text-sm flex flex-col items-center text-center shadow-sm">
                 <p className="font-semibold text-foreground text-base">{roleChangeDialog.row.user_name || 'ไม่ระบุชื่อ'}</p>
                 <span className="text-xs text-muted-foreground font-mono mt-0.5">{roleChangeDialog.row.citizen_id}</span>
                 <Badge variant="secondary" className="mt-3 font-normal bg-background border">{getQueueReasonLabel(roleChangeDialog.row.reason_code)}</Badge>
              </div>

              <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] items-center bg-muted/10 p-4 rounded-lg border">
                <div className="space-y-1.5 text-center">
                  <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">บทบาทปัจจุบัน</Label>
                  <div className="h-9 rounded-md border border-dashed bg-background px-3 text-sm font-medium text-muted-foreground flex items-center justify-center">
                    {getRoleLabel(roleChangeDialog.row.current_role)}
                  </div>
                </div>
                <div className="flex justify-center text-muted-foreground/30">
                   <ArrowRight className="h-5 w-5 rotate-90 sm:rotate-0" />
                </div>
                <div className="space-y-1.5 text-center">
                  <Label className="text-[10px] uppercase text-primary tracking-wider font-semibold">บทบาทใหม่</Label>
                  <div className="h-9 rounded-md border-primary/30 bg-primary/5 text-primary px-3 text-sm font-semibold flex items-center justify-center shadow-sm">
                    {getRoleLabel(roleChangeDialog.nextRole)}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role-change-reason" className={cn("flex justify-between", roleChangeDialog.hasError && "text-destructive")}>
                  <span>เหตุผลการแก้ไขสิทธิ์ <span className="text-destructive">*</span></span>
                </Label>
                <Textarea
                  id="role-change-reason"
                  value={roleChangeDialog.reason}
                  onChange={(event) => setRoleChangeDialog((prev) => prev ? { ...prev, reason: event.target.value, hasError: false } : prev)}
                  rows={3}
                  placeholder="เช่น ปรับสิทธิ์ตามตำแหน่งใหม่ในระบบ HRMS..."
                  className={cn("resize-none", roleChangeDialog.hasError && "border-destructive focus-visible:ring-destructive/20")}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button variant="outline" onClick={() => setRoleChangeDialog(null)}>
              ยกเลิก
            </Button>
            <Button
              onClick={submitRoleChangeAndResolve}
              disabled={resolveQueueMutation.isPending || updateUserRoleMutation.isPending}
              className="gap-2 shadow-sm"
            >
              {resolveQueueMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              บันทึกสิทธิ์และปิดเคส
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!bulkQueueActionDialog}
        onOpenChange={(open) => {
          if (!open) setBulkQueueActionDialog(null);
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              {bulkQueueActionDialog?.action === 'RESOLVE' ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <XCircle className="h-5 w-5" />
              )}
              {bulkQueueActionDialog?.action === 'RESOLVE' ? 'ยืนยันการปิดหลายเคส' : 'ยืนยันการยกเลิกหลายเคส'}
            </DialogTitle>
            <DialogDescription>
              การดำเนินการนี้จะอัปเดตคิวที่เลือกพร้อมกันในครั้งเดียว และบันทึกประวัติให้ทุกเคส
            </DialogDescription>
          </DialogHeader>

          {bulkQueueActionDialog && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border bg-muted/10 px-4 py-3 text-sm">
                จะ{bulkQueueActionDialog.action === 'RESOLVE' ? 'ปิด' : 'ยกเลิก'}ทั้งหมด{' '}
                <span className="font-semibold">{formatThaiNumber(bulkQueueActionDialog.queueIds.length)}</span> เคส
              </div>
              <div className="space-y-2">
                <Label htmlFor="bulk-queue-note">หมายเหตุเพิ่มเติม</Label>
                <Textarea
                  id="bulk-queue-note"
                  rows={3}
                  value={bulkQueueActionDialog.note}
                  onChange={(event) =>
                    setBulkQueueActionDialog((prev) =>
                      prev ? { ...prev, note: event.target.value } : prev,
                    )
                  }
                  placeholder="เช่น ตรวจสอบแล้วข้อมูลถูกต้องทั้งหมดตามกติกาใหม่"
                  className="resize-none"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setBulkQueueActionDialog(null)}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleBulkQueueAction}
              disabled={resolveQueueItemsMutation.isPending}
              className="gap-2"
            >
              {resolveQueueItemsMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : bulkQueueActionDialog?.action === 'RESOLVE' ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              {bulkQueueActionDialog?.action === 'RESOLVE' ? 'ยืนยันปิดหลายเคส' : 'ยืนยันยกเลิกหลายเคส'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPageShell>
  );
}
