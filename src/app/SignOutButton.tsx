'use client';

import { createBrowserClient } from '@/utils/supabase';
import { Button } from '@/components/ui/button';

export default function SignOutButton() {
  const supabase = createBrowserClient();
  
  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <Button onClick={handleSignOut} variant="outline">
      Sign Out
    </Button>
  );
} 