/**
 * PHTS System - Holiday Config Service
 *
 * Manages official holidays configuration.
 */

import { emitAuditEvent, AuditEventType } from '@/modules/audit/services/audit.service.js';
import { MasterDataRepository } from '@/modules/master-data/repositories/master-data.repository.js';

type HolidayType = "national" | "special" | "substitution";

const resolveHolidayTypeFromName = (name?: string | null): HolidayType => {
  const normalized = String(name ?? "");
  if (normalized.includes("ชดเชย")) return "substitution";
  if (normalized.includes("พิเศษ")) return "special";
  return "national";
};

const normalizeHolidayDate = (value: unknown): string => {
  // mysql2 may return Date objects for DATE/DATETIME columns.
  // IMPORTANT: Using toISOString() can shift the day depending on timezone.
  // Our API contract expects 'YYYY-MM-DD' (date-only) for route params & frontend date inputs.
  if (!value) return "";
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const raw = String(value);
  if (!raw) return "";
  // Handle ISO strings or DATETIME-like strings
  if (raw.includes("T")) return raw.slice(0, 10);
  if (raw.includes(" ")) return raw.slice(0, 10);
  return raw;
};

let holidayTypeColumnAvailable: boolean | null = null;

const hasHolidayTypeColumn = async (): Promise<boolean> => {
  if (holidayTypeColumnAvailable !== null) {
    return holidayTypeColumnAvailable;
  }
  holidayTypeColumnAvailable = await MasterDataRepository.hasHolidayTypeColumn();
  return holidayTypeColumnAvailable;
};

export const getHolidays = async (year?: string | number): Promise<any[]> => {
  const hasTypeColumn = await hasHolidayTypeColumn();
  const holidays = await MasterDataRepository.findActiveHolidays({
    year,
    hasHolidayTypeColumn: hasTypeColumn,
  });
  return holidays.map((row) => ({
    ...row,
    holiday_date: normalizeHolidayDate((row as any).holiday_date),
    holiday_type: (row as any).holiday_type ?? resolveHolidayTypeFromName((row as any).holiday_name),
  }));
};

export const addHoliday = async (
  date: string,
  name: string,
  type?: HolidayType,
  actorId?: number,
): Promise<void> => {
  const hasTypeColumn = await hasHolidayTypeColumn();
  await MasterDataRepository.upsertHoliday({
    date,
    name,
    type: type ?? resolveHolidayTypeFromName(name),
    hasHolidayTypeColumn: hasTypeColumn,
  });

  await emitAuditEvent({
    eventType: AuditEventType.HOLIDAY_UPDATE,
    entityType: "holiday",
    entityId: null,
    actorId: actorId ?? null,
    actorRole: null,
    actionDetail: {
      action: "UPSERT",
      holiday_date: date,
      holiday_name: name,
      holiday_type: type ?? resolveHolidayTypeFromName(name),
    },
  });
};

export const updateHoliday = async (
  originalDate: string,
  date: string,
  name: string,
  type?: HolidayType,
  actorId?: number,
): Promise<void> => {
  const hasTypeColumn = await hasHolidayTypeColumn();
  await MasterDataRepository.updateHoliday({
    originalDate,
    date,
    name,
    type: type ?? resolveHolidayTypeFromName(name),
    hasHolidayTypeColumn: hasTypeColumn,
  });

  await emitAuditEvent({
    eventType: AuditEventType.HOLIDAY_UPDATE,
    entityType: "holiday",
    entityId: null,
    actorId: actorId ?? null,
    actorRole: null,
    actionDetail: {
      action: "UPDATE",
      original_holiday_date: originalDate,
      holiday_date: date,
      holiday_name: name,
      holiday_type: type ?? resolveHolidayTypeFromName(name),
    },
  });
};

export const deleteHoliday = async (
  date: string,
  actorId?: number,
): Promise<void> => {
  await MasterDataRepository.deactivateHoliday(date);

  await emitAuditEvent({
    eventType: AuditEventType.HOLIDAY_UPDATE,
    entityType: "holiday",
    entityId: null,
    actorId: actorId ?? null,
    actorRole: null,
    actionDetail: {
      action: "DEACTIVATE",
      holiday_date: date,
    },
  });
};
