/** Kode pencemar kritis di data sumber -> label tampilan. */
export const KRITIS_LABEL: Record<string, string> = {
  PM25: "PM2.5",
  PM10: "PM10",
  SO2: "SO2",
  CO: "CO",
  O3: "O3",
  NO2: "NO2",
};

export const kritisLabel = (v: string) => KRITIS_LABEL[v] ?? v;

/** "DKI5 - Kebon Jeruk (Jakarta Barat)" -> "Kebon Jeruk" untuk sumbu grafik. */
export function shortStation(name: string) {
  return name.replace(/^DKI\d+\s*-?\s*/, "").replace(/\s*\(.*\)$/, "") || name;
}
