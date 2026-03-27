# Payroll Module

## Purpose
Manages payroll period lifecycle, payroll calculation, payout review, and approval workflow.

## High-Level Flow
1. Route layer receives request (`api/payroll.route.ts`).
2. Controller layer orchestrates HTTP behavior (`api/payroll.controller.ts`).
3. Service/facade layer coordinates workflows (`services/facade/*`).
4. Workflow/calculation services execute period state transitions and calculations.
5. Repository layer persists and queries payroll data.

## Folder Responsibilities
- `api/`: canonical HTTP route/controller files for payroll.
- `services/`: business/application logic (facade, workflow, calculation, import, shared).
- `repositories/`: DB queries for periods/payouts/search.
- `core/`: calculation primitives and domain-specific computation helpers.
- `dto/`, `entities/`, `payroll.schema.ts`: contracts, types, validation.

## Compatibility Notes
- `payroll.routes.ts` and `payroll.controller.ts` are compatibility shims.
- Canonical files are:
  - `api/payroll.route.ts`
  - `api/payroll.controller.ts`
- Shims should remain until external imports are migrated.

## Deferred Work
- Decompose large controller actions into narrower controller/service units.
- Consolidate naming in deeper service/repository folders if needed.
- Revisit domain boundaries with finance/reporting in later phases.
