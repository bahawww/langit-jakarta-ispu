"use client";

import { useMemo } from "react";

import { BULAN, ChartLegend, EChart, timeAxisLabel, useChartColors } from "@/components/chart";
import { FilterBar } from "@/components/filter-bar";
import { IspuLegend } from "@/components/ispu";
import { PageHeader } from "@/components/page-header";
import { ChartSkeleton, QueryView } from "@/components/states";
import { Callout } from "@/components/ui/callout";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import { ScrollX } from "@/components/ui/scroll-x";
import { useApi, type DailyPoint, type Meta, type MonthlyCount } from "@/lib/api";
import { useFilters } from "@/lib/filters";
import { fmt } from "@/lib/format";
import { AMBANG, KATEGORI, KATEGORI_META, isUnhealthy, severity } from "@/lib/kategori";

const monthFmt = new Intl.DateTimeFormat("id-ID", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function TimeSeries({ data, label }: { data: DailyPoint[]; label: string }) {
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
          name: `Rata-rata ${label}`,
          type: "line",
          showSymbol: false,
          lineStyle: { width: 2.5, color: c.accent, cap: "round", join: "round" },
          itemStyle: { color: c.accent },
          data: data.map((d) => [d.tanggal, d.avg]),
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
          name: "Tertinggi antar stasiun",
          type: "line",
          showSymbol: false,
          lineStyle: { width: 1.5, color: c.series2, cap: "round", join: "round" },
          itemStyle: { color: c.series2 },
          data: data.map((d) => [d.tanggal, d.max]),
        },
      ],
    }),
    [data, label, c],
  );
  return (
    <EChart
      option={option}
      height={360}
      label={`Grafik garis harian ${label} dengan garis batas Baik (50) dan Sedang (100)`}
    />
  );
}

function CalendarHeatmap({ data, years }: { data: DailyPoint[]; years: number[] }) {
  const c = useChartColors();
  const option = useMemo(
    () => ({
      tooltip: {
        formatter: (p: { value: [string, number] }) =>
          `${fmt.date(p.value[0])}<br/>${KATEGORI_META[KATEGORI[p.value[1]]!].label}`,
      },
      visualMap: {
        show: false,
        type: "piecewise",
        pieces: KATEGORI.map((k) => ({ value: severity(k), color: c.ispu[k] })),
      },
      calendar: years.map((y, i) => ({
        range: String(y),
        top: 24 + i * 146,
        left: 84,
        right: 16,
        cellSize: ["auto", 16],
        yearLabel: { color: c.text, fontSize: 13, margin: 44 },
        monthLabel: { nameMap: BULAN, color: c.muted, fontSize: 11 },
        // indeks 0 = Minggu; firstDay 1 = baris pertama Senin
        dayLabel: {
          nameMap: ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"],
          color: c.muted,
          firstDay: 1,
          fontSize: 10,
        },
        itemStyle: { color: c.sunken, borderColor: c.surface, borderWidth: 2 },
        splitLine: { show: false },
      })),
      series: years.map((y, i) => ({
        type: "heatmap",
        coordinateSystem: "calendar",
        calendarIndex: i,
        itemStyle: { borderColor: c.surface, borderWidth: 2, borderRadius: 3 },
        data: data
          .filter((d) => d.tanggal.startsWith(String(y)))
          .map((d) => [d.tanggal, severity(d.kategori_terburuk)]),
      })),
    }),
    [data, years, c],
  );
  return (
    <ScrollX label="Kalender kategori harian, geser ke samping jika layar sempit">
      <div className="min-w-[720px]">
        <EChart
          option={option}
          height={24 + years.length * 146}
          label="Kalender kategori kualitas udara harian; warna menunjukkan kategori terburuk antar-stasiun"
        />
      </div>
    </ScrollX>
  );
}

function MonthlyStacked({ data }: { data: MonthlyCount[] }) {
  const c = useChartColors();
  const present = KATEGORI.filter((k) => data.some((d) => d.counts[k]));
  const option = useMemo(
    () => ({
      grid: { left: 44, right: 16, top: 16, bottom: 48 },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      xAxis: {
        type: "category",
        data: data.map((d) => monthFmt.format(new Date(`${d.bulan}-01T00:00:00Z`))),
        axisLabel: { color: c.muted, fontSize: 11, rotate: 45 },
        axisLine: { lineStyle: { color: c.axis } },
      },
      yAxis: {
        type: "value",
        name: "Hari-stasiun",
        nameTextStyle: { color: c.muted, fontSize: 11 },
        axisLabel: { color: c.muted, fontSize: 11 },
        splitLine: { lineStyle: { color: c.grid } },
      },
      series: present.map((k) => ({
        name: KATEGORI_META[k].label,
        type: "bar",
        stack: "kategori",
        barMaxWidth: 36,
        itemStyle: { color: c.ispu[k], borderColor: c.surface, borderWidth: 1 },
        data: data.map((d) => d.counts[k] ?? 0),
      })),
    }),
    [data, present, c],
  );
  return (
    <EChart
      option={option}
      height={340}
      label="Diagram batang bertumpuk jumlah hari-stasiun per kategori per bulan"
    />
  );
}

