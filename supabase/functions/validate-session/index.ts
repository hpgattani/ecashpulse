import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { session_token, ecash_address, tx_hash } = await req.json();

    // Method 1: Validate by session token (for session refresh)
    if (session_token) {
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('*, users(*)')
        .eq('token', session_token)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (sessionError) {
        console.error('Session query error:', sessionError);
        return new Response(
          JSON.stringify({ valid: false, error: 'Failed to validate session' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!session) {
        return new Response(
          JSON.stringify({ valid: false, error: 'Session expired or invalid' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Refresh session (sliding expiration) + keepalive
      const nowIso = new Date().toISOString();
      const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      await supabase
        .from('sessions')
        .update({ last_used_at: nowIso, expires_at: newExpiresAt })
        .eq('id', session.id);

      // Get profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', session.user_id)
        .maybeSingle();

      return new Response(
        JSON.stringify({
          valid: true,
          user: session.users,
          profile,
          session_token
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Method 2: Find session by ecash_address (for login after webhook)
    if (ecash_address !== undefined && ecash_address !== null) {
      // Defensive: ensure ecash_address is a string
      if (typeof ecash_address !== 'string') {
        console.error('Invalid ecash_address type:', typeof ecash_address, ecash_address);
        return new Response(
          JSON.stringify({ valid: false, error: 'Invalid ecash_address format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // If client couldn't detect sender, extract from tx via Chronik (same as create-session)
      if ((ecash_address === '__from_tx__' || ecash_address === '') && tx_hash && typeof tx_hash === 'string') {
        try {
          console.log(`validate-session: extracting sender from tx ${tx_hash} via Chronik...`);
          const CHRONIK_ENDPOINTS = [
            'https://chronik-native1.fabien.cash',
            'https://chronik-native2.fabien.cash',
            'https://chronik.pay2stay.com/xec',
            'https://chronik.e.cash',
          ];
          for (const endpoint of CHRONIK_ENDPOINTS) {
            try {
              const r = await fetch(`${endpoint}/tx/${tx_hash}`);
              if (!r.ok) continue;
              const tx = await r.json();
              const inputAddr = tx?.inputs?.[0]?.outputScript;
              // Try outputs to find sender via inputs - Chronik returns inputs with addresses sometimes
              const senderFromInput = tx?.inputs?.[0]?.sender?.address || tx?.inputs?.[0]?.outputAddress;
              if (senderFromInput && typeof senderFromInput === 'string') {
                ecash_address = senderFromInput;
                break;
              }
              // Fallback: derive from outputScript (skip — too complex here)
            } catch (_) { continue; }
          }
        } catch (e) {
          console.error('Chronik extraction failed:', e);
        }
      }

      if (ecash_address === '__from_tx__' || !ecash_address) {
        return new Response(
          JSON.stringify({ valid: false, error: 'Could not detect sender wallet address' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const trimmedAddress = ecash_address.trim().toLowerCase();
      
      // Find user by address
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('ecash_address', trimmedAddress)
        .maybeSingle();

      if (userError || !user) {
        console.log('User not found for address:', trimmedAddress);
        return new Response(
          JSON.stringify({ valid: false, error: 'User not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Find active session for this user (created by webhook)
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', user.id)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sessionError || !session) {
        console.log('No active session found for user:', user.id);
        return new Response(
          JSON.stringify({ valid: false, error: 'No active session - webhook may not have processed yet' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Refresh session (sliding expiration)
      const nowIso = new Date().toISOString();
      const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await supabase
        .from('sessions')
        .update({ last_used_at: nowIso, expires_at: newExpiresAt })
        .eq('id', session.id);

      // Get profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      console.log(`Session found for ${trimmedAddress}: ${session.id}`);

      return new Response(
        JSON.stringify({
          valid: true,
          user,
          profile,
          session_token: session.token
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ valid: false, error: 'Either session_token or ecash_address required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Validate session error:', error);
    return new Response(
      JSON.stringify({ valid: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
