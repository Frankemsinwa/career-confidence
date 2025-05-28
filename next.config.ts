import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Required for Geist font if not using the `app` directory with its specific handling.
  // However, with app dir and direct imports like `geist/font/sans`, this might not be strictly needed.
  // Keeping it for broader compatibility or if pages dir is used.
  experimental: {
    fontLoaders: [
      { loader: 'next/font/google', options: { subsets: ['latin'] } }, // Example, Geist is self-hosted
    ],
  },
};

export default nextConfig;
