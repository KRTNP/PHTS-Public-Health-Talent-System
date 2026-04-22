# ย้าย Production Deployment ไป Windows Server เครื่องใหม่

เอกสารนี้อธิบายการย้าย PHTS production deployment จากเครื่องเดิมไปยัง Windows Server เครื่องใหม่ โดยอิงจาก deployment flow ที่มีอยู่ใน repo:

- GitHub Actions สร้าง production artifact
- Self-hosted Windows runner รับ artifact แล้วรัน `scripts/windows/deploy.ps1`
- ตัว app รันด้วย NSSM เป็น Windows services
- IIS ทำ reverse proxy ไปยัง frontend/backend ที่รันอยู่ในเครื่อง

## 1. สถาปัตยกรรมที่ใช้อยู่

บน production host จะมี layout ประมาณนี้:

```text
D:\apps\phts\
  current\                  # junction ไป release ล่าสุด
  releases\
    rel-<run>-<sha>\
      backend\
      frontend\
  shared\
    backend\.env
    frontend\.env.local
  logs\
    backend\stdout.log
    backend\stderr.log
    frontend\stdout.log
    frontend\stderr.log
  iis\site\web.config       # ถ้าตั้ง IIS reverse proxy แล้ว
```

Services หลัก:

- `PHTS-Backend`: รัน `node dist/index.js` จาก `D:\apps\phts\current\backend`
- `PHTS-Frontend`: รัน `node_modules\next\dist\bin\next start -p 3000` จาก `D:\apps\phts\current\frontend`

Ports เริ่มต้น:

- Backend: `127.0.0.1:4000`
- Frontend: `127.0.0.1:3000`
- IIS: port `80` และควรเพิ่ม TLS binding port `443`

## 2. สิ่งที่ต้องเตรียมบน Server ใหม่

ติดตั้ง software เหล่านี้ก่อน:

- Windows Server
- Node.js 20 LTS หรือใหม่กว่า
- npm
- NSSM และต้องเรียก `nssm` จาก PowerShell ได้
- MySQL หรือ network access ไปยัง MySQL production
- Redis หรือ network access ไปยัง Redis production
- MySQL client tools เช่น `mysqldump`
- IIS
- IIS URL Rewrite
- IIS Application Request Routing (ARR) ถ้าจะใช้ IIS reverse proxy
- GitHub self-hosted runner ถ้าจะ deploy ผ่าน GitHub Actions

ตรวจสอบ command พื้นฐาน:

```powershell
node -v
npm -v
nssm
mysqldump --version
```

## 3. เตรียม Repository และ Runner

ถ้าจะใช้ GitHub Actions deployment เดิม ให้ติดตั้ง GitHub self-hosted runner บน server ใหม่ และตั้ง label ให้ตรงกับ workflow:

```text
self-hosted
windows
x64
```

Workflow ที่ใช้ deploy คือ:

```text
.github/workflows/deploy-windows.yml
```

Deploy job จะรันบน:

```yaml
runs-on: [self-hosted, windows, x64]
```

ถ้ามี runner เครื่องเดิมอยู่และไม่ต้องการให้ deploy ไปเครื่องเดิมอีก ให้หยุด service runner เดิม หรือถอด label/environment ออกจาก runner เดิมก่อน deploy ครั้งแรกบน server ใหม่

## 4. Bootstrap Production Directory

บน server ใหม่ ให้เปิด PowerShell แบบ Administrator แล้วไปที่ repo root:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\windows\bootstrap-production.ps1 -BaseDir "D:\apps\phts"
```

ถ้า Node.js อยู่ path อื่น:

```powershell
.\scripts\windows\bootstrap-production.ps1 `
  -BaseDir "D:\apps\phts" `
  -NodePath "C:\Program Files\nodejs\node.exe"
```

สคริปต์นี้จะ:

- สร้าง directory layout ใต้ `D:\apps\phts`
- สร้างไฟล์ env ใน `shared`
- register/update NSSM services
- ตั้ง stdout/stderr logs ให้ service

## 5. ตั้งค่า Environment

แก้ไฟล์เหล่านี้บน server ใหม่:

```text
D:\apps\phts\shared\backend\.env
D:\apps\phts\shared\frontend\.env.local
```

ค่าหลักของ backend:

```dotenv
NODE_ENV=production
PORT=4000
START_SERVER=true
APP_TIMEZONE=Asia/Bangkok
TZ=Asia/Bangkok

