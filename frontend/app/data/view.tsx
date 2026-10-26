"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useEffect, useState } from "react";

import { FilterBar } from "@/components/filter-bar";
import { KategoriBadge } from "@/components/kategori-badge";
import { PageHeader } from "@/components/page-header";
import { QueryView } from "@/components/states";
import { Button, buttonVariants } from "@/components/ui/button";
import { ScrollX } from "@/components/ui/scroll-x";
import { Card, CardBody } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet, toQuery, useApi, type ApiError, type MeasurementPage, type Meta } from "@/lib/api";
import { useFilters } from "@/lib/filters";
import { fmt } from "@/lib/format";
import { kategoriStyle } from "@/lib/kategori";
import { kritisLabel } from "@/lib/labels";

const PAGE_SIZE = 25;
const COLUMNS: { key: string; label: string; sortable?: boolean; numeric?: boolean }[] = [
  { key: "tanggal", label: "Tanggal", sortable: true },
  { key: "stasiun", label: "Stasiun", sortable: true },
  { key: "pm_duakomalima", label: "PM2.5", sortable: true, numeric: true },
  { key: "pm_sepuluh", label: "PM10", sortable: true, numeric: true },
  { key: "sulfur_dioksida", label: "SO2", sortable: true, numeric: true },
  { key: "karbon_monoksida", label: "CO", sortable: true, numeric: true },
  { key: "ozon", label: "O3", sortable: true, numeric: true },
  { key: "nitrogen_dioksida", label: "NO2", sortable: true, numeric: true },
  { key: "max", label: "Maks", sortable: true, numeric: true },
  { key: "kritis", label: "Kritis" },
  { key: "kategori", label: "Kategori", sortable: true },
];

