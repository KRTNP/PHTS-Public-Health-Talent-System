'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  ArrowLeft,
  CalendarDays,
  GraduationCap,
  List,
  Plus,
  Search,
  UserCheck,
  Filter,
  ChevronLeft,
  ChevronRight,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatThaiNumber } from '@/shared/utils/thai-locale';
import {
  useAddLeaveRecordDocuments,
  useCreateLeaveRecord,
  useDeleteLeaveRecordDocument,
  useDeleteLeaveRecordExtension,
  useLeavePersonnel,
  useLeaveRecordDocuments,
  useLeaveQuotaStatus,
  useLeaveReturnReportEvents,
  useReplaceLeaveReturnReportEvents,
  useUpsertLeaveRecordExtension,
} from '@/features/leave-management/core/hooks';
import type { LeaveRecordApiRow } from '@/features/leave-management/core/api';
import {
  getLeaveTypeColor,
  mapLeavePersonnel,
  mapLeaveRows,
  toLeavePersonMap,
} from '@/features/leave-management/domain/leave-records.mapper';
import { buildSearchParam } from '@/features/leave-management/domain/search';
import { formatThaiDateDisplay } from '@/features/leave-management/utils/date-display';
import { buildReturnReportSummary } from '@/features/leave-management/utils/returnReportSummary';
import type {
  LeaveRecord,
  LeaveRecordDocument,
} from '@/features/leave-management/core/types';
import { leaveTypes } from '@/features/leave-management/core/constants';
import { LeaveTable } from '@/features/leave-management/components/table/LeaveTable';
import { LeaveManagementDialogs } from '@/features/leave-management/screens/pts-officer/components/LeaveManagementDialogs';
import { PendingReportTab } from '@/features/leave-management/screens/pts-officer/components/PendingReportTab';
import { StudyLeavesTab } from '@/features/leave-management/screens/pts-officer/components/StudyLeavesTab';
import { useLeaveManagementDialogs } from '@/features/leave-management/screens/pts-officer/hooks/useLeaveManagementDialogs';
import {
  type PayPeriod,
  usePeriodDetail,
  usePeriodLeaveProfessionSummary,
  usePeriodLeaves,
} from '@/features/payroll';

type SortBy = 'start_date' | 'name';
type SortDir = 'asc' | 'desc';
type LeaveTab = 'all' | 'study' | 'pending-report';

const toDateOnly = (value?: string | null) => {
  if (!value) return null;
  return String(value).split('T')[0].split(' ')[0] || null;
};

