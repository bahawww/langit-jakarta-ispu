"use client";

import { AlertTriangle, Info } from "lucide-react";
import { useMemo } from "react";

import { EChart, timeAxisLabel, useChartColors } from "@/components/chart";
import { KategoriBadge } from "@/components/kategori-badge";
import { PageHeader } from "@/components/page-header";
import { ChartSkeleton, EmptyState, QueryView } from "@/components/states";
import { ScrollX } from "@/components/ui/scroll-x";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi, type DailyPoint, type ForecastDay, type ForecastOut, type Meta } from "@/lib/api";
import { useFilters } from "@/lib/filters";
import { fmt } from "@/lib/format";
import { AMBANG } from "@/lib/kategori";
import { kritisLabel, shortStation } from "@/lib/labels";

const KRITIS_KEY: Record<string, string> = {
  pm_duakomalima: "PM25",
  pm_sepuluh: "PM10",
  sulfur_dioksida: "SO2",
  karbon_monoksida: "CO",
  ozon: "O3",
  nitrogen_dioksida: "NO2",
};

function Alerts({ items }: { items: ForecastDay[] }) {
  const sure = items.filter((i) => i.alert);
  const maybe = items.filter((i) => !i.alert && i.alert_possible);
  if (!sure.length && !maybe.length) {
    return (
      <div className="mb-5 flex items-start gap-2 rounded-md border border-border bg-card p-3 text-sm">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
        Tidak ada stasiun yang diprediksi TIDAK SEHAT dalam 7 hari forecast, termasuk pada batas
        atas interval.
      </div>
    );
  }
  return (
    <div
      role="alert"
      className="mb-5 rounded-md border border-border bg-warning-bg p-3 text-sm text-warning-fg"
    >
      <p className="flex items-center gap-2 font-semibold">
        <AlertTriangle aria-hidden className="size-4" /> Peringatan kualitas udara
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {sure.map((i) => (
          <li key={`${i.station_code}-${i.target_date}`}>
            {shortStation(i.station_name)}, {fmt.dayShort(i.target_date)}: diprediksi{" "}
            <strong>{i.kategori}</strong> (indeks {fmt.idx(i.max_yhat)}, kritis{" "}
            {kritisLabel(KRITIS_KEY[i.critical] ?? i.critical)})
          </li>
        ))}
        {maybe.map((i) => (
          <li key={`${i.station_code}-${i.target_date}-m`}>
            {shortStation(i.station_name)}, {fmt.dayShort(i.target_date)}: perkiraan {i.kategori},
            tetapi batas atas interval mencapai <strong>{i.kategori_upper}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Grid({ items }: { items: ForecastDay[] }) {
  const stations = [...new Map(items.map((i) => [i.station_code, i.station_name])).entries()];
  const dates = [...new Set(items.map((i) => i.target_date))].sort();
  const at = new Map(items.map((i) => [`${i.station_code}|${i.target_date}`, i]));
  return (
    <ScrollX label="Kategori prediksi per stasiun per hari">
      <table className="w-full min-w-[720px] text-sm">
        <caption className="sr-only">Kategori prediksi per stasiun per hari</caption>
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th scope="col" className="py-2 pr-3 font-medium">
              Stasiun
            </th>
            {dates.map((d, i) => (
              <th scope="col" key={d} className="py-2 pr-2 font-medium">
                H+{i + 1}
                <span className="block font-normal">{fmt.dayShort(d)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stations.map(([code, name]) => (
            <tr key={code} className="border-b border-border last:border-0">
              <th scope="row" className="py-2 pr-3 text-left font-medium">
                {shortStation(name)}
              </th>
              {dates.map((d) => {
                const i = at.get(`${code}|${d}`);
                return (
                  <td key={d} className="py-2 pr-2 align-top">
                    {i ? (
                      <>
                        <KategoriBadge value={i.kategori} />
                        <span className="mt-1 block text-xs text-muted-foreground">
                          maks {fmt.idx(i.max_yhat)}
                        </span>
                      </>
                    ) : (
                      "–"
                    )}
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

function StationChart({
  items,
  history,
  pollutant,
  label,
}: {
  items: ForecastDay[];
  history: DailyPoint[];
  pollutant: string;
  label: string;
}) {
  const c = useChartColors();
  const option = useMemo(() => {
    const pick = (i: ForecastDay) =>
      pollutant === "max"
        ? {
            yhat: i.max_yhat,
            lo: Math.max(...Object.values(i.values).map((v) => v.lo)),
            hi: Math.max(...Object.values(i.values).map((v) => v.hi)),
          }
        : i.values[pollutant]!;
    // Titik origin (nilai aktual terakhir) menyambung garis aktual dengan garis prediksi.
    const last = history.at(-1);
    const f = [
      ...(last ? [{ t: last.tanggal, yhat: last.avg, lo: last.avg, hi: last.avg }] : []),
      ...items.map((i) => ({ t: i.target_date, ...pick(i) })),
    ];
    return {
      grid: { left: 44, right: 16, top: 64, bottom: 40 },
      legend: {
        top: 0,
        textStyle: { color: c.text },
        data: ["Aktual (30 hari terakhir)", "Prediksi", "Interval 10–90%"],
      },
      tooltip: { trigger: "axis", valueFormatter: (v: number) => fmt.idx(v) },
      xAxis: {
        type: "time",
        axisLabel: { color: c.muted, hideOverlap: true, formatter: timeAxisLabel },
      },
      yAxis: {
        type: "value",
        name: "Indeks ISPU",
        nameTextStyle: { color: c.muted },
        axisLabel: { color: c.muted },
        splitLine: { lineStyle: { color: c.grid } },
      },
      series: [
        {
          name: "Aktual (30 hari terakhir)",
          type: "line",
          showSymbol: false,
          data: history.map((d) => [d.tanggal, d.avg]),
          markLine: {
            symbol: "none",
            silent: true,
            lineStyle: { type: "dashed", color: c.muted },
            label: {
              formatter: "{b}",
              color: c.muted,
              position: "insideStartTop",
              backgroundColor: c.tooltipBg,
              padding: [1, 4],
            },
            data: AMBANG.map((a) => ({ name: a.label, yAxis: a.value })),
          },
        },
        // Pita interval: garis bawah tak terlihat + selisih (hi - lo) ditumpuk di atasnya.
        {
          name: "lo",
          type: "line",
          stack: "band",
          symbol: "none",
          lineStyle: { opacity: 0 },
          tooltip: { show: false },
          data: f.map((p) => [p.t, p.lo]),
        },
        {
          name: "Interval 10–90%",
          type: "line",
          stack: "band",
          symbol: "none",
          lineStyle: { opacity: 0 },
          areaStyle: { color: c.series[1], opacity: 0.25 },
          itemStyle: { color: c.series[1] },
          tooltip: { show: false },
          data: f.map((p) => [p.t, p.hi - p.lo]),
        },
        {
          name: "Prediksi",
          type: "line",
          symbolSize: 6,
          lineStyle: { type: "dashed" },
          itemStyle: { color: c.series[1] },
          data: f.map((p) => [p.t, p.yhat]),
        },
      ],
    };
  }, [items, history, pollutant, c]);
  return (
    <EChart
      option={option}
      label={`Grafik aktual 30 hari terakhir dan prediksi 7 hari ${label} dengan interval 10 sampai 90 persen`}
    />
  );
}

export function PrediksiView() {
  const { filters, setParam, searchParams } = useFilters();
  const meta = useApi<Meta>("/meta");
  const fc = useApi<ForecastOut>("/forecast");
  const station = filters.station ?? meta.data?.stations[0]?.code;
  const pollutant = searchParams.get("pollutant") ?? "pm_duakomalima";
  const stationItems = (fc.data?.items ?? []).filter((i) => i.station_code === station);
  const origin = stationItems[0]?.origin_date;
  const start = origin
    ? new Date(Date.parse(`${origin}T00:00:00Z`) - 29 * 86_400_000).toISOString().slice(0, 10)
    : undefined;
  const history = useApi<DailyPoint[]>(
    "/stats/daily",
    { station, start, end: origin, pollutant },
    Boolean(origin),
  );
  const options = [
    ...(meta.data?.pollutants ?? []),
    { key: "max", label: "Indeks maks (6 polutan)" },
  ];
  const label = options.find((o) => o.key === pollutant)?.label ?? pollutant;

  return (
    <>
      <PageHeader
        title="Prediksi 7 hari"
        description="Forecast indeks polutan per stasiun beserta kategori ISPU turunannya."
      />
      <QueryView
        query={fc}
        skeleton={<Skeleton className="mb-5 h-16 w-full" />}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState title="Belum ada forecast">
            Model forecast belum dilatih. Jalankan training di halaman admin.
          </EmptyState>
        }
      >
        {(d) => (
          <>
            <p className="mb-3 rounded-md border border-border bg-muted p-3 text-sm">
              Prediksi dihitung dari <strong>tanggal data terakhir</strong> tiap stasiun (
              {fmt.date(d.items[0]?.origin_date)}), bukan dari hari ini. Model forecast v
              {d.model_version} · dibuat {fmt.dateTime(d.generated_at)} · interval{" "}
              {d.interval ? `${d.interval[0]! * 100}–${d.interval[1]! * 100}%` : "–"}.
            </p>
            <Alerts items={d.items} />
            <Card aria-labelledby="h-grid" className="mb-5">
              <CardHeader
                id="h-grid"
                title="Kategori prediksi per stasiun"
                description="Kategori dari indeks tertinggi di antara 6 polutan yang diprediksi."
              />
              <CardBody>
                <Grid items={d.items} />
              </CardBody>
            </Card>
          </>
        )}
      </QueryView>

      <Card aria-labelledby="h-detail">
        <CardHeader
          id="h-detail"
          title={`Detail ${label}`}
          description="Garis putus-putus oranye = prediksi; pita = interval 10–90% dari residual holdout."
        />
        <CardBody>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex">
            <Field label="Stasiun" htmlFor="p-station" className="lg:w-64">
              <Select
                id="p-station"
                value={station ?? ""}
                onChange={(e) => setParam("station", e.target.value)}
              >
                {meta.data?.stations.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Polutan" htmlFor="p-pollutant" className="lg:w-56">
              <Select
                id="p-pollutant"
                value={pollutant}
                onChange={(e) => setParam("pollutant", e.target.value)}
              >
                {options.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {fc.isPending ? (
            <ChartSkeleton />
          ) : stationItems.length === 0 ? (
            <EmptyState title="Tidak ada forecast untuk stasiun ini" />
          ) : history.isPending ? (
            <ChartSkeleton />
          ) : (
            <StationChart
              items={stationItems}
              history={history.data ?? []}
              pollutant={pollutant}
              label={label}
            />
          )}
        </CardBody>
      </Card>
    </>
  );
}
