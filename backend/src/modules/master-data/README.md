# Master-Data Module

## Purpose
`master-data` manages:
- holiday CRUD used by payroll/request timelines
- master rate CRUD and lookup data for request rate selection

## Canonical File Locations (Phase 5)
- Route: `api/master-data.route.ts`
- Controller: `api/master-data.controller.ts`

Compatibility shims kept for import stability:
- `master-data.routes.ts` -> re-exports `api/master-data.route.ts`
- `master-data.controller.ts` -> re-exports from `api/master-data.controller.ts`

## High-Level Flow
- `api/master-data.route.ts` handles auth + validation wiring
- `api/master-data.controller.ts` orchestrates request/response
- `services/*.service.ts` contains business logic
- `repositories/master-data.repository.ts` handles persistence

## Guardrails
- Keep new HTTP endpoints in `api/master-data.route.ts`.
- Keep shim files as re-export only.
- Avoid adding request-domain business logic to this module.

## Deferred
- deeper service decomposition if needed
- wider people-domain consolidation (later phase)
