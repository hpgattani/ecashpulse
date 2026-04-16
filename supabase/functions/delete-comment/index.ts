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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { comment_id, session_token } = await req.json();

    if (!comment_id || !session_token) {
      return new Response(
        JSON.stringify({ error: 'Missing comment_id or session_token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate session
    const { data: session } = await supabase
      .from('sessions')
      .select('user_id, expires_at')
      .eq('token', session_token)
      .single();

    if (!session || new Date(session.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify ownership
    const { data: comment } = await supabase
      .from('comments')
      .select('user_id')
      .eq('id', comment_id)
      .single();

    if (!comment || comment.user_id !== session.user_id) {
      return new Response(
        JSON.stringify({ error: 'Not authorized to delete this comment' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', comment_id);

    if (error) {
      return new Response(
        JSON.stringify({ error: 'Failed to delete comment' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
