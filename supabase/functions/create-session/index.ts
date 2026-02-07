import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CHRONIK_URLS = [
  'https://chronik.fabien.cash',
  'https://chronik.e.cash',
];

// Platform auth wallet
const AUTH_WALLET = 'ecash:qz6jsgshsv0v2tyuleptwr4at8xaxsakmstkhzc0pp';

/**
 * Verify a transaction on-chain using Chronik.
 * Checks the tx exists, was sent FROM the claimed address, and TO the auth wallet.
 */
async function verifyTransactionOnChain(
  txHash: string,
  claimedSenderAddress: string
): Promise<{ valid: boolean; error?: string }> {
  for (const baseUrl of CHRONIK_URLS) {
    try {
      const resp = await fetch(`${baseUrl}/tx/${txHash}`);
      if (!resp.ok) {
        await resp.text();
        continue;
      }

      const tx = await resp.json();

      // Verify sender: check that at least one input address matches claimed address
      const inputAddresses: string[] = [];
      for (const input of tx.inputs || []) {
        const addr = input?.outputScript
          ? scriptToAddress(input.outputScript)
          : null;
        if (addr) inputAddresses.push(addr);
      }

      const normalizedClaimed = claimedSenderAddress.trim().toLowerCase().replace('ecash:', '');
      const senderMatch = inputAddresses.some(
        (a) => a.toLowerCase().replace('ecash:', '') === normalizedClaimed
      );

      if (!senderMatch) {
        return { valid: false, error: 'Transaction sender does not match claimed address' };
      }

      // Verify recipient: check that at least one output goes to the auth wallet
      const authHash = AUTH_WALLET.replace('ecash:', '').toLowerCase();
      const outputAddresses: string[] = [];
      for (const output of tx.outputs || []) {
        const addr = output?.outputScript
          ? scriptToAddress(output.outputScript)
          : null;
        if (addr) outputAddresses.push(addr);
      }

      const recipientMatch = outputAddresses.some(
        (a) => a.toLowerCase().replace('ecash:', '') === authHash
      );

      if (!recipientMatch) {
        return { valid: false, error: 'Transaction recipient is not the auth wallet' };
      }

      return { valid: true };
    } catch (err) {
      console.warn(`Chronik ${baseUrl} failed:`, err);
      continue;
    }
  }

  return { valid: false, error: 'Could not verify transaction on-chain' };
}

/**
 * Convert outputScript hex to cashaddr (p2pkh only, simplified).
 */
