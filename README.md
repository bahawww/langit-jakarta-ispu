# Platform Monitoring & Prediksi Kualitas Udara ISPU DKI Jakarta

Status: **Tahap 5 (admin & auth)**. README lengkap (arsitektur, deploy, retraining, model) menyusul di Tahap 6.
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

## ML (ringkas, detail di Tahap 6)

- Training otomatis: saat worker start tanpa champion, setelah ingest yang mengubah data
  (`app.worker.enqueue_after_ingest`), dan mingguan Minggu 02:00 WIB (Celery beat).
- Manual: `docker compose -f deploy/compose.yaml exec worker python -m app.cli train`
- Rollback: `docker compose -f deploy/compose.yaml exec worker python -m app.cli rollback <model_version_id>`
- Registry: `GET /api/models`, `/api/models/champions`, `/api/models/{id}`, `/api/training-runs`;
  forecast: `GET /api/forecast?station=DKI1`.

## Frontend

Next.js 16 (App Router, output standalone) + TypeScript + Tailwind 4 + komponen gaya shadcn/ui +
TanStack Query + ECharts 6. Semua angka dibaca dari `/api` (tidak ada angka data hard-coded); filter
tersimpan di URL. Tipe API dibuat dari OpenAPI: `npm run gen:api` (butuh stack berjalan).

```sh
cd frontend && npm ci
API_PROXY=http://127.0.0.1:8300 npm run dev     # /api diteruskan ke stack lokal
npm run typecheck && npm run lint && npm run format
deploy/build.sh web && docker compose -f deploy/compose.yaml up -d --no-build web
```

Screenshot: [`docs/screenshots/`](docs/screenshots/).

## Admin

`/admin` (login wajib; dashboard lain publik read-only). Kredensial dari `deploy/.env`
api menolak start bila kosong.

- Upload: hanya `.csv`, maks 5 MB, UTF-8; laporan baru/update/tidak berubah/ditolak + alasan per baris.
  Retraining otomatis diantrekan hanya bila data berubah.
- Retrain manual dan rollback model satu klik (konfirmasi dua langkah) dari halaman admin.
