/* Ilustrasi design system Udara Jakarta (dibuat dari komponen Skyline dan OndelOndel).
   Dekoratif: seluruh gerak berhenti di mode kurangi gerakan (bundle.css). */

/** Garis kota Jakarta yang hidup, untuk pembuka halaman utama. Hanya satu per halaman. */
export function Skyline() {
  return (
    <svg
      viewBox="0 0 1200 300"
      preserveAspectRatio="xMidYMax meet"
      role="img"
      aria-label="Ilustrasi kota Jakarta: Gereja Katedral, Monas, Masjid Istiqlal, gedung-gedung Thamrin dan Sudirman, Tugu Selamat Datang di Bundaran HI, bus dan bajaj melintas, diselimuti kabut tipis"
      className="ua-ill ua-skyline"
    >
      <g
        className="ua-anim-haze"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeDasharray="1 9"
        style={{ stroke: "var(--ill-haze)" }}
      >
        <line x1={-20} y1={60} x2={1220} y2={60} />
        <line x1={-20} y1={74} x2={1220} y2={74} />
        <line x1={-20} y1={88} x2={1220} y2={88} />
        <line x1={-20} y1={102} x2={1220} y2={102} />
        <line x1={-20} y1={116} x2={1220} y2={116} />
        <line x1={-20} y1={130} x2={1220} y2={130} />
        <line x1={-20} y1={144} x2={1220} y2={144} />
        <line x1={-20} y1={158} x2={1220} y2={158} />
        <line x1={-20} y1={172} x2={1220} y2={172} />
        <line x1={-20} y1={186} x2={1220} y2={186} />
        <line x1={-20} y1={200} x2={1220} y2={200} />
        <line x1={-20} y1={214} x2={1220} y2={214} />
      </g>
      <g
        className="ua-anim-cloud"
        strokeWidth={1.25}
        strokeLinejoin="round"
        style={{ fill: "var(--bg)", stroke: "var(--ill-line)" }}
      >
        <path d="M120 58 h86 a14 14 0 0 0 -10 -24 a20 20 0 0 0 -36 -8 a16 16 0 0 0 -28 12 a10 10 0 0 0 -12 20 z" />
      </g>
      <g
        className="ua-anim-cloud-slow"
        strokeWidth={1.25}
        strokeLinejoin="round"
        style={{ fill: "var(--bg)", stroke: "var(--ill-line)" }}
      >
        <path d="M760 40 h64 a11 11 0 0 0 -8 -18 a15 15 0 0 0 -27 -6 a12 12 0 0 0 -21 9 a8 8 0 0 0 -8 15 z" />
      </g>
      <g
        className="ua-anim-birds"
        fill="none"
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ stroke: "var(--ill-line)" }}
      >
        <path d="M440 70 q5 -5 10 0 q5 -5 10 0" />
        <path d="M466 58 q4 -4 8 0 q4 -4 8 0" />
        <path d="M486 76 q3 -3 6 0 q3 -3 6 0" />
      </g>
      <circle
        cx={1000}
        cy={104}
        r={42}
        strokeWidth={1.25}
        style={{ fill: "var(--bg)", stroke: "var(--ill-line)" }}
      />
      <g
        strokeWidth={1.25}
        strokeLinejoin="round"
        style={{ fill: "var(--bg)", stroke: "var(--ill-line)" }}
      >
        <rect x={18} y={182} width={56} height={60} />
        <rect x={80} y={152} width={44} height={90} />
        <rect x={138} y={190} width={60} height={52} />
        <polygon points="140,190 149,146 158,190" />
        <polygon points="178,190 187,146 196,190" />
        <polygon points="164,190 168,168 172,190" />
        <rect x={200} y={230} width={140} height={12} />
        <polygon points="212,230 224,210 316,210 328,230" />
        <rect x={228} y={203} width={84} height={7} />
        <polygon points="262,203 266,72 274,72 278,203" />
        <polygon points="258,72 282,72 278,63 262,63" />
        <rect x={352} y={212} width={92} height={30} />
        <path d="M362 212 A36 32 0 0 1 434 212 Z" />
        <rect x={452} y={128} width={10} height={114} />
        <polygon points="450,128 464,128 457,112" />
        <rect x={476} y={112} width={44} height={130} />
        <rect x={482} y={102} width={32} height={10} />
        <rect x={526} y={142} width={38} height={100} />
        <rect x={570} y={72} width={52} height={170} />
        <polygon points="574,72 596,46 618,72" />
        <rect x={628} y={126} width={44} height={116} />
        <polygon points="678,98 712,86 712,242 678,242" />
        <rect x={718} y={152} width={60} height={90} />
        <rect x={784} y={120} width={40} height={122} />
        <rect x={830} y={166} width={52} height={76} />
        <rect x={890} y={190} width={38} height={52} />
        <rect x={934} y={208} width={70} height={34} />
        <rect x={1072} y={194} width={50} height={48} />
        <rect x={1128} y={172} width={60} height={70} />
        <rect x={1026} y={230} width={28} height={12} />
        <rect x={1036} y={156} width={8} height={74} />
      </g>
      <g strokeWidth={1} opacity={0.55} style={{ stroke: "var(--ill-line)" }}>
        <line x1={584} y1={90} x2={584} y2={236} />
        <line x1={596} y1={90} x2={596} y2={236} />
        <line x1={608} y1={90} x2={608} y2={236} />
        <line x1={490} y1={126} x2={506} y2={126} />
        <line x1={490} y1={146} x2={506} y2={146} />
        <line x1={490} y1={166} x2={506} y2={166} />
        <line x1={490} y1={186} x2={506} y2={186} />
        <line x1={490} y1={206} x2={506} y2={206} />
        <line x1={792} y1={136} x2={816} y2={136} />
        <line x1={792} y1={156} x2={816} y2={156} />
        <line x1={792} y1={176} x2={816} y2={176} />
        <line x1={792} y1={196} x2={816} y2={196} />
      </g>
      <path
        className="ua-anim-flame"
        d="M262 63 C262 52 266 47 268 39 C269.5 45 272 47 271.5 36 C276.5 44 278.5 53 278 63 Z"
        style={{ fill: "var(--ill-flame)" }}
      />
      <g strokeWidth={1.25} strokeLinecap="round" fill="none" style={{ stroke: "var(--ill-line)" }}>
        <line x1={596} y1={46} x2={596} y2={22} />
        <line x1={398} y1={180} x2={398} y2={170} />
        <line x1={1036} y1={150} x2={1029} y2={130} />
        <line x1={1044} y1={150} x2={1051} y2={130} />
      </g>
      <circle cx={398} cy={167} r={3} style={{ fill: "var(--ill-flame)" }} />
      <g strokeWidth={1.25} style={{ fill: "var(--bg)", stroke: "var(--ill-line)" }}>
        <circle cx={1036} cy={150} r={5} />
        <circle cx={1044} cy={150} r={5} />
      </g>
      <line
        x1={0}
        y1={242}
        x2={1200}
        y2={242}
        strokeWidth={1.25}
        style={{ stroke: "var(--ill-line)" }}
      />
      <line x1={0} y1={292} x2={1200} y2={292} strokeWidth={1} style={{ stroke: "var(--rule)" }} />
      <line
        x1={0}
        y1={267}
        x2={1200}
        y2={267}
        strokeWidth={1.5}
        strokeDasharray="18 14"
        style={{ stroke: "var(--rule)" }}
      />
      <g className="ua-anim-bus">
        <rect
          x={0}
          y={244}
          width={104}
          height={22}
          rx={4}
          strokeWidth={1.25}
          style={{ fill: "var(--bg)", stroke: "var(--ill-line)" }}
        />
        <rect x={0} y={257} width={104} height={3} style={{ fill: "var(--series-1)" }} />
        <g fill="none" strokeWidth={1} style={{ stroke: "var(--ill-line)" }}>
          <rect x={8} y={248} width={14} height={7} rx={1} />
          <rect x={26} y={248} width={14} height={7} rx={1} />
          <rect x={44} y={248} width={14} height={7} rx={1} />
          <rect x={62} y={248} width={14} height={7} rx={1} />
          <rect x={82} y={248} width={16} height={7} rx={1} />
        </g>
        <circle cx={22} cy={266} r={4.5} style={{ fill: "var(--ill-line)" }} />
        <circle cx={84} cy={266} r={4.5} style={{ fill: "var(--ill-line)" }} />
      </g>
      <g className="ua-anim-bajaj">
        <path
          d="M0 286 v-12 a10 10 0 0 1 10 -10 h14 a8 8 0 0 1 8 8 v14 z"
          strokeWidth={1.25}
          strokeLinejoin="round"
          style={{ fill: "var(--series-2)", stroke: "var(--ill-line)" }}
        />
        <rect
          x={12}
          y={268}
          width={10}
          height={7}
          rx={1}
          strokeWidth={1}
          style={{ fill: "var(--bg)", stroke: "var(--ill-line)" }}
        />
        <circle cx={6} cy={287} r={3.5} style={{ fill: "var(--ill-line)" }} />
        <circle cx={27} cy={287} r={3.5} style={{ fill: "var(--ill-line)" }} />
      </g>
      <g
        fontFamily="'Plus Jakarta Sans', sans-serif"
        fontSize={12}
        fontWeight={600}
        style={{ fill: "var(--text-muted)" }}
      >
        <line
          x1={286}
          y1={40}
          x2={318}
          y2={40}
          strokeWidth={1}
          style={{ stroke: "var(--text-muted)" }}
        />
        <text x={324} y={44}>
          Monas
        </text>
        <circle
          className="ua-anim-pulse"
          cx={1040}
          cy={242}
          r={10}
          fill="none"
          strokeWidth={1.5}
          style={{ stroke: "var(--series-1)" }}
        />
        <circle
          cx={1040}
          cy={242}
          r={4.5}
          strokeWidth={2}
          style={{ fill: "var(--series-1)", stroke: "var(--bg)" }}
        />
        <line
          x1={1040}
          y1={122}
          x2={1040}
          y2={102}
          strokeWidth={1}
          style={{ stroke: "var(--text-muted)" }}
        />
        <text x={1040} y={94} textAnchor="middle">
          SPKU Bundaran HI
        </text>
      </g>
    </svg>
  );
}

