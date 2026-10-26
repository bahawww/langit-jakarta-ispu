#!/bin/sh
# Restore backup ke database PostgreSQL di stack `ispu`.
#   deploy/restore.sh backups/ispu-YYYYmmdd-HHMMSS.dump            -> ke DB uji `ispu_restore_check`
#   deploy/restore.sh backups/ispu-YYYYmmdd-HHMMSS.dump ispu        -> MENIMPA DB produksi (minta konfirmasi)
set -eu
cd "$(dirname "$0")"
file="${1:?pakai: deploy/restore.sh <file.dump> [database]}"
db="${2:-ispu_restore_check}"
[ -f "../$file" ] || [ -f "$file" ] || { echo "file tidak ada: $file" >&2; exit 1; }
name="$(basename "$file")"
user="$(grep -E '^POSTGRES_USER=' .env | cut -d= -f2-)"; user="${user:-ispu}"
prod="$(grep -E '^POSTGRES_DB=' .env | cut -d= -f2-)"; prod="${prod:-ispu}"

if [ "$db" = "$prod" ]; then
  printf 'PERINGATAN: database produksi "%s" akan DITIMPA dengan %s.\nKetik nama database untuk lanjut: ' "$db" "$name"
  read -r answer
  [ "$answer" = "$db" ] || { echo "dibatalkan"; exit 1; }
  docker compose stop api worker beat
fi

docker compose exec -T postgres sh -c "psql -U '$user' -d postgres -tc \"SELECT 1 FROM pg_database WHERE datname='$db'\" | grep -q 1 || createdb -U '$user' '$db'"
docker compose exec -T postgres pg_restore -U "$user" -d "$db" --clean --if-exists --no-owner "/backups/$name"
echo "restore selesai ke database $db"
docker compose exec -T postgres psql -U "$user" -d "$db" -c \
  "SELECT (SELECT count(*) FROM measurements) AS measurements, (SELECT count(*) FROM model_versions) AS model_versions, (SELECT count(*) FROM uploads) AS uploads"

if [ "$db" = "$prod" ]; then
  docker compose up -d --no-build api worker beat
fi