FRONTEND_URL=https://your-domain.example
BACKEND_URL=https://your-domain.example

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=...
DB_PASSWORD=...
DB_NAME=phts_system
DB_TIMEZONE=+07:00

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

JWT_SECRET=replace-with-long-random-secret
JWT_EXPIRES_IN=24h
```

ค่าหลักของ frontend:

```dotenv
NEXT_PUBLIC_API_URL=https://your-domain.example/api
```

ถ้าเปิด backup job บน Windows native:

```dotenv
BACKUP_COMMAND=C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe
BACKUP_ARGS=["-NoProfile","-ExecutionPolicy","Bypass","-File","src/scripts/ops/backup/backup.ps1"]
BACKUP_WORKDIR=D:\apps\phts\current\backend
BACKUP_DIR=D:\apps\phts\shared\backups
BACKUP_RETENTION_DAYS=14
```

อย่า commit ค่า production secrets กลับเข้า repo

## 6. ย้าย Database และไฟล์ Shared Data

ถ้า database อยู่บน server เดิมและต้องย้ายมาด้วย ให้ dump จากเครื่องเดิม:

```powershell
cmd /c "mysqldump -h 127.0.0.1 -P 3306 -u <user> -p --single-transaction --routines --triggers phts_system > D:\backup\phts_system.sql"
```

นำไฟล์ dump ไป server ใหม่ แล้ว import:

```powershell
cmd /c "mysql -h 127.0.0.1 -P 3306 -u <user> -p phts_system < D:\backup\phts_system.sql"
```

ตรวจสอบเพิ่มเติมว่าระบบมีไฟล์ runtime ที่ต้องย้ายหรือไม่ เช่น:

- uploaded documents
- generated reports
- backup files
- OCR artifacts

ถ้าไฟล์เหล่านี้ถูกเก็บใน filesystem ไม่ใช่ database ให้ copy ไปยัง path เดิมหรือปรับ env/config ให้ชี้ path ใหม่

## 7. ตั้ง IIS Reverse Proxy

รันสคริปต์นี้บน server ใหม่:

```powershell
.\scripts\windows\configure-iis.ps1 `
  -SiteName "PHTS" `
  -PhysicalPath "D:\apps\phts\iis\site" `
  -BackendPort 4000 `
  -FrontendPort 3000
