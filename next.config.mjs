/** @type {import('next').NextConfig} */
const nextConfig = {
  // These packages must be loaded from node_modules at runtime, not bundled:
  // they locate files on disk relative to their own location.
  serverExternalPackages: ["@sparticuz/chromium", "playwright-core", "playwright"],
  // Vercel ships only the files it can trace from static require() calls.
  // Two packages read files by paths built at runtime, so they are listed
  // here in full: the compressed Chromium binary, and playwright-core, which
  // reads browsers.json when it starts (this was missing on the first deploy).
  outputFileTracingIncludes: {
    "/api/fetch": ["./node_modules/@sparticuz/chromium/bin/**", "./node_modules/playwright-core/**"],
    "/api/health": ["./node_modules/@sparticuz/chromium/bin/**", "./node_modules/playwright-core/**"],
  },
};

export default nextConfig;
