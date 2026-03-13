/**
 * Notification Module - Entity Definitions
 *
 * TypeScript interfaces matching notification-related DB tables
 */

// ─── Notification Types ───────────────────────────────────────────────────────

export enum NotificationType {
  APPROVAL = "APPROVAL",
  PAYMENT = "PAYMENT",
  LICENSE = "LICENSE",
  LEAVE = "LEAVE",
  SYSTEM = "SYSTEM",
  REMINDER = "REMINDER",
  OTHER = "OTHER",
}

const LEGACY_NOTIFICATION_TYPE_MAP: Record<string, NotificationType> = {
  INFO: NotificationType.SYSTEM,
  SUCCESS: NotificationType.PAYMENT,
  WARNING: NotificationType.REMINDER,
  ERROR: NotificationType.OTHER,
  SLA_REMINDER: NotificationType.REMINDER,
};

export const normalizeNotificationType = (
  raw: unknown,
  fallback: NotificationType = NotificationType.SYSTEM,
): NotificationType => {
  if (typeof raw !== "string") return fallback;
  const candidate = raw.trim().toUpperCase();
  if (!candidate) return fallback;
  if (Object.values(NotificationType).includes(candidate as NotificationType)) {
    return candidate as NotificationType;
  }
  return LEGACY_NOTIFICATION_TYPE_MAP[candidate] ?? fallback;
};

// ─── ntf_messages table ───────────────────────────────────────────────────────

export interface Notification {
  id: number;
  user_id: number;
  title: string;
  message: string;
  link: string;
  type: NotificationType;
  is_read: boolean;
  created_at: Date;
}

// ─── Notification with read status ────────────────────────────────────────────

export interface NotificationWithCount {
  notifications: Notification[];
  unreadCount: number;
}

// ─── Create notification input ────────────────────────────────────────────────

export interface CreateNotificationInput {
  userId: number;
  title: string;
  message: string;
  link?: string;
  type?: NotificationType;
}

// ─── Bulk notification input ──────────────────────────────────────────────────

export interface BulkNotificationInput {
  role: string;
  title: string;
  message: string;
  link?: string;
}

// ─── User notification settings ──────────────────────────────────────────────

export interface NotificationSettings {
  user_id: number;
  in_app: boolean;
  sms: boolean;
  email: boolean;
  updated_at?: Date;
}
