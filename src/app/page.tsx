"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import type { User } from '@supabase/supabase-js';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const supabase = createSupabaseClient();

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };

    fetchUser();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Welcome to InboxIntel</h1>
        {user ? (
          <p className="mt-2 text-lg">You are signed in as: {user.email}</p>
        ) : (
          <p className="mt-2 text-lg">Loading user information...</p>
        )}
        <Button onClick={handleSignOut} className="mt-6">
          Sign Out
        </Button>
        </div>
    </div>
  );
}
