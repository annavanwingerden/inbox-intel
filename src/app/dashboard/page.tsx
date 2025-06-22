import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import DashboardClient from './DashboardClient'; // We will create this client component

interface Campaign {
  id: string;
  name: string;
  goal: string;
  audience: string;
  created_at: string;
}

export default async function Dashboard() {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

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