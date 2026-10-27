"use client";

import { useMemo, useState } from "react";

import {
  ImportanceBars,
  LineChart,
  TreeDiagram,
  modelVar,
  useModelColors,
  type Line,
} from "@/components/analysis-charts";
import { ChartLegend } from "@/components/chart";
import { ConfusionMatrix } from "@/components/confusion-matrix";
import { ChartSkeleton, QueryView } from "@/components/states";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { A_MODEL_NAME, MODEL_KEYS, useAnalysis, type AModel } from "@/lib/analysis";
import type { OrangeBaseline } from "@/lib/api";
import { fmt } from "@/lib/format";
import { kategoriMeta } from "@/lib/kategori";
import type { ModelKey } from "@/lib/models";

const NAME_OF: Record<ModelKey, string> = { rf: "Random Forest", dt: "Decision Tree", knn: "kNN" };
const KEY_OF: Record<ModelKey, AModel> = {
  rf: "random_forest",
  dt: "decision_tree",
  knn: "knn",
};
const modelOptions = MODEL_KEYS.map((m) => ({ value: m, label: A_MODEL_NAME[m] }));

/** Kesalahan terbesar dari matriks: sel di luar diagonal dengan jumlah terbanyak. */
function biggestMix(labels: string[], m: number[][]) {
  let best: { from: string; to: string; n: number } | null = null;
  m.forEach((row, i) =>
    row.forEach((n, j) => {
      if (i !== j && n > (best?.n ?? 0)) best = { from: labels[i]!, to: labels[j]!, n };
    }),
  );
  return best as { from: string; to: string; n: number } | null;
}

