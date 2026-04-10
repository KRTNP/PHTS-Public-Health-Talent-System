#!/usr/bin/env bash
set -euo pipefail

TARGET_URL="${1:-http://127.0.0.1:3001}"
REPORT_DIR="${2:-./artifacts/zap}"
mkdir -p "$REPORT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required to run OWASP ZAP baseline scan" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONF_FILE="$ROOT_DIR/scripts/security/zap-baseline.conf"

DOCKER_ARGS=(
  run --rm
  --network host
  -v "$ROOT_DIR:/zap/wrk:rw"
  -t ghcr.io/zaproxy/zaproxy:stable
  zap-baseline.py
  -t "$TARGET_URL"
  -r "${REPORT_DIR#./}/report.html"
  -J "${REPORT_DIR#./}/report.json"
  -w "${REPORT_DIR#./}/report.md"
  -m 3
  -I
  -d
)

if [[ -f "$CONF_FILE" ]]; then
  DOCKER_ARGS+=( -c "scripts/security/zap-baseline.conf" )
fi

echo "[zap] scanning target: $TARGET_URL"
docker "${DOCKER_ARGS[@]}"
echo "[zap] reports generated in: $REPORT_DIR"
