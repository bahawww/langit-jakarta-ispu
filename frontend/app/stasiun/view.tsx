"use client";

import { useMemo } from "react";

import { ChartLegend, EChart, useChartColors } from "@/components/chart";
import { FilterBar } from "@/components/filter-bar";
import { IspuLegend } from "@/components/ispu";
import { PageHeader } from "@/components/page-header";
import { ChartSkeleton, QueryView } from "@/components/states";
import { Callout } from "@/components/ui/callout";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ScrollX } from "@/components/ui/scroll-x";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi, type StationStats } from "@/lib/api";
import { useFilters } from "@/lib/filters";
import { fmt } from "@/lib/format";
import { KATEGORI, KATEGORI_META, isUnhealthy } from "@/lib/kategori";
import { kritisLabel, shortStation } from "@/lib/labels";

function AvgBars({ data }: { data: StationStats[] }) {
  const c = useChartColors();
  const option = useMemo(
    () => ({
      grid: { left: 44, right: 16, top: 16, bottom: 40 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        valueFormatter: (v: number) => fmt.num(v),
      },
      xAxis: {
        type: "category",
        data: data.map((d) => shortStation(d.name)),
        axisLabel: { color: c.muted, fontSize: 11, interval: 0 },
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
          name: "Rata-rata PM2.5",
          type: "bar",
          barMaxWidth: 28,
          itemStyle: { color: c.accent, borderRadius: [6, 6, 0, 0] },
          data: data.map((d) => d.avg_pm_duakomalima),
        },
        {
          name: "Rata-rata PM10",
          type: "bar",
          barMaxWidth: 28,
          itemStyle: { color: c.series2, borderRadius: [6, 6, 0, 0] },
          data: data.map((d) => d.avg_pm_sepuluh),
        },
      ],
    }),
    [data, c],
  );
  return (
    <EChart option={option} label="Diagram batang rata-rata indeks PM2.5 dan PM10 per stasiun" />
  );
}

function ShareBars({ data }: { data: StationStats[] }) {
  const c = useChartColors();
  const present = KATEGORI.filter((k) => data.some((d) => d.by_kategori[k]));
  const option = useMemo(
    () => ({
      grid: { left: 96, right: 16, top: 8, bottom: 32 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        valueFormatter: (v: number) => fmt.pct(v / 100),
      },
      xAxis: {
        type: "value",
        max: 100,
        axisLabel: { color: c.muted, fontSize: 11, formatter: "{value}%" },
        splitLine: { lineStyle: { color: c.grid } },
      },
      yAxis: {
        type: "category",
        inverse: true,
        data: data.map((d) => shortStation(d.name)),
        axisLabel: { color: c.muted, fontSize: 11 },
        axisLine: { lineStyle: { color: c.axis } },
      },
      series: present.map((k) => ({
        name: KATEGORI_META[k].label,
        type: "bar",
        stack: "share",
        barMaxWidth: 28,
        itemStyle: { color: c.ispu[k], borderColor: c.surface, borderWidth: 1 },
        data: data.map((d) => ((d.by_kategori[k] ?? 0) / d.rows) * 100),
      })),
    }),
    [data, present, c],
  );
  return (
    <EChart option={option} label="Diagram batang bertumpuk persentase kategori per stasiun" />
  );
}

const unhealthyOf = (s: StationStats) =>
  Object.entries(s.by_kategori)
    .filter(([k]) => isUnhealthy(k))
    .reduce((a, [, n]) => a + n, 0);

