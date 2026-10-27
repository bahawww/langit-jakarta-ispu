import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const scheme of ["light", "dark"] as const) {
  for (const path of [
    "/",
    "/data",
    "/data?tab=stasiun",
    "/data?tab=tabel",
    "/evaluasi",
    "/kesalahan",
    "/admin/login",
  ]) {
    test(`WCAG AA ${scheme} ${path}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .exclude("canvas") // grafik ECharts: alternatif teks lewat aria-label kontainer
        .analyze();
      const serious = result.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? ""),
      );
      expect(
        serious.map(
          (v) =>
            `${v.id}: ${v.nodes
              .slice(0, 3)
              .map((n) => n.target.join(" "))
              .join(", ")}`,
        ),
      ).toEqual([]);
    });
  }
}

for (const scheme of ["light", "dark"] as const) {
  test(`WCAG AA ${scheme} kalender tanggal terbuka`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/data");
    await page.locator("#f-date").click();
    await page.getByRole("dialog", { name: "Pilih rentang tanggal" }).waitFor();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .exclude("canvas")
      .analyze();
    const serious = result.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    );
    expect(
      serious.map(
        (v) =>
          `${v.id}: ${v.nodes
            .slice(0, 3)
            .map((n) => n.target.join(" "))
            .join(", ")}`,
      ),
    ).toEqual([]);
  });
}
