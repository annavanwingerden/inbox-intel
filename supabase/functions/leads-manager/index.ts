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
      let body;
      try {
        body = await req.json();
      } catch {
        return new Response(JSON.stringify({ error: 'Missing or invalid JSON body' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }
      const { campaign_id, leads } = body;
      if (!campaign_id || !leads || !Array.isArray(leads)) {
        return new Response(JSON.stringify({ error: 'Campaign ID and leads array are required' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }
      // Prepare leads data
      type LeadInput = { email: string; first_name?: string; last_name?: string; company?: string; status?: string };
      const leadsData = (leads as LeadInput[]).map((lead) => ({
        campaign_id,
        user_id: user.id,
        email: lead.email?.trim(),
        first_name: lead.first_name?.trim() || '',
        last_name: lead.last_name?.trim() || '',
        company: lead.company?.trim() || '',
        status: lead.status || 'pending',
      }));
      const { data: newLeads, error } = await supabase
        .from('leads')
        .insert(leadsData)
        .select();
      if (error) {
        console.error('Supabase insert error:', error);
        throw error;
      }
      return new Response(JSON.stringify({ 
        success: true,
        leads: newLeads,
        message: `Successfully added ${newLeads.length} leads`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201,
      });
    } else if (req.method === 'PATCH') {
      let body;
      try {
        body = await req.json();
      } catch {
        return new Response(JSON.stringify({ error: 'Missing or invalid JSON body' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }
      const { lead_id, update } = body;
      if (!lead_id || !update) {
        return new Response(JSON.stringify({ error: 'Lead ID and update object are required' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }
      const { data: updatedLead, error } = await supabase
        .from('leads')
        .update(update)
        .eq('id', lead_id)
        .eq('user_id', user.id)
        .select();
      if (error) throw error;
      return new Response(JSON.stringify({ 
        success: true,
        lead: updatedLead[0],
        message: 'Lead updated successfully'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } else if (req.method === 'DELETE') {
      let body;
      try {
        body = await req.json();
      } catch {
        return new Response(JSON.stringify({ error: 'Missing or invalid JSON body' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }
      const { lead_id } = body;
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