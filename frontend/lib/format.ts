const num = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });
const int = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const idx = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });
const pct = new Intl.NumberFormat("id-ID", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const metric = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});
// Tanggal ISO dari API adalah tanggal kalender; format di UTC agar tidak bergeser zona waktu.
const day = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "UTC" });
const dayLong = new Intl.DateTimeFormat("id-ID", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const dateTime = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

const dash = "–";

export const fmt = {
  num: (v: number | null | undefined) => (v == null || Number.isNaN(v) ? dash : num.format(v)),
  int: (v: number | null | undefined) => (v == null ? dash : int.format(v)),
  /** precision/recall/F1: 4 desimal, sama dengan angka acuan Orange */
  metric: (v: number | null | undefined) =>
    v == null || Number.isNaN(v) ? dash : metric.format(v),
  /** nilai indeks hasil prediksi: 1 desimal */
  idx: (v: number | null | undefined) => (v == null || Number.isNaN(v) ? dash : idx.format(v)),
  pct: (v: number | null | undefined) => (v == null || Number.isNaN(v) ? dash : pct.format(v)),
  date: (iso: string | null | undefined) => (iso ? day.format(new Date(`${iso}T00:00:00Z`)) : dash),
  dayShort: (iso: string) => dayLong.format(new Date(`${iso}T00:00:00Z`)),
  dateTime: (iso: string | null | undefined) =>
    iso ? `${dateTime.format(new Date(iso))} WIB` : dash,
};
