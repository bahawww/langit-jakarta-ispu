import type { Page } from "@playwright/test";

/**
 * Lebar halaman yang melebihi layar (px). Pakai clientWidth, bukan innerWidth: di emulasi mobile
 * browser melebarkan innerWidth mengikuti isi halaman, sehingga scrollWidth - innerWidth selalu 0.
 */
export const horizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
