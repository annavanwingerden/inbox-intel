import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // Exclude only the supabase/functions directory from webpack compilation
    config.module.rules.push({
      test: /supabase\/functions/,
      loader: 'ignore-loader',
    });
    
    return config;
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
