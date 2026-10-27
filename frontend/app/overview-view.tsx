"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { ChartLegend, EChart, timeAxisLabel, useChartColors } from "@/components/chart";
import { FilterBar } from "@/components/filter-bar";
import { IspuBadge } from "@/components/ispu";
import { Skyline } from "@/components/illustrations";
import { ConfusionSection, FactorsSection, GeneralizationSection } from "@/app/overview-analysis";
import { MetricCard, MetricGrid } from "@/components/stat-card";
import { ChartSkeleton, ErrorState, QueryView } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import { ScrollX } from "@/components/ui/scroll-x";
import { SegmentedControl } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi, type OrangeBaseline, type OrangeRow } from "@/lib/api";
import { useFilters } from "@/lib/filters";
import { fmt } from "@/lib/format";
import { AMBANG, KATEGORI, KATEGORI_META, isUnhealthy } from "@/lib/kategori";
import { shortStation } from "@/lib/labels";
import { MODELS, isModelKey, type ModelKey } from "@/lib/models";

const PAGE_SIZE = 20;
const avg2 = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Point = { key: string; pm25: number; pm10: number };

/** Rata-rata PM2.5 / PM10 per hari atau per bulan; beberapa stasiun di tanggal yang sama dirata-rata. */
function aggregate(rows: OrangeRow[], by: "day" | "month"): Point[] {
  const acc = new Map<string, { s25: number; s10: number; n: number }>();
  for (const r of rows) {
    const key = by === "day" ? r.tanggal : `${r.tanggal.slice(0, 7)}-01`;
    const a = acc.get(key) ?? { s25: 0, s10: 0, n: 0 };
    a.s25 += r.pm_duakomalima;
    a.s10 += r.pm_sepuluh;
    a.n += 1;
    acc.set(key, a);
  }
  return [...acc.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, a]) => ({ key, pm25: a.s25 / a.n, pm10: a.s10 / a.n }));
}

function TimeSeries({ points, unit }: { points: Point[]; unit: string }) {
  const c = useChartColors();
  const option = useMemo(
    () => ({
      grid: { left: 44, right: 16, top: 16, bottom: 72 },
      tooltip: { trigger: "axis", valueFormatter: (v: number) => fmt.num(v) },
      xAxis: {
        type: "time",
        axisLabel: { color: c.muted, fontSize: 11, hideOverlap: true, formatter: timeAxisLabel },
        axisLine: { lineStyle: { color: c.axis } },
      },
      yAxis: {
        type: "value",
        name: "Indeks ISPU",
        nameTextStyle: { color: c.muted, fontSize: 11 },
        axisLabel: { color: c.muted, fontSize: 11 },
        splitLine: { lineStyle: { color: c.grid } },
      },
      dataZoom: [
        { type: "inside" },
        {
          type: "slider",
          bottom: 12,
          height: 24,
          borderColor: c.border,
          backgroundColor: c.sunken,
          fillerColor: `${c.accent}22`,
          handleStyle: { color: c.accent, borderColor: c.accent },
          dataBackground: { lineStyle: { color: c.axis }, areaStyle: { color: c.track } },
          textStyle: { color: c.muted },
        },
      ],
      series: [
        {
          name: "PM2.5",
          type: "line",
          showSymbol: points.length < 40,
          symbolSize: 6,
          lineStyle: { width: 2.5, color: c.accent, cap: "round", join: "round" },
          itemStyle: { color: c.accent },
          data: points.map((p) => [p.key, p.pm25]),
          markLine: {
            symbol: "none",
            silent: true,
            lineStyle: { type: "dashed", color: c.axis },
            label: {
              formatter: "{b}",
              color: c.muted,
              fontSize: 11,
              position: "insideStartTop",
              backgroundColor: c.surface,
              padding: [1, 4],
            },
            data: AMBANG.map((a) => ({ name: a.label, yAxis: a.value })),
          },
        },
        {
          name: "PM10",
          type: "line",
          showSymbol: points.length < 40,
          symbolSize: 6,
          lineStyle: { width: 1.5, color: c.series2, cap: "round", join: "round" },
          itemStyle: { color: c.series2 },
          data: points.map((p) => [p.key, p.pm10]),
        },
      ],
    }),
    [points, c],
  );
  return (
    <EChart
      option={option}
      height={360}
      label={`Grafik garis rata-rata PM2.5 dan PM10 ${unit} pada data uji, dengan garis batas Baik (50) dan Sedang (100)`}
    />
  );
}

type StationCounts = { code: string; name: string; counts: Record<string, number> };

