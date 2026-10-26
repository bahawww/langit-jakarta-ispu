"use client";

import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Field, Select } from "@/components/ui/field";
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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
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
        <div className="flex min-w-0 flex-col gap-1 lg:w-72">
          <span id="f-date-label" className="text-xs font-medium text-muted-foreground">
            Tanggal
          </span>
          <DateRangePicker
            id="f-date"
            labelledBy="f-date-label"
            value={{ start: filters.start, end: filters.end }}
            onChange={(v) => setParams({ start: v.start, end: v.end })}
            min={m?.date_min ?? undefined}
            max={m?.date_max ?? undefined}
            years={m?.years}
          />
        </div>
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
