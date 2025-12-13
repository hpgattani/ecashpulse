import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Auth configuration: same wallet used for verification payments
const AUTH_ADDRESS = 'ecash:qqp5lj9c8v2s8vrjhcwu3v8t75nxz8l2h5r795qyc2';
const CHRONIK_URL = 'https://chronik.be.cash/xec';

// Convert eCash cashaddr to P2PKH outputScript hex (copied from confirm-transaction)
// For q-type (P2PKH) addresses: 76a914<20-byte-hash>88ac
function addressToOutputScript(address: string): string | null {
  try {
    // Remove ecash: prefix
    const addr = address.replace('ecash:', '');

    // Cashaddr uses a specific character set
    const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

    // Decode cashaddr to get the hash
    let data: number[] = [];
    for (let i = 0; i < addr.length; i++) {
      const charIndex = CHARSET.indexOf(addr[i].toLowerCase());
      if (charIndex === -1) return null;
      data.push(charIndex);
    }

    // Skip the type byte (first 5-bit value after removing checksum)
    // The checksum is 8 characters (40 bits)
    const payloadEnd = data.length - 8;
    const payload5bit = data.slice(0, payloadEnd);

    // Convert 5-bit groups to 8-bit bytes
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

    // First byte is version/type, rest is the 20-byte hash
    if (payload8bit.length < 21) return null;

    const hash = payload8bit.slice(1, 21);
    const hashHex = hash.map(b => b.toString(16).padStart(2, '0')).join('');

    // P2PKH script: OP_DUP OP_HASH160 <20-byte-hash> OP_EQUALVERIFY OP_CHECKSIG
    return `76a914${hashHex}88ac`;
  } catch (error) {
    console.error('Address conversion error:', error);
    return null;
  }
}

interface ChronikTx {
  txid: string;
  inputs: Array<{
    address?: string | null;
  }>;
  outputs: Array<{
    value: string;
    outputScript: string;
  }>;
}

// Generate a secure random token (copied from paybutton-webhook)
function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function verifyAuthTransaction(
  txHash: string,
  expectedAmount: number,
  escrowScript: string,
  senderAddress: string
): Promise<{ verified: boolean; actualAmount?: number; error?: string }> {
  try {
    if (!txHash || typeof txHash !== 'string' || !/^[0-9a-f]{64}$/i.test(txHash)) {
      return { verified: false, error: 'Invalid transaction hash format' };
    }

    const response = await fetch(`${CHRONIK_URL}/tx/${txHash}`);

    if (!response.ok) {
      return { verified: false, error: 'Transaction not found on blockchain' };
    }

    const tx: ChronikTx = await response.json();

    const normalizedSender = senderAddress.trim().toLowerCase();
    const hasSenderInput = tx.inputs?.some(
      (input) => (input.address || '').toLowerCase() === normalizedSender
    );

    if (!hasSenderInput) {
      return {
        verified: false,
        error: 'Transaction does not originate from the provided address',
      };
    }

    // Find output that goes to auth address with correct amount
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
        error: 'Transaction does not send funds to the auth address',
      };
    }

    if (foundAmount < expectedAmount * 0.99) {
      return {
        verified: false,
        actualAmount: foundAmount,
        error: `Amount to auth address insufficient: expected ${expectedAmount}, got ${foundAmount}`,
      };
    }

    return { verified: true, actualAmount: foundAmount };
  } catch (error) {
    console.error('Auth transaction verification error:', error);
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

    const { session_token, ecash_address, tx_hash } = await req.json();

    // Method 1: Validate by session token (for session refresh)
    if (session_token) {
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('*, users(*)')
        .eq('token', session_token)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (sessionError) {
        console.error('Session query error:', sessionError);
        return new Response(
          JSON.stringify({ valid: false, error: 'Failed to validate session' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!session) {
        return new Response(
          JSON.stringify({ valid: false, error: 'Session expired or invalid' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update last_used_at
      await supabase
        .from('sessions')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', session.id);

      // Get profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', session.user_id)
        .maybeSingle();

      return new Response(
        JSON.stringify({
          valid: true,
          user: session.users,
          profile,
          session_token,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Method 2: Find or create session by ecash_address (for login after payment)
    if (ecash_address) {
      const trimmedAddress = ecash_address.trim().toLowerCase();

      // Look up existing user
      const { data: existingUser, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('ecash_address', trimmedAddress)
        .maybeSingle();

      if (userError) {
        console.error('User query error:', userError);
        return new Response(
          JSON.stringify({ valid: false, error: 'Failed to validate user' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let user = existingUser;

      // Look for an active session for this user
      let session: any = null;
      if (user) {
        const { data: activeSession, error: sessionError } = await supabase
          .from('sessions')
          .select('*')
          .eq('user_id', user.id)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (sessionError) {
          console.error('Session query error:', sessionError);
          return new Response(
            JSON.stringify({ valid: false, error: 'Failed to validate session' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        session = activeSession || null;
      }

      // If we don't have a user or active session yet but we do have a tx_hash,
      // fall back to on-chain verification and create them server-side.
      if ((!user || !session) && tx_hash) {
        console.log(`Attempting on-chain auth for ${trimmedAddress} with tx ${tx_hash}`);

        const escrowScript = addressToOutputScript(AUTH_ADDRESS);
        if (!escrowScript) {
          console.error('Failed to convert auth address to script');
          return new Response(
            JSON.stringify({ valid: false, error: 'Server configuration error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const verification = await verifyAuthTransaction(
          tx_hash,
          546, // 5.46 XEC in satoshis
          escrowScript,
          trimmedAddress
        );

        if (!verification.verified) {
          console.log('On-chain auth verification failed:', verification.error);
          return new Response(
            JSON.stringify({
              valid: false,
              error: verification.error || 'On-chain verification failed',
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create user if they don't exist yet
        if (!user) {
          const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert({ ecash_address: trimmedAddress })
            .select()
            .single();

          if (insertError || !newUser) {
            console.error('Error creating user during auth:', insertError);
            return new Response(
              JSON.stringify({ valid: false, error: 'Failed to create account' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          user = newUser;
        }

        // Remove any existing sessions for this user
        await supabase.from('sessions').delete().eq('user_id', user.id);

        const sessionToken = generateSessionToken();
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

        const { data: newSession, error: sessionInsertError } = await supabase
          .from('sessions')
          .insert({
            user_id: user.id,
            token: sessionToken,
            expires_at: expiresAt.toISOString(),
          })
          .select()
          .single();

        if (sessionInsertError || !newSession) {
          console.error('Error creating auth session:', sessionInsertError);
          return new Response(
            JSON.stringify({ valid: false, error: 'Failed to create session' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        session = newSession;
      }

      if (!user) {
        console.log('User not found for address and no tx hash provided:', trimmedAddress);
        return new Response(
          JSON.stringify({ valid: false, error: 'User not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!session) {
        console.log('No active session found for user and no tx hash provided:', user.id);
        return new Response(
          JSON.stringify({
            valid: false,
            error: 'No active session - webhook may not have processed yet',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      console.log(`Session found for ${trimmedAddress}: ${session.id}`);

      return new Response(
        JSON.stringify({
          valid: true,
          user,
          profile,
          session_token: session.token,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ valid: false, error: 'Either session_token or ecash_address required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Validate session error:', error);
    return new Response(
      JSON.stringify({ valid: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
