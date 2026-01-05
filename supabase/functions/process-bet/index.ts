import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ESCROW_ADDRESS = 'ecash:qz6jsgshsv0v2tyuleptwr4at8xaxsakmstkhzc0pp';
const PLATFORM_FEE_PERCENT = 0.01;

function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Convert outputScript hex back to eCash cashaddr (supports P2PKH and P2SH)
function outputScriptToAddress(script: string): string | null {
  try {
    let hashHex: string;
    let versionByte: number;
    
    // P2PKH script format: 76a914<20-byte-hash>88ac
    if (script.startsWith('76a914') && script.endsWith('88ac') && script.length === 50) {
      hashHex = script.slice(6, 46);
      versionByte = 0; // P2PKH
    }
    // P2SH script format: a914<20-byte-hash>87
    else if (script.startsWith('a914') && script.endsWith('87') && script.length === 46) {
      hashHex = script.slice(4, 44);
      versionByte = 8; // P2SH
    }
    else {
      console.log(`Unsupported script format: ${script.substring(0, 20)}... (length: ${script.length})`);
      return null;
    }
    
    const hash: number[] = [];
    for (let i = 0; i < hashHex.length; i += 2) {
      hash.push(parseInt(hashHex.substr(i, 2), 16));
    }
    
    // Add version byte
    const payload8bit = [versionByte, ...hash];
    
    // Convert 8-bit bytes to 5-bit groups
    const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
    let acc = 0;
    let bits = 0;
    const payload5bit: number[] = [];
    
    for (const byte of payload8bit) {
      acc = (acc << 8) | byte;
      bits += 8;
      while (bits >= 5) {
        bits -= 5;
        payload5bit.push((acc >> bits) & 0x1f);
      }
    }
    if (bits > 0) {
      payload5bit.push((acc << (5 - bits)) & 0x1f);
    }
    
    // Calculate checksum (simplified - using polymod)
    const prefixData = [2, 3, 0, 19, 8, 0]; // "ecash" prefix as 5-bit values
    const checksumInput = [...prefixData, ...payload5bit, 0, 0, 0, 0, 0, 0, 0, 0];
    
    let c = 1;
    const generator = [0x98f2bc8e61, 0x79b76d99e2, 0xf33e5fb3c4, 0xae2eabe2a8, 0x1e4f43e470];
    for (const d of checksumInput) {
      const c0 = c >> 35;
      c = ((c & 0x07ffffffff) << 5) ^ d;
      for (let i = 0; i < 5; i++) {
        if ((c0 >> i) & 1) {
          c ^= generator[i];
        }
      }
    }
    c ^= 1;
    
    const checksum: number[] = [];
    for (let i = 0; i < 8; i++) {
      checksum.push((c >> (5 * (7 - i))) & 0x1f);
    }
    
    const fullPayload = [...payload5bit, ...checksum];
    // First character of payload determines p vs q prefix
    const prefix = versionByte === 0 ? 'ecash:q' : 'ecash:p';
    const address = prefix + fullPayload.slice(1).map(v => CHARSET[v]).join('');
    
    return address;
  } catch (error) {
    console.error('Script to address conversion error:', error);
    return null;
  }
}

