import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ESCROW_ADDRESS = 'ecash:qz6jsgshsv0v2tyuleptwr4at8xaxsakmstkhzc0pp';
const CHRONIK_URL = 'https://chronik.fabien.cash';

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
    timestamp: number;
  };
  timeFirstSeen: number;
}

interface TxAnalysis {
  txHash: string;
  senderAddress: string | null;
  escrowAmount: number;
  timestamp: Date;
  error?: string;
}

async function analyzeTx(txHash: string, escrowScript: string): Promise<TxAnalysis> {
  try {
    const response = await fetch(`${CHRONIK_URL}/tx/${txHash}`);
    
    if (!response.ok) {
      return { txHash, senderAddress: null, escrowAmount: 0, timestamp: new Date(), error: 'Transaction not found on blockchain' };
    }
    
    const tx: ChronikTx = await response.json();
    
    // Extract sender address from first input
    let senderAddress: string | null = null;
    if (tx.inputs && tx.inputs.length > 0 && tx.inputs[0].outputScript) {
      senderAddress = outputScriptToAddress(tx.inputs[0].outputScript);
    }
    
    // Find output that goes to escrow address
    let escrowAmount = 0;
    for (const output of tx.outputs) {
      if (output.outputScript === escrowScript) {
        escrowAmount = parseInt(output.value);
        break;
      }
    }
    
    // Get timestamp
    const timestamp = tx.block?.timestamp 
      ? new Date(tx.block.timestamp * 1000)
      : new Date(tx.timeFirstSeen * 1000);
    
    return { txHash, senderAddress, escrowAmount, timestamp };
  } catch (error) {
    console.error('Transaction analysis error:', error);
    return { txHash, senderAddress: null, escrowAmount: 0, timestamp: new Date(), error: 'Failed to analyze transaction' };
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

    const { tx_hashes, prediction_id, position } = await req.json();

    console.log('Manual bet registration request:', { tx_hashes, prediction_id, position });

    // Validate inputs
    if (!tx_hashes || !Array.isArray(tx_hashes) || tx_hashes.length === 0) {
      return new Response(
        JSON.stringify({ error: 'tx_hashes must be a non-empty array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!prediction_id) {
      return new Response(
        JSON.stringify({ error: 'prediction_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!position || !['yes', 'no'].includes(position)) {
      return new Response(
        JSON.stringify({ error: 'position must be "yes" or "no"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify prediction exists
    const { data: prediction, error: predError } = await supabase
      .from('predictions')
      .select('id, title, status')
      .eq('id', prediction_id)
      .single();

    if (predError || !prediction) {
      return new Response(
        JSON.stringify({ error: 'Prediction not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert escrow address to outputScript
    const escrowScript = addressToOutputScript(ESCROW_ADDRESS);
    if (!escrowScript) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: Array<{
      tx_hash: string;
      status: string;
      bet_id?: string;
      user_id?: string;
      amount?: number;
      error?: string;
    }> = [];

    for (const txHash of tx_hashes) {
      console.log(`\nProcessing tx: ${txHash}`);

      // Check if tx_hash is already used
      const { data: existingBet } = await supabase
        .from('bets')
        .select('id')
        .eq('tx_hash', txHash)
        .maybeSingle();

      if (existingBet) {
        results.push({ tx_hash: txHash, status: 'skipped', error: 'Transaction already registered', bet_id: existingBet.id });
        continue;
      }

      // Analyze transaction
      const analysis = await analyzeTx(txHash, escrowScript);
      
      if (analysis.error) {
        results.push({ tx_hash: txHash, status: 'error', error: analysis.error });
        continue;
      }

      if (analysis.escrowAmount === 0) {
        results.push({ tx_hash: txHash, status: 'error', error: 'No funds sent to escrow address' });
        continue;
      }

      if (!analysis.senderAddress) {
        results.push({ tx_hash: txHash, status: 'error', error: 'Could not determine sender address' });
        continue;
      }

      console.log(`TX ${txHash}: sender=${analysis.senderAddress}, amount=${analysis.escrowAmount}`);

      // Find or create user for sender address
      const normalizedAddress = analysis.senderAddress.trim().toLowerCase();
      let { data: existingUser } = await supabase
        .from('users')
        .select('id, ecash_address')
        .eq('ecash_address', normalizedAddress)
        .maybeSingle();

      let userId: string;

      if (!existingUser) {
        // Create new user
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({ ecash_address: normalizedAddress })
          .select()
          .single();

        if (createError || !newUser) {
          results.push({ tx_hash: txHash, status: 'error', error: 'Failed to create user' });
          continue;
        }
        userId = newUser.id;
        console.log(`Created new user ${userId} for address ${normalizedAddress}`);
      } else {
        userId = existingUser.id;
      }

      // Create the bet record
      const { data: newBet, error: betError } = await supabase
        .from('bets')
        .insert({
          user_id: userId,
          prediction_id: prediction_id,
          position: position,
          amount: analysis.escrowAmount,
          status: 'confirmed',
          tx_hash: txHash,
          confirmed_at: analysis.timestamp.toISOString(),
          created_at: analysis.timestamp.toISOString()
        })
        .select()
        .single();

      if (betError || !newBet) {
        console.error('Failed to create bet:', betError);
        results.push({ tx_hash: txHash, status: 'error', error: 'Failed to create bet record' });
        continue;
      }

      console.log(`Created bet ${newBet.id} for user ${userId}, amount ${analysis.escrowAmount}`);
      results.push({
        tx_hash: txHash,
        status: 'success',
        bet_id: newBet.id,
        user_id: userId,
        amount: analysis.escrowAmount
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        prediction: prediction.title,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Manual register bet error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
