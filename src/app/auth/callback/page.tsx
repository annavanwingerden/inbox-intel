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
    setDebugInfo(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  useEffect(() => {
    const handleAuthCallback = async () => {
      addDebug('Auth callback started');
      addDebug(`URL: ${window.location.href}`);
      
      try {
        // Let Supabase handle the OAuth callback automatically
        const { data, error: authError } = await supabase.auth.getSession();
        
        addDebug(`Session check result: ${authError ? 'ERROR' : 'SUCCESS'}`);
        
        if (authError) {
          addDebug(`Auth error: ${authError.message}`);
          throw authError;
        }
        
        if (data.session) {
          addDebug('Session found! User is authenticated');
          addDebug('Redirecting to dashboard...');
          
          // Add a small delay to ensure session is properly saved
          setTimeout(() => {
            router.push('/dashboard');
          }, 1000);
          return;
        }
        
        // If no session, check for OAuth parameters
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        
        addDebug(`OAuth params - Code: ${code ? 'YES' : 'NO'}, State: ${state ? 'YES' : 'NO'}`);
        
        if (code) {
          addDebug('Exchanging code for session...');
          const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          
          addDebug(`Exchange result: ${exchangeError ? 'ERROR' : 'SUCCESS'}`);
          
          if (exchangeError) {
            addDebug(`Exchange error: ${exchangeError.message}`);
            throw exchangeError;
          }
          
          if (exchangeData.session) {
            addDebug('Session created successfully!');
            addDebug('Redirecting to dashboard...');
            
            setTimeout(() => {
              router.push('/dashboard');
            }, 1000);
            return;
          }
        }
        
        addDebug('No session found, redirecting to login');
        setTimeout(() => {
          router.push('/login');
        }, 1000);

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