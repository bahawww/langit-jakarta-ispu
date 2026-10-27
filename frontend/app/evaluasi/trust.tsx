"use client";

import { useState } from "react";

import {
  CvStrips,
  GridTable,
  LineChart,
  modelVar,
  useModelColors,
  type Line,
} from "@/components/analysis-charts";
import { ChartLegend } from "@/components/chart";
import { ChartSkeleton, QueryView } from "@/components/states";
import { Callout } from "@/components/ui/callout";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { A_MODEL_NAME, MODEL_KEYS, useAnalysis, type Analysis } from "@/lib/analysis";
import { fmt } from "@/lib/format";
import { kategoriMeta } from "@/lib/kategori";

function Baselines({ d }: { d: Analysis }) {
  const rows = [
    {
      key: "random",
      label: "Tebakan acak",
      note: "Menebak kategori sesuai proporsinya di data",
      v: d.baselines.random.accuracy,
      color: "var(--bar-muted)",
    },
    {
      key: "majority",
      label: `Selalu tebak ${kategoriMeta(d.baselines.majority.label).label}`,
      note: "Kategori yang paling sering muncul, tanpa machine learning",
      v: d.baselines.majority.accuracy,
      color: "var(--bar-muted)",
    },
    ...[...MODEL_KEYS]
      .sort((a, b) => d.test_accuracy[a] - d.test_accuracy[b])
      .map((m) => ({
        key: m,
        label: A_MODEL_NAME[m],
        note: "Model dasar sklearn, tanpa tuning",
        v: d.test_accuracy[m],
        color: modelVar[m],
      })),
  ];
  const best = MODEL_KEYS.reduce((a, b) => (d.test_accuracy[b] > d.test_accuracy[a] ? b : a));
  const gap = (d.test_accuracy[best] - d.baselines.majority.accuracy) * 100;
  return (
    <Card aria-labelledby="h-base">
      <CardHeader
        id="h-base"
        title="Lebih baik dari tebakan asal?"
        description={`Dua tebakan tanpa machine learning sebagai pembanding, pada ${fmt.int(d.n_test)} hari uji. Kalau model tidak jauh lebih baik dari ini, model belum berguna.`}
      />
      <CardBody>
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {rows.map((r) => (
            <li
              key={r.key}
              className="grid grid-cols-[minmax(150px,260px)_minmax(0,1fr)_64px] items-center gap-x-4 gap-y-1 max-sm:grid-cols-[minmax(0,1fr)_64px]"
            >
              <span className="flex flex-col gap-0.5 max-sm:col-span-2">
                <span className="text-[15px] font-bold">{r.label}</span>
                <span className="text-[13px] text-ink-3">{r.note}</span>
              </span>
              <span className="ua-bar" style={{ height: 14 }} aria-hidden>
                <span
                  className="ua-anim-grow"
                  style={{ width: `${r.v * 100}%`, background: r.color }}
                />
              </span>
              <span className="text-right text-[17px] font-extrabold">{fmt.m3(r.v)}</span>
            </li>
          ))}
        </ul>
        <p className="m-0 max-w-[64ch] text-base leading-[1.55] text-ink-2">
          {A_MODEL_NAME[best]} <b className="font-extrabold text-ink">{fmt.num(gap)} poin</b> lebih
          akurat dari tebakan naif terbaik.{" "}
          {gap >= 10
            ? "Selisih ini cukup besar, jadi model benar-benar mempelajari pola dari data."
            : "Selisih ini kecil, jadi model belum banyak membantu dibanding tebakan sederhana."}
        </p>
      </CardBody>
    </Card>
  );
}

function PrAndCv({ d }: { d: Analysis }) {
  const colors = useModelColors();
  const [metric, setMetric] = useState<"accuracy" | "macro_f1">("accuracy");
  const lines: Line[] = MODEL_KEYS.flatMap((m) => {
    const pr = d.pr[m];
    return pr
      ? [
          {
            name: `${A_MODEL_NAME[m]} (AP ${fmt.m3(pr.ap)})`,
            color: colors[m],
            data: pr.recall.map((r, i) => [r, pr.precision[i]!] as [number, number]),
          },
        ]
      : [];
  });
  return (
    <section className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,440px),1fr))] gap-x-16 gap-y-12">
      <Card aria-labelledby="h-pr">
        <CardHeader
          id="h-pr"
          title="Kurva precision–recall"
          description={`Khusus kategori ${kategoriMeta(d.pr.label).label}. Lebih jujur dari ROC saat jumlah kategori tidak seimbang. Makin dekat ke pojok kanan atas, makin baik.`}
        />
        <CardBody>
          <ChartLegend
            items={lines.map((l) => ({ label: l.name, color: l.color, kind: "line" }))}
          />
          <LineChart
            lines={lines}
            xName="Recall (hari Tidak Sehat yang terdeteksi)"
            yName="Precision"
            xMax={1}
            yMin={0}
            label={`Kurva precision–recall kategori ${kategoriMeta(d.pr.label).label}`}
          />
        </CardBody>
      </Card>
      <Card aria-labelledby="h-cv">
        <CardHeader
          id="h-cv"
          title="Diuji lima kali"
          description="Cross-validation 5 lipatan: data dibagi lima, model diuji bergantian pada tiap bagian. Sebaran yang sempit berarti hasilnya stabil."
        />
        <CardBody>
          <SegmentedControl
            label="Ukuran ketepatan"
            value={metric}
            onChange={setMetric}
            options={[
              { value: "accuracy", label: "Akurasi" },
              { value: "macro_f1", label: "F1 makro" },
            ]}
          />
          <CvStrips cv={d.cv} metric={metric} />
        </CardBody>
      </Card>
    </section>
  );
}

