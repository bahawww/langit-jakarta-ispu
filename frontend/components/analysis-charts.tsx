"use client";

import { useMemo } from "react";

import { EChart, useChartColors } from "@/components/chart";
import { ScrollX } from "@/components/ui/scroll-x";
import {
  A_MODEL_NAME,
  MODEL_KEYS,
  type AModel,
  type Analysis,
  type TreeNode,
} from "@/lib/analysis";
import { fmt } from "@/lib/format";
import { kategoriMeta } from "@/lib/kategori";

/** Warna model: Random Forest = series-1, Decision Tree = series-2, kNN = abu (pembanding). */
export function useModelColors(): Record<AModel, string> {
  const c = useChartColors();
  return { random_forest: c.accent, decision_tree: c.series2, knn: c.muted };
}

export const modelVar: Record<AModel, string> = {
  random_forest: "var(--series-1)",
  decision_tree: "var(--series-2)",
  knn: "var(--text-muted)",
};

export type Line = {
  name: string;
  color: string;
  data: [number, number][];
  dashed?: boolean;
  width?: number;
};

/** Grafik garis dua sumbu angka (ROC, precision–recall, learning curve, kedalaman). */
export function LineChart({
  lines,
  xName,
  yName,
  xMin = 0,
  xMax,
  yMin = 0,
  yMax = 1,
  diagonal,
  label,
  height = 300,
  xPct,
}: {
  lines: Line[];
  xName: string;
  yName: string;
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
  diagonal?: boolean;
  label: string;
  height?: number;
  xPct?: boolean;
}) {
  const c = useChartColors();
  const option = useMemo(
    () => ({
      grid: { left: 52, right: 16, top: 16, bottom: 46 },
      tooltip: {
        trigger: "axis",
        valueFormatter: (v: number) => fmt.m3(v),
      },
      xAxis: {
        type: "value",
        min: xMin,
        max: xMax,
        name: xName,
        nameLocation: "middle",
        nameGap: 28,
        nameTextStyle: { color: c.muted, fontSize: 11 },
        axisLabel: {
          color: c.muted,
          fontSize: 11,
          formatter: xPct ? (v: number) => `${Math.round(v * 100)}%` : undefined,
        },
        axisLine: { lineStyle: { color: c.axis } },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        min: yMin,
        max: yMax,
        name: yName,
        nameTextStyle: { color: c.muted, fontSize: 11, align: "left" },
        axisLabel: { color: c.muted, fontSize: 11 },
        splitLine: { lineStyle: { color: c.grid } },
      },
      series: [
        ...(diagonal
          ? [
              {
                name: "Tebakan acak",
                type: "line",
                data: [
                  [0, 0],
                  [1, 1],
                ],
                showSymbol: false,
                silent: true,
                lineStyle: { color: c.axis, type: "dashed", width: 1.5 },
                tooltip: { show: false },
              },
            ]
          : []),
        ...lines.map((l) => ({
          name: l.name,
          type: "line",
          data: l.data,
          showSymbol: l.data.length < 12,
          symbolSize: 6,
          lineStyle: {
            color: l.color,
            width: l.width ?? 2.5,
            type: l.dashed ? "dashed" : "solid",
            cap: "round",
            join: "round",
          },
          itemStyle: { color: l.color },
        })),
      ],
    }),
    [lines, xName, yName, xMin, xMax, yMin, yMax, diagonal, xPct, c],
  );
  return <EChart option={option} height={height} label={label} />;
}

