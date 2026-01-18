/**
 * PHTS System - Request Service Layer (V2.0)
 *
 * Facade module that re-exports all request operations from sub-modules.
 */

// Re-export from services
export {
  // Helpers
  REQUESTER_FIELDS,
  REQUESTER_JOINS,
  generateRequestNo,
  parseJsonField,
  normalizeDateToYMD,
  mapRequestRow,
  getRequestLinkForRole,
  buildInClause,
  hydrateRequests,
  // Query operations
  getMyRequests,
  getPendingForApprover,
  getApprovalHistory,
  getRequestById,
  getRequestDetails,
  // Command operations
  getRecommendedRateForUser,
  createRequest,
  submitRequest,
  // Approval operations
  approveRequest,
  rejectRequest,
  returnRequest,
  approveBatch,
  finalizeRequest,
} from './services/index.js';

// Re-export from classification
export {
  findRecommendedRate,
  createEligibility,
} from './classification/index.js';

// Re-export from scope
export {
  getScopeFilterForApprover,
  getScopeFilterForSelectedScope,
  canApproverAccessRequest,
  canSelfApprove,
  isRequestOwner,
} from './scope/index.js';
