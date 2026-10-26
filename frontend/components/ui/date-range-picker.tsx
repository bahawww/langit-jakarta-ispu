"use client";

import { type DateRange, DayPicker } from "@daypicker/react";
import "@daypicker/react/style.css";
import { addDays, differenceInCalendarDays } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { CalendarDays, X } from "lucide-react";
import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DateRangeValue = { start?: string; end?: string };

const pad = (n: number) => String(n).padStart(2, "0");
// Tanggal kalender dibuat dari komponen lokal; toISOString() akan menggeser sehari di WIB.
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d);
};
const dmy = (iso: string) => iso.split("-").reverse().join("/");

type Preset = { label: string } & DateRangeValue;

/**
 * Pemilih rentang tanggal: tombol → dialog berisi preset cepat + kalender.
 * Dialog memakai <dialog> bawaan browser (fokus terkunci, Esc menutup, backdrop). Di layar kecil tampil
 * sebagai bottom sheet. `min`/`max` (ISO) membatasi pilihan ke rentang data yang tersedia.
 */
export function DateRangePicker({
  id,
  labelledBy,
  value,
  onChange,
  min,
  max,
  years = [],
}: {
  id: string;
  labelledBy: string;
  value: DateRangeValue;
  onChange: (v: DateRangeValue) => void;
  min?: string;
  max?: string;
  years?: number[];
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>();
  const ready = Boolean(min && max);

  const open = () => {
    const from = value.start ?? (value.end ? min : undefined);
    const to = value.end ?? (value.start ? max : undefined);
    setDraft(from ? { from: fromIso(from), to: to ? fromIso(to) : undefined } : undefined);
    setIsOpen(true);
    dialog.current?.showModal();
  };
  // Dua klik: klik pertama selalu memulai rentang baru (bukan memendekkan rentang lama), klik kedua
  // menutupnya; klik kedua sebelum tanggal awal menukar urutan. `to` kosong = sedang memilih.
  const pick = (day: Date) =>
    setDraft((d) =>
      d?.from && !d.to
        ? day < d.from
          ? { from: day, to: d.from }
          : { from: d.from, to: day }
        : { from: day, to: undefined },
    );
  const close = () => dialog.current?.close();
  const commit = (r: DateRangeValue) => {
    onChange(r);
    close();
  };

  const clamp = (iso: string) => (min && iso < min ? min : max && iso > max ? max : iso);
  const presets: Preset[] =
    min && max
      ? [
          ...[7, 30, 90].map((n) => ({
            label: `${n} hari terakhir`,
            start: clamp(toIso(addDays(fromIso(max), -(n - 1)))),
            end: max,
          })),
          ...years.map((y) => ({
            label: `Tahun ${y}`,
            start: clamp(`${y}-01-01`),
            end: clamp(`${y}-12-31`),
          })),
          { label: "Semua data" },
        ]
      : [];

  const draftStart = draft?.from ? toIso(draft.from) : undefined;
  const draftEnd = draft?.from ? toIso(draft.to ?? draft.from) : undefined;
  const days = draft?.from ? differenceInCalendarDays(draft.to ?? draft.from, draft.from) + 1 : 0;

  const label =
    value.start && value.end
      ? `${dmy(value.start)} – ${dmy(value.end)}`
      : value.start
        ? `Mulai ${dmy(value.start)}`
        : value.end
          ? `Sampai ${dmy(value.end)}`
          : "Semua tanggal";

  return (
    <>
      <Button
        id={id}
        type="button"
        variant="outline"
        disabled={!ready}
        aria-haspopup="dialog"
        aria-labelledby={`${labelledBy} ${id}`}
        onClick={open}
        className="w-full justify-start px-3 font-normal"
      >
        <CalendarDays aria-hidden />
        <span className="truncate">{label}</span>
      </Button>

      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onClose={() => setIsOpen(false)}
        onClick={(e) => e.target === e.currentTarget && close()}
        className="m-auto max-h-[92dvh] w-[min(94vw,26rem)] overflow-auto rounded-xl border border-border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-black/50 max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none"
      >
        {isOpen ? (
          <div className="grid gap-4 p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 id={titleId} className="text-base font-semibold">
                Pilih rentang tanggal
              </h2>
              <Button type="button" variant="ghost" size="icon" aria-label="Tutup" onClick={close}>
                <X aria-hidden />
              </Button>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Pilihan cepat</p>
              <div className="flex flex-wrap gap-2">
                {presets.map((p) => {
                  const active = p.start === draftStart && p.end === draftEnd;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      aria-pressed={active}
                      onClick={() => commit({ start: p.start, end: p.end })}
                      className={cn(
                        "min-h-11 cursor-pointer rounded-full border px-4 text-sm transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card hover:bg-muted",
                      )}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
              {max ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  “Terakhir” dihitung dari data terakhir yang tersedia ({dmy(max)}), bukan dari hari
                  ini.
                </p>
              ) : null}
            </div>

            <div className="flex justify-center">
              <DayPicker
                mode="range"
                locale={localeId}
                weekStartsOn={1}
                selected={draft}
                onSelect={(_, day) => pick(day)}
                defaultMonth={draft?.from ?? (max ? fromIso(max) : undefined)}
                startMonth={min ? fromIso(min) : undefined}
                endMonth={max ? fromIso(max) : undefined}
                disabled={
                  min && max ? [{ before: fromIso(min) }, { after: fromIso(max) }] : undefined
                }
                captionLayout="dropdown"
                labels={{
                  labelNav: () => "Navigasi kalender",
                  labelPrevious: () => "Bulan sebelumnya",
                  labelNext: () => "Bulan berikutnya",
                  labelMonthDropdown: () => "Pilih bulan",
                  labelYearDropdown: () => "Pilih tahun",
                }}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
              <p className="text-sm" aria-live="polite">
                {draft?.from ? (
                  <>
                    <strong>
                      {dmy(draftStart!)} – {dmy(draftEnd!)}
                    </strong>{" "}
                    · {days} hari
                  </>
                ) : (
                  <span className="text-muted-foreground">
                    Pilih tanggal awal lalu tanggal akhir
                  </span>
                )}
              </p>
              <Button
                type="button"
                className="max-sm:w-full"
                disabled={!draft?.from}
                onClick={() => commit({ start: draftStart, end: draftEnd })}
              >
                Terapkan
              </Button>
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
