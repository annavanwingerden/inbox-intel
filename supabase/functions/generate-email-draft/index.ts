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
    // 1. Initialize clients and get the authenticated user
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error("User not authenticated");
    }

    // 2. Get request body
    const { campaignGoal, audience, thread_context, user_notes, campaignId } = await req.json();
    
    if (!campaignGoal || !audience) {
      return new Response(JSON.stringify({ error: 'Campaign goal and audience are required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // 3. Get OpenAI API key
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      throw new Error("OpenAI API key not configured");
    }

    // 4. Craft the prompt
    let prompt;
    if (thread_context && user_notes) {
      // Prompt for generating a follow-up email
      prompt = `You are an expert cold outreach specialist. A reply has been received for a cold email. Your task is to draft a follow-up email.

Original Campaign Goal: ${campaignGoal}
Original Target Audience: ${audience}

Here is the email thread so far:
---
${thread_context}
---

Here are the user's notes on the reply:
---
${user_notes}
---

Requirements:
- Acknowledge the user's notes and the context of the reply.
- Align the follow-up with the original campaign goal.
- Keep it concise, professional, and under 150 words.
- Include a clear call-to-action.

Generate a follow-up email that includes:
1. Subject line (it should be a reply, so likely starting with "Re:")
2. Email body

Format your response as JSON with "subject" and "body" fields.`;
    } else {
      // Original prompt for generating a cold email
      prompt = `You are an expert cold outreach specialist. Create a compelling, personalized cold email based on the following information:

Campaign Goal: ${campaignGoal}
Target Audience: ${audience}

Requirements:
- Keep it under 150 words
- Make it personal and relevant to the audience
- Include a clear call-to-action
- Be professional but conversational
- Avoid generic templates
- Focus on value proposition

Generate a cold email that includes:
1. Subject line
2. Email body

Format your response as JSON with "subject" and "body" fields.`;
    }

    // 5. Call OpenAI API
    const modelParams = {
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert cold outreach specialist who creates compelling, personalized emails."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    };

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(modelParams)
    });

    if (!openaiResponse.ok) {
      const errorBody = await openaiResponse.text();
      console.error("OpenAI API error:", errorBody);
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const generatedContent = openaiData.choices[0]?.message?.content;

    if (!generatedContent) {
      throw new Error("No content generated from OpenAI");
    }

    // 6. Parse the generated content (expecting JSON)
    let parsedEmail;
    try {
      parsedEmail = JSON.parse(generatedContent);
    } catch (parseError) {
      // If JSON parsing fails, try to extract subject and body from text
      const lines = generatedContent.split('\n');
      const subjectMatch = lines.find(line => line.toLowerCase().includes('subject'));
      const bodyStart = lines.findIndex(line => line.toLowerCase().includes('body') || line.trim().length > 0);
      
      parsedEmail = {
        subject: subjectMatch ? subjectMatch.replace(/subject:?\s*/i, '').trim() : "Cold Outreach",
        body: lines.slice(bodyStart).join('\n').trim()
      };
    }

    // 8. Return the generated email
    return new Response(JSON.stringify({
      success: true,
      email: parsedEmail
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error("Error in generate-email-draft function:", err);
    return new Response(JSON.stringify({ 
      error: err.message || 'An error occurred while generating the email draft'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}) 