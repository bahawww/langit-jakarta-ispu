# Proyek: Platform Monitoring & Prediksi Kualitas Udara ISPU DKI Jakarta (enterprise grade)

Kamu akan membangun aplikasi web production-ready dari folder ini lalu men-deploy-nya ke VPS ini. **Mulai dalam plan mode.** Baca semua file di folder ini, cek spesifikasi VPS, ajukan pertanyaan yang benar-benar perlu, susun rencana bertahap, lalu tunggu persetujuan saya sebelum menulis kode.

## 1. Konteks

Ini tugas kuliah "Dari Data Menjadi Solusi AI": mengklasifikasikan kategori kualitas udara harian (BAIK / SEDANG / TIDAK SEHAT) dari data ISPU 5 stasiun SPKU DKI Jakarta, periode Jan 2024 – Nov 2025. Sumbernya DLH DKI Jakarta via Satu Data Jakarta. Model awal dilatih di Orange Data Mining (split 80:20 stratified). Sekarang saya ingin hasilnya menjadi aplikasi web sungguhan yang:
1. menyimpan data di database, bukan di file CSV,
2. melatih ulang model otomatis setiap ada data baru,
3. menampilkan dashboard yang menyesuaikan diri dengan data yang tersedia,
4. memprediksi kualitas udara beberapa hari ke depan.

### File di folder ini
| File | Isi |
|---|---|
| `Filedata Data Indeks Standar Pencemar Udara ISPU di Provinsi DKI Jakarta.csv` | Data mentah, 3.501 baris. Ada nilai `N/A` / `TIDAK ADA DATA`, nama stasiun belum seragam, ada BOM UTF-8 |
| `Dataset_ISPU_DKI_Jakarta_2024_2025_Clean.csv` | Data bersih, 3.131 baris (2024: 1.679, 2025: 1.452) |
| `Hasil_Testing_80_20_ISPU_DKI_Jakarta.csv` | 626 baris data uji + prediksi Random Forest, Decision Tree, kNN dari Orange |
| `Dashboard_ISPU_DKI_Jakarta.html` | Dashboard HTML statis versi awal. **Jadikan acuan isi dan logika metrik**, bukan acuan arsitektur |
| `Panduan_Looker_Studio_ISPU.md` | Angka acuan yang sudah diverifikasi dan temuan kualitas data |
| `summary data after trainig dan goals yang belum tercapai.md` | Laporan saya. Beberapa angkanya keliru; yang benar ada di file panduan |
| `Tugas.md` | Soal tugas |
| `build_dashboard.ps1`, `template.html` | Generator dashboard lama (PowerShell, Windows). Tidak dipakai di aplikasi baru |

### Skema data bersih
`tanggal_lengkap` (YYYY-MM-DD), `periode_data`, `tahun`, `bulan`, `tanggal`, `stasiun`, `pm_sepuluh`, `pm_duakomalima`, `sulfur_dioksida`, `karbon_monoksida`, `ozon`, `nitrogen_dioksida`, `parameter_pencemar_kritis` (41 baris kosong), `max`, `kategori`.
File hasil testing menambahkan kolom `Prediksi_Random_Forest`, `Prediksi_Decision_Tree`, `Prediksi_kNN`, `Status_Prediksi_RF`.

### Fakta penting tentang data (sudah diverifikasi, jangan diabaikan)
1. **Nilai polutan adalah nilai indeks ISPU, bukan konsentrasi µg/m³.** `max` = nilai tertinggi dari 6 polutan di setiap baris (berlaku di 100% baris).
2. **`kategori` ditentukan langsung dari `max`:** 0–50 BAIK, 51–100 SEDANG, 101–200 TIDAK SEHAT, 201–300 SANGAT TIDAK SEHAT, >300 BERBAHAYA. Di data ini `max` berkisar 19–187, jadi hanya 3 kelas yang muncul. Akibatnya, mengklasifikasikan kategori dari polutan di hari yang sama hampir trivial: aturan ambang sudah memberi jawabannya. **Nilai ML yang sebenarnya ada di forecasting (memprediksi hari-hari ke depan).** Pakai aturan ambang sebagai baseline yang harus dilampaui model mana pun.
3. **Ada 21 baris label yang tidak konsisten** (DKI1 Bundaran HI, Desember 2024): 19 baris berlabel BAIK padahal `max` 53–78, dan 2 baris berlabel SEDANG padahal `max` 101/103. Tandai baris seperti ini saat ingest (flag `label_inconsistent`), jangan dihapus diam-diam.
4. Data punya celah (hari/stasiun yang kosong). Distribusi kelasnya tidak seimbang: BAIK 361, SEDANG 2.451, TIDAK SEHAT 319.
5. Ada pola musiman: hari TIDAK SEHAT memuncak di Mei–Agustus 2024 dan Mei–Juli 2025. Kebon Jeruk (105) dan Lubang Buaya (79) adalah stasiun dengan hari TIDAK SEHAT terbanyak.

