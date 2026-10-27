"use client";

import { useMemo, useState } from "react";

import { ImportanceBars, LineChart, modelVar, useModelColors } from "@/components/analysis-charts";
import { PageHeader } from "@/components/page-header";
import { ChartSkeleton, QueryView } from "@/components/states";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { A_MODEL_NAME, MODEL_KEYS, useAnalysis, type Analysis } from "@/lib/analysis";
import { fmt } from "@/lib/format";
import { kategoriMeta } from "@/lib/kategori";

const GLOSSARY: { id: string; title: string; terms: (readonly [string, string])[] }[] = [
  {
    id: "udara",
    title: "Udara dan ISPU",
    terms: [
      [
        "ISPU",
        "Indeks Standar Pencemar Udara. Angka tanpa satuan yang merangkum kualitas udara harian dari beberapa polutan.",
      ],
      [
        "Kategori ISPU",
        "Baik 0–50, Sedang 51–100, Tidak Sehat 101–200, Sangat Tidak Sehat 201–300, Berbahaya di atas 300. Ditentukan nilai polutan tertinggi hari itu.",
      ],
      [
        "PM2.5",
        "Partikel melayang berdiameter kurang dari 2,5 mikrometer, sekitar 30 kali lebih kecil dari lebar rambut. Cukup kecil untuk masuk jauh ke paru-paru dan aliran darah.",
      ],
      [
        "PM10",
        "Partikel melayang berdiameter kurang dari 10 mikrometer, seperti debu jalan dan serbuk. Tertahan di saluran napas atas.",
      ],
      [
        "SO₂",
        "Sulfur dioksida, gas dari pembakaran bahan bakar yang mengandung belerang, misalnya batu bara dan solar.",
      ],
      [
        "CO",
        "Karbon monoksida, gas tak berbau hasil pembakaran tidak sempurna, terutama dari knalpot kendaraan.",
      ],
      [
        "O₃",
        "Ozon permukaan. Tidak keluar dari knalpot langsung, tetapi terbentuk saat gas kendaraan bereaksi dengan sinar matahari.",
      ],
      [
        "NO₂",
        "Nitrogen dioksida, gas dari mesin kendaraan dan pembangkit listrik. Mengiritasi saluran napas.",
      ],
      [
        "Polutan kritis",
        "Polutan dengan indeks tertinggi pada hari itu. Nilainya menjadi nilai ISPU hari itu, jadi dialah yang menentukan kategori.",
      ],
      [
        "Nilai indeks",
        "Angka ISPU, bukan kadar asli dalam µg/m³. Angka 100 pada PM2.5 dan 100 pada CO sama-sama berarti batas Sedang.",
      ],
    ],
  },
  {
    id: "data",
    title: "Data dan persiapan",
    terms: [
      [
        "Supervised learning",
        "Belajar dari contoh yang sudah punya jawaban. Di sini jawabannya adalah kategori ISPU tiap hari.",
      ],
      ["Fitur", "Angka masukan yang dilihat model. Di sini enam nilai polutan harian."],
      ["Label", "Jawaban yang ingin ditebak model. Di sini kategori ISPU."],
      [
        "Data latih dan data uji",
        "Data latih untuk belajar, data uji untuk menilai. Data uji tidak boleh dilihat model saat belajar, supaya nilainya jujur.",
      ],
      [
        "Stratified split",
        "Pembagian data latih dan uji yang menjaga perbandingan tiap kategori tetap sama di kedua bagian.",
      ],
      [
        "Data tidak seimbang",
        "Satu kategori jauh lebih banyak dari yang lain. Di sini hari Sedang mendominasi, jadi accuracy saja bisa terlihat bagus padahal kategori langka sering salah.",
      ],
    ],
  },
  {
    id: "model",
    title: "Model",
    terms: [
      [
        "Decision Tree",
        "Satu pohon berisi pertanyaan ya/tidak berurutan, misalnya “PM2.5 ≤ 100?”.",
      ],
      [
        "Random Forest",
        "Kumpulan banyak pohon keputusan. Tiap pohon menebak, lalu tebakan terbanyak yang dipakai.",
      ],
      [
        "kNN (k=5)",
        "Mencari lima hari yang nilainya paling mirip, lalu mengikuti kategori terbanyak di antaranya.",
      ],
      [
        "Hyperparameter",
        "Pengaturan model yang ditentukan sebelum belajar, misalnya kedalaman pohon atau jumlah tetangga k.",
      ],
      [
        "Baseline",
        "Tebakan sederhana sebagai pembanding, misalnya selalu menjawab kategori terbanyak. Model yang berguna harus mengalahkannya.",
      ],
    ],
  },
  {
    id: "nilai",
    title: "Mengukur ketepatan",
    terms: [
      ["Accuracy", "Porsi tebakan yang benar dari semua tebakan."],
      ["Precision", "Saat model menyebut sebuah kategori, seberapa sering tebakan itu benar."],
      [
        "Recall",
        "Dari semua hari yang benar-benar masuk sebuah kategori, berapa yang berhasil ditebak.",
      ],
      ["F1-score", "Rata-rata harmonik precision dan recall. Tinggi hanya jika keduanya tinggi."],
      [
        "Macro dan weighted",
        "Dua cara merata-ratakan skor antar kategori. Macro memperlakukan semua kategori sama, weighted memperhitungkan jumlah hari tiap kategori.",
      ],
      [
        "Confusion matrix",
        "Tabel tebakan melawan kenyataan. Diagonal berisi tebakan benar, sisanya menunjukkan kategori mana yang tertukar.",
      ],
      [
        "Kurva ROC",
        "Grafik laju tebakan benar (recall) melawan laju alarm palsu pada setiap ambang keyakinan. Makin menempel ke pojok kiri atas, makin baik. Garis diagonal setara menebak acak.",
      ],
      [
        "AUC",
        "Luas di bawah kurva ROC. 1,0 sempurna, 0,5 sama dengan menebak acak. Untuk lima kategori, tiap kategori dibandingkan dengan sisanya.",
      ],
      [
        "Kurva PR",
        "Grafik precision melawan recall. Lebih jujur daripada ROC bila kategori yang dicari jarang muncul.",
      ],
      [
        "Average precision",
        "Luas di bawah kurva PR. Merangkum satu kurva jadi satu angka antara 0 dan 1.",
      ],
    ],
  },
  {
    id: "andal",
    title: "Seberapa bisa dipercaya",
    terms: [
      ["Overfitting", "Model terlalu menghafal data latih sehingga kurang tepat pada data baru."],
      [
        "Underfitting",
        "Model terlalu sederhana sehingga bahkan data latih pun tidak tertebak dengan baik.",
      ],
      ["Cross-validation", "Data dibagi beberapa bagian, model diuji bergantian pada tiap bagian."],
      [
        "Generalisasi",
        "Kemampuan model menebak data yang belum pernah dilihat. Selisih kecil antara skor latih dan skor uji menandakan generalisasi baik.",
      ],
    ],
  },
  {
    id: "tafsir",
    title: "Membaca isi model",
    terms: [
      [
        "Permutation importance",
        "Seberapa turun akurasi bila nilai satu polutan diacak. Makin turun, makin menentukan.",
      ],
      [
        "Partial dependence",
        "Rata-rata tebakan model bila hanya satu polutan yang diubah dan lainnya dibiarkan.",
      ],
    ],
  },
];

