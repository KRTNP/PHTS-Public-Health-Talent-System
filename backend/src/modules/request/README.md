# Request Module

## Purpose
`request` is the core workflow module for allowance request lifecycle:
- create/update/cancel/submit request
- approval actions (approve/reject/return)
- eligibility management and exports

## Current Route Surface (High-Level)
Mounted under `/api/requests`.

Canonical action endpoint:
- `POST /:id/action` with `{ action: APPROVE|REJECT|RETURN, ... }`

## Canonical File Locations
- Route: `api/request.route.ts`
- Controller: `api/request.controller.ts`

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
  - keeps canonical action handling through one dispatch path
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

## Action Endpoint Notes
- Canonical endpoint for request actions is `POST /:id/action`.
- Non-canonical action aliases and batch-approve compatibility routes were removed.
- Temporary compatibility mode can be re-enabled via
  `REQUEST_ENABLE_LEGACY_ACTION_ENDPOINTS=true` to expose:
  - `POST /:id/approve`
  - `POST /:id/reject`
  - `POST /:id/return`
  - `POST /batch-approve`

## Guardrails For Contributors
- Keep HTTP wiring in `api/` files.
- Keep controllers orchestration-focused; place parsing/mapping helpers in purpose-specific files.
- Do not add new business logic to compatibility shim files.
- Avoid cross-module repository access directly from controllers.

## Deferred To Later Phases
- deeper decomposition of large request controller/service flows
- broader folder cleanup across request subdomains (`data/read/scope`)
