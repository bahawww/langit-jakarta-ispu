// Membuat app/tokens.css dari design/tokens.json dan app/ua.css dari design/bundle.css
// (design system "Udara Jakarta").
// Jalankan: npm run gen:tokens. Jangan edit app/tokens.css langsung.
import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const t = JSON.parse(readFileSync(new URL("design/tokens.json", root), "utf8"));
const [first, second] = t.color.themes.map((x) => x.id);

const pick = (v, theme) => (typeof v === "string" ? v : (v[theme] ?? v[first]));
const block = (selector, lines) => `${selector} {\n${lines.map((l) => `  ${l}`).join("\n")}\n}\n`;

const themed = (theme) => [
  `color-scheme: ${theme};`,
  ...t.color.tokens.map((x) => `--${x.name}: ${pick(x.value, theme)};`),
  ...(t.shadow?.tokens ?? []).map((x) => `--${x.name}: ${pick(x.value, theme)};`),
];
const fixed = [
  `--font-sans: ${t.type.families.sans};`,
  ...t.spacing.tokens.map((x) => `--${x.name}: ${x.value};`),
  ...t.radius.tokens.map((x) => `--${x.name}: ${x.value};`),
];

const styles = t.type.groups
  .flatMap((g) => g.styles)
  .map((s) =>
    block(`.ua-t-${s.name}`, [
      `font-size: ${s.fontSize};`,
      `line-height: ${s.lineHeight};`,
      `font-weight: ${s.fontWeight};`,
      ...(s.letterSpacing ? [`letter-spacing: ${s.letterSpacing};`] : []),
    ]),
  );

const css = [
  `/* ${t.name} — dibuat dari design/tokens.json oleh scripts/gen-tokens.mjs. Jangan diedit langsung. */\n`,
  block(`:root,\n[data-theme="${first}"]`, [...themed(first), ...fixed]),
  block(`[data-theme="${second}"]`, themed(second)),
  ...styles,
].join("\n");

writeFileSync(new URL("app/tokens.css", root), css);

// Komponen: buang @import font (font dimuat lewat next/font) dan bungkus dalam layer components
// supaya kelas utilitas Tailwind tetap bisa menimpanya.
const bundle = readFileSync(new URL("design/bundle.css", root), "utf8").replace(
  /^@import[^\n]*\n/m,
  "",
);
writeFileSync(
  new URL("app/ua.css", root),
  `/* Dibuat dari design/bundle.css oleh scripts/gen-tokens.mjs. Jangan diedit langsung. */\n@layer components {\n${bundle}}\n`,
);
console.log(`app/tokens.css: ${t.color.tokens.length} warna, ${styles.length} gaya teks`);