function countByStation(rows: OrangeRow[], pred: (r: OrangeRow) => string): StationCounts[] {
  const by = new Map<string, StationCounts>();
  for (const r of rows) {
    const s = by.get(r.station_code) ?? {
      code: r.station_code,
      name: shortStation(r.station_name),
      counts: {},
    };
    const p = pred(r);
    s.counts[p] = (s.counts[p] ?? 0) + 1;
    by.set(r.station_code, s);
  }
  return [...by.values()].sort((a, b) => a.code.localeCompare(b.code));
}

function GroupedBars({ stations, modelLabel }: { stations: StationCounts[]; modelLabel: string }) {
  const c = useChartColors();
  const cats = KATEGORI.filter((k) => stations.some((s) => s.counts[k]));
  const option = useMemo(
    () => ({
      grid: { left: 44, right: 16, top: 24, bottom: 32 },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      xAxis: {
        type: "category",
        data: stations.map((s) => s.name),
        axisLabel: { color: c.muted, fontSize: 11, interval: 0 },
        axisLine: { lineStyle: { color: c.axis } },
      },
      yAxis: {
        type: "value",
        name: "Jumlah hari uji",
        nameTextStyle: { color: c.muted, fontSize: 11 },
        axisLabel: { color: c.muted, fontSize: 11 },
        splitLine: { lineStyle: { color: c.grid } },
      },
      series: cats.map((k) => ({
        name: KATEGORI_META[k].label,
        type: "bar",
        barMaxWidth: 28,
        itemStyle: { color: c.ispu[k], borderRadius: [4, 4, 0, 0] },
        label: {
          show: true,
          position: "top",
          color: c.muted,
          fontSize: 11,
          formatter: (p: { value: number }) => (p.value ? String(p.value) : ""),
        },
        data: stations.map((s) => s.counts[k] ?? 0),
      })),
    }),
    [stations, cats, c],
  );
  return (
    <>
      <ChartLegend
        items={cats.map((k) => ({ label: KATEGORI_META[k].label, color: c.ispu[k], kind: "dot" }))}
      />
      <EChart
        option={option}
        height={320}
        label={`Grafik batang terkelompok: jumlah hari uji per stasiun menurut kategori prediksi ${modelLabel}`}
      />
    </>
  );
}

const monthLabel = (key: string) => fmt.monthYear(key);