function Importance({ d }: { d: Analysis }) {
  const top = MODEL_KEYS.map((m) => {
    const [f] = Object.entries(d.importance[m]).sort(([, a], [, b]) => b - a)[0]!;
    return { m, name: d.features[f] ?? f, share: d.importance[m][f]! };
  });
  return (
    <Card aria-labelledby="h-imp">
      <CardHeader
        id="h-imp"
        title="Polutan mana yang paling diperhatikan"
        description={`Penurunan akurasi saat nilai satu polutan diacak pada ${fmt.int(d.n_test)} hari uji, dinyatakan sebagai porsi. Makin besar, makin menentukan.`}
      />
      <CardBody>
        <div className="ua-panel grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-x-12 gap-y-8">
          {MODEL_KEYS.map((m) => (
            <div key={m} className="flex min-w-0 flex-col gap-4">
              <h3 className="m-0 flex items-center gap-2 text-[17px] font-bold">
                <span className="ua-dot" style={{ background: modelVar[m] }} aria-hidden />
                {A_MODEL_NAME[m]}
              </h3>
              <ImportanceBars importance={d.importance[m]} names={d.features} color={modelVar[m]} />
            </div>
          ))}
        </div>
        <p className="m-0 max-w-[66ch] text-base leading-[1.55] text-ink-2">
          {top.map((t, i) => (
            <span key={t.m}>
              {i > 0 ? " " : ""}
              {A_MODEL_NAME[t.m]} paling bergantung pada{" "}
              <b className="font-extrabold text-ink">{t.name}</b> ({fmt.pct(t.share)}).
            </span>
          ))}{" "}
          Karena kategori ditentukan nilai polutan tertinggi, wajar bila PM2.5 yang paling sering
          menjadi penentu.
        </p>
      </CardBody>
    </Card>
  );
}

