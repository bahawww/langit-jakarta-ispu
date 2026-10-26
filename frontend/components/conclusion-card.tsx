export type Insight = { big: string; text: string };

/** Kartu "Kesimpulan singkat": jawaban dulu, dalam bahasa sederhana, sebelum grafik teknis. */
export function ConclusionCard({ chip, insights }: { chip?: string; insights: Insight[] | null }) {
  return (
    <section aria-labelledby="h-kesimpulan" className="ua-hero">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="h-kesimpulan" className="ua-hero__label m-0">
          Kesimpulan singkat
        </h2>
        {chip ? <span className="ua-hero__chip">{chip}</span> : null}
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-[18px]">
        {insights
          ? insights.map((i) => (
              <div key={i.big + i.text} className="flex flex-col gap-1.5">
                <span className="ua-hero__big">{i.big}</span>
                <span className="ua-hero__text">{i.text}</span>
              </div>
            ))
          : [0, 1, 2].map((n) => (
              <div
                key={n}
                className="flex animate-pulse flex-col gap-2 motion-reduce:animate-none"
                aria-hidden
              >
                <span className="h-8 w-32 rounded-md bg-white/15" />
                <span className="h-10 w-full rounded-md bg-white/10" />
              </div>
            ))}
      </div>
    </section>
  );
}
