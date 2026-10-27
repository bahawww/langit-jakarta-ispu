import type { StationStats } from "@/lib/api";
import { fmt } from "@/lib/format";
import { KATEGORI_META, kategoriOf } from "@/lib/kategori";
import { shortStation } from "@/lib/labels";

/** Posisi perkiraan tiap stasiun pada peta sederhana (viewBox 400 × 320) dan letak labelnya. */
const POS: Record<string, { x: number; y: number; lx: number; ly: number; anchor?: "middle" }> = {
  DKI1: { x: 190, y: 140, lx: 202, ly: 134 },
  DKI2: { x: 282, y: 100, lx: 294, ly: 96 },
  DKI3: { x: 212, y: 252, lx: 224, ly: 256 },
  DKI4: { x: 302, y: 186, lx: 296, ly: 210, anchor: "middle" },
  DKI5: { x: 96, y: 152, lx: 96, ly: 178, anchor: "middle" },
};

/**
 * Peta DKI Jakarta yang disederhanakan dengan lima stasiun SPKU. Warna titik = kategori dari indeks
 * rata-rata (`avg_max`) pada filter terpilih; nama kategori selalu ada di tabel di sebelahnya.
 */
export function StationMap({ stations }: { stations: StationStats[] }) {
  const known = stations.filter((s) => POS[s.code]);
  const top = known.length ? known.reduce((a, b) => (b.avg_max > a.avg_max ? b : a)) : null;
  const aria = top
    ? `Peta sederhana DKI Jakarta dengan ${known.length} stasiun SPKU. ${shortStation(top.name)} punya indeks rata-rata tertinggi, ${fmt.num(top.avg_max)} (${KATEGORI_META[kategoriOf(top.avg_max)].label}).`
    : "Peta sederhana DKI Jakarta dengan stasiun SPKU.";
  return (
    <svg viewBox="0 0 400 320" role="img" aria-label={aria} className="ua-ill">
      <g
        className="ua-haze-lines"
        style={{ stroke: "var(--ill-haze)", strokeWidth: 1.5, strokeDasharray: "8 4" }}
      >
        <line x1="-20" y1="14" x2="420" y2="14" />
        <line x1="-20" y1="26" x2="420" y2="26" />
        <line x1="-20" y1="38" x2="420" y2="38" />
      </g>
      <text
        x="200"
        y="10"
        textAnchor="middle"
        fontSize="11"
        fontWeight="600"
        style={{ fill: "var(--text-muted)" }}
      >
        Teluk Jakarta
      </text>
      <polygon
        points="30,72 70,56 110,63 150,46 190,59 230,42 270,53 320,46 370,62 380,96 360,130 366,170 340,200 300,215 266,250 240,286 200,292 186,252 160,216 120,201 80,191 50,161 40,121"
        style={{
          fill: "var(--panel)",
          stroke: "var(--ill-line)",
          strokeWidth: 1.5,
          strokeLinejoin: "round",
        }}
      />
      <path
        d="M60 150 C120 140 150 120 190 140 C230 160 280 130 350 150"
        style={{ fill: "none", stroke: "var(--ill-haze)", strokeWidth: 1.5 }}
      />
      <path
        d="M200 70 C196 120 210 180 205 285"
        style={{ fill: "none", stroke: "var(--ill-haze)", strokeWidth: 1.5 }}
      />
      <g fontSize="12" fontWeight="700" style={{ fill: "var(--text)" }}>
        {known.map((s, i) => {
          const p = POS[s.code]!;
          const color = `var(${KATEGORI_META[kategoriOf(s.avg_max)].token})`;
          return (
            <g key={s.code}>
              <circle
                className="ua-anim-pulse"
                cx={p.x}
                cy={p.y}
                r="7"
                fill="none"
                strokeWidth="1.5"
                style={{ stroke: color, animationDelay: `${i * 0.4}s` }}
              />
              <circle
                cx={p.x}
                cy={p.y}
                r="7"
                strokeWidth="2"
                style={{ fill: color, stroke: "var(--panel)" }}
              />
              <text
                x={p.lx}
                y={p.ly}
                textAnchor={p.anchor}
                style={{ paintOrder: "stroke", stroke: "var(--panel)", strokeWidth: 3.5 }}
              >
                {shortStation(s.name)}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
