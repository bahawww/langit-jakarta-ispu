# Panduan Dashboard Google Looker Studio – ISPU DKI Jakarta

Panduan ini menggantikan section 05 di file summary. **Semua angka sudah dicek ulang langsung dari CSV.** Beberapa angka di summary lama ternyata keliru (lihat bagian "Koreksi angka" di bawah).

> Versi HTML interaktif ada di `Dashboard_ISPU_DKI_Jakarta.html` (bisa langsung dibuka di browser) dan bisa dipakai sebagai acuan tampilan atau tangkapan layar cadangan.

---

## 1. Siapkan sumber data

1. Buka [Google Looker Studio](https://lookerstudio.google.com/), pilih **Create → Data source → File Upload**, lalu unggah `Hasil_Testing_80_20_ISPU_DKI_Jakarta.csv`.
2. Di layar pengaturan field, cek tipenya:
   - `tanggal_lengkap` → **Date (YYYYMMDD)**
   - `tahun` → ubah ke **Text**, supaya filter dropdown menampilkan 2024/2025 dan nilainya tidak ikut dijumlahkan
   - `bulan`, `tanggal`, `periode_data` → **Text** (agregasi: None)
   - `pm_sepuluh`, `pm_duakomalima`, `sulfur_dioksida`, `karbon_monoksida`, `ozon`, `nitrogen_dioksida`, `max` → **Number**
3. Tambahkan **calculated field** (klik **Add a field**):

| Nama field | Formula |
|---|---|
| `Benar_RF` | `CASE WHEN kategori = Prediksi_Random_Forest THEN 1 ELSE 0 END` |
| `Benar_DT` | `CASE WHEN kategori = Prediksi_Decision_Tree THEN 1 ELSE 0 END` |
| `Benar_kNN` | `CASE WHEN kategori = Prediksi_kNN THEN 1 ELSE 0 END` |
| `Status_Prediksi_DT` | `CASE WHEN kategori = Prediksi_Decision_Tree THEN "Tepat (Benar)" ELSE "Meleset (Salah)" END` |

> Catatan: nilai polutan di dataset ini adalah **nilai indeks ISPU**, bukan konsentrasi µg/m³. Kolom `max` adalah nilai tertinggi dari keenam polutan, dan `kategori` ditentukan dari nilai itu (0–50 BAIK, 51–100 SEDANG, 101–200 TIDAK SEHAT). Beri label sumbu "Indeks ISPU".

---

## 2. Elemen dashboard

### a. Filter kontrol (Drop-down list), di bagian atas halaman
- Filter 1: field `stasiun`
- Filter 2: field `tahun`

### b. Kartu indikator (Scorecard)

| Scorecard | Pengaturan | Nilai tanpa filter |
|---|---|---|
| Total Sampel Uji | Metric: `Record Count` | **626** |
| Rata-rata PM2.5 | Metric: `pm_duakomalima` → **Average** | **71,64** |
| Rata-rata PM10 | Metric: `pm_sepuluh` → **Average** | **48,80** |
| Akurasi Random Forest | Metric: `Benar_RF` → **Average**, format **Percent** | **97,60%** |
| Akurasi Decision Tree (terbaik) | Metric: `Benar_DT` → **Average**, format **Percent** | **98,24%** |

Akurasi dibuat dari calculated field (bukan kotak teks), jadi nilainya ikut berubah saat filter stasiun/tahun dipakai.

### c. Grafik garis waktu (Time series)
- Dimension: `tanggal_lengkap` · Metric: `pm_duakomalima` (Average) dan `pm_sepuluh` (Average)
- Lonjakan polusi terlihat di **Mei–Agustus 2024** dan **Mei–Juli 2025**.
- Tips: data uji hanya 626 titik untuk 23 bulan, jadi garisnya agak jarang. Ubah granularitas dimensi ke **Year Month** supaya trennya lebih mulus.

### d. Diagram batang terkelompok (Grouped bar)
- Dimension: `stasiun` · Breakdown dimension: `Prediksi_Random_Forest` · Metric: `Record Count`
- Hasil prediksi RF untuk TIDAK SEHAT: **Kebon Jeruk 20**, **Lubang Buaya 16**, Kelapa Gading 13, Bundaran HI 10, Jagakarsa 2.
- Warna seri disamakan: BAIK hijau, SEDANG kuning, TIDAK SEHAT merah (Style → atur warna per nilai dimensi).

### e. Tabel evaluasi aktual vs prediksi
- Kolom: `tanggal_lengkap`, `stasiun`, `pm_duakomalima`, `max`, `kategori` (Aktual), `Prediksi_Random_Forest`, `Status_Prediksi_RF`
- Opsional: tambahkan `Prediksi_Decision_Tree` dan `Status_Prediksi_DT`.
- Supaya statusnya mudah dibaca, pakai conditional formatting: `Status_Prediksi_RF` berisi "Meleset" → teks merah.

### f. (Opsional) Tabel perbandingan model
Tabel tanpa dimensi, dengan metrik `Benar_RF`, `Benar_DT`, `Benar_kNN` (Average, Percent) → 97,60% / 98,24% / 91,85%.

---

## 3. Angka acuan yang benar (dari CSV)

**Metrik evaluasi pada 626 data uji** (precision/recall/F1 = *weighted average*):

| Model | Tepat | Meleset | Akurasi | Precision | Recall | F1 |
|---|---|---|---|---|---|---|
| **Decision Tree** | 615 | 11 | **98,24%** | 0,9828 | 0,9824 | 0,9825 |
| Random Forest | 611 | 15 | 97,60% | 0,9762 | 0,9760 | 0,9761 |
| kNN (k=5) | 575 | 51 | 91,85% | 0,9170 | 0,9185 | 0,9155 |

**Confusion matrix** (baris = aktual, kolom = prediksi BAIK / SEDANG / TIDAK SEHAT):

| Aktual | Random Forest | Decision Tree | kNN |
|---|---|---|---|
| BAIK (72) | 68 / 4 / 0 | 69 / 3 / 0 | 51 / 21 / 0 |
| SEDANG (490) | 6 / 483 / 1 | 6 / 483 / 1 | 9 / 477 / 4 |
| TIDAK SEHAT (64) | 0 / 4 / 60 | 0 / 1 / 63 | 0 / 17 / 47 |

---

## 4. Koreksi angka di file summary

| Di summary | Seharusnya | Keterangan |
|---|---|---|
| Rata-rata PM2.5 = 72,06 | **71,64** | data uji (data bersih: 71,96) |
| Rata-rata PM10 = 51,15 | **48,80** | data uji (data bersih: 49,04) |
| DT: Precision 0,9936 · F1 0,9879 | **0,9828 · 0,9825** | angka lama lebih tinggi dari akurasinya, padahal itu tidak mungkin untuk weighted average |
| RF: Precision 0,9919 · F1 0,9838 | **0,9762 · 0,9761** | |
| kNN: Precision 0,9590 · F1 0,9348 | **0,9170 · 0,9155** | |
| Puncak polusi 2025 "Juni–Juli" | **Mei–Juli 2025** | hari TIDAK SEHAT: Mei 27, Jun 57, Jul 38 |
| Fitur disebut "konsentrasi" polutan (judul, tabel §02, kesimpulan) | **nilai indeks ISPU** per polutan | `max` selalu sama dengan nilai tertinggi dari 6 kolom polutan, dan kategori ditentukan dari ambang indeks 50/100. Contohnya, CO bernilai 2–70, yang tidak masuk akal sebagai konsentrasi µg/m³ |

Cek ulang widget **Test and Score** di Orange. Kalau angka Precision/F1 di sana berbeda, pastikan pilihan *Target class* = **(Average over classes)**.

---

## 5. Temuan kualitas data (bisa ditambahkan ke Analisis/Kesimpulan)

- 21 baris stasiun **DKI1 Bundaran HI bulan Desember 2024** punya label yang tidak sesuai ambang ISPU: 19 baris berlabel BAIK padahal `max` 53–78 (seharusnya SEDANG), dan 2 baris berlabel SEDANG padahal `max` 101/103 (seharusnya TIDAK SEHAT).
- 5 baris di antaranya masuk data uji. **3 dari 15 kesalahan Random Forest dan 4 dari 11 kesalahan Decision Tree** terjadi tepat di baris-baris ini. Di semua baris itu, prediksi model justru sesuai ambang ISPU.
- Kalau prediksi dibandingkan dengan kategori menurut ambang ISPU (dari kolom `max`) dan bukan dengan label sumber, akurasinya menjadi: **Decision Tree 98,72%** (618/626, naik dari 98,24%), **Random Forest 97,76%** (612/626, naik dari 97,60%), dan **kNN 91,69%** (574/626, *turun* dari 91,85%, karena kNN ikut menebak 3 label yang salah).
- Artinya, untuk model berbasis pohon (DT dan RF), sebagian "kesalahan" sebenarnya disebabkan oleh label sumber, dan kesimpulan bahwa DT/RF lebih unggul dari kNN justru makin kuat. Angka resmi di laporan tetap memakai label asli (98,24% / 97,60% / 91,85%) supaya sama dengan hasil Orange.
