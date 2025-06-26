import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // Exclude only the supabase/functions directory from webpack compilation
    config.module.rules.push({
      test: /supabase\/functions/,
      loader: 'ignore-loader',
    });
    
    // Also exclude Deno-specific imports that might be referenced
    config.resolve.fallback = {
      ...config.resolve.fallback,
      'https://deno.land/std@0.168.0/http/server.ts': false,
      'https://esm.sh/@supabase/supabase-js@2': false,
    };
    
    return config;
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
