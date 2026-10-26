"use client";

import { useApi, type Meta } from "@/lib/api";
import { fmt } from "@/lib/format";

export type MetaChip = { k: string; v: string };

/**
 * Judul halaman, satu kalimat pengantar, dan keterangan data (periode, stasiun, jumlah data, sumber)
 * sebagai pasangan nama-nilai tanpa kotak. Tanpa `meta`, keterangan diisi dari /api/meta;
 * `meta={null}` menyembunyikannya.
 */
export function PageHeader({
  title,
  description,
  meta,
  action,
}: {
  title: string;
  description?: string;
  meta?: MetaChip[] | null;
  action?: React.ReactNode;
}) {
  const m = useApi<Meta>("/meta", undefined, meta === undefined);
  const chips: MetaChip[] =
    meta ??
    (m.data && meta === undefined
      ? [
          {
            k: "Periode",
            v: `${fmt.monthYear(m.data.date_min)} – ${fmt.monthYear(m.data.date_max)}`,
          },
          { k: "Stasiun", v: `${m.data.stations.length} SPKU` },
          { k: "Data", v: `${fmt.int(m.data.total_rows)} hari-stasiun` },
          { k: "Sumber", v: "Satu Data Jakarta" },
        ]
      : []);
  return (
    <header className="ua-enter flex flex-col gap-4 pt-4">
      <h1 className="ua-page-title text-balance">{title}</h1>
      {description ? <p className="ua-desc !text-[18px] !text-ink-2">{description}</p> : null}
      {chips.length || action ? (
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          {chips.length ? (
            <dl className="m-0 flex flex-wrap gap-x-8 gap-y-2" aria-label="Ringkasan data">
              {chips.map((c) => (
                <div key={c.k} className="flex flex-col">
                  <dt className="text-[13px] font-semibold text-ink-3">{c.k}</dt>
                  <dd className="m-0 text-[15px] font-bold">{c.v}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {action}
        </div>
      ) : null}
    </header>
  );
}
