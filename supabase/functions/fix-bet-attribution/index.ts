import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

const CHRONIK_URL = 'https://chronik.be.cash/xec';

async function getSenderFromTx(txHash: string): Promise<string | null> {
  try {
    const response = await fetch(`${CHRONIK_URL}/tx/${txHash}`);
    if (!response.ok) {
      console.error(`Failed to fetch tx ${txHash}: ${response.status}`);
      return null;
    }
    
    const tx = await response.json();
    console.log(`Tx ${txHash} has ${tx.inputs?.length || 0} inputs`);
    
    if (tx.inputs && tx.inputs.length > 0 && tx.inputs[0].outputScript) {
      const address = outputScriptToAddress(tx.inputs[0].outputScript);
      console.log(`Sender address from tx ${txHash}: ${address}`);
      return address;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching tx ${txHash}:`, error);
    return null;
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

    const { bet_ids } = await req.json();
    
    if (!bet_ids || !Array.isArray(bet_ids)) {
      return new Response(
        JSON.stringify({ error: 'bet_ids array required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];

    for (const betId of bet_ids) {
      // Fetch the bet
      const { data: bet, error: betError } = await supabase
        .from('bets')
        .select('id, tx_hash, user_id, amount, position')
        .eq('id', betId)
        .single();

      if (betError || !bet) {
        results.push({ bet_id: betId, error: 'Bet not found' });
        continue;
      }

      if (!bet.tx_hash) {
        results.push({ bet_id: betId, error: 'No tx_hash for this bet' });
        continue;
      }

      // Get sender address from blockchain
      const senderAddress = await getSenderFromTx(bet.tx_hash);
      
      if (!senderAddress) {
        results.push({ bet_id: betId, tx_hash: bet.tx_hash, error: 'Could not determine sender' });
        continue;
      }

      console.log(`Bet ${betId}: tx ${bet.tx_hash} sender is ${senderAddress}`);

      // Find or create user for this address
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, ecash_address')
        .eq('ecash_address', senderAddress)
        .maybeSingle();

      let correctUserId: string;

      if (!existingUser) {
        // Create new user
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({ ecash_address: senderAddress })
          .select()
          .single();

        if (createError || !newUser) {
          results.push({ bet_id: betId, tx_hash: bet.tx_hash, sender: senderAddress, error: 'Failed to create user' });
          continue;
        }
        correctUserId = newUser.id;
        console.log(`Created new user for ${senderAddress}: ${newUser.id}`);
      } else {
        correctUserId = existingUser.id;
      }

      // Check if user_id needs updating
      if (correctUserId !== bet.user_id) {
        const { error: updateError } = await supabase
          .from('bets')
          .update({ user_id: correctUserId })
          .eq('id', betId);

        if (updateError) {
          results.push({ bet_id: betId, tx_hash: bet.tx_hash, sender: senderAddress, error: 'Failed to update bet' });
          continue;
        }

        results.push({
          bet_id: betId,
          tx_hash: bet.tx_hash,
          sender: senderAddress,
          old_user_id: bet.user_id,
          new_user_id: correctUserId,
          status: 'updated'
        });
      } else {
        results.push({
          bet_id: betId,
          tx_hash: bet.tx_hash,
          sender: senderAddress,
          user_id: bet.user_id,
          status: 'already_correct'
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