/** "Kategori mana yang sering tertukar": confusion matrix model terpilih pada data uji Orange. */
export function ConfusionSection({
  summary,
  model,
}: {
  summary: { data: OrangeBaseline | undefined; isPending: boolean };
  model: ModelKey;
}) {
  const d = summary.data;
  const x = d?.models.find((m) => m.model === NAME_OF[model]);
  const mix = d && x ? biggestMix(d.labels, x.confusion_matrix) : null;
  return (
    <Card aria-labelledby="h-cm">
      <CardHeader
        id="h-cm"
        title="Kategori mana yang sering tertukar"
        description="Baris adalah kategori sebenarnya, kolom adalah tebakan model. Angka di diagonal berarti benar."
      />
      <CardBody>
        {!d || !x ? (
          <Skeleton className="h-56 w-full max-w-xl" />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] items-start gap-x-16 gap-y-6">
            <div className="ua-panel max-w-xl">
              <ConfusionMatrix
                labels={d.labels}
                matrix={x.confusion_matrix}
                color={modelVar[KEY_OF[model]]}
                name={x.model}
              />
            </div>
            <p className="ua-lead !text-[19px]">
              {mix ? (
                <>
                  {x.model} paling sering menukar <b>{kategoriMeta(mix.from).label}</b> dengan{" "}
                  <b>{kategoriMeta(mix.to).label}</b>: <b>{fmt.int(mix.n)} hari</b> dari{" "}
                  {fmt.int(d.rows)} hari uji.
                </>
              ) : (
                <>{x.model} tidak menukar kategori apa pun pada data uji ini.</>
              )}
            </p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/** "Yang paling menentukan" dan kurva ROC. */
export function FactorsSection() {
  const q = useAnalysis();
  const [pick, setPick] = useState<AModel>("random_forest");
  const colors = useModelColors();
  const lines: Line[] = useMemo(
    () =>
      q.data
        ? MODEL_KEYS.map((m) => ({
            name: `${A_MODEL_NAME[m]} (AUC ${fmt.m3(q.data.roc[m].auc)})`,
            color: colors[m],
            data: q.data.roc[m].fpr.map((x, i) => [x, q.data.roc[m].tpr[i]!] as [number, number]),
          }))
        : [],
    [q.data, colors],
  );
  return (
    <section className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] gap-x-16 gap-y-12">
      <Card aria-labelledby="h-faktor">
        <CardHeader
          id="h-faktor"
          title="Yang paling menentukan"
          description={`Seberapa besar tiap polutan memengaruhi tebakan ${A_MODEL_NAME[pick]} (permutation importance pada data uji).`}
        />
        <CardBody>
          <SegmentedControl
            label="Model untuk faktor penentu"
            options={modelOptions}
            value={pick}
            onChange={setPick}
          />
          <QueryView query={q} skeleton={<Skeleton className="h-56 w-full" />}>
            {(d) => (
              <ImportanceBars
                importance={d.importance[pick]}
                names={d.features}
                color={modelVar[pick]}
              />
            )}
          </QueryView>
        </CardBody>
      </Card>
      <Card aria-labelledby="h-roc">
        <CardHeader
          id="h-roc"
          title="Kurva ROC"
          description="Makin melengkung ke pojok kiri atas, makin baik. Dihitung per kategori lalu dirata-rata."
        />
        <CardBody>
          <QueryView query={q} skeleton={<ChartSkeleton height={300} />}>
            {() => (
              <>
                <ChartLegend
                  items={lines.map((l) => ({ label: l.name, color: l.color, kind: "line" }))}
                />
                <LineChart
                  lines={lines}
                  xName="Alarm palsu (false positive rate)"
                  yName="Terdeteksi (recall)"
                  xMax={1}
                  diagonal
                  label={`Kurva ROC: ${MODEL_KEYS.map((m) => `${A_MODEL_NAME[m]} AUC ${fmt.m3(q.data!.roc[m].auc)}`).join(", ")}`}
                />
              </>
            )}
          </QueryView>
        </CardBody>
      </Card>
    </section>
  );
}

/** "Menghafal atau memahami?" (learning curve) dan "Cara Decision Tree memutuskan". */
export function GeneralizationSection() {
  const q = useAnalysis();
  const [pick, setPick] = useState<AModel>("decision_tree");
  const colors = useModelColors();
  const gaps = q.data
    ? MODEL_KEYS.map((m) => {
        const l = q.data.learning[m];
        return { m, gap: l.train.at(-1)! - l.val.at(-1)! };
      })
    : [];
  const lines: Line[] = q.data
    ? [
        {
          name: "Data latih",
          color: colors[pick],
          dashed: true,
          width: 2,
          data: q.data.learning.sizes.map((s, i) => [s, q.data.learning[pick].train[i]!]),
        },
        {
          name: "Data baru",
          color: colors[pick],
          data: q.data.learning.sizes.map((s, i) => [s, q.data.learning[pick].val[i]!]),
        },
      ]
    : [];
  const lo = q.data
    ? Math.max(
        0,
        Math.floor((Math.min(...lines.flatMap((l) => l.data.map((p) => p[1]))) - 0.01) * 50) / 50,
      )
    : 0;
  return (
    <section className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] gap-x-16 gap-y-12">
      <Card aria-labelledby="h-hafal">
        <CardHeader
          id="h-hafal"
          title="Menghafal atau memahami?"
          description="Garis putus-putus adalah akurasi di data latih, garis penuh di data baru. Jarak yang lebar berarti model menghafal."
        />
        <CardBody>
          <SegmentedControl
            label="Model untuk kurva belajar"
            options={modelOptions}
            value={pick}
            onChange={setPick}
          />
          <QueryView query={q} skeleton={<ChartSkeleton height={300} />}>
            {() => (
              <>
                <LineChart
                  lines={lines}
                  xName="Jumlah hari latih"
                  yName="Akurasi"
                  xMin={q.data!.learning.sizes[0]! * 0.9}
                  xMax={q.data!.learning.sizes.at(-1)!}
                  yMin={lo}
                  label={`Kurva belajar ${A_MODEL_NAME[pick]}: akurasi data latih dan data baru menurut jumlah data latih`}
                />
                <p className="m-0 text-[15px] leading-[1.55] text-ink-2">
                  Selisih akurasi data latih dan data baru pada data penuh:{" "}
                  {gaps.map((g, i) => (
                    <span key={g.m}>
                      {i > 0 ? ", " : ""}
                      {A_MODEL_NAME[g.m]} <b className="font-extrabold">{fmt.m3(g.gap)}</b>
                    </span>
                  ))}
                  . Sumbu dimulai dari {fmt.m3(lo)}.
                </p>
              </>
            )}
          </QueryView>
        </CardBody>
      </Card>
      <Card aria-labelledby="h-pohon">
        <CardHeader
          id="h-pohon"
          title="Cara Decision Tree memutuskan"
          description={
            q.data
              ? `Dua pertanyaan pertama dari ${q.data.tree.depth} tingkat. Angka di bawah adalah jumlah hari latih.`
              : "Dua pertanyaan pertama pohon keputusan."
          }
        />
        <CardBody>
          <QueryView query={q} skeleton={<Skeleton className="h-64 w-full" />}>
            {(d) => <TreeDiagram tree={d.tree} names={d.features} />}
          </QueryView>
        </CardBody>
      </Card>
    </section>
  );
}
