'use client';

import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';

export default function SignOutButton() {
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const supabase = createClient();
    await supabase.auth.signOut();
    // A hard refresh is a simple way to clear state and redirect.
    window.location.href = '/login'; 
  }

  return (
    <form onSubmit={handleSubmit}>
      <Button type="submit">Sign Out</Button>
    </form>
  )
} 