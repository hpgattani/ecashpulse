import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple eCash address validation
function isValidEcashAddress(address: string): boolean {
  const ecashRegex = /^ecash:q[a-z0-9]{41}$/;
  const legacyRegex = /^q[a-z0-9]{41}$/;
  return ecashRegex.test(address.toLowerCase()) || legacyRegex.test(address.toLowerCase());
}

// Generate a secure random token
function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { ecash_address } = await req.json();
    
    // Validate address format
    if (!ecash_address || typeof ecash_address !== 'string') {
      return new Response(
        JSON.stringify({ error: 'eCash address is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trimmedAddress = ecash_address.trim().toLowerCase();
    
    if (!isValidEcashAddress(trimmedAddress)) {
      return new Response(
        JSON.stringify({ error: 'Invalid eCash address format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
      console.log(`User ${existingUser.id} logged in`);
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
      console.log(`New user created: ${newUser.id}`);
    }

    // Generate session token
    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Delete any existing sessions for this user (single session per user)
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
        isNew
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Register user error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
