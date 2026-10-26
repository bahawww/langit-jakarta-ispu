"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

/** Filter global disimpan di URL (bisa dibagikan / deep link): ?station=DKI1&start=..&end=.. */
export type Filters = { station?: string; start?: string; end?: string; year?: string };

export function useFilters() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters: Filters = useMemo(
    () => ({
      station: sp.get("station") ?? undefined,
      start: sp.get("start") ?? undefined,
      end: sp.get("end") ?? undefined,
      year: sp.get("year") ?? undefined,
    }),
    [sp],
  );

  const setParams = useCallback(
    (values: Record<string, string | undefined>) => {
      const next = new URLSearchParams(sp.toString());
      for (const [key, value] of Object.entries(values)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      const q = next.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [sp, router, pathname],
  );
  const setParam = useCallback(
    (key: string, value: string | undefined) => setParams({ [key]: value }),
    [setParams],
  );

  return { filters, setParam, setParams, searchParams: sp };
}
