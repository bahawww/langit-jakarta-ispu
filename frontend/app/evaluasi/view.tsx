"use client";

import { useMemo, useState } from "react";

import { EChart, useChartColors } from "@/components/chart";
import { ConfusionMatrix } from "@/components/confusion-matrix";
import { PageHeader } from "@/components/page-header";
import { ChartSkeleton, EmptyState, QueryView } from "@/components/states";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi, type ModelVersion, type OrangeBaseline, type TrainingRun } from "@/lib/api";
import { fmt } from "@/lib/format";

type Avg = { precision: number; recall: number; f1: number };
type ClsMetric = {
  accuracy: number;
  correct: number;
  n: number;
  labels: string[];
  confusion_matrix: number[][];
  weighted: Avg;
  macro: Avg;
  vs_ispu: { accuracy: number };
};
type ClsMetrics = {
  holdout: Record<string, ClsMetric>;
  stratified_80_20: Record<string, ClsMetric>;
  beats_rule_baseline: boolean;
  n_holdout: number;
  n_stratified_test: number;
  comparison: { holdout_start: string };
};
type Reg = { mae: number; rmse: number; n: number };
type Horizon = {
  pollutants: Record<string, Record<string, Reg>>;
  category_accuracy: Record<string, number>;
  n_days: number;
};
type FcPart = {
  per_horizon: Record<string, Horizon>;
  summary: Record<string, { mae_pm25_mean: number; category_accuracy_mean: number }>;
};
type FcMetrics = {
  holdout: FcPart;
  backtest: FcPart | null;
  beats_baselines: boolean;
  backtest_folds: unknown[];
};

const MODEL_LABEL: Record<string, string> = {
  decision_tree: "Decision Tree",
  random_forest: "Random Forest",
  knn: "kNN",
  lightgbm: "LightGBM",
  rule_baseline: "Aturan ambang ISPU (baseline)",
  lightgbm_direct: "LightGBM (direct, per horizon)",
  persistence: "Persistence (nilai kemarin)",
  seasonal_naive: "Seasonal naive (7 hari lalu)",
};
const label = (k: string) => MODEL_LABEL[k] ?? k;
const METHODS = ["lightgbm", "persistence", "seasonal_naive"];
const ORDER = ["decision_tree", "random_forest", "knn", "lightgbm", "rule_baseline"];
const TH = "py-2 pr-3 text-right font-medium";
const TD = "py-2 pr-3 text-right";

