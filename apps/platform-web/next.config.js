/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['*.vercel.app', 'afrixplore.com'],
    },
  },
}

module.exports = nextConfig
