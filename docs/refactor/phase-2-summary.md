# Phase 2 Backend Cleanup Summary

## Scope
Phase 2 focused on low-risk backend cleanup guided by Phase 1 findings:
- baseline stabilization
- duplicate surface risk reduction
- authenticated user typing consistency
- entrypoint/bootstrap separation
- practical safety improvements without changing business behavior

## What Was Changed

### 1) Backend smoke command standardized
- Updated `backend/package.json`:
  - added `test:smoke` using the critical-path subset from Phase 1:
    - `src/modules/auth/__tests__/integration/auth.integration.test.ts`
    - `src/modules/request/services/__tests__/request-approval.flow.integration.test.ts`
    - `src/modules/payroll/services/__tests__/payroll-workflow.service.test.ts`
    - `src/__tests__/integration/api.integration.test.ts`
- Updated root `package.json`:
  - added `test:smoke:backend` alias to keep usage simple and explicit.

### 2) `test:perf` noisy failure policy fixed
- Updated `backend/package.json`:
  - `test:perf` now uses `jest --passWithNoTests src/__tests__/perf`
- Result: command is no longer red when perf tests are intentionally absent.

### 3) Request action surface parity protection added
- Added parity tests in:
  - `backend/src/modules/request/controllers/__tests__/request.controller.test.ts`
- New tests lock that unified and legacy endpoints delegate with identical arguments:
  - unified `POST /:id/action` (`APPROVE`, `REJECT`, `RETURN`)
  - legacy `POST /:id/approve|reject|return`
- Added compatibility notes in route file:
  - `backend/src/modules/request/request.routes.ts`

### 4) Authenticated user typing normalized in high-value controllers
- Added shared helper:
  - `backend/src/shared/http/authenticated-user.ts`
- Added helper tests:
  - `backend/src/shared/http/__tests__/authenticated-user.test.ts`
- Replaced unsafe `(req.user as any)` access in:
  - `backend/src/modules/payroll/payroll.controller.ts`
  - `backend/src/modules/master-data/master-data.controller.ts`
  - `backend/src/modules/notification/notification.controller.ts`
  - `backend/src/modules/leave-management/controllers/leave-management.controller.ts`
- Introduced `requireAuthenticatedUserId` where user ID is mandatory and `getAuthenticatedUserId/getAuthenticatedUserRole` where nullable/optional behavior is acceptable.

### 5) Incremental `src/index.ts` bootstrap split
- Added:
  - `backend/src/bootstrap/app.ts` (app creation + middleware + route registration)
  - `backend/src/bootstrap/workers.ts` (start/stop background workers)
  - `backend/src/bootstrap/process-handlers.ts` (signal/exception/rejection wiring)
- Reworked:
  - `backend/src/index.ts` now acts as thin orchestrator:
    - env load
    - app construction
    - startup (DB check + workers + listen)
    - shutdown registration
- External behavior preserved (same route surface, startup gating, maintenance flow, worker startup/shutdown sequence).

## What Was Intentionally Not Changed
- No module/folder reorganization.
- No endpoint removals (legacy request action endpoints remain for compatibility).
- No business workflow logic changes in request/payroll state transitions.
- No public API contract changes.
- No deep controller decomposition yet (large controllers remain, but risk controls improved).

## Risks Reduced In Phase 2
- **Baseline drift risk reduced**:
  - backend now has an explicit `test:smoke` command.
- **False-negative CI noise reduced**:
  - `test:perf` no longer fails when perf tests are absent.
- **Duplicate action surface drift risk reduced**:
  - parity tests now lock unified/legacy delegation behavior.
- **Typing/runtime assumption risk reduced**:
  - centralized authenticated-user helper removed several `any`-based access patterns.
- **Bootstrap coupling risk reduced**:
  - startup concerns split into focused bootstrap modules with clearer ownership.

## Remaining Debt For Phase 3+
- Large controllers (`request`, `payroll`) still need careful decomposition into smaller units.
- Legacy endpoint surface remains; deprecation/migration plan still needed before removal.
- Broader adoption of authenticated-user helper across all backend modules can be completed.
- Additional startup test coverage for bootstrap modules can be added (optional but useful).
- Further runtime/worker isolation (if desired) should be done incrementally with contract tests.

## Verification Commands (Phase 2)
Commands run for this phase:
- `cd backend && npm run typecheck` ✅
- `cd backend && npm run lint` ✅
- `cd backend && npm run test:smoke` ✅
- `cd backend && npm test` ✅

Additional targeted checks run during implementation:
- `cd backend && npm test -- src/modules/request/controllers/__tests__/request.controller.test.ts` ✅
- `cd backend && npm test -- src/shared/http/__tests__/authenticated-user.test.ts src/modules/request/controllers/__tests__/request.controller.test.ts` ✅
