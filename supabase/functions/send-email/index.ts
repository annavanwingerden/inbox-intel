import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function for decryption using AES-GCM
async function decrypt(encryptedText: string, keyString: string): Promise<string> {
  try {
    // Ensure the key is 32 bytes for AES-256
    const keyBuffer = new TextEncoder().encode(keyString).slice(0, 32);
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBuffer,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );

    // Decode the Base64 string back to byte array
    const combined = new Uint8Array(
      atob(encryptedText).split('').map(char => char.charCodeAt(0))
    );

    // Extract IV (first 12 bytes) and encrypted data
    const iv = combined.slice(0, 12);
    const encryptedData = combined.slice(12);

    // Decrypt
    const decryptedData = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      cryptoKey,
      encryptedData
    );

    // Convert back to string
    return new TextDecoder().decode(decryptedData);
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Failed to decrypt refresh token");
  }
}

// Helper function to refresh Gmail access token
async function refreshGmailToken(refreshToken: string): Promise<string> {
  const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

  if (!googleClientId || !googleClientSecret) {
    throw new Error("Google OAuth credentials not configured");
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: googleClientId,
      client_secret: googleClientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!tokenResponse.ok) {
    const errorBody = await tokenResponse.text();
    console.error("Token refresh failed:", errorBody);
    throw new Error("Failed to refresh Gmail access token");
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

// Helper function to create Gmail message
function toBase64Unicode(str: string): string {
  // Unicode-safe base64 encoding
  return btoa(unescape(encodeURIComponent(str)));
}

function createGmailMessage(to: string, subject: string, body: string): string {
  const email = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "",
    body
  ].join("\r\n");

  // Base64 encode the email and make it URL-safe
  return toBase64Unicode(email).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function createGmailReplyMessage(to: string, from:string, subject: string, body: string, threadId: string, inReplyTo: string, references: string): string {
  const email = [
    `To: ${to}`,
    `From: ${from}`,
    `Subject: ${subject}`,
    `Thread-Topic: ${subject}`,
    `Thread-Index: ${threadId}`,
    `In-Reply-To: <${inReplyTo}>`,
    `References: <${references}>`,
    "",
    body
  ].join("\r\n");

  // Base64 encode the email and make it URL-safe
  return toBase64Unicode(email).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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
    const { recipientEmail, subject, body, campaignId, threadId, inReplyTo, references, fromAddress } = await req.json();
    
    if (!recipientEmail || !subject || !body) {
      return new Response(JSON.stringify({ error: 'Recipient email, subject, and body are required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // 3. Get user's stored OAuth tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('user_tokens')
      .select('encrypted_refresh_token')
      .eq('user_id', user.id)
      .single();

    if (tokenError || !tokenData) {
      throw new Error("Gmail account not connected. Please connect your Gmail account first.");
    }

    // 4. Decrypt the refresh token
    const encryptionKey = Deno.env.get("ENCRYPTION_KEY");
    if (!encryptionKey) {
      throw new Error("Encryption key not configured");
    }

    const refreshToken = await decrypt(tokenData.encrypted_refresh_token, encryptionKey);

    // 5. Refresh the access token
    const accessToken = await refreshGmailToken(refreshToken);

    // 6. Create the Gmail message
    let rawMessage;
    if (threadId && inReplyTo && references && fromAddress) {
        rawMessage = createGmailReplyMessage(recipientEmail, fromAddress, subject, body, threadId, inReplyTo, references);
    }
    else {
        rawMessage = createGmailMessage(recipientEmail, subject, body);
    }


    // 7. Send the email via Gmail API
    const sendBody: { raw: string; threadId?: string } = { raw: rawMessage };
    if (threadId) {
      sendBody.threadId = threadId;
    }

    const gmailResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/send`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sendBody),
    });

    if (!gmailResponse.ok) {
      const errorBody = await gmailResponse.text();
      console.error("Gmail API error:", errorBody);
      throw new Error(`Failed to send email: ${gmailResponse.status}`);
    }

    const gmailData = await gmailResponse.json();
    const messageId = gmailData.id;
    const newThreadId = gmailData.threadId;

    // 8. Save email metadata to database
    const { error: dbError } = await supabase
      .from('emails')
      .insert({
        campaign_id: campaignId,
        user_id: user.id,
        recipient_email: recipientEmail,
        subject: subject,
        original_draft: body, // In this context, this is the follow-up body
        message_id: messageId,
        thread_id: newThreadId,
        status: 'sent', // Or maybe 'follow-up-sent'
      });

    if (dbError) {
      console.error("Database error:", dbError);
      throw new Error(`Failed to save email metadata: ${dbError.message}`);
    }

    // 9. Return success response
    return new Response(JSON.stringify({
      success: true,
      messageId: messageId,
      threadId: newThreadId,
      message: "Email sent successfully"
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error("Error in send-email function:", err);
    return new Response(JSON.stringify({ 
      error: err.message || 'An error occurred while sending the email'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}) 