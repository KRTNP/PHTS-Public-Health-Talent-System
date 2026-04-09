import { useMemo } from 'react';
import type {
  LeavePersonnelRow,
  LeaveRecordApiRow,
  LeaveRecordListResponse,
} from '@/features/leave-management/core/api';
import type { LeaveRecord } from '@/features/leave-management/core/types';
import {
  mapLeavePersonnel,
  mapLeaveRows,
  toLeavePersonMap,
} from '@/features/leave-management/domain/leave-records.mapper';

type LeaveTab = 'all' | 'study' | 'pending-report';

type LeaveRecordStats = {
  total?: number;
  pending_report?: number;
  study?: number;
} | null | undefined;

type UseLeaveManagementDerivedDataOptions = {
  activeTab: LeaveTab;
  page: number;
  pageSize: number;
  leaveRecordsData: LeaveRecordListResponse | undefined;
  leaveRecordsTabData: LeaveRecordListResponse | undefined;
  leavePersonnelData: LeavePersonnelRow[] | undefined;
  statsData: LeaveRecordStats;
  leaveRecordsLoading: boolean;
  leaveRecordsError: boolean;
  leaveRecordsTabLoading: boolean;
  leaveRecordsTabError: boolean;
  refetchLeaveRecords: () => Promise<unknown>;
  refetchLeaveRecordsTab: () => Promise<unknown>;
};

export function useLeaveManagementDerivedData(options: UseLeaveManagementDerivedDataOptions) {
  const leaveRecordItems = useMemo(
    () => options.leaveRecordsData?.items ?? [],
    [options.leaveRecordsData],
  );

  const leaveRecordTabItems = useMemo(
    () => options.leaveRecordsTabData?.items ?? [],
    [options.leaveRecordsTabData],
  );

  const totalRecords = options.leaveRecordsData?.total ?? leaveRecordItems.length;
  const offset = options.page * options.pageSize;
  const totalPages = Math.max(1, Math.ceil(totalRecords / options.pageSize));
  const showingFrom = totalRecords === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + options.pageSize, totalRecords);
  const canPrevPage = options.page > 0;
  const canNextPage = offset + options.pageSize < totalRecords;

  const personnel = useMemo(
    () => mapLeavePersonnel(options.leavePersonnelData),
    [options.leavePersonnelData],
  );
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
    options.activeTab === 'pending-report' || options.activeTab === 'study'
      ? leaveRecordsForTabs
      : leaveRecords;
  const pendingLoading =
    options.activeTab === 'pending-report' || options.activeTab === 'study'
      ? options.leaveRecordsTabLoading
      : options.leaveRecordsLoading;
  const pendingError =
    options.activeTab === 'pending-report' || options.activeTab === 'study'
      ? options.leaveRecordsTabError
      : options.leaveRecordsError;
  const pendingRetry =
    options.activeTab === 'pending-report' || options.activeTab === 'study'
      ? options.refetchLeaveRecordsTab
      : options.refetchLeaveRecords;

  const pendingReportCount =
    leaveRecords.filter((r) => r.requireReport && r.reportStatus === 'pending').length ||
    options.statsData?.pending_report ||
    0;
  const studyLeaveCount =
    options.statsData?.study ?? leaveRecords.filter((r) => r.type === 'education').length;

  const pendingReportRecords = useMemo(
    () => pendingRecordsSource.filter((r) => r.requireReport && r.reportStatus === 'pending'),
    [pendingRecordsSource],
  );
  const studyRecords = useMemo(
    () => pendingRecordsSource.filter((r) => r.type === 'education'),
    [pendingRecordsSource],
  );

  return {
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
  };
}
