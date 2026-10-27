"use client";

import { Menu, Moon, Sun, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useState, useSyncExternalStore } from "react";

import { OndelOndel } from "@/components/illustrations";
import { Button } from "@/components/ui/button";
import { useApi, type Meta } from "@/lib/api";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Ringkasan" },
  { href: "/data", label: "Data" },
  { href: "/evaluasi", label: "Evaluasi" },
  { href: "/kesalahan", label: "Kesalahan" },
  { href: "/penjelasan", label: "Penjelasan" },
  { href: "/simulator", label: "Simulator" },
];

const PAD = "px-[clamp(16px,4vw,48px)]";

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // true hanya di browser setelah hidrasi; mencegah ikon tema salah saat SSR
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const dark = mounted && resolvedTheme === "dark";
  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={dark ? "Ganti ke mode terang" : "Ganti ke mode gelap"}
      title={dark ? "Ganti ke mode terang" : "Ganti ke mode gelap"}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? (
        <Sun aria-hidden className="size-[18px]" />
      ) : (
        <Moon aria-hidden className="size-[18px]" />
      )}
    </Button>
  );
}

/** Tugu Monas dengan api emas (logo design system). */
function LogoMark() {
  return (
    <svg width="22" height="28" viewBox="0 0 22 28" aria-hidden="true">
      <path
        d="M8 13 C8 9 10 8 11 5 C11.5 7 13 8 12.6 4 C14.6 7 14.5 10 14 13 Z"
        fill="var(--ill-flame)"
      />
      <path
        d="M8.5 13h5l-.6 1.5h-3.8z M9.6 14.5h2.8l.8 9.5H8.8z M5 24h12l2 3H3z"
        fill="var(--text)"
      />
    </svg>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Menu mobile tertutup otomatis saat pindah halaman: status terikat ke pathname saat dibuka.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === pathname;
  const meta = useApi<Meta>("/meta");

  const links = NAV.map((n) => {
    const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
    return (
      <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined}>
        {n.label}
      </Link>
    );
  });

  return (
    <>
      <a href="#konten" className="ua-skip">
        Lewati ke konten
      </a>
      <header>
        <div className="ua-nav-bar">
          <Link href="/" className="ua-brand mr-auto">
            <LogoMark />
            Udara Jakarta
          </Link>
          <nav aria-label="Navigasi utama" className="ua-nav hidden lg:flex">
            {links}
          </nav>
          <ThemeToggle />
          <Button
            variant="outline"
            size="icon"
            className="lg:hidden"
            aria-expanded={open}
            aria-controls="nav-mobile"
            aria-label={open ? "Tutup menu" : "Buka menu"}
            onClick={() => setOpenFor(open ? null : pathname)}
          >
            {open ? (
              <X aria-hidden className="size-[18px]" />
            ) : (
              <Menu aria-hidden className="size-[18px]" />
            )}
          </Button>
        </div>
        {open ? (
          <nav
            id="nav-mobile"
            aria-label="Navigasi utama"
            className={cn("ua-nav mx-auto grid max-w-[1240px] gap-0 pb-3 lg:hidden", PAD)}
          >
            {links}
          </nav>
        ) : null}
      </header>
      <main
        id="konten"
        className={cn("mx-auto flex max-w-[1240px] flex-col gap-[72px] pt-6 pb-[72px]", PAD)}
      >
        {children}
      </main>
      <footer className={cn("mx-auto max-w-[1240px] pb-10", PAD)}>
        <div className="ua-footer flex flex-wrap items-end gap-x-12 gap-y-4 pt-6 text-[14px] leading-[1.6] text-ink-3">
          <OndelOndel />
          <div className="flex min-w-0 max-w-[64ch] flex-1 flex-col gap-1.5">
            <span>
              <strong className="font-bold text-ink-2">Sumber data:</strong> DLH Provinsi DKI
              Jakarta via Satu Data Jakarta. Nilai polutan adalah{" "}
              <strong className="font-semibold">nilai indeks ISPU</strong>, bukan konsentrasi µg/m³.
            </span>
            <span>
              <Link href="/admin" className="font-semibold text-ink-2">
                Masuk sebagai pengelola
              </Link>
            </span>
            {meta.data ? (
              <span>
                Stasiun pemantau:{" "}
                {meta.data.stations
                  .map((s) => s.name.replace(/^DKI\d+\s*-?\s*/, "").replace(/\s*\(.*\)$/, ""))
                  .join(", ")}
                .
              </span>
            ) : null}
          </div>
        </div>
      </footer>
    </>
  );
}
