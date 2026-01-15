#!/usr/bin/env bash
set -euo pipefail

cd /mnt/d/phts-workspace/phts-project/backend

set -a
if [ -f ./.env ]; then
  . ./.env
fi
set +a

npx tsx src/scripts/run_scheduled_jobs.ts backup
