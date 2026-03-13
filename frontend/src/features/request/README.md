# Request Feature Structure

This feature is organized by sub-domain and responsibility:

- `core/`: shared request domain logic (API hooks, constants, types, utilities)
- `create/`: request creation flow (wizard UI, form hooks, mapping)
- `detail/`: request detail view (cards, timeline, shell, detail utilities)

## Import Paths

Use the new structure directly:

- `@/features/request/core/api`
- `@/features/request/create/wizard/request-wizard`
- `@/features/request/detail/utils`
