import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";
import { securityHeaders } from "./lib/securityHeaders";

const nextConfig: NextConfig = {
  transpilePackages: ["@delegolabs/ui", "@delegolabs/sdk", "@delegolabs/types"],
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.stellar.org" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  webpack(config) {
    config.resolve = config.resolve || {};
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
      ".cjs": [".cts", ".cjs"],
    };
    return config;
  },
};

const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/**
 * Source maps are uploaded during `next build` when `SENTRY_AUTH_TOKEN` is
 * set (CI only — see .github/workflows/ci.yml); local dev builds skip the
 * upload silently. Events are tagged with the release set via
 * NEXT_PUBLIC_SENTRY_RELEASE (the git SHA, injected by CI).
 */
export default withSentryConfig(withNextIntl(withAnalyzer(nextConfig)), {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  disableLogger: true,
  automaticVercelMonitors: false,
});
