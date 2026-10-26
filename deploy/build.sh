#!/bin/sh
# Build image dengan jaringan host. Bridge BuildKit di VPS ini lambat sekali ke PyPI/npm,
# sedangkan `docker compose build` butuh izin interaktif untuk network host.
set -e
cd "$(dirname "$0")/.."
docker build --network host -f backend/Dockerfile -t ispu-backend:latest .
