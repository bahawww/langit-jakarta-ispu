import { IspuSwatch } from "@/components/ispu";
import { ScrollX } from "@/components/ui/scroll-x";
import { fmt } from "@/lib/format";
import { isKategori, kategoriMeta } from "@/lib/kategori";

/**
 * Confusion matrix sebagai tabel sungguhan (angka selalu tampil, warna hanya penegas).
 * `color` = warna model (var(--series-1) atau var(--series-2)); kategori ISPU hanya muncul sebagai titik di header.
 */
export function ConfusionMatrix({
  labels,
  matrix,
  color,
  name,
}: {
  labels: string[];
  matrix: number[][];
  color: string;
  name: string;
}) {
  return (
    <ScrollX label={`Confusion matrix ${name}, geser ke samping jika layar sempit`}>
      <table className="ua-cm min-w-[340px]" style={{ ["--cm" as string]: color }}>
        <caption className="sr-only">
          Confusion matrix {name}. Baris adalah kategori aktual, kolom adalah kategori prediksi.
        </caption>
        <thead>
          <tr>
            <th className="ua-cm__corner" scope="col">
              Baris: aktual
              <br />
              Kolom: prediksi
            </th>
            {labels.map((l) => (
              <th key={l} scope="col">
                <span className="inline-flex items-center justify-center gap-1.5">
                  {isKategori(l) ? <IspuSwatch token={kategoriMeta(l).token} /> : null}
                  {kategoriMeta(l).label}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={labels[i]}>
              <th scope="row">{kategoriMeta(labels[i]!).label}</th>
              {row.map((v, j) => (
                <td
                  key={j}
                  className={i === j ? "is-diag" : v === 0 ? "is-zero" : undefined}
                  title={`Aktual ${kategoriMeta(labels[i]!).label}, diprediksi ${kategoriMeta(labels[j]!).label}: ${fmt.int(v)}`}
                >
                  {fmt.int(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollX>
  );
}

/** Precision, recall, F1 per kelas, dihitung dari confusion matrix. */
export function classStats(matrix: number[][], labels: string[]) {
  return labels.map((label, i) => {
    const tp = matrix[i]![i]!;
    const col = matrix.reduce((s, r) => s + r[i]!, 0);
    const row = matrix[i]!.reduce((a, b) => a + b, 0);
    const p = col ? tp / col : 0;
    const r = row ? tp / row : 0;
    return { label, p, r, f: p + r ? (2 * p * r) / (p + r) : 0, n: row };
  });
}
