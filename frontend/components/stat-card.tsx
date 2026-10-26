import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Kartu satu angka dengan satu kalimat "artinya apa" (prinsip: setiap angka punya penjelasan). */
export function MetricCard({
  label,
  help,
  value,
  note,
  loading,
}: {
  label: string;
  help: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="ua-card">
      <span className="ua-stat__label">{label}</span>
      <span className="ua-stat__help">{help}</span>
      {loading ? (
        <Skeleton className="h-[34px] w-28" />
      ) : (
        <span className="ua-stat__value">{value}</span>
      )}
      {note ? <span className="text-[13px] leading-5 text-ink-3">{note}</span> : null}
    </div>
  );
}

type Side = { who: string; value: string; pct: number };

/** StatCard design system: model utama (accent) dan pembanding (series-2) berdampingan + dua bar. */
export function CompareCard({
  label,
  help,
  badge,
  main,
  other,
}: {
  label: string;
  help: string;
  badge?: { text: string; title: string; tone: "success" | "warning" };
  main: Side;
  other: Side;
}) {
  return (
    <div className="ua-card">
      <div className="ua-stat__head">
        <span className="ua-stat__label">{label}</span>
        {badge ? (
          <span
            className={cn(
              "ua-badge",
              badge.tone === "success" ? "ua-badge--success" : "ua-badge--warning",
            )}
            title={badge.title}
          >
            {badge.text}
            <span className="sr-only"> ({badge.title})</span>
          </span>
        ) : null}
      </div>
      <span className="ua-stat__help">{help}</span>
      <div className="ua-stat__pair">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="ua-stat__who">
            <span className="ua-dot ua-dot--a" />
            <span className="truncate">{main.who}</span>
          </span>
          <span className="ua-stat__value">{main.value}</span>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="ua-stat__who">
            <span className="ua-dot ua-dot--b" />
            <span className="truncate">{other.who}</span>
          </span>
          <span className="ua-stat__value ua-stat__value--dim">{other.value}</span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5" aria-hidden>
        <div className="ua-bar">
          <span
            style={{
              width: `${Math.max(0, Math.min(100, main.pct))}%`,
              background: "var(--accent)",
            }}
          />
        </div>
        <div className="ua-bar">
          <span
            style={{
              width: `${Math.max(0, Math.min(100, other.pct))}%`,
              background: "var(--series-2)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
