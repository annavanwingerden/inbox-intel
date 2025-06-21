// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Helper function to decrypt the refresh token (assuming this logic exists elsewhere, e.g., send-email)
async function decrypt(encryptedText: string, keyString: string): Promise<string> {
  // Unicode-safe base64 decoding
  const encryptedData = atob(encryptedText).split('').map(c => c.charCodeAt(0));
  const iv = new Uint8Array(encryptedData.slice(0, 12));
  const data = new Uint8Array(encryptedData.slice(12));
  
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(keyString).slice(0, 32),
    { name: 'AES-GCM', length: 256 },
    true,
    ['decrypt']
  );

  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(decrypted);
}

// Helper function to get a new access token from a refresh token
async function getAccessToken(refreshToken: string): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to refresh token: ${await response.text()}`);
  }

  const { access_token } = await response.json();
  return access_token;
}

console.log("Reply Poller function initialized.");

serve(async (req) => {
  try {
    console.log("Polling for replies...");

    // Use the Service Role Key for admin-level access
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Get all unique users who have 'sent' emails
    const { data: users, error: usersError } = await supabaseAdmin
      .from('emails')
      .select('user_id')
      .eq('status', 'sent')
      .neq('user_id', null);

    if (usersError) throw new Error(`DB error fetching users: ${usersError.message}`);

    const userIds = [...new Set(users.map(u => u.user_id))];
    console.log(`Found ${userIds.length} users with sent emails to poll.`);
    
    let totalRepliesProcessed = 0;

    for (const userId of userIds) {
      try {
        // 2. For each user, get their token and 'sent' emails
        const { data: tokenData, error: tokenError } = await supabaseAdmin
          .from('user_tokens')
          .select('encrypted_refresh_token')
          .eq('user_id', userId)
          .single();

        if (tokenError) {
          console.error(`Could not find token for user ${userId}. Skipping.`);
          continue;
        }

        const { data: sentEmails, error: emailsError } = await supabaseAdmin
          .from('emails')
          .select('id, user_id, campaign_id, thread_id')
          .eq('status', 'sent')
          .eq('user_id', userId);

        if (emailsError) {
          console.error(`Could not fetch sent emails for user ${userId}. Skipping.`);
          continue;
        }

        const refreshToken = await decrypt(tokenData.encrypted_refresh_token, Deno.env.get('ENCRYPTION_KEY')!);
        const accessToken = await getAccessToken(refreshToken);

        for (const email of sentEmails) {
          // 3. Check the Gmail thread for new messages
          const threadResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${email.thread_id}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });

          if (!threadResponse.ok) {
            console.error(`Failed to fetch thread ${email.thread_id} for user ${userId}.`);
            continue;
          }

          const thread = await threadResponse.json();
          const originalMessageCount = 1; // The original sent email

          if (thread.messages.length > originalMessageCount) {
            // 4. Process new messages as replies
            const newMessages = thread.messages.slice(originalMessageCount);
            
            for (const message of newMessages) {
              const fromHeader = message.payload.headers.find((h: any) => h.name === 'From').value;
              const isReplyFromRecipient = !fromHeader.includes('me'); // Simple check, assuming 'me' is the sender

              if (isReplyFromRecipient) {
                // Check if this reply is already processed
                const { data: existingReply, error: checkError } = await supabaseAdmin
                  .from('replies')
                  .select('id')
                  .eq('message_id', message.id)
                  .single();
                  
                if (checkError && checkError.code !== 'PGRST116') { // Ignore "not found"
                    console.error(`Error checking for existing reply: ${checkError.message}`);
                    continue; // Skip this message
                }

                if (existingReply) {
                  console.log(`Reply ${message.id} already processed. Skipping.`);
                  continue; // Already processed
                }

                console.log(`New reply found in thread ${email.thread_id}. Processing...`);
                
                // 5. Insert into replies table and update email status
                const { error: insertError } = await supabaseAdmin.from('replies').insert({
                  email_id: email.id,
                  user_id: userId,
                  campaign_id: email.campaign_id,
                  message_id: message.id,
                  thread_id: email.thread_id,
                  snippet: message.snippet,
                  from_address: fromHeader,
                  received_at: new Date(parseInt(message.internalDate)).toISOString(),
                });

                if (insertError) {
                  console.error(`Failed to insert reply: ${insertError.message}`);
                } else {
                  await supabaseAdmin
                    .from('emails')
                    .update({ status: 'replied' })
                    .eq('id', email.id);
                  
                  totalRepliesProcessed++;
                }
              }
            }
          }
        }
      } catch (userError) {
        console.error(`Failed to process replies for user ${userId}:`, userError.message);
      }
  }

  return new Response(
      JSON.stringify({ success: true, message: `Polling complete. Processed ${totalRepliesProcessed} new replies.` }),
    { headers: { "Content-Type": "application/json" } },
  )
  } catch (err) {
    console.error("Error in reply-poller function:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { headers: { "Content-Type": "application/json" }, status: 500 },
    )
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/reply-poller' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
