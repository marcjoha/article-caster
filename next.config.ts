import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: [
    '@google-cloud/firestore',
    '@google-cloud/storage',
    '@google-cloud/tasks'
  ],
};

export default nextConfig;
