import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function for encryption using AES-GCM
async function encrypt(text: string, keyString: string): Promise<string> {
  // Ensure the key is 32 bytes for AES-256
  const keyBuffer = new TextEncoder().encode(keyString).slice(0, 32); 
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12)); // 12-byte IV is recommended for GCM
  const encodedText = new TextEncoder().encode(text);

  const encryptedData = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    cryptoKey,
    encodedText
  );

  // Combine IV and encrypted data for storage, then Base64 encode
  const combined = new Uint8Array(iv.length + encryptedData.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encryptedData), iv.length);
  
  // Convert byte array to Base64 string for easy storage
  return btoa(String.fromCharCode.apply(null, Array.from(combined)));
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

    // 2. Get authorization code from the request body
    const { code } = await req.json();
    if (!code) {
        return new Response(JSON.stringify({ error: 'Authorization code is missing.' }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }

    // 3. Get necessary secrets from environment variables
    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const redirectUri = Deno.env.get("SITE_URL") + '/auth/callback/google';
    const encryptionKey = Deno.env.get("ENCRYPTION_KEY");

    if (!googleClientId || !googleClientSecret || !redirectUri || !encryptionKey) {
      throw new Error("Missing one or more critical environment variables (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SITE_URL, ENCRYPTION_KEY).");
    }

    // 4. Exchange the authorization code for tokens from Google
    const tokenUrl = "https://oauth2.googleapis.com/token";
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: googleClientId,
        client_secret: googleClientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
        const errorBody = await tokenResponse.json();
        console.error("Google token exchange failed:", errorBody);
        throw new Error(`Google token exchange failed: ${JSON.stringify(errorBody)}`);
    }

    const tokens = await tokenResponse.json();
    const { refresh_token } = tokens;

    if (!refresh_token) {
        throw new Error("No refresh token returned from Google. This can happen if the user has already granted consent. Ensure 'prompt: consent' was used in the initial auth URL.");
    }

    // 5. Encrypt the refresh token before storing it
    const encryptedRefreshToken = await encrypt(refresh_token, encryptionKey);

    // 6. Securely store the encrypted token in the database, updating if it already exists
    const { error: dbError } = await supabase
      .from('user_tokens')
      .upsert({
        user_id: user.id,
        encrypted_refresh_token: encryptedRefreshToken,
      }, { onConflict: 'user_id' });

    if (dbError) {
      console.error("Database error:", dbError);
      throw dbError;
    }

    return new Response(JSON.stringify({ message: "Successfully connected Gmail account." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
    });

  } catch (err) {
    console.error("Unhandled error in function:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}) 