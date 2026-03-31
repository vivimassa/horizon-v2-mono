import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@horizon/api", "@horizon/types"],
};

export default nextConfig;
