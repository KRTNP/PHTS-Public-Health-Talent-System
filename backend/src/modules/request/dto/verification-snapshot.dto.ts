import { z } from "zod";

export const verificationSnapshotSchema = z.object({
  body: z.object({
    master_rate_id: z.number().int().min(1),
    effective_date: z.string().min(1),
    expiry_date: z.string().optional(),
    snapshot_data: z.record(z.string(), z.any()),
  }),
});

export type VerificationSnapshotInput = z.infer<
  typeof verificationSnapshotSchema
>["body"];
