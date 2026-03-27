# Leave-Management Module

## Purpose
`leave-management` supports leave-related operational data used by people/payroll workflows:
- leave record list/personnel lookup
- leave extension updates
- quota status and return-report events
- leave document upload/list/delete

## Canonical File Locations (Phase 6)
- Route: `api/leave-management.route.ts`
- Controller: `api/leave-management.controller.ts`

Compatibility shims kept for import stability:
- `leave-management.routes.ts` -> re-exports `api/leave-management.route.ts`
- `controllers/leave-management.controller.ts` -> re-exports from `api/leave-management.controller.ts`

## High-Level Flow
- `api/leave-management.route.ts` handles auth + validation + upload wiring
- `api/leave-management.controller.ts` orchestrates request/response
- `services/*.service.ts` contains module logic
- `repositories/leave-management.repository.ts` handles data access

## Guardrails
- Add new endpoints in canonical `api/leave-management.route.ts`.
- Keep shim files as re-export only.
- Keep leave workflow/business rules in services, not routes/controllers.

## Deferred
- deeper controller/service decomposition if needed
- wider people-domain consolidation in a later phase
