#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/../../../.." && pwd)"

cd "${BACKEND_DIR}"

set -a
if [ -f ./.env ]; then
  . ./.env
fi
set +a

npx tsx src/scripts/ops/runners/scheduled-jobs.ts "$@"
