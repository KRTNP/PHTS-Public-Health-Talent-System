import { z } from "zod";

const isValidDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

// PUT /sla/config/:stepNo
export const updateSLAConfigSchema = z.object({
  params: z.object({
    stepNo: z.string().regex(/^\d+$/, "stepNo ต้องเป็นตัวเลข"),
  }),
  body: z.object({
    slaDays: z.number().int().min(1, "slaDays ต้องมากกว่า 0"),
    reminderBeforeDays: z.number().int().min(0).optional(),
    reminderAfterDays: z.number().int().min(0).optional(),
  }),
});

export type UpdateSLAConfigParams = z.infer<
  typeof updateSLAConfigSchema
>["params"];
export type UpdateSLAConfigBody = z.infer<typeof updateSLAConfigSchema>["body"];

// GET /sla/calculate-days?start=&end=
export const calculateBusinessDaysSchema = z.object({
  query: z.object({
    start: z
      .string()
      .refine((d) => isValidDate(d), {
        message: "start ต้องเป็นรูปแบบวันที่ที่ถูกต้อง",
      }),
    end: z
      .string()
      .refine((d) => isValidDate(d), {
        message: "end ต้องเป็นรูปแบบวันที่ที่ถูกต้อง",
      }),
  }),
});

export type CalculateBusinessDaysQuery = z.infer<
  typeof calculateBusinessDaysSchema
>["query"];
