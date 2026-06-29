import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { 
    unoptimized: true 
  },
  allowedDevOrigins: ["localhost:3000", "192.168.31.226:3000", "192.168.31.226"],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
