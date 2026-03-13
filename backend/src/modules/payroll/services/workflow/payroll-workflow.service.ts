import { NotificationService } from "@/modules/notification/services/notification.service.js";
import {
  emitAuditEvent,
  AuditEventType,
} from "@/modules/audit/services/audit.service.js";
import {
  PayPeriod,
  PeriodStatus,
} from "@/modules/payroll/entities/payroll.entity.js";
import { resolveNextStatus } from "@shared/policy/payroll.policy.js";
import { PayrollRepository } from "@/modules/payroll/repositories/payroll.repository.js";
import { UserRole } from "@/types/auth.js";
import {
  enqueuePeriodSnapshotGeneration,
  SnapshotStatus,
} from "@/modules/snapshot/services/snapshot.service.js";
import { isPeriodLocked } from "@/modules/payroll/services/shared/payroll.utils.js";
import { PayrollReviewService } from "@/modules/payroll/services/workflow/payroll-review.service.js";
import { formatLocalDate, makeLocalDate } from "@/modules/payroll/core/utils/date.utils.js";

export type PeriodWorkflowAction =
  | "SUBMIT"
  | "APPROVE_HR"
  | "APPROVE_HEAD_FINANCE"
  | "APPROVE_DIRECTOR"
  | "REJECT";

export class PayrollWorkflowService {
  static canRoleViewPeriod(
    role: string | null | undefined,
    status: PeriodStatus | string,
  ): boolean {
    if (role === UserRole.HEAD_HR && status === PeriodStatus.OPEN) return false;
    return true;
  }

  static async ensurePeriodVisibleForRole(
    periodId: number,
    role: string | null | undefined,
  ): Promise<PayPeriod> {
    const period = await PayrollRepository.findPeriodById(periodId);
    if (!period) throw new Error("Period not found");
    if (!PayrollWorkflowService.canRoleViewPeriod(role, period.status)) {
      throw new Error("Forbidden period access");
    }
    return period;
  }

  static async getPeriodByMonthYear(
    year: number,
    month: number,
  ): Promise<PayPeriod | null> {
    return PayrollRepository.findPeriodByMonthYear(month, year);
  }

  static async getOrCreatePeriod(
    year: number,
    month: number,
    createdBy?: number | null,
  ): Promise<PayPeriod> {
    const existing = await PayrollRepository.findPeriodByMonthYear(month, year);
    if (existing) return existing;

    if (!createdBy) {
      throw new Error("ไม่สามารถสร้างรอบได้: ไม่พบผู้สร้าง (กรุณาเข้าสู่ระบบ)");
    }

    const insertId = await PayrollRepository.insertPeriod(
      month,
      year,
      PeriodStatus.OPEN,
      createdBy,
    );

    await emitAuditEvent({
      eventType: AuditEventType.PERIOD_CREATE,
      entityType: "period",
      entityId: insertId,
      actorId: createdBy,
      actorRole: null,
      actionDetail: {
        period_month: month,
        period_year: year,
        status: PeriodStatus.OPEN,
      },
    });

    const created = await PayrollRepository.findPeriodById(insertId);
    if (!created) {
      throw new Error("Payroll period not found after creation");
    }
    return created;
  }

