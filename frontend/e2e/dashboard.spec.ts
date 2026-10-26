import { expect, test } from "@playwright/test";

import { horizontalOverflow } from "./helpers";

const PAGES = [
  { path: "/", h1: "Hasil pelatihan model" },
  { path: "/tren", h1: "Tren kualitas udara" },
  { path: "/stasiun", h1: "Perbandingan antar-stasiun" },
  { path: "/evaluasi", h1: "Evaluasi model" },
  { path: "/data", h1: "Data pengukuran" },
];

for (const p of PAGES) {
  test(`${p.path} tampil tanpa error dan tanpa scroll horizontal`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(p.path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(p.h1);
    await expect(page.getByRole("alert").filter({ hasText: "Gagal memuat data" })).toHaveCount(0);
    await page.waitForLoadState("networkidle");
    await expect(page.locator('[role="status"]')).toHaveCount(0); // skeleton hilang
    const overflow = await horizontalOverflow(page);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });
}

const id2 = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

test("hasil model: kartu metrik dari API dan filter stasiun/tahun mengubah angka", async ({
  page,
  request,
}) => {
  const all = await (await request.get("/api/baseline/orange")).json();
  await page.goto("/");
  const card = (name: string) =>
    page.getByRole("region", { name: "Metrik utama" }).locator(".ua-metric", { hasText: name });
  await expect(card("Total sampel uji")).toContainText(`${all.rows.toLocaleString("id-ID")} hari`);
  await expect(card("Rata-rata PM2.5")).toContainText(id2.format(all.avg_pm_duakomalima));
  await expect(card("Rata-rata PM10")).toContainText(id2.format(all.avg_pm_sepuluh));
  const best = [...all.models].sort((a, b) => b.accuracy - a.accuracy)[0];
  await expect(card("Akurasi model terbaik")).toContainText(best.model);

  const meta = await (await request.get("/api/meta")).json();
  const st = meta.stations[0];
  const year = meta.years.at(-1);
  const sub = await (
    await request.get(`/api/baseline/orange?station=${st.code}&year=${year}`)
  ).json();
  await page.getByLabel("Stasiun", { exact: true }).selectOption(st.code);
  await page.getByLabel("Tahun", { exact: true }).selectOption(String(year));
  await expect(page).toHaveURL(new RegExp(`year=${year}`));
  await expect(card("Total sampel uji")).toContainText(`${sub.rows.toLocaleString("id-ID")} hari`);
  await expect(card("Rata-rata PM2.5")).toContainText(id2.format(sub.avg_pm_duakomalima));
});

test("hasil model: tabel aktual vs prediksi, status, dan model yang dipilih", async ({
  page,
  request,
}) => {
  const rows = await (await request.get("/api/baseline/orange/rows")).json();
  const wrong = (key: string) =>
    rows.filter((r: Record<string, string>) => r[key] !== r.kategori).length;
  await page.goto("/");
  const table = page.getByRole("region", { name: "Tabel kategori aktual dan prediksi" });
  await expect(table.locator("tbody tr")).toHaveCount(20);
  await expect(table.getByText("Tepat (Benar)").first()).toBeVisible();

  await page.getByRole("button", { name: "Hanya meleset" }).click();
  await expect(page.getByText(`${wrong("pred_random_forest")} baris`)).toBeVisible();
  await expect(table.locator("tbody tr").first()).toContainText("Meleset (Salah)");
  await expect(table.getByText("Tepat (Benar)")).toHaveCount(0);

  await page.getByLabel("Model untuk grafik dan tabel").selectOption("knn");
  await expect(page).toHaveURL(/model=knn/);
  await expect(page.getByText(`${wrong("pred_knn")} baris`)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /prediksi kNN \(k=5\) per stasiun/ }),
  ).toBeVisible();
});

test("tanggal: preset, kalender, batas data, Esc, dan reset", async ({ page, request }) => {
  const meta = await (await request.get("/api/meta")).json();
  await page.goto("/tren");
  const trigger = page.locator("#f-date");
  const dialog = page.getByRole("dialog", { name: "Pilih rentang tanggal" });
  await expect(trigger).toContainText("Semua tanggal");

  // preset tahun: batas akhir dipangkas ke tanggal data terakhir
  const year = meta.years.at(-1);
  await trigger.click();
  await dialog.getByRole("button", { name: `Tahun ${year}` }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`start=${year}-01-01&end=${meta.date_max}`));
  await expect(trigger).toContainText(`01/01/${year}`);

  // kalender: pilihan tahun hanya yang ada di data, lalu pilih 1–22 Mei 2025
  await trigger.click();
  const years = dialog.getByRole("combobox", { name: "Pilih tahun" }).locator("option");
  await expect(years).toHaveText(meta.years.map(String));
  await dialog.getByRole("combobox", { name: "Pilih bulan" }).selectOption({ label: "Mei" });
  await dialog.getByRole("button", { name: /, 1 Mei 2025/ }).click();
  await dialog.getByRole("button", { name: /, 22 Mei 2025/ }).click();
  await expect(dialog.getByText("22 hari")).toBeVisible();
  await dialog.getByRole("button", { name: "Terapkan" }).click();
  await expect(page).toHaveURL(/start=2025-05-01&end=2025-05-22/);
  await expect(trigger).toContainText("01/05/2025 – 22/05/2025");

  // klik pertama memulai rentang baru; urutan klik terbalik menghasilkan rentang yang sama
  await trigger.click();
  await dialog.getByRole("button", { name: /, 22 Mei 2025/ }).click();
  await dialog.getByRole("button", { name: /, 1 Mei 2025/ }).click();
  await expect(dialog.getByText("22 hari")).toBeVisible();

  // Esc menutup tanpa mengubah filter dan mengembalikan fokus ke tombol
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page).toHaveURL(/end=2025-05-22/);

  await trigger.click();
  await dialog.getByRole("button", { name: "Semua data" }).click();
  await expect(page).not.toHaveURL(/start=/);
  await expect(trigger).toContainText("Semua tanggal");
});

test("data: cari, badge label tidak konsisten, dan ekspor CSV", async ({ page }) => {
  await page.goto("/data");
  const only = page.getByLabel("Hanya label tidak konsisten");
  await only.click(); // checkbox terkontrol oleh URL: tunggu state, jangan pakai check() yang langsung memeriksa
  await expect(only).toBeChecked();
  await expect(page.getByText(/^21 baris$/)).toBeVisible();
  await expect(page.getByText(/Label tidak konsisten/).first()).toBeVisible();
  const href = await page.getByRole("link", { name: "Ekspor CSV" }).getAttribute("href");
  expect(href).toContain("inconsistent=true");
  const csv = await (await page.request.get(href!)).text();
  expect(csv.trim().split("\n")).toHaveLength(22);
});

test("tema gelap bisa diaktifkan", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.getByRole("button", { name: "Ganti ke mode gelap" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
