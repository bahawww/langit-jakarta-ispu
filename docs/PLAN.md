# Plan: platform ISPU DKI Jakarta (udara.example.com)

## Context
Tugas kuliah ISPU (klasifikasi kategori, Orange 80:20) dijadikan web app production: data di PostgreSQL, retraining otomatis, dashboard dinamis, forecast H+1..H+7. Spesifikasi lengkap: `PROMPT_Claude_Code_Enterprise_Dashboard.md`. Dokumen ini = hasil Tahap 1 (discovery) + rencana Tahap 2–6.

## Temuan discovery (terverifikasi)
**VPS:** Ubuntu 24.04, kernel 6.8.0-147, Xeon Gold 6230 16 core, RAM 15 Gi (11 Gi free), disk 411 G free, Docker 29.9.2, Compose v5.6.1.
- **NAT:** IP guest privat, IP publik milik host. Port 80/443 di guest tidak bisa dijangkau internet → Caddy auto-HTTPS (ACME) **tidak bisa**.
- Port 80 = Pulse (systemd), 443 = tailscale serve (IP tailnet). 5432/6379 dipakai container Coolify (internal, tidak publish).
- Jalur publik yang ada: `cloudflared` tunnel (zona `example.com`, token di `~/.cloudflare-token`). `example.com` dilindungi Cloudflare Access → subdomain baru harus dikecualikan supaya dashboard publik. **Belum diverifikasi:** tunnel remote-managed (token) atau dari `/etc/cloudflared/config.yml`; cakupan Access policy.
- UFW aktif dan membuka 22,80,443,8080,8090,9119,20128,45876. Spesifikasi "hanya 22/80/443" akan **mematikan** Beszel/Hermes/9router → tidak diubah. App baru bind `127.0.0.1` saja, jadi tidak ada port baru yang dibuka.
- Skill `ui-ux-pro-max` terpasang.

**Data:**
- CSV mentah: 3.501 baris, **BOM ganda** (`EF BB BF` dua kali), 13 varian nama stasiun → 5 stasiun, 554 sel `N/A`, kategori `TIDAK ADA DATA`/`N/A`. Kolom `tahun`/`tanggal_lengkap` tidak ada (diturunkan dari `periode_data`+`tanggal`).
- CSV bersih: 3.131 baris, 700 tanggal (2024-01-01..2025-11-30), 0 duplikat (tanggal, stasiun), BAIK 361/SEDANG 2.451/TIDAK SEHAT 319, 21 baris inkonsisten (semua DKI1 202412). Cocok dengan prompt.
- Mentah → bersih = baris semua-numerik (3.132) dikurangi 1 baris **SANGAT TIDAK SEHAT** (2024-02-14 DKI3, NO2=202, kritis `N/A`).

## Keputusan
| Hal | Keputusan | Alasan |
|---|---|---|
| Domain | `udara.example.com` via cloudflared | user pilih; satu-satunya jalur publik |
| HTTPS | TLS di Cloudflare edge; Caddy internal (HTTP) di `127.0.0.1:8300` routing `/api`→FastAPI, `/`→Next | ACME tidak bisa di balik NAT |
| Seed | CSV bersih + hasil testing (baseline Orange). CSV mentah = fixture tes upload | user pilih; acceptance 3.131 tetap |
| Horizon | 7 hari, dihitung dari tanggal data terakhir (sekarang 2025-11-30) | user pilih; data belum ada untuk 2026 |
| Admin | user isi `ADMIN_USERNAME`/`ADMIN_PASSWORD` di `.env` sendiri; app menolak start kalau kosong | user pilih |
| MLflow | tidak dipakai | registry tabel PG + artifact volume sudah memenuhi semua syarat; satu service lebih sedikit |
| Firewall | tidak diubah | lihat temuan |
| Repo | `git init` di folder ini; monorepo `frontend/ backend/ ml/ deploy/`. CSV asli di-mount **read-only** ke container (tanpa disalin/diubah). Compose `name: ispu` (path ada spasi) | |

Kategori ISPU: label resmi tetap kolom sumber `kategori`; `kategori_ispu` = turunan dari `max`; `label_inconsistent = kategori != kategori_ispu`. Mendukung 5 kelas (data baru bisa berisi SANGAT TIDAK SEHAT/BERBAHAYA).

## Arsitektur
```
Cloudflare (TLS, udara.example.com) → cloudflared (host) → caddy :8300 (127.0.0.1)
   ├─ /api/* → api (FastAPI, uvicorn)  ─┐
   └─ /*     → web (Next.js standalone) │
worker (Celery) + beat ← redis          ├─ postgres (volume pgdata)
artifacts volume (model joblib, snapshot parquet) ┘   backup (pg_dump cron, rotasi 14 hari)
```
Service compose: `postgres:16-alpine`, `redis:7-alpine`, `api`, `worker`, `beat`, `web`, `caddy`, `backup`. Semua punya healthcheck; tidak ada port publish selain caddy di 127.0.0.1.

