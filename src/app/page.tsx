import { createClient } from '@/utils/supabase/server';
import { Button } from '@/components/ui/button';
import { redirect } from 'next/navigation';
import SignOutButton from './SignOutButton';


export default async function Home() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return redirect('/login')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Welcome to InboxIntel</h1>
        <p className="mt-2 text-lg">You are signed in as: {user.email}</p>
        <div className="mt-6">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
