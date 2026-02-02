import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Anti-spam configuration
const RATE_LIMIT = {
  MAX_MESSAGES_PER_WINDOW: 10, // Max messages per time window
  WINDOW_SECONDS: 60, // Time window in seconds
  MIN_INTERVAL_SECONDS: 2, // Minimum seconds between messages
  MAX_MESSAGE_LENGTH: 500, // Maximum message length
  MIN_MESSAGE_LENGTH: 1, // Minimum message length
};

// Spam patterns to block
const SPAM_PATTERNS = [
  /(.)\1{10,}/i, // Repeated characters (10+)
  /(https?:\/\/[^\s]+){3,}/i, // Multiple URLs
  /\b(buy|sell|free|click|subscribe|follow)\b.*\b(now|here|link)\b/i, // Marketing spam
  /\b(discord\.gg|t\.me|bit\.ly)\b/i, // Common spam links
];

function containsSpam(content: string): boolean {
  return SPAM_PATTERNS.some(pattern => pattern.test(content));
}

function sanitizeMessage(content: string): string {
  // Remove excessive whitespace
  let sanitized = content.replace(/\s+/g, ' ').trim();
  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
  return sanitized;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { session_token, encrypted_content, iv } = await req.json();

    if (!session_token || !encrypted_content || !iv) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
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

    // Validate encrypted content length (encrypted will be longer than plaintext)
    if (encrypted_content.length > RATE_LIMIT.MAX_MESSAGE_LENGTH * 4) {
      return new Response(
        JSON.stringify({ error: 'Message too long' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting check
    const now = new Date();
    const windowStart = new Date(now.getTime() - RATE_LIMIT.WINDOW_SECONDS * 1000);

    const { data: rateLimit } = await supabase
      .from('chat_rate_limits')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (rateLimit) {
      const lastMessageAt = new Date(rateLimit.last_message_at);
      const timeSinceLastMessage = (now.getTime() - lastMessageAt.getTime()) / 1000;

      // Check minimum interval
      if (timeSinceLastMessage < RATE_LIMIT.MIN_INTERVAL_SECONDS) {
        return new Response(
          JSON.stringify({ 
            error: `Please wait ${Math.ceil(RATE_LIMIT.MIN_INTERVAL_SECONDS - timeSinceLastMessage)} seconds before sending another message` 
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check rate limit within window
      const windowStartTime = new Date(rateLimit.window_start);
      if (windowStartTime > windowStart) {
        // Still within the same window
        if (rateLimit.message_count >= RATE_LIMIT.MAX_MESSAGES_PER_WINDOW) {
          const resetTime = new Date(windowStartTime.getTime() + RATE_LIMIT.WINDOW_SECONDS * 1000);
          const waitSeconds = Math.ceil((resetTime.getTime() - now.getTime()) / 1000);
          return new Response(
            JSON.stringify({ 
              error: `Rate limit exceeded. Please wait ${waitSeconds} seconds.` 
            }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update count
        await supabase
          .from('chat_rate_limits')
          .update({ 
            message_count: rateLimit.message_count + 1,
            last_message_at: now.toISOString()
          })
          .eq('user_id', userId);
      } else {
        // New window
        await supabase
          .from('chat_rate_limits')
          .update({ 
            message_count: 1,
            window_start: now.toISOString(),
            last_message_at: now.toISOString()
          })
          .eq('user_id', userId);
      }
    } else {
      // First message - create rate limit entry
      await supabase
        .from('chat_rate_limits')
        .insert({
          user_id: userId,
          message_count: 1,
          window_start: now.toISOString(),
          last_message_at: now.toISOString()
        });
    }

    // Insert the encrypted message
    const { data: message, error: insertError } = await supabase
      .from('chat_messages')
      .insert({
        user_id: userId,
        encrypted_content,
        iv
      })
      .select('id, created_at')
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to send message' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message_id: message.id, created_at: message.created_at }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
