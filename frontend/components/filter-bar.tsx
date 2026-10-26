"use client";

import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { useApi, type Meta } from "@/lib/api";
import { useFilters } from "@/lib/filters";

/** Filter stasiun + rentang tanggal; pilihan dibaca dari /api/meta (bukan hard-coded). */
export function FilterBar({
  children,
  showDates = true,
}: {
  children?: React.ReactNode;
  showDates?: boolean;
}) {
  const { filters, setParam, setParams } = useFilters();
  const meta = useApi<Meta>("/meta");
  const m = meta.data;
  const active = Boolean(filters.station || filters.start || filters.end);
  return (
    <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
      <Field label="Stasiun" htmlFor="f-station" className="lg:w-64">
        <Select
          id="f-station"
          value={filters.station ?? ""}
          onChange={(e) => setParam("station", e.target.value || undefined)}
          disabled={!m}
        >
          <option value="">Semua stasiun</option>
          {m?.stations.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      {showDates ? (
        <>
          <Field label="Dari tanggal" htmlFor="f-start" className="lg:w-44">
            <Input
              id="f-start"
              type="date"
              min={m?.date_min ?? undefined}
              max={filters.end ?? m?.date_max ?? undefined}
              value={filters.start ?? ""}
              onChange={(e) => setParam("start", e.target.value || undefined)}
            />
          </Field>
          <Field label="Sampai tanggal" htmlFor="f-end" className="lg:w-44">
            <Input
              id="f-end"
              type="date"
              min={filters.start ?? m?.date_min ?? undefined}
              max={m?.date_max ?? undefined}
              value={filters.end ?? ""}
              onChange={(e) => setParam("end", e.target.value || undefined)}
            />
          </Field>
        </>
      ) : null}
      {children}
      {active ? (
        <Button
          variant="ghost"
          onClick={() => setParams({ station: undefined, start: undefined, end: undefined })}
        >
          Reset filter
        </Button>
      ) : null}
    </div>
  );
}
