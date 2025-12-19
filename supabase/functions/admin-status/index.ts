import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const body = await req.json().catch(() => ({}));
    const session_token = typeof body?.session_token === 'string' ? body.session_token.trim() : '';

    if (!session_token) {
      return new Response(JSON.stringify({ error: 'session_token required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, user_id, expires_at')
      .eq('token', session_token)
      .maybeSingle();

    if (sessionError) {
      console.error('admin-status: session lookup error', sessionError);
      return new Response(JSON.stringify({ error: 'Failed to validate session' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!session) {
      return new Response(JSON.stringify({ is_admin: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const expiresMs = new Date(session.expires_at).getTime();
    if (!Number.isFinite(expiresMs) || expiresMs <= Date.now()) {
      return new Response(JSON.stringify({ is_admin: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Touch session
    await supabase
      .from('sessions')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', session.id);

    const { data: role, error: roleError } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', session.user_id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError) {
      console.error('admin-status: role lookup error', roleError);
      return new Response(JSON.stringify({ error: 'Failed to check role' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ is_admin: !!role }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('admin-status: unexpected error', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
