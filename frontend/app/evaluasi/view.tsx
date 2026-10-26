"use client";

import { useMemo, useState } from "react";

import { ChartLegend, EChart, useChartColors } from "@/components/chart";
import { ConclusionCard, type Insight } from "@/components/conclusion-card";
import { ConfusionMatrix, classStats } from "@/components/confusion-matrix";
import { DistributionBar, IspuScaleCard, IspuSwatch } from "@/components/ispu";
import { PageHeader } from "@/components/page-header";
import { CompareCard } from "@/components/stat-card";
import { ChartSkeleton, EmptyState, QueryView } from "@/components/states";
import { Callout } from "@/components/ui/callout";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import { ScrollX } from "@/components/ui/scroll-x";
import { SegmentedControl } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi, type ModelVersion, type OrangeBaseline, type TrainingRun } from "@/lib/api";
import { fmt } from "@/lib/format";
import { kategoriMeta } from "@/lib/kategori";
import { modelLabel } from "@/lib/labels";

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
type FcMetrics = { holdout: FcPart; backtest: FcPart | null; backtest_folds: unknown[] };

const ORDER = ["decision_tree", "random_forest", "knn", "lightgbm", "rule_baseline"];
const RULE = "rule_baseline";
const PM25 = "pm_duakomalima";

type Delta = { text: string; title: string; tone: "success" | "warning" };
const same = (d: number, eps: number) => Math.abs(d) < eps;
/** Selisih utama vs pembanding. `better` = arah yang lebih baik; `fmtDiff` memformat selisihnya. */
function compare(
  main: number,
  other: number,
  mainName: string,
  otherName: string,
  better: "higher" | "lower",
  eps: number,
  fmtDiff: (n: number) => string,
): Delta {
  const d = better === "higher" ? main - other : other - main;
  if (same(d, eps))
    return { text: "Sama", title: `${mainName} sama dengan ${otherName}`, tone: "success" };
  return d > 0
    ? {
        text: `Unggul ${fmtDiff(d)}`,
        title: `${mainName} lebih baik ${fmtDiff(d)} dari ${otherName}`,
        tone: "success",
      }
    : {
        text: `Kalah ${fmtDiff(-d)}`,
        title: `${otherName} lebih baik ${fmtDiff(-d)} dari ${mainName}`,
        tone: "warning",
      };
}

function SectionTitle({
  id,
  title,
  sub,
  action,
}: {
  id: string;
  title: string;
  sub: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pt-3">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="ua-section-title">
          {title}
        </h2>
        <p className="ua-section-sub">{sub}</p>
      </div>
      {action}
    </div>
  );
}

/* ───────────────────────── Klasifikasi ───────────────────────── */

