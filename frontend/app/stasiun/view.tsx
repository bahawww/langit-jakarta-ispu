"use client";

import { useMemo } from "react";

import { EChart, useChartColors } from "@/components/chart";
import { FilterBar } from "@/components/filter-bar";
import { PageHeader } from "@/components/page-header";
import { ChartSkeleton, QueryView } from "@/components/states";
import { ScrollX } from "@/components/ui/scroll-x";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi, type StationStats } from "@/lib/api";
import { useFilters } from "@/lib/filters";
import { fmt } from "@/lib/format";
import { KATEGORI, KATEGORI_STYLE } from "@/lib/kategori";
import { kritisLabel, shortStation } from "@/lib/labels";

function AvgBars({ data }: { data: StationStats[] }) {
  const c = useChartColors();
  const option = useMemo(
    () => ({
      grid: { left: 44, right: 16, top: 60, bottom: 40 },
      legend: { top: 0, textStyle: { color: c.text } },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        valueFormatter: (v: number) => fmt.num(v),
      },
      xAxis: {
        type: "category",
        data: data.map((d) => shortStation(d.name)),
        axisLabel: { color: c.muted, interval: 0 },
      },
      yAxis: {
        type: "value",
        name: "Indeks ISPU",
        nameTextStyle: { color: c.muted },
        axisLabel: { color: c.muted },
        splitLine: { lineStyle: { color: c.grid } },
      },
      series: [
        { name: "Rata-rata PM2.5", type: "bar", data: data.map((d) => d.avg_pm_duakomalima) },
        { name: "Rata-rata PM10", type: "bar", data: data.map((d) => d.avg_pm_sepuluh) },
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
      grid: { left: 96, right: 16, top: 60, bottom: 32 },
      legend: { top: 0, textStyle: { color: c.text } },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        valueFormatter: (v: number) => fmt.pct(v / 100),
      },
      xAxis: {
        type: "value",
        max: 100,
        axisLabel: { color: c.muted, formatter: "{value}%" },
        splitLine: { lineStyle: { color: c.grid } },
      },
      yAxis: {
        type: "category",
        inverse: true,
        data: data.map((d) => shortStation(d.name)),
        axisLabel: { color: c.muted },
      },
      series: present.map((k) => ({
        name: KATEGORI_STYLE[k].label,
        type: "bar",
        stack: "share",
        itemStyle: { color: KATEGORI_STYLE[k].bg },
        data: data.map((d) => ((d.by_kategori[k] ?? 0) / d.rows) * 100),
      })),
    }),
    [data, present, c],
  );
  return (
    <EChart option={option} label="Diagram batang bertumpuk persentase kategori per stasiun" />
  );
}

export function StasiunView() {
  const { filters } = useFilters();
  const q = useApi<StationStats[]>("/stats/stations", filters);
  return (
    <>
      <PageHeader
        title="Perbandingan antar-stasiun"
        description="Rata-rata indeks, komposisi kategori, dan pencemar kritis dominan."
      />
      <FilterBar />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card aria-labelledby="h-avg">
          <CardHeader id="h-avg" title="Rata-rata PM2.5 dan PM10" />
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
          />
          <CardBody>
            <QueryView query={q} skeleton={<ChartSkeleton />} isEmpty={(d) => d.length === 0}>
              {(d) => <ShareBars data={d} />}
            </QueryView>
          </CardBody>
        </Card>
        <Card className="lg:col-span-2" aria-labelledby="h-table">
          <CardHeader id="h-table" title="Ringkasan per stasiun" />
          <CardBody>
            <QueryView
              query={q}
              skeleton={<Skeleton className="h-48 w-full" />}
              isEmpty={(d) => d.length === 0}
            >
              {(d) => (
                <ScrollX label="Statistik per stasiun">
                  <table className="w-full min-w-[640px] text-sm">
                    <caption className="sr-only">Statistik per stasiun</caption>
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th scope="col" className="py-2 pr-3 font-medium">
                          Stasiun
                        </th>
                        <th scope="col" className="py-2 pr-3 text-right font-medium">
                          Jumlah hari
                        </th>
                        <th scope="col" className="py-2 pr-3 text-right font-medium">
                          Rata-rata PM2.5
                        </th>
                        <th scope="col" className="py-2 pr-3 text-right font-medium">
                          Rata-rata PM10
                        </th>
                        <th scope="col" className="py-2 pr-3 text-right font-medium">
                          Hari TIDAK SEHAT+
                        </th>
                        <th scope="col" className="py-2 font-medium">
                          Pencemar kritis dominan
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.map((s) => {
                        const [top, n] = Object.entries(s.kritis)[0] ?? [];
                        const unhealthy = KATEGORI.slice(2).reduce(
                          (a, k) => a + (s.by_kategori[k] ?? 0),
                          0,
                        );
                        const total = Object.values(s.kritis).reduce((a, b) => a + b, 0);
                        return (
                          <tr key={s.code} className="border-b border-border last:border-0">
                            <th scope="row" className="py-2 pr-3 text-left font-medium">
                              {s.name}
                            </th>
                            <td className="py-2 pr-3 text-right">{fmt.int(s.rows)}</td>
                            <td className="py-2 pr-3 text-right">
                              {fmt.num(s.avg_pm_duakomalima)}
                            </td>
                            <td className="py-2 pr-3 text-right">{fmt.num(s.avg_pm_sepuluh)}</td>
                            <td className="py-2 pr-3 text-right">
                              {fmt.int(unhealthy)} ({fmt.pct(s.pct_tidak_sehat)})
                            </td>
                            <td className="py-2">
                              {top ? `${kritisLabel(top)} (${fmt.pct((n ?? 0) / total)})` : "–"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </ScrollX>
              )}
            </QueryView>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
