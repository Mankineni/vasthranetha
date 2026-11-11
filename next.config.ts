import type { NextConfig } from 'next'

// Cache Components is off on purpose: every public page reads the local
// SQLite database on each request, so a new product or a "Sold" mark shows
// immediately and nothing is prerendered at build time.
const nextConfig: NextConfig = {
  cacheComponents: false,
  serverExternalPackages: ['better-sqlite3', 'sharp', '@node-rs/argon2'],
  turbopack: {
    root: __dirname,
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
}

export default nextConfig
