import {
  emitAuditEvent,
  AuditEventType,
} from "@/modules/audit/services/audit.service.js";
import { PeriodStatus } from "@/modules/payroll/entities/payroll.entity.js";
import { PayrollRepository } from "@/modules/payroll/repositories/payroll.repository.js";
import { isPeriodLocked } from "@/modules/payroll/services/shared/payroll.utils.js";

export class PayrollPeriodItemService {
  static async addPeriodItems(
    periodId: number,
    requestIds: number[],
    actorId?: number,
  ) {
    const conn = await PayrollRepository.getConnection();
    try {
      await conn.beginTransaction();

      const period = await PayrollRepository.findPeriodByIdForUpdate(
        periodId,
        conn,
      );
      if (!period) throw new Error("Period not found");
      if (period.status !== PeriodStatus.OPEN || isPeriodLocked(period)) {
        throw new Error("Period is not open for changes");
      }

      const missingSnapshots: number[] = [];
      for (const requestId of requestIds) {
        const citizenId = await PayrollRepository.findRequestCitizenId(
          requestId,
          conn,
        );
        const userId = await PayrollRepository.findRequestUserId(
          requestId,
          conn,
        );
        if (!citizenId) {
          throw new Error(`Request not found: ${requestId}`);
        }
        const snapshotId =
          await PayrollRepository.findLatestVerificationSnapshotId(
            requestId,
            conn,
          );
        if (!snapshotId) {
          missingSnapshots.push(requestId);
          continue;
        }
        await PayrollRepository.insertPeriodItem(
          periodId,
          requestId,
          userId,
          citizenId,
          snapshotId,
          conn,
        );
      }

      if (missingSnapshots.length) {
        const error = new Error("Missing verification snapshot");
        (error as any).missingRequestIds = missingSnapshots;
        throw error;
      }

      await conn.commit();

      await emitAuditEvent({
        eventType: AuditEventType.PERIOD_ITEM_ADD,
        entityType: "period",
        entityId: periodId,
        actorId: actorId ?? null,
        actorRole: null,
        actionDetail: { request_ids: requestIds },
      });
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  static async removePeriodItem(
    periodId: number,
    itemId: number,
    actorId?: number,
  ) {
    const conn = await PayrollRepository.getConnection();
    try {
      await conn.beginTransaction();

      const period = await PayrollRepository.findPeriodByIdForUpdate(
        periodId,
        conn,
      );
      if (!period) throw new Error("Period not found");
      if (period.status !== PeriodStatus.OPEN || isPeriodLocked(period)) {
        throw new Error("Period is not open for changes");
      }

      await PayrollRepository.deletePeriodItem(periodId, itemId, conn);

      await conn.commit();

      await emitAuditEvent({
        eventType: AuditEventType.PERIOD_ITEM_REMOVE,
        entityType: "period",
        entityId: periodId,
        actorId: actorId ?? null,
        actorRole: null,
        actionDetail: { item_id: itemId },
      });
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }
}
