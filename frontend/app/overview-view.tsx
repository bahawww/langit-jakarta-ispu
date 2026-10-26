"use client";

import { ConclusionCard, type Insight } from "@/components/conclusion-card";
import { FilterBar } from "@/components/filter-bar";
import { DistributionBar, IspuBadge, IspuScaleCard } from "@/components/ispu";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/stat-card";
import { ErrorState, QueryView } from "@/components/states";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useApi,
  type ForecastOut,
  type Measurement,
  type ModelVersion,
  type OrangeBaseline,
  type StationStats,
  type Summary,
} from "@/lib/api";
import { useFilters } from "@/lib/filters";
import { fmt } from "@/lib/format";
import { isUnhealthy } from "@/lib/kategori";
import { kritisLabel, modelLabel, shortStation } from "@/lib/labels";

const ORANGE_MODELS: Record<string, string> = {
  rf: "Random Forest",
  dt: "Decision Tree",
  knn: "kNN",
};

const unhealthyCount = (by: Record<string, number>) =>
  Object.entries(by)
    .filter(([k]) => isUnhealthy(k))
    .reduce((a, [, n]) => a + n, 0);

/** Pencemar yang paling sering menjadi penyebab utama kategori harian, dari data stasiun terfilter. */
function topCritical(stations: StationStats[]) {
  const total: Record<string, number> = {};
  for (const s of stations)
    for (const [k, n] of Object.entries(s.kritis)) total[k] = (total[k] ?? 0) + n;
  const sorted = Object.entries(total).sort((a, b) => b[1] - a[1]);
  const sum = sorted.reduce((a, [, n]) => a + n, 0);
  const top = sorted[0];
  return top && sum ? { code: top[0], share: top[1] / sum } : null;
}

function forecastInsight(f: ForecastOut): Insight {
  if (!f.items.length) {
    return {
      big: "Belum ada",
      text: "forecast untuk 7 hari ke depan. Model forecast belum dilatih.",
    };
  }
  const alerted = new Set(f.items.filter((i) => i.alert).map((i) => i.station_code));
  const dates = f.items.map((i) => i.target_date).sort();
  const span = `${fmt.date(dates[0])} – ${fmt.date(dates.at(-1))}`;
  return alerted.size === 0
    ? {
        big: "Tidak ada",
        text: `stasiun diprediksi Tidak Sehat pada ${span}. Prediksi dihitung dari data terakhir.`,
      }
    : {
        big: `${alerted.size} stasiun`,
        text: `diprediksi Tidak Sehat pada ${span}. Rinciannya ada di halaman Prediksi.`,
      };
}

function ModelAccuracy({ model }: { model: string }) {
  const { filters } = useFilters();
  const champions = useApi<Record<string, ModelVersion | null>>("/models/champions");
  const orange = useApi<OrangeBaseline>("/baseline/orange", filters, model !== "champion");
  const help = "Porsi tebakan kategori yang tepat pada hari uji.";

  if (model === "champion") {
    const c = champions.data?.classification;
    const m = c?.metrics as
      { holdout: Record<string, { accuracy: number }>; n_holdout: number } | undefined;
    return (
      <MetricCard
        label="Ketepatan model aktif"
        help={help}
        loading={champions.isPending}
        value={c && m ? fmt.pct(m.holdout[c.algorithm]?.accuracy) : "Belum ada"}
        note={
          c && m
            ? `${modelLabel(c.algorithm)} v${c.version} · ${fmt.int(m.n_holdout)} hari uji terakhir (tidak ikut filter)`
            : undefined
        }
      />
    );
  }
  const row = orange.data?.models.find((x) => x.model === ORANGE_MODELS[model]);
  return (
    <MetricCard
      label={`Ketepatan ${ORANGE_MODELS[model]} (Orange)`}
      help={help}
      loading={orange.isPending}
      value={orange.data?.rows ? fmt.pct(row?.accuracy) : "Tidak ada data uji"}
      note={
        orange.data
          ? `${fmt.int(row?.correct)} dari ${fmt.int(orange.data.rows)} data uji`
          : undefined
      }
    />
  );
}

