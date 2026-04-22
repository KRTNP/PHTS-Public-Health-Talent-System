# Windows Production Setup

Use this on the production Windows Server before the first deployment.

For moving an existing production deployment to a new Windows Server, see
[`docs/windows-server-migration.md`](../../docs/windows-server-migration.md).

## 1) Required software

- Node.js 20 LTS
- npm (comes with Node.js)
- MySQL client tools (`mysqldump` in PATH)
- NSSM
- GitHub self-hosted runner (labels: `self-hosted`, `windows`, `x64`)

## 2) Bootstrap the host

Run in an elevated PowerShell in the repo root:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\windows\bootstrap-production.ps1
```

If Node is installed in a non-default path:

```powershell
.\scripts\windows\bootstrap-production.ps1 -NodePath "C:\custom\node\node.exe"
```

## 3) Fill production env files

Edit:

- `D:\apps\phts\shared\backend\.env`
- `D:\apps\phts\shared\frontend\.env.local`

Important backup settings for Windows native:

```dotenv
BACKUP_COMMAND=C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe
BACKUP_ARGS=["-NoProfile","-ExecutionPolicy","Bypass","-File","src/scripts/ops/backup/backup.ps1"]
BACKUP_WORKDIR=D:\apps\phts\current\backend
```

## 4) Verify services and prerequisites

```powershell
nssm status PHTS-Backend
nssm status PHTS-Frontend
node -v
npm -v
mysqldump --version
```

## 5) First deploy

From GitHub Actions, run workflow:

- `Deploy Windows Production`
- `ref = main`

Then verify health:

```powershell
Invoke-WebRequest http://127.0.0.1:4000/health -UseBasicParsing
```