function Tuning({ d }: { d: Analysis }) {
  const colors = useModelColors();
  const bestDepth = d.depth.depth[d.depth.test.indexOf(Math.max(...d.depth.test))]!;
  const lo = Math.max(
    0,
    Math.floor((Math.min(...d.depth.test, ...d.depth.train) - 0.01) * 50) / 50,
  );
  const lines: Line[] = [
    {
      name: "Data latih",
      color: colors.decision_tree,
      dashed: true,
      width: 2,
      data: d.depth.depth.map((x, i) => [x, d.depth.train[i]!]),
    },
    {
      name: "Data uji",
      color: colors.decision_tree,
      data: d.depth.depth.map((x, i) => [x, d.depth.test[i]!]),
    },
  ];
  const flat = d.grid.f1.flat();
  return (
    <section className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,440px),1fr))] gap-x-16 gap-y-12">
      <Card aria-labelledby="h-grid">
        <CardHeader
          id="h-grid"
          title="Bagaimana kalau pengaturannya diubah?"
          description="F1 makro Random Forest pada data uji untuk tiap kombinasi jumlah pohon dan kedalaman. Makin gelap, makin baik."
        />
        <CardBody>
          <GridTable grid={d.grid} />
          <p className="m-0 text-[15px] leading-[1.55] text-ink-2">
            Yang dipakai tetap pengaturan <b className="font-extrabold text-ink">bawaan sklearn</b>{" "}
            (100 pohon, tanpa batas kedalaman, bergaris tepi). Selisih terbaik dan terburuk di tabel
            hanya {fmt.m3(Math.max(...flat) - Math.min(...flat))}. Ini analisis, model tidak
            diganti.
          </p>
        </CardBody>
      </Card>
      <Card aria-labelledby="h-depth">
        <CardHeader
          id="h-depth"
          title="Seberapa dalam pohonnya?"
          description="Akurasi Decision Tree untuk tiap kedalaman maksimal. Kalau skor data latih terus naik tapi data uji tidak, pohon mulai menghafal."
        />
        <CardBody>
          <ChartLegend
            items={[
              { label: "Data latih", color: colors.decision_tree, kind: "dash" },
              { label: "Data uji", color: colors.decision_tree, kind: "line" },
            ]}
          />
          <LineChart
            lines={lines}
            xName="Kedalaman maksimal"
            yName="Akurasi"
            xMin={1}
            xMax={20}
            yMin={lo}
            label="Akurasi Decision Tree menurut kedalaman maksimal, data latih dan data uji"
          />
          <p className="m-0 text-[15px] leading-[1.55] text-ink-2">
            Akurasi data uji tertinggi di kedalaman{" "}
            <b className="font-extrabold text-ink">{bestDepth}</b> (
            {fmt.m3(Math.max(...d.depth.test))}
            ). Decision Tree bawaan tumbuh sedalam {d.tree.depth} tingkat. Sumbu dimulai dari{" "}
            {fmt.m3(lo)}.
          </p>
        </CardBody>
      </Card>
    </section>
  );
}

/** Bagian Evaluasi dari mockup: pembanding dasar, precision–recall, cross-validation, pengaturan. */
export function TrustSections() {
  const q = useAnalysis();
  return (
    <QueryView
      query={q}
      skeleton={
        <>
          <Skeleton className="h-72 w-full" />
          <ChartSkeleton height={320} />
        </>
      }
    >
      {(d) => (
        <>
          <Baselines d={d} />
          <PrAndCv d={d} />
          <Tuning d={d} />
          <Callout label="Hasil dihitung ulang aplikasi.">
            Semua grafik di atas memakai split acak 80:20 dan cross-validation dari{" "}
            {fmt.int(d.rows)} hari-stasiun, jadi angkanya bisa sedikit berbeda dari baseline Orange
            di bawah.
          </Callout>
        </>
      )}
    </QueryView>
  );
}
