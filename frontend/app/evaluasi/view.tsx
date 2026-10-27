"use client";

import { useState } from "react";

import { ConclusionCard, type Insight } from "@/components/conclusion-card";
import { ConfusionMatrix, classStats } from "@/components/confusion-matrix";
import { DistributionBar, IspuScaleCard, IspuSwatch } from "@/components/ispu";
import { PageHeader } from "@/components/page-header";
import { TrustSections } from "@/app/evaluasi/trust";
import { MetricCard } from "@/components/stat-card";
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
const ORDER = ["decision_tree", "random_forest", "knn"];

const same = (d: number, eps: number) => Math.abs(d) < eps;
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
  const [view, setView] = useState("compare");
  const set = proto === "stratified" ? m.stratified_80_20 : m.holdout;
  const alg = mv.algorithm;
  const main = set[alg];
  if (!main) return <EmptyState title="Metrik klasifikasi belum lengkap" />;

  const mainName = modelLabel(alg);
  const kpis: { label: string; help: string; value: number }[] = [
    {
      label: "Accuracy",
      help: "Porsi tebakan kategori yang tepat dari semua hari uji.",
      value: main.accuracy,
    },
    {
      label: "Precision",
      help: "Saat model bilang kategori X, seberapa sering benar (rata-rata kategori).",
      value: main.macro.precision,
    },
    {
      label: "Recall",
      help: "Dari semua hari kategori X, berapa yang tertangkap (rata-rata kategori).",
      value: main.macro.recall,
    },
    {
      label: "F1",
      help: "Gabungan precision dan recall dalam satu angka (rata-rata kategori).",
      value: main.macro.f1,
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

  const shown = keys
    .filter((k) => view === "compare" || view === k)
    .map((k) => ({ key: k, name: modelLabel(k), color: "var(--series-1)", metric: set[k]! }));
  const counts = Object.fromEntries(
    main.labels.map((l, i) => [l, main.confusion_matrix[i]!.reduce((a, b) => a + b, 0)]),
  );

  return (
    <>
      <SectionTitle
        id="klasifikasi"
        title="Klasifikasi kategori"
        sub={`Menebak kategori ISPU dari 6 polutan di hari yang sama. Model aktif: ${mainName}.`}
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
          <MetricCard
            key={k.label}
            label={k.label}
            help={k.help}
            value={fmt.m3(k.value)}
            note={`${mainName} · ${fmt.int(main.n)} hari uji`}
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
              ...keys.map((k) => ({ value: k, label: modelLabel(k) })),
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
            <Card key={x.key} panel aria-label={`Confusion matrix ${x.name}`}>
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
            <Card panel aria-labelledby="h-orange-cm">
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
                      color="var(--series-1)"
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
                          <th scope="row">Klasifikasi v{v.version}</th>
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
                    <li key={r.id} className="border-b border-line-soft py-3 text-sm">
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

function insightsOf(cls: ModelVersion | null): Insight[] | null {
  if (!cls) return null;
  const c = cls.metrics as unknown as ClsMetrics;
  const main = c.stratified_80_20[cls.algorithm];
  if (!main) return null;
  const others = ORDER.map((k) => ({ k, m: c.stratified_80_20[k] })).filter(
    (x): x is { k: string; m: ClsMetric } => Boolean(x.m),
  );
  const lowest = others.reduce((a, b) => (b.m.accuracy < a.m.accuracy ? b : a));
  return [
    {
      big: fmt.pct(main.accuracy),
      text: `tebakan kategori tepat oleh ${modelLabel(cls.algorithm)} pada ${fmt.int(main.n)} hari uji (split acak 80:20).`,
    },
    {
      big: fmt.int(main.n - main.correct),
      text: `hari uji yang meleset dari ${fmt.int(main.n)} oleh ${modelLabel(cls.algorithm)}.`,
    },
    {
      big: fmt.pct(lowest.m.accuracy),
      text: `ketepatan model paling rendah di antara tiga model dasar (${modelLabel(lowest.k)}).`,
    },
  ];
}

export function EvaluasiView() {
  const champions = useApi<Record<string, ModelVersion | null>>("/models/champions");
  const cls = champions.data?.classification ?? null;
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
        description="Seberapa tepat tiga model dasar (Decision Tree, Random Forest, kNN dengan k=5) menebak kategori udara dari enam polutan."
        meta={chips}
      />
      <div className="flex flex-wrap gap-4">
        <div className="min-w-0 flex-[999_1_520px] [&>*]:h-full">
          <ConclusionCard
            insights={champions.isPending ? null : insightsOf(cls)}
            chip={cls ? `Model aktif: ${modelLabel(cls.algorithm)} v${cls.version}` : undefined}
          />
        </div>
        <div className="min-w-0 flex-[1_1_320px] [&>*]:h-full">
          <IspuScaleCard />
        </div>
      </div>

      <TrustSections />

      <QueryView query={champions} skeleton={<ChartSkeleton height={400} />}>
        {() => (
          <>
            {cls ? <Classification mv={cls} /> : <EmptyState title="Belum ada model klasifikasi" />}
          </>
        )}
      </QueryView>
      <Orange />
      <History />
    </>
  );
}
