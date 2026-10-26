#!/bin/sh
set -e
if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
  alembic upgrade head
  python -m app.seed
fi
exec "$@"
