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
    // Use service role key to bypass RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Insert a test reply
    const { data, error } = await supabase
      .from('replies')
      .insert({
        email_id: crypto.randomUUID(),
        user_id: '69c27965-0cf9-4549-bfef-ad2f73aa0c08', // your user ID
        campaign_id: '630b62e0-914f-4d91-af4d-2fbbfe939543', // your campaign ID
        message_id: 'test_message_id_' + Date.now(),
        thread_id: 'test_thread_id_' + Date.now(),
        snippet: 'This is a test reply for debugging analytics',
        from_address: 'test@example.com',
        received_at: new Date().toISOString(),
        outcome_tag: 'interested'
      })
      .select()

    if (error) {
      console.error('Error inserting test reply:', error)
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Test reply inserted successfully',
      data 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (err) {
    console.error("Error in insert-test-reply function:", err)
    return new Response(JSON.stringify({ 
      error: err.message || 'An error occurred while inserting test reply'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
}) 