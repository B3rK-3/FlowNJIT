import type { NextConfig } from "next";

const backendURL = process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:3001";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${backendURL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
