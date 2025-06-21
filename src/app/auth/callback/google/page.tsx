'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseClient } from '@/lib/supabaseClient';

function GoogleAuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createSupabaseClient();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const code = searchParams.get('code');

    const exchangeCodeForToken = async (authCode: string) => {
      try {
        setLoading(true);
        const { error: invokeError } = await supabase.functions.invoke('gmail-auth-token', {
          body: JSON.stringify({ code: authCode }),
        });

        if (invokeError) {
          throw invokeError;
        }

        // On success, redirect to the dashboard where the UI will update
        router.push('/dashboard');

      } catch (e: any) {
        setError(e.message || 'An unknown error occurred.');
        setLoading(false);
      }
    };

    if (code) {
      exchangeCodeForToken(code);
    } else {
      setError('No authorization code found. Please try connecting again.');
      setLoading(false);
    }
  }, [searchParams, router, supabase]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      {loading && <p className="text-lg">Connecting your Gmail account, please wait...</p>}
      {error && (
        <div className="text-center">
          <p className="text-lg text-red-600">Failed to connect account.</p>
          <p className="text-sm text-gray-500 mt-2">Error: {error}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Return to Dashboard
          </button>
        </div>
      )}
    </div>
  );
}

export default function GoogleAuthCallback() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <GoogleAuthCallbackInner />
    </Suspense>
  );
} 