/** Porsi pengaruh tiap polutan terhadap tebakan satu model (permutation importance). */
export function ImportanceBars({
  importance,
  names,
  color,
}: {
  importance: Record<string, number>;
  names: Record<string, string>;
  color: string;
}) {
  const items = Object.entries(importance).sort(([, a], [, b]) => b - a);
  const top = items[0]?.[1] || 1;
  return (
    <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
      {items.map(([f, v]) => (
        <li
          key={f}
          className="grid grid-cols-[96px_minmax(0,1fr)_52px] items-center gap-3.5 text-sm"
        >
          <span className={v >= top * 0.5 ? "font-bold" : "font-semibold text-ink-3"}>
            {names[f] ?? f}
          </span>
          <span className="ua-bar" style={{ height: 8 }} aria-hidden>
            <span
              className="ua-anim-grow"
              style={{ width: `${(v / top) * 100}%`, background: color }}
            />
          </span>
          <span className="text-right font-bold">{fmt.pct(v)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Hasil tiap lipatan cross-validation: rentang min–maks, titik per lipatan, dan garis rata-rata. */
export function CvStrips({ cv, metric }: { cv: Analysis["cv"]; metric: "accuracy" | "macro_f1" }) {
  const colors = modelVar;
  const all = MODEL_KEYS.flatMap((m) => cv[m][metric]);
  const lo = Math.max(0, Math.floor((Math.min(...all) - 0.01) * 50) / 50);
  const pos = (v: number) => `${((v - lo) / (1 - lo)) * 100}%`;
  return (
    <div className="flex flex-col gap-4">
      {MODEL_KEYS.map((m) => {
        const v = cv[m][metric];
        const mean = v.reduce((a, b) => a + b, 0) / v.length;
        return (
          <div
            key={m}
            className="grid grid-cols-[110px_minmax(0,1fr)_56px] items-center gap-3.5 text-sm"
          >
            <span className="font-bold">{A_MODEL_NAME[m]}</span>
            <div
              className="relative h-6"
              role="img"
              aria-label={`${A_MODEL_NAME[m]}: rata-rata ${fmt.m3(mean)}, terendah ${fmt.m3(Math.min(...v))}, tertinggi ${fmt.m3(Math.max(...v))}`}
            >
              <span className="absolute inset-x-0 top-[11px] h-0.5 bg-track" />
              <span
                className="absolute top-[7px] h-2.5 rounded-[3px] opacity-30"
                style={{
                  left: pos(Math.min(...v)),
                  width: `calc(${pos(Math.max(...v))} - ${pos(Math.min(...v))})`,
                  background: colors[m],
                }}
              />
              {v.map((x, i) => (
                <span
                  key={i}
                  className="absolute top-[7px] size-2.5 -ml-[5px] rounded-full"
                  style={{ left: pos(x), background: colors[m] }}
                  title={`Lipatan ${i + 1}: ${fmt.m3(x)}`}
                />
              ))}
              <span
                className="absolute top-0.5 h-5 w-0.5 -ml-px"
                style={{ left: pos(mean), background: "var(--text)" }}
              />
            </div>
            <span className="text-right text-[17px] font-extrabold">{fmt.m3(mean)}</span>
          </div>
        );
      })}
      <p className="m-0 text-[13px] text-ink-3">
        Satu titik satu lipatan, garis hitam rata-rata. Sumbu dimulai dari {fmt.m3(lo)}, bukan 0.
      </p>
    </div>
  );
}

/** F1 Random Forest untuk tiap kombinasi jumlah pohon dan kedalaman; sel gelap = lebih baik. */
export function GridTable({ grid }: { grid: Analysis["grid"] }) {
  const flat = grid.f1.flat();
  const lo = Math.min(...flat);
  const hi = Math.max(...flat);
  // Teks selalu var(--text): campuran dibatasi 12–52% supaya kontras AA terjaga di kedua tema.
  const mix = (v: number) => (hi === lo ? 30 : 12 + ((v - lo) / (hi - lo)) * 40);
  const isDefault = (d: number | null, n: number) =>
    d === grid.default.max_depth && n === grid.default.n_estimators;
  return (
    <ScrollX label="Tabel F1 per jumlah pohon dan kedalaman">
      <table className="min-w-[420px] border-separate border-spacing-1.5 text-[15px]">
        <caption className="px-1.5 pb-1.5 text-left text-[13px] text-ink-3">
          Kolom: jumlah pohon (n_estimators). Baris: kedalaman maksimal (max_depth).
        </caption>
        <thead>
          <tr>
            <td />
            {grid.n_estimators.map((n) => (
              <th
                key={n}
                scope="col"
                className="py-1 text-center text-[13px] font-semibold text-ink-3"
              >
                {n} pohon
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.max_depth.map((d, r) => (
            <tr key={String(d)}>
              <th
                scope="row"
                className="pr-2 text-left text-[13px] font-semibold whitespace-nowrap text-ink-3"
              >
                {d === null ? "tanpa batas" : `kedalaman ${d}`}
              </th>
              {grid.n_estimators.map((n, c) => {
                const v = grid.f1[r]![c]!;
                return (
                  <td
                    key={n}
                    className="h-14 min-w-[84px] rounded-lg text-center font-extrabold"
                    style={{
                      background: `color-mix(in srgb, var(--series-1) ${mix(v)}%, var(--panel))`,
                      color: "var(--text)",
                      boxShadow: isDefault(d, n) ? "0 0 0 2px var(--text)" : undefined,
                    }}
                  >
                    {fmt.m3(v)}
                    {isDefault(d, n) ? <span className="sr-only"> (bawaan)</span> : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollX>
  );
}

function Leaf({ node }: { node: TreeNode }) {
  const m = kategoriMeta(node.label);
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg bg-surface px-1 py-2.5 text-center">
      <span className="inline-flex items-center gap-1.5 font-bold">
        <span
          className="size-[9px] rounded-[2px]"
          style={{ background: `var(${m.token})` }}
          aria-hidden
        />
        {m.label}
      </span>
      <span className="text-ink-3">{fmt.int(node.n)} hari</span>
    </div>
  );
}

const thresholdText = (n: TreeNode, names: Record<string, string>) =>
  `${names[n.feature!] ?? n.feature} ≤ ${Math.floor(n.threshold!)}?`;

/** Dua tingkat pertama Decision Tree (pertanyaan ya/tidak lalu kategori mayoritas di tiap cabang). */
export function TreeDiagram({ tree, names }: { tree: TreeNode; names: Record<string, string> }) {
  if (!tree.children) return <Leaf node={tree} />;
  return (
    <div className="flex flex-col items-center text-[13px]">
      <div className="flex flex-col gap-0.5 rounded-[10px] border-[1.5px] border-ink px-[18px] py-3 text-center">
        <span className="text-[15px] font-bold">{thresholdText(tree, names)}</span>
        <span className="text-ink-3">{fmt.int(tree.n)} hari</span>
      </div>
      <div className="h-3.5 w-[1.5px] bg-line" />
      <div className="box-border h-4 w-1/2 rounded-t-lg border-[1.5px] border-b-0 border-line" />
      <div className="grid w-full grid-cols-2 gap-3">
        {tree.children.map((br, i) => (
          <div key={i} className="flex min-w-0 flex-col items-center">
            <span className="pt-1 pb-1.5 text-xs font-bold text-ink-3">
              {i === 0 ? "Ya" : "Tidak"}
            </span>
            {br.children ? (
              <>
                <div className="flex flex-col gap-0.5 rounded-[10px] border border-line px-3 py-2.5 text-center">
                  <span className="text-sm font-bold">{thresholdText(br, names)}</span>
                  <span className="text-ink-3">{fmt.int(br.n)} hari</span>
                </div>
                <div className="h-3.5 w-[1.5px] bg-line" />
                <div className="grid w-full grid-cols-2 gap-1.5">
                  {br.children.map((lf, j) => (
                    <Leaf key={j} node={lf} />
                  ))}
                </div>
              </>
            ) : (
              <Leaf node={br} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
