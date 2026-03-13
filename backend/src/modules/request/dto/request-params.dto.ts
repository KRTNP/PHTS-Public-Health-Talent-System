import { z } from "zod";

const idParam = z.object({
  id: z.string().regex(/^\d+$/, "id ต้องเป็นตัวเลข"),
});

const eligibilityIdParam = z.object({
  eligibilityId: z.string().regex(/^\d+$/, "eligibilityId ต้องเป็นตัวเลข"),
});

const eligibilityAttachmentParam = z.object({
  eligibilityId: z.string().regex(/^\d+$/, "eligibilityId ต้องเป็นตัวเลข"),
  attachmentId: z.string().regex(/^\d+$/, "attachmentId ต้องเป็นตัวเลข"),
});

const requestAttachmentParam = z.object({
  id: z.string().regex(/^\d+$/, "id ต้องเป็นตัวเลข"),
  attachmentId: z.string().regex(/^\d+$/, "attachmentId ต้องเป็นตัวเลข"),
});

const idOrNoParam = z.object({
  id: z
    .string()
    .regex(
      /^(\d+|REQ-[A-Z0-9-]+)$/i,
      "id ต้องเป็นตัวเลขหรือรูปแบบเลขคำขอที่ถูกต้อง",
    ),
});

export const requestIdParamSchema = z.object({
  params: idParam,
});

export const requestIdOrNoParamSchema = z.object({
  params: idOrNoParam,
});

export const requestEligibilityIdParamSchema = z.object({
  params: eligibilityIdParam,
});

export const requestEligibilityAttachmentParamSchema = z.object({
  params: eligibilityAttachmentParam,
});

export const requestAttachmentParamSchema = z.object({
  params: requestAttachmentParam,
});

export const requestEligibilityQuerySchema = z.object({
  query: z.object({
    active_only: z.enum(["0", "1", "2"]).optional(),
    // Optional paging + filters (used by allowance-list screens)
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    profession_code: z.string().trim().min(1).optional(), // "ALL" or code
    search: z.string().trim().max(200).optional(),
    rate_group: z.string().trim().min(1).optional(), // "all" or group_no
    department: z.string().trim().max(255).optional(),
    sub_department: z.string().trim().max(255).optional(),
    license_status: z.enum(["all", "active", "expiring", "expired"]).optional(),
    alert_filter: z.enum(["all", "any", "error", "no-license", "duplicate", "upcoming-change"]).optional(),
  }),
});

export const requestHistoryQuerySchema = z.object({
  query: z.object({
    view: z.enum(["mine", "team"]).optional(),
    actions: z.enum(["important", "all"]).optional(),
  }),
});

export const requestOcrHistoryQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    status: z.enum(["queued", "processing", "completed", "failed", "skipped"]).optional(),
    search: z.string().trim().max(200).optional(),
  }),
});

export const requestRateMappingSchema = z.object({
  params: idParam,
  body: z.object({
    group_no: z.coerce.number().int().positive(),
    item_no: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? null : value),
      z.string().min(1).optional().nullable(),
    ),
    sub_item_no: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? null : value),
      z.string().min(1).optional().nullable(),
    ),
  }),
});

export const requestManualOcrSchema = z.object({
  params: idParam,
  body: z.object({
    service_url: z.string().trim().url().optional(),
    worker: z.string().trim().min(1).max(100).optional(),
    count: z.coerce.number().int().min(0).optional(),
    success_count: z.coerce.number().int().min(0).optional(),
    failed_count: z.coerce.number().int().min(0).optional(),
    error: z.string().trim().max(5000).optional().nullable(),
    results: z.array(
      z.object({
        name: z.string().trim().max(255).optional(),
        ok: z.boolean().optional(),
        markdown: z.string().optional(),
        error: z.string().optional(),
      }),
    ).optional(),
  }),
});

export const requestEligibilityAttachmentOcrSchema = z.object({
  params: eligibilityIdParam,
  body: z.object({
    attachments: z.array(
      z.object({
        attachment_id: z.coerce.number().int().positive(),
        source: z.enum(["eligibility", "request"]),
      }),
    ).min(1),
  }),
});

export const requestAttachmentOcrSchema = z.object({
  params: idParam,
  body: z.object({
    attachments: z.array(
      z.object({
        attachment_id: z.coerce.number().int().positive(),
      }),
    ).min(1),
  }),
});

export const requestOcrClearSchema = z.object({
  params: idParam,
  body: z.object({
    file_name: z.string().trim().min(1).max(255),
  }),
});

export const requestEligibilityOcrClearSchema = z.object({
  params: eligibilityIdParam,
  body: z.object({
    file_name: z.string().trim().min(1).max(255),
  }),
});

export const requestEligibilityManageSchema = z.object({
  params: eligibilityIdParam,
  body: z
    .object({
      reason: z.string().trim().max(500).optional(),
    })
    .optional()
    .default({}),
});

export const requestReassignSchema = z.object({
  params: idParam,
  body: z.object({
    target_officer_id: z.coerce.number().int().positive(),
    remark: z.string().min(1).max(1000),
  }),
});

export const requestApproveBatchSchema = z.object({
  body: z.object({
    requestIds: z.array(z.coerce.number().int()).min(1),
    comment: z.string().max(1000).optional(),
  }),
});
