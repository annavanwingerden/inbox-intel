// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const url = new URL(req.url);
    const campaignId = url.searchParams.get('campaign_id');
    
    if (!campaignId) {
      return new Response(JSON.stringify({ error: 'Campaign ID is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // 1. Get total emails sent for the campaign
    const { count: totalSent, error: sentError } = await supabase
      .from('emails')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('user_id', user.id);

    if (sentError) throw new Error(`Error fetching sent count: ${sentError.message}`);

    // 2. Get total replies received for the campaign
    const { count: totalReplies, error: repliesError } = await supabase
      .from('replies')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('user_id', user.id);
      
    if (repliesError) throw new Error(`Error fetching replies count: ${repliesError.message}`);

    // 3. Get counts for each outcome tag
    const { data: outcomeData, error: outcomeError } = await supabase
      .from('replies')
      .select('outcome_tag')
      .eq('campaign_id', campaignId)
      .eq('user_id', user.id);

    if (outcomeError) throw new Error(`Error fetching outcomes: ${outcomeError.message}`);

    const outcomeCounts = outcomeData.reduce((acc, { outcome_tag }) => {
      if (outcome_tag) {
        acc[outcome_tag] = (acc[outcome_tag] || 0) + 1;
      }
      return acc;
    }, {});

    // 4. Calculate reply rate
    const replyRate = totalSent > 0 ? (totalReplies / totalSent) * 100 : 0;

    const analytics = {
      totalSent: totalSent || 0,
      totalReplies: totalReplies || 0,
      replyRate: parseFloat(replyRate.toFixed(2)),
      outcomeCounts: outcomeCounts,
    };

    return new Response(JSON.stringify({ analytics }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error("Error in get-campaign-analytics function:", err);
    return new Response(JSON.stringify({ 
      error: err.message || 'An error occurred while fetching analytics'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})
