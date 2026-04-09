'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, CalendarDays, GraduationCap, UserCheck, List } from 'lucide-react';
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
import { getLeaveTypeColor } from '@/features/leave-management/domain/leave-records.mapper';
import { formatThaiDateDisplay } from '@/features/leave-management/utils/date-display';
import type { LeaveRecordDocument } from '@/features/leave-management/core/types';
import { AllLeavesTab } from './components/AllLeavesTab';
import { LeaveManagementDialogs } from './components/LeaveManagementDialogs';
import { PendingReportTab } from './components/PendingReportTab';
import { StatCard } from './components/StatCard';
import { StudyLeavesTab } from './components/StudyLeavesTab';
import { useLeaveManagementActions } from './hooks/useLeaveManagementActions';
import { useLeaveManagementDerivedData } from './hooks/useLeaveManagementDerivedData';
import { useLeaveManagementDialogs } from './hooks/useLeaveManagementDialogs';
import { useLeaveManagementFilters } from './hooks/useLeaveManagementFilters';

export function LeaveManagementScreen() {
  const dialogs = useLeaveManagementDialogs();
  const {
    searchQuery,
    typeFilter,
    fiscalYearFilter,
    page,
    pageSize,
    sortBy,
    sortDir,
    activeTab,
    fiscalYearOptions,
    listParams,
    tabListParams,
    handleTabChange,
    onSearchChange,
    onTypeFilterChange,
    onFiscalYearFilterChange,
    onSortChange,
    onPrevPage,
    onNextPage,
  } = useLeaveManagementFilters();

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

  const {
    personnel,
    leaveRecords,
    pendingLoading,
    pendingError,
    pendingRetry,
    pendingReportCount,
    studyLeaveCount,
    pendingReportRecords,
    studyRecords,
    totalRecords,
    totalPages,
    showingFrom,
    showingTo,
    canPrevPage,
    canNextPage,
  } = useLeaveManagementDerivedData({
    activeTab,
    page,
    pageSize,
    leaveRecordsData,
    leaveRecordsTabData,
    leavePersonnelData,
    statsData,
    leaveRecordsLoading,
    leaveRecordsError,
    leaveRecordsTabLoading,
    leaveRecordsTabError,
    refetchLeaveRecords,
    refetchLeaveRecordsTab,
  });

  const {
    handleAddLeave,
    handleEditLeave,
    handleDeleteLeave,
    handleRecordReport,
    handleDeleteReturnEvent,
    handleDeleteDocument,
  } = useLeaveManagementActions({
    selectedLeave: dialogs.selectedLeave,
    editingReturnEventId: dialogs.editingReturnEventId,
    selectedLeaveReturnEvents,
    createLeaveRecord: createLeaveRecord.mutateAsync,
    upsertExtension: upsertExtension.mutateAsync,
    deleteExtension: deleteExtension.mutateAsync,
    addDocuments: addDocuments.mutateAsync,
    replaceReturnEvents: replaceReturnEvents.mutateAsync,
    deleteDocument: deleteDocument.mutateAsync,
    refetchLeaveRecords,
    refetchDocuments,
    closeAddDialog: dialogs.closeAddDialog,
    closeEditDialog: dialogs.closeEditDialog,
    closeDeleteAlert: dialogs.closeDeleteAlert,
    closeReportDialog: dialogs.closeReportDialog,
    clearSelection: dialogs.clearSelection,
    showSuccess: dialogs.showSuccess,
  });

  const formatDateDisplay = formatThaiDateDisplay;

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
            onSearchChange={onSearchChange}
            typeFilter={typeFilter}
            onTypeFilterChange={onTypeFilterChange}
            fiscalYearFilter={fiscalYearFilter}
            onFiscalYearFilterChange={onFiscalYearFilterChange}
            fiscalYearOptions={fiscalYearOptions}
            sortBy={sortBy}
            sortDir={sortDir}
            onSortChange={onSortChange}
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
            onPrevPage={onPrevPage}
            onNextPage={onNextPage}
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
        onDeleteDocument={handleDeleteDocument}
        onOpenPreview={dialogs.openPreview}
        onOpenEditFromDetail={dialogs.openEditFromDetailDialog}
        onCloseReportDialog={dialogs.closeReportDialog}
        getLeaveTypeColor={getLeaveTypeColor}
        formatDateDisplay={formatDateDisplay}
      />
    </div>
  );
}
