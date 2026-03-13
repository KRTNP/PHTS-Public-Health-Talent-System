import { z } from "zod";
import { UserRole } from '@/types/auth.js';

// GET /system/users?q=searchTerm
export const searchUsersSchema = z.object({
  query: z.object({
    q: z.string().optional().default(""),
    page: z
      .string()
      .regex(/^\d+$/, "page ต้องเป็นตัวเลข")
      .optional()
      .default("1"),
    limit: z
      .string()
      .regex(/^\d+$/, "limit ต้องเป็นตัวเลข")
      .optional()
      .default("20"),
    role: z.nativeEnum(UserRole).optional(),
    is_active: z.enum(["0", "1"]).optional(),
  }),
});

export type SearchUsersQuery = z.infer<typeof searchUsersSchema>["query"];

// GET /system/users/:userId
export const getUserByIdSchema = z.object({
  params: z.object({
    userId: z.string().regex(/^\d+$/, "userId ต้องเป็นตัวเลข"),
  }),
});

export type GetUserByIdParams = z.infer<typeof getUserByIdSchema>["params"];

// PUT /system/users/:userId/role
export const updateUserRoleSchema = z.object({
  params: z.object({
    userId: z.string().regex(/^\d+$/, "userId ต้องเป็นตัวเลข"),
  }),
  body: z.object({
    role: z.nativeEnum(UserRole, { error: "role ต้องเป็นค่าที่ถูกต้อง" }),
    is_active: z.boolean().optional(),
  }),
});

export type UpdateUserRoleParams = z.infer<
  typeof updateUserRoleSchema
>["params"];
export type UpdateUserRoleBody = z.infer<typeof updateUserRoleSchema>["body"];

// POST /system/maintenance
export const toggleMaintenanceModeSchema = z.object({
  body: z.object({
    enabled: z.boolean({ error: "enabled จำเป็นต้องระบุ" }),
  }),
});

export type ToggleMaintenanceModeBody = z.infer<
  typeof toggleMaintenanceModeSchema
>["body"];

export const getSnapshotOutboxSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/, "page ต้องเป็นตัวเลข").optional().default("1"),
    limit: z.string().regex(/^\d+$/, "limit ต้องเป็นตัวเลข").optional().default("10"),
    status: z.enum(["PENDING", "PROCESSING", "FAILED", "SENT", "DEAD_LETTER"]).optional(),
    period_id: z.string().regex(/^\d+$/, "period_id ต้องเป็นตัวเลข").optional(),
  }),
});

export type GetSnapshotOutboxQuery = z.infer<typeof getSnapshotOutboxSchema>["query"];

export const retrySnapshotOutboxSchema = z.object({
  params: z.object({
    outboxId: z.string().regex(/^\d+$/, "outboxId ต้องเป็นตัวเลข"),
  }),
});

export type RetrySnapshotOutboxParams = z.infer<typeof retrySnapshotOutboxSchema>["params"];

export const getNotificationOutboxSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/, "page ต้องเป็นตัวเลข").optional().default("1"),
    limit: z.string().regex(/^\d+$/, "limit ต้องเป็นตัวเลข").optional().default("10"),
    status: z.enum(["PENDING", "PROCESSING", "FAILED", "SENT", "DEAD_LETTER"]).optional(),
  }),
});

export type GetNotificationOutboxQuery = z.infer<typeof getNotificationOutboxSchema>["query"];

export const retryNotificationOutboxSchema = z.object({
  params: z.object({
    outboxId: z.string().regex(/^\d+$/, "outboxId ต้องเป็นตัวเลข"),
  }),
});

export type RetryNotificationOutboxParams = z.infer<typeof retryNotificationOutboxSchema>["params"];
