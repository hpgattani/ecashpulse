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

    const { prediction_id, session_token } = await req.json();

    if (!session_token) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - no session token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate session and check admin role
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('user_id, expires_at')
      .eq('token', session_token)
      .single();

    if (sessionError || !session || new Date(session.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: adminRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user_id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!adminRole) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get prediction details
    const { data: prediction, error: predictionError } = await supabase
      .from('predictions')
      .select('*')
      .eq('id', prediction_id)
      .single();

    if (predictionError || !prediction) {
      return new Response(
        JSON.stringify({ error: 'Prediction not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (prediction.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Prediction is not active' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call Lovable AI to determine the outcome
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const currentDate = new Date().toISOString().split('T')[0];
    const prompt = `You are an AI oracle for a prediction market. Your task is to determine the outcome of predictions based on real-world events and publicly available information.

Prediction: "${prediction.title}"
${prediction.description ? `Description: ${prediction.description}` : ''}
Category: ${prediction.category}
End Date: ${prediction.end_date}
Current Date: ${currentDate}

Based on current real-world information as of today, has this prediction come true or not? 

IMPORTANT: 
- If the event has already occurred and the outcome is known, determine YES or NO
- If the event hasn't occurred yet but the end date has passed, determine based on what happened
- If you cannot determine the outcome with reasonable confidence, respond with UNCERTAIN

Respond with ONLY one of these three words: YES, NO, or UNCERTAIN

Your response:`;

    console.log('Calling Lovable AI for prediction:', prediction.title);

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Lovable AI error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error('Failed to get AI response');
    }

    const aiData = await aiResponse.json();
    const aiDecision = aiData.choices?.[0]?.message?.content?.trim().toUpperCase();
    
    console.log('AI Decision:', aiDecision);

    if (!['YES', 'NO', 'UNCERTAIN'].includes(aiDecision)) {
      return new Response(
        JSON.stringify({ error: 'AI could not determine outcome', ai_response: aiDecision }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (aiDecision === 'UNCERTAIN') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'AI could not determine the outcome with confidence. Manual resolution required.',
          ai_decision: 'UNCERTAIN'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update prediction status
    const newStatus = aiDecision === 'YES' ? 'resolved_yes' : 'resolved_no';
    
    const { error: updateError } = await supabase
      .from('predictions')
      .update({ 
        status: newStatus,
        resolved_at: new Date().toISOString()
      })
      .eq('id', prediction_id);

    if (updateError) {
      console.error('Error updating prediction:', updateError);
      throw new Error('Failed to update prediction status');
    }

    console.log(`Prediction ${prediction_id} resolved as ${newStatus}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        resolution: newStatus,
        ai_decision: aiDecision,
        message: `Prediction resolved as ${aiDecision}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ai-resolve:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