export function StasiunView() {
  const { filters } = useFilters();
  const q = useApi<StationStats[]>("/stats/stations", filters);
  return (
    <>
      <PageHeader
        title="Perbandingan antar-stasiun"
        description="Rata-rata indeks, komposisi kategori, dan pencemar yang paling sering jadi penyebab utama di tiap stasiun."
      />
      <FilterBar />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card aria-labelledby="h-avg">
          <CardHeader
            id="h-avg"
            title="Rata-rata PM2.5 dan PM10"
            description="Indeks harian, dirata-rata selama periode terpilih."
            action={
              <ChartLegend
                items={[
                  { label: "PM2.5", color: "var(--accent)", kind: "dot" },
                  { label: "PM10", color: "var(--series-2)", kind: "dot" },
                ]}
              />
            }
          />
          <CardBody>
            <QueryView query={q} skeleton={<ChartSkeleton />} isEmpty={(d) => d.length === 0}>
              {(d) => <AvgBars data={d} />}
            </QueryView>
          </CardBody>
        </Card>
        <Card aria-labelledby="h-share">
          <CardHeader
            id="h-share"
            title="Komposisi kategori"
            description="Persentase hari per kategori (label sumber)."
            action={<IspuLegend />}
          />
          <CardBody>
            <QueryView query={q} skeleton={<ChartSkeleton />} isEmpty={(d) => d.length === 0}>
              {(d) => <ShareBars data={d} />}
            </QueryView>
          </CardBody>
        </Card>
      </div>

      <Card aria-labelledby="h-table">
        <CardHeader
          id="h-table"
          title="Ringkasan per stasiun"
          description="Nilai tertinggi di tiap kolom disorot."
        />
        <CardBody>
          <QueryView
            query={q}
            skeleton={<Skeleton className="h-48 w-full" />}
            isEmpty={(d) => d.length === 0}
          >
            {(d) => {
              const rows = d.map((s) => {
                const [top, n] = Object.entries(s.kritis)[0] ?? [];
                const total = Object.values(s.kritis).reduce((a, b) => a + b, 0);
                return { s, unhealthy: unhealthyOf(s), top, topShare: top ? (n ?? 0) / total : 0 };
              });
              const best = {
                p25: Math.max(...d.map((s) => s.avg_pm_duakomalima)),
                p10: Math.max(...d.map((s) => s.avg_pm_sepuluh)),
                bad: Math.max(...rows.map((r) => r.unhealthy)),
              };
              const worst = rows.reduce((a, r) => (r.unhealthy > a.unhealthy ? r : a), rows[0]!);
              return (
                <>
                  <ScrollX label="Tabel ringkasan per stasiun">
                    <table className="ua-table min-w-[680px]">
                      <caption className="sr-only">Statistik per stasiun</caption>
                      <thead>
                        <tr>
                          <th scope="col">Stasiun</th>
                          <th scope="col">Jumlah hari</th>
                          <th scope="col">Rata-rata PM2.5</th>
                          <th scope="col">Rata-rata PM10</th>
                          <th scope="col">Hari Tidak Sehat+</th>
                          <th scope="col" className="ua-left">
                            Penyebab utama
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(({ s, unhealthy, top, topShare }) => (
                          <tr key={s.code}>
                            <th scope="row">{s.name}</th>
                            <td>{fmt.int(s.rows)}</td>
                            <td>
                              {s.avg_pm_duakomalima === best.p25 ? (
                                <span className="ua-best">{fmt.num(s.avg_pm_duakomalima)}</span>
                              ) : (
                                fmt.num(s.avg_pm_duakomalima)
                              )}
                            </td>
                            <td>
                              {s.avg_pm_sepuluh === best.p10 ? (
                                <span className="ua-best">{fmt.num(s.avg_pm_sepuluh)}</span>
                              ) : (
                                fmt.num(s.avg_pm_sepuluh)
                              )}
                            </td>
                            <td>
                              {unhealthy === best.bad ? (
                                <span className="ua-best">
                                  {fmt.int(unhealthy)} ({fmt.pct(s.pct_tidak_sehat)})
                                </span>
                              ) : (
                                `${fmt.int(unhealthy)} (${fmt.pct(s.pct_tidak_sehat)})`
                              )}
                            </td>
                            <td className="ua-left">
                              {top ? `${kritisLabel(top)} (${fmt.pct(topShare)})` : "–"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollX>
                  <Callout>
                    {shortStation(worst.s.name)} punya hari Tidak Sehat atau lebih buruk terbanyak (
                    {fmt.int(worst.unhealthy)} hari, {fmt.pct(worst.s.pct_tidak_sehat)}).
                    {worst.top
                      ? ` Penyebab utamanya ${kritisLabel(worst.top)} (${fmt.pct(worst.topShare)} dari hari).`
                      : ""}
                  </Callout>
                </>
              );
            }}
          </QueryView>
        </CardBody>
      </Card>
    </>
  );
}
