import type { NextConfig } from 'next'
import { devOriginCandidates } from './src/lib/network'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: devOriginCandidates(),
}

export default nextConfig
