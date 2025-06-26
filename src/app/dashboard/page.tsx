import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';

interface Campaign {
  id: string;
  name: string;
  goal: string;
  audience: string;
  created_at: string;
}

export default async function Dashboard() {
  const supabase = createClient();

  const { data: { session }, } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  // Fetch campaigns and check for Gmail token in parallel
  const [campaignResponse, tokenResponse] = await Promise.all([
    supabase.functions.invoke('campaign-manager', { method: 'GET' }),
    supabase.from('user_tokens').select('id').single(),
  ]);

  const { data: campaignData, error: campaignError } = campaignResponse;
  const { data: tokenData, error: tokenError } = tokenResponse;

  if (campaignError) {
    console.error('Error fetching campaigns:', campaignError);
    // You might want to render an error state here
  }
  
  if (tokenError && tokenError.code !== 'PGRST116') { // Ignore 'single row not found' error
    console.error('Error fetching gmail token:', tokenError);
     // You might want to render an error state here
  }

  const campaigns: Campaign[] = campaignData?.campaigns || [];
  const isGmailConnected = !!tokenData;

  return (
    <div className="container mx-auto p-8">
      <DashboardClient
        initialCampaigns={campaigns}
        initialIsGmailConnected={isGmailConnected}
      />
    </div>
  );
} 