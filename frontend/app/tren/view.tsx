"use client";

import { useMemo } from "react";

import { BULAN, EChart, timeAxisLabel, useChartColors } from "@/components/chart";
import { FilterBar } from "@/components/filter-bar";
import { PageHeader } from "@/components/page-header";
import { ChartSkeleton, QueryView } from "@/components/states";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import { useApi, type DailyPoint, type Meta, type MonthlyCount } from "@/lib/api";
import { useFilters } from "@/lib/filters";
import { fmt } from "@/lib/format";
import { AMBANG, KATEGORI, KATEGORI_STYLE, kategoriStyle, severity } from "@/lib/kategori";

const monthFmt = new Intl.DateTimeFormat("id-ID", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function TimeSeries({ data, label }: { data: DailyPoint[]; label: string }) {
  const c = useChartColors();
  const option = useMemo(
    () => ({
      grid: { left: 44, right: 16, top: 60, bottom: 72 },
      legend: { top: 0, textStyle: { color: c.text } },
      tooltip: {
        trigger: "axis",
        valueFormatter: (v: number) => fmt.num(v),
      },
      xAxis: {
        type: "time",
        axisLabel: { color: c.muted, hideOverlap: true, formatter: timeAxisLabel },
        axisLine: { lineStyle: { color: c.grid } },
      },
      yAxis: {
        type: "value",
        name: "Indeks ISPU",
        nameTextStyle: { color: c.muted },
        axisLabel: { color: c.muted },
        splitLine: { lineStyle: { color: c.grid } },
      },
      dataZoom: [{ type: "inside" }, { type: "slider", bottom: 16, height: 24 }],
      series: [
        {
          name: `Rata-rata ${label}`,
          type: "line",
          showSymbol: false,
          data: data.map((d) => [d.tanggal, d.avg]),
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
        {
          name: `Tertinggi antar-stasiun`,
          type: "line",
          showSymbol: false,
          lineStyle: { width: 1, opacity: 0.6 },
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
      label={`Grafik garis harian ${label} dengan garis ambang 50 dan 100`}
    />
  );
}

function CalendarHeatmap({ data, years }: { data: DailyPoint[]; years: number[] }) {
  const c = useChartColors();
  const present = KATEGORI.filter((k) => data.some((d) => d.kategori_terburuk === k));
  const option = useMemo(
    () => ({
      tooltip: {
        formatter: (p: { value: [string, number] }) =>
          `${fmt.date(p.value[0])}<br/>${KATEGORI_STYLE[KATEGORI[p.value[1]]!].label}`,
      },
      visualMap: {
        type: "piecewise",
        orient: "horizontal",
        left: 84,
        top: 0,
        itemGap: 20,
        textStyle: { color: c.text, fontSize: 12 },
        pieces: present.map((k) => ({
          value: severity(k),
          label: KATEGORI_STYLE[k].label,
          color: KATEGORI_STYLE[k].bg,
        })),
      },
      calendar: years.map((y, i) => ({
        range: String(y),
        top: 60 + i * 150,
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
        itemStyle: { color: c.dark ? "#1b2336" : "#f8fafc", borderColor: c.grid },
        splitLine: { lineStyle: { color: c.grid } },
      })),
      series: years.map((y, i) => ({
        type: "heatmap",
        coordinateSystem: "calendar",
        calendarIndex: i,
        data: data
          .filter((d) => d.tanggal.startsWith(String(y)))
          .map((d) => [d.tanggal, severity(d.kategori_terburuk)]),
      })),
    }),
    [data, years, present, c],
  );
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px]">
        <EChart
          option={option}
          height={50 + years.length * 150}
          label="Kalender kategori kualitas udara harian; warna dan legenda menunjukkan kategori terburuk antar-stasiun"
        />
      </div>
    </div>
  );
}

function MonthlyStacked({ data }: { data: MonthlyCount[] }) {
  const c = useChartColors();
  const present = KATEGORI.filter((k) => data.some((d) => d.counts[k]));
  const option = useMemo(
    () => ({
      grid: { left: 44, right: 16, top: 60, bottom: 48 },
      legend: { top: 0, textStyle: { color: c.text } },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      xAxis: {
        type: "category",
        data: data.map((d) => monthFmt.format(new Date(`${d.bulan}-01T00:00:00Z`))),
        axisLabel: { color: c.muted, rotate: 45 },
      },
      yAxis: {
        type: "value",
        name: "Hari-stasiun",
        nameTextStyle: { color: c.muted },
        axisLabel: { color: c.muted },
        splitLine: { lineStyle: { color: c.grid } },
      },
      series: present.map((k) => ({
        name: kategoriStyle(k).label,
        type: "bar",
        stack: "kategori",
        itemStyle: { color: KATEGORI_STYLE[k].bg },
        data: data.map((d) => d.counts[k] ?? 0),
      })),
    }),
    [data, present, c],
  );
  return (
    <EChart
      option={option}
      height={360}
      label="Diagram batang bertumpuk jumlah hari per kategori per bulan"
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
    { key: "max", label: "Indeks maks (6 polutan)" },
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
        description="Pola harian, kalender kategori, dan komposisi bulanan."
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
      <div className="grid gap-5">
        <Card aria-labelledby="h-ts">
          <CardHeader
            id="h-ts"
            title={`Time series ${label}`}
            description="Rata-rata harian antar-stasiun terpilih. Garis putus-putus = ambang ISPU 50 (BAIK) dan 100 (SEDANG). Geser atau perbesar dengan slider."
          />
          <CardBody>
            <QueryView
              query={daily}
              skeleton={<ChartSkeleton height={360} />}
              isEmpty={(d) => d.length === 0}
            >
              {(d) => <TimeSeries data={d} label={label} />}
            </QueryView>
          </CardBody>
        </Card>
        <Card aria-labelledby="h-cal">
          <CardHeader
            id="h-cal"
            title="Kalender kategori harian"
            description="Kategori terburuk (label sumber) di antara stasiun terpilih pada hari itu. Sel kosong = tidak ada data."
          />
          <CardBody>
            <QueryView
              query={daily}
              skeleton={<ChartSkeleton height={400} />}
              isEmpty={(d) => d.length === 0}
            >
              {(d) => <CalendarHeatmap data={d} years={years} />}
            </QueryView>
          </CardBody>
        </Card>
        <Card aria-labelledby="h-month">
          <CardHeader
            id="h-month"
            title="Kategori per bulan"
            description="Jumlah hari-stasiun per kategori (label sumber)."
          />
          <CardBody>
            <QueryView
              query={monthly}
              skeleton={<ChartSkeleton height={360} />}
              isEmpty={(d) => d.length === 0}
            >
              {(d) => <MonthlyStacked data={d} />}
            </QueryView>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
