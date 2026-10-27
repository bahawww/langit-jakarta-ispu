"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { modelVar } from "@/components/analysis-charts";
import { IspuBadge } from "@/components/ispu";
import { PageHeader } from "@/components/page-header";
import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  A_MODEL_NAME,
  MODEL_KEYS,
  useAnalysis,
  type Analysis,
  type SimResult,
} from "@/lib/analysis";
import { apiPost, type ApiError } from "@/lib/api";
import { fmt } from "@/lib/format";
import { KATEGORI, KATEGORI_META, kategoriMeta, severity, type Kategori } from "@/lib/kategori";

const FEATURES = [
  "pm_duakomalima",
  "pm_sepuluh",
  "sulfur_dioksida",
  "ozon",
  "nitrogen_dioksida",
  "karbon_monoksida",
] as const;
type Values = Record<(typeof FEATURES)[number], number>;

const sliderMax = (dataMax: number) => Math.min(500, Math.ceil((dataMax * 1.5) / 10) * 10);

/** Monas kecil; kabutnya menebal sesuai tebakan (0 = cerah, 2 = pekat). */
function MonasFog({ level }: { level: number }) {
  const veil = [0, 0.32, 0.62][Math.min(2, Math.max(0, level))]!;
  return (
    <svg
      viewBox="0 0 400 150"
      role="img"
      aria-label={`Ilustrasi Monas dengan kabut ${["tipis", "sedang", "tebal"][level] ?? "tipis"}`}
      className="ua-ill"
    >
      <circle
        cx="320"
        cy="42"
        r="22"
        style={{ fill: "var(--bg)", stroke: "var(--ill-line)", strokeWidth: 1.25 }}
      />
      <g className="ua-l">
        <rect x="150" y="124" width="100" height="10" />
        <polygon points="160,124 170,106 230,106 240,124" />
        <rect x="174" y="100" width="52" height="6" />
        <polygon points="194,100 197,28 203,28 206,100" />
        <polygon points="190,28 210,28 206,22 194,22" />
      </g>
      <path
        className="ua-anim-flame"
        d="M194 22 C194 14 197 10 198.5 4 C199.7 9 201.6 10.4 201.2 2 C205 8 206.4 15 206 22 Z"
        style={{ fill: "var(--ill-flame)" }}
      />
      <line
        x1="0"
        y1="134"
        x2="400"
        y2="134"
        style={{ stroke: "var(--ill-line)", strokeWidth: 1.25 }}
      />
      <rect x="0" y="0" width="400" height="134" style={{ fill: "var(--bg)", opacity: veil }} />
      <g
        className="ua-anim-haze"
        style={{
          stroke: "var(--ill-haze)",
          strokeWidth: 1.5,
          strokeDasharray: "1 9",
          opacity: veil * 1.4 + 0.15,
        }}
      >
        {[30, 48, 66, 84, 102, 120].map((y) => (
          <line key={y} x1="-20" y1={y} x2="420" y2={y} />
        ))}
      </g>
    </svg>
  );
}

function useSettled<T>(value: T, ms = 220): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function Form({
  d,
  values,
  setValues,
}: {
  d: Analysis;
  values: Values;
  setValues: (v: Values) => void;
}) {
  const presets = (["BAIK", "SEDANG", "TIDAK SEHAT"] as const).filter((k) => d.presets[k]);
  return (
    <form
      aria-label="Data hari ini"
      className="flex min-w-0 flex-[1_1_340px] flex-col gap-[22px]"
      onSubmit={(e) => e.preventDefault()}
    >
      <div className="flex flex-col gap-2.5">
        <span className="text-sm font-bold">Mulai dari contoh hari</span>
        <div className="flex flex-wrap gap-2">
          {presets.map((k) => {
            const p = d.presets[k] as Values;
            const on = FEATURES.every((f) => p[f] === values[f]);
            return (
              <Button
                key={k}
                variant="outline"
                aria-pressed={on}
                className={on ? "!bg-sunken" : undefined}
                onClick={() => setValues({ ...p })}
              >
                Hari {kategoriMeta(k).label.toLowerCase()}
              </Button>
            );
          })}
        </div>
        <span className="text-xs text-ink-3">
          Nilai tengah (median) hari berkategori itu di data latih.
        </span>
      </div>
      {FEATURES.map((f) => {
        const max = sliderMax(d.ranges[f] ?? 100);
        return (
          <div key={f} className="ua-slider">
            <div className="ua-slider__head">
              <label htmlFor={`s-${f}`}>{d.features[f]}</label>
              <output htmlFor={`s-${f}`}>{values[f]}</output>
            </div>
            <input
              id={`s-${f}`}
              type="range"
              min={0}
              max={max}
              step={1}
              value={values[f]}
              onChange={(e) => setValues({ ...values, [f]: Number(e.target.value) })}
            />
            <span className="ua-slider__hint">Nilai tertinggi di data: {d.ranges[f]}</span>
          </div>
        );
      })}
    </form>
  );
}

