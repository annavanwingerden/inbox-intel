import { createServerClient } from '@/utils/supabase/server-index';
import { Button } from '@/components/ui/button';
import { redirect } from 'next/navigation';
import SignOutButton from './SignOutButton';

export default async function Home() {
  const supabase = await createServerClient();

  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    // User is authenticated, redirect to dashboard
    redirect('/dashboard');
  } else {
    // User is not authenticated, redirect to login
    redirect('/login');
  }
}
