import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
  // ── Google Drive fix ──────────────────────────────────────────────
  // Google Drive's sync engine touches file timestamps continuously, which
  // triggers Webpack's file watcher → Fast Refresh → React remount → state
  // loss (async calls like streamChat() lose their result). On a network-
  // synced drive we DISABLE hot-reload watching entirely — changes require a
  // manual server restart. This is a dev-only workaround; production builds
  // are unaffected.
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ignored: ['**/node_modules/**', '**/.next/**', '**/.git/**'],
        // Aggressive stability: require 10s of NO file changes before rebuilding.
        // Google Drive touches files every few seconds; this filters that out.
        aggregateTimeout: 10000,
        poll: 30000, // check at most every 30s
      };
    }
    return config;
  },
};

export default nextConfig;
