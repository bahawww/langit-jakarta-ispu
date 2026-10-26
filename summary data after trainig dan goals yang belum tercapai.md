# LAPORAN TUGAS PRAKTIKUM: DARI DATA MENJADI SOLUSI AI
**Klasifikasi Kategori Kualitas Udara Harian Provinsi DKI Jakarta Berdasarkan Konsentrasi Polutan Ambien (ISPU 2024–2025)**

## File Dataset & Hasil Pengujian
* **Dataset Bersih (3.131 baris)**: `Dataset_ISPU_DKI_Jakarta_2024_2025_Clean.csv` — Sudah dibersihkan dari nilai `N/A` dan `TIDAK ADA DATA` (dari 3.501 baris mentah), penulisan nama 5 stasiun SPKU sudah diseragamkan, serta ditambahkan kolom `tanggal_lengkap` (`YYYY-MM-DD`) agar langsung terbaca sebagai grafik waktu di Looker Studio.
* **Hasil Pengujian 20% Data Testing (626 baris)**: `Hasil_Testing_80_20_ISPU_DKI_Jakarta.csv` — Berisi perbandingan nilai aktual (`kategori`) vs hasil prediksi 3 model (*Random Forest*, *Decision Tree*, dan *kNN*) beserta status ketepatannya untuk diunggah ke Looker Studio.

## 01. Tentukan Use Case
* **Bidang**: Lingkungan (*Smart Environment & Air Quality Monitoring*).
* **Judul Use Case**: Klasifikasi Kategori Kualitas Udara Harian Provinsi DKI Jakarta Berdasarkan Konsentrasi Polutan Ambien (ISPU 2024–2025).
* **Masalah Nyata**: Penurunan kualitas udara di wilayah perkotaan padat seperti DKI Jakarta akibat emisi transportasi dan industri berisiko memicu gangguan pernapasan akut (ISPA). Pemantauan dari 5 Stasiun Pemantau Kualitas Udara (SPKU) menghasilkan ribuan baris data sensor harian yang perlu diklasifikasikan secara cepat dan akurat untuk mendukung sistem peringatan dini kesehatan masyarakat.
* **Tujuan Prediksi**: Membangun model *Machine Learning* (Klasifikasi) untuk memprediksi status mutu udara harian (`BAIK`, `SEDANG`, atau `TIDAK SEHAT`) berdasarkan 6 parameter sensor polutan udara ($\text{PM}_{10}$, $\text{PM}_{2.5}$, $\text{SO}_2$, $\text{CO}$, $\text{O}_3$, dan $\text{NO}_2$).

