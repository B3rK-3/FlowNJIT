import type { NextConfig } from "next";

const backendURL = process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:3001";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/getcourses",
        destination: `${backendURL}/getcourses`,
      },
      {
        source: "/getprofs",
        destination: `${backendURL}/getprofs`,
      },
      {
        source: "/chat",
        destination: `${backendURL}/chat`,
      },
    ];
  },
};

export default nextConfig;
