# Support Module

## Purpose
`support` provides support-ticket APIs for internal users:
- create/list/get tickets
- ticket messaging with attachments
- status updates and close/reopen flows

## Canonical File Locations (Phase 8)
- Route: `api/support.route.ts`
- Controller: `api/support.controller.ts`

Phase 10 shim status:
- legacy shim files were retired after usage migration:
  - removed `support.routes.ts`
  - removed `support.controller.ts`
- proof used:
  - test import moved to canonical `api/support.controller.ts`
  - repository usage scan showed no remaining in-repo callers

## High-Level Flow
- `api/support.route.ts` handles auth, role checks, validation, upload wiring
- `api/support.controller.ts` orchestrates request/response
- `services/support.service.ts` contains business logic
- `repositories/support.repository.ts` handles data access

## Guardrails
- Add new endpoints to canonical `api/support.route.ts`.
- Keep canonical imports pointed to `api/` files.
- Keep permission/business rules in service layer where practical.

## Deferred
- deeper decomposition of ticket permission checks if needed in future phases
