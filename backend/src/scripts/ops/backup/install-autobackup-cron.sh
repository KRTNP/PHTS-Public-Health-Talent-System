#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-${SCRIPT_DIR}/autobackup.env}"
CRON_SCHEDULE="${CRON_SCHEDULE:-0 */6 * * *}"
CRON_TAG="# phts-mysql-autobackup"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Env file not found: ${ENV_FILE}"
  echo "Create it from: ${SCRIPT_DIR}/autobackup.env.example"
  exit 1
fi

mkdir -p /mnt/d/backup/mysql

CRON_CMD="${CRON_SCHEDULE} /usr/bin/env bash -lc 'set -a; source \"${ENV_FILE}\"; set +a; \"${SCRIPT_DIR}/autobackup-mysql.sh\" >> /mnt/d/backup/mysql/autobackup.log 2>&1' ${CRON_TAG}"
current_cron="$(crontab -l 2>/dev/null || true)"
filtered_cron="$(printf '%s\n' "${current_cron}" | grep -v "${CRON_TAG}" || true)"
new_cron="$(printf '%s\n%s\n' "${filtered_cron}" "${CRON_CMD}")"

printf '%s\n' "${new_cron}" | crontab -
echo "Installed cron entry:"
echo "${CRON_CMD}"
