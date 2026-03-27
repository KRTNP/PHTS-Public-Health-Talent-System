# Navigation Module

## Purpose
`navigation` builds role-aware navigation payloads for authenticated users.

## Canonical File Locations (Phase 11)
- Route: `api/navigation.route.ts`
- Controller: `api/navigation.controller.ts`

Phase 11 shim status:
- removed `routes/navigation.routes.ts`
- removed `controllers/navigation.controller.ts`
- no remaining in-repo shim callers after canonical bootstrap wiring

## High-Level Flow
- `api/navigation.route.ts` maps endpoint + auth middleware.
- `api/navigation.controller.ts` validates authenticated user context and returns navigation payload.
- `services/navigation.service.ts` composes menu/permission data.

## Guardrails
- Keep route/controller ownership in `api/`.
- Prefer canonical `api/` imports for all internal references.
