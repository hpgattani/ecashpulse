import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { scriptHexToCashAddr } from "../_shared/cashaddr.ts";
import {
  addressToOutputScript,
  chronikFetchAddressHistory,
  txPaysExactly,
} from "../_shared/chronik.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ESCROW_ADDRESS = "ecash:qz6jsgshsv0v2tyuleptwr4at8xaxsakmstkhzc0pp";

// A tx-hash replay is only treated as a genuine duplicate onSuccess if the
// existing entries belong to the SAME user and were created very recently.
const REPLAY_WINDOW_MS = 30 * 60 * 1000;

// Hash address for anonymity
async function hashAddress(address: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(address);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Shuffle array using Fisher-Yates
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// When the client reports a stale tx hash (PayButton sometimes replays an OLD
// payment from the address history instead of the new one), scan the escrow
// address for the newest unclaimed payment of exactly entry_cost sent from one
// of this user's wallets, and use that tx instead.
async function findUnclaimedPayment(
  supabase: any,
  entryCostXec: number,
  usedTxs: Set<string>,
  userId: string,
  userAddress: string,
  raffleCreatedAt: string,
): Promise<string | null> {
  const escrowScript = addressToOutputScript(ESCROW_ADDRESS);
  if (!escrowScript) return null;

  const txs = await chronikFetchAddressHistory(ESCROW_ADDRESS, 50);
  if (!txs.length) {
    console.log("Stale-tx recovery: could not fetch escrow history");
    return null;
  }

  const userAddrs = new Set<string>([userAddress]);
  const { data: wallets } = await supabase
    .from("user_wallets")
    .select("ecash_address")
    .eq("user_id", userId);
  for (const w of wallets || []) userAddrs.add(w.ecash_address);

  const raffleCreatedMs = new Date(raffleCreatedAt).getTime();

  const candidates = txs
    .filter((tx: any) => !usedTxs.has(tx.txid) && txPaysExactly(tx, escrowScript, entryCostXec))
    // A valid ticket payment can never predate the raffle itself.
    .filter((tx: any) => Number(tx.timeFirstSeen || 0) * 1000 >= raffleCreatedMs)
    .filter((tx: any) => {
      const senderScript = tx.inputs?.[0]?.outputScript;
      const sender = senderScript ? scriptHexToCashAddr(senderScript) : null;
      return sender ? userAddrs.has(sender) : false;
    })
    .sort((a: any, b: any) => Number(b.timeFirstSeen || 0) - Number(a.timeFirstSeen || 0));

  if (!candidates.length) return null;

  // Exclude txs already credited to ANY raffle (global dedupe — one payment, one ticket).
  const ids = candidates.map((t: any) => t.txid);
  const { data: usedGlobal } = await supabase
    .from("raffle_entries")
    .select("tx_hash")
    .in("tx_hash", ids);
  const globalUsed = new Set((usedGlobal || []).map((e: any) => e.tx_hash));

  return candidates.find((t: any) => !globalUsed.has(t.txid))?.txid || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { raffle_id, session_token, tx_hash } = await req.json();

    console.log("Joining raffle:", { raffle_id });

    if (!raffle_id || !session_token) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate session
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("user_id, expires_at")
      .eq("token", session_token)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(session.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, ecash_address")
      .eq("id", session.user_id)
      .single();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get raffle
    const { data: raffle, error: raffleError } = await supabase
      .from("raffles")
      .select("*")
      .eq("id", raffle_id)
      .single();

    if (raffleError || !raffle) {
      return new Response(JSON.stringify({ error: "Raffle not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (raffle.status !== "open") {
      return new Response(JSON.stringify({ error: "Raffle is no longer open" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get existing entries to find available teams
    const { data: existingEntries, error: entriesError } = await supabase
      .from("raffle_entries")
      .select("assigned_team, participant_address_hash, tx_hash, user_id, created_at")
      .eq("raffle_id", raffle_id);

    if (entriesError) {
      console.error("Error fetching entries:", entriesError);
      return new Response(JSON.stringify({ error: "Failed to check entries" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const participantHash = await hashAddress(user.ecash_address);

    // The tx hash we will record. May be swapped if the client-reported hash is stale.
    let effectiveTxHash: string | undefined = tx_hash;

    // Idempotency: if this tx_hash already has entries on this raffle, it is only a
    // genuine duplicate (PayButton firing onSuccess twice) when the entries belong to
    // THIS user and were created moments ago. Otherwise the wallet/PayButton replayed
    // an OLD transaction hash from the address history — in that case we must NOT
    // return someone's old teams; instead we look for the real new payment on-chain.
    if (tx_hash) {
      const existingForTx = (existingEntries || []).filter((e: any) => e.tx_hash === tx_hash);
      if (existingForTx.length > 0) {
        const sameUser = existingForTx.every((e: any) => e.user_id === user.id);
        const newestMs = Math.max(...existingForTx.map((e: any) => new Date(e.created_at).getTime()));
        const isRecent = Date.now() - newestMs < REPLAY_WINDOW_MS;

        if (sameUser && isRecent) {
          const teams = existingForTx.map((e: any) => e.assigned_team);
          console.log(`Idempotent replay for tx ${tx_hash} — returning existing teams: ${teams.join(", ")}`);
          return new Response(JSON.stringify({
            success: true,
            entry: existingForTx[0],
            entries: existingForTx,
            assigned_team: teams[0],
            assigned_teams: teams,
            remaining_spots: (raffle.teams as string[]).length - (existingEntries?.length || 0),
            idempotent: true,
          }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Stale hash — recover the actual new payment from the chain.
        console.log(`Stale tx_hash ${tx_hash} (sameUser=${sameUser}, recent=${isRecent}) — searching chain for unclaimed payment`);
        const usedTxs = new Set((existingEntries || []).map((e: any) => e.tx_hash));
        const recovered = await findUnclaimedPayment(
          supabase,
          raffle.entry_cost,
          usedTxs,
          user.id,
          user.ecash_address,
        );

        if (!recovered) {
          console.log(`Stale tx_hash ${tx_hash}: no unclaimed payment found yet for user ${user.id}`);
          return new Response(JSON.stringify({
            success: false,
            error: "Payment received but not confirmed on-chain yet. Your ticket will be credited automatically within a few minutes — check My Entries shortly.",
            pending_reconciliation: true,
          }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        console.log(`Stale tx_hash ${tx_hash} recovered → real payment tx ${recovered}`);
        effectiveTxHash = recovered;
      }
    }

    const takenTeams = existingEntries?.map(e => e.assigned_team) || [];
    const allTeams = raffle.teams as string[];
    const availableTeams = allTeams.filter(t => !takenTeams.includes(t));

    if (availableTeams.length === 0) {
      return new Response(JSON.stringify({ error: "All teams have been claimed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const teamsPerEntry = Math.max(1, Number((raffle as any).teams_per_entry) || 1);
    const teamsToAssign = Math.min(teamsPerEntry, availableTeams.length);

    // Randomly assign N teams in a single ticket purchase
    const shuffled = shuffleArray(availableTeams);
    const assignedTeams = shuffled.slice(0, teamsToAssign);

    // Create entry rows (one per assigned team, sharing the same tx_hash)
    const sharedTxHash = effectiveTxHash || `entry_${Date.now()}`;
    const rows = assignedTeams.map((team) => ({
      raffle_id,
      user_id: user.id,
      assigned_team: team,
      amount_paid: raffle.entry_cost,
      tx_hash: sharedTxHash,
      participant_address_hash: participantHash,
    }));

    const { data: entries, error: entryError } = await supabase
      .from("raffle_entries")
      .insert(rows)
      .select();

    if (entryError) {
      // Race condition: another concurrent invocation for the SAME tx already
      // claimed teams for this user. Return those entries as success (idempotent).
      const code = (entryError as any).code;
      console.error("Error creating entry:", entryError);
      if (code === "23505" && sharedTxHash) {
        const { data: raceEntries } = await supabase
          .from("raffle_entries")
          .select("*")
          .eq("raffle_id", raffle_id)
          .eq("tx_hash", sharedTxHash)
          .eq("user_id", user.id);
        if (raceEntries && raceEntries.length > 0) {
          const teams = raceEntries.map((e: any) => e.assigned_team);
          console.log(`Race resolved for tx ${sharedTxHash} — returning existing teams: ${teams.join(", ")}`);
          return new Response(JSON.stringify({
            success: true,
            entry: raceEntries[0],
            entries: raceEntries,
            assigned_team: teams[0],
            assigned_teams: teams,
            remaining_spots: (raffle.teams as string[]).length - (existingEntries?.length || 0) - teams.length,
            idempotent: true,
          }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      return new Response(JSON.stringify({ error: "Failed to join raffle", details: (entryError as any).message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update raffle total pot (one ticket = one entry_cost regardless of teams_per_entry)
    const newPot = raffle.total_pot + raffle.entry_cost;
    const remainingSpots = availableTeams.length - teamsToAssign;

    // If all spots filled, mark raffle as full
    const newStatus = remainingSpots === 0 ? "full" : "open";

    await supabase
      .from("raffles")
      .update({ total_pot: newPot, status: newStatus })
      .eq("id", raffle_id);

    console.log(`User joined raffle ${raffle_id}, assigned teams: ${assignedTeams.join(", ")} (tx: ${sharedTxHash})`);

    return new Response(JSON.stringify({
      success: true,
      entry: entries?.[0],
      entries,
      assigned_team: assignedTeams[0],
      assigned_teams: assignedTeams,
      remaining_spots: remainingSpots,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
