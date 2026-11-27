#!/usr/bin/env bash
set -Eeuo pipefail

# Execute this from the directory containing docker-compose.yml on the VPS.
# The schedule is configured in the host cron with America/Argentina/Buenos_Aires.
BACKUP_DIR="${BACKUP_DIR:-./backups}"
CONTAINER_DIR="${CONTAINER_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
mkdir -p "$BACKUP_DIR"

stamp="$(TZ=America/Argentina/Buenos_Aires date +%Y-%m-%d)"
filename="pointdesk-${stamp}.json"

docker compose exec -T app pnpm db:backup "${CONTAINER_DIR}/${filename}"

# Keep the last 30 daily snapshots and their checksums.
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'pointdesk-*.json' -mtime "+${RETENTION_DAYS}" -delete
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'pointdesk-*.json.sha256' -mtime "+${RETENTION_DAYS}" -delete

echo "Backup diario completado: ${BACKUP_DIR}/${filename}"
