import { expect, test } from "@playwright/test";

const PAGES = [
  { path: "/", h1: "Kualitas udara DKI Jakarta" },
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
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });
}

test("ringkasan: KPI dari API dan filter stasiun mengubah angka", async ({ page, request }) => {
  const summary = await (await request.get("/api/stats/summary")).json();
  await page.goto("/");
  const jumlah = page.locator("p", { hasText: "Jumlah data" }).locator("..");
  await expect(jumlah).toContainText(summary.rows.toLocaleString("id-ID"));

  const meta = await (await request.get("/api/meta")).json();
  const st = meta.stations[0];
  await page.getByLabel("Stasiun", { exact: true }).selectOption(st.code);
  await expect(page).toHaveURL(new RegExp(`station=${st.code}`));
  await expect(jumlah).toContainText(st.rows.toLocaleString("id-ID"));
});

test("tren: input tanggal dd/mm/yyyy menyaring data dan menolak tanggal tidak valid", async ({
  page,
}) => {
  await page.goto("/tren");
  const start = page.getByLabel("Dari tanggal (dd/mm/yyyy)");
  await start.pressSequentially("01052025");
  await start.press("Enter");
  await expect(page).toHaveURL(/start=2025-05-01/);
  await expect(start).toHaveValue("01/05/2025");
  await start.fill("31/02/2025");
  await start.press("Enter");
  await expect(page.getByText("Format tanggal dd/mm/yyyy")).toBeVisible();
  await expect(page).toHaveURL(/start=2025-05-01/);
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
  await page.getByRole("button", { name: "Gunakan tema gelap" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
});
