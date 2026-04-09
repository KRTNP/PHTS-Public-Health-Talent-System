import { toast } from 'sonner';
import { buildReturnReportSummary } from '@/features/leave-management/utils/returnReportSummary';
import type {
  LeaveRecordCreatePayload,
  LeaveRecordExtensionPayload,
  LeaveReturnReportEvent,
} from '@/features/leave-management/core/api';
import type { LeaveRecord } from '@/features/leave-management/core/types';

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

type ReportPayload = {
  reportDate: string;
  resumeDate?: string;
  note: string;
  resumeStudyProgram?: string;
};

type UpsertPayload = LeaveRecordExtensionPayload;
type CreatePayload = LeaveRecordCreatePayload;

type UseLeaveManagementActionsOptions = {
  selectedLeave: LeaveRecord | null;
  editingReturnEventId: number | null;
  selectedLeaveReturnEvents: LeaveReturnReportEvent[] | undefined;
  createLeaveRecord: (payload: CreatePayload) => Promise<{ id: number }>;
  upsertExtension: (payload: UpsertPayload) => Promise<unknown>;
  deleteExtension: (leaveRecordId: number | string) => Promise<unknown>;
  addDocuments: (payload: { leaveRecordId: number; files: File[] }) => Promise<unknown>;
  replaceReturnEvents: (payload: {
    leaveRecordId: number;
    events: Array<{
      event_id?: number;
      report_date: string;
      resume_date?: string | null;
      resume_study_program?: string;
    }>;
  }) => Promise<unknown>;
  deleteDocument: (payload: { documentId: number; leaveRecordId: number }) => Promise<unknown>;
  refetchLeaveRecords: () => Promise<unknown>;
  refetchDocuments: () => Promise<unknown>;
  closeAddDialog: () => void;
  closeEditDialog: () => void;
  closeDeleteAlert: () => void;
  closeReportDialog: () => void;
  clearSelection: () => void;
  showSuccess: (message: string) => void;
};

const toReturnEventPayload = (events: LeaveReturnReportEvent[] | undefined) =>
  (events ?? []).map((event) => ({
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

export function useLeaveManagementActions(options: UseLeaveManagementActionsOptions) {
  const handleAddLeave = async (
    newLeave: Partial<LeaveRecord> & { leaveRecordId?: number; files?: File[] },
  ) => {
    if (!newLeave.userStartDate || !newLeave.userEndDate) return;
    try {
      const leaveRecordId =
        newLeave.leaveRecordId ??
        (
          await options.createLeaveRecord({
            citizen_id: newLeave.personId ?? '',
            leave_type: newLeave.type ?? '',
            start_date: newLeave.userStartDate,
            end_date: newLeave.userEndDate,
            duration_days: newLeave.days,
            remark: newLeave.note,
          })
        ).id;

      await options.upsertExtension({
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
        await options.addDocuments({ leaveRecordId, files: newLeave.files });
      }

      await options.refetchLeaveRecords();
      options.closeAddDialog();
      options.showSuccess('บันทึกข้อมูลวันลาสำเร็จ');
    } catch (error) {
      toast.error(getErrorMessage(error, 'ไม่สามารถบันทึกข้อมูลวันลาได้'));
    }
  };

  const handleEditLeave = async (updatedLeave: LeaveRecord & { files?: File[] }) => {
    try {
      await options.upsertExtension({
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
        await options.addDocuments({
          leaveRecordId: updatedLeave.id,
          files: updatedLeave.files,
        });
      }

      await options.refetchLeaveRecords();
      options.closeEditDialog();
      options.showSuccess('แก้ไขรายการวันลาสำเร็จ');
    } catch (error) {
      toast.error(getErrorMessage(error, 'ไม่สามารถแก้ไขรายการวันลาได้'));
    }
  };

  const handleDeleteLeave = async () => {
    if (!options.selectedLeave) return;
    try {
      await options.deleteExtension(options.selectedLeave.id);
      await options.refetchLeaveRecords();
      options.closeDeleteAlert();
      options.clearSelection();
      options.showSuccess('ลบรายการวันลาสำเร็จ');
    } catch (error) {
      toast.error(getErrorMessage(error, 'ไม่สามารถลบรายการวันลาได้'));
    }
  };

  const handleRecordReport = async ({
    reportDate,
    resumeDate,
    note,
    resumeStudyProgram,
  }: ReportPayload) => {
    if (!options.selectedLeave) return;
    try {
      const currentEvents = toReturnEventPayload(options.selectedLeaveReturnEvents);

      if (
        currentEvents.some(
          (event) =>
            event.report_date === reportDate &&
            Number(event.event_id ?? -1) !== Number(options.editingReturnEventId ?? -2),
        )
      ) {
        toast.error('มีรายการรายงานตัวในวันที่นี้แล้ว');
        return;
      }

      const nextEvents =
        options.editingReturnEventId !== null
          ? currentEvents
              .map((event) =>
                Number(event.event_id ?? -1) === Number(options.editingReturnEventId)
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

      await options.replaceReturnEvents({
        leaveRecordId: options.selectedLeave.id,
        events: nextEvents,
      });
      const summary = buildReturnReportSummary(nextEvents);

      await options.upsertExtension({
        leave_record_id: options.selectedLeave.id,
        require_return_report: true,
        return_report_status: summary.return_report_status,
        return_date: summary.return_date,
        return_remark: note || undefined,
      });
      await options.refetchLeaveRecords();
      options.closeReportDialog();
      options.clearSelection();
      toast.success('บันทึกรายงานตัวสำเร็จ');
    } catch (error) {
      toast.error(getErrorMessage(error, 'ไม่สามารถบันทึกรายงานตัวได้'));
    }
  };

  const handleDeleteReturnEvent = async (eventId?: number) => {
    if (!options.selectedLeave || !eventId) return;
    try {
      const currentEvents = toReturnEventPayload(options.selectedLeaveReturnEvents);
      const nextEvents = currentEvents
        .filter((event) => Number(event.event_id ?? -1) !== Number(eventId))
        .map((event) => ({
          report_date: event.report_date,
          resume_date: event.resume_date,
          resume_study_program: event.resume_study_program,
        }));

      await options.replaceReturnEvents({
        leaveRecordId: options.selectedLeave.id,
        events: nextEvents,
      });
      const summary = buildReturnReportSummary(nextEvents);
      await options.upsertExtension({
        leave_record_id: options.selectedLeave.id,
        require_return_report: true,
        return_report_status: summary.return_report_status,
        return_date: summary.return_date,
      });
      await options.refetchLeaveRecords();
      toast.success('ลบรายการรายงานตัวสำเร็จ');
    } catch (error) {
      toast.error(getErrorMessage(error, 'ไม่สามารถลบรายการรายงานตัวได้'));
    }
  };

  const handleDeleteDocument = async (documentId: number) => {
    if (!options.selectedLeave) return;
    await options.deleteDocument({ documentId, leaveRecordId: options.selectedLeave.id });
    await options.refetchDocuments();
  };

  return {
    handleAddLeave,
    handleEditLeave,
    handleDeleteLeave,
    handleRecordReport,
    handleDeleteReturnEvent,
    handleDeleteDocument,
  };
}
