# Request Module

## Purpose
`request` is the core workflow module for allowance request lifecycle:
- create/update/cancel/submit request
- approval actions (approve/reject/return)
- reassignment
- eligibility management and exports

## Current Route Surface (High-Level)
Mounted under `/api/requests`.

Canonical action endpoint:
- `POST /:id/action` with `{ action: APPROVE|REJECT|RETURN, ... }`

Legacy compatibility endpoints:
- `POST /:id/approve`
- `POST /:id/reject`
- `POST /:id/return`

Current policy:
- keep legacy endpoints for compatibility
- all action behavior must remain parity-aligned with `/:id/action`
- canonical and legacy action handlers should use the same action dispatch helper

## Canonical File Locations (Phase 4)
- Route: `api/request.route.ts`
- Controller: `api/request.controller.ts`

Compatibility shims kept for import stability:
- `request.routes.ts` -> re-exports `api/request.route.ts`
- `controllers/request.controller.ts` -> re-exports from `api/request.controller.ts`

## Thin Extractions Added in Phase 4
To reduce controller clutter without behavior changes:
- `api/helpers/request-query.helper.ts`
  - query string normalization
  - eligibility filter parsing
  - positive integer parsing
- `api/helpers/request-action.helper.ts`
  - unified signature decoding for action endpoints
- `api/helpers/eligibility-csv.helper.ts`
  - CSV row mapping + filename generation for eligibility export

## Additional Thin Extractions Added in Phase 5
- `api/helpers/request-action-dispatcher.helper.ts`
  - central action delegation for `APPROVE` / `REJECT` / `RETURN`
  - keeps unified and legacy action handlers aligned through one dispatch path
- `api/helpers/request-upload-files.helper.ts`
  - shared request upload file collection for create/update flows

## Additional Thin Extractions Added in Phase 6
- `api/helpers/request-param-resolver.helper.ts`
  - request ID resolution (`id` or request number) extracted from controller
  - shared finite-number param parsing with consistent validation errors
- `api/helpers/request-eligibility-export-filter.helper.ts`
  - dedicated eligibility export filter normalization for CSV export path
- `api/helpers/request-action-dispatcher.helper.ts` tests
  - explicit dispatch/parity coverage in
    `api/helpers/__tests__/request-action-dispatcher.helper.test.ts`
- `api/helpers/request-upload-files.helper.ts` extended
  - added eligibility attachment upload file collection helper

## Additional Thin Decomposition Added in Phase 7
- `services/approval.service.ts`
  - extracted shared policy/orchestration helpers for:
    - pending-request loading
    - effective approver role resolution by step
    - scope-permission check reuse
  - reduced repeated logic across `approveRequest` / `rejectRequest` / `returnRequest`

## Legacy Endpoint Deprecation Notes
Canonical endpoint for request actions is `POST /:id/action`.

Legacy endpoints remain temporary compatibility surface and must not diverge.
Removal conditions for a later phase (Phase 6+):
1. usage verification shows no active legacy consumers (or consumers migrated)
2. parity tests for unified/legacy action delegation and shared dispatcher remain green
3. compatibility window and release notes are completed

Phase 7 decision:
- Legacy endpoints are retained because repo inspection shows active frontend callers in
  `frontend/src/features/request/core/api.ts`.
- Canonical endpoint ownership remains `POST /:id/action`.
- Legacy endpoints must stay alias-only and delegate via shared dispatcher path.

## Guardrails For Contributors
- Keep HTTP wiring in `api/` files.
- Keep controllers orchestration-focused; place parsing/mapping helpers in purpose-specific files.
- Do not add new business logic to compatibility shim files.
- Avoid cross-module repository access directly from controllers.

## Deferred To Later Phases
- deeper decomposition of large request controller/service flows
- endpoint surface consolidation after deprecation window
- broader folder cleanup across request subdomains (`data/read/reassign/scope`)
