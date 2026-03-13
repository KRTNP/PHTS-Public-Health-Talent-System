# GitHub Production Setup

This repository is configured to run production gates on `main`:
- CI (`backend-test`, `frontend-build`)
- Snyk dependency scan
- CodeQL scan

## 1) Apply repository protection settings

Run:

```bash
cd /home/krtn/projects/phts
GH_TOKEN=<your_github_token> ./scripts/github/apply-production-repo-settings.sh KRTNP phts-uttaradit-hospital main
```

## 2) Configure repository secrets

Repository secrets:
- `CODECOV_TOKEN`
- `SNYK_TOKEN`

Environment secrets (for `production`):
- Any deployment/runtime secrets used by your self-hosted runner and deploy scripts

## 3) Configure branch rules in UI (verify)

In `Settings -> Branches -> Branch protection rules` for `main`, ensure:
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

This keeps `main` linear and aligned with `required_linear_history=true`.
