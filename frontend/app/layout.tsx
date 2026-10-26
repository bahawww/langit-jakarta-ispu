import type { Metadata, Viewport } from "next";
import { Fira_Sans } from "next/font/google";

import { AppShell } from "@/components/app-shell";

import "./globals.css";
import { Providers } from "./providers";

const fira = Fira_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-fira-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Kualitas Udara Jakarta", template: "%s · Kualitas Udara Jakarta" },
  description:
    "Monitoring dan prediksi kualitas udara (ISPU) dari 5 stasiun SPKU DKI Jakarta. Sumber data: DLH DKI Jakarta via Satu Data Jakarta.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning className={fira.variable}>
      <body className="min-h-dvh font-sans antialiased">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
