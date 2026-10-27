"use client";

import { PageHeader } from "@/components/page-header";
import { StasiunView } from "@/app/stasiun/view";
import { TrenView } from "@/app/tren/view";
import { DataView } from "@/app/data/view";
import { useFilters } from "@/lib/filters";

const TABS = [
  { id: "tren", label: "Tren" },
  { id: "stasiun", label: "Per stasiun" },
  { id: "tabel", label: "Tabel" },
] as const;
type Tab = (typeof TABS)[number]["id"];
const isTab = (v: string | null): v is Tab => TABS.some((t) => t.id === v);

/** Satu halaman Data: tiga cara melihat dataset yang sama (tren waktu, perbandingan stasiun, tabel baris). */
export function DataHub() {
  const { searchParams, setParams } = useFilters();
  const raw = searchParams.get("tab");
  const tab: Tab = isTab(raw) ? raw : "tren";
  return (
    <>
      <PageHeader
        title="Data pengukuran"
        description="Dataset yang dipakai melatih dan menguji model: bagaimana indeks naik turun, stasiun mana yang berbeda, dan setiap barisnya."
      />
      <div className="flex flex-col gap-8">
        <div className="ua-tabs" role="group" aria-label="Cara melihat data">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={t.id === tab}
              onClick={() =>
                setParams({ tab: t.id === "tren" ? undefined : t.id, page: undefined })
              }
            >
              {t.label}
            </button>
          ))}
        </div>
        <div key={tab} className="ua-swap flex flex-col gap-[72px]">
          {tab === "tren" ? <TrenView /> : tab === "stasiun" ? <StasiunView /> : <DataView />}
        </div>
      </div>
    </>
  );
}
