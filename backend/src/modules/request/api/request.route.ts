/**
 * PHTS System - Request Routes
 *
 * API routes for PTS request management and workflow
 *
 * Date: 2025-12-30
 */

import { Router, type RequestHandler } from "express";
import { protect, restrictTo } from "@middlewares/authMiddleware.js";
import { idempotency } from "@middlewares/idempotency.js";
import { requestUpload } from "@config/upload-storage.js";
import { enforceUploadedFilesAreSafe } from "@config/upload-guard.js";
import { requestController } from "@/modules/request/api/request.controller.js";
import { validate } from "@shared/validate.middleware.js";
import {
  actionSchema,
  batchApproveCompatSchema,
  legacyActionAliasSchema,
  verificationSchema,
} from "@/modules/request/dto/update-status.dto.js"; // Use correct DTO file
import { verificationSnapshotSchema } from "@/modules/request/dto/verification-snapshot.dto.js";
import {
  requestAttachmentParamSchema,
  requestEligibilityAttachmentParamSchema,
  requestEligibilityAttachmentOcrSchema,
  requestEligibilityOcrClearSchema,
  requestAttachmentOcrSchema,
  requestOcrClearSchema,
  requestEligibilityIdParamSchema,
  requestEligibilityQuerySchema,
  requestHistoryQuerySchema,
  requestIdOrNoParamSchema,
  requestIdParamSchema,
  requestManualOcrSchema,
  requestOcrHistoryQuerySchema,
  requestRateMappingSchema,
  requestEligibilityManageSchema,
} from "@/modules/request/dto/request-params.dto.js";
import { UserRole } from "@/types/auth.js";
import { ActionType } from "@/modules/request/contracts/request.types.js";
// Note: createRequestSchema is used inside controller manually for file upload handling, or added here if middleware used.
// Current controller implementation handles validation manually after file upload.

const router = Router();
const requestActionRoles = [
  UserRole.HEAD_SCOPE,
  UserRole.PTS_OFFICER,
  UserRole.HEAD_HR,
  UserRole.DIRECTOR,
  UserRole.HEAD_FINANCE,
] as const;
const isLegacyActionEndpointsEnabled =
  String(process.env.REQUEST_ENABLE_LEGACY_ACTION_ENDPOINTS || "").toLowerCase() ===
  "true";

const applyLegacyEndpointWarning = (
  legacyPath: string,
): RequestHandler =>
  (req, res, next) => {
    res.setHeader(
      "X-Deprecated-Endpoint",
      `${legacyPath}; migrate to POST /api/requests/:id/action`,
    );
    console.warn(
      `[RequestRoute] legacy endpoint used: ${legacyPath} request_id=${String(req.params.id ?? "")}`,
    );
    next();
  };

const injectActionType = (action: ActionType): RequestHandler => (
  req,
  _res,
  next,
) => {
  req.body = {
    ...(req.body && typeof req.body === "object" ? req.body : {}),
    action,
  };
  next();
};
/**
 * All routes require authentication
 */
router.use(protect);

/**
 * User Routes
 * Available to all authenticated users
 */

router.get("/prefill", requestController.getPrefill);
router.get(
  "/personnel-options",
  restrictTo(UserRole.PTS_OFFICER),
  requestController.searchPersonnelOptions,
);

router.post(
  "/:id/rate-mapping",
  validate(requestRateMappingSchema),
  requestController.updateRateMapping,
);

router.post(
  "/:id/ocr-precheck/manual",
  restrictTo(UserRole.PTS_OFFICER),
  validate(requestManualOcrSchema),
  requestController.persistManualOcrPrecheck,
);

router.post(
  "/:id/attachments/ocr",
  restrictTo(UserRole.PTS_OFFICER),
  validate(requestAttachmentOcrSchema),
  requestController.runRequestAttachmentsOcr,
);

router.post(
  "/:id/ocr-precheck/clear",
  restrictTo(UserRole.PTS_OFFICER),
  validate(requestOcrClearSchema),
  requestController.clearRequestAttachmentOcr,
);

