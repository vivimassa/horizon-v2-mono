import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // All @skyhub/* source-style workspace packages must be listed here so Next's
  // bundler runs them through its own TS pipeline. Critical for packages with
  // "type": "module" + .js extensions in relative imports (NodeNext style),
  // because Next's raw resolver does not map `./foo.js` -> `./foo.ts` on its
  // own in external packages.
  transpilePackages: ['@skyhub/api', '@skyhub/types', '@skyhub/constants', '@skyhub/ui', '@skyhub/logic'],
}

export default nextConfig
