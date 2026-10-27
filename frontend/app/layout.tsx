import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";

import { AppShell } from "@/components/app-shell";

import "./globals.css";
import { Providers } from "./providers";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Langit Jakarta", template: "%s · Langit Jakarta" },
  description:
    "Monitoring kualitas udara (ISPU) dan hasil pelatihan model klasifikasi dari 5 stasiun SPKU DKI Jakarta. Sumber data: DLH DKI Jakarta via Satu Data Jakarta.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F3F5F7" },
    { media: "(prefers-color-scheme: dark)", color: "#10141C" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning className={jakarta.variable}>
      <body className="min-h-dvh">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
