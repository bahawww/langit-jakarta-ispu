#!/bin/sh
# Build image dengan jaringan host. Bridge BuildKit di VPS ini lambat sekali ke PyPI/npm,
# sedangkan `docker compose build` butuh izin interaktif untuk network host.
# Pakai: deploy/build.sh [backend|web]  (tanpa argumen = keduanya)
set -e
cd "$(dirname "$0")/.."
target="${1:-all}"
if [ "$target" = all ] || [ "$target" = backend ]; then
  docker build --network host -f backend/Dockerfile -t ispu-backend:latest .
fi
if [ "$target" = all ] || [ "$target" = web ]; then
  docker build --network host -t ispu-web:latest frontend
fi
