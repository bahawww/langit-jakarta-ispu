import { kategoriStyle } from "@/lib/kategori";
import { cn } from "@/lib/utils";

/** Warna selalu disertai teks kategori (tidak hanya warna). */
export function KategoriBadge({ value, className }: { value: string; className?: string }) {
  const s = kategoriStyle(value);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        className,
      )}
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}
