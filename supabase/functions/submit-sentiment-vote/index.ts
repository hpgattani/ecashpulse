import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple hash function for address anonymization
async function hashAddress(address: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(address + Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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

    const { topic_id, position, tx_hash, session_token } = await req.json();

    // Validate inputs
    if (!topic_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Topic ID required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!position || !['agree', 'disagree'].includes(position)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Valid position required (agree/disagree)' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!session_token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
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
        JSON.stringify({ success: false, error: 'Invalid session' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    if (new Date(session.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Session expired' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Get user's address
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('ecash_address')
      .eq('id', session.user_id)
      .single();

    if (userError || !userData) {
      return new Response(
        JSON.stringify({ success: false, error: 'User not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Verify topic exists and is active
    const { data: topic, error: topicError } = await supabase
      .from('sentiment_topics')
      .select('id, status, expires_at')
      .eq('id', topic_id)
      .single();

    if (topicError || !topic) {
      return new Response(
        JSON.stringify({ success: false, error: 'Topic not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    if (topic.status !== 'active' || new Date(topic.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Topic is no longer active' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Hash the voter's address for anonymity
    const addressHash = await hashAddress(userData.ecash_address);

    // Check if user already voted on this topic
    const { data: existingVote } = await supabase
      .from('sentiment_votes')
      .select('id')
      .eq('topic_id', topic_id)
      .eq('voter_address_hash', addressHash)
      .single();

    if (existingVote) {
      return new Response(
        JSON.stringify({ success: false, error: 'You have already voted on this topic' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Create the vote
    const { data: vote, error: voteError } = await supabase
      .from('sentiment_votes')
      .insert({
        topic_id,
        voter_address_hash: addressHash,
        position,
        tx_hash: tx_hash || null
      })
      .select()
      .single();

    if (voteError) {
      console.error('Error creating vote:', voteError);
      
      // Handle unique constraint violation (duplicate vote)
      if (voteError.code === '23505') {
        return new Response(
          JSON.stringify({ success: false, error: 'You have already voted on this topic' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to submit vote' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log(`Sentiment vote recorded: ${vote.id} - ${position} on topic ${topic_id} by hash ${addressHash.slice(0, 8)}...`);

    return new Response(
      JSON.stringify({ success: true, vote: { id: vote.id, position: vote.position } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in submit-sentiment-vote:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
