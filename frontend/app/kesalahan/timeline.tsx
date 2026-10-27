"use client";

import { useMemo, useState } from "react";

import { EChart, useChartColors } from "@/components/chart";
import { SegmentedControl } from "@/components/ui/segmented";
import type { OrangeRow } from "@/lib/api";
import { fmt } from "@/lib/format";
import { KATEGORI_META, isKategori } from "@/lib/kategori";
import { shortStation } from "@/lib/labels";

const ROWS = ["Meleset", "Tebakan", "Aktual"]; // sumbu kategori menumpuk dari bawah

/** Pita kategori per hari uji: aktual di atas, tebakan model di tengah, hari yang meleset di bawah. */
export function Timeline({
  rows,
  pred,
  model,
}: {
  rows: OrangeRow[];
  pred: (r: OrangeRow) => string;
  model: string;
}) {
  const c = useChartColors();
  const stations = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) m.set(r.station_code, shortStation(r.station_name));
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);
  const [pick, setPick] = useState<string | null>(null);
  const code = stations.some(([k]) => k === pick) ? pick! : (stations[0]?.[0] ?? "");

  const mine = useMemo(
    () =>
      rows
        .filter((r) => r.station_code === code)
        .sort((a, b) => a.tanggal.localeCompare(b.tanggal)),
    [rows, code],
  );
  const wrong = mine.filter((r) => pred(r) !== r.kategori).length;

  const option = useMemo(() => {
    const color = (k: string) => (isKategori(k) ? c.ispu[k] : c.muted);
    const mark = (row: string, r: OrangeRow, k: string) => ({
      value: [r.tanggal, row],
      itemStyle: { color: color(k) },
      kategori: k,
      pred: pred(r),
      actual: r.kategori,
    });
    return {
      grid: { left: 64, right: 8, top: 8, bottom: 32 },
      tooltip: {
        formatter: (p: { data: { value: [string, string]; pred: string; actual: string } }) =>
          `${fmt.date(p.data.value[0])}<br/>Aktual: ${label(p.data.actual)}<br/>Tebakan: ${label(p.data.pred)}`,
      },
      xAxis: {
        type: "time",
        axisLabel: { color: c.muted, fontSize: 11, hideOverlap: true },
        axisLine: { lineStyle: { color: c.axis } },
        splitLine: { show: false },
      },
      yAxis: {
        type: "category",
        data: ROWS,
        axisLabel: { color: c.secondary, fontSize: 12 },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
      },
      series: [
        {
          type: "scatter",
          symbol: "rect",
          symbolSize: [5, 26],
          data: mine.map((r) => mark("Aktual", r, r.kategori)),
        },
        {
          type: "scatter",
          symbol: "rect",
          symbolSize: [5, 26],
          data: mine.map((r) => mark("Tebakan", r, pred(r))),
        },
        {
          type: "scatter",
          symbol: "rect",
          symbolSize: [5, 26],
          data: mine.filter((r) => pred(r) !== r.kategori).map((r) => mark("Meleset", r, "x")),
          itemStyle: { color: c.text },
        },
      ],
    };
  }, [mine, pred, c]);

  return (
    <>
      <SegmentedControl
        label="Stasiun"
        value={code}
        onChange={setPick}
        options={stations.map(([k, n]) => ({ value: k, label: n }))}
      />
      <EChart
        option={option}
        height={170}
        label={`Kategori aktual dan tebakan ${model} pada ${mine.length} hari uji; ${wrong} hari meleset.`}
      />
      <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1.5 p-0 text-sm text-ink-2">
        {Object.values(KATEGORI_META)
          .slice(0, 3)
          .map((m) => (
            <li key={m.label} className="flex items-center gap-2">
              <span
                aria-hidden
                className="h-3 w-3 rounded-sm"
                style={{ background: `var(${m.token})` }}
              />
              {m.label}
            </li>
          ))}
      </ul>
      <p className="m-0 text-sm text-ink-3">
        Hanya hari uji (20% data) yang tampil; hari lain dipakai untuk belajar, jadi kosong. {model}{" "}
        meleset {fmt.int(wrong)} dari {fmt.int(mine.length)} hari di stasiun ini.
      </p>
    </>
  );
}

const label = (k: string) => (isKategori(k) ? KATEGORI_META[k].label : k);
