import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import CampaignDetailClient from './CampaignDetailClient';

export default async function CampaignDetail({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const campaignId = params.id;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    redirect('/login');
  }

  // We only fetch the initial campaign data here.
  // The rest (analytics, leads, etc.) will be fetched on the client side.
  const { data: campaignData, error: campaignError } = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/campaign-manager`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
    }
  ).then(res => res.json());

  if (campaignError) {
    console.error("Error fetching initial campaign data:", campaignError);
    // You could return an error page here
    return <div>Error loading campaign. Please try again later.</div>
  }

  const campaign = campaignData.campaigns?.find((c: any) => c.id === campaignId);

  if (!campaign) {
    return <div>Campaign not found.</div>
  }

  return (
    <CampaignDetailClient campaign={campaign} />
  );
}