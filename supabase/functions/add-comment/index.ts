import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-session-token',
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

    const sessionToken = req.headers.get('x-session-token');
    if (!sessionToken) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - no session token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('user_id, expires_at')
      .eq('token', sessionToken)
      .single();

    if (sessionError || !session || new Date(session.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { prediction_id, content, parent_id } = await req.json();

    if (!prediction_id || !content || content.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing prediction_id or content' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (content.length > 1000) {
      return new Response(
        JSON.stringify({ error: 'Comment too long (max 1000 characters)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If parent_id provided, validate it exists and belongs to the same prediction
    let resolvedParentId = parent_id || null;
    if (resolvedParentId) {
      const { data: parentComment, error: parentError } = await supabase
        .from('comments')
        .select('id, prediction_id, parent_id')
        .eq('id', resolvedParentId)
        .single();

      if (parentError || !parentComment) {
        return new Response(
          JSON.stringify({ error: 'Parent comment not found' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (parentComment.prediction_id !== prediction_id) {
        return new Response(
          JSON.stringify({ error: 'Parent comment belongs to a different prediction' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Flatten: if replying to a reply, attach to the root parent instead
      if (parentComment.parent_id) {
        resolvedParentId = parentComment.parent_id;
      }
    }

    const { data, error } = await supabase
      .from('comments')
      .insert({
        prediction_id,
        user_id: session.user_id,
        content: content.trim(),
        parent_id: resolvedParentId,
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting comment:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to add comment' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Comment added:', data.id);
    return new Response(
      JSON.stringify({ success: true, comment: data }),
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
