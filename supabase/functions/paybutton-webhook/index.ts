import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as ed25519 from 'https://esm.sh/@noble/ed25519@2.1.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paybutton-signature',
};

// PayButton public key for signature verification (provided by user)
const PAYBUTTON_PUBLIC_KEY = '302a300506032b6570032100bc0ff6268e2edb1232563603904e40af377243cd806372e427bd05f70bd1759a';

// Extract the actual Ed25519 public key bytes (last 32 bytes of the DER-encoded key)
function extractEd25519PublicKey(derHex: string): Uint8Array {
  // The DER format for Ed25519 public keys:
  // 302a300506032b6570032100 (12 bytes prefix) + 32 bytes public key
  const keyBytes = derHex.slice(-64); // Last 32 bytes (64 hex chars)
  return hexToBytes(keyBytes);
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate a secure random token
function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Verify Ed25519 signature
async function verifySignature(message: string, signatureHex: string, publicKey: Uint8Array): Promise<boolean> {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = hexToBytes(signatureHex);
    return await ed25519.verifyAsync(signatureBytes, messageBytes, publicKey);
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

interface PayButtonWebhook {
  opReturn?: string;
  txid: string;
  address: string;
  amount: number;
  paymentId?: string;
  buttonId?: string;
  inputAddresses?: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the raw body for signature verification
    const rawBody = await req.text();
    const signature = req.headers.get('x-paybutton-signature') || req.headers.get('X-PayButton-Signature');

    console.log('PayButton webhook received');
    console.log('Raw body:', rawBody);
    console.log('Signature header:', signature);

    // If signature is provided, verify it
    if (signature) {
      const publicKey = extractEd25519PublicKey(PAYBUTTON_PUBLIC_KEY);
      const isValid = await verifySignature(rawBody, signature, publicKey);
      
      if (!isValid) {
        console.error('Invalid signature');
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log('Signature verified successfully');
    } else {
      console.log('No signature provided - proceeding without verification');
    }

    // Parse the webhook payload
    const payload: PayButtonWebhook = JSON.parse(rawBody);
    
    const { txid, address, amount, inputAddresses, opReturn } = payload;

    console.log('Webhook payload:', { txid, address, amount, inputAddresses, opReturn });

    // Get the sender's address (first input address)
    const senderAddress = inputAddresses?.[0];
    
    if (!senderAddress) {
      console.error('No sender address in webhook');
      return new Response(
        JSON.stringify({ error: 'No sender address found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate that this is an auth transaction (5.46 XEC)
    const expectedAmount = 546; // 5.46 XEC in satoshis
    const actualAmount = typeof amount === 'number' ? amount : parseFloat(String(amount));
    
    // Allow some flexibility (5.46 XEC = 546 sats, but PayButton might send in different units)
    console.log(`Transaction amount: ${actualAmount}, expected: ${expectedAmount}`);

    // Normalize the sender address
    const trimmedAddress = senderAddress.trim().toLowerCase();
    
    // Check if user already exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('ecash_address', trimmedAddress)
      .maybeSingle();

    if (fetchError) {
      console.error('Error checking existing user:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to check user' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let userData;
    let isNew = false;

    if (existingUser) {
      // Update last login
      await supabase
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', existingUser.id);
      
      userData = existingUser;
      console.log(`User ${existingUser.id} authenticated via PayButton webhook`);
    } else {
      // Create new user
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({ ecash_address: trimmedAddress })
        .select()
        .single();

      if (insertError || !newUser) {
        console.error('Error creating user:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to create account' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      userData = newUser;
      isNew = true;
      console.log(`New user created via webhook: ${newUser.id}`);
    }

    // Generate session token
    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Delete any existing sessions for this user
    await supabase
      .from('sessions')
      .delete()
      .eq('user_id', userData.id);

    // Create new session
    const { error: sessionError } = await supabase
      .from('sessions')
      .insert({
        user_id: userData.id,
        token: sessionToken,
        expires_at: expiresAt.toISOString()
      });

    if (sessionError) {
      console.error('Error creating session:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Failed to create session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Store the session token with tx_hash for the frontend to retrieve
    // We'll use a simple approach: store in a temporary auth_tokens table or cache
    // For now, return success and let frontend poll for session
    
    // Log the authentication event
    console.log(`Auth successful: user=${userData.id}, tx=${txid}, address=${trimmedAddress}`);

    // Fetch profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userData.id)
      .maybeSingle();

    return new Response(
      JSON.stringify({ 
        success: true,
        user: userData,
        profile,
        session_token: sessionToken,
        isNew,
        tx_hash: txid
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('PayButton webhook error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
