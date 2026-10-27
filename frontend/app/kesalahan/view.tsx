"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { EChart, useChartColors } from "@/components/chart";
import { FilterBar } from "@/components/filter-bar";
import { IspuBadge } from "@/components/ispu";
import { PageHeader } from "@/components/page-header";
import { ChartSkeleton, QueryView } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import { ScrollX } from "@/components/ui/scroll-x";
import { SegmentedControl } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi, type OrangeRow } from "@/lib/api";
import { useFilters } from "@/lib/filters";
import { fmt } from "@/lib/format";
import { severity } from "@/lib/kategori";
import { shortStation } from "@/lib/labels";
import { MODELS, isModelKey, type ModelKey } from "@/lib/models";

const PAGE_SIZE = 15;

type Wrong = { row: OrangeRow; pred: string; under: boolean };

/** Ketepatan per kelompok: kunci -> {n, benar}. */
function accuracyBy(
  rows: OrangeRow[],
  pred: (r: OrangeRow) => string,
  key: (r: OrangeRow) => string,
) {
  const acc = new Map<string, { n: number; ok: number; label: string }>();
  for (const r of rows) {
    const k = key(r);
    const a = acc.get(k) ?? { n: 0, ok: 0, label: k };
    a.n += 1;
    if (pred(r) === r.kategori) a.ok += 1;
    acc.set(k, a);
  }
  return [...acc.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, a]) => ({ key: k, ...a }));
}