// Get sender address from transaction using Chronik API
async function getSenderFromTx(txHash: string): Promise<string | null> {
  try {
    const response = await fetch(`https://chronik.fabien.cash/tx/${txHash}`);
    if (!response.ok) {
      console.error(`Chronik API error: ${response.status}`);
      return null;
    }
    
    const tx = await response.json();
    
    // Extract sender address from first input
    if (tx.inputs && tx.inputs.length > 0 && tx.inputs[0].outputScript) {
      return outputScriptToAddress(tx.inputs[0].outputScript);
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching tx from Chronik:', error);
    return null;
  }
}

async function validateSession(supabase: any, sessionToken: string | null | undefined) {
  if (!sessionToken || typeof sessionToken !== 'string') {
    return { valid: false, error: 'Session token is required' };
  }

  const trimmedToken = sessionToken.trim();
  if (trimmedToken.length !== 64) {
    return { valid: false, error: 'Invalid session token format' };
  }

  const { data: session, error } = await supabase
    .from('sessions')
    .select('user_id, expires_at')
    .eq('token', trimmedToken)
    .maybeSingle();

  if (error || !session) {
    return { valid: false, error: 'Invalid or expired session' };
  }

  if (new Date(session.expires_at) < new Date()) {
    await supabase.from('sessions').delete().eq('token', trimmedToken);
    return { valid: false, error: 'Session expired' };
  }

  await supabase
    .from('sessions')
    .update({ last_used_at: new Date().toISOString() })
    .eq('token', trimmedToken);

  return { valid: true, userId: session.user_id };
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

    const body = await req.json();
    console.log('Received body:', JSON.stringify({ ...body, session_token: '[REDACTED]' }));
    const { session_token, prediction_id, position, amount, tx_hash, outcome_id } = body;

    // Validate session and get authenticated user_id
    const sessionResult = await validateSession(supabase, session_token);
    if (!sessionResult.valid) {
      return new Response(
        JSON.stringify({ error: sessionResult.error }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let user_id = sessionResult.userId;
    console.log(`Processing bet: user=${user_id}, prediction=${prediction_id}, position=${position}, amount=${amount}`);

    // If tx_hash provided, verify the actual sender and use that user instead
    if (tx_hash) {
      const senderAddress = await getSenderFromTx(tx_hash);
      if (senderAddress) {
        const normalizedAddress = senderAddress.trim().toLowerCase();
        console.log(`Transaction sender address: ${normalizedAddress}`);
        
        // Get logged-in user's address
        const { data: loggedInUser } = await supabase
          .from('users')
          .select('ecash_address')
          .eq('id', user_id)
          .maybeSingle();
        
        const loggedInAddress = loggedInUser?.ecash_address?.trim().toLowerCase();
        
        // If sender differs from logged-in user, find or create user for sender
        if (loggedInAddress !== normalizedAddress) {
          console.log(`Sender (${normalizedAddress}) differs from logged-in user (${loggedInAddress})`);
          
          // Check if sender wallet already exists as a user
          let { data: senderUser } = await supabase
            .from('users')
            .select('id')
            .eq('ecash_address', normalizedAddress)
            .maybeSingle();
          
          if (!senderUser) {
            // Create new user for this wallet
            const { data: newUser, error: createError } = await supabase
              .from('users')
              .insert({ ecash_address: normalizedAddress })
              .select()
              .single();
            
            if (!createError && newUser) {
              senderUser = newUser;
              console.log(`Created new user for sender wallet: ${normalizedAddress}`);
            }
          }
          
          if (senderUser) {
            user_id = senderUser.id;
            console.log(`Re-attributed bet to actual sender: ${user_id}`);
          }
        }
      }
    }

    if (!prediction_id || !isValidUUID(prediction_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid prediction_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (position !== 'yes' && position !== 'no') {
      return new Response(
        JSON.stringify({ error: 'Position must be "yes" or "no"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const betAmount = typeof amount === 'number' ? amount : parseInt(amount);
    if (isNaN(betAmount) || betAmount < 1 || betAmount > 1000000000) {
      return new Response(
        JSON.stringify({ error: 'Amount must be between 1 XEC and 10M XEC' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify prediction exists and is active
    console.log('Checking prediction...');
    const { data: prediction, error: predError } = await supabase
      .from('predictions')
      .select('id, status, end_date')
      .eq('id', prediction_id)
      .maybeSingle();

    console.log('Prediction query result:', prediction ? 'found' : 'not found', predError ? predError.message : 'no error');

    if (predError || !prediction) {
      return new Response(
        JSON.stringify({ error: 'Prediction not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (prediction.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Prediction is no longer active' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (new Date(prediction.end_date) < new Date()) {
      console.log('Prediction has ended:', prediction.end_date);
      return new Response(
        JSON.stringify({ error: 'Prediction has ended' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate outcome_id if provided (for multi-option bets)
    if (outcome_id && !isValidUUID(outcome_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid outcome_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If outcome_id provided, verify it belongs to this prediction and update outcome pool
    if (outcome_id) {
      const { data: outcome, error: outcomeError } = await supabase
        .from('outcomes')
        .select('id, prediction_id, pool')
        .eq('id', outcome_id)
        .maybeSingle();

      if (outcomeError || !outcome || outcome.prediction_id !== prediction_id) {
        return new Response(
          JSON.stringify({ error: 'Invalid outcome for this prediction' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Create bet with confirmed status (payment already verified by PayButton)
    console.log('Creating bet in database...');
    const { data: bet, error: betError } = await supabase
      .from('bets')
      .insert({
        user_id,
        prediction_id,
        position,
        amount: betAmount,
        status: 'confirmed',
        tx_hash: tx_hash || null,
        confirmed_at: new Date().toISOString(),
        outcome_id: outcome_id || null
      })
      .select()
      .single();

    if (betError) {
      console.error('Error creating bet:', JSON.stringify(betError));
      return new Response(
        JSON.stringify({ error: 'Failed to create bet: ' + betError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Bet created successfully:', bet.id);

    // Record platform fee (1%)
    const feeAmount = Math.floor(betAmount * PLATFORM_FEE_PERCENT);
    await supabase.from('platform_fees').insert({
      bet_id: bet.id,
      amount: feeAmount,
    });

    // Pools for standard YES/NO bets are updated by the database trigger (update_prediction_pool).
    // For multi-option bets, we still need to update the selected outcome pool.
    if (outcome_id) {
      // Update outcome pool for multi-option bets
      const { data: currentOutcome } = await supabase
        .from('outcomes')
        .select('pool')
        .eq('id', outcome_id)
        .single();

      if (currentOutcome) {
        const { error: updateError } = await supabase
          .from('outcomes')
          .update({ pool: (currentOutcome.pool || 0) + betAmount })
          .eq('id', outcome_id);

        if (updateError) {
          console.error('Error updating outcome pool:', updateError);
        } else {
          console.log(`Updated pool for outcome ${outcome_id}`);
        }
      }
    }

    console.log(`Bet created: ${bet.id} for user ${user_id}, ${position} @ ${betAmount} XEC`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        bet_id: bet.id,
        amount: betAmount,
        position,
        escrow_address: ESCROW_ADDRESS,
        platform_fee: feeAmount,
        message: `Send ${betAmount} XEC to ${ESCROW_ADDRESS} to confirm your bet`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-bet function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