## Tahap 2 — Fondasi
- `backend/`: FastAPI + Pydantic v2, SQLAlchemy 2, Alembic. Tabel: `stations` (kode DKI1..5, nama, alias), `measurements` (unique `(tanggal, station_id)`, 6 polutan, `max`, `kritis`, `kategori_sumber`, `kategori_ispu`, `label_inconsistent`, `source_upload_id`), `uploads` (laporan: baru/update/ditolak + alasan JSON), `orange_baseline` (626 baris + 3 prediksi), `model_versions`, `training_runs`, `forecasts`.
- Pipeline ingest (`backend/app/ingest/`): deteksi format (mentah vs bersih via header) → strip semua BOM → normalisasi stasiun (regex kode `DKI[1-5]` → nama kanonik) → tolak baris dengan `N/A`/kategori tidak valid (alasan dicatat) → cast int → hitung `kategori_ispu` → upsert `ON CONFLICT (tanggal, station_id)` (hitung insert vs update via `xmax`).
- Seed idempoten saat start (`api` entrypoint): migrasi → seed jika tabel kosong.
- API dasar: `/api/health`, `/api/meta` (stasiun, rentang tanggal, tahun, polutan — semua dari DB), `/api/measurements` (filter/sort/paging/CSV export), `/api/stats/*`, `/api/baseline/orange`.
- **Acceptance (pytest):** 3.131 baris; 21 `label_inconsistent`; dari API: akurasi RF 97,60% (611), DT 98,24% (615), kNN 91,85% (575), weighted F1 0,9761/0,9825/0,9155, CM RF [68,4,0][6,483,1][0,4,60], rata-rata uji PM2.5 71,64 / PM10 48,80. Tes ingest CSV mentah ke DB hasil seed: +1 insert (SANGAT TIDAK SEHAT), 0 duplikat, 369 ditolak dengan alasan.

## Tahap 3 — ML pipeline (`ml/`, dipanggil worker)
- **Klasifikasi:** fitur 6 polutan → DT, RF, kNN, LightGBM, + baseline aturan ambang (`max`→kategori). Split: stratified 80:20 seed 42 (paritas Orange) **dan** time holdout (20% tanggal terakhir) untuk champion/challenger. Metrik: accuracy, P/R/F1 weighted+macro, CM. Laporan dibandingkan juga ke label `kategori_ispu`.
- **Forecasting:** seri harian per stasiun di-reindex (celah = NaN). Fitur: lag 1,2,3,7,14; rolling mean 3/7/14 (shift 1); hari dalam minggu, bulan; stasiun kategorikal. Model direct per (polutan × horizon) = 6×7 LightGBM pooled lintas stasiun. Kategori turunan = ambang ISPU dari max 6 prediksi. Interval: kuantil residual backtest per horizon (10–90%). Validasi: rolling-origin backtest (expanding window, mis. 6 origin bulanan terakhir). Baseline: persistence & seasonal naive (lag 7). Metrik: MAE, RMSE, akurasi kategori per horizon. statsforecast hanya jika waktu cukup.
- **Registry:** `model_versions` (jenis, versi, waktu, rentang data latih, metrik, hyperparam, path artifact, hash snapshot, status champion/archived). Snapshot dataset parquet per run; seed tetap.
- **Champion/challenger:** challenger dan champion di-skor ulang pada holdout yang sama dari data terbaru; promosi jika metrik utama ≥ champion (klasifikasi: macro F1 time holdout; forecast: rata-rata MAE PM2.5 semua horizon). Gagal → alasan disimpan di `training_runs`.
- Trigger: task Celery setelah ingest sukses + beat mingguan (Minggu 02:00 WIB). Rollback = set champion ke versi lama (endpoint admin).

## Tahap 4 — Frontend (`frontend/`)
Next.js App Router + TS, Tailwind, shadcn/ui, TanStack Query, **ECharts** (calendar heatmap native). Halaman: Overview, Tren, Per stasiun, Prediksi, Evaluasi model, Data, Admin — isi sesuai §2C. Semua angka dari API; filter dari `/api/meta`. Token warna kategori satu sumber (`lib/kategori.ts`), selalu dengan label teks. id-ID `Intl.NumberFormat`. Dark mode, 375px+, WCAG AA, skeleton/empty/error state. Desain via skill `ui-ux-pro-max`; acuan isi dari `Dashboard_ISPU_DKI_Jakarta.html`.

## Tahap 5 — Admin & auth
JWT di cookie httpOnly+Secure+SameSite=Lax, argon2 (argon2-cffi), rate limit login (slowapi, 5/menit/IP — key dari `CF-Connecting-IP`). Upload: maks 5 MB, hanya `.csv`/`text/csv`, validasi header. Admin UI: upload + laporan ingest, status job (poll), registry + rollback satu klik, retrain manual.

## Tahap 6 — Hardening & deploy
- Tes: pytest (ingest, ML, acceptance, API), Playwright (overview, filter, prediksi, login+upload). ruff, eslint, prettier.
- Backup: container `backup` pg_dump harian → `/var/backups/ispu` rotasi 14; `deploy/restore.sh` + uji restore.
- Deploy (**perlu konfirmasi Anda di tahap itu**): tambah hostname `udara.example.com` → `http://localhost:8300` ke tunnel (cek dulu mode tunnel), DNS CNAME via API Cloudflare, bypass Access untuk hostname ini (admin tetap dilindungi login app). Catat di `~/vault/CHANGELOG.md` + catatan vault baru.
- Satu Data Jakarta sync: cek endpoint resmi dulu; implementasi hanya jika ada.
- `README.md` lengkap (diagram, lokal, deploy, upload, retrain/rollback, penjelasan model).
- Commit git per tahap.

## Verifikasi per tahap
- T2: `docker compose up -d` → semua healthy; `pytest backend/tests -k acceptance` lulus; `curl 127.0.0.1:8300/api/baseline/orange` menunjukkan angka acuan.
- T3: run training → output metrik backtest vs persistence/seasonal naive; promosi/penolakan tercatat; rollback diuji.
- T4/T5: Playwright lulus; screenshot 375px + desktop, light/dark.
- T6: `curl -I https://udara.example.com` 200; restore backup ke DB sementara berhasil; e2e di domain.

Risiko: forecast dari 2025-11-30 → label "forecast dari data terakhir" di UI. Forecast bisa tidak mengalahkan seasonal naive di horizon jauh — dilaporkan apa adanya.
