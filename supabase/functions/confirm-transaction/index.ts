import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ESCROW_ADDRESS = 'ecash:qz6jsgshsv0v2tyuleptwr4at8xaxsakmstkhzc0pp';
const CHRONIK_URL = 'https://chronik.be.cash/xec';

// Convert eCash cashaddr to P2PKH outputScript hex
function addressToOutputScript(address: string): string | null {
  try {
    const addr = address.replace('ecash:', '');
    const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
    
    let data: number[] = [];
    for (let i = 0; i < addr.length; i++) {
      const charIndex = CHARSET.indexOf(addr[i].toLowerCase());
      if (charIndex === -1) return null;
      data.push(charIndex);
    }
    
    const payloadEnd = data.length - 8;
    const payload5bit = data.slice(0, payloadEnd);
    
    let acc = 0;
    let bits = 0;
    const payload8bit: number[] = [];
    
    for (const value of payload5bit) {
      acc = (acc << 5) | value;
      bits += 5;
      while (bits >= 8) {
        bits -= 8;
        payload8bit.push((acc >> bits) & 0xff);
      }
    }
    
    if (payload8bit.length < 21) return null;
    
    const hash = payload8bit.slice(1, 21);
    const hashHex = hash.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return `76a914${hashHex}88ac`;
  } catch (error) {
    console.error('Address conversion error:', error);
    return null;
  }
}

// Convert P2PKH outputScript hex back to eCash cashaddr
function outputScriptToAddress(script: string): string | null {
  try {
    // P2PKH script format: 76a914<20-byte-hash>88ac
    if (!script.startsWith('76a914') || !script.endsWith('88ac') || script.length !== 50) {
      return null;
    }
    
    const hashHex = script.slice(6, 46);
    const hash = [];
    for (let i = 0; i < hashHex.length; i += 2) {
      hash.push(parseInt(hashHex.substr(i, 2), 16));
    }
    
    // Add version byte (0 for P2PKH)
    const payload8bit = [0, ...hash];
    
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
    const address = 'ecash:q' + fullPayload.map(v => CHARSET[v]).join('');
    
    return address;
  } catch (error) {
    console.error('Script to address conversion error:', error);
    return null;
  }
}

interface ChronikTx {
  txid: string;
  inputs: Array<{
    outputScript: string;
  }>;
  outputs: Array<{
    value: string;
    outputScript: string;
  }>;
  block?: {
    height: number;
  };
}

interface VerificationResult {
  verified: boolean;
  actualAmount?: number;
  senderAddress?: string;
  error?: string;
}

async function verifyTransaction(txHash: string, expectedAmount: number, escrowScript: string): Promise<VerificationResult> {
  try {
    const response = await fetch(`${CHRONIK_URL}/tx/${txHash}`);
    
    if (!response.ok) {
      return { verified: false, error: 'Transaction not found on blockchain' };
    }
    
    const tx: ChronikTx = await response.json();
    
    // Extract sender address from first input
    let senderAddress: string | null = null;
    if (tx.inputs && tx.inputs.length > 0 && tx.inputs[0].outputScript) {
      senderAddress = outputScriptToAddress(tx.inputs[0].outputScript);
    }
    
    // Find output that goes to escrow address with correct amount
    let foundAmount = 0;
    let foundEscrowOutput = false;
    
    for (const output of tx.outputs) {
      const outputValue = parseInt(output.value);
      
      if (output.outputScript === escrowScript) {
        foundEscrowOutput = true;
        if (outputValue >= expectedAmount * 0.99) {
          foundAmount = outputValue;
          break;
        }
      }
    }
    
    if (!foundEscrowOutput) {
      return { 
        verified: false, 
        error: 'Transaction does not send funds to escrow address' 
      };
    }
    
    if (foundAmount < expectedAmount * 0.99) {
      return { 
        verified: false, 
        actualAmount: foundAmount,
        error: `Amount to escrow insufficient: expected ${expectedAmount}, got ${foundAmount}` 
      };
    }
    
    return { 
      verified: true, 
      actualAmount: foundAmount,
      senderAddress: senderAddress || undefined
    };
  } catch (error) {
    console.error('Transaction verification error:', error);
    return { verified: false, error: 'Failed to verify transaction' };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { bet_id, tx_hash } = await req.json();

    // Validate bet_id
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!bet_id || !uuidRegex.test(bet_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid bet_id format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate tx_hash
    if (!tx_hash || typeof tx_hash !== 'string' || !/^[0-9a-f]{64}$/i.test(tx_hash)) {
      return new Response(
        JSON.stringify({ error: 'Invalid transaction hash' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert escrow address to outputScript for verification
    const escrowScript = addressToOutputScript(ESCROW_ADDRESS);
    if (!escrowScript) {
      console.error('Failed to convert escrow address to script');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get bet details
    const { data: bet, error: betError } = await supabase
      .from('bets')
      .select('id, amount, status, user_id, prediction_id')
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

    // Check if tx_hash is already used
    const { data: existingBet } = await supabase
      .from('bets')
      .select('id')
      .eq('tx_hash', tx_hash)
      .neq('id', bet_id)
      .maybeSingle();

    if (existingBet) {
      return new Response(
        JSON.stringify({ error: 'Transaction already used for another bet' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify transaction with destination check
    const verification = await verifyTransaction(tx_hash, bet.amount, escrowScript);
    
    if (!verification.verified) {
      console.log(`Transaction verification failed for bet ${bet_id}: ${verification.error}`);
      return new Response(
        JSON.stringify({ error: verification.error || 'Transaction verification failed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine the correct user_id based on the actual paying wallet
    let actualUserId = bet.user_id;
    
    if (verification.senderAddress) {
      const normalizedAddress = verification.senderAddress.trim().toLowerCase();
      console.log(`Transaction sender address: ${normalizedAddress}`);
      
      // Check if this wallet already exists as a user
      let { data: senderUser } = await supabase
        .from('users')
        .select('id, ecash_address')
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
          console.log(`Created new user for wallet: ${normalizedAddress}`);
        }
      }
      
      if (senderUser && senderUser.id !== bet.user_id) {
        actualUserId = senderUser.id;
        console.log(`Updating bet user_id from ${bet.user_id} to ${actualUserId} (actual paying wallet)`);
      }
    }

    // Update bet status and user_id if different
    const updateData: Record<string, any> = {
      status: 'confirmed',
      tx_hash: tx_hash,
      confirmed_at: new Date().toISOString()
    };
    
    if (actualUserId !== bet.user_id) {
      updateData.user_id = actualUserId;
    }

    const { error: updateError } = await supabase
      .from('bets')
      .update(updateData)
      .eq('id', bet_id);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Failed to confirm bet' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Bet ${bet_id} confirmed with tx ${tx_hash} - verified escrow destination, user_id: ${actualUserId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Bet confirmed successfully',
        bet_id,
        tx_hash,
        amount: verification.actualAmount,
        user_id: actualUserId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Confirm transaction error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
