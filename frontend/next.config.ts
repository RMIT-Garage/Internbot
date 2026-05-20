import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { NextConfig } from 'next'

const configDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(configDir, '..')

const nextConfig: NextConfig = {
  // Static HTML export — output written to `frontend/out/`. Deployed to
  // Firebase Hosting; no Node runtime. Security headers live in firebase.json
  // (there is no server to set them here).
  // output: 'export',
  trailingSlash: true,
  images: {
    // `next/image` Optimization requires a server. Static export must opt out.
    unoptimized: true,
  },
  outputFileTracingRoot: repoRoot,
  turbopack: {
    root: repoRoot,
  },
}

export default nextConfig
