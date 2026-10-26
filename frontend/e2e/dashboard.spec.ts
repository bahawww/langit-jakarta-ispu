import { expect, test } from "@playwright/test";

import { horizontalOverflow } from "./helpers";

const PAGES = [
  { path: "/", h1: "Ringkasan kualitas udara" },
  { path: "/tren", h1: "Tren kualitas udara" },
  { path: "/stasiun", h1: "Perbandingan antar-stasiun" },
  { path: "/prediksi", h1: "Prediksi 7 hari" },
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

test("ringkasan: kartu metrik dari API dan filter stasiun mengubah angka", async ({
  page,
  request,
}) => {
  const unhealthy = (s: { by_kategori: Record<string, number> }) =>
    Object.entries(s.by_kategori)
      .filter(([k]) => k !== "BAIK" && k !== "SEDANG")
      .reduce((a, [, n]) => a + n, 0);
  const summary = await (await request.get("/api/stats/summary")).json();
  const meta = await (await request.get("/api/meta")).json();
  await page.goto("/");
  // chip meta di header: jumlah seluruh data
  await expect(page.getByRole("term").filter({ hasText: "Data" })).toBeVisible();
  await expect(
    page
      .getByRole("definition")
      .filter({ hasText: `${meta.total_rows.toLocaleString("id-ID")} hari-stasiun` }),
  ).toBeVisible();

  const card = page.locator(".ua-card", { hasText: "Hari Tidak Sehat atau lebih buruk" });
  await expect(card).toContainText(unhealthy(summary).toLocaleString("id-ID"));

  const st = meta.stations[0];
  const one = await (await request.get(`/api/stats/summary?station=${st.code}`)).json();
  await page.getByLabel("Stasiun", { exact: true }).selectOption(st.code);
  await expect(page).toHaveURL(new RegExp(`station=${st.code}`));
  await expect(card).toContainText(unhealthy(one).toLocaleString("id-ID"));
});

test("ringkasan: kesimpulan singkat dihitung dari data, bukan teks tetap", async ({
  page,
  request,
}) => {
  const summary = await (await request.get("/api/stats/summary")).json();
  await page.goto("/");
  const hero = page.getByRole("region", { name: "Kesimpulan singkat" });
  const pct = new Intl.NumberFormat("id-ID", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(summary.pct_tidak_sehat);
  await expect(hero).toContainText(pct);
  await expect(page.getByRole("region", { name: "Skala ISPU" })).toContainText(
    "Sangat Tidak Sehat",
  );
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

test("prediksi: grid 7 hari per stasiun dengan label kategori", async ({ page, request }) => {
  const fc = await (await request.get("/api/forecast")).json();
  test.skip(fc.items.length === 0, "belum ada forecast");
  await page.goto("/prediksi");
  await expect(page.getByText("tanggal data terakhir")).toBeVisible();
  const rows = page.locator("table").first().locator("tbody tr");
  await expect(rows).toHaveCount(
    new Set(fc.items.map((i: { station_code: string }) => i.station_code)).size,
  );
  await expect(rows.first().locator("td")).toHaveCount(7);
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
