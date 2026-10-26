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
import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";

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

export function useChartColors() {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return {
    dark,
    text: dark ? "#e2e8f0" : "#0f172a",
    muted: dark ? "#a3b1c6" : "#475569",
    grid: dark ? "#334155" : "#e2e8f0",
    tooltipBg: dark ? "#1b2336" : "#ffffff",
    // Sengaja bukan hijau/biru/kuning/merah/hitam agar tidak tertukar dengan warna kategori ISPU.
    series: dark
      ? ["#a78bfa", "#fb923c", "#2dd4bf", "#f472b6", "#94a3b8", "#22d3ee"]
      : ["#6d28d9", "#c2410c", "#0f766e", "#be185d", "#475569", "#0e7490"],
  };
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
        color: c.series,
        animationDuration: 300,
        tooltip: {
          backgroundColor: c.tooltipBg,
          borderColor: c.grid,
          textStyle: { color: c.text },
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