const formatPeriodLabel = (period?: PayPeriod | null) => {
  if (!period) return 'งวดที่เลือก';
  const year = Number(period.period_year ?? 0);
  const thaiYear = year > 2400 ? year : year + 543;
  return `${period.period_month}/${thaiYear}`;
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

// --- Sub Component: AllPeriodLeavesTab ---
function AllPeriodLeavesTab({
  activeProfessionLabel,
  searchQuery,
  onSearchChange,
  professionFilter,
  onProfessionFilterChange,
  professionOptions,
  typeFilter,
  onTypeFilterChange,
  sortBy,
  sortDir,
  onSortChange,
  leaveRecords,
  onViewDetail,
  onEdit,
  onDelete,
  onRecordReport,
  isLoading,
  isError,
  onRetry,
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
  activeProfessionLabel: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  professionFilter: string;
  onProfessionFilterChange: (value: string) => void;
  professionOptions: Array<{ value: string; label: string; count: number }>;
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
  sortBy: SortBy;
  sortDir: SortDir;
  onSortChange: (sortBy: SortBy, sortDir: SortDir) => void;
  leaveRecords: LeaveRecord[];
  onViewDetail: (record: LeaveRecord) => void;
  onEdit: (record: LeaveRecord) => void;
  onDelete: (record: LeaveRecord) => void;
  onRecordReport: (record: LeaveRecord) => void;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
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
  return (
    <TabsContent value="all" className="m-0 border-none outline-none">
      <Card className="border-border shadow-sm flex flex-col min-h-[600px]">
        <CardHeader className="border-b bg-muted/5 px-5 sm:px-6 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <FileText className="h-4 w-4 text-muted-foreground" />
                รายการวันลาที่เกี่ยวข้องในงวดนี้
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                วิชาชีพที่เลือก:{' '}
                <span className="font-medium text-foreground">{activeProfessionLabel}</span>
              </p>
            </div>
            <span className="text-xs text-muted-foreground hidden sm:inline-block">
              {totalRecords > 0 ? `พบ ${totalRecords} รายการ` : ''}
            </span>
          </div>

          {/* UX Fix: Responsive Filter Bar using Flex Wrap instead of strict Grid */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-3">
            <div className="relative flex-grow sm:min-w-[200px] md:min-w-[250px] max-w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="ค้นหาชื่อ, เลขบัตร, แผนก..."
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                className="h-9 bg-background pl-9 text-xs sm:text-sm"
              />
            </div>

            <div className="flex flex-wrap gap-2 shrink-0">
              <Select value={professionFilter} onValueChange={onProfessionFilterChange}>
                <SelectTrigger className="h-9 w-[140px] sm:w-[160px] bg-background text-xs">
                  <SelectValue placeholder="ทุกวิชาชีพ" />
                </SelectTrigger>
                <SelectContent>
                  {professionOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-xs">
                      {option.label} ({option.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={onTypeFilterChange}>
                <SelectTrigger className="h-9 w-[130px] sm:w-[140px] bg-background text-xs">
                  <SelectValue placeholder="ทุกประเภท" />
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
                value={`${sortBy}:${sortDir}`}
                onValueChange={(value) => {
                  const [nextSortBy, nextSortDir] = value.split(':') as [SortBy, SortDir];
                  onSortChange(nextSortBy, nextSortDir);
                }}
              >
                <SelectTrigger className="h-9 w-[140px] sm:w-[150px] bg-background text-xs flex gap-2">
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

        <CardContent className="p-0 flex-1 flex flex-col">
          <div className="flex-1">
            <LeaveTable
              records={leaveRecords}
              onViewDetail={onViewDetail}
              onEdit={onEdit}
              onDelete={onDelete}
              onRecordReport={onRecordReport}
              getLeaveTypeColor={getLeaveTypeColor}
              formatDateDisplay={formatThaiDateDisplay}
              isLoading={isLoading}
              isError={isError}
              onRetry={onRetry}
            />
          </div>

          <div className="flex items-center justify-between border-t bg-muted/5 px-4 py-3 text-xs text-muted-foreground mt-auto">
            <span>
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

// --- Main Screen Component ---
export function PayrollPeriodLeavesScreen({ periodId }: { periodId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialTab = searchParams.get('tab');
  const initialProfession = searchParams.get('profession') ?? 'all';

  const [activeTab, setActiveTab] = useState<LeaveTab>(
    initialTab && ['all', 'study', 'pending-report'].includes(initialTab)
      ? (initialTab as LeaveTab)
      : 'all',
  );
  const [professionFilter, setProfessionFilter] = useState(initialProfession);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') ?? '');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortBy>('start_date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const dialogs = useLeaveManagementDialogs();

  const syncFiltersToUrl = (nextTab: LeaveTab, nextProfession: string) => {
    const currentTab = searchParams.get('tab') ?? 'all';
    const currentProfession = searchParams.get('profession') ?? 'all';

    if (currentTab === nextTab && currentProfession === nextProfession) return;

    const params = new URLSearchParams(searchParams.toString());

    if (nextTab === 'all') params.delete('tab');
    else params.set('tab', nextTab);

    if (nextProfession === 'all') params.delete('profession');
    else params.set('profession', nextProfession);

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const normalizedSearch = useMemo(
    () => buildSearchParam(deferredSearchQuery),
    [deferredSearchQuery],
  );
  const professionCode = professionFilter === 'all' ? undefined : professionFilter;
  const offset = page * pageSize;

  const periodDetailQuery = usePeriodDetail(periodId);
  const period = periodDetailQuery.data?.period as PayPeriod | undefined;

  const allLeavesQuery = usePeriodLeaves(periodId, {
    leave_type: typeFilter === 'all' ? undefined : typeFilter,
    profession_code: professionCode,
    search: normalizedSearch,
    limit: pageSize,
    offset,
    sort_by: sortBy,
    sort_dir: sortDir,
  });
  const studyLeavesQuery = usePeriodLeaves(periodId, {
    leave_type: 'education',
    profession_code: professionCode,
    search: normalizedSearch,
    limit: 500,
    offset: 0,
    sort_by: sortBy,
    sort_dir: sortDir,
  });
  const pendingReportQuery = usePeriodLeaves(periodId, {
    profession_code: professionCode,
    pending_report: true,
    search: normalizedSearch,
    limit: 500,
    offset: 0,
    sort_by: sortBy,
    sort_dir: sortDir,
  });
  const professionSummaryQuery = usePeriodLeaveProfessionSummary(periodId, {
    leave_type:
      activeTab === 'study'
        ? 'education'
        : activeTab === 'all' && typeFilter !== 'all'
          ? typeFilter
          : undefined,
    pending_report: activeTab === 'pending-report' ? true : undefined,
    search: normalizedSearch,
  });

  const { data: leavePersonnelData } = useLeavePersonnel(
    { limit: 3000 },
    { enabled: dialogs.showAddDialog },
  );

  const upsertExtension = useUpsertLeaveRecordExtension();
  const replaceReturnEvents = useReplaceLeaveReturnReportEvents();
  const createLeaveRecord = useCreateLeaveRecord();
  const deleteExtension = useDeleteLeaveRecordExtension();
  const addDocuments = useAddLeaveRecordDocuments();
  const deleteDocument = useDeleteLeaveRecordDocument();

  const { data: documentsData, refetch: refetchDocuments } = useLeaveRecordDocuments(
    dialogs.selectedLeave?.id ?? null,
  );
  const { data: selectedLeaveReturnEvents } = useLeaveReturnReportEvents(
    dialogs.selectedLeave?.id ?? null,
  );
  const { data: selectedLeaveQuotaStatus } = useLeaveQuotaStatus(
    dialogs.selectedLeave?.id ?? null,
  );

  const personnel = useMemo(() => mapLeavePersonnel(leavePersonnelData), [leavePersonnelData]);
  const personMap = useMemo(() => toLeavePersonMap(personnel), [personnel]);

  const allRecords = useMemo(
    () => mapLeaveRows((allLeavesQuery.data?.items ?? []) as LeaveRecordApiRow[], personMap),
    [allLeavesQuery.data?.items, personMap],
  );
  const studyRecords = useMemo(
    () => mapLeaveRows((studyLeavesQuery.data?.items ?? []) as LeaveRecordApiRow[], personMap),
    [studyLeavesQuery.data?.items, personMap],
  );
  const pendingReportRecords = useMemo(
    () => mapLeaveRows((pendingReportQuery.data?.items ?? []) as LeaveRecordApiRow[], personMap),
    [pendingReportQuery.data?.items, personMap],
  );

  const totalRecords = allLeavesQuery.data?.total ?? allRecords.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const showingFrom = totalRecords === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + pageSize, totalRecords);
  const canPrevPage = page > 0;
  const canNextPage = offset + pageSize < totalRecords;

  const professionSummary = useMemo(
    () => professionSummaryQuery.data ?? [],
    [professionSummaryQuery.data],
  );
  const professionOptions = useMemo(
    () => [
      {
        value: 'all',
        label: 'ทุกวิชาชีพ',
        count: totalRecords,
      },
      ...professionSummary.map((item) => ({
        value: item.profession_code ?? 'UNKNOWN',
        label: item.profession_name,
        count: item.leave_count,
      })),
    ],
    [professionSummary, totalRecords],
  );
  const selectedProfessionLabel =
    professionFilter === 'all'
      ? 'ทุกวิชาชีพ'
      : (professionOptions.find((item) => item.value === professionFilter)?.label ??
        'ไม่ระบุวิชาชีพ');

  const refreshAll = async () => {
    await Promise.all([
      allLeavesQuery.refetch(),
      studyLeavesQuery.refetch(),
      pendingReportQuery.refetch(),
      professionSummaryQuery.refetch(),
    ]);
  };

  const handleAddLeave = async (
    newLeave: Partial<LeaveRecord> & { leaveRecordId?: number; files?: File[] },
  ) => {
    if (!newLeave.userStartDate || !newLeave.userEndDate) return;
    try {
      const leaveRecordId =
        newLeave.leaveRecordId ??
        (
          await createLeaveRecord.mutateAsync({
            citizen_id: newLeave.personId ?? '',
            leave_type: newLeave.type ?? '',
            start_date: newLeave.userStartDate,
            end_date: newLeave.userEndDate,
            duration_days: newLeave.days,
            remark: newLeave.note,
          })
        ).id;

      await upsertExtension.mutateAsync({
        leave_record_id: leaveRecordId,
        document_start_date: newLeave.documentStartDate,
        document_end_date: newLeave.documentEndDate,
        require_return_report: newLeave.requireReport ?? false,
        pay_exception: false,
        note: newLeave.note,
        study_institution: newLeave.studyInfo?.institution,
        study_program: newLeave.studyInfo?.program,
        study_major: newLeave.studyInfo?.field,
        study_start_date: newLeave.studyInfo?.startDate || undefined,
      });

      if (newLeave.files && newLeave.files.length > 0) {
        await addDocuments.mutateAsync({ leaveRecordId, files: newLeave.files });
      }

      await refreshAll();
      dialogs.closeAddDialog();
      dialogs.showSuccess('บันทึกข้อมูลวันลาสำเร็จ');
    } catch (error) {
      toast.error(getErrorMessage(error, 'ไม่สามารถบันทึกข้อมูลวันลาได้'));
    }
  };

  const handleEditLeave = async (updatedLeave: LeaveRecord & { files?: File[] }) => {
    try {
      await upsertExtension.mutateAsync({
        leave_record_id: updatedLeave.id,
        document_start_date: updatedLeave.documentStartDate,
        document_end_date: updatedLeave.documentEndDate,
        require_return_report: updatedLeave.requireReport ?? false,
        pay_exception: false,
        note: updatedLeave.note,
        study_institution: updatedLeave.studyInfo?.institution,
        study_program: updatedLeave.studyInfo?.program,
        study_major: updatedLeave.studyInfo?.field,
        study_start_date: updatedLeave.studyInfo?.startDate || undefined,
      });

      if (updatedLeave.files && updatedLeave.files.length > 0) {
        await addDocuments.mutateAsync({
          leaveRecordId: updatedLeave.id,
          files: updatedLeave.files,
        });
      }

      await refreshAll();
      dialogs.closeEditDialog();
      dialogs.showSuccess('แก้ไขรายการวันลาสำเร็จ');
    } catch (error) {
      toast.error(getErrorMessage(error, 'ไม่สามารถแก้ไขรายการวันลาได้'));
    }
  };

  const handleDeleteLeave = async () => {
    if (!dialogs.selectedLeave) return;
    try {
      await deleteExtension.mutateAsync(dialogs.selectedLeave.id);
      await refreshAll();
      dialogs.closeDeleteAlert();
      dialogs.clearSelection();
      dialogs.showSuccess('ลบรายการวันลาสำเร็จ');
    } catch (error) {
      toast.error(getErrorMessage(error, 'ไม่สามารถลบรายการวันลาได้'));
    }
  };

  const handleRecordReport = async ({
    reportDate,
    resumeDate,
    note,
    resumeStudyProgram,
  }: {
    reportDate: string;
    resumeDate?: string;
    note: string;
    resumeStudyProgram?: string;
  }) => {
    if (!dialogs.selectedLeave) return;
    try {
      const currentEvents = (selectedLeaveReturnEvents ?? []).map((event) => ({
        event_id: event.event_id,
        report_date: toDateOnly(event.report_date) ?? '',
        resume_date: toDateOnly(event.resume_date),
        resume_study_program:
          event.resume_study_program === null || event.resume_study_program === undefined
            ? undefined
            : String(event.resume_study_program),
      }));

      if (
        currentEvents.some(
          (event) =>
            event.report_date === reportDate &&
            Number(event.event_id ?? -1) !== Number(dialogs.editingReturnEventId ?? -2),
        )
      ) {
        toast.error('มีรายการรายงานตัวในวันที่นี้แล้ว');
        return;
      }

      const nextEvents =
        dialogs.editingReturnEventId !== null
          ? currentEvents
              .map((event) =>
                Number(event.event_id ?? -1) === Number(dialogs.editingReturnEventId)
                  ? {
                      ...event,
                      report_date: reportDate,
                      resume_date: resumeDate ?? null,
                      resume_study_program: resumeStudyProgram,
                    }
                  : event,
              )
              .sort((a, b) => a.report_date.localeCompare(b.report_date))
          : [
              ...currentEvents,
              {
                report_date: reportDate,
                resume_date: resumeDate ?? null,
                resume_study_program: resumeStudyProgram,
              },
            ].sort((a, b) => a.report_date.localeCompare(b.report_date));

      const payloadEvents = nextEvents.map((event) => ({
        report_date: event.report_date,
        resume_date: event.resume_date ?? undefined,
        resume_study_program: event.resume_study_program,
      }));

      await replaceReturnEvents.mutateAsync({
        leaveRecordId: dialogs.selectedLeave.id,
        events: payloadEvents,
      });
      const summary = buildReturnReportSummary(payloadEvents);

      await upsertExtension.mutateAsync({
        leave_record_id: dialogs.selectedLeave.id,
        require_return_report: true,
        return_report_status: summary.return_report_status,
        return_date: summary.return_date,
        return_remark: note || undefined,
      });
      await refreshAll();
      dialogs.closeReportDialog();
      dialogs.clearSelection();
      toast.success('บันทึกรายงานตัวสำเร็จ');
    } catch (error) {
      toast.error(getErrorMessage(error, 'ไม่สามารถบันทึกรายงานตัวได้'));
    }
  };

  const handleDeleteReturnEvent = async (eventId?: number) => {
    if (!dialogs.selectedLeave || !eventId) return;
    try {
      const currentEvents = (selectedLeaveReturnEvents ?? []).map((event) => ({
        event_id: event.event_id,
        report_date: toDateOnly(event.report_date) ?? '',
        resume_date: toDateOnly(event.resume_date),
        resume_study_program:
          event.resume_study_program === null || event.resume_study_program === undefined
            ? undefined
            : String(event.resume_study_program),
      }));
      const nextEvents = currentEvents
        .filter((event) => Number(event.event_id ?? -1) !== Number(eventId))
        .map((event) => ({
          report_date: event.report_date,
          resume_date: event.resume_date ?? undefined,
          resume_study_program: event.resume_study_program,
        }));

      await replaceReturnEvents.mutateAsync({
        leaveRecordId: dialogs.selectedLeave.id,
        events: nextEvents,
      });
      const summary = buildReturnReportSummary(nextEvents);
      await upsertExtension.mutateAsync({
        leave_record_id: dialogs.selectedLeave.id,
        require_return_report: true,
        return_report_status: summary.return_report_status,
        return_date: summary.return_date,
      });
      await refreshAll();
      toast.success('ลบรายการรายงานตัวสำเร็จ');
    } catch (error) {
      toast.error(getErrorMessage(error, 'ไม่สามารถลบรายการรายงานตัวได้'));
    }
  };

  return (
    <div className="space-y-6 p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* UX Fix: Refined Header Layout */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3 mb-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-muted-foreground"
            >
              <Link href={`/pts-officer/payroll/${periodId}`}>
                <ArrowLeft className="h-3.5 w-3.5" />
                ย้อนกลับ
              </Link>
            </Button>
            <Badge variant="secondary" className="font-mono text-xs font-normal bg-muted">
              {periodId}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            วันลาประจำงวด <span className="text-primary">{formatPeriodLabel(period)}</span>
          </h1>
          {allLeavesQuery.data?.period_start && allLeavesQuery.data?.period_end && (
            <p className="text-sm text-muted-foreground">
              ดึงข้อมูลตั้งแต่ {formatThaiDateDisplay(allLeavesQuery.data.period_start)} ถึง{' '}
              {formatThaiDateDisplay(allLeavesQuery.data.period_end)}
            </p>
          )}
        </div>
        <Button onClick={dialogs.openAddDialog} className="w-full sm:w-auto shadow-sm">
          <Plus className="mr-2 h-4 w-4" />
          เพิ่มรายการวันลา
        </Button>
      </div>

      {/* UX Fix: Better formatted Metric Bar instead of scattered Badges */}
      <Card className="border-border shadow-sm bg-muted/10">
        <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-full">
              <CalendarDays className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                ทั้งหมดในงวด
              </p>
              <p className="text-lg font-bold text-foreground leading-none mt-1">
                {formatThaiNumber(totalRecords)}
              </p>
            </div>
          </div>

          <div className="w-px h-8 bg-border hidden sm:block" />

          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-full">
              <GraduationCap className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                ลาศึกษาต่อ/อบรม
              </p>
              <p className="text-lg font-bold text-foreground leading-none mt-1">
                {formatThaiNumber(studyLeavesQuery.data?.total ?? studyRecords.length)}
              </p>
            </div>
          </div>

          <div className="w-px h-8 bg-border hidden md:block" />

          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-full">
              <UserCheck className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                รอรายงานตัว
              </p>
              <p className="text-lg font-bold text-foreground leading-none mt-1">
                {formatThaiNumber(pendingReportQuery.data?.total ?? pendingReportRecords.length)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          const nextTab = value as LeaveTab;
          setActiveTab(nextTab);
          setPage(0);
          syncFiltersToUrl(nextTab, professionFilter);
        }}
        className="space-y-6"
      >
        {/* Navigation Tabs Header */}
        <div className="flex items-center justify-between border-b pb-0 overflow-x-auto">
          <TabsList className="bg-transparent h-auto p-0 gap-6">
            <TabsTrigger
              value="all"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 py-3 text-sm"
            >
              <List className="h-4 w-4 mr-2 text-muted-foreground" />
              รายการทั้งหมด
            </TabsTrigger>
            <TabsTrigger
              value="pending-report"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 py-3 text-sm"
            >
              <UserCheck className="h-4 w-4 mr-2 text-muted-foreground" />
              รอรายงานตัว
              {(pendingReportQuery.data?.total ?? pendingReportRecords.length) > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-2 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20"
                >
                  {formatThaiNumber(pendingReportQuery.data?.total ?? pendingReportRecords.length)}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="study"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 py-3 text-sm"
            >
              <GraduationCap className="h-4 w-4 mr-2 text-muted-foreground" />
              ลาศึกษาต่อ/อบรม
            </TabsTrigger>
          </TabsList>
        </div>

        {activeTab === 'all' ? (
          <AllPeriodLeavesTab
            activeProfessionLabel={selectedProfessionLabel}
            searchQuery={searchQuery}
            onSearchChange={(value) => {
              setSearchQuery(value);
              setPage(0);
            }}
            professionFilter={professionFilter}
            onProfessionFilterChange={(value) => {
              setProfessionFilter(value);
              setPage(0);
              syncFiltersToUrl(activeTab, value);
            }}
            professionOptions={professionOptions}
            typeFilter={typeFilter}
            onTypeFilterChange={(value) => {
              setTypeFilter(value);
              setPage(0);
            }}
            sortBy={sortBy}
            sortDir={sortDir}
            onSortChange={(nextSortBy, nextSortDir) => {
              setSortBy(nextSortBy);
              setSortDir(nextSortDir);
              setPage(0);
            }}
            leaveRecords={allRecords}
            onViewDetail={dialogs.openDetailDialog}
            onEdit={dialogs.openEditDialog}
            onDelete={dialogs.openDeleteAlert}
            onRecordReport={dialogs.openReportDialog}
            isLoading={allLeavesQuery.isLoading}
            isError={allLeavesQuery.isError}
            onRetry={() => void allLeavesQuery.refetch()}
            showingFrom={showingFrom}
            showingTo={showingTo}
            totalRecords={totalRecords}
            page={page}
            totalPages={totalPages}
            canPrevPage={canPrevPage}
            canNextPage={canNextPage}
            onPrevPage={() => setPage((prev) => Math.max(0, prev - 1))}
            onNextPage={() => setPage((prev) => prev + 1)}
          />
        ) : null}

        <PendingReportTab
          records={pendingReportRecords}
          onViewDetail={dialogs.openDetailDialog}
          onEdit={dialogs.openEditDialog}
          onDelete={dialogs.openDeleteAlert}
          onRecordReport={dialogs.openReportDialog}
          getLeaveTypeColor={getLeaveTypeColor}
          formatDateDisplay={formatThaiDateDisplay}
          isLoading={pendingReportQuery.isLoading}
          isError={pendingReportQuery.isError}
          onRetry={() => void pendingReportQuery.refetch()}
          showDeleteButton
        />

        <StudyLeavesTab
          records={studyRecords}
          formatDateDisplay={formatThaiDateDisplay}
          onViewDetail={dialogs.openDetailDialog}
          onEdit={dialogs.openEditDialog}
          isLoading={studyLeavesQuery.isLoading}
          isError={studyLeavesQuery.isError}
          onRetry={() => void studyLeavesQuery.refetch()}
        />
      </Tabs>

      <LeaveManagementDialogs
        showAddDialog={dialogs.showAddDialog}
        onShowAddDialogChange={dialogs.setShowAddDialog}
        showEditDialog={dialogs.showEditDialog}
        onShowEditDialogChange={dialogs.setShowEditDialog}
        showDetailDialog={dialogs.showDetailDialog}
        onShowDetailDialogChange={dialogs.setShowDetailDialog}
        showReportDialog={dialogs.showReportDialog}
        onShowReportDialogChange={dialogs.setShowReportDialog}
        showDeleteAlert={dialogs.showDeleteAlert}
        onShowDeleteAlertChange={dialogs.setShowDeleteAlert}
        showSuccessDialog={dialogs.showSuccessDialog}
        onShowSuccessDialogChange={dialogs.setShowSuccessDialog}
        successMessage={dialogs.successMessage}
        selectedLeave={dialogs.selectedLeave}
        editingReturnEventId={dialogs.editingReturnEventId}
        personnel={personnel}
        documents={Array.isArray(documentsData) ? (documentsData as LeaveRecordDocument[]) : []}
        returnReportEvents={selectedLeaveReturnEvents ?? []}
        quotaStatus={selectedLeaveQuotaStatus ?? null}
        previewOpen={dialogs.previewOpen}
        previewUrl={dialogs.previewUrl}
        previewName={dialogs.previewName}
        onPreviewOpenChange={dialogs.setPreviewOpen}
        onAddLeave={handleAddLeave}
        onEditLeave={handleEditLeave}
        onRecordReport={handleRecordReport}
        onDeleteLeave={handleDeleteLeave}
        onEditReturnEvent={dialogs.openEditReturnEventDialog}
        onDeleteReturnEvent={(eventId) => {
          void handleDeleteReturnEvent(eventId);
        }}
        onDeleteDocument={async (documentId) => {
          if (!dialogs.selectedLeave) return;
          await deleteDocument.mutateAsync({ documentId, leaveRecordId: dialogs.selectedLeave.id });
          await refetchDocuments();
        }}
        onOpenPreview={dialogs.openPreview}
        onOpenEditFromDetail={dialogs.openEditFromDetailDialog}
        onCloseReportDialog={dialogs.closeReportDialog}
        getLeaveTypeColor={getLeaveTypeColor}
        formatDateDisplay={formatThaiDateDisplay}
      />
    </div>
  );
}