### Angka acuan (untuk acceptance test import data Orange)
626 baris uji. Akurasi: RF 97,60% (611), DT 98,24% (615), kNN 91,85% (575). Weighted F1: RF 0,9761, DT 0,9825, kNN 0,9155. Confusion matrix RF (baris = aktual B/S/TS): [68,4,0] [6,483,1] [0,4,60]. Rata-rata data uji: PM2.5 71,64, PM10 48,80.

## 2. Yang harus dibangun

### A. Ingest data
- Halaman admin untuk mengunggah CSV (format mentah maupun bersih). Pipeline-nya: validasi skema → normalisasi nama stasiun → buang/tandai `N/A` → cast numerik → hitung ulang `kategori_ispu` dari `max` → **upsert berdasarkan (tanggal, stasiun)** supaya tidak ada duplikat.
- Saat pertama dijalankan, seed otomatis dari ketiga CSV di folder ini (hasil Orange disimpan sebagai "baseline Orange" untuk perbandingan).
- Setiap upload dicatat: jumlah baris baru, baris yang di-update, baris yang ditolak beserta alasannya. Tampilkan laporan ini ke admin.
- Opsional (tahap akhir): sinkronisasi terjadwal dari portal Satu Data Jakarta, tapi hanya jika ada endpoint resmi. Cek dulu dan jangan menebak URL.

### B. ML pipeline dengan retraining otomatis
Buat dua jenis model:
1. **Klasifikasi** (kategori dari 6 polutan di hari yang sama), untuk melanjutkan tugas kuliah. Bandingkan Decision Tree, Random Forest, kNN, dan gradient boosting dengan baseline aturan ambang.
2. **Forecasting** (inti fitur "prediksi masa depan"): prediksi indeks PM2.5, PM10, dan polutan lain per stasiun untuk H+1 sampai H+7, lalu turunkan kategorinya lewat ambang ISPU. Gunakan fitur lag, rolling mean, dan musiman (hari dalam minggu, bulan). Validasi dengan **time-based split / rolling-origin backtest, bukan random split** (random split membocorkan informasi masa depan). Bandingkan dengan baseline naif: persistence (nilai kemarin) dan seasonal naive.

Aturan retraining:
- Dipicu otomatis setelah ingest berhasil, plus jadwal mingguan sebagai cadangan.
- **Champion/challenger:** model baru hanya dipromosikan kalau metrik holdout-nya ≥ model aktif. Kalau tidak, model lama tetap dipakai dan alasannya dicatat.
- Model registry menyimpan versi, waktu, rentang data latih, metrik, hyperparameter, dan artifact, dengan fitur rollback satu klik di admin.
- Hasilnya harus reproducible: random seed tetap dan dataset snapshot per training run.
- Metrik: accuracy, precision/recall/F1 (weighted dan macro), dan confusion matrix untuk klasifikasi; MAE, RMSE, dan akurasi kategori turunan per horizon untuk forecasting.

### C. Dashboard dinamis
Semua angka diambil dari API/database. **Tidak boleh ada angka hard-coded.** Daftar stasiun, rentang tanggal, tahun, dan polutan dibaca dari data, jadi stasiun atau tahun baru langsung muncul.
- **Overview:** KPI (jumlah data, rata-rata PM2.5/PM10, % hari TIDAK SEHAT, akurasi model aktif, kondisi terkini per stasiun), filter stasiun, rentang tanggal, dan model.
- **Tren:** time series per polutan dengan garis ambang 50/100, kalender heatmap kategori harian, dan stacked bar kategori per bulan.
- **Per stasiun:** perbandingan antar-stasiun dan pencemar kritis dominan.
- **Prediksi:** forecast 7 hari per stasiun dengan interval ketidakpastian, kategori turunannya, dan peringatan jika diprediksi TIDAK SEHAT.
- **Evaluasi model:** tabel perbandingan model, confusion matrix, riwayat versi model dan metriknya, dan perbandingan dengan baseline Orange.
- **Data:** tabel yang bisa dicari, diurutkan, dan dipaging, dengan badge untuk baris `label_inconsistent`, plus ekspor CSV.
- **Admin:** upload CSV, laporan ingest, status job training, registry, dan rollback.
- Bahasa UI Indonesia, format angka `id-ID`.

