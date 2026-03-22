import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/.well-known/:path*',
        headers: [
          { key: 'Content-Type', value: 'application/octet-stream' },
        ],
      },
    ];
  },
};

export default nextConfig;