```

สคริปต์จะสร้าง IIS site และ `web.config` ที่ proxy:

- `/api/*` ไป `http://127.0.0.1:4000/api/*`
- path อื่นไป `http://127.0.0.1:3000/*`

หลังจากนั้นให้ตั้งค่าเพิ่มเติมใน IIS:

- binding domain
- TLS certificate สำหรับ port `443`
- firewall inbound rules สำหรับ `80` และ `443`
- เปิด ARR proxy ถ้ายังไม่ได้เปิด

## 8. Deploy ครั้งแรกผ่าน GitHub Actions

ไปที่ GitHub Actions แล้วรัน workflow:

```text
Deploy Windows Production
```

เลือก:

```text
ref = main
```

หรือ push เข้า `main` ถ้า workflow เปิด trigger จาก branch `main`

Workflow จะ:

1. checkout code
2. install dependencies
3. run lint/typecheck/tests
4. build backend/frontend
5. zip artifact
6. download artifact บน self-hosted Windows runner
7. run `scripts/windows/deploy.ps1`

เมื่อ deploy สำเร็จ script จะสลับ `D:\apps\phts\current` ไป release ใหม่, restart services, แล้ว smoke check ที่:

```text
http://127.0.0.1:4000/health
```

## 9. Deploy แบบ Manual

ใช้วิธีนี้เมื่อยังไม่ได้ตั้ง GitHub self-hosted runner หรืออยากทดสอบครั้งแรกแบบควบคุมเอง

บนเครื่อง build:

```powershell
npm run install:all
npm run lint:all
npm run typecheck:all
npm run test:all
npm run build:all
```

สร้าง artifact ให้มีโครงสร้างนี้:

```text
artifact\
  backend\
    dist\
    package.json
    package-lock.json
  frontend\
    .next\
    public\
    package.json
    package-lock.json
```

zip โฟลเดอร์ `backend` และ `frontend` แล้ว copy ไป server ใหม่ จากนั้นรันบน server:

```powershell
.\scripts\windows\deploy.ps1 `
  -ReleaseId "rel-manual-001" `
  -ArtifactPath "D:\deploy\phts-rel-manual-001.zip" `
  -BaseDir "D:\apps\phts"
```

## 10. ตรวจสอบหลัง Deploy

ตรวจ service:

```powershell
nssm status PHTS-Backend
nssm status PHTS-Frontend
Get-Service PHTS-Backend
Get-Service PHTS-Frontend
```

ตรวจ health:

```powershell
Invoke-WebRequest http://127.0.0.1:4000/health -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:3000 -UseBasicParsing
```

ตรวจ logs:

```powershell
Get-Content D:\apps\phts\logs\backend\stdout.log -Tail 80
Get-Content D:\apps\phts\logs\backend\stderr.log -Tail 80
Get-Content D:\apps\phts\logs\frontend\stdout.log -Tail 80
Get-Content D:\apps\phts\logs\frontend\stderr.log -Tail 80
```

ตรวจผ่าน domain:

```powershell
Invoke-WebRequest https://your-domain.example/api/health -UseBasicParsing
Invoke-WebRequest https://your-domain.example -UseBasicParsing
```

## 11. Rollback (Manual)

ถ้า release ใหม่มีปัญหา ให้สลับ `current` กลับไป release ก่อนหน้าแบบ manual:

```powershell
$baseDir = "D:\apps\phts"
$releasesDir = Join-Path $baseDir "releases"
$currentDir = Join-Path $baseDir "current"

# เลือก release ก่อนหน้า (ตัวล่าสุดคือ index 0, ก่อนหน้าคือ index 1)
$target = Get-ChildItem -Path $releasesDir -Directory |
  Sort-Object LastWriteTime -Descending |
  Select-Object -Skip 1 -First 1

if (-not $target) { throw "No previous release available." }

if (Test-Path $currentDir) { cmd /c rmdir "$currentDir" | Out-Null }
cmd /c mklink /J "$currentDir" "$($target.FullName)" | Out-Null

nssm restart PHTS-Backend
nssm restart PHTS-Frontend
Invoke-WebRequest http://127.0.0.1:4000/health -UseBasicParsing
```

หลัง rollback ให้ตรวจ logs อีกครั้ง

## 12. Checklist ก่อนตัด Traffic

- Server ใหม่มี Node.js 20+, npm, NSSM, MySQL client tools
- MySQL/Redis พร้อมใช้งานและ app ต่อได้
- `D:\apps\phts\shared\backend\.env` ใส่ production values แล้ว
- `D:\apps\phts\shared\frontend\.env.local` ใส่ `NEXT_PUBLIC_API_URL` แล้ว
- Database ถูก migrate/import แล้ว
- ไฟล์ runtime ที่จำเป็นถูก copy แล้ว
- NSSM services start ได้
- `http://127.0.0.1:4000/health` ตอบ 200
- frontend `http://127.0.0.1:3000` เปิดได้
- IIS reverse proxy ใช้งานได้
- TLS certificate และ domain binding ถูกต้อง
- GitHub self-hosted runner เครื่องใหม่ online
- Runner เครื่องเก่าถูกหยุดหรือถอด label แล้ว ถ้าไม่ต้องการ deploy ไปเครื่องเก่า
- มี rollback release หรือ backup ก่อนตัด traffic

## 13. Troubleshooting

ถ้า backend ไม่ start:

- ดู `D:\apps\phts\logs\backend\stderr.log`
- ตรวจ `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- ตรวจ Redis ว่าเปิดอยู่หรือ env ปิด worker ที่ต้องใช้ Redis แล้ว
- ตรวจว่า `PORT=4000` ไม่ชน process อื่น

ถ้า frontend ขึ้นแต่ API ใช้ไม่ได้:

- ตรวจ `NEXT_PUBLIC_API_URL`
- ตรวจ IIS rewrite rule
- ตรวจว่า backend health ผ่าน
- ดู `D:\apps\phts\logs\frontend\stderr.log`

ถ้า deploy แล้ว `current` ไม่เปลี่ยน:

- ตรวจว่า PowerShell รันด้วยสิทธิ์ที่สร้าง junction ได้
- ตรวจว่า release id ซ้ำกับของเดิมหรือไม่
- ดู error จาก `deploy.ps1`

ถ้า GitHub Actions deploy ไปผิดเครื่อง:

- ตรวจ self-hosted runner labels
- หยุด runner เครื่องเดิม หรือถอด label `windows`/`x64`
- ใช้ environment protection หรือ runner group เพื่อ lock production runner ให้ชัดเจน
