"use client";

import { useMemo } from "react";

import { ChartLegend, EChart, useChartColors } from "@/components/chart";
import { FilterBar } from "@/components/filter-bar";
import { IspuBadge, IspuLegend } from "@/components/ispu";
import { StationMap } from "@/components/station-map";
import { ChartSkeleton, QueryView } from "@/components/states";
import { Callout } from "@/components/ui/callout";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ScrollX } from "@/components/ui/scroll-x";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi, type Meta, type StationStats, type Summary } from "@/lib/api";
import { useFilters } from "@/lib/filters";
import { fmt } from "@/lib/format";
import { KATEGORI, KATEGORI_META, isUnhealthy, kategoriOf } from "@/lib/kategori";
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

const wilayahOf = (name: string) => /\(([^)]+)\)/.exec(name)?.[1] ?? "";

/** Peta lima stasiun + tabel indeks rata-rata dan kategorinya. */
function MapSection({ q }: { q: ReturnType<typeof useApi<StationStats[]>> }) {
  return (
    <section
      aria-labelledby="h-peta"
      className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,440px),1fr))] items-start gap-x-16 gap-y-10"
    >
      <Card aria-labelledby="h-peta">
        <CardHeader
          id="h-peta"
          title="Lima stasiun pemantau"
          description="Warna titik adalah kategori dari indeks rata-rata pada filter terpilih. Peta disederhanakan, posisi stasiun perkiraan."
        />
        <CardBody>
          <QueryView
            query={q}
            skeleton={<ChartSkeleton height={320} />}
            isEmpty={(d) => d.length === 0}
          >
            {(d) => <StationMap stations={d} />}
          </QueryView>
        </CardBody>
      </Card>
      <div className="flex flex-col gap-1 pt-1.5">
        <QueryView
          query={q}
          skeleton={<Skeleton className="h-64 w-full" />}
          isEmpty={(d) => d.length === 0}
        >
          {(d) => (
            <ScrollX label="Tabel indeks rata-rata per stasiun">
              <table className="ua-table">
                <caption className="!pb-2.5 !text-[15px] !font-bold !text-ink">
                  Indeks rata-rata per stasiun
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Stasiun</th>
                    <th scope="col" className="ua-left">
                      Wilayah
                    </th>
                    <th scope="col">Indeks</th>
                    <th scope="col">Kategori</th>
                  </tr>
                </thead>
                <tbody>
                  {d.map((s) => (
                    <tr key={s.code}>
                      <th scope="row">{shortStation(s.name)}</th>
                      <td className="ua-left text-ink-2">{wilayahOf(s.name)}</td>
                      <td className="font-extrabold !text-ink">{fmt.num(s.avg_max)}</td>
                      <td>
                        <IspuBadge value={kategoriOf(s.avg_max)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollX>
          )}
        </QueryView>
      </div>
    </section>
  );
}

/** Porsi hari tiap polutan menjadi penentu kategori + keterangan dataset. */
function CriticalSection({ q }: { q: ReturnType<typeof useApi<StationStats[]>> }) {
  const meta = useApi<Meta>("/meta");
  const summary = useApi<Summary>("/stats/summary");
  const m = meta.data;
  const about = m
    ? [
        {
          k: "Periode",
          v: `${fmt.monthYear(m.date_min)} – ${fmt.monthYear(m.date_max)}`,
        },
        { k: "Stasiun", v: `${m.stations.length} SPKU DKI Jakarta` },
        { k: "Jumlah data", v: `${fmt.int(m.total_rows)} hari-stasiun` },
        { k: "Polutan", v: m.pollutants.map((p) => p.label).join(", ") },
        { k: "Satuan", v: "Nilai indeks ISPU, bukan µg/m³" },
        {
          k: "Label tidak konsisten",
          v: summary.data ? `${fmt.int(summary.data.label_inconsistent)} baris` : "…",
        },
        { k: "Sumber", v: "DLH DKI Jakarta via Satu Data Jakarta" },
      ]
    : [];
  return (
    <section className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-start gap-x-16 gap-y-10">
      <Card aria-labelledby="h-kritis">
        <CardHeader
          id="h-kritis"
          title="Polutan penentu kategori"
          description="Kategori harian ditentukan polutan dengan nilai tertinggi hari itu. Ini porsi hari tiap polutan menjadi penentu."
        />
        <CardBody>
          <QueryView
            query={q}
            skeleton={<Skeleton className="h-48 w-full" />}
            isEmpty={(d) => d.length === 0}
          >
            {(d) => {
              const total: Record<string, number> = {};
              for (const s of d)
                for (const [k, n] of Object.entries(s.kritis)) total[k] = (total[k] ?? 0) + n;
              const all = Object.values(total).reduce((a, b) => a + b, 0);
              const items = Object.entries(total).sort(([, a], [, b]) => b - a);
              return (
                <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
                  {items.map(([k, n], i) => (
                    <li
                      key={k}
                      className="grid grid-cols-[64px_minmax(0,1fr)_56px] items-center gap-3.5 text-sm"
                    >
                      <span className="font-bold">{kritisLabel(k)}</span>
                      <span className="ua-bar" style={{ height: 10 }} aria-hidden>
                        <span
                          className="ua-anim-grow"
                          style={{
                            width: `${(n / all) * 100}%`,
                            background: i === 0 ? "var(--series-1)" : "var(--bar-muted)",
                          }}
                        />
                      </span>
                      <span className="text-right font-bold">{fmt.pct(n / all)}</span>
                    </li>
                  ))}
                </ul>
              );
            }}
          </QueryView>
        </CardBody>
      </Card>
      <section className="ua-panel flex flex-col gap-4" aria-labelledby="h-tentang">
        <h2 id="h-tentang" className="m-0 text-xl font-extrabold tracking-[-0.01em]">
          Tentang data ini
        </h2>
        {m ? (
          <dl className="m-0 grid grid-cols-[minmax(110px,auto)_1fr] gap-x-5 gap-y-3 text-sm leading-normal">
            {about.map((a) => (
              <div key={a.k} className="contents">
                <dt className="font-medium text-ink-3">{a.k}</dt>
                <dd className="m-0 font-semibold">{a.v}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <Skeleton className="h-40 w-full" />
        )}
        <p className="m-0 rounded-[10px] bg-bg px-3.5 py-3 text-[13px] leading-[1.55] text-ink-2">
          <strong className="font-bold text-warn">Catatan:</strong> data uji dipisahkan dengan dua
          cara. Split acak 80:20 meniru Orange, sedangkan holdout waktu menguji 20% tanggal
          terakhir. Karena hari yang berdekatan mirip, split acak cenderung terlihat lebih mudah.
        </p>
      </section>
    </section>
  );
}

export function StasiunView() {
  const { filters } = useFilters();
  const q = useApi<StationStats[]>("/stats/stations", filters);
  return (
    <>
      <FilterBar />
      <MapSection q={q} />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,440px),1fr))] gap-x-16 gap-y-10">
        <Card aria-labelledby="h-avg">
          <CardHeader
            id="h-avg"
            title="Rata-rata PM2.5 dan PM10"
            description="Indeks harian, dirata-rata selama periode terpilih."
            action={
              <ChartLegend
                items={[
                  { label: "PM2.5", color: "var(--series-1)", kind: "dot" },
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
      <CriticalSection q={q} />
    </>
  );
}
