# Testing Policy

This project prioritizes tests that protect business-critical behavior over high test volume.

## Keep/Add Tests For

- Business rules and calculations (money, eligibility, quotas, payroll, approval outcomes).
- Permission and role-based access decisions.
- Status transitions and workflow lifecycle behavior.
- Integration boundaries (API contracts, repository behavior, timeline rendering for core request flows).
- Regression coverage for production bugs (every fixed bug should have a targeted test).

## Avoid Adding Tests For

- Thin wrappers, trivial mappers, and pure formatting helpers with low business risk.
- UI cosmetic details that are likely to change (classes, non-critical labels, minor presentational text).
- Duplicate tests that assert the same behavior at multiple layers without additional risk reduction.

## Frontend Smoke Baseline

CI must keep a fast smoke suite for key request flows:

- officer leave-management integration flow
- request approval timeline flow
- officer-created request timeline flow
- request creation form flow

Current command:

```bash
npm run test:smoke --prefix frontend
```

## Definition of Done (Testing)

- `lint` and `typecheck` must pass for changed apps.
- Smoke tests must pass for frontend flow changes.
- Add/adjust tests only where risk justifies maintenance cost.
