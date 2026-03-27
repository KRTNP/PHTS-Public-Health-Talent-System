# Health Module

## Purpose
`health` serves root/public operational endpoints:
- `/`
- `/robots.txt`
- `/health`
- `/ready`
- `/sitemap.xml`

## Canonical File Locations (Phase 9)
- Route: `api/health.route.ts`
- Controller: `api/health.controller.ts`

Phase 10 shim status:
- legacy shim files were retired:
  - removed `routes/health.routes.ts`
  - removed `controllers/health.controller.ts`
- proof used:
  - repository usage scan showed no remaining in-repo callers

## High-Level Flow
- `api/health.route.ts` maps HTTP paths.
- `api/health.controller.ts` composes payloads and readiness responses.
- `services/health.service.ts` performs dependency checks/payload generation.

## Guardrails
- Keep canonical ownership in `api/`.
- Keep public-path behavior stable (used by smoke/integration checks).
