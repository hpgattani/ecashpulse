// Reconciles raffle entry payments by scanning the escrow address on-chain.
// Catches payments where the PayButton onSuccess callback failed to fire
// (mobile network drops, Cashtab closed too fast, etc.) so users never lose tickets.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { scriptHexToCashAddr } from '../_shared/cashaddr.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ESCROW_ADDRESS = 'ecash:qz6jsgshsv0v2tyuleptwr4at8xaxsakmstkhzc0pp';

const CHRONIK_ENDPOINTS = [
  'https://chronik.be.cash/xec',
  'https://chronik-native1.fabien.cash',
  'https://chronik-native2.fabien.cash',
  'https://chronik.pay2stay.com/xec',
];

function addressToOutputScript(address: string): string | null {
  const addr = address.replace('ecash:', '');
  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const data: number[] = [];
  for (let i = 0; i < addr.length; i++) {
    const idx = CHARSET.indexOf(addr[i].toLowerCase());
    if (idx === -1) return null;
    data.push(idx);
  }
  const payload5 = data.slice(0, data.length - 8);
  let acc = 0, bits = 0;
  const out: number[] = [];
  for (const v of payload5) {
    acc = (acc << 5) | v;
    bits += 5;
    while (bits >= 8) { bits -= 8; out.push((acc >> bits) & 0xff); }
  }
  if (out.length < 21) return null;
  const hashHex = out.slice(1, 21).map(b => b.toString(16).padStart(2, '0')).join('');
  return `76a914${hashHex}88ac`;
}

async function fetchHistory(): Promise<any[]> {
  const addr = ESCROW_ADDRESS.replace('ecash:', '');
  for (const base of CHRONIK_ENDPOINTS) {
    try {
      const res = await fetch(`${base}/address/${addr}/history?page=0&pageSize=50`);
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data?.txs)) return data.txs;
    } catch (_) { /* try next */ }
  }
  return [];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const escrowScript = addressToOutputScript(ESCROW_ADDRESS);
    if (!escrowScript) throw new Error('bad escrow address');

    // Load open raffles + their existing entries
    const { data: raffles, error: rErr } = await supabase
      .from('raffles')
      .select('id, entry_cost, teams, total_pot, status, teams_per_entry')
      .in('status', ['open', 'full']);
    if (rErr) throw rErr;
    if (!raffles?.length) {
      return new Response(JSON.stringify({ ok: true, message: 'no raffles' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const txs = await fetchHistory();
    console.log(`[reconcile] fetched ${txs.length} escrow txs, ${raffles.length} raffles`);

    let reconciled = 0;
    const actions: any[] = [];

    for (const raffle of raffles) {
      const expected = raffle.entry_cost;
      // candidate txs that paid exactly entry_cost to escrow
      const candidates = txs.filter((tx: any) => {
        for (const o of tx.outputs || []) {
          if (o.outputScript === escrowScript && parseInt(o.value) === expected) return true;
        }
        return false;
      });
      if (!candidates.length) continue;

      // existing entries for this raffle
      const { data: existing } = await supabase
        .from('raffle_entries')
        .select('assigned_team, tx_hash')
        .eq('raffle_id', raffle.id);
      const usedTxs = new Set((existing || []).map((e: any) => e.tx_hash));
      const takenTeams = new Set((existing || []).map((e: any) => e.assigned_team));

      for (const tx of candidates) {
        if (usedTxs.has(tx.txid)) continue;

        // Identify sender: take first input's outputScript -> cashaddr
        const senderScript: string | undefined = tx.inputs?.[0]?.outputScript;
        if (!senderScript) continue;
        const senderAddr = scriptHexToCashAddr(senderScript);
        if (!senderAddr) continue;

        // Resolve sender to a known user (direct address, then user_wallets alias)
        let userId: string | null = null;
        const { data: u1 } = await supabase
          .from('users').select('id').eq('ecash_address', senderAddr).maybeSingle();
        if (u1?.id) userId = u1.id;
        if (!userId) {
          const { data: w } = await supabase
            .from('user_wallets').select('user_id').eq('ecash_address', senderAddr).maybeSingle();
          if (w?.user_id) userId = w.user_id as string;
        }
        if (!userId) {
          console.log(`[reconcile] tx ${tx.txid} from unknown sender ${senderAddr} — skipping`);
          continue;
        }

        // Available teams
        const allTeams: string[] = Array.isArray(raffle.teams) ? raffle.teams : [];
        const avail = allTeams.filter((t) => !takenTeams.has(t));
        if (!avail.length) {
          console.log(`[reconcile] raffle ${raffle.id} has no teams left for tx ${tx.txid}`);
          continue;
        }
        const perEntry = Math.max(1, Number(raffle.teams_per_entry) || 1);
        const pick = shuffle(avail).slice(0, Math.min(perEntry, avail.length));

        const participantHash = await sha256Hex(senderAddr);

        const rows = pick.map((team) => ({
          raffle_id: raffle.id,
          user_id: userId,
          assigned_team: team,
          amount_paid: expected,
          tx_hash: tx.txid,
          participant_address_hash: participantHash,
        }));

        const { error: insErr } = await supabase.from('raffle_entries').insert(rows);
        if (insErr) {
          // duplicate (already inserted by another race) — fine, skip
          console.log(`[reconcile] insert error for tx ${tx.txid}: ${insErr.message}`);
          continue;
        }

        pick.forEach((t) => takenTeams.add(t));
        usedTxs.add(tx.txid);
        reconciled++;
        actions.push({ raffle_id: raffle.id, tx: tx.txid, user_id: userId, teams: pick });

        // update pot
        const newPot = (raffle.total_pot || 0) + expected;
        const remaining = allTeams.length - takenTeams.size;
        const newStatus = remaining === 0 ? 'full' : raffle.status;
        await supabase.from('raffles')
          .update({ total_pot: newPot, status: newStatus })
          .eq('id', raffle.id);
        raffle.total_pot = newPot;
        raffle.status = newStatus;

        console.log(`[reconcile] ✅ raffle ${raffle.id} tx ${tx.txid} → user ${userId} teams: ${pick.join(', ')}`);
      }
    }

    return new Response(JSON.stringify({ ok: true, reconciled, actions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('[reconcile] error:', e);
    return new Response(JSON.stringify({ error: e.message || 'failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
