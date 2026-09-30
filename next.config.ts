import type { NextConfig } from "next";

const securityHeaders = [
  // No framing by other sites (clickjacking protection for account actions)
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Other sites see only our origin, never full paths like /join?invite=…
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Geolocation powers "near me"; nothing else needs device features
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "yvealococcwnvuvkfveu.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
