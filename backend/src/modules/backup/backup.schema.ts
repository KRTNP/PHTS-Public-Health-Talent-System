import { z } from 'zod';

export const backupHistorySchema = z.object({
  query: z.object({
    limit: z
      .string()
      .regex(/^\d+$/, 'limit ต้องเป็นตัวเลข')
      .optional()
      .default('20'),
  }),
});

export type BackupHistoryQuery = z.infer<typeof backupHistorySchema>['query'];

export const updateBackupScheduleSchema = z.object({
  body: z.object({
    hour: z
      .number({ error: 'hour ต้องเป็นตัวเลข' })
      .int('hour ต้องเป็นจำนวนเต็ม')
      .min(0, 'hour ต้องอยู่ระหว่าง 0-23')
      .max(23, 'hour ต้องอยู่ระหว่าง 0-23'),
    minute: z
      .number({ error: 'minute ต้องเป็นตัวเลข' })
      .int('minute ต้องเป็นจำนวนเต็ม')
      .min(0, 'minute ต้องอยู่ระหว่าง 0-59')
      .max(59, 'minute ต้องอยู่ระหว่าง 0-59'),
  }),
});

export type UpdateBackupScheduleBody = z.infer<typeof updateBackupScheduleSchema>['body'];
