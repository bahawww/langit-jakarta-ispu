"use client";

import { useApi, type Meta } from "@/lib/api";
import { fmt } from "@/lib/format";

/** Judul halaman + rentang data yang tersedia (data historis, bukan real-time). */
export function PageHeader({ title, description }: { title: string; description?: string }) {
  const meta = useApi<Meta>("/meta");
  return (
    <div className="mb-5">
      <h1 className="text-2xl font-semibold text-balance">{title}</h1>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">
        {meta.data
          ? `Data tersedia ${fmt.date(meta.data.date_min)} – ${fmt.date(meta.data.date_max)} · ${fmt.int(meta.data.total_rows)} baris · ${meta.data.stations.length} stasiun`
          : "Memuat rentang data…"}
      </p>
    </div>
  );
}
