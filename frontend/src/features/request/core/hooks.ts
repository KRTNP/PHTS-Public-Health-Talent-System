/**
 * request module - React query hooks (barrel)
 */
"use client";

export {
  useApprovalHistory,
  useMyRequests,
  usePendingApprovals,
  useRequestDetail,
} from "./request.queries";

export {
  useCancelRequest,
  useCreateVerificationSnapshot,
  useProcessAction,
  useSubmitRequest,
} from "./request.mutations";

export {
  useEligibilityDetail,
  useEligibilityList,
  useEligibilityPaged,
  useEligibilitySummary,
} from "./eligibility.queries";

export {
  useDeactivateEligibility,
  useDeleteEligibilityAttachment,
  useReactivateEligibility,
  useSetPrimaryEligibility,
  useUploadEligibilityAttachments,
} from "./eligibility.mutations";

export {
  useClearEligibilityAttachmentOcr,
  useClearRequestAttachmentOcr,
  useRunEligibilityAttachmentsOcr,
  useRunRequestAttachmentsOcr,
} from "./ocr.hooks";

export {
  useMyScopeMembers,
  useMyScopes,
  usePersonnelOptions,
  usePrefill,
} from "./prefill-personnel-scope.hooks";
