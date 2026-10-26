import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { horizontalOverflow } from "./helpers";

const USER = process.env.E2E_ADMIN_USER;
const PASS = process.env.E2E_ADMIN_PASSWORD;
// CSV bersih asli (di-mount read-only): upload ulang = 0 perubahan, data produksi tidak berubah.
const CLEAN_CSV =
  process.env.E2E_CLEAN_CSV ?? path.resolve("../Dataset_ISPU_DKI_Jakarta_2024_2025_Clean.csv");

test.describe.configure({ mode: "serial" });
test.skip(!USER || !PASS, "set E2E_ADMIN_USER dan E2E_ADMIN_PASSWORD");

test("admin wajib login; password salah ditolak", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.getByLabel("Username").fill(USER!);
  await page.getByLabel("Password").fill("password-salah");
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "salah" })).toBeVisible();
});

test("login, upload CSV, lihat laporan, latih ulang, logout", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Username").fill(USER!);
  await page.getByLabel("Password").fill(PASS!);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.getByRole("heading", { name: "Admin", level: 1 })).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .exclude("canvas")
    .analyze();
  expect(
    axe.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? "")).map((v) => v.id),
  ).toEqual([]);

  // nama file panjang tidak boleh melebarkan halaman (regresi: overflow horizontal di mobile)
  const longName =
    "Filedata_Data_Indeks_Standar_Pencemar_Udara_ISPU_di_Provinsi_DKI_Jakarta_2024_2025_versi_final.csv";
  await page
    .getByLabel("File CSV (maks. 5 MB)")
    .setInputFiles({ name: longName, mimeType: "text/csv", buffer: Buffer.from("a,b\n1,2\n") });
  await expect(page.getByText(longName)).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  await page.getByRole("button", { name: `Hapus ${longName}` }).click();
  await expect(page.getByText(longName)).toHaveCount(0);

  await page.getByLabel("File CSV (maks. 5 MB)").setInputFiles(CLEAN_CSV);
  // file terpilih tampil dengan nama dan bisa dihapus dari pilihan
  const chosen = page.locator("section[aria-labelledby=h-upload] form");
  await expect(chosen.getByText(path.basename(CLEAN_CSV))).toBeVisible();
  await expect(chosen.getByRole("button", { name: /^Hapus .*\.csv$/ })).toBeVisible();
  await page.getByRole("button", { name: "Upload" }).click();
  const report = page.locator('section[aria-labelledby="h-upload"]');
  await expect(report.getByText("Total baris file")).toBeVisible();
  await expect(
    report.getByText("Tidak ada perubahan data, retraining tidak diperlukan."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Latih ulang sekarang" }).click();
  await expect(page.getByText("Training diantrekan")).toBeVisible();

  await page.getByRole("button", { name: "Keluar" }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
  expect((await page.request.get("/api/auth/me")).status()).toBe(401);
});
