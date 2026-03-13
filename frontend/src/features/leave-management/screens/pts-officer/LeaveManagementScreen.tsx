'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, CalendarDays, GraduationCap, UserCheck, List } from 'lucide-react';
import { toast } from 'sonner';
import {
  useAddLeaveRecordDocuments,
  useCreateLeaveRecord,
  useDeleteLeaveRecordDocument,
  useLeaveRecordDocuments,
  useLeaveQuotaStatus,
  useLeavePersonnel,
  useLeaveRecords,
  useLeaveRecordStats,
  useLeaveReturnReportEvents,
  useReplaceLeaveReturnReportEvents,
  useUpsertLeaveRecordExtension,
  useDeleteLeaveRecordExtension,
} from '@/features/leave-management/core/hooks';
import type { LeaveRecordApiRow } from '@/features/leave-management/core/api';
import { buildSearchParam } from '@/features/leave-management/domain/search';
import {
  getLeaveTypeColor,
  mapLeavePersonnel,
  mapLeaveRows,
  toLeavePersonMap,
} from '@/features/leave-management/domain/leave-records.mapper';
import { formatThaiDateDisplay } from '@/features/leave-management/utils/date-display';
import { buildReturnReportSummary } from '@/features/leave-management/utils/returnReportSummary';
import type {
  LeaveRecord,
  LeaveRecordDocument,
} from '@/features/leave-management/core/types';
import { AllLeavesTab } from './components/AllLeavesTab';
import { LeaveManagementDialogs } from './components/LeaveManagementDialogs';
import { PendingReportTab } from './components/PendingReportTab';
import { StatCard } from './components/StatCard';
import { StudyLeavesTab } from './components/StudyLeavesTab';
import { useLeaveManagementDialogs } from './hooks/useLeaveManagementDialogs';

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export function LeaveManagementScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialSearchQuery = searchParams.get('search') ?? '';
  const initialTab = searchParams.get('tab');

  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [typeFilter, setTypeFilter] = useState('all');
  const [fiscalYearFilter, setFiscalYearFilter] = useState<number | 'all'>('all');
  const [page, setPage] = useState(0);
  const [pageSize] = useState(50);
  const [sortBy, setSortBy] = useState<'start_date' | 'name'>('start_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [activeTab, setActiveTab] = useState(
    initialTab && ['all', 'study', 'pending-report'].includes(initialTab) ? initialTab : 'all',
  );

  const dialogs = useLeaveManagementDialogs();

  const handleTabChange = (nextTab: string) => {
    setActiveTab(nextTab);

    const currentTab = searchParams.get('tab') ?? 'all';
    if (currentTab === nextTab) return;

    const params = new URLSearchParams(searchParams.toString());
    if (nextTab === 'all') {
      params.delete('tab');
    } else {
      params.set('tab', nextTab);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const fiscalYearOptions = useMemo(() => {
    const now = new Date();
    const currentFiscalYear =
      now.getMonth() >= 9 ? now.getFullYear() + 544 : now.getFullYear() + 543;
    const years = [];
    for (let y = currentFiscalYear - 5; y <= currentFiscalYear + 1; y += 1) {
      years.push(y);
    }
    return years;
  }, []);

  const offset = page * pageSize;
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const normalizedSearch = useMemo(
    () => buildSearchParam(deferredSearchQuery),
    [deferredSearchQuery],
  );

  const listParams = useMemo(
    () => ({
      leave_type: typeFilter === 'all' ? undefined : typeFilter,
      fiscal_year: fiscalYearFilter === 'all' ? undefined : fiscalYearFilter,
      search: normalizedSearch,
      limit: pageSize,
      offset,
      sort_by: sortBy,
      sort_dir: sortDir,
    }),
    [normalizedSearch, offset, pageSize, fiscalYearFilter, sortBy, sortDir, typeFilter],
  );

  const tabListParams = useMemo(
    () => ({
      leave_type: activeTab === 'study' ? 'education' : undefined,
      pending_report: activeTab === 'pending-report' ? true : undefined,
      fiscal_year: fiscalYearFilter === 'all' ? undefined : fiscalYearFilter,
      search: normalizedSearch,
      limit: 500, // Load all for tabs
      offset: 0,
      sort_by: sortBy,
      sort_dir: sortDir,
    }),
    [normalizedSearch, fiscalYearFilter, sortBy, sortDir, activeTab],
  );

  const {
    data: leaveRecordsData,
    refetch: refetchLeaveRecords,
    isLoading: leaveRecordsLoading,
    isError: leaveRecordsError,
  } = useLeaveRecords(listParams);

  const {
    data: leaveRecordsTabData,
    refetch: refetchLeaveRecordsTab,
    isLoading: leaveRecordsTabLoading,
    isError: leaveRecordsTabError,
  } = useLeaveRecords(tabListParams, { enabled: activeTab !== 'all' });

  const { data: leavePersonnelData } = useLeavePersonnel(
    { limit: 3000 },
    { enabled: dialogs.showAddDialog },
  );

  const { data: statsData } = useLeaveRecordStats();

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

  const leaveRecordItems = useMemo(() => leaveRecordsData?.items ?? [], [leaveRecordsData]);

  const leaveRecordTabItems = useMemo(
    () => leaveRecordsTabData?.items ?? [],
    [leaveRecordsTabData],
  );

  const totalRecords = leaveRecordsData?.total ?? leaveRecordItems.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const showingFrom = totalRecords === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + pageSize, totalRecords);
  const canPrevPage = page > 0;
  const canNextPage = offset + pageSize < totalRecords;

  const personnel = useMemo(() => mapLeavePersonnel(leavePersonnelData), [leavePersonnelData]);
  const personMap = useMemo(() => toLeavePersonMap(personnel), [personnel]);

  const leaveRecords = useMemo<LeaveRecord[]>(() => {
    if (!Array.isArray(leaveRecordItems)) return [];
    return mapLeaveRows(leaveRecordItems as LeaveRecordApiRow[], personMap);
  }, [leaveRecordItems, personMap]);

  const leaveRecordsForTabs = useMemo<LeaveRecord[]>(() => {
    if (!Array.isArray(leaveRecordTabItems)) return [];
    return mapLeaveRows(leaveRecordTabItems as LeaveRecordApiRow[], personMap);
  }, [leaveRecordTabItems, personMap]);

  const pendingRecordsSource =
    activeTab === 'pending-report' || activeTab === 'study' ? leaveRecordsForTabs : leaveRecords;
  const pendingLoading =
    activeTab === 'pending-report' || activeTab === 'study'
      ? leaveRecordsTabLoading
      : leaveRecordsLoading;
  const pendingError =
    activeTab === 'pending-report' || activeTab === 'study'
      ? leaveRecordsTabError
      : leaveRecordsError;
  const pendingRetry =
    activeTab === 'pending-report' || activeTab === 'study'
      ? refetchLeaveRecordsTab
      : refetchLeaveRecords;

  const pendingReportCount =
    leaveRecords.filter((r) => r.requireReport && r.reportStatus === 'pending').length ||
    statsData?.pending_report ||
    0;
  const studyLeaveCount =
    statsData?.study ?? leaveRecords.filter((r) => r.type === 'education').length;

  const pendingReportRecords = useMemo(
    () => pendingRecordsSource.filter((r) => r.requireReport && r.reportStatus === 'pending'),
    [pendingRecordsSource],
  );
  const studyRecords = useMemo(
    () => pendingRecordsSource.filter((r) => r.type === 'education'),
    [pendingRecordsSource],
  );

  const formatDateDisplay = formatThaiDateDisplay;

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

      await refetchLeaveRecords();
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

      await refetchLeaveRecords();
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
      await refetchLeaveRecords();
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
        report_date: String(event.report_date),
        resume_date:
          event.resume_date === null || event.resume_date === undefined
            ? null
            : String(event.resume_date),
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
        return_remark: note || undefined,
      });
      await refetchLeaveRecords();
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
        report_date: String(event.report_date),
        resume_date:
          event.resume_date === null || event.resume_date === undefined
            ? null
            : String(event.resume_date),
        resume_study_program:
          event.resume_study_program === null || event.resume_study_program === undefined
            ? undefined
            : String(event.resume_study_program),
      }));
      const nextEvents = currentEvents
        .filter((event) => Number(event.event_id ?? -1) !== Number(eventId))
        .map((event) => ({
          report_date: event.report_date,
          resume_date: event.resume_date,
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
      await refetchLeaveRecords();
      toast.success('ลบรายการรายงานตัวสำเร็จ');
    } catch (error) {
      toast.error(getErrorMessage(error, 'ไม่สามารถลบรายการรายงานตัวได้'));
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sticky top-0 bg-background/95 backdrop-blur z-10 py-2 -mx-2 px-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" /> จัดการวันลา
          </h1>
          <p className="text-muted-foreground mt-1">ดูและจัดการข้อมูลการลาของบุคลากรในระบบ</p>
        </div>
        <Button
          onClick={dialogs.openAddDialog}
          className="shadow-md hover:shadow-lg transition-shadow"
        >
          <Plus className="mr-2 h-4 w-4" />
          เพิ่มรายการวันลา
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="รายการทั้งหมด"
          value={statsData?.total ?? totalRecords}
          icon={CalendarDays}
          colorClass="text-primary"
          bgClass="bg-primary/10"
        />
        <StatCard
          title="ลาศึกษาต่อ/อบรม"
          value={studyLeaveCount}
          icon={GraduationCap}
          colorClass="text-purple-600"
          bgClass="bg-purple-100"
        />
        <StatCard
          title="รอรายงานตัว"
          value={pendingReportCount}
          icon={UserCheck}
          colorClass="text-amber-600"
          bgClass="bg-amber-100"
        />
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <div className="flex items-center justify-between overflow-x-auto pb-1">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="all" className="gap-2 data-[state=active]:shadow-sm">
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">รายการทั้งหมด</span>
              <span className="sm:hidden">ทั้งหมด</span>
            </TabsTrigger>
            <TabsTrigger value="pending-report" className="gap-2 data-[state=active]:shadow-sm">
              <UserCheck className="h-4 w-4" />
              <span className="hidden sm:inline">รอรายงานตัว</span>
              <span className="sm:hidden">รายงานตัว</span>
              {pendingReportCount > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 px-1.5 py-0.5 h-5 text-[10px] bg-amber-500/20 text-amber-700"
                >
                  {pendingReportCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="study" className="gap-2 data-[state=active]:shadow-sm">
              <GraduationCap className="h-4 w-4" />
              <span className="hidden sm:inline">ลาศึกษาต่อ/อบรม</span>
              <span className="sm:hidden">ลาศึกษา</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="all" className="m-0 border-none outline-none">
          <AllLeavesTab
            searchQuery={searchQuery}
            onSearchChange={(value) => {
              setSearchQuery(value);
              setPage(0);
            }}
            typeFilter={typeFilter}
            onTypeFilterChange={(value) => {
              setTypeFilter(value);
              setPage(0);
            }}
            fiscalYearFilter={fiscalYearFilter}
            onFiscalYearFilterChange={(value) => {
              setFiscalYearFilter(value);
              setPage(0);
            }}
            fiscalYearOptions={fiscalYearOptions}
            sortBy={sortBy}
            sortDir={sortDir}
            onSortChange={(nextSortBy, nextSortDir) => {
              setSortBy(nextSortBy);
              setSortDir(nextSortDir);
              setPage(0);
            }}
            leaveRecords={leaveRecords}
            onViewDetail={dialogs.openDetailDialog}
            onEdit={dialogs.openEditDialog}
            onDelete={dialogs.openDeleteAlert}
            onRecordReport={dialogs.openReportDialog}
            getLeaveTypeColor={getLeaveTypeColor}
            formatDateDisplay={formatDateDisplay}
            isLoading={leaveRecordsLoading}
            isError={leaveRecordsError}
            onRetry={() => refetchLeaveRecords()}
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
        </TabsContent>

        <TabsContent value="pending-report" className="m-0 border-none outline-none">
          <PendingReportTab
            records={pendingReportRecords}
            onViewDetail={dialogs.openDetailDialog}
            onEdit={dialogs.openEditDialog}
            onDelete={dialogs.openDeleteAlert}
            onRecordReport={dialogs.openReportDialog}
            getLeaveTypeColor={getLeaveTypeColor}
            formatDateDisplay={formatDateDisplay}
            isLoading={pendingLoading}
            isError={pendingError}
            onRetry={pendingRetry}
          />
        </TabsContent>

        <TabsContent value="study" className="m-0 border-none outline-none">
          <StudyLeavesTab
            records={studyRecords}
            formatDateDisplay={formatDateDisplay}
            onViewDetail={dialogs.openDetailDialog}
            onEdit={dialogs.openEditDialog}
            isLoading={pendingLoading}
            isError={pendingError}
            onRetry={pendingRetry}
          />
        </TabsContent>
      </Tabs>

      {/* Global Dialogs for Leave Management */}
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
        formatDateDisplay={formatDateDisplay}
      />
    </div>
  );
}
