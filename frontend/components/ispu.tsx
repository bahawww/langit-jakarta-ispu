import { Skeleton } from "@/components/ui/skeleton";
import { fmt } from "@/lib/format";
import { KATEGORI, KATEGORI_META, kategoriMeta } from "@/lib/kategori";
import { cn } from "@/lib/utils";

/** Nama kategori + titik warna. Warna saja tidak cukup, jadi nama selalu ditulis. */
export function IspuBadge({ value, className }: { value: string; className?: string }) {
  const m = kategoriMeta(value);
  return <span className={cn("ua-badge", m.badge, className)}>{m.label}</span>;
}

export function IspuSwatch({ token }: { token: string }) {
  return <span className="ua-swatch" style={{ background: `var(${token})` }} aria-hidden />;
}

/** Skala ISPU lengkap dengan rentang; satu kartu yang dipakai bersama di beberapa halaman. */
export function IspuScaleCard() {
  return (
    <section className="ua-card" aria-labelledby="h-skala">
      <div>
        <h2 id="h-skala" className="ua-card__title">
          Skala ISPU
        </h2>
        <p className="ua-card__sub">
          Rentang menurut Permen LHK No. 14/2020 · warna perlu diverifikasi
        </p>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {KATEGORI.map((k) => (
          <li
            key={k}
            className="grid grid-cols-[14px_minmax(0,1fr)_auto] items-center gap-2.5 text-sm"
          >
            <IspuSwatch token={KATEGORI_META[k].token} />
            <span className="font-semibold">{KATEGORI_META[k].label}</span>
            <span className="font-medium text-ink-3">{KATEGORI_META[k].range}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Bar tersegmen jumlah hari per kategori + legenda (nama, jumlah, persen). */
export function DistributionBar({ counts }: { counts: Record<string, number> }) {
  const present = KATEGORI.filter((k) => (counts[k] ?? 0) > 0);
  const total = present.reduce((a, k) => a + (counts[k] ?? 0), 0);
  const absent = KATEGORI.filter((k) => !counts[k]).map((k) => KATEGORI_META[k].label);
  if (total === 0) return <Skeleton className="h-3 w-full" />;
  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex h-3 gap-[3px] overflow-hidden rounded-full"
        role="img"
        aria-label={`Komposisi kategori: ${present
          .map((k) => `${KATEGORI_META[k].label} ${fmt.pct((counts[k] ?? 0) / total)}`)
          .join(", ")}`}
      >
        {present.map((k) => (
          <div
            key={k}
            style={{
              width: `${((counts[k] ?? 0) / total) * 100}%`,
              background: `var(${KATEGORI_META[k].token})`,
            }}
          />
        ))}
      </div>
      <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-2 p-0 text-[13px] font-semibold">
        {present.map((k) => (
          <li key={k} className="inline-flex items-center gap-2">
            <IspuSwatch token={KATEGORI_META[k].token} />
            {KATEGORI_META[k].label}
            <span className="font-medium text-ink-3">
              {fmt.int(counts[k])} · {fmt.pct((counts[k] ?? 0) / total)}
            </span>
          </li>
        ))}
        {absent.length ? (
          <li className="font-medium text-ink-3">{absent.join(" & ")} tidak muncul</li>
        ) : null}
      </ul>
    </div>
  );
}

/** Legenda warna kategori (untuk kalender dan bar bertumpuk). */
export function IspuLegend({ only }: { only?: string[] }) {
  const items = KATEGORI.filter((k) => !only || only.includes(k));
  return (
    <ul className="ua-legend m-0 list-none p-0" aria-label="Legenda kategori ISPU">
      {items.map((k) => (
        <li key={k} className="inline-flex items-center gap-2">
          <IspuSwatch token={KATEGORI_META[k].token} />
          {KATEGORI_META[k].label}
        </li>
      ))}
    </ul>
  );
}
