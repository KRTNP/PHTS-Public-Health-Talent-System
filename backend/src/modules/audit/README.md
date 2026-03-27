# Audit Module

## Purpose
`audit` provides admin-only audit-trail APIs for event search, summary, export, and entity history reads.

## Canonical File Locations (Phase 9)
- Route: `api/audit.route.ts`
- Controller: `api/audit.controller.ts`

Phase 10 shim status:
- legacy shim files were retired:
  - removed `audit.routes.ts`
  - removed `audit.controller.ts`
- proof used:
  - controller test import moved to canonical `api/audit.controller.ts`
  - repository usage scan showed no remaining in-repo callers

## High-Level Flow
- `api/audit.route.ts` handles auth/role guard + validation wiring.
- `api/audit.controller.ts` parses request filters and maps HTTP responses.
- `services/audit.service.ts` contains audit business/use-case orchestration.
- `repositories/audit.repository.ts` handles persistence queries.

## Guardrails
- Keep admin role gating in route layer.
- Add future endpoints to canonical `api/` files first.
