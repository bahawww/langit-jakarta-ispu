"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useEffect, useState } from "react";

import { FilterBar } from "@/components/filter-bar";
import { IspuBadge } from "@/components/ispu";
import { PageHeader } from "@/components/page-header";
import { QueryView } from "@/components/states";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { ScrollX } from "@/components/ui/scroll-x";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet, toQuery, useApi, type ApiError, type MeasurementPage, type Meta } from "@/lib/api";
import { useFilters } from "@/lib/filters";
import { fmt } from "@/lib/format";
import { kategoriMeta } from "@/lib/kategori";
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
  { key: "max", label: "Tertinggi", sortable: true, numeric: true },
  { key: "kritis", label: "Penyebab" },
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
                {kategoriMeta(k).label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Cari (stasiun, kategori, penyebab)" htmlFor="f-q" className="lg:w-64">
          <Input
            id="f-q"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="mis. kebon jeruk"
          />
        </Field>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold lg:self-end">
          <input
            type="checkbox"
            className="size-4 accent-[var(--series-1)]"
            checked={Boolean(inconsistent)}
            onChange={(e) =>
              setParams({ inconsistent: e.target.checked ? "1" : undefined, page: undefined })
            }
          />
          Hanya label tidak konsisten
        </label>
      </FilterBar>

      <Card aria-label="Tabel data pengukuran">
        <div className="ua-card__head items-center">
          <p className="m-0 text-sm font-semibold" aria-live="polite">
            {data.data ? `${fmt.int(data.data.total)} baris` : "Memuat…"}
          </p>
          <a
            className={buttonVariants({ variant: "outline", size: "sm" })}
            href={`/api/measurements.csv${toQuery(params)}`}
            download
          >
            <Download aria-hidden className="size-4" /> Ekspor CSV
          </a>
        </div>
        <CardBody>
          <QueryView
            query={data}
            skeleton={<Skeleton className="h-96 w-full" />}
            isEmpty={(d) => d.total === 0}
          >
            {(d) => (
              <ScrollX label="Tabel data pengukuran">
                <table className="ua-table min-w-[1000px]">
                  <caption className="sr-only">
                    Data pengukuran ISPU, halaman {page} dari {pages}
                  </caption>
                  <thead>
                    <tr>
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
                          className={c.numeric ? undefined : "ua-left"}
                        >
                          {c.sortable ? (
                            <button
                              type="button"
                              onClick={() => toggleSort(c.key)}
                              className={`ua-sort ${c.numeric ? "ua-sort--end" : ""}`}
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
                      <tr key={`${r.tanggal}-${r.station_code}`}>
                        <td className="ua-left whitespace-nowrap">{fmt.date(r.tanggal)}</td>
                        <td className="ua-left">{r.station_name}</td>
                        <td>{r.pm_duakomalima}</td>
                        <td>{r.pm_sepuluh}</td>
                        <td>{r.sulfur_dioksida}</td>
                        <td>{r.karbon_monoksida}</td>
                        <td>{r.ozon}</td>
                        <td>{r.nitrogen_dioksida}</td>
                        <td className="font-extrabold">{r.max}</td>
                        <td className="ua-left">
                          {r.parameter_pencemar_kritis
                            ? kritisLabel(r.parameter_pencemar_kritis)
                            : "–"}
                        </td>
                        <td className="ua-left">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <IspuBadge value={r.kategori} />
                            {r.label_inconsistent ? (
                              <span
                                className="ua-badge ua-badge--warning"
                                title={`Label sumber ${r.kategori}, tetapi ambang ISPU dari nilai tertinggi ${r.max} = ${r.kategori_ispu}`}
                              >
                                Label tidak konsisten (ISPU: {kategoriMeta(r.kategori_ispu).label})
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
          <nav aria-label="Paginasi" className="flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setParam("page", String(page - 1))}
            >
              <ChevronLeft aria-hidden className="size-4" /> Sebelumnya
            </Button>
            <span className="order-first basis-full text-center text-sm font-semibold sm:order-none sm:basis-auto">
              Halaman {fmt.int(page)} dari {fmt.int(pages)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pages}
              onClick={() => setParam("page", String(page + 1))}
            >
              Berikutnya <ChevronRight aria-hidden className="size-4" />
            </Button>
          </nav>
        </CardBody>
      </Card>
    </>
  );
}
