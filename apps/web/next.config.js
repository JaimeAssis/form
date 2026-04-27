const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@consorte/types'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'pub-*.r2.dev' },
    ],
  },
}

module.exports = withSentryConfig(nextConfig, {
  silent: true,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
})
