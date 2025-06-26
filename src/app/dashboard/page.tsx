'use client';

import { useEffect } from 'react';
import { createBrowserClient } from '@/utils/supabase';

export default function DashboardClient() {
  const supabase = createBrowserClient();

  useEffect(() => {
    const debugSession = async () => {
      console.log('🔍 Debugging session...');
      
      // Check localStorage
      console.log('localStorage keys:', Object.keys(localStorage));
      
      // Check what Supabase sees
      const { data: { session }, error } = await supabase.auth.getSession();
      console.log('Supabase session:', session);
      console.log('Supabase error:', error);
      
      // Check user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log('Supabase user:', user);
      console.log('User error:', userError);
    };

    debugSession();
  }, [supabase]);

  return <div>Check console for debug info</div>;
} 