function TurningPoint({ d }: { d: Analysis }) {
  const features = Object.keys(d.pdp);
  const [f, setF] = useState(features.includes("pm_duakomalima") ? "pm_duakomalima" : features[0]!);
  const colors = useModelColors();
  const p = d.pdp[f]!;
  const cross = useMemo(() => {
    const i = p.prob.findIndex((v) => v >= 0.5);
    if (i < 0) return null;
    if (i === 0) return p.grid[0]!;
    const [x0, x1, y0, y1] = [p.grid[i - 1]!, p.grid[i]!, p.prob[i - 1]!, p.prob[i]!];
    return x0 + ((0.5 - y0) / (y1 - y0)) * (x1 - x0);
  }, [p]);
  const focus = kategoriMeta(d.focus).label;
  return (
    <Card aria-labelledby="h-pdp">
      <CardHeader
        id="h-pdp"
        title={`Titik balik ${d.features[f]}`}
        description={`Partial dependence: peluang hari ${focus} menurut Random Forest bila hanya ${d.features[f]} yang diubah, polutan lain dibiarkan seperti di data latih.`}
      />
      <CardBody>
        <SegmentedControl
          label="Polutan"
          value={f}
          onChange={setF}
          options={features.map((k) => ({ value: k, label: d.features[k] ?? k }))}
        />
        <LineChart
          lines={[
            {
              name: `Peluang ${focus}`,
              color: colors.random_forest,
              data: p.grid.map((x, i) => [x, p.prob[i]!] as [number, number]),
            },
          ]}
          xName={`Nilai indeks ${d.features[f]}`}
          yName="Peluang"
          xMin={p.grid[0]}
          xMax={p.grid.at(-1)}
          label={`Peluang hari ${focus} menurut ${d.features[f]}${cross === null ? ", tidak pernah melewati 50 persen" : `, melewati 50 persen di sekitar ${Math.round(cross)}`}`}
        />
        <p className="m-0 max-w-[66ch] text-base leading-[1.55] text-ink-2">
          {cross === null ? (
            <>
              Perubahan {d.features[f]} sendirian tidak pernah membuat peluang {focus} melewati 50%
              di rentang data ini.
            </>
          ) : (
            <>
              Peluang {focus} melewati <b className="font-extrabold text-ink">50%</b> di sekitar
              nilai <b className="font-extrabold text-ink">{Math.round(cross)}</b> pada{" "}
              {d.features[f]}.
            </>
          )}
        </p>
      </CardBody>
    </Card>
  );
}

export function PenjelasanView() {
  const q = useAnalysis();
  return (
    <>
      <PageHeader
        title="Kenapa mesin menebak begitu"
        description="Random Forest berisi banyak pohon keputusan, jadi tidak bisa dibaca langsung. Dua grafik ini membantu melihat apa yang sebenarnya diperhatikan model."
        meta={null}
      />
      <QueryView
        query={q}
        skeleton={
          <>
            <Skeleton className="h-72 w-full" />
            <ChartSkeleton height={300} />
          </>
        }
      >
        {(d) => (
          <>
            <Importance d={d} />
            <TurningPoint d={d} />
          </>
        )}
      </QueryView>
      <section aria-labelledby="h-istilah" className="flex flex-col gap-5">
        <h2 id="h-istilah" className="ua-section-title">
          Istilah yang dipakai
        </h2>
        {GLOSSARY.map((g) => (
          <div key={g.id} className="flex flex-col gap-1">
            <h3 id={`g-${g.id}`} className="m-0 mt-2 text-[17px] font-bold">
              {g.title}
            </h3>
            <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] gap-x-16">
              {g.terms.map(([term, def]) => (
                <div key={term} className="flex flex-col gap-1 border-b border-line-soft py-3.5">
                  <dt className="text-[15px] font-extrabold">{term}</dt>
                  <dd className="m-0 text-sm leading-[1.55] text-ink-2">{def}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </section>
    </>
  );
}
