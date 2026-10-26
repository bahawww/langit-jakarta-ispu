"use client";

import { FilterBar } from "@/components/filter-bar";
import { KategoriBadge } from "@/components/kategori-badge";
import { Kpi } from "@/components/kpi";
import { PageHeader } from "@/components/page-header";
import { QueryView } from "@/components/states";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useApi,
  type Measurement,
  type ModelVersion,
  type OrangeBaseline,
  type Summary,
} from "@/lib/api";
import { useFilters } from "@/lib/filters";
import { fmt } from "@/lib/format";
import { kategoriStyle, KATEGORI } from "@/lib/kategori";
import { kritisLabel } from "@/lib/labels";

const ORANGE_MODELS: Record<string, string> = {
  rf: "Random Forest",
  dt: "Decision Tree",
  knn: "kNN",
};

function ModelAccuracy({ model }: { model: string }) {
  const { filters } = useFilters();
  const champions = useApi<Record<string, ModelVersion | null>>("/models/champions");
  const orange = useApi<OrangeBaseline>("/baseline/orange", filters, model !== "champion");

  if (model === "champion") {
    const c = champions.data?.classification;
    const m = c?.metrics as
      { holdout: Record<string, { accuracy: number }>; n_holdout: number } | undefined;
    return (
      <Kpi
        label="Akurasi model aktif"
        loading={champions.isPending}
        value={c && m ? fmt.pct(m.holdout[c.algorithm]?.accuracy) : "Belum ada model"}
        hint={
          c && m
            ? `${c.algorithm.replace("_", " ")} v${c.version} · holdout ${fmt.int(m.n_holdout)} baris terakhir (tidak ikut filter)`
            : undefined
        }
      />
    );
  }
  const row = orange.data?.models.find((x) => x.model === ORANGE_MODELS[model]);
  return (
    <Kpi
      label={`Akurasi ${ORANGE_MODELS[model]} (Orange)`}
      loading={orange.isPending}
      value={orange.data?.rows ? fmt.pct(row?.accuracy) : "Tidak ada data uji"}
      hint={
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
  const latest = useApi<Measurement[]>("/stats/latest", { station: filters.station });
  const s = summary.data;

  return (
    <>
      <PageHeader
        title="Kualitas udara DKI Jakarta"
        description="Ringkasan Indeks Standar Pencemar Udara (ISPU) harian dari stasiun SPKU."
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

      {summary.error ? (
        <QueryView query={summary} skeleton={null}>
          {() => null}
        </QueryView>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 [&>*:nth-child(5)]:max-sm:col-span-2">
          <Kpi
            label="Jumlah data"
            loading={summary.isPending}
            value={fmt.int(s?.rows)}
            hint="baris harian per stasiun"
          />
          <Kpi
            label="Rata-rata PM2.5"
            loading={summary.isPending}
            value={fmt.num(s?.avg_pm_duakomalima)}
            hint="indeks ISPU"
          />
          <Kpi
            label="Rata-rata PM10"
            loading={summary.isPending}
            value={fmt.num(s?.avg_pm_sepuluh)}
            hint="indeks ISPU"
          />
          <Kpi
            label="Hari TIDAK SEHAT atau lebih buruk"
            loading={summary.isPending}
            value={fmt.pct(s?.pct_tidak_sehat)}
            hint={s ? `${fmt.int(s.label_inconsistent)} baris berlabel tidak konsisten` : undefined}
          />
          <ModelAccuracy model={model} />
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2" aria-labelledby="h-terkini">
          <CardHeader
            id="h-terkini"
            title="Kondisi terkini per stasiun"
            description="Pengukuran terakhir yang tersedia di database untuk tiap stasiun."
          />
          <CardBody>
            <QueryView
              query={latest}
              skeleton={<Skeleton className="h-48 w-full" />}
              isEmpty={(d) => d.length === 0}
            >
              {(rows) => (
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {rows.map((r) => (
                    <li key={r.station_code} className="rounded-md border border-border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{r.station_name}</p>
                        <KategoriBadge value={r.kategori} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{fmt.date(r.tanggal)}</p>
                      <p className="mt-2 text-sm">
                        Indeks maks <strong>{fmt.int(r.max)}</strong>
                        {r.parameter_pencemar_kritis
                          ? ` · kritis ${kritisLabel(r.parameter_pencemar_kritis)}`
                          : ""}
                      </p>
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
            title="Distribusi kategori"
            description="Jumlah hari per kategori (label sumber)."
          />
          <CardBody>
            <QueryView
              query={summary}
              skeleton={<Skeleton className="h-48 w-full" />}
              isEmpty={(d) => d.rows === 0}
            >
              {(d) => (
                <ul className="space-y-3">
                  {KATEGORI.filter((k) => d.by_kategori[k]).map((k) => {
                    const n = d.by_kategori[k] ?? 0;
                    return (
                      <li key={k}>
                        <div className="mb-1 flex justify-between text-sm">
                          <span>{kategoriStyle(k).label}</span>
                          <span>
                            {fmt.int(n)} ({fmt.pct(n / d.rows)})
                          </span>
                        </div>
                        <div className="h-2 rounded bg-muted" aria-hidden>
                          <div
                            className="h-2 rounded"
                            style={{
                              width: `${(n / d.rows) * 100}%`,
                              background: kategoriStyle(k).bg,
                            }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </QueryView>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