  static async updatePeriodStatus(
    periodId: number,
    action: PeriodWorkflowAction,
    actorId: number,
    reason?: string,
  ) {
    const conn = await PayrollRepository.getConnection();
    try {
      await conn.beginTransaction();

      const period = await PayrollRepository.findPeriodByIdForUpdate(
        periodId,
        conn,
      );
      if (!period) throw new Error("Period not found");

      const {
        status: currentStatus,
        period_year: year,
        period_month: month,
      } = period;
      const nextStatus = resolveNextStatus(action, currentStatus);

      if (action === "SUBMIT") {
        const requiredProfessionCodes =
          await PayrollReviewService.getRequiredProfessionCodes(periodId, conn);
        if (requiredProfessionCodes.length === 0) {
          throw new Error("ยังไม่มีข้อมูลการคำนวณสำหรับรอบนี้");
        }
        const reviewedProfessionCodes =
          await PayrollReviewService.getReviewedProfessionCodes(periodId, conn);
        const reviewedSet = new Set(reviewedProfessionCodes);
        const missingProfessionCodes = requiredProfessionCodes.filter(
          (code) => !reviewedSet.has(code),
        );
        if (missingProfessionCodes.length > 0) {
          const error = new Error(
            "ยังตรวจไม่ครบทุกวิชาชีพก่อนส่งให้ HR",
          ) as Error & { missingProfessionCodes?: string[] };
          error.missingProfessionCodes = missingProfessionCodes;
          throw error;
        }
      }

      await sendWorkflowNotification(nextStatus, month, year, conn);

      await PayrollRepository.updatePeriodStatus(periodId, nextStatus, conn);
      if (action === "SUBMIT") {
        await PayrollRepository.updatePeriodLock(periodId, true, conn);
        await PayrollRepository.updatePeriodFreeze(periodId, true, actorId, conn);
      }
      if (action === "REJECT") {
        await PayrollRepository.updatePeriodLock(periodId, false, conn);
        await PayrollRepository.updatePeriodFreeze(periodId, false, null, conn);
        await PayrollRepository.clearProfessionReviewsByPeriod(periodId, conn);
      }
      if (nextStatus === PeriodStatus.CLOSED) {
        await PayrollRepository.updatePeriodSnapshotStatus(
          periodId,
          SnapshotStatus.PENDING,
          conn,
          { readyAt: null },
        );
      }
      await conn.commit();

      let auditEventType =
        nextStatus === PeriodStatus.CLOSED
          ? AuditEventType.PERIOD_CLOSE
          : AuditEventType.PERIOD_APPROVE;
      if (action === "REJECT") {
        auditEventType = AuditEventType.PERIOD_REJECT;
      }

      await tryEmitAuditEvent({
        eventType: auditEventType,
        entityType: "period",
        entityId: periodId,
        actorId,
        actorRole: null,
        actionDetail: {
          period_month: month,
          period_year: year,
          action,
          from_status: currentStatus,
          to_status: nextStatus,
          reason: reason ?? null,
        },
      });

      if (action === "SUBMIT") {
        await tryEmitAuditEvent({
          eventType: AuditEventType.PERIOD_FREEZE,
          entityType: "period",
          entityId: periodId,
          actorId,
          actorRole: null,
          actionDetail: {
            period_month: month,
            period_year: year,
          },
        });
        await tryEmitAuditEvent({
          eventType: AuditEventType.PERIOD_SUBMIT,
          entityType: "period",
          entityId: periodId,
          actorId,
          actorRole: null,
          actionDetail: {
            period_month: month,
            period_year: year,
            from_status: currentStatus,
            to_status: nextStatus,
          },
        });
      }

      if (nextStatus === PeriodStatus.CLOSED) {
        await enqueuePeriodSnapshotGeneration(periodId, actorId);
      }

      return { success: true, status: nextStatus };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  static async hardDeletePeriod(periodId: number, actorId: number) {
    const conn = await PayrollRepository.getConnection();
    try {
      await conn.beginTransaction();

      const period = await PayrollRepository.findPeriodByIdForUpdate(
        periodId,
        conn,
      );
      if (!period) throw new Error("Period not found");
      if (period.status !== PeriodStatus.OPEN) {
        throw new Error("สามารถลบรอบได้เฉพาะรอบที่ยังเปิดอยู่ (OPEN) เท่านั้น");
      }
      if (isPeriodLocked(period)) {
        throw new Error("ไม่สามารถลบรอบได้: รอบนี้ถูกล็อกแล้ว");
      }

      await PayrollRepository.deletePayResultChecksByPeriod(periodId, conn);
      await PayrollRepository.deletePayResultItemsByPeriod(periodId, conn);
      await PayrollRepository.deletePayResultsByPeriod(periodId, conn);
      await PayrollRepository.clearProfessionReviewsByPeriod(periodId, conn);
      await PayrollRepository.deletePeriodItemsByPeriod(periodId, conn);
      await PayrollRepository.deletePeriodById(periodId, conn);

      await conn.commit();

      await tryEmitAuditEvent({
        eventType: AuditEventType.PERIOD_DELETE,
        entityType: "period",
        entityId: periodId,
        actorId,
        actorRole: null,
        actionDetail: {
          period_month: period.period_month,
          period_year: period.period_year,
          status: period.status,
          is_locked: isPeriodLocked(period),
          delete_mode: "hard",
        },
      });

      return { success: true };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  static async getPeriodById(periodId: number) {
    return PayrollRepository.findPeriodById(periodId);
  }

  static async getAllPeriods(role?: string | null): Promise<PayPeriod[]> {
    const periods = await PayrollRepository.findAllPeriods();
    return periods.filter((period) =>
      PayrollWorkflowService.canRoleViewPeriod(role, period.status),
    );
  }

  static async ensureCurrentPeriod(): Promise<void> {
    return;
  }

  static async getPeriodDetail(periodId: number, role?: string | null) {
    const period = await PayrollWorkflowService.ensurePeriodVisibleForRole(
      periodId,
      role,
    );
    const items = await PayrollRepository.findPeriodItems(periodId);
    const monthStart = makeLocalDate(period.period_year, period.period_month - 1, 1);
    const monthEnd = makeLocalDate(period.period_year, period.period_month, 0);
    const toDate = (d: Date) => formatLocalDate(d);

    const holidayRows = await PayrollRepository.findHolidayDatesInRange(
      toDate(monthStart),
      toDate(monthEnd),
    );
    const publicHolidaySet = new Set<string>(
      holidayRows.map((row: any) => toDate(new Date(row.holiday_date))),
    );

    const totalDays = monthEnd.getDate();
    let weekendDays = 0;
    let publicHolidayDays = 0;
    for (let day = 1; day <= totalDays; day += 1) {
      const current = makeLocalDate(
        period.period_year,
        period.period_month - 1,
        day,
      );
      const dayOfWeek = current.getDay();
      const dateKey = toDate(current);
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      if (isWeekend) {
        weekendDays += 1;
        continue;
      }
      if (publicHolidaySet.has(dateKey)) {
        publicHolidayDays += 1;
      }
    }

    const holidayDays = weekendDays + publicHolidayDays;
    const workingDays = Math.max(0, totalDays - holidayDays);

    return {
      period,
      items,
      calendar: {
        total_days: totalDays,
        working_days: workingDays,
        holiday_days: holidayDays,
        weekend_days: weekendDays,
        public_holiday_days: publicHolidayDays,
      },
    };
  }
}

async function sendWorkflowNotification(
  nextStatus: PeriodStatus,
  month: number,
  year: number,
  conn: any,
): Promise<void> {
  const notifications: Record<
    string,
    { role: string; title: string; message: string; link: string }
  > = {
    [PeriodStatus.WAITING_HR]: {
      role: "HEAD_HR",
      title: "ตรวจสอบงวดเดือน",
      message: `งวดเดือน ${month}/${year} รอการตรวจสอบจากท่าน`,
      link: "/dashboard/head-hr/payroll-check",
    },
    [PeriodStatus.WAITING_HEAD_FINANCE]: {
      role: "HEAD_FINANCE",
      title: "ตรวจสอบงวดเดือน",
      message: `งวดเดือน ${month}/${year} ผ่านการตรวจสอบจาก HR แล้ว รอท่านอนุมัติ`,
      link: "/dashboard/head-finance/budget-check",
    },
    [PeriodStatus.WAITING_DIRECTOR]: {
      role: "DIRECTOR",
      title: "อนุมัติปิดงวดเดือน",
      message: `สรุปยอดงวดเดือน ${month}/${year} รอการอนุมัติปิดงวด`,
      link: "/dashboard/director/approvals",
    },
    [PeriodStatus.CLOSED]: {
      role: "FINANCE_OFFICER",
      title: "งวดเดือนปิดแล้ว",
      message: `งวดเดือน ${month}/${year} อนุมัติแล้ว สามารถดาวน์โหลดรายงานได้`,
      link: "/dashboard/finance-officer",
    },
  };

  const notif = notifications[nextStatus];
  if (notif) {
    await NotificationService.notifyRole(
      notif.role,
      notif.title,
      notif.message,
      notif.link,
      undefined,
      conn,
    );
  }
}

async function tryEmitAuditEvent(
  payload: Parameters<typeof emitAuditEvent>[0],
) {
  try {
    await emitAuditEvent(payload);
  } catch (error) {
    console.error("[payroll] audit emit failed", error);
  }
}
