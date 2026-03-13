import type { LeaveReturnReportEvent } from '@/features/leave-management/core/api';

export type ReturnReportMode = 'return_to_work' | 'resume_study';

export function deriveReturnReportMode(
  event?: Pick<LeaveReturnReportEvent, 'resume_date' | 'resume_study_program'> | null,
): ReturnReportMode {
  if (event?.resume_date || event?.resume_study_program) {
    return 'resume_study';
  }
  return 'return_to_work';
}

export function buildReturnReportPayload(input: {
  mode: ReturnReportMode;
  reportDate: string;
  resumeDate?: string;
  note: string;
  resumeStudyProgram?: string;
}) {
  const reportDate = input.reportDate.trim();
  const note = input.note;

  if (input.mode === 'return_to_work') {
    return {
      reportDate,
      note,
    };
  }

  return {
    reportDate,
    resumeDate: input.resumeDate?.trim() || undefined,
    note,
    resumeStudyProgram: input.resumeStudyProgram?.trim() || undefined,
  };
}

export function describeReturnReportEvent(
  event: Pick<LeaveReturnReportEvent, 'resume_date' | 'resume_study_program'>,
): string {
  if (event.resume_date || event.resume_study_program) {
    return 'กลับไปศึกษาต่อ/อบรมต่อ';
  }
  return 'กลับมาปฏิบัติงานตามปกติ';
}
