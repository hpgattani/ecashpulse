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
      fee_amount,
      outcomes // Array of outcome labels for multi-option predictions
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
    
    // Detect multi-option questions
    const multiOptionPattern = /^(where|which|who|what|how many|how much)\b/i;
    const isMultiOption = multiOptionPattern.test(title.trim());
    
    // Validate outcomes for multi-option questions
    if (isMultiOption) {
      if (!outcomes || !Array.isArray(outcomes) || outcomes.length < 2) {
        return new Response(
          JSON.stringify({ error: 'Multi-option questions require at least 2 outcome options' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (outcomes.length > 6) {
        return new Response(
          JSON.stringify({ error: 'Maximum 6 outcome options allowed' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
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

    // Insert the prediction
    const { data: prediction, error: insertError } = await supabase
      .from('predictions')
      .insert({
        title: title.trim(),
        description: description?.trim() || null,
        category: category || 'crypto',
        end_date: endDateParsed.toISOString(),
        escrow_address: generatePendingEscrowAddress(),
        status: 'active',
        yes_pool: 0,
        no_pool: 0,
        creator_id: user_id,
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
    
    // Insert outcomes for multi-option predictions
    if (isMultiOption && outcomes && outcomes.length >= 2) {
      const outcomesToInsert = outcomes.map((label: string) => ({
        prediction_id: prediction.id,
        label: label.trim(),
        pool: 0,
      }));
      
      const { error: outcomesError } = await supabase
        .from('outcomes')
        .insert(outcomesToInsert);
      
      if (outcomesError) {
        console.error('Error inserting outcomes:', outcomesError);
      } else {
        console.log(`Inserted ${outcomes.length} outcomes for prediction ${prediction.id}`);
      }
    }

    // Log the submission
    console.log(`New prediction submitted by user ${user_id}:`);
    console.log(`  Title: ${title}`);
    console.log(`  Category: ${category}`);
    console.log(`  End Date: ${end_date}`);
    console.log(`  TX Hash: ${tx_hash}`);
    console.log(`  Fee: ${fee_amount} XEC`);
    console.log(`  Prediction ID: ${prediction.id}`);
    console.log(`  Multi-option: ${isMultiOption}, Outcomes: ${outcomes?.join(', ') || 'N/A'}`);

    // Record the fee payment
    if (tx_hash && fee_amount) {
      await supabase.from('platform_fees').insert({
        amount: fee_amount,
        tx_hash: tx_hash,
        bet_id: null,
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