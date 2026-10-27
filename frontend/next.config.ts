import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Produksi: Caddy meneruskan /api ke FastAPI. Saat `next dev`, set API_PROXY agar /api diteruskan.
  // Tren dan Per stasiun sekarang tab di halaman Data; tautan lama tetap jalan.
  async redirects() {
    return [
      { source: "/tren", destination: "/data", permanent: false },
      { source: "/stasiun", destination: "/data?tab=stasiun", permanent: false },
    ];
  },
  async rewrites() {
    return process.env.API_PROXY
      ? [{ source: "/api/:path*", destination: `${process.env.API_PROXY}/api/:path*` }]
      : [];
  },
};

export default config;
