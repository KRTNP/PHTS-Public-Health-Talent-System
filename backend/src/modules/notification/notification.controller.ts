/**
 * Notification Module - Controller
 *
 * Handles HTTP requests for notification operations
 */

import { Request, Response } from "express";
import { asyncHandler } from "@middlewares/errorHandler.js";
import { NotificationService } from '@/modules/notification/services/notification.service.js';
import {
  DeleteReadBody,
  NotificationSettingsBody,
} from '@/modules/notification/notification.schema.js';

/**
 * Get notifications for current user
 * GET /api/notifications
 */
export const getMyNotifications = asyncHandler(async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = (req.user as any).id ?? (req.user as any).userId;
  const limit = req.query.limit ? Number(req.query.limit) : 20;

  const result = await NotificationService.getMyNotifications(userId, limit);

  res.json({
    success: true,
    data: result,
  });
});

/**
 * Mark notification(s) as read
 * PUT /api/notifications/:id/read
 */
export const markRead = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = (req.user as any).id ?? (req.user as any).userId;
  const { id } = req.params;

  if (id === "all") {
    const count = await NotificationService.markAllAsRead(userId);
    res.json({ success: true, data: { markedCount: count } });
  } else {
    const success = await NotificationService.markAsRead(Number(id), userId);
    res.json({ success });
  }
});

/**
 * Delete read notifications for current user
 * DELETE /api/notifications/read
 */
export const deleteReadNotifications = asyncHandler(async (
  req: Request<object, object, DeleteReadBody>,
  res: Response,
): Promise<void> => {
  const userId = (req.user as any).id ?? (req.user as any).userId;
  const olderThanDays = req.body?.older_than_days;
  const deletedCount = await NotificationService.deleteRead(
    userId,
    olderThanDays,
  );
  res.json({ success: true, data: { deletedCount } });
});

/**
 * Get unread count
 * GET /api/notifications/unread-count
 */
export const getUnreadCount = asyncHandler(async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = (req.user as any).id ?? (req.user as any).userId;
  const count = await NotificationService.getUnreadCount(userId);

  res.json({ success: true, data: { count } });
});

/**
 * Get notification settings for current user
 * GET /api/notifications/settings
 */
export const getNotificationSettings = asyncHandler(async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = (req.user as any).id ?? (req.user as any).userId;
  const settings = await NotificationService.getNotificationSettings(userId);
  res.json({ success: true, data: settings });
});

/**
 * Update notification settings for current user
 * PUT /api/notifications/settings
 */
export const updateNotificationSettings = asyncHandler(async (
  req: Request<object, object, NotificationSettingsBody>,
  res: Response,
): Promise<void> => {
  const userId = (req.user as any).id ?? (req.user as any).userId;
  const settings = await NotificationService.updateNotificationSettings(
    userId,
    req.body,
  );
  res.json({ success: true, data: settings });
});
