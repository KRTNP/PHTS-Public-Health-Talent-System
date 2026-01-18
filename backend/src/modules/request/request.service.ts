/**
 * PHTS System - Request Service Layer (V2.0)
 *
 * Facade module that re-exports all request operations from sub-modules.
 *
 * Sub-modules:
 * - request.helpers.ts      - Shared utilities and SQL fragments
 * - request-query.service.ts    - Read operations
 * - request-command.service.ts  - Create/Submit operations
 * - request-approval.service.ts - Approval workflow
 */

// ============================================================================
// Re-export Query Operations
// ============================================================================
export {
  getMyRequests,
  getPendingForApprover,
  getApprovalHistory,
  getRequestById,
  getRequestDetails,
} from './request-query.service.js';

// ============================================================================
// Re-export Command Operations
// ============================================================================
export {
  getRecommendedRateForUser,
  createRequest,
  submitRequest,
} from './request-command.service.js';

// ============================================================================
// Re-export Approval Operations
// ============================================================================
export {
  approveRequest,
  rejectRequest,
  returnRequest,
  approveBatch,
  finalizeRequest,
} from './request-approval.service.js';

// ============================================================================
// Re-export Helpers (for external use if needed)
// ============================================================================
export {
  REQUESTER_FIELDS,
  REQUESTER_JOINS,
  generateRequestNo,
  parseJsonField,
  normalizeDateToYMD,
  mapRequestRow,
  getRequestLinkForRole,
  buildInClause,
  hydrateRequests,
} from './request.helpers.js';
