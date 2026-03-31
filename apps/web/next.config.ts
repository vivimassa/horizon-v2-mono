import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@skyhub/api", "@skyhub/types"],
};

export default nextConfig;
