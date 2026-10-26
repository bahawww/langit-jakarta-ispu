"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

/** "2024-03-07" -> "07/03/2024" */
export function isoToDmy(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** "07/03/2024" -> "2024-03-07"; null bila bukan tanggal kalender yang valid. */
export function dmyToIso(dmy: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dmy);
  if (!m) return null;
  const [, d, mo, y] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  const iso = `${y}-${mo}-${d}`;
  return date.toISOString().slice(0, 10) === iso ? iso : null;
}

/** Ketik angka saja; garis miring disisipkan otomatis: 07032024 -> 07/03/2024. */
function mask(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join("/");
}

/**
 * Input tanggal format dd/mm/yyyy (tidak bergantung locale browser seperti <input type="date">).
 * Nilai dikirim ke parent sebagai ISO saat blur / Enter, setelah divalidasi terhadap min/max.
 */
export function DateInput({
  id,
  value,
  onChange,
  min,
  max,
  className,
}: {
  id: string;
  value: string | undefined;
  onChange: (iso: string | undefined) => void;
  min?: string;
  max?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shown = draft ?? (value ? isoToDmy(value) : "");

  const commit = () => {
    if (draft === null) return;
    if (draft === "") {
      setDraft(null);
      setError(null);
      onChange(undefined);
      return;
    }
    const iso = dmyToIso(draft);
    if (!iso) return setError("Format tanggal dd/mm/yyyy");
    if (min && iso < min) return setError(`Paling awal ${isoToDmy(min)}`);
    if (max && iso > max) return setError(`Paling akhir ${isoToDmy(max)}`);
    setDraft(null);
    setError(null);
    onChange(iso);
  };

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/yyyy"
        maxLength={10}
        value={shown}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => {
          setDraft(mask(e.target.value));
          setError(null);
        }}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        className={cn(
          "min-h-11 w-full rounded-md border bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          error ? "border-destructive" : "border-border",
          className,
        )}
      />
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="absolute top-full left-0 mt-0.5 text-xs text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