export function DataView() {
  const { filters, searchParams, setParam, setParams } = useFilters();
  const meta = useApi<Meta>("/meta");
  const sort = searchParams.get("sort") ?? "tanggal";
  const order = searchParams.get("order") === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const kategori = searchParams.get("kategori") ?? undefined;
  const inconsistent = searchParams.get("inconsistent") === "1" ? true : undefined;
  const q = searchParams.get("q") ?? "";
  const [search, setSearch] = useState(q);

  // Debounce 300 ms supaya tidak memanggil API di setiap ketikan.
  useEffect(() => {
    if (search === q) return;
    const t = setTimeout(() => setParams({ q: search || undefined, page: undefined }), 300);
    return () => clearTimeout(t);
  }, [search, q, setParams]);

  const params = { ...filters, kategori, inconsistent, q: q || undefined };
  const data = useQuery<MeasurementPage, ApiError>({
    queryKey: ["/measurements", params, sort, order, page],
    queryFn: () => apiGet("/measurements", { ...params, sort, order, page, page_size: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const pages = data.data ? Math.max(1, Math.ceil(data.data.total / PAGE_SIZE)) : 1;

  const toggleSort = (key: string) =>
    setParams({
      sort: key,
      order: sort === key && order === "desc" ? "asc" : "desc",
      page: undefined,
    });

  return (
    <>
      <PageHeader
        title="Data pengukuran"
        description="Semua baris di database. Baris berlabel tidak konsisten diberi tanda, tidak dihapus."
      />
      <FilterBar>
        <Field label="Kategori" htmlFor="f-kat" className="lg:w-48">
          <Select
            id="f-kat"
            value={kategori ?? ""}
            onChange={(e) => setParams({ kategori: e.target.value || undefined, page: undefined })}
          >
            <option value="">Semua kategori</option>
            {meta.data?.categories.map((k) => (
              <option key={k} value={k}>
                {kategoriStyle(k).label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Cari (stasiun, kategori, kritis)" htmlFor="f-q" className="lg:w-64">
          <Input
            id="f-q"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="mis. kebon jeruk"
          />
        </Field>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm lg:self-end">
          <input
            type="checkbox"
            className="size-4"
            checked={Boolean(inconsistent)}
            onChange={(e) =>
              setParams({ inconsistent: e.target.checked ? "1" : undefined, page: undefined })
            }
          />
          Hanya label tidak konsisten
        </label>
      </FilterBar>

      <Card>
        <CardBody>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {data.data ? `${fmt.int(data.data.total)} baris` : "Memuat…"}
            </p>
            <a
              className={buttonVariants({ variant: "outline", size: "sm" })}
              href={`/api/measurements.csv${toQuery(params)}`}
              download
            >
              <Download aria-hidden /> Ekspor CSV
            </a>
          </div>
          <QueryView
            query={data}
            skeleton={<Skeleton className="h-96 w-full" />}
            isEmpty={(d) => d.total === 0}
          >
            {(d) => (
              <ScrollX label="Data pengukuran ISPU, halaman">
                <table className="w-full min-w-[960px] text-sm">
                  <caption className="sr-only">
                    Data pengukuran ISPU, halaman {page} dari {pages}
                  </caption>
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      {COLUMNS.map((c) => (
                        <th
                          key={c.key}
                          scope="col"
                          aria-sort={
                            sort === c.key
                              ? order === "asc"
                                ? "ascending"
                                : "descending"
                              : undefined
                          }
                          className={`py-2 pr-3 font-medium ${c.numeric ? "text-right" : "text-left"}`}
                        >
                          {c.sortable ? (
                            <button
                              type="button"
                              onClick={() => toggleSort(c.key)}
                              className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            >
                              {c.label}
                              {sort === c.key ? (
                                order === "asc" ? (
                                  <ArrowUp aria-hidden className="size-3" />
                                ) : (
                                  <ArrowDown aria-hidden className="size-3" />
                                )
                              ) : null}
                            </button>
                          ) : (
                            c.label
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className={data.isPlaceholderData ? "opacity-60" : undefined}>
                    {d.items.map((r) => (
                      <tr
                        key={`${r.tanggal}-${r.station_code}`}
                        className="border-b border-border last:border-0"
                      >
                        <td className="py-2 pr-3 whitespace-nowrap">{fmt.date(r.tanggal)}</td>
                        <td className="py-2 pr-3">{r.station_name}</td>
                        <td className="py-2 pr-3 text-right">{r.pm_duakomalima}</td>
                        <td className="py-2 pr-3 text-right">{r.pm_sepuluh}</td>
                        <td className="py-2 pr-3 text-right">{r.sulfur_dioksida}</td>
                        <td className="py-2 pr-3 text-right">{r.karbon_monoksida}</td>
                        <td className="py-2 pr-3 text-right">{r.ozon}</td>
                        <td className="py-2 pr-3 text-right">{r.nitrogen_dioksida}</td>
                        <td className="py-2 pr-3 text-right font-medium">{r.max}</td>
                        <td className="py-2 pr-3">
                          {r.parameter_pencemar_kritis
                            ? kritisLabel(r.parameter_pencemar_kritis)
                            : "–"}
                        </td>
                        <td className="py-2 pr-3">
                          <div className="flex flex-wrap items-center gap-1">
                            <KategoriBadge value={r.kategori} />
                            {r.label_inconsistent ? (
                              <span
                                className="rounded border border-current px-1.5 py-0.5 text-xs font-medium text-warning-fg"
                                title={`Label sumber ${r.kategori}, tetapi ambang ISPU dari nilai maks ${r.max} = ${r.kategori_ispu}`}
                              >
                                Label tidak konsisten (ISPU: {kategoriStyle(r.kategori_ispu).label})
                              </span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollX>
            )}
          </QueryView>
          <nav aria-label="Paginasi" className="mt-4 flex items-center justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setParam("page", String(page - 1))}
            >
              <ChevronLeft aria-hidden /> Sebelumnya
            </Button>
            <span className="text-sm">
              Halaman {fmt.int(page)} dari {fmt.int(pages)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pages}
              onClick={() => setParam("page", String(page + 1))}
            >
              Berikutnya <ChevronRight aria-hidden />
            </Button>
          </nav>
        </CardBody>
      </Card>
    </>
  );
}
