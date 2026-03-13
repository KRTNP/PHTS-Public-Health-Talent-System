# GitHub Production Setup (Team of 3)

This repository is configured to run gates on both `main` and `dev`:
- CI (`backend-test`, `frontend-build`)
- Snyk dependency scan
- CodeQL scan

## 1) Apply repository protection settings

Run:

```bash
cd /home/krtn/projects/phts
GH_TOKEN=<your_github_token> ./scripts/github/apply-production-repo-settings.sh KRTNP phts-uttaradit-hospital
```

## 2) Configure repository secrets

Repository secrets:
- `CODECOV_TOKEN`
- `SNYK_TOKEN`

Environment secrets (for `production`):
- Any deployment/runtime secrets used by your self-hosted runner and deploy scripts

## 3) Configure branch rules in UI (verify)

In `Settings -> Branches -> Branch protection rules` for both `main` and `dev`, ensure:
- Require a pull request before merging
- Require approvals: `1`
- Require review from Code Owners
- Dismiss stale reviews
- Require conversation resolution
- Require linear history
- Do not allow force pushes
- Do not allow deletions

## 4) Configure environments

In `Settings -> Environments`:
- `staging`
- `production`

For `production`, add optional required reviewers if you want manual deployment approvals.

## 5) Merge policy

Recommended:
- Squash merge enabled
- Rebase merge disabled
- Merge commit disabled

This keeps `main`/`dev` linear and aligned with `required_linear_history=true`.

## 6) Team workflow

- `main` = production only
- `dev` = integration branch
- `feature/*`, `fix/*`, `chore/*` = short-lived work branches
- `hotfix/*` = urgent fixes from `main`

Flow:
1. Branch from `dev`
2. Open PR into `dev`
3. After QA/UAT, open PR `dev -> main`
4. Deploy from `main` only

- smoke run 20260313-151221
