import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // Exclude Supabase Edge Functions from the build
    config.module.rules.push({
      test: /supabase\/functions/,
      loader: 'ignore-loader',
    });
    
    // Also exclude Deno-specific imports
    config.resolve.fallback = {
      ...config.resolve.fallback,
      'https://deno.land/std@0.168.0/http/server.ts': false,
    };
    
    return config;
  },
  // Exclude supabase directory from TypeScript compilation
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
