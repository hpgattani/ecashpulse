import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function requireAdmin(supabase: any, session_token: string): Promise<{ user_id: string } | null> {
  const { data: session } = await supabase
    .from('sessions')
    .select('id, user_id, expires_at')
    .eq('token', session_token)
    .maybeSingle();

  if (!session) return null;

  const expiresMs = new Date(session.expires_at).getTime();
  if (!Number.isFinite(expiresMs) || expiresMs <= Date.now()) return null;

  await supabase
    .from('sessions')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', session.id);

  const { data: role } = await supabase
    .from('user_roles')
    .select('id')
    .eq('user_id', session.user_id)
    .eq('role', 'admin')
    .maybeSingle();

  if (!role) return null;
  return { user_id: session.user_id };
}

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

    const admin = await requireAdmin(supabase, session_token);
    if (!admin) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: predictions, error } = await supabase
      .from('predictions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      console.error('admin-get-predictions error:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch predictions' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ predictions: predictions ?? [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('admin-get-predictions unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
