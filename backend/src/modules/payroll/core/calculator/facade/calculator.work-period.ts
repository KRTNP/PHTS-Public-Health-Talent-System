import type { LeaveRow } from "@/modules/payroll/core/deductions/deductions.js";
import type { MovementRow } from "@/modules/payroll/core/calculator/facade/calculator.js";
import { formatLocalDate } from "@/modules/payroll/core/utils/date.utils.js";

export interface WorkPeriod {
  start: Date;
  end: Date;
}

export function resolveWorkPeriods(
  movements: MovementRow[],
  monthStart: Date,
  monthEnd: Date,
): { periods: WorkPeriod[]; remark: string } {
  const exitTypes = new Set(["RESIGN", "RETIRE", "DEATH", "TRANSFER_OUT"]);
  const monthStartStr = formatLocalDate(monthStart);
  const monthEndStr = formatLocalDate(monthEnd);
  const exitsInMonth = movements
    .filter((m) => {
      const dateStr = formatLocalDate(m.effective_date);
      return (
        exitTypes.has(String(m.movement_type ?? "")) &&
        dateStr >= monthStartStr &&
        dateStr <= monthEndStr
      );
    })
    .sort((a, b) => {
      const dateA = new Date(a.effective_date).getTime();
      const dateB = new Date(b.effective_date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return (a as any).movement_id - (b as any).movement_id;
    });

  if (exitsInMonth.length === 0) {
    return { periods: [{ start: monthStart, end: monthEnd }], remark: "" };
  }

  const firstExit = exitsInMonth[0];
  if (!firstExit) {
    return { periods: [{ start: monthStart, end: monthEnd }], remark: "" };
  }
  const exitDate = new Date(firstExit.effective_date);
  const endBeforeExit = new Date(exitDate);
  endBeforeExit.setDate(endBeforeExit.getDate() - 1);

  if (endBeforeExit < monthStart) {
    return { periods: [], remark: "สถานะออกจากงานในเดือนนี้" };
  }

  return {
    periods: [{ start: monthStart, end: endBeforeExit }],
    remark: "",
  };
}

export function buildStudyLeaveRowsFromMovements(
  movements: MovementRow[],
  monthEnd: Date,
): LeaveRow[] {
  const relevantMovements = movements.filter(
    (m) => new Date(m.effective_date) <= monthEnd,
  );
  if (relevantMovements.length === 0) return [];

  const sorted = [...relevantMovements].sort((a, b) => {
    const dateA = new Date(a.effective_date).getTime();
    const dateB = new Date(b.effective_date).getTime();
    if (dateA !== dateB) return dateA - dateB;
    return (a as any).movement_id - (b as any).movement_id;
  });

  const studyLeaves: LeaveRow[] = [];
  let studyStart: Date | null = null;

  for (const mov of sorted) {
    const type = mov.movement_type;
    const movDate = new Date(mov.effective_date);

    if (type === "STUDY") {
      if (!studyStart) {
        studyStart = movDate;
      }
      continue;
    }

    if (studyStart) {
      const endDate = new Date(movDate);
      endDate.setDate(endDate.getDate() - 1);
      studyLeaves.push({
        leave_type: "education",
        start_date: studyStart,
        end_date: endDate,
        duration_days: 0,
      } as LeaveRow);
      studyStart = null;
    }
  }

  if (studyStart) {
    studyLeaves.push({
      leave_type: "education",
      start_date: studyStart,
      end_date: monthEnd,
      duration_days: 0,
    } as LeaveRow);
  }

  return studyLeaves;
}

export function assignSyntheticIdsToLeaves(leaves: LeaveRow[]): LeaveRow[] {
  let syntheticId = -1;
  return leaves.map((leave) => {
    if (leave.id !== undefined && leave.id !== null) return leave;
    return {
      ...leave,
      id: syntheticId--,
    } as LeaveRow;
  });
}