### D. UI/UX
- Gunakan skill **ui-ux-pro-max** kalau terpasang di Claude Code ini. Kalau tidak ada, beri tahu saya dulu, lalu lanjutkan dengan prinsip desain yang setara.
- Warna kategori konsisten di semua halaman (BAIK hijau, SEDANG kuning, TIDAK SEHAT merah, dst.) dan selalu disertai label teks, jangan hanya warna.
- Responsif dari mobile 375px sampai desktop, dengan dark mode, aksesibilitas WCAG AA, loading skeleton, empty state, dan error state.

## 3. Tech stack (pakai ini kecuali ada alasan kuat; jelaskan kalau ingin mengganti)
- **Frontend:** Next.js (App Router) + TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Apache ECharts atau Recharts.
- **Backend API:** Python FastAPI + Pydantic v2, SQLAlchemy 2 + Alembic (migrasi). Python dipilih karena ekosistem ML-nya.
- **ML:** pandas, scikit-learn, LightGBM, joblib; untuk forecasting pakai fitur lag + LightGBM, dan boleh ditambah statsforecast sebagai pembanding.
- **Database:** PostgreSQL.
- **Background jobs:** Celery + Redis (ingest, training, retraining terjadwal).
- **Model registry:** tabel di PostgreSQL + artifact di volume. Gunakan MLflow hanya jika RAM VPS ≥ 4 GB.
- **Auth:** dashboard publik read-only, halaman admin wajib login (JWT dengan httpOnly cookie, password di-hash dengan argon2/bcrypt, rate limit di endpoint login).
- **Deploy:** Docker Compose, reverse proxy Caddy (HTTPS otomatis), dan semua secret di `.env` (jangan di-commit; sediakan `.env.example`).

## 4. Standar "enterprise grade"
- Struktur monorepo yang rapi (`frontend/`, `backend/`, `ml/`, `deploy/`), typed end-to-end, linting dan formatting (ruff, eslint, prettier).
- Tes: pytest untuk pipeline ingest dan ML (termasuk acceptance test angka acuan di atas), tes API, dan Playwright untuk alur utama dashboard.
- Healthcheck setiap service, structured logging, penanganan error yang jelas, dan validasi input di semua endpoint (terutama upload file: batas ukuran dan tipe).
- Backup harian PostgreSQL (pg_dump + rotasi) beserta cara restore-nya.
- Inisialisasi git dan commit per tahap dengan pesan yang jelas.
- `README.md` berisi arsitektur (diagram), cara menjalankan lokal, cara deploy, cara upload data, cara retraining/rollback, dan penjelasan model.

## 5. Tahapan (kerjakan berurutan, laporkan dan minta konfirmasi di akhir tiap tahap)
1. **Discovery:** baca file, cek VPS (`uname -a`, RAM, disk, CPU, Docker terpasang atau tidak, port 80/443 dipakai atau tidak), lalu tanyakan domain yang dipakai. Susun rencana dan arsitektur.
2. **Fondasi:** repo, Docker Compose, database + migrasi, seed dari CSV, API dasar. Acceptance: 3.131 baris masuk, 21 baris ter-flag, angka acuan Orange ter-reproduksi dari API.
3. **ML pipeline:** klasifikasi + forecasting, backtest, registry, champion/challenger, job retraining.
4. **Frontend dashboard** dengan semua halaman di 2C dan desain 2D.
5. **Admin & auth:** upload, laporan ingest, retrain, rollback.
6. **Hardening & deploy:** tes, backup, HTTPS, firewall (hanya buka 22/80/443), dan verifikasi end-to-end di domain.

## 6. Aturan kerja
- Jangan mengarang angka, endpoint, atau hasil. Kalau sesuatu belum diverifikasi, katakan belum.
- Jangan menghapus atau mengubah CSV asli di folder ini. Salin kalau perlu.
- Minta konfirmasi sebelum melakukan aksi yang mengubah sistem VPS (install paket, ubah firewall, buka port, ubah DNS).
- Kalau ada keputusan yang benar-benar butuh saya (domain, kredensial admin, jumlah hari forecast), tanya. Untuk hal teknis lain, ambil keputusan yang masuk akal dan jelaskan alasannya.
- Di akhir setiap tahap, tunjukkan bukti: output tes, angka hasil, screenshot atau URL.
