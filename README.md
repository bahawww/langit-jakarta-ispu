# Platform Monitoring & Prediksi Kualitas Udara ISPU DKI Jakarta

Status: **Tahap 2 (fondasi)**. README lengkap (arsitektur, deploy, retraining, model) menyusul di Tahap 6.
Rencana dan keputusan desain: [`docs/PLAN.md`](docs/PLAN.md).

## Menjalankan lokal

```sh
cp deploy/.env.example deploy/.env      # isi nilainya
deploy/build.sh                          # build image backend (network host, lihat catatan di skrip)
docker compose -f deploy/compose.yaml up -d --no-build
curl http://127.0.0.1:8300/api/meta
```

Saat start pertama, `api` menjalankan migrasi Alembic lalu seed dari CSV bersih dan hasil testing
Orange di root repo (di-mount read-only). Dokumentasi API: `http://127.0.0.1:8300/api/docs`.

## Tes

```sh
cd deploy
docker compose run --rm --no-deps --user "$(id -u):$(id -g)" -e RUN_MIGRATIONS=0 \
  -v "$PWD/../backend:/app" api sh -c "ruff check --no-cache . && pytest -q -p no:cacheprovider"
```

Tes memakai database terpisah `ispu_test` di server PostgreSQL yang sama.
