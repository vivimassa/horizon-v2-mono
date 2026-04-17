import type { NextConfig } from 'next'
import createMDX from '@next/mdx'

const nextConfig: NextConfig = {
  transpilePackages: ['@skyhub/api', '@skyhub/types', '@skyhub/constants', '@skyhub/ui', '@skyhub/logic'],
  pageExtensions: ['ts', 'tsx'],
}

const withMDX = createMDX({})

export default withMDX(nextConfig)
