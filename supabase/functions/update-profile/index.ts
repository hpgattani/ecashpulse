import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function validateSession(supabase: any, sessionToken: string | null | undefined) {
  if (!sessionToken || typeof sessionToken !== 'string') {
    return { valid: false, error: 'Session token is required' };
  }

  const trimmedToken = sessionToken.trim();
  if (trimmedToken.length !== 64) {
    return { valid: false, error: 'Invalid session token format' };
  }

  const { data: session, error } = await supabase
    .from('sessions')
    .select('user_id, expires_at')
    .eq('token', trimmedToken)
    .maybeSingle();

  if (error || !session) {
    return { valid: false, error: 'Invalid or expired session' };
  }

  if (new Date(session.expires_at) < new Date()) {
    await supabase.from('sessions').delete().eq('token', trimmedToken);
    return { valid: false, error: 'Session expired' };
  }

  await supabase
    .from('sessions')
    .update({ last_used_at: new Date().toISOString() })
    .eq('token', trimmedToken);

  return { valid: true, userId: session.user_id };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { session_token, display_name, bio } = await req.json();
    
    // Validate session and get authenticated user_id
    const sessionResult = await validateSession(supabase, session_token);
    if (!sessionResult.valid) {
      return new Response(
        JSON.stringify({ error: sessionResult.error }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const user_id = sessionResult.userId;

    // Validate display_name length
    if (display_name && display_name.length > 30) {
      return new Response(
        JSON.stringify({ error: 'Username must be 30 characters or less' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate bio length
    if (bio && bio.length > 200) {
      return new Response(
        JSON.stringify({ error: 'Bio must be 200 characters or less' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update the profile for the authenticated user only
    const { data: profile, error } = await supabase
      .from('profiles')
      .update({ 
        display_name: display_name || null,
        bio: bio || null,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to update profile' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Profile updated for user: ${user_id}`);

    return new Response(
      JSON.stringify({ success: true, profile }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Update profile error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
