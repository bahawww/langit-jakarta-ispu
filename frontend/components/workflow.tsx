import { ScrollX } from "@/components/ui/scroll-x";

type Node = { id: string; x: number; y: number; title: string; sub: string; color?: string };

const W = 168;
const H = 72;

const NODES: Node[] = [
  { id: "csv", x: 8, y: 134, title: "Unggah CSV", sub: "Admin, maks 5 MB" },
  { id: "clean", x: 208, y: 134, title: "Bersihkan", sub: "Samakan nama stasiun, buang N/A" },
  {
    id: "pick",
    x: 408,
    y: 134,
    title: "Pilih kolom",
    sub: "6 polutan jadi fitur, kategori jadi label",
  },
  { id: "split", x: 608, y: 134, title: "Bagi 80 : 20", sub: "Stratified, seed 42" },
  {
    id: "dt",
    x: 828,
    y: 22,
    title: "Decision Tree",
    sub: "Bawaan sklearn",
    color: "var(--series-2)",
  },
  {
    id: "rf",
    x: 828,
    y: 134,
    title: "Random Forest",
    sub: "Bawaan sklearn",
    color: "var(--series-1)",
  },
  { id: "knn", x: 828, y: 246, title: "kNN", sub: "k = 5", color: "var(--text-muted)" },
  { id: "score", x: 1028, y: 134, title: "Uji data 20%", sub: "Accuracy, F1, tabel tebakan" },
  { id: "analysis", x: 1228, y: 50, title: "Analisis", sub: "Fitur penting, validasi silang" },
  { id: "champ", x: 1228, y: 218, title: "Pilih champion", sub: "Dipakai dashboard dan simulator" },
];

const EDGES: [string, string][] = [
  ["csv", "clean"],
  ["clean", "pick"],
  ["pick", "split"],
  ["split", "dt"],
  ["split", "rf"],
  ["split", "knn"],
  ["dt", "score"],
  ["rf", "score"],
  ["knn", "score"],
  ["score", "analysis"],
  ["score", "champ"],
];

const byId: Record<string, Node> = Object.fromEntries(NODES.map((n) => [n.id, n]));

function edge(a: Node, b: Node) {
  const x1 = a.x + W;
  const y1 = a.y + H / 2;
  const x2 = b.x;
  const y2 = b.y + H / 2;
  const mx = (x1 + x2) / 2;
  return `M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2 - 6} ${y2}`;
}

/** Alur dari berkas CSV sampai model terpilih; versi sendiri dari workflow Orange (CSV → Select Columns → 3 model → Test and Score). */
export function Workflow() {
  return (
    <ScrollX label="Diagram alur kerja dari CSV sampai model terpilih">
      <svg
        viewBox="0 0 1416 340"
        role="img"
        aria-label="Alur kerja: CSV diunggah, dibersihkan, dipilih kolomnya, dibagi 80 banding 20, dilatih tiga model, diuji, lalu hasilnya dianalisis dan model terbaik dipilih."
        className="block h-auto w-full min-w-[1100px]"
      >
        <defs>
          <marker
            id="wf-arrow"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M0 0 L8 4 L0 8 z" fill="var(--rule)" />
          </marker>
        </defs>
        {EDGES.map(([a, b]) => (
          <path
            key={`${a}-${b}`}
            d={edge(byId[a]!, byId[b]!)}
            fill="none"
            stroke="var(--rule)"
            strokeWidth="2"
            markerEnd="url(#wf-arrow)"
          />
        ))}
        {NODES.map((n, i) => (
          <g key={n.id} transform={`translate(${n.x} ${n.y})`}>
            <rect
              width={W}
              height={H}
              rx="12"
              fill="var(--panel)"
              stroke="var(--rule)"
              strokeWidth="1.5"
            />
            <rect width="6" height={H} rx="3" fill={n.color ?? "var(--chip)"} />
            <text x="20" y="30" fontSize="15" fontWeight="800" fill="var(--text)">
              {n.title}
            </text>
            <foreignObject x="20" y="36" width={W - 28} height={H - 38}>
              <p className="m-0 text-[12px] leading-[1.3]" style={{ color: "var(--text-muted)" }}>
                {n.sub}
              </p>
            </foreignObject>
            <title>{`${i + 1}. ${n.title}`}</title>
          </g>
        ))}
      </svg>
    </ScrollX>
  );
}
