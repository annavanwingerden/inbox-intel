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

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const campaignId = url.searchParams.get('campaign_id');
      
      if (!campaignId) {
        return new Response(JSON.stringify({ error: 'Campaign ID is required' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      const { data: leads, error } = await supabase
        .from('leads')
        .select('*')
        .eq('campaign_id', campaignId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify({ leads }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } else if (req.method === 'POST') {
      const { campaign_id, emails } = await req.json();
      
      if (!campaign_id || !emails || !Array.isArray(emails)) {
        return new Response(JSON.stringify({ error: 'Campaign ID and emails array are required' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      // Prepare leads data
      const leadsData = emails.map((email: string) => ({
        campaign_id,
        user_id: user.id,
        email: email.trim(),
        status: 'pending'
      }));

      const { data: newLeads, error } = await supabase
        .from('leads')
        .insert(leadsData)
        .select();

      if (error) throw error;

      return new Response(JSON.stringify({ 
        success: true,
        leads: newLeads,
        message: `Successfully added ${newLeads.length} leads`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201,
      });
    } else if (req.method === 'DELETE') {
      const { lead_id } = await req.json();
      
      if (!lead_id) {
        return new Response(JSON.stringify({ error: 'Lead ID is required' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', lead_id)
        .eq('user_id', user.id);

      if (error) throw error;

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Lead deleted successfully'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  } catch (err) {
    console.error("Critical error in leads-manager function:", err);
    return new Response(JSON.stringify({ 
      error: err.message || 'An error occurred while managing leads'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}) 