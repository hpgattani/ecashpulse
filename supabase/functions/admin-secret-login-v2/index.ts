import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 60;

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
    const password = typeof body?.password === 'string' ? body.password.trim() : '';
    const session_token = typeof body?.session_token === 'string' ? body.session_token.trim() : '';

    const adminPassword = (Deno.env.get('ADMIN_SECRET_PASSWORD') ?? '').trim();

    if (!adminPassword) {
      console.error('ADMIN_SECRET_PASSWORD not configured');
      return new Response(JSON.stringify({ error: 'Admin access not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!password || !session_token) {
      return new Response(JSON.stringify({ error: 'password and session_token required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- Rate limiting: check recent failed attempts for this session_token ---
    const windowStart = new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000).toISOString();
    const { count: failedCount } = await supabase
      .from('bet_audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'admin_login_failed')
      .eq('tx_hash', session_token)
      .gte('created_at', windowStart);

    if ((failedCount ?? 0) >= MAX_ATTEMPTS) {
      console.log('admin-secret-login-v2: rate limited');
      return new Response(JSON.stringify({ error: 'Too many failed attempts. Try again later.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (password !== adminPassword) {
      // Log failed attempt
      await supabase.from('bet_audit_log').insert({
        event_type: 'admin_login_failed',
        tx_hash: session_token,
        metadata: { timestamp: new Date().toISOString() },
      });
      console.log('admin-secret-login-v2: invalid password');
      return new Response(JSON.stringify({ error: 'Invalid password' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, user_id, expires_at')
      .eq('token', session_token)
      .maybeSingle();

    if (sessionError) {
      console.error('admin-secret-login-v2: session lookup error', sessionError);
      return new Response(JSON.stringify({ error: 'Failed to validate session' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!session) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const expiresMs = new Date(session.expires_at).getTime();
    if (!Number.isFinite(expiresMs) || expiresMs <= Date.now()) {
      return new Response(JSON.stringify({ error: 'Session expired' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Touch session
    await supabase
      .from('sessions')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', session.id);

    const user_id = session.user_id;

    const { data: existingRole, error: roleCheckError } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', user_id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleCheckError) {
      console.error('admin-secret-login-v2: role check error', roleCheckError);
      return new Response(JSON.stringify({ error: 'Failed to check role' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (existingRole) {
      console.log(`admin-secret-login-v2: already admin user=${user_id}`);
      return new Response(JSON.stringify({ success: true, message: 'Already admin' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: insertError } = await supabase
      .from('user_roles')
      .insert({ user_id, role: 'admin' });

    if (insertError) {
      console.error('admin-secret-login-v2: insert role error', insertError);
      return new Response(JSON.stringify({ error: 'Failed to grant admin access' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Log successful admin grant
    await supabase.from('bet_audit_log').insert({
      event_type: 'admin_login_success',
      user_id,
      metadata: { timestamp: new Date().toISOString() },
    });

    console.log(`admin-secret-login-v2: admin granted user=${user_id}`);

    return new Response(JSON.stringify({ success: true, message: 'Admin access granted' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('admin-secret-login-v2: unexpected error', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
