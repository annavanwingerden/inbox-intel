'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

// This component uses useSearchParams(), so it must be wrapped in a <Suspense>
const CallbackHandler = () => {
  const router = useRouter();
  const supabase = createClient();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) throw sessionError;

        if (data.session) {
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
  }, [router, supabase]);

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