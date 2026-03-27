# System Admin Module

## Purpose
`system/admin` provides admin-only operational endpoints (user role management, maintenance mode, job status, outbox retries).

## Canonical File Locations (Phase 11)
- Route: `api/admin.route.ts`
- Controller: `api/admin.controller.ts`

Phase 12 shim status:
- legacy route/controller shim files retired after in-repo usage checks

## High-Level Flow
- `api/admin.route.ts` applies auth/ADMIN guard and validation.
- `api/admin.controller.ts` orchestrates admin/system operations.
- services/repositories remain unchanged in this phase.

## Guardrails
- Keep operational endpoint behavior stable.
- Keep internal imports pointed to canonical `api/` files.