function Result({ d, values }: { d: Analysis; values: Values }) {
  const settled = useSettled(values);
  const q = useQuery<SimResult, ApiError>({
    queryKey: ["/simulate", settled],
    queryFn: () => apiPost<SimResult>("/simulate", settled),
    placeholderData: keepPreviousData,
  });
  const maxVal = Math.max(...FEATURES.map((f) => values[f]));
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const r = q.data;
  if (!r) return <Skeleton className="h-80 w-full" />;
  const rf = r.models.random_forest;
  const meta = kategoriMeta(rf.label);
  const conf = rf.probabilities[rf.label] ?? 0;
  const level = Math.min(2, Math.max(0, severity(rf.label)));
  const probs = KATEGORI.filter((k) => k in rf.probabilities);
  const agree = MODEL_KEYS.every((m) => r.models[m].label === rf.label);
  return (
    <section
      aria-live="polite"
      aria-label="Hasil tebakan"
      className="flex min-w-0 flex-[999_1_520px] flex-col gap-[22px]"
    >
      <MonasFog level={level} />
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-ink-3">Tebakan Random Forest</span>
          <span className="inline-flex items-center gap-3 text-[clamp(30px,3.6vw,44px)] leading-none font-extrabold tracking-[-0.03em]">
            <span
              className="size-[22px] rounded-md"
              style={{ background: `var(${meta.token})` }}
              aria-hidden
            />
            {meta.label}
          </span>
        </div>
        <span className="text-[15px] font-bold text-ink-2">Keyakinan {fmt.pct(conf)}</span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {probs.map((k) => (
          <li
            key={k}
            className="grid grid-cols-[132px_minmax(0,1fr)_52px] items-center gap-3.5 text-sm"
          >
            <span
              className="inline-flex items-center gap-2"
              style={{ fontWeight: k === rf.label ? 800 : 500 }}
            >
              <span
                className="size-[9px] rounded-[2px]"
                style={{ background: `var(${KATEGORI_META[k as Kategori].token})` }}
                aria-hidden
              />
              {KATEGORI_META[k as Kategori].label}
            </span>
            <span className="ua-bar" style={{ height: 12 }} aria-hidden>
              <span
                style={{
                  width: `${(rf.probabilities[k] ?? 0) * 100}%`,
                  background: `var(${KATEGORI_META[k as Kategori].token})`,
                }}
              />
            </span>
            <span className="text-right font-bold">{fmt.pct(rf.probabilities[k] ?? 0)}</span>
          </li>
        ))}
      </ul>
      <div className="ua-table-wrap">
        <table className="ua-table">
          <caption>Tebakan tiap model dasar</caption>
          <thead>
            <tr>
              <th scope="col">Model</th>
              <th scope="col" className="ua-left">
                Tebakan
              </th>
              <th scope="col">Keyakinan</th>
            </tr>
          </thead>
          <tbody>
            {MODEL_KEYS.map((m) => {
              const x = r.models[m];
              return (
                <tr key={m}>
                  <th scope="row">
                    <span
                      className="ua-dot mr-2 align-middle"
                      style={{ background: modelVar[m] }}
                      aria-hidden
                    />
                    {A_MODEL_NAME[m]}
                  </th>
                  <td className="ua-left">
                    <IspuBadge value={x.label} />
                  </td>
                  <td>{fmt.pct(x.probabilities[x.label] ?? 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="m-0 max-w-[64ch] text-[15px] leading-[1.55] text-ink-2">
        {agree
          ? "Ketiga model sepakat. "
          : "Model tidak sepakat; hasil seperti ini biasanya dekat batas kategori. "}
        Nilai tertinggi hari ini {maxVal}, jadi menurut ambang resmi ISPU kategorinya{" "}
        <b className="font-extrabold text-ink">{kategoriMeta(r.ispu_category).label}</b>. Model
        tidak membaca ambang itu; ia belajar dari {fmt.int(d.n_train)} hari data latih.
      </p>
    </section>
  );
}

export function SimulatorView() {
  const q = useAnalysis();
  const [values, setValues] = useState<Values | null>(null);
  const d = q.data;
  const current: Values | null = values ?? (d?.presets.SEDANG as Values | undefined) ?? null;
  return (
    <>
      <PageHeader
        title="Coba tebak kategori udara"
        description="Geser nilai enam polutan dan lihat bagaimana tebakan model berubah. Langit di gambar ikut berkabut sesuai hasilnya."
        meta={null}
      />
      {q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !d || !current ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className="flex flex-wrap items-start gap-x-14 gap-y-10">
          <Form d={d} values={current} setValues={setValues} />
          <Result d={d} values={current} />
        </div>
      )}
      <p className="m-0 max-w-[64ch] text-sm text-ink-3">
        Model hanya melihat enam nilai indeks polutan pada hari yang sama. Bulan dan stasiun tidak
        dipakai. Nilai adalah indeks ISPU, bukan µg/m³.
      </p>
    </>
  );
}
