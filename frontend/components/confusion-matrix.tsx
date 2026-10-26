import { fmt } from "@/lib/format";
import { kategoriStyle } from "@/lib/kategori";

/** Confusion matrix sebagai tabel (angka selalu tampil; intensitas warna hanya pelengkap). */
export function ConfusionMatrix({
  labels,
  matrix,
  caption,
}: {
  labels: string[];
  matrix: number[][];
  caption: string;
}) {
  const max = Math.max(1, ...matrix.flat());
  return (
    <div className="overflow-x-auto">
      <table className="text-sm">
        <caption className="mb-2 text-left text-xs text-muted-foreground">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="p-2 text-left text-xs font-medium text-muted-foreground">
              Aktual \ Prediksi
            </th>
            {labels.map((l) => (
              <th key={l} scope="col" className="p-2 text-xs font-medium">
                {kategoriStyle(l).label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={labels[i]}>
              <th scope="row" className="p-2 text-left text-xs font-medium">
                {kategoriStyle(labels[i]!).label}
              </th>
              {row.map((v, j) => (
                <td
                  key={j}
                  className={`min-w-16 border border-border p-2 text-center ${i === j ? "font-semibold" : ""}`}
                  style={{
                    background: `color-mix(in srgb, var(--ring) ${Math.round((v / max) * 45)}%, transparent)`,
                  }}
                >
                  {fmt.int(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