/** Sepasang ondel-ondel yang bergoyang pelan, untuk footer. */
export function OndelOndel() {
  return (
    <svg
      className="ua-ill"
      style={{ width: 132 }}
      width={132}
      height={128}
      viewBox="0 0 132 128"
      role="img"
      aria-label="Sepasang ondel-ondel Betawi"
    >
      <g className="ua-anim-sway">
        <g className="ua-stroke">
          <line x1={36} y1={20} x2={26} y2={4} />
          <line x1={36} y1={20} x2={36} y2={2} />
          <line x1={36} y1={20} x2={46} y2={4} />
          <line x1={36} y1={20} x2={20} y2={12} />
          <line x1={36} y1={20} x2={52} y2={12} />
        </g>
        <g className="ua-gold">
          <circle cx={26} cy={4} r={2.5} />
          <circle cx={36} cy={2} r={2.5} />
          <circle cx={46} cy={4} r={2.5} />
          <circle cx={20} cy={12} r={2.5} />
          <circle cx={52} cy={12} r={2.5} />
        </g>
        <circle
          cx={36}
          cy={34}
          r={15}
          style={{ fill: "var(--series-2)", stroke: "var(--ill-line)", strokeWidth: "1.25" }}
        />
        <path
          d="M30 32 h3 M39 32 h3 M31 40 q5 3 10 0"
          style={{ stroke: "var(--bg)", strokeWidth: "1.5", strokeLinecap: "round", fill: "none" }}
        />
        <path className="ua-l" d="M24 52 L12 124 L60 124 L48 52 Z" />
        <path
          d="M20 78 H52 M17 96 H55 M14 112 H58"
          style={{ stroke: "var(--series-1)", strokeWidth: "1.5" }}
        />
      </g>
      <g className="ua-anim-sway-late">
        <g className="ua-stroke">
          <line x1={96} y1={20} x2={86} y2={4} />
          <line x1={96} y1={20} x2={96} y2={2} />
          <line x1={96} y1={20} x2={106} y2={4} />
          <line x1={96} y1={20} x2={80} y2={12} />
          <line x1={96} y1={20} x2={112} y2={12} />
        </g>
        <g className="ua-gold">
          <circle cx={86} cy={4} r={2.5} />
          <circle cx={96} cy={2} r={2.5} />
          <circle cx={106} cy={4} r={2.5} />
          <circle cx={80} cy={12} r={2.5} />
          <circle cx={112} cy={12} r={2.5} />
        </g>
        <circle
          cx={96}
          cy={34}
          r={15}
          style={{ fill: "var(--panel)", stroke: "var(--ill-line)", strokeWidth: "1.25" }}
        />
        <path
          d="M90 32 h3 M99 32 h3 M92 40 q4 2 8 0"
          className="ua-stroke"
          style={{ strokeWidth: "1.5" }}
        />
        <path className="ua-l" d="M84 52 L72 124 L120 124 L108 52 Z" />
        <path
          d="M80 78 H112 M77 96 H115 M74 112 H118"
          style={{ stroke: "var(--series-2)", strokeWidth: "1.5" }}
        />
      </g>
      <line x1={0} y1={124.5} x2={132} y2={124.5} className="ua-stroke" />
    </svg>
  );
}
