import type { NextConfig } from "next";

// The browser only ever talks to this Next.js app: /api/* is forwarded to the
// Express backend, so the login cookies belong to this origin and proxy.ts can
// read them on page requests. (Set BACKEND_URL before `next build`.)
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:5000";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }];
  },
};

export default nextConfig;
