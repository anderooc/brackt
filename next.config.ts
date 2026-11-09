import type { NextConfig } from "next";

const supabaseOrigin = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
      : "";
  } catch {
    return "";
  }
})();

const supabaseRealtimeOrigin = supabaseOrigin.replace(/^http/, "ws");

/** Vercel injects a live feedback toolbar on preview deployments. */
const isVercelPreview = process.env.VERCEL_ENV === "preview";
const vercelLiveScriptSrc = isVercelPreview ? " https://vercel.live" : "";
const vercelLiveConnectSrc = isVercelPreview
  ? " https://vercel.live wss://vercel.live"
  : "";
const vercelLiveFrameSrc = isVercelPreview ? " https://vercel.live" : "";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}${vercelLiveScriptSrc}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data: ${supabaseOrigin}`.trim(),
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseRealtimeOrigin}${vercelLiveConnectSrc}`.trim(),
  `frame-src https://www.google.com https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com${vercelLiveFrameSrc}`,
  "media-src 'self' blob: https:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(process.env.NODE_ENV === "production"
    ? ["upgrade-insecure-requests"]
    : []),
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
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      {
        source: "/my-schedule",
        destination: "/dashboard#your-schedule",
        permanent: true,
      },
      { source: "/schedule", destination: "/dashboard", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
