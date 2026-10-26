"use client";

import { useApi, type Meta } from "@/lib/api";
import { fmt } from "@/lib/format";

export type MetaChip = { k: string; v: string };

/**
 * Judul halaman (kiri) dan chip meta (kanan), seperti di mockup. Tanpa `meta`, chip diisi dari
 * /api/meta (periode, stasiun, jumlah data, sumber); `meta={null}` menyembunyikannya.
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
    <header className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
      <div className="flex max-w-[700px] min-w-0 flex-col gap-3 xl:flex-1">
        <span className="text-[13px] font-semibold text-ink-3">ISPU · Provinsi DKI Jakarta</span>
        <h1 className="m-0 text-[clamp(28px,3.4vw,40px)] leading-[1.12] font-extrabold tracking-[-0.025em] text-balance">
          {title}
        </h1>
        {description ? (
          <p className="m-0 text-[15px] leading-[1.6] text-ink-3">{description}</p>
        ) : null}
      </div>
      {chips.length || action ? (
        <div className="flex flex-wrap items-end gap-2 xl:shrink-0 xl:justify-end">
          {chips.length ? (
            <dl className="m-0 flex flex-wrap gap-2" aria-label="Ringkasan data">
              {chips.map((c) => (
                <div key={c.k} className="ua-chip">
                  <dt className="ua-chip__k">{c.k}</dt>
                  <dd className="ua-chip__v m-0">{c.v}</dd>
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
