"use client";

import { Menu, Moon, Sun, Wind, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Ringkasan" },
  { href: "/tren", label: "Tren" },
  { href: "/stasiun", label: "Per stasiun" },
  { href: "/prediksi", label: "Prediksi" },
  { href: "/evaluasi", label: "Evaluasi model" },
  { href: "/data", label: "Data" },
];

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
      variant="ghost"
      size="icon"
      aria-label={dark ? "Gunakan tema terang" : "Gunakan tema gelap"}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </Button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Menu mobile tertutup otomatis saat pindah halaman: status terikat ke pathname saat dibuka.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === pathname;

  const links = NAV.map((n) => {
    const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
    return (
      <Link
        key={n.href}
        href={n.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-11 items-center rounded-md px-3 text-sm font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          active
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        {n.label}
      </Link>
    );
  });

  return (
    <>
      <a
        href="#konten"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:ring-2 focus:ring-ring"
      >
        Lewati ke konten
      </a>
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4">
          <Link href="/" className="mr-2 flex min-h-14 items-center gap-2 font-semibold">
            <Wind aria-hidden className="size-5" />
            <span>Udara Jakarta</span>
          </Link>
          <nav aria-label="Navigasi utama" className="hidden flex-1 gap-1 lg:flex">
            {links}
          </nav>
          <div className="ml-auto flex items-center">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-expanded={open}
              aria-controls="nav-mobile"
              aria-label={open ? "Tutup menu" : "Buka menu"}
              onClick={() => setOpenFor(open ? null : pathname)}
            >
              {open ? <X aria-hidden /> : <Menu aria-hidden />}
            </Button>
          </div>
        </div>
        {open ? (
          <nav
            id="nav-mobile"
            aria-label="Navigasi utama"
            className="grid gap-1 border-t border-border p-2 lg:hidden"
          >
            {links}
          </nav>
        ) : null}
      </header>
      <main id="konten" className="mx-auto max-w-7xl px-4 py-6">
        {children}
      </main>
      <footer className="mx-auto max-w-7xl px-4 pb-8 text-xs text-muted-foreground">
        Sumber data: DLH Provinsi DKI Jakarta via Satu Data Jakarta. Nilai polutan adalah{" "}
        <strong className="font-medium">nilai indeks ISPU</strong>, bukan konsentrasi µg/m³.
      </footer>
    </>
  );
}
