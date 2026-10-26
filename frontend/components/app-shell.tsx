"use client";

import { Menu, Moon, Sun, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { useApi, type Meta } from "@/lib/api";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Hasil model" },
  { href: "/tren", label: "Tren" },
  { href: "/stasiun", label: "Per stasiun" },
  { href: "/evaluasi", label: "Evaluasi" },
  { href: "/data", label: "Data" },
  { href: "/admin", label: "Admin" },
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

function LogoMark() {
  return (
    <span className="flex size-[38px] items-center justify-center rounded-md bg-brand text-on-brand">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 8h11a3 3 0 1 0-3-3" />
        <path d="M3 12h16a3 3 0 1 1-3 3" />
        <path d="M3 16h7" />
      </svg>
    </span>
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
      <Link
        key={n.href}
        href={n.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-11 items-center rounded-[10px] px-3.5 text-sm font-semibold no-underline transition-colors duration-200",
          active ? "bg-sunken text-ink" : "text-ink-3 hover:text-ink",
        )}
      >
        {n.label}
      </Link>
    );
  });

  return (
    <>
      <a href="#konten" className="ua-skip">
        Lewati ke konten
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-surface">
        <div className={cn("mx-auto flex max-w-[1280px] items-center gap-3 py-3", PAD)}>
          <Link href="/" className="mr-auto flex items-center gap-3 no-underline">
            <LogoMark />
            <span className="flex flex-col">
              <span className="text-base leading-5 font-extrabold tracking-[-0.01em] text-ink">
                Udara Jakarta
              </span>
              <span className="text-xs leading-4 font-medium text-ink-3">Dashboard model ISPU</span>
            </span>
          </Link>
          <nav aria-label="Navigasi utama" className="hidden items-center gap-1 lg:flex">
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
            className={cn("grid gap-1 border-t border-line pb-3 pt-2 lg:hidden", PAD)}
          >
            {links}
          </nav>
        ) : null}
      </header>
      <main
        id="konten"
        className={cn("mx-auto flex max-w-[1280px] flex-col gap-6 pt-8 pb-16", PAD)}
      >
        {children}
      </main>
      <footer className={cn("mx-auto max-w-[1280px] pb-10", PAD)}>
        <div className="flex flex-col gap-1.5 border-t border-line pt-[18px] text-[13px] leading-[1.55] text-ink-3">
          <span>
            <strong className="font-bold text-ink-2">Sumber data:</strong> DLH Provinsi DKI Jakarta
            via Satu Data Jakarta. Nilai polutan adalah{" "}
            <strong className="font-semibold">nilai indeks ISPU</strong>, bukan konsentrasi µg/m³.
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
      </footer>
    </>
  );
}
