#!/usr/bin/env bash
set -Eeuo pipefail

BACKUP_ROOT="${BACKUP_ROOT:-/mnt/d/backup/mysql}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
LOCK_FILE="${LOCK_FILE:-/tmp/phts_mysql_autobackup.lock}"

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_NAMES="${DB_NAMES:-phts_system hrms_databases}"
MYSQLDUMP_EXTRA_OPTS="${MYSQLDUMP_EXTRA_OPTS:-}"

if ! command -v mysqldump >/dev/null 2>&1; then
  echo "mysqldump not found in PATH"
  exit 1
fi

mkdir -p "${BACKUP_ROOT}"

exec 9>"${LOCK_FILE}"
if ! flock -n 9; then
  echo "Another backup process is running. lock=${LOCK_FILE}"
  exit 1
fi

timestamp="$(date +%Y%m%d_%H%M%S)"
tmp_names="$(echo "${DB_NAMES}" | tr ',;' '  ')"
read -r -a db_list <<<"${tmp_names}"

if [[ "${#db_list[@]}" -eq 0 ]]; then
  echo "No database configured. Set DB_NAMES."
  exit 1
fi

if [[ -n "${DB_PASSWORD}" ]]; then
  export MYSQL_PWD="${DB_PASSWORD}"
fi

for db_name in "${db_list[@]}"; do
  [[ -z "${db_name}" ]] && continue

  db_dir="${BACKUP_ROOT}/${db_name}"
  mkdir -p "${db_dir}"

  backup_file="${db_dir}/${db_name}_${timestamp}.sql.gz"
  temp_file="${backup_file}.tmp"
  checksum_file="${backup_file}.sha256"

  echo "[$(date '+%F %T')] backing up ${db_name} -> ${backup_file}"

  if [[ -n "${MYSQLDUMP_EXTRA_OPTS}" ]]; then
    # shellcheck disable=SC2086
    mysqldump \
      --host="${DB_HOST}" \
      --port="${DB_PORT}" \
      --user="${DB_USER}" \
      --single-transaction \
      --quick \
      --routines \
      --triggers \
      --events \
      ${MYSQLDUMP_EXTRA_OPTS} \
      "${db_name}" | gzip -1 >"${temp_file}"
  else
    mysqldump \
      --host="${DB_HOST}" \
      --port="${DB_PORT}" \
      --user="${DB_USER}" \
      --single-transaction \
      --quick \
      --routines \
      --triggers \
      --events \
      "${db_name}" | gzip -1 >"${temp_file}"
  fi

  mv "${temp_file}" "${backup_file}"
  sha256sum "${backup_file}" >"${checksum_file}"

  find "${db_dir}" -type f -name "${db_name}_*.sql.gz" -mtime +"${BACKUP_RETENTION_DAYS}" -delete
  find "${db_dir}" -type f -name "${db_name}_*.sql.gz.sha256" -mtime +"${BACKUP_RETENTION_DAYS}" -delete
done

if [[ -n "${DB_PASSWORD}" ]]; then
  unset MYSQL_PWD
fi

echo "[$(date '+%F %T')] backup completed"
