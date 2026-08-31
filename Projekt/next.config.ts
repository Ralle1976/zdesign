import type { NextConfig } from "next";

// G: is a FAT32 Google-Drive-synced volume — Next's many small build writes
// get corrupted/locked by the sync engine (EINVAL, partial writes, no junction
// support for Turbopack). ZDESIGN_DIST_DIR redirects the build output to a
// local NTFS drive; default stays ".next" so deploy scripts are unaffected.
const nextConfig: NextConfig = {
  output: "standalone",
  distDir: process.env.ZDESIGN_DIST_DIR || ".next",
  /* config options here */
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
};

export default nextConfig;
