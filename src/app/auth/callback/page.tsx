'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@/utils/supabase';

// This component uses useSearchParams(), so it must be wrapped in a <Suspense>
const CallbackHandler = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createBrowserClient();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get the code and state from URL parameters
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        
        if (code) {
          // Exchange the code for a session
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          
          if (exchangeError) {
            throw exchangeError;
          }
          
          if (data.session) {
            // Successfully authenticated, redirect to dashboard
            router.push('/dashboard');
            return;
          }
        }
        
        // If no code or exchange failed, check if we already have a session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          router.push('/dashboard');
        } else {
          router.push('/login');
        }

      } catch (e: unknown) {
        console.error('Auth callback error:', e);
        setError(e instanceof Error ? e.message : 'Authentication failed');
      }
    };

    handleAuthCallback();
  }, [router, supabase, searchParams]);

  if (error) {
    return (
      <>
        <p className="text-lg text-red-600">Sign in failed</p>
        <p className="text-sm text-gray-500 mt-2">Error: {error}</p>
        <button
          onClick={() => router.push('/login')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Try Again
        </button>
      </>
    );
  }

  return <p className="text-lg">Finalizing sign in...</p>;
};

export default function AuthCallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <Suspense fallback={<p className="text-lg">Completing sign in...</p>}>
        <CallbackHandler />
      </Suspense>
    </div>
  );
} 