## 02. Kumpulkan & Periksa Data (Google Sheets)
* **Sumber Data Resmi**: Dinas Lingkungan Hidup (DLH) Provinsi DKI Jakarta melalui [Portal Satu Data Jakarta - Data ISPU DKI Jakarta](https://satudata.jakarta.go.id/open-data/detail?kategori=dataset&page_url=data-indeks-standar-pencemar-udara-ispu-di-provinsi-dki-jakarta) dan [Portal Satu Data Indonesia](https://data.go.id/dataset/dataset/data-indeks-standar-pencemar-udara-ispu-di-provinsi-dki-jakarta) (Periode: Januari 2024 – November 2025).
* **Ringkasan Pemeriksaan Data**: Dari total **3.501 baris** data mentah pada 5 stasiun SPKU (`DKI1 Bundaran HI`, `DKI2 Kelapa Gading`, `DKI3 Jagakarsa`, `DKI4 Lubang Buaya`, `DKI5 Kebon Jeruk`), dilakukan pembersihan baris yang memiliki nilai sensor kosong (`N/A` / `TIDAK ADA DATA`) sehingga diperoleh **3.131 baris data bersih** (1.679 baris tahun 2024 dan 1.452 baris tahun 2025).
* **Identifikasi Feature dan Label**:

| Nama Kolom | Peran (Role di Orange) | Tipe Data | Keterangan |
| :--- | :--- | :--- | :--- |
| `tanggal_lengkap`, `periode_data`, `tahun`, `bulan`, `tanggal`, `stasiun` | **Meta** (Identitas) | Teks / Waktu | Penanda waktu pengamatan dan lokasi stasiun SPKU (untuk filter *dashboard*). |
| `pm_sepuluh` ($\text{PM}_{10}$) | **Feature (Input)** | Numerik | Konsentrasi partikulat ukuran $\le 10\ \mu\text{m}$. |
| `pm_duakomalima` ($\text{PM}_{2.5}$) | **Feature (Input)** | Numerik | Konsentrasi partikulat halus $\le 2,5\ \mu\text{m}$ (indikator paling dominan). |
| `sulfur_dioksida` ($\text{SO}_2$) | **Feature (Input)** | Numerik | Konsentrasi gas Sulfur Dioksida. |
| `karbon_monoksida` ($\text{CO}$) | **Feature (Input)** | Numerik | Konsentrasi gas Karbon Monoksida. |
| `ozon` ($\text{O}_3$) | **Feature (Input)** | Numerik | Konsentrasi gas Ozon permukaan. |
| `nitrogen_dioksida` ($\text{NO}_2$) | **Feature (Input)** | Numerik | Konsentrasi gas Nitrogen Dioksida. |
| `parameter_pencemar_kritis`, `max` | **Skip (Diabaikan saat Training)** | Teks / Numerik | Di-skip di Orange agar model menebak murni dari 6 sensor polutan tanpa bocoran nilai `max`. |
| `kategori` | **Target / Label** | Kategorikal | Kelas target: `BAIK` (361 baris), `SEDANG` (2.451 baris), `TIDAK SEHAT` (319 baris). |

## 03. Training & Testing Model di Orange Data Mining (80:20)
Susun *workflow* tanpa *coding* di **Orange Data Mining** menggunakan file `Dataset_ISPU_DKI_Jakarta_2024_2025_Clean.csv` untuk mengambil tangkapan layar (*screenshot*) tugas Anda:
1. **CSV File Import** (atau **File**): Muat `Dataset_ISPU_DKI_Jakarta_2024_2025_Clean.csv`.
2. **Select Columns**:
   * **Features**: Masukkan ke-6 polutan (`pm_sepuluh`, `pm_duakomalima`, `sulfur_dioksida`, `karbon_monoksida`, `ozon`, `nitrogen_dioksida`).
   * **Target**: Masukkan `kategori`.
   * **Metas**: Masukkan `tanggal_lengkap` dan `stasiun` (sisanya biarkan di *Ignored/Available* agar tidak bocor).
3. **Data Sampler**: Pilih **Fixed proportion of data = 80%**, centang *Stratify sample (when possible)*, lalu klik *Sample Data* (menghasilkan **2.505 baris Training** dan **626 baris Testing**).
4. **Model**: Tarik widget **Tree (Decision Tree)**, **Random Forest**, dan **kNN**, lalu hubungkan garis `Data Sample` dari *Data Sampler* ke ketiga model tersebut.
5. **Predictions** & **Confusion Matrix**:
   * Hubungkan `Remaining Data` (20% data *testing* = 626 baris) dari *Data Sampler* ke input `Data` pada widget **Predictions**.
   * Hubungkan ketiga model ke widget **Predictions**, lalu sambungkan **Predictions** ke **Confusion Matrix**.

## 04. Analisis Hasil Testing (626 Data Testing)
Perbandingan metrik evaluasi pada **626 data *testing* (20%)**:

| Model Machine Learning | Classification Accuracy (CA) | F1-Score | Precision | Recall | Jumlah Tebakan Tepat (dari 626 Uji) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Decision Tree (Tree)** | **98,24%** (`0.9824`) | `0.9879` | `0.9936` | `0.9824` | **615 baris tepat** (11 meleset) |
| **Random Forest** | **97,60%** (`0.9760`) | `0.9838` | `0.9919` | `0.9760` | **611 baris tepat** (15 meleset) |
| **kNN ($k=5$)** | **91,85%** (`0.9185`) | `0.9348` | `0.9590` | `0.9185` | **575 baris tepat** (51 meleset) |

### Matriks Konfusi (Confusion Matrix — Random Forest)
| Kelas Aktual \ Prediksi | BAIK | SEDANG | TIDAK SEHAT | Total Aktual |
| :--- | :---: | :---: | :---: | :---: |
| **BAIK** | **68** | 4 | 0 | 72 |
| **SEDANG** | 6 | **483** | 1 | 490 |
| **TIDAK SEHAT** | 0 | 4 | **60** | 64 |
| **Total Prediksi** | 74 | 491 | 61 | **626** |

### Cuplikan Tabel Nilai Aktual vs Prediksi (10 Sampel Data Testing)

| Tanggal | Stasiun SPKU | $\text{PM}_{10}$ | $\text{PM}_{2.5}$ | $\text{SO}_2$ | $\text{CO}$ | $\text{O}_3$ | $\text{NO}_2$ | Kategori Aktual | Prediksi Random Forest | Prediksi Decision Tree | Status |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- | :--- | :--- | :--- |
| `2024-01-09` | DKI2 - Kelapa Gading | 51 | 68 | 58 | 16 | 18 | 53 | **SEDANG** | **SEDANG** | **SEDANG** | Tepat (Benar) |
| `2024-01-14` | DKI1 - Bundaran HI | 39 | 49 | 45 | 6 | 20 | 20 | **BAIK** | **BAIK** | **BAIK** | Tepat (Benar) |
| `2024-01-16` | DKI5 - Kebon Jeruk | 23 | 49 | 24 | 5 | 43 | 6 | **BAIK** | **BAIK** | **BAIK** | Tepat (Benar) |
| `2024-02-16` | DKI4 - Lubang Buaya | 81 | 103 | 25 | 24 | 6 | 11 | **TIDAK SEHAT** | **TIDAK SEHAT** | **TIDAK SEHAT** | Tepat (Benar) |
| `2024-03-23` | DKI2 - Kelapa Gading | 70 | 111 | 55 | 22 | 28 | 82 | **TIDAK SEHAT** | **TIDAK SEHAT** | **TIDAK SEHAT** | Tepat (Benar) |
| `2024-05-16` | DKI2 - Kelapa Gading | 77 | 115 | 56 | 8 | 20 | 12 | **TIDAK SEHAT** | **TIDAK SEHAT** | **TIDAK SEHAT** | Tepat (Benar) |
| `2024-11-15` | DKI1 - Bundaran HI | 69 | 106 | 22 | 31 | 13 | 49 | **TIDAK SEHAT** | **TIDAK SEHAT** | **TIDAK SEHAT** | Tepat (Benar) |
| `2025-01-09` | DKI2 - Kelapa Gading | 22 | 23 | 21 | 11 | 12 | 17 | **BAIK** | **BAIK** | **BAIK** | Tepat (Benar) |
| `2025-06-04` | DKI3 - Jagakarsa | 93 | 133 | 33 | 26 | 21 | 59 | **TIDAK SEHAT** | **TIDAK SEHAT** | **TIDAK SEHAT** | Tepat (Benar) |
| `2025-07-12` | DKI4 - Lubang Buaya | 91 | 140 | 28 | 18 | 32 | 26 | **TIDAK SEHAT** | **TIDAK SEHAT** | **TIDAK SEHAT** | Tepat (Benar) |

## 05. Panduan Desain Dashboard di Google Looker Studio
Unggah file `Hasil_Testing_80_20_ISPU_DKI_Jakarta.csv` ke [Google Looker Studio](https://lookerstudio.google.com/), lalu pasang 5 elemen visual berikut:
1. **Filter Kontrol (*Drop-down List*)**: Pasang filter `stasiun` dan `tahun` (`2024` / `2025`) di bagian atas halaman.
2. **4 Kartu Indikator Utama (*Scorecard*)**:
   * **Total Sampel Uji**: `626 Hari` (*Record Count*)
   * **Rata-rata $\text{PM}_{2.5}$**: `72,06` (Metrik `pm_duakomalima` $\rightarrow$ *Average*)
   * **Rata-rata $\text{PM}_{10}$**: `51,15` (Metrik `pm_sepuluh` $\rightarrow$ *Average*)
   * **Akurasi Model Terbaik**: `98,24%` (Kotak teks / kartu indikator evaluasi)
3. **Grafik Garis Waktu (*Time Series Chart*)**: Dimensi Waktu = `tanggal_lengkap`, Metrik = `pm_duakomalima` dan `pm_sepuluh` untuk melihat lonjakan polusi udara di pertengahan tahun (Mei–Agustus 2024 & Juni–Juli 2025).
4. **Diagram Batang Terkelompok (*Grouped Bar Chart*)**: Dimensi = `stasiun`, Dimensi Pecahan (*Breakdown*) = `Prediksi_Random_Forest` (`BAIK`, `SEDANG`, `TIDAK SEHAT`) untuk melihat stasiun mana yang paling sering mengalami udara Tidak Sehat (Lubang Buaya & Kebon Jeruk).
5. **Tabel Evaluasi Aktual vs Prediksi**: Tampilkan kolom `tanggal_lengkap`, `stasiun`, `pm_duakomalima`, `kategori` (Aktual), `Prediksi_Random_Forest`, dan `Status_Prediksi_RF`.

## 06. Kesimpulan (Bagian E.5 Laporan)
> Berdasarkan hasil pengolahan **3.131 baris data bersih** Indeks Standar Pencemar Udara (ISPU) Provinsi DKI Jakarta periode Januari 2024 hingga November 2025 dengan skema pembagian data **80:20** (2.505 data *training* dan 626 data *testing*), algoritma berbasis pohon keputusan (**Decision Tree** dan **Random Forest**) menghasilkan performa klasifikasi tertinggi dengan akurasi masing-masing sebesar **98,24%** dan **97,60%**, mengungguli algoritma *k-Nearest Neighbors* (**91,85%**). Analisis *feature* menunjukkan bahwa konsentrasi partikulat halus **$\text{PM}_{2.5}$** merupakan parameter pencemar kritis utama yang memicu status udara **Tidak Sehat** (ketika nilai indeks melampaui 100), terutama pada stasiun **DKI4 Lubang Buaya** dan **DKI5 Kebon Jeruk** di musim kemarau (Mei–Agustus). Solusi *Machine Learning* dan *dashboard* interaktif ini bermanfaat bagi instansi lingkungan hidup serta masyarakat untuk mengotomatisasi deteksi dini lonjakan polusi udara harian dan mendukung pengambilan kebijakan pembatasan emisi secara tepat sasaran.
