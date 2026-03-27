# Access Review Module

## Purpose
`access-review` provides admin-only review-cycle endpoints for periodic access governance.

## Canonical File Locations (Phase 10)
- Route: `api/access-review.route.ts`
- Controller: `api/access-review.controller.ts`

Phase 11 shim status:
- removed `access-review.routes.ts`
- removed `access-review.controller.ts`
- test imports moved to canonical `api/` path before retirement

## High-Level Flow
- `api/access-review.route.ts` applies auth/role + schema validation.
- `api/access-review.controller.ts` handles request parsing/response mapping.
- `services/access-review.service.ts` contains cycle/review queue logic.
- `repositories/access-review.repository.ts` contains persistence queries.

## Guardrails
- Keep canonical ownership in `api/`.
- Keep ADMIN access control at route level.