function Classification({ mv }: { mv: ModelVersion }) {
  const m = mv.metrics as unknown as ClsMetrics;
  const [proto, setProto] = useState<"stratified" | "holdout">("stratified");
  const [view, setView] = useState<"compare" | "model" | "rule">("compare");
  const set = proto === "stratified" ? m.stratified_80_20 : m.holdout;
  const alg = mv.algorithm;
  const main = set[alg];
  const rule = set[RULE];
  if (!main || !rule) return <EmptyState title="Metrik klasifikasi belum lengkap" />;

  const mainName = modelLabel(alg);
  const kpis: { label: string; help: string; a: number; b: number }[] = [
    {
      label: "Accuracy",
      help: "Porsi tebakan kategori yang tepat dari semua hari uji.",
      a: main.accuracy,
      b: rule.accuracy,
    },
    {
      label: "Precision",
      help: "Saat model bilang kategori X, seberapa sering benar (rata-rata kategori).",
      a: main.macro.precision,
      b: rule.macro.precision,
    },
    {
      label: "Recall",
      help: "Dari semua hari kategori X, berapa yang tertangkap (rata-rata kategori).",
      a: main.macro.recall,
      b: rule.macro.recall,
    },
    {
      label: "F1",
      help: "Gabungan precision dan recall dalam satu angka (rata-rata kategori).",
      a: main.macro.f1,
      b: rule.macro.f1,
    },
  ];

  const rows: { name: string; get: (x: ClsMetric) => number }[] = [
    { name: "Accuracy", get: (x) => x.accuracy },
    { name: "Precision (macro)", get: (x) => x.macro.precision },
    { name: "Recall (macro)", get: (x) => x.macro.recall },
    { name: "F1 (macro)", get: (x) => x.macro.f1 },
    { name: "Ketepatan terhadap ambang ISPU", get: (x) => x.vs_ispu.accuracy },
  ];
  const keys = ORDER.filter((k) => set[k]);

  const shown: { key: string; name: string; color: string; metric: ClsMetric }[] = [
    { key: alg, name: mainName, color: "var(--accent)", metric: main },
    { key: RULE, name: modelLabel(RULE), color: "var(--series-2)", metric: rule },
  ].filter((x) => view === "compare" || (view === "model" ? x.key === alg : x.key === RULE));
  const counts = Object.fromEntries(
    main.labels.map((l, i) => [l, main.confusion_matrix[i]!.reduce((a, b) => a + b, 0)]),
  );

  return (
    <>
      <SectionTitle
        id="klasifikasi"
        title="Klasifikasi kategori"
        sub="Menebak kategori ISPU dari 6 polutan di hari yang sama, dibandingkan dengan aturan ambang."
        action={
          <SegmentedControl
            label="Cara menguji model"
            value={proto}
            onChange={setProto}
            options={[
              { value: "stratified", label: "Split 80:20 acak" },
              { value: "holdout", label: "Holdout waktu" },
            ]}
          />
        }
      />
      <section
        aria-label="Metrik klasifikasi"
        className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-4"
      >
        {kpis.map((k) => (
          <CompareCard
            key={k.label}
            label={k.label}
            help={k.help}
            badge={compare(k.a, k.b, mainName, "aturan ambang ISPU", "higher", 0.0005, fmt.m3)}
            main={{ who: mainName, value: fmt.m3(k.a), pct: k.a * 100 }}
            other={{ who: "Aturan ambang", value: fmt.m3(k.b), pct: k.b * 100 }}
          />
        ))}
      </section>

      <Card aria-labelledby="h-banding">
        <CardHeader
          id="h-banding"
          title="Perbandingan model"
          description={`Macro = rata-rata dari tiap kategori · nilai terbaik per baris disorot · ${fmt.int(main.n)} hari uji`}
        />
        <CardBody>
          <ScrollX label="Tabel perbandingan model klasifikasi">
            <table className="ua-table min-w-[640px]">
              <caption className="sr-only">Perbandingan metrik antar model klasifikasi</caption>
              <thead>
                <tr>
                  <th scope="col">Metrik</th>
                  {keys.map((k) => (
                    <th scope="col" key={k}>
                      {modelLabel(k)}
                      {k === alg ? (
                        <span className="ua-badge ua-badge--neutral ml-1.5">terbaik</span>
                      ) : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const best = Math.max(...keys.map((k) => r.get(set[k]!)));
                  return (
                    <tr key={r.name}>
                      <th scope="row">{r.name}</th>
                      {keys.map((k) => {
                        const v = r.get(set[k]!);
                        return (
                          <td key={k}>
                            {same(v - best, 0.0005) ? (
                              <span className="ua-best">{fmt.m3(v)}</span>
                            ) : (
                              fmt.m3(v)
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollX>
          <Callout>
            aturan ambang ISPU menentukan kategori langsung dari polutan tertinggi, jadi hampir
            tidak bisa dikalahkan. Nilai tambah model machine learning ada di forecast, bagian bawah
            halaman ini.
          </Callout>
        </CardBody>
      </Card>

      <SectionTitle
        id="evaluasi"
        title="Kategori mana yang tertukar"
        sub="Seberapa baik tiap kategori dikenali, dan ke mana kesalahan tebakan mengarah."
        action={
          <SegmentedControl
            label="Pilih model yang ditampilkan"
            value={view}
            onChange={setView}
            options={[
              { value: "compare", label: "Bandingkan" },
              { value: "model", label: mainName },
              { value: "rule", label: "Aturan ambang" },
            ]}
          />
        }
      />
      <Card aria-labelledby="h-dist">
        <CardHeader
          id="h-dist"
          title="Distribusi kategori di data uji"
          description={`n = ${fmt.int(main.n)} · jumlah tiap kategori tidak seimbang`}
        />
        <CardBody>
          <DistributionBar counts={counts} />
        </CardBody>
      </Card>
      <section
        className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] gap-4"
        aria-label="Confusion matrix"
      >
        {shown.map((x) => {
          const stats = classStats(x.metric.confusion_matrix, x.metric.labels);
          return (
            <Card key={x.key} aria-label={`Confusion matrix ${x.name}`}>
              <div className="ua-card__head">
                <div className="flex items-center gap-2.5">
                  <span className="ua-dot" style={{ background: x.color, width: 10, height: 10 }} />
                  <h3 className="ua-card__title">Confusion matrix · {x.name}</h3>
                </div>
                <span className="text-[13px] text-ink-3">
                  {fmt.int(x.metric.n - x.metric.correct)} dari {fmt.int(x.metric.n)} salah
                </span>
              </div>
              <ConfusionMatrix
                labels={x.metric.labels}
                matrix={x.metric.confusion_matrix}
                color={x.color}
                name={x.name}
              />
              {shown.length === 1 ? (
                <div className="flex flex-col gap-2.5 border-t border-line-soft pt-4">
                  <h4 className="m-0 text-sm font-bold">Kinerja per kategori</h4>
                  <ScrollX label="Tabel kinerja per kategori">
                    <table className="ua-table min-w-[380px]">
                      <thead>
                        <tr>
                          <th scope="col">Kategori</th>
                          <th scope="col">Precision</th>
                          <th scope="col">Recall</th>
                          <th scope="col">F1</th>
                          <th scope="col">Jumlah</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.map((s) => (
                          <tr key={s.label}>
                            <th scope="row">
                              <span className="inline-flex items-center gap-2">
                                <IspuSwatch token={kategoriMeta(s.label).token} />
                                {kategoriMeta(s.label).label}
                              </span>
                            </th>
                            <td>{fmt.m3(s.p)}</td>
                            <td>{fmt.m3(s.r)}</td>
                            <td className="font-bold">{fmt.m3(s.f)}</td>
                            <td className="ua-mute">{fmt.int(s.n)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollX>
                </div>
              ) : null}
            </Card>
          );
        })}
      </section>
    </>
  );
}

/* ───────────────────────── Forecast ───────────────────────── */

const horizonKeys = (p: FcPart) => Object.keys(p.per_horizon).sort((a, b) => Number(a) - Number(b));
const mae = (p: FcPart, h: string, method: string) =>
  p.per_horizon[h]?.pollutants[PM25]?.[method]?.mae ?? NaN;

function HorizonLines({ part }: { part: FcPart }) {
  const c = useChartColors();
  const hs = horizonKeys(part);
  const option = useMemo(() => {
    const base = (name: string, color: string, data: (number | undefined)[]) => ({
      name,
      type: "line",
      symbolSize: 7,
      lineStyle: { width: 2.5, color, cap: "round", join: "round" },
      itemStyle: { color },
      data,
    });
    return {
      grid: { left: 48, right: 16, top: 16, bottom: 32 },
      tooltip: { trigger: "axis", valueFormatter: (v: number) => fmt.num(v) },
      xAxis: {
        type: "category",
        data: hs.map((h) => `H+${h}`),
        axisLabel: { color: c.muted, fontSize: 11 },
        axisLine: { lineStyle: { color: c.axis } },
      },
      yAxis: {
        type: "value",
        scale: true,
        name: "MAE PM2.5 (indeks)",
        nameTextStyle: { color: c.muted, fontSize: 11 },
        axisLabel: { color: c.muted, fontSize: 11 },
        splitLine: { lineStyle: { color: c.grid } },
      },
      series: [
        base(
          "LightGBM",
          c.accent,
          hs.map((h) => mae(part, h, "lightgbm")),
        ),
        base(
          "Persistence",
          c.series2,
          hs.map((h) => mae(part, h, "persistence")),
        ),
      ],
    };
  }, [part, hs, c]);
  return (
    <EChart
      option={option}
      height={280}
      label="Galat (MAE) PM2.5 per hari prediksi untuk LightGBM dan persistence"
    />
  );
}

function CategoryLines({ part }: { part: FcPart }) {
  const c = useChartColors();
  const hs = horizonKeys(part);
  const option = useMemo(() => {
    const base = (name: string, color: string, data: (number | undefined)[]) => ({
      name,
      type: "line",
      symbolSize: 7,
      lineStyle: { width: 2.5, color, cap: "round", join: "round" },
      itemStyle: { color },
      data,
    });
    const acc = (m: string) => hs.map((h) => part.per_horizon[h]?.category_accuracy[m]);
    return {
      grid: { left: 48, right: 16, top: 16, bottom: 32 },
      tooltip: { trigger: "axis", valueFormatter: (v: number) => fmt.pct(v) },
      xAxis: {
        type: "category",
        data: hs.map((h) => `H+${h}`),
        axisLabel: { color: c.muted, fontSize: 11 },
        axisLine: { lineStyle: { color: c.axis } },
      },
      yAxis: {
        type: "value",
        scale: true,
        name: "Akurasi kategori",
        nameTextStyle: { color: c.muted, fontSize: 11 },
        axisLabel: { color: c.muted, fontSize: 11, formatter: (v: number) => fmt.pct(v) },
        splitLine: { lineStyle: { color: c.grid } },
      },
      series: [
        base("LightGBM", c.accent, acc("lightgbm")),
        base("Persistence", c.series2, acc("persistence")),
      ],
    };
  }, [part, hs, c]);
  return (
    <EChart
      option={option}
      height={280}
      label="Akurasi kategori turunan per hari prediksi untuk LightGBM dan persistence"
    />
  );
}

function Forecast({ mv }: { mv: ModelVersion }) {
  const m = mv.metrics as unknown as FcMetrics;
  const [which, setWhich] = useState<"holdout" | "backtest">("holdout");
  const p = which === "backtest" && m.backtest ? m.backtest : m.holdout;
  const hs = horizonKeys(p);
  const first = hs[0]!;
  const last = hs.at(-1)!;
  const wins = hs.filter(
    (h) => mae(p, h, "lightgbm") < Math.min(mae(p, h, "persistence"), mae(p, h, "seasonal_naive")),
  );
  const losses = hs.filter((h) => !wins.includes(h));
  const relMax = (a: number, b: number) => Math.max(a, b) || 1;
  const maeCard = (label: string, help: string, a: number, b: number) => (
    <CompareCard
      key={label}
      label={label}
      help={help}
      badge={compare(a, b, "LightGBM", "persistence", "lower", 0.005, fmt.num)}
      main={{ who: "LightGBM", value: fmt.num(a), pct: (a / relMax(a, b)) * 100 }}
      other={{ who: "Persistence", value: fmt.num(b), pct: (b / relMax(a, b)) * 100 }}
    />
  );
  const sum = p.summary;
  const catA = sum.lightgbm?.category_accuracy_mean ?? 0;
  const catB = sum.persistence?.category_accuracy_mean ?? 0;

  return (
    <>
      <SectionTitle
        id="forecast"
        title="Forecast PM2.5 dan kategori"
        sub="Menebak 1 sampai 7 hari ke depan, diuji pada hari-hari yang tidak dipakai untuk melatih."
        action={
          <SegmentedControl
            label="Cara menguji forecast"
            value={which}
            onChange={setWhich}
            options={[
              { value: "holdout", label: "Holdout waktu" },
              ...(m.backtest
                ? [
                    {
                      value: "backtest" as const,
                      label: `Backtest ${m.backtest_folds.length} fold`,
                    },
                  ]
                : []),
            ]}
          />
        }
      />
      <section
        aria-label="Metrik forecast"
        className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-4"
      >
        {maeCard(
          `Galat H+${first}`,
          "Rata-rata meleset indeks PM2.5 untuk besok. Makin kecil makin baik.",
          mae(p, first, "lightgbm"),
          mae(p, first, "persistence"),
        )}
        {maeCard(
          `Galat H+${last}`,
          "Rata-rata meleset indeks PM2.5 untuk hari terjauh.",
          mae(p, last, "lightgbm"),
          mae(p, last, "persistence"),
        )}
        {maeCard(
          "Galat rata-rata",
          "Rata-rata galat dari semua hari prediksi.",
          sum.lightgbm?.mae_pm25_mean ?? NaN,
          sum.persistence?.mae_pm25_mean ?? NaN,
        )}
        <CompareCard
          label="Kategori tepat"
          help="Porsi hari yang kategorinya tertebak benar."
          badge={compare(catA, catB, "LightGBM", "persistence", "higher", 0.0005, (n) => fmt.m3(n))}
          main={{ who: "LightGBM", value: fmt.pct(catA), pct: catA * 100 }}
          other={{ who: "Persistence", value: fmt.pct(catB), pct: catB * 100 }}
        />
      </section>

      <section className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] gap-4">
        <Card aria-labelledby="h-fmae">
          <CardHeader
            id="h-fmae"
            title="Galat per hari prediksi"
            description="Makin ke kanan makin jauh harinya, galat ikut naik."
            action={
              <ChartLegend
                items={[
                  { label: "LightGBM", color: "var(--accent)" },
                  { label: "Persistence", color: "var(--series-2)" },
                ]}
              />
            }
          />
          <CardBody>
            <HorizonLines part={p} />
          </CardBody>
        </Card>
        <Card aria-labelledby="h-fcat">
          <CardHeader
            id="h-fcat"
            title="Ketepatan kategori per hari prediksi"
            description="Kategori turunan dari indeks tertinggi yang diprediksi."
            action={
              <ChartLegend
                items={[
                  { label: "LightGBM", color: "var(--accent)" },
                  { label: "Persistence", color: "var(--series-2)" },
                ]}
              />
            }
          />
          <CardBody>
            <CategoryLines part={p} />
          </CardBody>
        </Card>
      </section>

      <Card aria-labelledby="h-fhor">
        <CardHeader
          id="h-fhor"
          title="Rincian per hari prediksi"
          description="Galat PM2.5 (makin kecil makin baik) dan ketepatan kategori. Nilai terbaik per baris disorot."
        />
        <CardBody>
          <ScrollX label="Tabel rincian forecast per hari prediksi">
            <table className="ua-table min-w-[620px]">
              <caption className="sr-only">
                Galat PM2.5 dan ketepatan kategori per hari prediksi
              </caption>
              <thead>
                <tr>
                  <th scope="col">Hari prediksi</th>
                  <th scope="col">LightGBM</th>
                  <th scope="col">Persistence</th>
                  <th scope="col">Seasonal naive</th>
                  <th scope="col">Ketepatan kategori</th>
                </tr>
              </thead>
              <tbody>
                {hs.map((h) => {
                  const v = ["lightgbm", "persistence", "seasonal_naive"].map((k) => mae(p, h, k));
                  const best = Math.min(...v);
                  return (
                    <tr key={h}>
                      <th scope="row">H+{h}</th>
                      {v.map((x, i) => (
                        <td key={i}>
                          {x === best ? <span className="ua-best">{fmt.num(x)}</span> : fmt.num(x)}
                        </td>
                      ))}
                      <td>{fmt.pct(p.per_horizon[h]?.category_accuracy.lightgbm)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollX>
          <Callout>
            LightGBM lebih akurat dari kedua pembanding di {wins.length} dari {hs.length} hari
            prediksi
            {losses.length
              ? `; di ${losses.map((h) => `H+${h}`).join(", ")} salah satu pembanding lebih kecil galatnya`
              : ""}
            .
          </Callout>
        </CardBody>
      </Card>
    </>
  );
}

/* ───────────────────────── Baseline Orange, riwayat ───────────────────────── */

function Orange() {
  const q = useApi<OrangeBaseline>("/baseline/orange");
  const [pick, setPick] = useState("Random Forest");
  return (
    <>
      <SectionTitle
        id="orange"
        title="Baseline Orange Data Mining"
        sub="Hasil tugas kuliah (split 80:20 di Orange), dihitung ulang dari database."
      />
      <QueryView
        query={q}
        skeleton={<Skeleton className="h-40 w-full" />}
        isEmpty={(d) => d.rows === 0}
      >
        {(d) => (
          <section className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] gap-4">
            <Card aria-labelledby="h-orange-t">
              <CardHeader
                id="h-orange-t"
                title="Hasil per model"
                description={`${fmt.int(d.rows)} data uji · precision, recall, dan F1 berbobot menurut jumlah tiap kategori`}
              />
              <CardBody>
                <ScrollX label="Tabel metrik Orange">
                  <table className="ua-table min-w-[460px]">
                    <caption className="sr-only">Metrik model Orange</caption>
                    <thead>
                      <tr>
                        <th scope="col">Model</th>
                        <th scope="col">Accuracy</th>
                        <th scope="col">Precision</th>
                        <th scope="col">Recall</th>
                        <th scope="col">F1</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.models.map((x) => (
                        <tr key={x.model}>
                          <th scope="row">{x.model}</th>
                          <td>
                            {fmt.m3(x.accuracy)}
                            <span className="block text-xs font-medium text-ink-3">
                              {fmt.int(x.correct)} / {fmt.int(d.rows)}
                            </span>
                          </td>
                          <td>{fmt.m3(x.weighted.precision)}</td>
                          <td>{fmt.m3(x.weighted.recall)}</td>
                          <td className="font-bold">{fmt.m3(x.weighted.f1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollX>
                <Callout label="Catatan:">
                  {fmt.int(d.label_inconsistent)} baris uji berlabel tidak sesuai ambang ISPU, jadi
                  sebagian “kesalahan” model berasal dari label sumber, bukan dari modelnya.
                </Callout>
              </CardBody>
            </Card>
            <Card aria-labelledby="h-orange-cm">
              <CardHeader
                id="h-orange-cm"
                title="Confusion matrix"
                action={
                  <Field label="Model" htmlFor="cm-orange" className="w-44">
                    <Select id="cm-orange" value={pick} onChange={(e) => setPick(e.target.value)}>
                      {d.models.map((x) => (
                        <option key={x.model}>{x.model}</option>
                      ))}
                    </Select>
                  </Field>
                }
              />
              <CardBody>
                {(() => {
                  const x = d.models.find((y) => y.model === pick);
                  return x ? (
                    <ConfusionMatrix
                      labels={d.labels}
                      matrix={x.confusion_matrix}
                      color="var(--accent)"
                      name={`${pick} (Orange)`}
                    />
                  ) : null;
                })()}
              </CardBody>
            </Card>
          </section>
        )}
      </QueryView>
    </>
  );
}

function History() {
  const models = useApi<ModelVersion[]>("/models");
  const runs = useApi<TrainingRun[]>("/training-runs", { limit: 5 });
  const tone = (s: string) =>
    s === "champion"
      ? "ua-badge--success"
      : s === "rejected"
        ? "ua-badge--warning"
        : "ua-badge--neutral";
  return (
    <>
      <SectionTitle
        id="riwayat"
        title="Riwayat model"
        sub="Setiap latihan ulang menghasilkan versi baru; hanya yang tidak lebih buruk dari champion yang dipakai."
      />
      <section className="grid gap-4">
        <Card aria-labelledby="h-versions">
          <CardHeader id="h-versions" title="Versi model" />
          <CardBody>
            <QueryView
              query={models}
              skeleton={<Skeleton className="h-40 w-full" />}
              isEmpty={(d) => d.length === 0}
            >
              {(d) => (
                <ScrollX label="Tabel versi model">
                  <table className="ua-table min-w-[560px]">
                    <caption className="sr-only">Versi model</caption>
                    <thead>
                      <tr>
                        <th scope="col" className="ua-left">
                          Model
                        </th>
                        <th scope="col" className="ua-left">
                          Status
                        </th>
                        <th scope="col" className="ua-left">
                          Dibuat
                        </th>
                        <th scope="col">Metrik utama</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.map((v) => (
                        <tr key={v.id}>
                          <th scope="row">
                            {v.task === "forecast" ? "Forecast" : "Klasifikasi"} v{v.version}
                          </th>
                          <td className="ua-left">
                            <span className={`ua-badge ${tone(v.status)}`}>{v.status}</span>
                          </td>
                          <td className="ua-left ua-mute">{fmt.dateTime(v.created_at)}</td>
                          <td>
                            {v.primary_metric} = {fmt.num(v.primary_value)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollX>
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
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {d.map((r) => (
                    <li key={r.id} className="rounded-md border border-line p-3 text-sm">
                      <p className="m-0 font-bold">
                        #{r.id} · {r.trigger} · {r.status}
                      </p>
                      <p className="m-0 text-xs text-ink-3">{fmt.dateTime(r.created_at)}</p>
                      {r.message ? <p className="m-0 mt-1">{r.message}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
            </QueryView>
          </CardBody>
        </Card>
      </section>
    </>
  );
}

/* ───────────────────────── Halaman ───────────────────────── */

function insightsOf(cls: ModelVersion | null, fc: ModelVersion | null): Insight[] | null {
  if (!cls || !fc) return null;
  const c = cls.metrics as unknown as ClsMetrics;
  const f = fc.metrics as unknown as FcMetrics;
  const main = c.stratified_80_20[cls.algorithm];
  const rule = c.stratified_80_20[RULE];
  if (!main || !rule) return null;
  const hs = horizonKeys(f.holdout);
  const wins = hs.filter(
    (h) =>
      mae(f.holdout, h, "lightgbm") <
      Math.min(mae(f.holdout, h, "persistence"), mae(f.holdout, h, "seasonal_naive")),
  ).length;
  const better = main.accuracy > rule.accuracy;
  return [
    better
      ? {
          big: fmt.pct(main.accuracy),
          text: `tebakan kategori tepat oleh ${modelLabel(cls.algorithm)} pada ${fmt.int(main.n)} hari uji, lebih baik dari aturan ambang ISPU (${fmt.pct(rule.accuracy)}).`,
        }
      : {
          big: fmt.pct(rule.accuracy),
          text: `tebakan kategori tepat oleh aturan ambang ISPU pada ${fmt.int(rule.n)} hari uji. Model terbaik (${modelLabel(cls.algorithm)}) tepat ${fmt.pct(main.accuracy)}.`,
        },
    {
      big: fmt.num(f.holdout.summary.lightgbm?.mae_pm25_mean),
      text: `rata-rata meleset indeks PM2.5 pada prediksi 1–${hs.length} hari. Tebakan “sama seperti kemarin” meleset ${fmt.num(f.holdout.summary.persistence?.mae_pm25_mean)}.`,
    },
    {
      big: `${wins} dari ${hs.length}`,
      text: "hari prediksi di mana forecast lebih akurat dari kedua pembanding (persistence dan seasonal naive).",
    },
  ];
}

export function EvaluasiView() {
  const champions = useApi<Record<string, ModelVersion | null>>("/models/champions");
  const cls = champions.data?.classification ?? null;
  const fc = champions.data?.forecast ?? null;
  const cm = cls ? (cls.metrics as unknown as ClsMetrics) : null;
  const chips = cm
    ? [
        { k: "Split acak", v: `80 / 20 · ${fmt.int(cm.n_stratified_test)} hari uji` },
        {
          k: "Holdout waktu",
          v: `sejak ${fmt.date(cm.comparison.holdout_start)} · ${fmt.int(cm.n_holdout)} hari`,
        },
        { k: "Sumber", v: "Satu Data Jakarta" },
      ]
    : [];

  return (
    <>
      <PageHeader
        title="Evaluasi model"
        description="Seberapa tepat model menebak kategori udara dan memperkirakan PM2.5, dibandingkan dengan tebakan sederhana."
        meta={chips}
      />
      <div className="flex flex-wrap gap-4">
        <div className="min-w-0 flex-[999_1_520px] [&>*]:h-full">
          <ConclusionCard
            insights={champions.isPending ? null : insightsOf(cls, fc)}
            chip={
              cls && fc
                ? `Klasifikasi: ${modelLabel(cls.algorithm)} v${cls.version} · Forecast: ${modelLabel(fc.algorithm)} v${fc.version}`
                : undefined
            }
          />
        </div>
        <div className="min-w-0 flex-[1_1_320px] [&>*]:h-full">
          <IspuScaleCard />
        </div>
      </div>

      <QueryView query={champions} skeleton={<ChartSkeleton height={400} />}>
        {() => (
          <>
            {cls ? <Classification mv={cls} /> : <EmptyState title="Belum ada model klasifikasi" />}
            {fc ? <Forecast mv={fc} /> : <EmptyState title="Belum ada model forecast" />}
          </>
        )}
      </QueryView>
      <Orange />
      <History />
    </>
  );
}