export function TrenView() {
  const { filters, searchParams, setParam } = useFilters();
  const pollutant = searchParams.get("pollutant") ?? "pm_duakomalima";
  const meta = useApi<Meta>("/meta");
  const daily = useApi<DailyPoint[]>("/stats/daily", { ...filters, pollutant });
  const monthly = useApi<MonthlyCount[]>("/stats/monthly", filters);
  const options = [
    ...(meta.data?.pollutants ?? []),
    { key: "max", label: "Indeks tertinggi (6 polutan)" },
  ];
  const label = options.find((o) => o.key === pollutant)?.label ?? pollutant;
  const years = (meta.data?.years ?? []).filter(
    (y) =>
      (!filters.start || String(y) >= filters.start.slice(0, 4)) &&
      (!filters.end || String(y) <= filters.end.slice(0, 4)),
  );

  return (
    <>
      <PageHeader
        title="Tren kualitas udara"
        description="Pola harian, kalender kategori, dan komposisi bulanan dari stasiun terpilih."
      />
      <FilterBar>
        <Field label="Polutan" htmlFor="f-pollutant" className="lg:w-56">
          <Select
            id="f-pollutant"
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
      </FilterBar>

      <Card aria-labelledby="h-ts">
        <CardHeader
          id="h-ts"
          title={`Indeks harian ${label}`}
          description="Rata-rata antar stasiun terpilih. Geser atau perbesar dengan slider di bawah grafik."
          action={
            <ChartLegend
              items={[
                { label: "Rata-rata", color: "var(--accent)" },
                { label: "Tertinggi", color: "var(--series-2)" },
                { label: "Batas 50 dan 100", color: "var(--chart-axis)", kind: "dash" },
              ]}
            />
          }
        />
        <CardBody>
          <QueryView
            query={daily}
            skeleton={<ChartSkeleton height={360} />}
            isEmpty={(d) => d.length === 0}
          >
            {(d) => {
              const over = d.filter((p) => p.avg > 100).length;
              return (
                <>
                  <TimeSeries data={d} label={label} />
                  <Callout>
                    rata-rata harian melewati batas Sedang (100) pada {fmt.int(over)} dari{" "}
                    {fmt.int(d.length)} hari. Garis oranye adalah stasiun dengan indeks tertinggi
                    pada hari itu.
                  </Callout>
                </>
              );
            }}
          </QueryView>
        </CardBody>
      </Card>

      <Card aria-labelledby="h-cal">
        <CardHeader
          id="h-cal"
          title="Kalender kategori harian"
          description="Kategori terburuk (label sumber) di antara stasiun terpilih pada hari itu."
          action={
            <IspuLegend
              only={["BAIK", "SEDANG", "TIDAK SEHAT", "SANGAT TIDAK SEHAT", "BERBAHAYA"]}
            />
          }
        />
        <CardBody>
          <QueryView
            query={daily}
            skeleton={<ChartSkeleton height={340} />}
            isEmpty={(d) => d.length === 0}
          >
            {(d) => (
              <>
                <CalendarHeatmap data={d} years={years} />
                <Callout>
                  sel kosong berarti tidak ada data pada hari itu, bukan udara bersih.
                </Callout>
              </>
            )}
          </QueryView>
        </CardBody>
      </Card>

      <Card aria-labelledby="h-month">
        <CardHeader
          id="h-month"
          title="Kategori per bulan"
          description="Jumlah hari-stasiun per kategori (label sumber)."
          action={<IspuLegend />}
        />
        <CardBody>
          <QueryView
            query={monthly}
            skeleton={<ChartSkeleton height={340} />}
            isEmpty={(d) => d.length === 0}
          >
            {(d) => {
              const bad = (m: MonthlyCount) =>
                Object.entries(m.counts)
                  .filter(([k]) => isUnhealthy(k))
                  .reduce((a, [, n]) => a + n, 0);
              const peak = d.reduce((a, m) => (bad(m) > bad(a) ? m : a), d[0]!);
              return (
                <>
                  <MonthlyStacked data={d} />
                  <Callout>
                    {bad(peak) > 0
                      ? `hari Tidak Sehat atau lebih buruk paling banyak pada ${fmt.monthYear(`${peak.bulan}-01`)} (${fmt.int(bad(peak))} hari-stasiun). Tinggi batang = jumlah hari-stasiun bulan itu.`
                      : "tidak ada hari Tidak Sehat atau lebih buruk pada rentang ini."}
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
