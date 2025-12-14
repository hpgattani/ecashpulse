import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Process payouts for winning bets
async function processPayouts(supabase: any, predictionId: string, winningPosition: 'yes' | 'no'): Promise<{ winners: number; totalPayout: number }> {
  // Get the prediction pools
  const { data: prediction } = await supabase
    .from('predictions')
    .select('yes_pool, no_pool, title')
    .eq('id', predictionId)
    .single();
  
  if (!prediction) throw new Error('Prediction not found');
  
  const totalPool = prediction.yes_pool + prediction.no_pool;
  const winningPool = winningPosition === 'yes' ? prediction.yes_pool : prediction.no_pool;
  
  // Get all winning bets
  const { data: winningBets } = await supabase
    .from('bets')
    .select('id, user_id, amount')
    .eq('prediction_id', predictionId)
    .eq('position', winningPosition)
    .eq('status', 'confirmed');
  
  if (!winningBets?.length) return { winners: 0, totalPayout: 0 };
  
  let totalPayout = 0;
  
  for (const bet of winningBets) {
    const payout = winningPool > 0 ? Math.floor((bet.amount / winningPool) * totalPool) : bet.amount;
    totalPayout += payout;
    
    await supabase
      .from('bets')
      .update({ status: 'won', payout_amount: payout })
      .eq('id', bet.id);
  }
  
  // Mark losing bets
  await supabase
    .from('bets')
    .update({ status: 'lost', payout_amount: 0 })
    .eq('prediction_id', predictionId)
    .eq('position', winningPosition === 'yes' ? 'no' : 'yes')
    .eq('status', 'confirmed');

  // Automatically send payments to winners
  try {
    console.log('Triggering automatic payment distribution...');
    const payoutResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-payouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({ prediction_id: predictionId })
    });

    if (payoutResponse.ok) {
      const payoutResult = await payoutResponse.json();
      console.log(`Automatic payments: ${JSON.stringify(payoutResult)}`);
    } else {
      const error = await payoutResponse.text();
      console.error(`Automatic payment failed: ${error}`);
    }
  } catch (error) {
    console.error('Error triggering automatic payments:', error);
  }

  return { winners: winningBets.length, totalPayout };
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
    const { prediction_id, outcome } = await req.json();
    
    if (!prediction_id || !['yes', 'no'].includes(outcome)) {
      return new Response(
        JSON.stringify({ error: 'Invalid prediction_id or outcome (yes/no)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update prediction status
    const status = outcome === 'yes' ? 'resolved_yes' : 'resolved_no';
    
    const { error: updateError } = await supabase
      .from('predictions')
      .update({ status, resolved_at: new Date().toISOString() })
      .eq('id', prediction_id);
    
    if (updateError) throw updateError;

    // Process payouts
    const payoutResult = await processPayouts(supabase, prediction_id, outcome);

    return new Response(
      JSON.stringify({ 
        success: true, 
        prediction_id,
        outcome,
        winners: payoutResult.winners,
        total_payout: payoutResult.totalPayout
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Resolution error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Resolution failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
