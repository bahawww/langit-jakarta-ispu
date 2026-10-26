import { AlertTriangle, Inbox, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ApiError } from "@/lib/api";

export function ErrorState({ error, onRetry }: { error: ApiError | Error; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-[14px] bg-surface p-4 text-warn"
    >
      <div className="flex items-center gap-2 font-medium">
        <AlertTriangle aria-hidden className="size-4" />
        Gagal memuat data
      </div>
      <p className="text-sm">{error.message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw aria-hidden /> Coba lagi
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border p-8 text-center">
      <Inbox aria-hidden className="size-6 text-muted-foreground" />
      <p className="font-medium">{title}</p>
      {children ? <div className="text-sm text-muted-foreground">{children}</div> : null}
    </div>
  );
}

export function ChartSkeleton({ height = 320 }: { height?: number }) {
  return (
    <div role="status" aria-label="Memuat grafik" style={{ height }}>
      <Skeleton className="h-full w-full" />
    </div>
  );
}

type QueryLike<T> = {
  data: T | undefined;
  error: ApiError | null;
  isPending: boolean;
  refetch: () => unknown;
};

/** Tampilkan skeleton / error / empty / konten secara konsisten untuk satu query. */
export function QueryView<T>({
  query,
  skeleton,
  isEmpty,
  empty,
  children,
}: {
  query: QueryLike<T>;
  skeleton: React.ReactNode;
  isEmpty?: (d: T) => boolean;
  empty?: React.ReactNode;
  children: (d: T) => React.ReactNode;
}) {
  if (query.isPending) return <>{skeleton}</>;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (query.data === undefined) return null;
  if (isEmpty?.(query.data))
    return <>{empty ?? <EmptyState title="Tidak ada data untuk filter ini" />}</>;
  return <>{children(query.data)}</>;
}
