/** Wadah tabel/grafik lebar yang bisa digulir horizontal; fokusable agar bisa digulir dengan keyboard (WCAG). */
export function ScrollX({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="overflow-x-auto rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {children}
    </div>
  );
}
