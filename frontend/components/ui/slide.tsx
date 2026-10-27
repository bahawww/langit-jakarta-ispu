"use client";

import { useLayoutEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Pembungkus tab atau menu dengan garis bawah yang meluncur ke item aktif (gerak pegas design system).
 * Item aktif dikenali dari `aria-pressed="true"` (tab) atau `aria-current="page"` (menu). Posisinya
 * diukur dan dipasang sebagai variabel CSS (`--bar-x/-y/-w`); animasinya di app/ua-extras.css.
 * Tanpa item aktif (mis. halaman Admin) garisnya memudar.
 */
export function Slide({
  as = "div",
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: "div" | "nav" }) {
  const [box, setBox] = useState<HTMLElement | null>(null);
  const [ready, setReady] = useState(false);

  // Diukur ulang tiap render (item aktif berganti) dan saat ukuran atau font berubah.
  useLayoutEffect(() => {
    if (!box) return;
    const measure = () => {
      const el = box.querySelector<HTMLElement>('[aria-pressed="true"], [aria-current="page"]');
      if (!el) return void box.style.setProperty("--bar-o", "0");
      box.style.setProperty("--bar-x", `${el.offsetLeft}px`);
      box.style.setProperty("--bar-y", `${el.offsetTop + el.offsetHeight}px`);
      box.style.setProperty("--bar-w", `${el.offsetWidth}px`);
      box.style.setProperty("--bar-o", "1");
    };
    measure();
    // Transisi baru dinyalakan setelah ukuran pertama terpasang, supaya garis tidak meluncur dari kiri-atas.
    const raf = requestAnimationFrame(() => setReady(true));
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    void document.fonts?.ready.then(measure);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  });

  const Tag = as as "div";
  return (
    <Tag ref={setBox} className={cn("ua-slide", ready && "is-ready", className)} {...props}>
      {children}
      <span className="ua-slide__bar" aria-hidden />
    </Tag>
  );
}
