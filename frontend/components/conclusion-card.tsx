export type Insight = { big: string; text: string };

/**
 * "Kesimpulan singkat": jawaban dulu, dalam bahasa sederhana, sebelum grafik teknis. Ditulis sebagai
 * paragraf (angka penting digarisbawahi), bukan deretan kartu angka.
 */
export function ConclusionCard({ chip, insights }: { chip?: string; insights: Insight[] | null }) {
  return (
    <section aria-labelledby="h-kesimpulan" className="flex flex-col gap-4">
      <h2 id="h-kesimpulan" className="ua-card__title">
        Kesimpulan singkat
        {chip ? <span className="ml-3 text-[15px] font-semibold text-ink-3">{chip}</span> : null}
      </h2>
      {insights ? (
        <p className="ua-lead">
          {insights.map((i) => (
            <span key={i.big + i.text}>
              <b>{i.big}</b> {i.text}{" "}
            </span>
          ))}
        </p>
      ) : (
        <div className="flex animate-pulse flex-col gap-2 motion-reduce:animate-none" aria-hidden>
          <span className="h-6 w-full max-w-xl rounded-md bg-sunken" />
          <span className="h-6 w-2/3 rounded-md bg-sunken" />
        </div>
      )}
    </section>
  );
}
