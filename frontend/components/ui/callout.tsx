/** Catatan singkat (maks. 2 kalimat) yang menjelaskan arti grafik atau tabel di atasnya. */
export function Callout({
  label = "Artinya:",
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="ua-callout">
      <strong>{label}</strong> {children}
    </div>
  );
}
