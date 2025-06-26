import { createBrowserClient } from '@supabase/ssr';

export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        name: 'sb-access-token', // You can use the default or your own name
        lifetime: 60 * 60 * 24 * 7, // 1 week
        domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined, // Set this in your .env for production
        path: '/',
        sameSite: 'Lax',
        secure: true,
      },
    }
  );