export function OverviewView() {
  const { filters, searchParams, setParam } = useFilters();
  const model = searchParams.get("model") ?? "champion";
  const summary = useApi<Summary>("/stats/summary", filters);
  const stations = useApi<StationStats[]>("/stats/stations", filters);
  const latest = useApi<Measurement[]>("/stats/latest", { station: filters.station });
  const forecast = useApi<ForecastOut>("/forecast", { station: filters.station });
  const champions = useApi<Record<string, ModelVersion | null>>("/models/champions");
  const s = summary.data;

  const unhealthy = s ? unhealthyCount(s.by_kategori) : 0;
  const critical = stations.data ? topCritical(stations.data) : null;
  const insights: Insight[] | null =
    s && stations.data && forecast.data
      ? [
          {
            big: fmt.pct(s.pct_tidak_sehat),
            text: `hari berkategori Tidak Sehat atau lebih buruk (${fmt.int(unhealthy)} dari ${fmt.int(s.rows)} hari-stasiun).`,
          },
          critical
            ? {
                big: kritisLabel(critical.code),
                text: `pencemar yang paling sering menjadi penyebab utama kategori harian (${fmt.pct(critical.share)} dari hari).`,
              }
            : { big: "–", text: "belum ada data pencemar kritis untuk filter ini." },
          forecastInsight(forecast.data),
        ]
      : null;
  const fc = champions.data?.forecast;

  return (
    <>
      <PageHeader
        title="Ringkasan kualitas udara"
        description="Kondisi harian dari stasiun pemantau, dan prediksi 7 hari ke depan dari model machine learning."
      />
      <FilterBar>
        <Field label="Model" htmlFor="f-model" className="lg:w-56">
          <Select
            id="f-model"
            value={model}
            onChange={(e) =>
              setParam("model", e.target.value === "champion" ? undefined : e.target.value)
            }
          >
            <option value="champion">Model aktif (champion)</option>
            {Object.entries(ORANGE_MODELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v} (baseline Orange)
              </option>
            ))}
          </Select>
        </Field>
      </FilterBar>

      <div className="flex flex-wrap gap-4">
        <div className="min-w-0 flex-[999_1_520px] [&>*]:h-full">
          <ConclusionCard
            insights={insights}
            chip={fc ? `Model forecast: ${modelLabel(fc.algorithm)} v${fc.version}` : undefined}
          />
        </div>
        <div className="min-w-0 flex-[1_1_320px] [&>*]:h-full">
          <IspuScaleCard />
        </div>
      </div>

      {summary.error ? (
        <ErrorState error={summary.error} onRetry={() => summary.refetch()} />
      ) : (
        <section
          aria-label="Metrik utama"
          className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-4"
        >
          <MetricCard
            label="Rata-rata PM2.5"
            help="Indeks harian partikel halus. Di atas 50 berarti lewat batas Baik."
            loading={summary.isPending}
            value={fmt.num(s?.avg_pm_duakomalima)}
          />
          <MetricCard
            label="Rata-rata PM10"
            help="Indeks harian partikel kasar. Satuannya indeks, bukan µg/m³."
            loading={summary.isPending}
            value={fmt.num(s?.avg_pm_sepuluh)}
          />
          <MetricCard
            label="Hari Tidak Sehat atau lebih buruk"
            help="Hari-stasiun dengan indeks di atas 100."
            loading={summary.isPending}
            value={fmt.int(unhealthy)}
            note={
              s
                ? `${fmt.pct(s.pct_tidak_sehat)} dari semua hari · ${fmt.int(s.label_inconsistent)} baris berlabel tidak konsisten`
                : undefined
            }
          />
          <ModelAccuracy model={model} />
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr] lg:items-start">
        <Card aria-labelledby="h-terkini">
          <CardHeader
            id="h-terkini"
            title="Kondisi terkini per stasiun"
            description="Pengukuran terakhir yang tersedia di database untuk tiap stasiun."
          />
          <CardBody>
            <QueryView
              query={latest}
              skeleton={<Skeleton className="h-40 w-full" />}
              isEmpty={(d) => d.length === 0}
            >
              {(rows) => (
                <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-3 p-0">
                  {rows.map((r) => (
                    <li
                      key={r.station_code}
                      className="flex flex-col gap-3 rounded-md border border-line p-3.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="m-0 text-sm font-bold">{shortStation(r.station_name)}</p>
                          <p className="m-0 text-xs text-ink-3">
                            {r.station_code} · {fmt.date(r.tanggal)}
                          </p>
                        </div>
                        <IspuBadge value={r.kategori} />
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="ua-t-display" style={{ fontSize: 32, lineHeight: "36px" }}>
                          {fmt.int(r.max)}
                        </span>
                        <span className="flex flex-col text-[13px] leading-5 text-ink-3">
                          <span>indeks tertinggi</span>
                          {r.parameter_pencemar_kritis ? (
                            <span>penyebab {kritisLabel(r.parameter_pencemar_kritis)}</span>
                          ) : null}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </QueryView>
          </CardBody>
        </Card>

        <Card aria-labelledby="h-distribusi">
          <CardHeader
            id="h-distribusi"
            title="Komposisi kategori"
            description="Jumlah hari per kategori (label sumber)."
          />
          <CardBody>
            <QueryView
              query={summary}
              skeleton={<Skeleton className="h-24 w-full" />}
              isEmpty={(d) => d.rows === 0}
            >
              {(d) => <DistributionBar counts={d.by_kategori} />}
            </QueryView>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
