// Reconciles raffle entry payments by scanning the escrow address on-chain.
// Catches payments where the PayButton onSuccess callback failed to fire or
// fired with a stale/old tx hash, so users never lose tickets.
// Optional body: { tx_hashes: string[] } — explicitly fetch and reconcile these txs too.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { scriptHexToCashAddr } from '../_shared/cashaddr.ts';
import {
  addressToOutputScript,
  chronikFetchAddressHistory,
  chronikFetchTx,
  txPaysExactly,
} from '../_shared/chronik.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ESCROW_ADDRESS = 'ecash:qz6jsgshsv0v2tyuleptwr4at8xaxsakmstkhzc0pp';

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
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let explicitTxHashes: string[] = [];
    try {
      const body = await req.json();
      if (Array.isArray(body?.tx_hashes)) explicitTxHashes = body.tx_hashes.filter((h: any) => typeof h === 'string');
    } catch (_) { /* no body */ }

    const escrowScript = addressToOutputScript(ESCROW_ADDRESS);
    if (!escrowScript) throw new Error('bad escrow address');

    // Load open raffles + their existing entries
    const { data: raffles, error: rErr } = await supabase
      .from('raffles')
      .select('id, entry_cost, teams, total_pot, status, teams_per_entry, created_at')
      .in('status', ['open', 'full']);
    if (rErr) throw rErr;
    if (!raffles?.length) {
      return new Response(JSON.stringify({ ok: true, message: 'no raffles' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // GLOBAL set of tx hashes already used by ANY raffle entry, across ALL raffles.
    // A single payment can only ever buy one ticket — never re-credit it to another raffle.
    const { data: allUsedRows } = await supabase.from('raffle_entries').select('tx_hash');
    const globalUsedTxs = new Set((allUsedRows || []).map((e: any) => e.tx_hash));

    const txs: any[] = await chronikFetchAddressHistory(ESCROW_ADDRESS, 50);
    const seen = new Set(txs.map((t: any) => t.txid));
    for (const h of explicitTxHashes) {
      if (seen.has(h)) continue;
      const tx = await chronikFetchTx(h);
      if (tx) {
        txs.unshift(tx);
        seen.add(h);
      } else {
        console.log(`[reconcile] explicit tx ${h} not found on any chronik endpoint`);
      }
    }
    console.log(`[reconcile] fetched ${txs.length} escrow txs (${explicitTxHashes.length} explicit), ${raffles.length} raffles`);

    let reconciled = 0;
    const actions: any[] = [];

    for (const raffle of raffles) {
      const expected = raffle.entry_cost; // XEC
      const raffleCreatedMs = new Date(raffle.created_at).getTime();
      // candidate txs that paid exactly entry_cost to escrow (chronik values are sats),
      // are not already credited to ANY raffle, and were sent AFTER this raffle was created.
      const candidates = txs.filter((tx: any) =>
        !globalUsedTxs.has(tx.txid) &&
        Number(tx.timeFirstSeen || 0) * 1000 >= raffleCreatedMs &&
        txPaysExactly(tx, escrowScript, expected));
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
