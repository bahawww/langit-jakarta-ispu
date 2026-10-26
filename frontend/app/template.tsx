/** Halaman baru masuk dengan gerak pegas (design system: PageTransition). Template dibuat ulang tiap
 *  pindah rute, jadi kelas `ua-enter` berjalan sekali per halaman. Mati di mode kurangi gerakan. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="ua-enter flex flex-col gap-[72px]">{children}</div>;
}
