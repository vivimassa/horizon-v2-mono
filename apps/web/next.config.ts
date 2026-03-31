import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@skyhub/api", "@skyhub/types", "@skyhub/constants"],
};

export default nextConfig;
