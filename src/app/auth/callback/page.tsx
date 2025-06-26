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
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  const addDebug = (message: string) => {
    console.log(`🔍 ${message}`);
    setDebugInfo(prev => [...prev, message]);
  };

  useEffect(() => {
    const handleAuthCallback = async () => {
      addDebug('Auth callback started');
      addDebug(`URL: ${window.location.href}`);
      
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');
        
        addDebug(`Code: ${code ? 'YES' : 'NO'}`);
        addDebug(`State: ${state ? 'YES' : 'NO'}`);
        addDebug(`Error: ${error || 'NO'}`);
        
        if (error) {
          throw new Error(`OAuth error: ${error}`);
        }
        
        if (code) {
          addDebug('Exchanging code for session...');
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          
          addDebug(`Exchange result: ${exchangeError ? 'ERROR' : 'SUCCESS'}`);
          
          if (exchangeError) {
            addDebug(`Exchange error: ${exchangeError.message}`);
            throw exchangeError;
          }
          
          if (data.session) {
            addDebug('Session created successfully!');
            addDebug('Redirecting to dashboard...');
            router.push('/dashboard');
            return;
          } else {
            addDebug('No session in exchange result');
            router.push('/dashboard');
          }
        }
        
        addDebug('Checking existing session...');
        const { data: { session } } = await supabase.auth.getSession();
        
        addDebug(`Session exists: ${session ? 'YES' : 'NO'}`);
        
        if (session) {
          addDebug('Session found, redirecting to dashboard');
          router.push('/dashboard');
        } else {
          addDebug('No session found, redirecting to login');
          router.push('/dashboard');
        }

      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        addDebug(`ERROR: ${errorMessage}`);
        setError(errorMessage);
      }
    };

    handleAuthCallback();
  }, [router, supabase, searchParams]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <h2 className="text-xl font-bold text-red-600 mb-4">Sign in failed</h2>
        <p className="text-sm text-gray-500 mb-4">Error: {error}</p>
        
        <div className="bg-gray-100 p-4 rounded-lg mb-4 max-w-md">
          <h3 className="font-bold mb-2">Debug Info:</h3>
          {debugInfo.map((info, index) => (
            <div key={index} className="text-xs text-gray-600 mb-1">{info}</div>
          ))}
        </div>
        
        <button
          onClick={() => router.push('/login')}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <p className="text-lg mb-4">Finalizing sign in...</p>
      
      <div className="bg-gray-100 p-4 rounded-lg max-w-md">
        <h3 className="font-bold mb-2">Debug Info:</h3>
        {debugInfo.map((info, index) => (
          <div key={index} className="text-xs text-gray-600 mb-1">{info}</div>
        ))}
      </div>
    </div>
  );
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