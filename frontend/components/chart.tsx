"use client";

import { BarChart, HeatmapChart, LineChart } from "echarts/charts";
import {
  AriaComponent,
  CalendarComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { useEffect, useRef, useSyncExternalStore } from "react";

import { KATEGORI, KATEGORI_META, type Kategori } from "@/lib/kategori";

echarts.use([
  BarChart,
  HeatmapChart,
  LineChart,
  AriaComponent,
  CalendarComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapComponent,
  CanvasRenderer,
]);

export type ChartOption = echarts.EChartsCoreOption;

export type ChartColors = {
  text: string;
  secondary: string;
  muted: string;
  grid: string;
  axis: string;
  surface: string;
  sunken: string;
  border: string;
  accent: string;
  series2: string;
  track: string;
  ispu: Record<Kategori, string>;
};

// Hanya dipakai saat render di server (tema terang); di browser nilai dibaca dari token CSS.
const SSR_COLORS: ChartColors = {
  text: "#161B26",
  secondary: "#3B4252",
  muted: "#5A6273",
  grid: "#E5E8ED",
  axis: "#D5DAE1",
  surface: "#FFFFFF",
  sunken: "#E6EAF0",
  border: "#D5DAE1",
  accent: "#2747C9",
  series2: "#B4520A",
  track: "#E1E5EA",
  ispu: {
    BAIK: "#2E9E5B",
    SEDANG: "#2F6FD6",
    "TIDAK SEHAT": "#E2AC0A",
    "SANGAT TIDAK SEHAT": "#D93434",
    BERBAHAYA: "#1B1B1F",
  },
};

function readColors(): ChartColors {
  if (typeof document === "undefined") return SSR_COLORS;
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  return {
    text: v("--text"),
    secondary: v("--text-secondary"),
    muted: v("--text-muted"),
    grid: v("--rule-soft"),
    axis: v("--rule"),
    surface: v("--panel"),
    sunken: v("--chip"),
    border: v("--rule"),
    accent: v("--series-1"),
    series2: v("--series-2"),
    track: v("--track"),
    ispu: Object.fromEntries(KATEGORI.map((k) => [k, v(KATEGORI_META[k].token)])) as Record<
      Kategori,
      string
    >,
  };
}

// Tema berganti lewat atribut data-theme di <html>. Warna dibaca dari token CSS setelah atribut itu
// berubah (membaca saat render kalah cepat dari next-themes) dan di-cache per tema, supaya snapshot
// useSyncExternalStore stabil.
const cache = new Map<string, ChartColors>();
function subscribeTheme(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}
function colorsSnapshot(): ChartColors {
  const theme = document.documentElement.dataset.theme ?? "light";
  let colors = cache.get(theme);
  if (!colors) {
    colors = readColors();
    cache.set(theme, colors);
  }
  return colors;
}

export function useChartColors(): ChartColors {
  return useSyncExternalStore(subscribeTheme, colorsSnapshot, () => SSR_COLORS);
}

/** Pembungkus ECharts: resize otomatis, dispose saat unmount, dan label aksesibel. */
export function EChart({
  option,
  height = 320,
  label,
}: {
  option: ChartOption;
  height?: number;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const c = useChartColors();

  useEffect(() => {
    if (!ref.current) return;
    const inst = echarts.init(ref.current, undefined, { renderer: "canvas" });
    chart.current = inst;
    const ro = new ResizeObserver(() => inst.resize());
    ro.observe(ref.current);
    return () => {
      ro.disconnect();
      inst.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    chart.current?.setOption(
      {
        aria: { enabled: true, label: { description: label } },
        textStyle: { color: c.text, fontFamily: "inherit" },
        // Seri pertama = accent, kedua = series-2 (aturan design system: maksimal 2 seri model).
        color: [c.accent, c.series2],
        animationDuration: 300,
        tooltip: {
          backgroundColor: c.surface,
          borderColor: c.border,
          textStyle: { color: c.text, fontSize: 13 },
          extraCssText: "border-radius:12px;box-shadow:none;",
        },
        ...option,
      },
      true,
    );
  }, [option, label, c]);

  return <div ref={ref} role="img" aria-label={label} style={{ height, width: "100%" }} />;
}

const monthShort = new Intl.DateTimeFormat("id-ID", { month: "short", timeZone: "UTC" });
/** Nama bulan singkat Indonesia (Jan, Feb, Mar, Apr, Mei, ...) untuk label ECharts. */
export const BULAN = Array.from({ length: 12 }, (_, m) =>
  monthShort.format(new Date(Date.UTC(2024, m, 1))),
);

/** Label sumbu waktu: tahun di 1 Januari, selain itu nama bulan Indonesia.
 *  ECharts membuat tick di tengah malam waktu lokal browser, jadi baca dengan getter lokal. */
export function timeAxisLabel(value: number) {
  const d = new Date(value);
  if (d.getMonth() === 0 && d.getDate() === 1) return String(d.getFullYear());
  return `${d.getDate() === 1 ? "" : `${d.getDate()} `}${BULAN[d.getMonth()]}`;
}

export function ChartLegend({
  items,
}: {
  items: { label: string; color: string; kind?: "line" | "dash" | "dot" }[];
}) {
  return (
    <div className="ua-legend" aria-label="Legenda grafik" role="group">
      {items.map((i) => (
        <span key={i.label} style={{ color: "var(--text)" }}>
          {i.kind === "dot" ? (
            <span className="ua-dot" style={{ background: i.color }} />
          ) : (
            <span
              className={
                i.kind === "dash" ? "ua-legend__line ua-legend__line--dashed" : "ua-legend__line"
              }
              style={i.kind === "dash" ? { color: i.color } : { background: i.color }}
            />
          )}
          {i.label}
        </span>
      ))}
    </div>
  );
}
