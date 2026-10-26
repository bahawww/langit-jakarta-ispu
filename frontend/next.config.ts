import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Produksi: Caddy meneruskan /api ke FastAPI. Saat `next dev`, set API_PROXY agar /api diteruskan.
  async rewrites() {
    return process.env.API_PROXY
      ? [{ source: "/api/:path*", destination: `${process.env.API_PROXY}/api/:path*` }]
      : [];
  },
};

export default config;
