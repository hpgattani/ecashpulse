import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_EMOJIS = ['👍', '❤️', '😂', '🔥', '👎', '🎯', '💎'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { session_token, message_id, emoji } = await req.json();

    if (!session_token || !message_id || !emoji) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate emoji
    if (!ALLOWED_EMOJIS.includes(emoji)) {
      return new Response(
        JSON.stringify({ error: 'Invalid emoji' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('user_id, expires_at')
      .eq('token', session_token)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: 'Invalid session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (new Date(session.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Session expired' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = session.user_id;

    // Verify message exists
    const { data: message } = await supabase
      .from('chat_messages')
      .select('id')
      .eq('id', message_id)
      .single();

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Message not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if reaction already exists (toggle behavior)
    const { data: existingReaction } = await supabase
      .from('chat_reactions')
      .select('id')
      .eq('message_id', message_id)
      .eq('user_id', userId)
      .eq('emoji', emoji)
      .single();

    if (existingReaction) {
      // Remove reaction
      await supabase
        .from('chat_reactions')
        .delete()
        .eq('id', existingReaction.id);

      return new Response(
        JSON.stringify({ success: true, action: 'removed' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Enforce limits: 👍 = max 1 per user per message, others = max 3 per user per message
      const maxAllowed = emoji === '👍' ? 1 : 3;
      
      const { data: userReactionsForEmoji } = await supabase
        .from('chat_reactions')
        .select('id')
        .eq('message_id', message_id)
        .eq('user_id', userId)
        .eq('emoji', emoji);

      const currentCount = userReactionsForEmoji?.length || 0;
      
      if (currentCount >= maxAllowed) {
        return new Response(
          JSON.stringify({ 
            error: emoji === '👍' 
              ? 'You can only give one 👍 per message' 
              : `You can only add ${maxAllowed} ${emoji} reactions per message`
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Add reaction
      const { error: insertError } = await supabase
        .from('chat_reactions')
        .insert({
          message_id,
          user_id: userId,
          emoji
        });

      if (insertError) {
        console.error('Insert error:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to add reaction' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, action: 'added' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