function ByMonth({ items }: { items: { key: string; n: number; ok: number }[] }) {
  const c = useChartColors();
  // Sumbu tidak mulai dari 0 supaya selisih antarbulan terlihat; batas bawahnya ditulis di catatan.
  const floor = Math.max(
    0,
    Math.floor((Math.min(...items.map((i) => i.ok / i.n)) - 0.02) * 20) / 20,
  );
  const option = useMemo(
    () => ({
      grid: { left: 44, right: 8, top: 12, bottom: 44 },
      tooltip: {
        trigger: "axis",
        valueFormatter: (v: number) => fmt.pct(v),
      },
      xAxis: {
        type: "category",
        data: items.map((i) => fmt.monthYear(`${i.key}-01`)),
        axisLabel: { color: c.muted, fontSize: 11, hideOverlap: true },
        axisLine: { lineStyle: { color: c.axis } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        min: floor,
        max: 1,
        axisLabel: {
          color: c.muted,
          fontSize: 11,
          formatter: (v: number) => `${Math.round(v * 100)}%`,
        },
        splitLine: { lineStyle: { color: c.grid } },
      },
      series: [
        {
          type: "bar",
          data: items.map((i) => i.ok / i.n),
          itemStyle: { color: c.accent, borderRadius: [3, 3, 0, 0] },
          barMaxWidth: 28,
        },
      ],
    }),
    [items, c, floor],
  );
  const low = items.reduce((a, b) => (b.ok / b.n < a.ok / a.n ? b : a));
  return (
    <>
      <EChart
        option={option}
        height={260}
        label={`Ketepatan per bulan. Terendah ${fmt.pct(low.ok / low.n)} pada ${fmt.monthYear(`${low.key}-01`)}.`}
      />
      <p className="m-0 text-sm text-ink-3">
        Sumbu dimulai dari {Math.round(floor * 100)}%, bukan 0%.
      </p>
    </>
  );
}

export function KesalahanView() {
  const { filters, searchParams, setParam } = useFilters();
  const modelParam = searchParams.get("model");
  const model: ModelKey = isModelKey(modelParam) ? modelParam : "rf";
  const pred = MODELS[model].pred;
  const [dir, setDir] = useState<"all" | "under" | "over">("all");
  const [page, setPage] = useState(1);

  const q = useApi<OrangeRow[]>("/baseline/orange/rows", filters);
  const rows = useMemo(() => q.data ?? [], [q.data]);

  const wrong: Wrong[] = useMemo(
    () =>
      rows
        .filter((r) => pred(r) !== r.kategori)
        .map((r) => ({ row: r, pred: pred(r), under: severity(pred(r)) < severity(r.kategori) }))
        .sort((a, b) => b.row.tanggal.localeCompare(a.row.tanggal)),
    [rows, pred],
  );
  const under = wrong.filter((w) => w.under).length;
  const over = wrong.length - under;

  const byStation = useMemo(
    () =>
      accuracyBy(rows, pred, (r) => r.station_code)
        .map((s) => ({
          ...s,
          name: shortStation(rows.find((r) => r.station_code === s.key)?.station_name ?? s.key),
        }))
        .sort((a, b) => b.ok / b.n - a.ok / a.n),
    [rows, pred],
  );
  const byMonth = useMemo(() => accuracyBy(rows, pred, (r) => r.tanggal.slice(0, 7)), [rows, pred]);

  const shown = dir === "all" ? wrong : wrong.filter((w) => (dir === "under" ? w.under : !w.under));
  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const slice = shown.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const hardest = byStation.length ? byStation[byStation.length - 1] : null;

  return (
    <>
      <PageHeader
        title="Di mana model masih keliru"
        description={
          q.data
            ? `${MODELS[model].label} salah menebak ${fmt.int(wrong.length)} dari ${fmt.int(rows.length)} hari uji. ${fmt.int(under)} tebakannya terlalu rendah, ${fmt.int(over)} terlalu tinggi.`
            : "Membedah tebakan yang meleset: di stasiun mana, di bulan apa, dan ke arah mana."
        }
        meta={null}
      />
      <FilterBar showDates={false} showYear>
        <Field label="Model" htmlFor="f-model" className="lg:w-56">
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

      <section className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,440px),1fr))] gap-x-16 gap-y-12">
        <Card aria-labelledby="h-kes-stasiun">
          <CardHeader
            id="h-kes-stasiun"
            title="Per stasiun"
            description="Porsi tebakan yang benar di tiap lokasi pemantauan."
          />
          <CardBody>
            <QueryView
              query={q}
              skeleton={<Skeleton className="h-64 w-full" />}
              isEmpty={(d) => d.length === 0}
            >
              {() => (
                <>
                  <ul className="m-0 flex list-none flex-col p-0">
                    {byStation.map((s) => (
                      <li
                        key={s.key}
                        className="grid min-h-11 grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-3.5 border-b border-line-soft text-sm"
                      >
                        <span className="font-bold">{s.name}</span>
                        <span className="ua-bar" aria-hidden>
                          <span
                            style={{
                              width: `${(s.ok / s.n) * 100}%`,
                              background: "var(--series-1)",
                            }}
                          />
                        </span>
                        <span className="text-right">
                          <strong className="font-extrabold">{fmt.pct(s.ok / s.n)}</strong>{" "}
                          <span className="text-ink-3">
                            ({fmt.int(s.n - s.ok)} salah dari {fmt.int(s.n)})
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  {hardest ? (
                    <p className="m-0 text-[15px] leading-[1.55] text-ink-2">
                      {hardest.name} paling sulit ditebak: {fmt.int(hardest.n - hardest.ok)} hari
                      meleset dari {fmt.int(hardest.n)}.
                    </p>
                  ) : null}
                </>
              )}
            </QueryView>
          </CardBody>
        </Card>

        <Card aria-labelledby="h-kes-bulan">
          <CardHeader
            id="h-kes-bulan"
            title="Per bulan"
            description="Porsi tebakan yang benar menurut bulan data uji."
          />
          <CardBody>
            <QueryView
              query={q}
              skeleton={<ChartSkeleton height={260} />}
              isEmpty={(d) => d.length === 0}
            >
              {() => <ByMonth items={byMonth} />}
            </QueryView>
          </CardBody>
        </Card>
      </section>

      <Card aria-labelledby="h-kes-kasus">
        <CardHeader
          id="h-kes-kasus"
          title="Hari yang salah ditebak"
          description="Terlalu rendah berarti model menebak kategori lebih baik dari kenyataan; terlalu tinggi sebaliknya."
          action={
            <SegmentedControl
              label="Arah kesalahan"
              value={dir}
              onChange={(v) => {
                setDir(v);
                setPage(1);
              }}
              options={[
                { value: "all", label: "Semua" },
                { value: "under", label: "Terlalu rendah" },
                { value: "over", label: "Terlalu tinggi" },
              ]}
            />
          }
        />
        <CardBody>
          <QueryView
            query={q}
            skeleton={<Skeleton className="h-80 w-full" />}
            isEmpty={() => shown.length === 0}
            empty={
              <p className="m-0 py-6 text-sm text-ink-3">
                Tidak ada tebakan salah untuk pilihan ini.
              </p>
            }
          >
            {() => (
              <ScrollX label="Tabel hari yang salah ditebak">
                <table className="ua-table min-w-[720px]">
                  <caption className="sr-only">
                    Tebakan {MODELS[model].label} yang salah, halaman {current} dari {pages}
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
                        Tebakan
                      </th>
                      <th scope="col" className="ua-left">
                        Arah
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {slice.map((w) => (
                      <tr key={`${w.row.tanggal}-${w.row.station_code}`}>
                        <td className="ua-left whitespace-nowrap font-bold">
                          {fmt.date(w.row.tanggal)}
                        </td>
                        <td className="ua-left">{shortStation(w.row.station_name)}</td>
                        <td>{w.row.pm_duakomalima}</td>
                        <td className="ua-left">
                          <IspuBadge value={w.row.kategori} />
                        </td>
                        <td className="ua-left">
                          <IspuBadge value={w.pred} />
                        </td>
                        <td
                          className={`ua-left font-bold ${w.under ? "text-danger" : "text-ink-2"}`}
                        >
                          {w.under ? "Terlalu rendah" : "Terlalu tinggi"}
                        </td>
                      </tr>
                    ))}
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

      {under > 0 ? (
        <Callout label="Tebakan terlalu rendah lebih berisiko.">
          Orang mengira udara lebih bersih dari kenyataan. Pada filter ini ada {fmt.int(under)} hari
          seperti itu dari {fmt.int(wrong.length)} tebakan salah.
        </Callout>
      ) : null}
    </>
  );
}