function Classification({ mv }: { mv: ModelVersion }) {
  const m = mv.metrics as unknown as ClsMetrics;
  const [pick, setPick] = useState(mv.algorithm);
  const cm = m.holdout[pick];
  return (
    <Card aria-labelledby="h-cls">
      <CardHeader
        id="h-cls"
        title="Klasifikasi kategori (6 polutan, hari yang sama)"
        description={`Champion v${mv.version}: ${label(mv.algorithm)}. Holdout waktu = ${fmt.int(m.n_holdout)} baris sejak ${fmt.date(m.comparison.holdout_start)}; split 80:20 stratified = ${fmt.int(m.n_stratified_test)} baris uji.`}
      />
      <CardBody className="grid gap-5">
        <p className="rounded-md border border-border bg-muted p-3 text-sm">
          Kategori ISPU ditentukan langsung dari nilai polutan tertinggi, jadi aturan ambang hampir
          selalu benar.{" "}
          {m.beats_rule_baseline ? (
            <strong>Model terbaik mengalahkan aturan ambang.</strong>
          ) : (
            <strong>Tidak ada model ML yang mengalahkan aturan ambang pada holdout.</strong>
          )}{" "}
          Nilai ML sebenarnya ada di forecasting.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <caption className="sr-only">Perbandingan model klasifikasi</caption>
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th scope="col" className="py-2 pr-3 text-left font-medium">
                  Model
                </th>
                <th scope="col" className={TH}>
                  Akurasi holdout
                </th>
                <th scope="col" className={TH}>
                  F1 weighted
                </th>
                <th scope="col" className={TH}>
                  F1 macro
                </th>
                <th scope="col" className={TH}>
                  Akurasi vs ambang ISPU
                </th>
                <th scope="col" className={TH}>
                  Akurasi 80:20
                </th>
                <th scope="col" className={TH}>
                  F1 macro 80:20
                </th>
              </tr>
            </thead>
            <tbody>
              {ORDER.filter((k) => m.holdout[k]).map((k) => {
                const h = m.holdout[k]!;
                const s = m.stratified_80_20[k];
                return (
                  <tr
                    key={k}
                    className={`border-b border-border last:border-0 ${k === "rule_baseline" ? "bg-muted" : ""}`}
                  >
                    <th scope="row" className="py-2 pr-3 text-left font-medium">
                      {label(k)}
                      {k === mv.algorithm ? (
                        <span className="ml-2 rounded bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                          champion
                        </span>
                      ) : null}
                    </th>
                    <td className={TD}>{fmt.pct(h.accuracy)}</td>
                    <td className={TD}>{fmt.metric(h.weighted.f1)}</td>
                    <td className={TD}>{fmt.metric(h.macro.f1)}</td>
                    <td className={TD}>{fmt.pct(h.vs_ispu.accuracy)}</td>
                    <td className={TD}>{fmt.pct(s?.accuracy)}</td>
                    <td className={TD}>{fmt.metric(s?.macro.f1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div>
          <Field label="Confusion matrix untuk model" htmlFor="cm-model" className="mb-3 max-w-xs">
            <Select id="cm-model" value={pick} onChange={(e) => setPick(e.target.value)}>
              {ORDER.filter((k) => m.holdout[k]).map((k) => (
                <option key={k} value={k}>
                  {label(k)}
                </option>
              ))}
            </Select>
          </Field>
          {cm ? (
            <ConfusionMatrix
              labels={cm.labels}
              matrix={cm.confusion_matrix}
              caption={`${label(pick)} pada holdout waktu (${fmt.int(cm.n)} baris)`}
            />
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}

function Orange() {
  const q = useApi<OrangeBaseline>("/baseline/orange");
  const [pick, setPick] = useState("Random Forest");
  return (
    <Card aria-labelledby="h-orange">
      <CardHeader
        id="h-orange"
        title="Baseline Orange Data Mining (tugas kuliah)"
        description={
          q.data
            ? `Hasil ${fmt.int(q.data.rows)} data uji split 80:20 dari Orange, dihitung ulang dari database.`
            : "Hasil data uji split 80:20 dari Orange, dihitung ulang dari database."
        }
      />
      <CardBody className="grid gap-5">
        <QueryView
          query={q}
          skeleton={<Skeleton className="h-40 w-full" />}
          isEmpty={(d) => d.rows === 0}
        >
          {(d) => (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <caption className="sr-only">Metrik model Orange</caption>
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th scope="col" className="py-2 pr-3 text-left font-medium">
                        Model
                      </th>
                      <th scope="col" className={TH}>
                        Benar
                      </th>
                      <th scope="col" className={TH}>
                        Akurasi
                      </th>
                      <th scope="col" className={TH}>
                        Precision (w)
                      </th>
                      <th scope="col" className={TH}>
                        Recall (w)
                      </th>
                      <th scope="col" className={TH}>
                        F1 (w)
                      </th>
                      <th scope="col" className={TH}>
                        Akurasi vs ambang ISPU
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.models.map((x) => (
                      <tr key={x.model} className="border-b border-border last:border-0">
                        <th scope="row" className="py-2 pr-3 text-left font-medium">
                          {x.model}
                        </th>
                        <td className={TD}>
                          {fmt.int(x.correct)} / {fmt.int(d.rows)}
                        </td>
                        <td className={TD}>{fmt.pct(x.accuracy)}</td>
                        <td className={TD}>{fmt.metric(x.weighted.precision)}</td>
                        <td className={TD}>{fmt.metric(x.weighted.recall)}</td>
                        <td className={TD}>{fmt.metric(x.weighted.f1)}</td>
                        <td className={TD}>{fmt.pct(x.accuracy_vs_ispu)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-muted-foreground">
                {fmt.int(d.label_inconsistent)} baris uji berlabel tidak sesuai ambang ISPU;
                sebagian “kesalahan” model berasal dari label sumber.
              </p>
              <div>
                <Field
                  label="Confusion matrix untuk model"
                  htmlFor="cm-orange"
                  className="mb-3 max-w-xs"
                >
                  <Select id="cm-orange" value={pick} onChange={(e) => setPick(e.target.value)}>
                    {d.models.map((x) => (
                      <option key={x.model}>{x.model}</option>
                    ))}
                  </Select>
                </Field>
                {(() => {
                  const x = d.models.find((y) => y.model === pick);
                  return x ? (
                    <ConfusionMatrix
                      labels={d.labels}
                      matrix={x.confusion_matrix}
                      caption={`${pick} (Orange), ${fmt.int(d.rows)} data uji`}
                    />
                  ) : null;
                })()}
              </div>
            </>
          )}
        </QueryView>
      </CardBody>
    </Card>
  );
}

function HorizonChart({ part, metric }: { part: FcPart; metric: "mae" | "cat" }) {
  const c = useChartColors();
  const hs = Object.keys(part.per_horizon);
  const option = useMemo(
    () => ({
      grid: { left: 48, right: 16, top: 56, bottom: 32 },
      legend: { top: 0, textStyle: { color: c.text } },
      tooltip: {
        trigger: "axis",
        valueFormatter: (v: number) => (metric === "mae" ? fmt.num(v) : fmt.pct(v)),
      },
      xAxis: { type: "category", data: hs.map((h) => `H+${h}`), axisLabel: { color: c.muted } },
      yAxis: {
        type: "value",
        scale: true,
        name: metric === "mae" ? "MAE PM2.5 (indeks)" : "Akurasi kategori",
        nameTextStyle: { color: c.muted },
        axisLabel: {
          color: c.muted,
          formatter: metric === "mae" ? undefined : (v: number) => fmt.pct(v),
        },
        splitLine: { lineStyle: { color: c.grid } },
      },
      series: METHODS.map((m) => ({
        name: label(m),
        type: "line",
        symbolSize: 7,
        data: hs.map((h) => {
          const v = part.per_horizon[h]!;
          return metric === "mae" ? v.pollutants.pm_duakomalima?.[m]?.mae : v.category_accuracy[m];
        }),
      })),
    }),
    [part, metric, hs, c],
  );
  return (
    <EChart
      option={option}
      label={
        metric === "mae"
          ? "MAE PM2.5 per horizon untuk LightGBM, persistence, dan seasonal naive"
          : "Akurasi kategori turunan per horizon untuk tiga metode"
      }
    />
  );
}

function Forecast({ mv }: { mv: ModelVersion }) {
  const m = mv.metrics as unknown as FcMetrics;
  const [part, setPart] = useState<"holdout" | "backtest">("holdout");
  const p = part === "backtest" && m.backtest ? m.backtest : m.holdout;
  const worse = Object.entries(p.per_horizon)
    .filter(([, v]) => {
      const x = v.pollutants.pm_duakomalima;
      return x && x.lightgbm!.mae > Math.min(x.persistence!.mae, x.seasonal_naive!.mae);
    })
    .map(([h]) => `H+${h}`);
  return (
    <Card aria-labelledby="h-fc">
      <CardHeader
        id="h-fc"
        title="Forecasting H+1 sampai H+7"
        description={`Champion v${mv.version}: ${label(mv.algorithm)}. Validasi berbasis waktu, bukan split acak.`}
        action={
          <Field label="Evaluasi" htmlFor="fc-part" className="w-48">
            <Select
              id="fc-part"
              value={part}
              onChange={(e) => setPart(e.target.value as "holdout" | "backtest")}
            >
              <option value="holdout">Holdout (model eval)</option>
              <option value="backtest">
                Rolling-origin backtest ({m.backtest_folds.length} fold)
              </option>
            </Select>
          </Field>
        }
      />
      <CardBody className="grid gap-5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <caption className="sr-only">Ringkasan metrik forecast</caption>
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th scope="col" className="py-2 pr-3 text-left font-medium">
                  Metode
                </th>
                <th scope="col" className={TH}>
                  Rata-rata MAE PM2.5
                </th>
                <th scope="col" className={TH}>
                  Rata-rata akurasi kategori
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(p.summary).map(([k, v]) => (
                <tr key={k} className="border-b border-border last:border-0">
                  <th scope="row" className="py-2 pr-3 text-left font-medium">
                    {label(k)}
                  </th>
                  <td className={TD}>{fmt.num(v.mae_pm25_mean)}</td>
                  <td className={TD}>{fmt.pct(v.category_accuracy_mean)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="rounded-md border border-border bg-muted p-3 text-sm">
          {m.beats_baselines
            ? "Rata-rata MAE LightGBM lebih kecil dari kedua baseline."
            : "LightGBM tidak mengalahkan semua baseline secara rata-rata."}{" "}
          {worse.length
            ? `Namun pada ${worse.join(", ")} MAE PM2.5 LightGBM lebih besar dari salah satu baseline.`
            : "LightGBM unggul di semua horizon."}
        </p>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <HorizonChart part={p} metric="mae" />
          <HorizonChart part={p} metric="cat" />
        </div>
      </CardBody>
    </Card>
  );
}

function History() {
  const models = useApi<ModelVersion[]>("/models");
  const runs = useApi<TrainingRun[]>("/training-runs", { limit: 10 });
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card aria-labelledby="h-versions">
        <CardHeader id="h-versions" title="Riwayat versi model" />
        <CardBody>
          <QueryView
            query={models}
            skeleton={<Skeleton className="h-40 w-full" />}
            isEmpty={(d) => d.length === 0}
          >
            {(d) => (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <caption className="sr-only">Versi model</caption>
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Task
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Versi
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Status
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Dibuat
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Data latih
                      </th>
                      <th scope="col" className="py-2 font-medium">
                        Metrik utama
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.map((v) => (
                      <tr key={v.id} className="border-b border-border last:border-0">
                        <td className="py-2 pr-3">
                          {v.task === "forecast" ? "Forecast" : "Klasifikasi"}
                        </td>
                        <td className="py-2 pr-3">v{v.version}</td>
                        <td className="py-2 pr-3">{v.status}</td>
                        <td className="py-2 pr-3">{fmt.dateTime(v.created_at)}</td>
                        <td className="py-2 pr-3">
                          {fmt.date(v.train_start)} – {fmt.date(v.data_end)}
                        </td>
                        <td className="py-2">
                          {v.primary_metric} = {fmt.num(v.primary_value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </QueryView>
        </CardBody>
      </Card>
      <Card aria-labelledby="h-runs">
        <CardHeader id="h-runs" title="Riwayat training" />
        <CardBody>
          <QueryView
            query={runs}
            skeleton={<Skeleton className="h-40 w-full" />}
            isEmpty={(d) => d.length === 0}
          >
            {(d) => (
              <ul className="space-y-3 text-sm">
                {d.map((r) => (
                  <li key={r.id} className="rounded-md border border-border p-3">
                    <p className="font-medium">
                      #{r.id} · {r.trigger} · {r.status}
                    </p>
                    <p className="text-xs text-muted-foreground">{fmt.dateTime(r.created_at)}</p>
                    {r.message ? <p className="mt-1">{r.message}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </QueryView>
        </CardBody>
      </Card>
    </div>
  );
}

export function EvaluasiView() {
  const champions = useApi<Record<string, ModelVersion | null>>("/models/champions");
  return (
    <>
      <PageHeader
        title="Evaluasi model"
        description="Perbandingan model, baseline, dan riwayat versi dari registry."
      />
      <div className="grid gap-5">
        <QueryView query={champions} skeleton={<ChartSkeleton height={400} />}>
          {(d) => (
            <>
              {d.classification ? (
                <Classification mv={d.classification} />
              ) : (
                <EmptyState title="Belum ada model klasifikasi" />
              )}
              {d.forecast ? (
                <Forecast mv={d.forecast} />
              ) : (
                <EmptyState title="Belum ada model forecast" />
              )}
            </>
          )}
        </QueryView>
        <Orange />
        <History />
      </div>
    </>
  );
}
