import type { NextConfig } from "next";

/**
 * Security headers.
 *
 * Applied to every response via `headers()`. The CSP is pragmatic: it locks
 * down framing/object/base-uri and scopes network access to our own origin +
 * the two external runtime services the browser actually talks to (Supabase
 * auth/realtime and Liveblocks rooms). `'unsafe-inline'` is kept on script/style
 * because Next's streamed RSC payloads, next/font, Framer Motion and CodeMirror
 * all emit inline styles/scripts; we do not set a nonce, so inline is required.
 * `'unsafe-eval'` is dev-only (React Refresh / HMR) and dropped in production.
 */
const isProd = process.env.NODE_ENV === "production";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseOrigin = (() => {
  try {
    return supabaseUrl ? new URL(supabaseUrl).origin : "";
  } catch {
    return "";
  }
})();

const connectSrc = [
  "'self'",
  supabaseOrigin,
  "https://*.supabase.co",
  "wss://*.supabase.co",
  "https://*.liveblocks.io",
  "wss://*.liveblocks.io",
]
  .filter(Boolean)
  .join(" ");

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "worker-src 'self' blob:",
  `connect-src ${connectSrc}`,
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
