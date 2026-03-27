# Leave-Management Module

## Purpose
`leave-management` supports leave-related operational data used by people/payroll workflows:
- leave record list/personnel lookup
- leave extension updates
- quota status and return-report events
- leave document upload/list/delete

## Canonical File Locations
- Route: `api/leave-management.route.ts`
- Controller: `api/leave-management.controller.ts`

Phase 12 shim status:
- legacy route/controller shim files retired after in-repo usage checks

## High-Level Flow
- `api/leave-management.route.ts` handles auth + validation + upload wiring
- `api/leave-management.controller.ts` orchestrates request/response
- `services/*.service.ts` contains module logic
- `repositories/leave-management.repository.ts` handles data access

## Guardrails
- Add new endpoints in canonical `api/leave-management.route.ts`.
- Keep leave workflow/business rules in services, not routes/controllers.

## Deferred
- deeper controller/service decomposition if needed
- wider people-domain consolidation in a later phase
