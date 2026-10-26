import { Skeleton } from "@/components/ui/skeleton";

export function Kpi({
  label,
  value,
  hint,
  loading,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-24" />
      ) : (
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      )}
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