router.post(
  "/eligibility/:id/ocr-precheck/manual",
  restrictTo(UserRole.PTS_OFFICER),
  validate(requestManualOcrSchema),
  requestController.persistEligibilityManualOcrPrecheck,
);

router.post(
  "/eligibility/:eligibilityId/attachments/ocr",
  restrictTo(UserRole.PTS_OFFICER),
  validate(requestEligibilityAttachmentOcrSchema),
  requestController.runEligibilityAttachmentsOcr,
);

router.post(
  "/eligibility/:eligibilityId/ocr-precheck/clear",
  restrictTo(UserRole.PTS_OFFICER),
  validate(requestEligibilityOcrClearSchema),
  requestController.clearEligibilityAttachmentOcr,
);

// Confirm attachments (license file)
router.post(
  "/:id/attachments/confirm",
  validate(requestIdParamSchema),
  requestController.confirmAttachments,
);

// Create new request with file uploads and signature
router.post(
  "/",
  requestUpload.fields([
    { name: "files", maxCount: 10 },
    { name: "files[]", maxCount: 10 },
    { name: "license_file", maxCount: 1 },
    { name: "applicant_signature", maxCount: 1 },
  ]),
  enforceUploadedFilesAreSafe,
  idempotency(),
  requestController.createRequest,
);

// Get current user's requests
router.get("/", requestController.getMyRequests);

// Get user's available scopes (for multi-scope dropdown)
router.get(
  "/my-scopes",
  restrictTo(UserRole.HEAD_SCOPE),
  requestController.getMyScopes,
);

router.get(
  "/my-scopes/members",
  restrictTo(UserRole.HEAD_SCOPE),
  requestController.getMyScopeMembers,
);

// Get pending requests for approval (based on user's role)
// Optional query param: ?scope=<scope_name> to filter to a specific scope
router.get(
  "/pending",
  restrictTo(
    UserRole.HEAD_SCOPE,
    UserRole.PTS_OFFICER,
    UserRole.HEAD_HR,
    UserRole.DIRECTOR,
    UserRole.HEAD_FINANCE,
  ),
  requestController.getPendingApprovals,
);

router.get(
  "/eligibility",
  restrictTo(UserRole.PTS_OFFICER),
  validate(requestEligibilityQuerySchema),
  requestController.getEligibilityList,
);

router.get(
  "/eligibility/summary",
  restrictTo(UserRole.PTS_OFFICER),
  validate(requestEligibilityQuerySchema),
  requestController.getEligibilitySummary,
);

router.post(
  "/eligibility/:eligibilityId/attachments",
  restrictTo(UserRole.PTS_OFFICER),
  requestUpload.fields([
    { name: "files", maxCount: 10 },
    { name: "files[]", maxCount: 10 },
    { name: "license_file", maxCount: 1 },
  ]),
  enforceUploadedFilesAreSafe,
  validate(requestEligibilityIdParamSchema),
  requestController.uploadEligibilityAttachments,
);

router.delete(
  "/eligibility/:eligibilityId/attachments/:attachmentId",
  restrictTo(UserRole.PTS_OFFICER),
  validate(requestEligibilityAttachmentParamSchema),
  requestController.removeEligibilityAttachment,
);

router.get(
  "/eligibility/export",
  restrictTo(UserRole.PTS_OFFICER),
  validate(requestEligibilityQuerySchema),
  requestController.exportEligibilityCsv,
);

router.get(
  "/eligibility/:eligibilityId",
  restrictTo(UserRole.PTS_OFFICER),
  validate(requestEligibilityIdParamSchema),
  requestController.getEligibilityById,
);

router.post(
  "/eligibility/:eligibilityId/set-primary",
  restrictTo(UserRole.PTS_OFFICER),
  validate(requestEligibilityManageSchema),
  requestController.setPrimaryEligibility,
);

router.post(
  "/eligibility/:eligibilityId/deactivate",
  restrictTo(UserRole.PTS_OFFICER),
  validate(requestEligibilityManageSchema),
  requestController.deactivateEligibility,
);

