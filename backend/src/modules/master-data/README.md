# Master-Data Module

## Purpose
`master-data` manages:
- holiday CRUD used by payroll/request timelines
- master rate CRUD and lookup data for request rate selection

## Canonical File Locations
- Route: `api/master-data.route.ts`
- Controller: `api/master-data.controller.ts`

Phase 12 shim status:
- legacy route/controller shim files retired after test imports were moved to canonical `api/` paths

## High-Level Flow
- `api/master-data.route.ts` handles auth + validation wiring
- `api/master-data.controller.ts` orchestrates request/response
- `services/*.service.ts` contains business logic
- `repositories/master-data.repository.ts` handles persistence

## Guardrails
- Keep new HTTP endpoints in `api/master-data.route.ts`.
- Avoid adding request-domain business logic to this module.

## Deferred
- deeper service decomposition if needed
- wider people-domain consolidation (later phase)
