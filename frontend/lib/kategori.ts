// Satu sumber warna kategori ISPU untuk badge, tabel, dan chart.
// Warna latar solid + teks dengan kontras >= 4.5:1 (WCAG AA) di light maupun dark mode.
export const KATEGORI = [
  "BAIK",
  "SEDANG",
  "TIDAK SEHAT",
  "SANGAT TIDAK SEHAT",
  "BERBAHAYA",
] as const;
export type Kategori = (typeof KATEGORI)[number];

export const KATEGORI_STYLE: Record<Kategori, { bg: string; fg: string; label: string }> = {
  BAIK: { bg: "#15803d", fg: "#ffffff", label: "Baik" },
  SEDANG: { bg: "#facc15", fg: "#422006", label: "Sedang" },
  "TIDAK SEHAT": { bg: "#dc2626", fg: "#ffffff", label: "Tidak sehat" },
  "SANGAT TIDAK SEHAT": { bg: "#7e22ce", fg: "#ffffff", label: "Sangat tidak sehat" },
  BERBAHAYA: { bg: "#450a0a", fg: "#ffffff", label: "Berbahaya" },
};

export const AMBANG = [
  { value: 50, label: "Batas BAIK (50)" },
  { value: 100, label: "Batas SEDANG (100)" },
];

export function isKategori(v: string): v is Kategori {
  return (KATEGORI as readonly string[]).includes(v);
}

export function kategoriStyle(v: string) {
  return isKategori(v) ? KATEGORI_STYLE[v] : { bg: "#64748b", fg: "#ffffff", label: v };
}

export function severity(v: string): number {
  return isKategori(v) ? KATEGORI.indexOf(v) : -1;
}
