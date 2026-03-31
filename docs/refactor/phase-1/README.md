# Frontend Refactor Phase 1

This folder contains the working prompts and tracking files for the frontend Phase 1 refactor.

## Scope of Phase 1
- Phase 1A: unify duplicated `head-hr` and `head-finance` dashboard pages.
- Phase 1B: unify duplicated `head-hr` and `head-finance` requests pages.

## Primary goal
- remove high-confidence UI duplication first
- preserve current routes and behavior
- avoid redesign or backend changes

## Files in this folder
- `codex-prompt-phase-1a-dashboard.md` — prompt for shared approver dashboard extraction
- `codex-prompt-phase-1b-requests.md` — prompt for shared approver requests page extraction
- `STATUS.md` — running status by phase / task
- `DECISIONS.md` — assumptions, tradeoffs, and architectural decisions
- `HANDOFF.md` — latest summary for follow-up review

## Expected workflow
1. Run the relevant Codex prompt.
2. After the run, update `STATUS.md`, `DECISIONS.md`, and `HANDOFF.md`.
3. In the next review round, ask ChatGPT to read these docs before continuing.

## Rules for this phase
- keep route paths unchanged
- preserve visible behavior
- prefer config-driven differences
- do not broaden scope into unrelated roles or backend work
