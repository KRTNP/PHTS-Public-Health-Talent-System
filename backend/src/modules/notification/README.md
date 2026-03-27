# Notification Module

## Purpose
`notification` handles user notification APIs and settings:
- list notifications
- mark read / clear read notifications
- unread count
- notification settings read/update

## Canonical File Locations (Phase 7)
- Route: `api/notification.route.ts`
- Controller: `api/notification.controller.ts`

Compatibility shims kept for import stability:
- `notification.routes.ts` -> re-exports `api/notification.route.ts`
- `notification.controller.ts` -> re-exports from `api/notification.controller.ts`

## High-Level Flow
- `api/notification.route.ts` handles auth + validation wiring
- `api/notification.controller.ts` orchestrates request/response
- `services/*.service.ts` contains notification logic
- `repositories/*.repository.ts` handles persistence/outbox access

## Guardrails
- Add new endpoints in canonical `api/notification.route.ts`.
- Keep shim files alias-only (re-export only).
- Keep notification policy/logic in service layer.

## Deferred
- deeper service decomposition only if needed by future change scope
