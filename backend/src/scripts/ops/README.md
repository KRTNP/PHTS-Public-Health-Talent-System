# Scheduled Jobs (Ops Checklist)

## Timezone

- Job date logic uses `OPS_JOB_TIMEZONE` (default: `Asia/Bangkok`).
- Set in runtime environment:
  - `OPS_JOB_TIMEZONE=Asia/Bangkok`

## Run all jobs

```bash
npm run jobs:run
```

Note:
- Backup schedule now has a built-in worker in backend app process (`BACKUP_WORKER_ENABLED=true`).
- `jobs:run` cron can still be used as an ops fallback if needed.

## Run specific jobs

```bash
npm run jobs:run leave-report
npm run jobs:run retirement-cut
npm run jobs:run movement-cut
npm run jobs:run notification-outbox
npm run jobs:run sync
```

`movement-cut` is intentionally on-demand as a safety-net, because movement cutoff is already applied immediately in sync flow.

## Run dedicated workers (standalone process)

Use these when you want to run/observe one worker independently from the API server.

```bash
npm run ocr:worker
npm run sync:worker
npm run snapshot:worker
npm run notification:worker
npm run backup:worker
```

## Archived one-off scripts

Legacy one-off scripts (including legacy movement report and manual payroll import helpers)
are kept under:

```bash
src/scripts/archive/manual/
```

## Notification outbox notes

- App server now runs a built-in outbox worker by default (`NOTIFICATION_OUTBOX_WORKER_ENABLED=true`).
- Cron `notification-outbox` job is still useful as an operational fallback.
- Retry and dead-letter behavior are controlled by:
  - `NOTIFICATION_OUTBOX_MAX_ATTEMPTS`
  - `NOTIFICATION_OUTBOX_RETRY_BASE_SECONDS`
  - `NOTIFICATION_OUTBOX_RETRY_MAX_SECONDS`
  - `NOTIFICATION_OUTBOX_PROCESSING_TIMEOUT_SECONDS`

## Snapshot outbox notes

- App server runs a built-in snapshot worker by default (`SNAPSHOT_WORKER_ENABLED=true`).
- Cron `snapshot-outbox` job remains a valid operational fallback.
- Retry and dead-letter behavior are controlled by:
  - `SNAPSHOT_OUTBOX_MAX_ATTEMPTS`
  - `SNAPSHOT_OUTBOX_RETRY_BASE_SECONDS`
  - `SNAPSHOT_OUTBOX_RETRY_MAX_SECONDS`
  - `SNAPSHOT_OUTBOX_PROCESSING_TIMEOUT_SECONDS`

## Sync worker notes

- App server runs built-in sync worker by default (`SYNC_WORKER_ENABLED=true`).
- Schedule modes:
  - `SYNC_AUTO_MODE=DAILY` uses `SYNC_AUTO_DAILY_HOUR` + `SYNC_AUTO_DAILY_MINUTE`
  - `SYNC_AUTO_MODE=INTERVAL` uses `SYNC_AUTO_INTERVAL_MINUTES`
- Timezone for daily mode: `SYNC_AUTO_TIMEZONE` (default `Asia/Bangkok`).
- Worker poll interval: `SYNC_WORKER_POLL_MS`.
- Built-in sync lock prevents overlapping runs.

## OCR worker notes

- App server runs built-in OCR worker by default (`OCR_WORKER_ENABLED=true`).
- OCR engine chain is:
  - primary: `OCR_SERVICE_URL`
  - secondary: `OCR_PADDLE_SERVICE_URL` (or local Paddle when `OCR_PADDLE_LOCAL_ENABLED=true`)
  - tertiary: `OCR_TYPHOON_SERVICE_URL` (when previous result quality is still insufficient)
- Local Tesseract tuning env:
  - `OCR_TESSERACT_LANG` (default `tha+eng`)
  - `OCR_TESSERACT_OEM` (default `1`)
  - `OCR_TESSERACT_PSM` (default `11`)
  - `OCR_TESSERACT_PDF_DPI` (default `200`)
  - `OCR_TESSERACT_THREAD_LIMIT` (default `1`)
  - `OCR_TESSERACT_PREPROCESS` (`none` or `gray-deskew`)
  - `OCR_TESSERACT_THRESHOLDING_METHOD` (`0|1|2`)
  - `OCR_TESSERACT_THRESHOLDING_WINDOW_SIZE` (for Sauvola)
  - `OCR_TESSERACT_THRESHOLDING_KFACTOR` (for Sauvola)
- Current OCR status in system ops is based on:
  - Redis queue depth for `request:ocr:precheck:queue`
  - whether OCR service URL is configured
  - whether the worker is enabled
- OCR still stores per-request processing state under `submission_data.ocr_precheck`.

### Local Paddle OCR setup (WSL/Linux)

Use a Python virtual environment and point `OCR_PADDLE_PYTHON_BIN` to that interpreter.

```bash
cd /path/to/phts-project/backend
python3 -m venv .venv-ocr
source .venv-ocr/bin/activate
pip install --upgrade pip setuptools wheel
pip install "paddlepaddle==3.1.1" "paddleocr==3.4.0"
```

Recommended env flags for stable local run:
- `OCR_PADDLE_LOCAL_ENABLED=true`
- `OCR_PADDLE_PYTHON_BIN=/absolute/path/to/backend/.venv-ocr/bin/python`
- `OCR_PADDLE_DISABLE_MODEL_SOURCE_CHECK=true`
- `OCR_PADDLE_USE_TEXTLINE_ORIENTATION=false`
- `OCR_PADDLE_TEXT_DET_LIMIT_SIDE_LEN=2048`
- `OCR_PADDLE_TEXT_DET_THRESH=0.25`
- `OCR_PADDLE_TEXT_DET_BOX_THRESH=0.45`
- `OCR_PADDLE_TEXT_DET_UNCLIP_RATIO=1.8`
- `OCR_PADDLE_TEXT_REC_SCORE_THRESH=0`
- `OCR_PADDLE_PDF_DPI=300`

Benchmark with local sample files:

```bash
cd /path/to/phts-project/backend
npm run ocr:hybrid:benchmark
npm run ocr:tesseract:benchmark
npm run ocr:paddle:benchmark
```

Default benchmark output is saved to:
- `../ocr/output_text/OCR_hybrid_local_tuned.txt`
- `../ocr/output_text/OCR_tesseract_local_tuned.txt`
- `../ocr/output_text/OCR_paddle_local_tuned.txt`

## Cron example

```cron
# every 15 minutes
*/15 * * * * cd /path/to/phts-project/backend && OPS_JOB_TIMEZONE=Asia/Bangkok npm run jobs:run >> /var/log/phts-jobs.log 2>&1
```

If you prefer wrapper script instead of npm command, use:

```bash
src/scripts/ops/cron/jobs.sh [job-name]
```
