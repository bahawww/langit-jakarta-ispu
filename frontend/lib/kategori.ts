// Kategori ISPU menurut Permen LHK No. 14/2020. Warna ada di token CSS (--ispu-*), bukan di sini:
// komponen memakai kelas `ua-badge--*` / `var(--ispu-*)`, grafik membaca token lewat useChartColors().
export const KATEGORI = [
  "BAIK",
  "SEDANG",
  "TIDAK SEHAT",
  "SANGAT TIDAK SEHAT",
  "BERBAHAYA",
] as const;
export type Kategori = (typeof KATEGORI)[number];

export const KATEGORI_META: Record<
  Kategori,
  { label: string; range: string; badge: string; token: string }
> = {
  BAIK: { label: "Baik", range: "0–50", badge: "ua-badge--baik", token: "--ispu-baik" },
  SEDANG: { label: "Sedang", range: "51–100", badge: "ua-badge--sedang", token: "--ispu-sedang" },
  "TIDAK SEHAT": {
    label: "Tidak Sehat",
    range: "101–200",
    badge: "ua-badge--tidak-sehat",
    token: "--ispu-tidak-sehat",
  },
  "SANGAT TIDAK SEHAT": {
    label: "Sangat Tidak Sehat",
    range: "201–300",
    badge: "ua-badge--sangat-tidak-sehat",
    token: "--ispu-sangat-tidak-sehat",
  },
  BERBAHAYA: {
    label: "Berbahaya",
    range: "> 300",
    badge: "ua-badge--berbahaya",
    token: "--ispu-berbahaya",
  },
};

export const AMBANG = [
  { value: 50, label: "Batas Baik (50)" },
  { value: 100, label: "Batas Sedang (100)" },
];

export function isKategori(v: string): v is Kategori {
  return (KATEGORI as readonly string[]).includes(v);
}

export function kategoriMeta(v: string) {
  return isKategori(v)
    ? KATEGORI_META[v]
    : { label: v, range: "", badge: "ua-badge--neutral", token: "--text-muted" };
}

export function severity(v: string): number {
  return isKategori(v) ? KATEGORI.indexOf(v) : -1;
}

/** Hari dengan kategori Tidak Sehat atau lebih buruk. */
export const UNHEALTHY_FROM = KATEGORI.indexOf("TIDAK SEHAT");
export const isUnhealthy = (v: string) => severity(v) >= UNHEALTHY_FROM;

/** Kategori dari nilai indeks (Permen LHK No. 14/2020): 0–50, 51–100, 101–200, 201–300, di atas 300. */
export function kategoriOf(index: number): Kategori {
  if (index <= 50) return "BAIK";
  if (index <= 100) return "SEDANG";
  if (index <= 200) return "TIDAK SEHAT";
  if (index <= 300) return "SANGAT TIDAK SEHAT";
  return "BERBAHAYA";
}
