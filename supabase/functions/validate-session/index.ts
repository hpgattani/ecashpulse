import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

      // Update last_used_at
      await supabase
        .from('sessions')
        .update({ last_used_at: new Date().toISOString() })
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
          session_token,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Method 2: Find or create session by ecash_address (for login after payment)
    if (ecash_address) {
      const trimmedAddress = ecash_address.trim().toLowerCase();

      // Look up existing user
      const { data: existingUser, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('ecash_address', trimmedAddress)
        .maybeSingle();

      if (userError) {
        console.error('User query error:', userError);
        return new Response(
          JSON.stringify({ valid: false, error: 'Failed to validate user' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let user = existingUser;

      // Look for an active session for this user
      let session: any = null;
      if (user) {
        const { data: activeSession, error: sessionError } = await supabase
          .from('sessions')
          .select('*')
          .eq('user_id', user.id)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (sessionError) {
          console.error('Session query error:', sessionError);
          return new Response(
            JSON.stringify({ valid: false, error: 'Failed to validate session' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        session = activeSession || null;
      }

      // No fallback - webhook must create user/session
      if (!user) {
        console.log('User not found - webhook has not processed yet:', trimmedAddress);
        return new Response(
          JSON.stringify({ valid: false, error: 'User not found - waiting for webhook verification' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!session) {
        console.log('No active session - webhook has not processed yet:', user.id);
        return new Response(
          JSON.stringify({
            valid: false,
            error: 'No active session - waiting for webhook verification',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

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
          session_token: session.token,
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
