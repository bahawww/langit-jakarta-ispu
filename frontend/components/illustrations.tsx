"use client";

import { useEffect, useState } from "react";

/* Ilustrasi design system Udara Jakarta (dari komponen Skyline). Dekoratif: seluruh gerak berhenti
   di mode kurangi gerakan (bundle.css).

   Disesuaikan agar ringan di perangkat menengah:
   - bus dan kereta jadi svg kecil sendiri yang digeser lewat transform (tanpa menggambar ulang kota);
   - tepi yang memudar memakai dua lapisan gradasi, bukan svg <mask> (mask membuat seluruh gambar
     dirender ulang tiap frame);
   - awan, burung, dan kabut bergerak per piksel (steps) sehingga jarang digambar ulang;
   - semua gerak dijeda saat gambar keluar layar. */

/** Garis kota Jakarta yang hidup, untuk pembuka halaman utama. Hanya satu per halaman. */
export function Skyline() {
  const [box, setBox] = useState<HTMLElement | null>(null);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (!box) return;
    const io = new IntersectionObserver(([e]) => setPaused(!e!.isIntersecting), {
      rootMargin: "80px",
    });
    io.observe(box);
    return () => io.disconnect();
  }, [box]);
  return (
    <figure ref={setBox} className="ua-skyline m-0 pt-2" data-paused={paused}>
      <div className="ua-skyline__stage">
        <svg
          viewBox="0 0 1200 344"
          preserveAspectRatio="xMidYMax meet"
          role="img"
          aria-label="Ilustrasi kota Jakarta: Gereja Katedral, Monas, Masjid Istiqlal, gedung-gedung Thamrin dan Sudirman, Tugu Selamat Datang di Bundaran HI, bus melintas, kereta MRT di jalur layang, diselimuti kabut tipis"
          className="ua-ill"
        >
          <g>
            <circle cx={1000} cy={112} r={46} style={{ fill: "var(--ill-sun)" }} />
            <g
              className="ua-anim-haze"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeDasharray="1 11"
              style={{ stroke: "var(--ill-haze)" }}
            >
              <line x1={-24} y1={72} x2={1224} y2={72} />
              <line x1={-24} y1={94} x2={1224} y2={94} />
              <line x1={-24} y1={116} x2={1224} y2={116} />
              <line x1={-24} y1={138} x2={1224} y2={138} />
              <line x1={-24} y1={160} x2={1224} y2={160} />
              <line x1={-24} y1={182} x2={1224} y2={182} />
            </g>
            <g
              className="ua-anim-cloud"
              strokeWidth={1.25}
              strokeLinejoin="round"
              style={{ fill: "var(--bg)", stroke: "var(--ill-haze)" }}
            >
              <path d="M120 58 h86 a14 14 0 0 0 -10 -24 a20 20 0 0 0 -36 -8 a16 16 0 0 0 -28 12 a10 10 0 0 0 -12 20 z" />
            </g>
            <g
              className="ua-anim-cloud-slow"
              strokeWidth={1.25}
              strokeLinejoin="round"
              style={{ fill: "var(--bg)", stroke: "var(--ill-haze)" }}
            >
              <path d="M760 40 h64 a11 11 0 0 0 -8 -18 a15 15 0 0 0 -27 -6 a12 12 0 0 0 -21 9 a8 8 0 0 0 -8 15 z" />
            </g>
            <g
              className="ua-anim-birds"
              fill="none"
              strokeWidth={1.1}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.7}
              style={{ stroke: "var(--ill-line)" }}
            >
              <path d="M440 70 q5 -5 10 0 q5 -5 10 0" />
              <path d="M468 60 q4 -4 8 0 q4 -4 8 0" />
            </g>
            <g style={{ fill: "var(--ill-far)" }}>
              <rect x={0} y={196} width={40} height={46} />
              <rect x={44} y={170} width={30} height={72} />
              <rect x={118} y={178} width={26} height={64} />
              <rect x={330} y={186} width={34} height={56} />
              <rect x={420} y={150} width={40} height={92} />
              <rect x={540} y={118} width={30} height={124} />
              <rect x={640} y={104} width={36} height={138} />
              <rect x={700} y={132} width={24} height={110} />
              <rect x={760} y={96} width={34} height={146} />
              <rect x={852} y={140} width={40} height={102} />
              <rect x={920} y={168} width={30} height={74} />
              <rect x={1056} y={160} width={28} height={82} />
              <rect x={1100} y={146} width={34} height={96} />
              <rect x={1160} y={182} width={40} height={60} />
            </g>
            <g
              strokeWidth={1.1}
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
            <g strokeWidth={1} opacity={0.35} style={{ stroke: "var(--ill-line)" }}>
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
            <g
              strokeWidth={1.1}
              strokeLinecap="round"
              fill="none"
              style={{ stroke: "var(--ill-line)" }}
            >
              <line x1={596} y1={46} x2={596} y2={22} />
              <line x1={398} y1={180} x2={398} y2={170} />
              <line x1={1036} y1={150} x2={1029} y2={130} />
              <line x1={1044} y1={150} x2={1051} y2={130} />
            </g>
            <circle cx={398} cy={167} r={3} style={{ fill: "var(--ill-flame)" }} />
            <g strokeWidth={1.1} style={{ fill: "var(--bg)", stroke: "var(--ill-line)" }}>
              <circle cx={1036} cy={150} r={5} />
              <circle cx={1044} cy={150} r={5} />
            </g>
            <line
              x1={0}
              y1={242}
              x2={1200}
              y2={242}
              strokeWidth={1.1}
              style={{ stroke: "var(--ill-line)" }}
            />
            <line
              x1={0}
              y1={280}
              x2={1200}
              y2={280}
              strokeWidth={1}
              style={{ stroke: "var(--ill-haze)" }}
            />
            <line
              x1={0}
              y1={274}
              x2={1200}
              y2={274}
              strokeWidth={1.5}
              strokeDasharray="18 16"
              style={{ stroke: "var(--ill-haze)" }}
            />

            <g
              strokeWidth={1.1}
              strokeLinejoin="round"
              style={{ fill: "var(--bg)", stroke: "var(--ill-line)" }}
            >
              <rect x={-2} y={310} width={1204} height={7} />
              <polygon points="96,317 104,317 106,342 94,342" />
              <polygon points="396,317 404,317 406,342 394,342" />
              <polygon points="696,317 704,317 706,342 694,342" />
              <polygon points="996,317 1004,317 1006,342 994,342" />
            </g>
            <line
              x1={0}
              y1={342}
              x2={1200}
              y2={342}
              strokeWidth={1}
              style={{ stroke: "var(--ill-haze)" }}
            />
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
          </g>
        </svg>
        {/* Bus dan kereta: svg kecil sendiri yang digeser lewat transform (jalur compositor), supaya
            gambar kota tidak digambar ulang tiap frame. */}
        <svg
          className="ua-skyline__vehicle ua-bus-layer"
          viewBox="-1 242 106 30"
          aria-hidden="true"
        >
          <rect
            x={0}
            y={244}
            width={104}
            height={22}
            rx={5}
            strokeWidth={1.1}
            style={{ fill: "var(--bg)", stroke: "var(--ill-line)" }}
          />
          <rect
            x={0}
            y={257}
            width={104}
            height={3}
            opacity={0.85}
            style={{ fill: "var(--series-1)" }}
          />
          <g fill="none" strokeWidth={0.9} opacity={0.8} style={{ stroke: "var(--ill-line)" }}>
            <rect x={8} y={248} width={14} height={7} rx={1.5} />
            <rect x={26} y={248} width={14} height={7} rx={1.5} />
            <rect x={44} y={248} width={14} height={7} rx={1.5} />
            <rect x={62} y={248} width={14} height={7} rx={1.5} />
            <rect x={82} y={248} width={16} height={7} rx={1.5} />
          </g>
          <circle cx={22} cy={266} r={4.5} style={{ fill: "var(--ill-line)" }} />
          <circle cx={84} cy={266} r={4.5} style={{ fill: "var(--ill-line)" }} />
        </svg>
        <svg
          className="ua-skyline__vehicle ua-train-layer"
          viewBox="-1 287 164 24"
          aria-hidden="true"
        >
          <g
            strokeWidth={1.1}
            strokeLinejoin="round"
            style={{ fill: "var(--bg)", stroke: "var(--ill-line)" }}
          >
            <path d="M52 288 H18 Q0 288 0 306 V310 H52 Z" />
            <rect x={55} y={288} width={52} height={22} rx={5} />
            <path d="M110 288 H144 Q162 288 162 306 V310 H110 Z" />
          </g>
          <g opacity={0.85} style={{ fill: "var(--series-1)" }}>
            <rect x={1} y={302} width={51} height={3} />
            <rect x={55} y={302} width={52} height={3} />
            <rect x={110} y={302} width={51} height={3} />
          </g>
          <g fill="none" strokeWidth={0.9} opacity={0.8} style={{ stroke: "var(--ill-line)" }}>
            <path d="M13 292 H10 Q5 292 4 299 H13 Z" />
            <rect x={18} y={292} width={12} height={7} rx={1.5} />
            <rect x={34} y={292} width={12} height={7} rx={1.5} />
            <rect x={61} y={292} width={12} height={7} rx={1.5} />
            <rect x={77} y={292} width={12} height={7} rx={1.5} />
            <rect x={93} y={292} width={9} height={7} rx={1.5} />
            <rect x={116} y={292} width={12} height={7} rx={1.5} />
            <rect x={132} y={292} width={12} height={7} rx={1.5} />
            <path d="M149 292 H152 Q157 292 158 299 H149 Z" />
          </g>
        </svg>
        <span className="ua-skyline__fade ua-skyline__fade--l" aria-hidden />
        <span className="ua-skyline__fade ua-skyline__fade--r" aria-hidden />
      </div>
    </figure>
  );
}