router.post(
  "/eligibility/:eligibilityId/reactivate",
  restrictTo(UserRole.PTS_OFFICER),
  validate(requestEligibilityManageSchema),
  requestController.reactivateEligibility,
);

// Get approval history for current approver
router.get(
  "/history",
  restrictTo(
    UserRole.HEAD_SCOPE,
    UserRole.PTS_OFFICER,
    UserRole.HEAD_HR,
    UserRole.HEAD_FINANCE,
    UserRole.DIRECTOR,
  ),
  validate(requestHistoryQuerySchema),
  requestController.getHistory,
);

router.get(
  "/ocr-prechecks",
  restrictTo(UserRole.PTS_OFFICER),
  validate(requestOcrHistoryQuerySchema),
  requestController.getOcrPrecheckHistory,
);

// Get request details by ID or request_no
router.get(
  "/:id",
  validate(requestIdOrNoParamSchema),
  requestController.getRequestById,
);

// Update a request (Owner only, DRAFT or RETURNED status)
router.put(
  "/:id",
  validate(requestIdParamSchema),
  requestUpload.fields([
    { name: "files", maxCount: 10 },
    { name: "files[]", maxCount: 10 },
    { name: "license_file", maxCount: 1 },
    { name: "applicant_signature", maxCount: 1 },
  ]),
  enforceUploadedFilesAreSafe,
  requestController.updateRequest,
);

router.delete(
  "/:id/attachments/:attachmentId",
  validate(requestAttachmentParamSchema),
  requestController.removeRequestAttachment,
);

// Update verification checks (qualification/evidence)
router.put(
  "/:id/verification",
  restrictTo(UserRole.PTS_OFFICER, UserRole.HEAD_HR),
  validate(requestIdParamSchema),
  validate(verificationSchema),
  requestController.updateVerificationChecks,
);
router.post(
  "/:id/verification-snapshot",
  restrictTo(UserRole.PTS_OFFICER, UserRole.HEAD_HR),
  validate(requestIdParamSchema),
  validate(verificationSnapshotSchema),
  requestController.createVerificationSnapshot,
);

// Cancel a request (Owner only, before APPROVED)
router.post(
  "/:id/cancel",
  idempotency(),
  validate(requestIdParamSchema),
  requestController.cancelRequest,
);

// Canonical action endpoint (APPROVE / REJECT / RETURN).
router.post(
  "/:id/action",
  restrictTo(...requestActionRoles),
  validate(requestIdParamSchema),
  validate(actionSchema),
  requestController.processAction,
);

if (isLegacyActionEndpointsEnabled) {
  router.post(
    "/:id/approve",
    restrictTo(...requestActionRoles),
    applyLegacyEndpointWarning("/:id/approve"),
    injectActionType(ActionType.APPROVE),
    validate(requestIdParamSchema),
    validate(legacyActionAliasSchema),
    validate(actionSchema),
    requestController.processAction,
  );

  router.post(
    "/:id/reject",
    restrictTo(...requestActionRoles),
    applyLegacyEndpointWarning("/:id/reject"),
    injectActionType(ActionType.REJECT),
    validate(requestIdParamSchema),
    validate(legacyActionAliasSchema),
    validate(actionSchema),
    requestController.processAction,
  );

  router.post(
    "/:id/return",
    restrictTo(...requestActionRoles),
    applyLegacyEndpointWarning("/:id/return"),
    injectActionType(ActionType.RETURN),
    validate(requestIdParamSchema),
    validate(legacyActionAliasSchema),
    validate(actionSchema),
    requestController.processAction,
  );

  router.post(
    "/batch-approve",
    restrictTo(...requestActionRoles),
    applyLegacyEndpointWarning("/batch-approve"),
    validate(batchApproveCompatSchema),
    requestController.batchApproveCompat,
  );
}

// Submit a draft request
router.post(
  "/:id/submit",
  idempotency(),
  validate(requestIdParamSchema),
  requestController.submitRequest,
);

export default router;
