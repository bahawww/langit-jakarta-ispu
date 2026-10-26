"use client";

import { useMemo } from "react";

import { ChartLegend, EChart, timeAxisLabel, useChartColors } from "@/components/chart";
import { IspuBadge } from "@/components/ispu";
import { PageHeader } from "@/components/page-header";
import { ChartSkeleton, EmptyState, QueryView } from "@/components/states";
import { Callout } from "@/components/ui/callout";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import { ScrollX } from "@/components/ui/scroll-x";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi, type DailyPoint, type ForecastDay, type ForecastOut, type Meta } from "@/lib/api";
import { useFilters } from "@/lib/filters";
import { fmt } from "@/lib/format";
import { AMBANG } from "@/lib/kategori";
import { modelLabel, shortStation } from "@/lib/labels";

function Alerts({
  items,
  pollutantLabel,
}: {
  items: ForecastDay[];
  pollutantLabel: (key: string) => string;
}) {
  const sure = items.filter((i) => i.alert);
  const maybe = items.filter((i) => !i.alert && i.alert_possible);
  if (!sure.length && !maybe.length) {
    return (
      <Callout label="Ringkasan:">
        tidak ada stasiun yang diprediksi Tidak Sehat dalam 7 hari ke depan, termasuk pada batas
        atas interval.
      </Callout>
    );
  }
  return (
    <section aria-labelledby="h-peringatan" className="ua-card">
      <div>
        <h2 id="h-peringatan" className="ua-card__title">
          Peringatan kualitas udara
        </h2>
        <p className="ua-card__sub">
          Hari dan stasiun yang perlu diperhatikan dalam 7 hari ke depan.
        </p>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 p-0" role="alert">
        {sure.map((i) => (
          <li
            key={`${i.station_code}-${i.target_date}`}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
          >
            <IspuBadge value={i.kategori} />
            <span>
              <strong>{shortStation(i.station_name)}</strong>, {fmt.dayShort(i.target_date)}: indeks
              diperkirakan {fmt.idx(i.max_yhat)}, penyebab {pollutantLabel(i.critical)}.
            </span>
          </li>
        ))}
        {maybe.map((i) => (
          <li
            key={`${i.station_code}-${i.target_date}-m`}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
          >
            <span className="ua-badge ua-badge--warning">Mungkin</span>
            <span>
              <strong>{shortStation(i.station_name)}</strong>, {fmt.dayShort(i.target_date)}:
              perkiraan {i.kategori}, tetapi batas atas interval mencapai {i.kategori_upper}.
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Grid({ items }: { items: ForecastDay[] }) {
  const stations = [...new Map(items.map((i) => [i.station_code, i.station_name])).entries()];
  const dates = [...new Set(items.map((i) => i.target_date))].sort();
  const at = new Map(items.map((i) => [`${i.station_code}|${i.target_date}`, i]));
  return (
    <ScrollX label="Tabel kategori prediksi per stasiun per hari">
      <table className="ua-table min-w-[760px]">
        <caption className="sr-only">Kategori prediksi per stasiun per hari</caption>
        <thead>
          <tr>
            <th scope="col">Stasiun</th>
            {dates.map((d, i) => (
              <th scope="col" key={d} className="ua-left">
                H+{i + 1}
                <span className="block text-xs font-medium">{fmt.dayShort(d)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stations.map(([code, name]) => (
            <tr key={code}>
              <th scope="row">{shortStation(name)}</th>
              {dates.map((d) => {
                const i = at.get(`${code}|${d}`);
                return (
                  <td key={d} className="ua-left align-top">
                    {i ? (
                      <div className="flex flex-col items-start gap-1">
                        <IspuBadge value={i.kategori} />
                        <span className="text-xs text-ink-3">indeks {fmt.idx(i.max_yhat)}</span>
                      </div>
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
      grid: { left: 44, right: 16, top: 16, bottom: 40 },
      tooltip: {
        trigger: "axis",
        valueFormatter: (v: number) => fmt.idx(v),
      },
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
      series: [
        {
          name: "Aktual (30 hari terakhir)",
          type: "line",
          showSymbol: false,
          lineStyle: { width: 2.5, color: c.accent, cap: "round", join: "round" },
          itemStyle: { color: c.accent },
          data: history.map((d) => [d.tanggal, d.avg]),
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
          areaStyle: { color: `${c.series2}33` },
          itemStyle: { color: c.series2 },
          tooltip: { show: false },
          data: f.map((p) => [p.t, p.hi - p.lo]),
        },
        {
          name: "Prediksi",
          type: "line",
          symbolSize: 7,
          lineStyle: { width: 2.5, type: "dashed", color: c.series2, cap: "round" },
          itemStyle: { color: c.series2 },
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
    { key: "max", label: "Indeks tertinggi (6 polutan)" },
  ];
  const label = options.find((o) => o.key === pollutant)?.label ?? pollutant;
  const pollutantLabel = (key: string) =>
    meta.data?.pollutants.find((p) => p.key === key)?.label ?? key;
  const d = fc.data;
  const chips = d?.items.length
    ? [
        { k: "Model", v: `${modelLabel("lightgbm")} v${d.model_version}` },
        { k: "Dihitung dari", v: fmt.date(d.items[0]?.origin_date) },
        { k: "Rentang", v: `H+1 – H+${new Set(d.items.map((i) => i.horizon)).size}` },
        { k: "Interval", v: d.interval ? `${d.interval[0]! * 100}–${d.interval[1]! * 100}%` : "–" },
      ]
    : [];

  return (
    <>
      <PageHeader
        title="Prediksi 7 hari"
        description="Perkiraan indeks polutan tiap stasiun beserta kategori ISPU turunannya, dari model forecast yang aktif."
        meta={chips}
      />
      <QueryView
        query={fc}
        skeleton={<Skeleton className="h-24 w-full" />}
        isEmpty={(x) => x.items.length === 0}
        empty={
          <EmptyState title="Belum ada forecast">
            Model forecast belum dilatih. Jalankan training dari halaman admin.
          </EmptyState>
        }
      >
        {(x) => (
          <>
            <Callout label="Catatan:">
              prediksi dihitung dari <strong>tanggal data terakhir</strong> tiap stasiun (
              {fmt.date(x.items[0]?.origin_date)}), bukan dari hari ini. Dibuat{" "}
              {fmt.dateTime(x.generated_at)}.
            </Callout>
            <Alerts items={x.items} pollutantLabel={pollutantLabel} />
            <Card aria-labelledby="h-grid">
              <CardHeader
                id="h-grid"
                title="Kategori prediksi per stasiun"
                description="Kategori diambil dari indeks tertinggi di antara 6 polutan yang diprediksi."
              />
              <CardBody>
                <Grid items={x.items} />
              </CardBody>
            </Card>
          </>
        )}
      </QueryView>

      <Card aria-labelledby="h-detail">
        <CardHeader
          id="h-detail"
          title={`Detail ${label}`}
          description="Pita oranye = rentang 10–90% dari selisih prediksi dan kenyataan di data uji; makin jauh harinya, makin lebar."
          action={
            <ChartLegend
              items={[
                { label: "Aktual 30 hari terakhir", color: "var(--accent)" },
                { label: "Prediksi", color: "var(--series-2)", kind: "dash" },
                { label: "Interval 10–90%", color: "var(--series-2)", kind: "dot" },
              ]}
            />
          }
        />
        <CardBody>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex">
            <Field label="Stasiun" htmlFor="p-station" className="lg:w-72">
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
