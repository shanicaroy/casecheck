/** @type {import('next').NextConfig} */
const nextConfig = {
  // These packages must be loaded from node_modules at runtime, not bundled:
  // they locate a Chromium binary on disk relative to their own files.
  serverExternalPackages: ["@sparticuz/chromium", "playwright-core", "playwright"],
  // Make sure the compressed Chromium binary ships with the fetch function on Vercel.
  outputFileTracingIncludes: {
    "/api/fetch": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
};

export default nextConfig;
