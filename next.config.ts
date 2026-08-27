import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable React strict mode for better development-time warnings
  reactStrictMode: true,
  // Standalone output for Docker/production deployment
  output: "standalone",
};

export default nextConfig;
