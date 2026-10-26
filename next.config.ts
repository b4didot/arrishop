import type { NextConfig } from "next";

const config: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  images: { unoptimized: process.env.NODE_ENV !== "production" && process.env.ARRIE_UI_FIXTURE === "1", remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }] },
};
export default config;
