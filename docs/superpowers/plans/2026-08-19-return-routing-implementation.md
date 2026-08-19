# Approval Return Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans (recommended). Steps use checkbox syntax for tracking.

**Goal:** Route downstream returns through PTS, preserve the originating approval step, and send requests to applicants only when PTS determines applicant correction is required.

**Architecture:** Keep `RETURNED` for compatibility and add server-owned routing metadata to the request row. Store the same route on approval history; derive legal targets from step and effective actor role, never from client input. Update backend queues and frontend timeline/actions to consume explicit routing.

**Tech Stack:** TypeScript, Express, MySQL/MariaDB, mysql2, Jest, Next.js/React, TanStack Query.

---

### Task 1: Freeze the workflow contract in tests

**Files:** `backend/src/modules/request/services/__tests__/request-approval.flow.integration.test.ts`, `backend/src/test/test-db.ts`

- [ ] Add nullable `return_target`, `return_from_step`, and `return_to_step` to test request schema; add `actor_role` and the same route fields to test approval schema.
- [ ] Add cases for `HEAD_HR(4) RETURN → PTS(3)`, `PTS APPROVE → step 4`, `PTS RETURN → applicant`, `USER submit → PTS(3)`, and equivalent step 5/6 returns.
- [ ] Assert history route fields, required non-blank return comments, notifications, legacy null metadata, unauthorized actions, and rejection terminality.
- [ ] Run `cd backend && npm test -- --runInBand src/modules/request/services/__tests__/request-approval.flow.integration.test.ts`; record failures before implementation.

### Task 2: Add database and typed domain support

**Files:** `backend/src/scripts/db/migrations/active/phase30_return_routing.sql`, `backend/src/modules/request/contracts/request.types.ts`, `backend/src/modules/request/contracts/request.entity.ts`, `backend/src/modules/request/data/repositories/request.repository.ts`

- [ ] Confirm the migration runner with `backend/src/scripts/db/setup.ts`; it applies sorted `.sql` files from `backend/src/scripts/db/migrations/active/`. Create `phase30_return_routing.sql` because the active directory currently has no phase files.
- [ ] Add nullable request columns `return_target VARCHAR(20)`, `return_from_step INT`, `return_to_step INT` and index `(status, return_target, current_step)` in `phase30_return_routing.sql`; make the SQL safe for the current setup runner and document that it is a one-time migration.
- [ ] Add nullable approval columns `actor_role VARCHAR(50)`, `return_target VARCHAR(20)`, `return_from_step INT`, `return_to_step INT`.
- [ ] Add typed `ReturnTarget = 'APPLICANT' | 'PTS_OFFICER'` and `ReturnRouting` fields; normalize legacy `RETURNED` null target as applicant at read/authorization boundaries.
- [ ] Update `RequestSubmissionEntity` and `RequestApprovalEntity`, then update every repository read/write, detail mapping, queue query, and approval-history join that currently selects `req_submissions` or `req_approvals`.
- [ ] Run backend typecheck and repository integration tests before service changes.

### Task 3: Implement server-owned transitions

**Files:** `backend/src/modules/request/services/approval.service.ts`, `backend/src/modules/request/services/command.service.ts`, `backend/src/modules/request/dto/update-status.dto.ts`, `backend/src/modules/request/services/__tests__/request-approval.flow.integration.test.ts`

- [ ] Add table-driven tests and a pure resolver: PTS returns to applicant; step 4/5/6 downstream roles return to PTS; invalid role/step pairs fail.
- [ ] Require a trimmed non-empty comment for `RETURN` in the server schema.
- [ ] In `returnRequest`, derive target server-side, write history plus request metadata, and notify PTS or applicant accordingly.
- [ ] Allow PTS to approve only a `RETURNED` request targeted to PTS at step 3; resume at `return_from_step`, clear active route fields, and notify the originating downstream role.
- [ ] Allow PTS to return an internal request to applicant while preserving the original downstream step as the resume destination.
- [ ] On applicant edit/resubmit, retain origin and resume at PTS step 3; after PTS approval resume at the stored downstream step (direct PTS return resumes at step 4).
- [ ] Preserve existing signature rules for approve, prevent self-approval, and keep reject terminal.
- [ ] Run the focused approval-flow integration tests.

### Task 4: Update queues, notifications, and API output

**Files:** `backend/src/modules/request/data/repositories/request.repository.ts`, `backend/src/modules/request/read/services/query.service.ts`, `backend/src/modules/notification/services/notification.service.ts`, existing request/notification integration tests

- [ ] PTS queue must include `PENDING/current_step=3` OR `RETURNED/return_target=PTS_OFFICER/current_step=3`.
- [ ] Applicant editability must require `DRAFT` or applicant-targeted `RETURNED`; legacy null target is applicant.
- [ ] Return request detail/history fields and effective actor role; never expose a client-controlled target as authoritative.
- [ ] Test downstream return notification to PTS, PTS applicant notification, and PTS resume notification to original downstream role.

### Task 5: Update frontend action and history views

**Files:** `frontend/src/types/request.types.ts`, PTS queue/detail pages, generic approval action flow/dialog, `frontend/src/features/request/detail/timeline/ApprovalTimelineCard.tsx`, `TimelineStepItem.tsx`, related tests

- [ ] Add nullable route fields to frontend request/action types.
- [ ] Show internal-return requests in PTS queue and label them “ส่งกลับให้ PTS ตรวจซ้ำ”.
- [ ] Make downstream dialog explain that RETURN goes to PTS; let PTS distinguish recheck/approve from return-to-applicant.
- [ ] Render route history using stored from/to steps and actor role, including repeated cycles.
- [ ] Run frontend tests, lint, and typecheck.

### Task 6: Full verification and review

**Files:** all changed files and tests

- [ ] Run focused backend tests, backend lint/typecheck, frontend tests, frontend lint/typecheck.
- [ ] Run the full relevant test suites and inspect failures against pre-existing dirty changes.
- [ ] Review diff against every design invariant; verify no unrelated `main` changes entered the feature branch.
- [ ] Commit schema/types, backend transitions, queue/notification, and frontend changes as separate imperative commits.
