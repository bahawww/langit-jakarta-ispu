#!/bin/sh
# Backup PostgreSQL harian (pg_dump format custom) + rotasi. Dijalankan di container `backup`.
#   backup.sh        : backup sekarang, lalu tiap hari pukul BACKUP_HOUR (WIB)
#   backup.sh once   : backup sekali lalu keluar
set -eu
KEEP="${BACKUP_KEEP:-14}"
HOUR="${BACKUP_HOUR:-1}"
DIR=/backups

run() {
  f="$DIR/ispu-$(date +%Y%m%d-%H%M%S).dump"
  pg_dump -Fc -f "$f.tmp"
  mv "$f.tmp" "$f"
  # simpan KEEP file terbaru
  ls -1t "$DIR"/ispu-*.dump | tail -n +"$((KEEP + 1))" | xargs -r rm -f
  echo "$(date -Iseconds) backup ok: $f ($(du -h "$f" | cut -f1)), total $(ls "$DIR"/ispu-*.dump | wc -l) file"
}

run
[ "${1:-}" = once ] && exit 0
while true; do
  now=$(( $(date +%H) * 3600 + $(date +%M) * 60 + $(date +%S) ))
  # angka dengan nol di depan (08, 09) dibaca oktal oleh sh; paksa basis 10 lewat ekspresi di atas
  wait=$(( (HOUR * 3600 - now + 86400) % 86400 ))
  [ "$wait" -eq 0 ] && wait=86400
  sleep "$wait"
  run || echo "$(date -Iseconds) BACKUP GAGAL" >&2
done
