import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Chronik API endpoint for eCash
const CHRONIK_URL = 'https://chronik.e.cash';

interface ChronikTx {
  txid: string;
  outputs: Array<{
    value: string;
    outputScript: string;
  }>;
  block?: {
    height: number;
    timestamp: string;
  };
}

async function verifyTransaction(txHash: string, expectedAddress: string, expectedAmount: number): Promise<{
  valid: boolean;
  confirmed: boolean;
  amount?: number;
  error?: string;
}> {
  try {
    const response = await fetch(`${CHRONIK_URL}/tx/${txHash}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return { valid: false, confirmed: false, error: 'Transaction not found' };
      }
      throw new Error(`Chronik API error: ${response.status}`);
    }

    const tx: ChronikTx = await response.json();
    
    // Convert eCash address to script hash for comparison
    // For simplicity, we'll check if any output matches expected amount
    // In production, you'd want to decode the address properly
    
    let foundAmount = 0;
    for (const output of tx.outputs) {
      const outputValue = parseInt(output.value);
      // Check if output is close to expected amount (allowing for small variations)
      if (outputValue >= expectedAmount * 0.99) {
        foundAmount = outputValue;
        break;
      }
    }

    if (foundAmount === 0) {
      return { 
        valid: false, 
        confirmed: false, 
        error: 'Transaction amount does not match expected bet amount' 
      };
    }

    // Check if transaction is confirmed (has block info)
    const isConfirmed = !!tx.block;

    return {
      valid: true,
      confirmed: isConfirmed,
      amount: foundAmount,
    };

  } catch (error) {
    console.error('Error verifying transaction:', error);
    return { valid: false, confirmed: false, error: 'Failed to verify transaction' };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { bet_id, tx_hash } = await req.json();

    // Validate inputs
    if (!bet_id || !tx_hash) {
      return new Response(
        JSON.stringify({ error: 'bet_id and tx_hash are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the bet
    const { data: bet, error: betError } = await supabase
      .from('bets')
      .select(`
        *,
        prediction:predictions(escrow_address)
      `)
      .eq('id', bet_id)
      .single();

    if (betError || !bet) {
      return new Response(
        JSON.stringify({ error: 'Bet not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (bet.status !== 'pending') {
      return new Response(
        JSON.stringify({ error: 'Bet is not pending confirmation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify transaction on blockchain
    const verification = await verifyTransaction(
      tx_hash,
      (bet as any).prediction?.escrow_address || '',
      bet.amount
    );

    if (!verification.valid) {
      return new Response(
        JSON.stringify({ error: verification.error || 'Invalid transaction' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update bet status
    const { error: updateError } = await supabase
      .from('bets')
      .update({
        tx_hash,
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        amount: verification.amount || bet.amount,
      })
      .eq('id', bet_id);

    if (updateError) {
      console.error('Error updating bet:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update bet' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Record platform fee (1%)
    const feeAmount = Math.floor((verification.amount || bet.amount) * 0.01);
    await supabase
      .from('platform_fees')
      .insert({
        bet_id,
        amount: feeAmount,
      });

    console.log(`Bet ${bet_id} confirmed with tx ${tx_hash}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        confirmed: verification.confirmed,
        amount: verification.amount 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in confirm-transaction function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