export function OverviewView() {
  const { filters, searchParams, setParam } = useFilters();
  const modelParam = searchParams.get("model");
  const model: ModelKey = isModelKey(modelParam) ? modelParam : "rf";
  const [grain, setGrain] = useState<"day" | "month">("day");
  const [status, setStatus] = useState<"all" | "wrong">("all");
  const [page, setPage] = useState(1);

  const summary = useApi<OrangeBaseline>("/baseline/orange", filters);
  const rowsQ = useApi<OrangeRow[]>("/baseline/orange/rows", filters);
  const rows = useMemo(() => rowsQ.data ?? [], [rowsQ.data]);
  const pred = MODELS[model].pred;

  const points = useMemo(() => aggregate(rows, grain), [rows, grain]);
  const peakMonths = useMemo(
    () =>
      aggregate(rows, "month")
        .sort((a, b) => b.pm25 - a.pm25)
        .slice(0, 3),
    [rows],
  );
  const stations = useMemo(() => countByStation(rows, pred), [rows, pred]);
  const worst = useMemo(
    () =>
      stations
        .map((s) => ({
          name: s.name,
          n: Object.entries(s.counts)
            .filter(([k]) => isUnhealthy(k))
            .reduce((a, [, v]) => a + v, 0),
        }))
        .filter((s) => s.n > 0)
        .sort((a, b) => b.n - a.n)
        .slice(0, 2),
    [stations],
  );

  const shown = useMemo(
    () => (status === "wrong" ? rows.filter((r) => pred(r) !== r.kategori) : rows),
    [rows, status, pred],
  );
  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const slice = shown.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const s = summary.data;
  const best = s?.models.length
    ? s.models.reduce((a, b) => (b.accuracy > a.accuracy ? b : a))
    : null;
  const empty = s ? s.rows === 0 : false;
  const dates = rows.map((r) => r.tanggal).sort();
  const meta: [string, string][] = [
    [
      "Periode data uji",
      dates.length ? `${fmt.monthYear(dates[0]!)} – ${fmt.monthYear(dates.at(-1)!)}` : "–",
    ],
    ["Stasiun", `${fmt.int(new Set(rows.map((r) => r.station_code)).size)} SPKU`],
    ["Data uji", `${fmt.int(s?.rows)} hari-stasiun`],
    ["Sumber", "Satu Data Jakarta"],
  ];

  return (
    <>
      <div className="flex flex-col gap-9">
        <header className="flex flex-col gap-5 pt-4">
          <h1 className="ua-display">Hasil pelatihan model</h1>
          <figure className="ua-skyline m-0 pt-2">
            <Skyline />
          </figure>
        </header>
        <section aria-label="Ringkasan hasil" className="flex flex-wrap gap-x-16 gap-y-7">
          <div className="min-w-0 flex-[999_1_560px]">
            {best && s && !empty ? (
              <p className="ua-lead">
                <b>{best.model}</b> menebak kategori dengan benar pada{" "}
                <b>
                  {fmt.int(best.correct)} dari {fmt.int(s.rows)} hari uji
                </b>{" "}
                ({fmt.pct(best.accuracy)}).{" "}
                {s.models
                  .filter((m) => m !== best)
                  .map((m) => `${m.model} ${fmt.int(m.correct)} hari (${fmt.pct(m.accuracy)})`)
                  .join(", ")}
                . Ketiganya model klasifikasi dasar yang diuji pada data yang dipisahkan dari data
                latih.
              </p>
            ) : (
              <p className="ua-lead">
                Hasil uji tiga model klasifikasi dasar (Decision Tree, Random Forest, dan kNN dengan
                k=5) pada data uji yang dipisahkan dari data latih.
              </p>
            )}
          </div>
          <dl className="m-0 grid flex-[1_1_260px] grid-cols-[auto_1fr] content-start gap-x-5 gap-y-2.5 text-sm">
            {meta.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="font-medium text-ink-3">{k}</dt>
                <dd className="m-0 font-bold">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
      <FilterBar showDates={false} showYear>
        <Field label="Model untuk grafik dan tabel" htmlFor="f-model" className="lg:w-56">
          <Select
            id="f-model"
            value={model}
            onChange={(e) => {
              setParam("model", e.target.value === "rf" ? undefined : e.target.value);
              setPage(1);
            }}
          >
            {Object.entries(MODELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </Select>
        </Field>
      </FilterBar>

      {summary.error ? (
        <ErrorState error={summary.error} onRetry={() => summary.refetch()} />
      ) : (
        <section aria-label="Metrik utama">
          <MetricGrid>
            <MetricCard
              label="Total sampel uji"
              help="Jumlah hari-stasiun pada data uji yang sesuai filter."
              loading={summary.isPending}
              value={`${fmt.int(s?.rows)} hari`}
              note="Satu sampel = satu stasiun pada satu hari"
            />
            <MetricCard
              label="Rata-rata PM2.5"
              help="Indeks harian partikel halus pada data uji. Di atas 50 berarti lewat batas Baik."
              loading={summary.isPending}
              value={s?.avg_pm_duakomalima == null ? "–" : avg2.format(s.avg_pm_duakomalima)}
            />
            <MetricCard
              label="Rata-rata PM10"
              help="Indeks harian partikel kasar pada data uji. Satuannya indeks, bukan µg/m³."
              loading={summary.isPending}
              value={s?.avg_pm_sepuluh == null ? "–" : avg2.format(s.avg_pm_sepuluh)}
            />
            <MetricCard
              label="Akurasi model terbaik"
              help="Porsi tebakan kategori yang tepat pada data uji."
              loading={summary.isPending}
              value={empty || !best ? "Tidak ada data" : fmt.pct(best.accuracy)}
              note={
                s && best && !empty
                  ? `${best.model}: ${fmt.int(best.correct)} dari ${fmt.int(s.rows)} tepat. ${s.models
                      .filter((m) => m !== best)
                      .map((m) => `${m.model} ${fmt.pct(m.accuracy)}`)
                      .join(", ")}`
                  : undefined
              }
            />
          </MetricGrid>
        </section>
      )}

      <Card aria-labelledby="h-waktu">
        <CardHeader
          id="h-waktu"
          title="PM2.5 dan PM10 sepanjang waktu"
          description="Rata-rata indeks pada data uji. Garis putus-putus menandai batas Baik (50) dan Sedang (100)."
          action={
            <SegmentedControl
              label="Rentang waktu"
              value={grain}
              onChange={setGrain}
              options={[
                { value: "day", label: "Harian" },
                { value: "month", label: "Bulanan" },
              ]}
            />
          }
        />
        <CardBody>
          <QueryView
            query={rowsQ}
            skeleton={<ChartSkeleton height={360} />}
            isEmpty={(d) => d.length === 0}
          >
            {() => (
              <>
                <ChartLegend
                  items={[
                    { label: "PM2.5", color: "var(--series-1)" },
                    { label: "PM10", color: "var(--series-2)" },
                  ]}
                />
                <TimeSeries points={points} unit={grain === "day" ? "harian" : "bulanan"} />
                <p className="m-0 text-sm text-ink-3">
                  Rata-rata PM2.5 bulanan tertinggi:{" "}
                  {peakMonths.map((p) => `${monthLabel(p.key)} (${fmt.num(p.pm25)})`).join(", ")}.
                </p>
              </>
            )}
          </QueryView>
        </CardBody>
      </Card>

      <Card aria-labelledby="h-stasiun">
        <CardHeader
          id="h-stasiun"
          title={`Kategori prediksi ${MODELS[model].label} per stasiun`}
          description="Jumlah hari uji menurut kategori yang ditebak model."
        />
        <CardBody>
          <QueryView
            query={rowsQ}
            skeleton={<ChartSkeleton height={320} />}
            isEmpty={(d) => d.length === 0}
          >
            {() => (
              <>
                <GroupedBars stations={stations} modelLabel={MODELS[model].label} />
                <p className="m-0 text-sm text-ink-3">
                  {worst.length
                    ? `Prediksi Tidak Sehat atau lebih buruk terbanyak: ${worst
                        .map((w) => `${w.name} (${fmt.int(w.n)} hari)`)
                        .join(", ")}.`
                    : "Model tidak memprediksi hari Tidak Sehat pada filter ini."}
                </p>
              </>
            )}
          </QueryView>
        </CardBody>
      </Card>

      <ConfusionSection summary={summary} model={model} />
      <FactorsSection />
      <GeneralizationSection />

      <Card aria-labelledby="h-tabel">
        <CardHeader
          id="h-tabel"
          title="Kategori aktual dan prediksi"
          description={`Perbandingan label sumber dengan tebakan ${MODELS[model].label} untuk tiap hari uji.`}
          action={
            <SegmentedControl
              label="Tampilkan baris"
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
              options={[
                { value: "all", label: "Semua" },
                { value: "wrong", label: "Hanya meleset" },
              ]}
            />
          }
        />
        <CardBody>
          <QueryView
            query={rowsQ}
            skeleton={<Skeleton className="h-96 w-full" />}
            isEmpty={() => shown.length === 0}
            empty={
              <p className="m-0 py-6 text-center text-sm text-ink-3">
                Tidak ada baris yang meleset pada filter ini.
              </p>
            }
          >
            {() => (
              <ScrollX label="Tabel kategori aktual dan prediksi">
                <table className="ua-table min-w-[760px]">
                  <caption className="sr-only">
                    Data uji dengan prediksi {MODELS[model].label}, halaman {current} dari {pages}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col" className="ua-left">
                        Tanggal
                      </th>
                      <th scope="col" className="ua-left">
                        Stasiun
                      </th>
                      <th scope="col">PM2.5</th>
                      <th scope="col" className="ua-left">
                        Kategori aktual
                      </th>
                      <th scope="col" className="ua-left">
                        Prediksi
                      </th>
                      <th scope="col" className="ua-left">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {slice.map((r) => {
                      const p = pred(r);
                      const ok = p === r.kategori;
                      return (
                        <tr key={`${r.tanggal}-${r.station_code}`}>
                          <td className="ua-left whitespace-nowrap">{fmt.date(r.tanggal)}</td>
                          <td className="ua-left">{r.station_name}</td>
                          <td>{r.pm_duakomalima}</td>
                          <td className="ua-left">
                            <IspuBadge value={r.kategori} />
                          </td>
                          <td className="ua-left">
                            <IspuBadge value={p} />
                          </td>
                          <td className="ua-left">
                            <span
                              className={`ua-badge ${ok ? "ua-badge--success" : "ua-badge--warning"}`}
                            >
                              {ok ? "Tepat (Benar)" : "Meleset (Salah)"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ScrollX>
            )}
          </QueryView>
          <nav aria-label="Paginasi" className="flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={current <= 1}
              onClick={() => setPage(current - 1)}
            >
              <ChevronLeft aria-hidden className="size-4" /> Sebelumnya
            </Button>
            <span className="order-first basis-full text-center text-sm font-semibold sm:order-none sm:basis-auto">
              Halaman {fmt.int(current)} dari {fmt.int(pages)} · {fmt.int(shown.length)} baris
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={current >= pages}
              onClick={() => setPage(current + 1)}
            >
              Berikutnya <ChevronRight aria-hidden className="size-4" />
            </Button>
          </nav>
        </CardBody>
      </Card>
    </>
  );
}
