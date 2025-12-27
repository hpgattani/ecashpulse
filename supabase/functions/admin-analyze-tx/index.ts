import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ESCROW_ADDRESS = 'ecash:qz6jsgshsv0v2tyuleptwr4at8xaxsakmstkhzc0pp';
const CHRONIK_URL = 'https://chronik.be.cash/xec';

function addressToOutputScript(address: string): string | null {
  try {
    const addr = address.replace('ecash:', '');
    const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

    const data: number[] = [];
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
    const hashHex = hash.map((b) => b.toString(16).padStart(2, '0')).join('');

    return `76a914${hashHex}88ac`;
  } catch (error) {
    console.error('Address conversion error:', error);
    return null;
  }
}

function outputScriptToAddress(script: string): string | null {
  try {
    // P2PKH script format: 76a914<20-byte-hash>88ac
    if (!script.startsWith('76a914') || !script.endsWith('88ac') || script.length !== 50) {
      return null;
    }

    const hashHex = script.slice(6, 46);
    const hash: number[] = [];
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
    const address = 'ecash:q' + fullPayload.map((v) => CHARSET[v]).join('');

    return address;
  } catch (error) {
    console.error('Script to address conversion error:', error);
    return null;
  }
}

async function requireAdmin(supabase: any, session_token: string): Promise<{ user_id: string } | null> {
  const { data: session } = await supabase
    .from('sessions')
    .select('id, user_id, expires_at')
    .eq('token', session_token)
    .maybeSingle();

  if (!session) return null;

  const expiresMs = new Date(session.expires_at).getTime();
  if (!Number.isFinite(expiresMs) || expiresMs <= Date.now()) return null;

  await supabase
    .from('sessions')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', session.id);

  const { data: role } = await supabase
    .from('user_roles')
    .select('id')
    .eq('user_id', session.user_id)
    .eq('role', 'admin')
    .maybeSingle();

  if (!role) return null;
  return { user_id: session.user_id };
}

interface ChronikTx {
  txid: string;
  inputs?: Array<{ outputScript?: string }>;
  outputs?: Array<{ value?: string; outputScript?: string }>;
  timeFirstSeen?: number;
  block?: { height?: number; timestamp?: number; time?: number };
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

    const body = await req.json().catch(() => ({}));
    const session_token = typeof body?.session_token === 'string' ? body.session_token.trim() : '';
    const tx_hash = typeof body?.tx_hash === 'string' ? body.tx_hash.trim() : '';

    if (!session_token) {
      return new Response(JSON.stringify({ error: 'session_token required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = await requireAdmin(supabase, session_token);
    if (!admin) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!tx_hash || !/^[0-9a-f]{64}$/i.test(tx_hash)) {
      return new Response(JSON.stringify({ error: 'Invalid transaction hash' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const escrowScript = addressToOutputScript(ESCROW_ADDRESS);
    if (!escrowScript) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const response = await fetch(`${CHRONIK_URL}/tx/${tx_hash}`);
    if (!response.ok) {
      return new Response(JSON.stringify({ error: 'Transaction not found on blockchain' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tx: ChronikTx = await response.json();

    let amountToEscrow = 0;
    for (const out of tx.outputs ?? []) {
      const value = parseInt(out.value ?? '0');
      if (out.outputScript === escrowScript && Number.isFinite(value)) {
        amountToEscrow += value;
      }
    }

    let senderAddress: string | null = null;
    const firstInputScript = tx.inputs?.[0]?.outputScript;
    if (firstInputScript) {
      senderAddress = outputScriptToAddress(firstInputScript);
    }

    const timestampSecs =
      (typeof tx.timeFirstSeen === 'number' ? tx.timeFirstSeen : null) ??
      (typeof tx.block?.timestamp === 'number' ? tx.block.timestamp : null) ??
      (typeof tx.block?.time === 'number' ? tx.block.time : null) ??
      null;

    const timestamp = timestampSecs ? new Date(timestampSecs * 1000).toISOString() : null;

    return new Response(
      JSON.stringify({
        success: true,
        tx_hash,
        escrow_address: ESCROW_ADDRESS,
        amount_to_escrow: amountToEscrow,
        sender_address: senderAddress,
        timestamp,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('admin-analyze-tx unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