function scriptToAddress(scriptHex: string): string | null {
  try {
    // P2PKH: 76a914{20-byte-hash}88ac
    if (scriptHex.startsWith('76a914') && scriptHex.endsWith('88ac') && scriptHex.length === 50) {
      const hash = scriptHex.slice(6, 46);
      return encodeCashAddr('ecash', 0, hexToBytes(hash));
    }
    // P2SH: a914{20-byte-hash}87
    if (scriptHex.startsWith('a914') && scriptHex.endsWith('87') && scriptHex.length === 46) {
      const hash = scriptHex.slice(4, 44);
      return encodeCashAddr('ecash', 1, hexToBytes(hash));
    }
  } catch {
    // ignore
  }
  return null;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Minimal cashaddr encoder for eCash (prefix "ecash").
 */
function encodeCashAddr(prefix: string, type: number, hash: Uint8Array): string {
  const versionByte = (type << 3) | 0; // 160-bit hash
  const payload = new Uint8Array(1 + hash.length);
  payload[0] = versionByte;
  payload.set(hash, 1);

  const payloadBits = toBits(payload, 8);
  const paddedBits = convertBits(payloadBits, 5);

  const prefixData = prefixToUint5Array(prefix);
  const checksumInput = new Uint8Array(prefixData.length + 1 + paddedBits.length + 8);
  checksumInput.set(prefixData, 0);
  checksumInput[prefixData.length] = 0;
  checksumInput.set(paddedBits, prefixData.length + 1);

  const checksum = polymod(checksumInput);
  const checksumBytes = checksumToUint5Array(checksum);

  const combined = new Uint8Array(paddedBits.length + checksumBytes.length);
  combined.set(paddedBits, 0);
  combined.set(checksumBytes, paddedBits.length);

  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  let encoded = prefix + ':';
  for (const b of combined) {
    encoded += CHARSET[b];
  }
  return encoded;
}

function toBits(data: Uint8Array, bits: number): number[] {
  const result: number[] = [];
  for (const byte of data) {
    for (let i = bits - 1; i >= 0; i--) {
      result.push((byte >> i) & 1);
    }
  }
  return result;
}

function convertBits(bits: number[], toBitSize: number): Uint8Array {
  const result: number[] = [];
  let acc = 0;
  let accBits = 0;
  for (const bit of bits) {
    acc = (acc << 1) | bit;
    accBits++;
    if (accBits === toBitSize) {
      result.push(acc);
      acc = 0;
      accBits = 0;
    }
  }
  if (accBits > 0) {
    result.push(acc << (toBitSize - accBits));
  }
  return new Uint8Array(result);
}

function prefixToUint5Array(prefix: string): Uint8Array {
  const result = new Uint8Array(prefix.length);
  for (let i = 0; i < prefix.length; i++) {
    result[i] = prefix.charCodeAt(i) & 31;
  }
  return result;
}

function polymod(v: Uint8Array): bigint {
  const GENERATORS = [
    0x98f2bc8e61n,
    0x79b76d99e2n,
    0xf33e5fb3c4n,
    0xae2eabe2a8n,
    0x1e4f43e470n,
  ];
  let c = 1n;
  for (const d of v) {
    const c0 = c >> 35n;
    c = ((c & 0x07ffffffffn) << 5n) ^ BigInt(d);
    for (let i = 0; i < 5; i++) {
      if ((c0 >> BigInt(i)) & 1n) {
        c ^= GENERATORS[i];
      }
    }
  }
  return c ^ 1n;
}

function checksumToUint5Array(checksum: bigint): Uint8Array {
  const result = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    result[7 - i] = Number((checksum >> BigInt(i * 5)) & 31n);
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { ecash_address, tx_hash } = await req.json();

    if (!ecash_address) {
      return new Response(
        JSON.stringify({ error: 'eCash address required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!tx_hash || typeof tx_hash !== 'string' || tx_hash.length < 60) {
      return new Response(
        JSON.stringify({ error: 'Valid transaction hash required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trimmedAddress = ecash_address.trim().toLowerCase();
    console.log(`Creating session for address: ${trimmedAddress}, tx: ${tx_hash}`);

    // ── Step 1: Check if webhook already created a session for this address ──
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('ecash_address', trimmedAddress)
      .maybeSingle();

    if (existingUser) {
      const { data: existingSession } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', existingUser.id)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingSession) {
        // Webhook already created a valid session - return it
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', existingUser.id)
          .maybeSingle();

        console.log(`Returning existing webhook-created session for user: ${existingUser.id}`);
        return new Response(
          JSON.stringify({ success: true, user: existingUser, profile, session_token: existingSession.token }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ── Step 2: Server-side transaction verification via Chronik ──
    console.log(`No existing session found, verifying tx ${tx_hash} on-chain...`);
    const verification = await verifyTransactionOnChain(tx_hash, trimmedAddress);

    if (!verification.valid) {
      console.warn(`Tx verification failed: ${verification.error}`);
      return new Response(
        JSON.stringify({ error: verification.error || 'Transaction verification failed' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Tx ${tx_hash} verified on-chain. Creating session...`);

    // ── Step 3: Check if this tx was already used for a session (replay protection) ──
    const { data: existingAudit } = await supabase
      .from('bet_audit_log')
      .select('id')
      .eq('event_type', 'auth_tx_used')
      .eq('tx_hash', tx_hash)
      .maybeSingle();

    if (existingAudit) {
      return new Response(
        JSON.stringify({ error: 'This transaction was already used for authentication' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Step 4: Find or create user ──
    let user = existingUser;
    if (!user) {
      console.log('Creating new user for address:', trimmedAddress);
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({ ecash_address: trimmedAddress })
        .select()
        .single();

      if (createError) {
        console.error('Failed to create user:', createError);
        return new Response(
          JSON.stringify({ error: 'Failed to create user' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      user = newUser;
    }

    // Update last login
    await supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id);

    // Delete old sessions for this user
    await supabase.from('sessions').delete().eq('user_id', user.id);

    // Generate session token
    const tokenArray = new Uint8Array(32);
    crypto.getRandomValues(tokenArray);
    const token = Array.from(tokenArray, (b) => b.toString(16).padStart(2, '0')).join('');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Create session
    const { error: sessionError } = await supabase.from('sessions').insert({
      user_id: user.id,
      token,
      expires_at: expiresAt.toISOString(),
    });

    if (sessionError) {
      console.error('Failed to create session:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Failed to create session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the tx as used for auth (replay protection)
    await supabase.from('bet_audit_log').insert({
      event_type: 'auth_tx_used',
      tx_hash: tx_hash,
      user_id: user.id,
      metadata: { address: trimmedAddress },
    });

    // Get profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    console.log(`Session created successfully for user: ${user.id}`);

    return new Response(
      JSON.stringify({ success: true, user, profile, session_token: token }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Create session error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
