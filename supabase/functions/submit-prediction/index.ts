import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate a deterministic escrow address for pending predictions
function generatePendingEscrowAddress(): string {
  // Use the main platform escrow for pending submissions
  return 'ecash:qz6jsgshsv0v2tyuleptwr4at8xaxsakmstkhzc0pp';
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { 
      title, 
      description, 
      category, 
      end_date, 
      user_id, 
      tx_hash,
      fee_amount 
    } = await req.json();

    // Validation
    if (!title || typeof title !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Title is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!title.trim().endsWith('?')) {
      return new Response(
        JSON.stringify({ error: 'Title must be a question ending with ?' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (title.trim().length < 10) {
      return new Response(
        JSON.stringify({ error: 'Title must be at least 10 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!end_date) {
      return new Response(
        JSON.stringify({ error: 'End date is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const endDateParsed = new Date(end_date);
    if (endDateParsed <= new Date()) {
      return new Response(
        JSON.stringify({ error: 'End date must be in the future' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for duplicate/similar titles
    const { data: existingPredictions } = await supabase
      .from('predictions')
      .select('title')
      .ilike('title', `%${title.trim().slice(0, 50)}%`);

    if (existingPredictions && existingPredictions.length > 0) {
      console.log(`Warning: Similar prediction may exist: ${existingPredictions[0].title}`);
    }

    // Insert the prediction as pending (needs admin approval)
    // For now, we'll insert directly but mark for review via a separate system
    const { data: prediction, error: insertError } = await supabase
      .from('predictions')
      .insert({
        title: title.trim(),
        description: description?.trim() || null,
        category: category || 'crypto',
        end_date: endDateParsed.toISOString(),
        escrow_address: generatePendingEscrowAddress(),
        status: 'active', // Admin can change to cancelled if rejected
        yes_pool: 0,
        no_pool: 0,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting prediction:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create prediction' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the submission for admin review
    console.log(`New prediction submitted by user ${user_id}:`);
    console.log(`  Title: ${title}`);
    console.log(`  Category: ${category}`);
    console.log(`  End Date: ${end_date}`);
    console.log(`  TX Hash: ${tx_hash}`);
    console.log(`  Fee: ${fee_amount} XEC`);
    console.log(`  Prediction ID: ${prediction.id}`);

    // Record the fee payment (optional - for tracking)
    if (tx_hash && fee_amount) {
      await supabase.from('platform_fees').insert({
        amount: fee_amount,
        tx_hash: tx_hash,
        bet_id: null, // Not associated with a bet
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        prediction_id: prediction.id,
        message: 'Prediction submitted successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Submit prediction error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
