# Notification Module

## Purpose
`notification` handles user notification APIs and settings:
- list notifications
- mark read / clear read notifications
- unread count
- notification settings read/update

## Canonical File Locations
- Route: `api/notification.route.ts`
- Controller: `api/notification.controller.ts`

Phase 12 shim status:
- legacy route/controller shim files retired after in-repo usage checks

## High-Level Flow
- `api/notification.route.ts` handles auth + validation wiring
- `api/notification.controller.ts` orchestrates request/response
- `services/*.service.ts` contains notification logic
- `repositories/*.repository.ts` handles persistence/outbox access

## Guardrails
- Add new endpoints in canonical `api/notification.route.ts`.
- Keep notification policy/logic in service layer.

## Deferred
- deeper service decomposition only if needed by future change scope
