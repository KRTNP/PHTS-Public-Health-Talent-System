# Announcement Module

## Purpose
`announcement` manages internal announcement CRUD and activation endpoints.

## Canonical File Locations (Phase 10)
- Route: `api/announcement.route.ts`
- Controller: `api/announcement.controller.ts`

Phase 11 shim status:
- removed `announcement.routes.ts`
- removed `announcement.controller.ts`
- no remaining in-repo imports/callers after canonical bootstrap wiring

## High-Level Flow
- `api/announcement.route.ts` maps endpoint + auth/role/validation.
- `api/announcement.controller.ts` orchestrates request payloads.
- `services/announcement.service.ts` handles write workflows.
- `repositories/announcement.repository.ts` handles query/storage.

## Guardrails
- Keep canonical ownership in `api/`.
- Preserve existing route contracts under `/api/announcements`.
