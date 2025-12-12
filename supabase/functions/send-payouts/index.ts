// supabase/functions/send-payouts/index.ts
/**
 * send-payouts - Supabase Edge Function
 * - Finds 'won' bets without payout_tx_hash
 * - Batches payouts per recipient
 * - Builds & signs a single eCash transaction using ecash-agora
 * - Broadcasts via Chronik and updates DB with txid
 *
 * SECURITY: ESCROW_PRIVATE_KEY_WIF must be set as a Supabase secret.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const CHRONIK_URL = "https://chronik.be.cash/xec";
const ESCROW_ADDRESS = "ecash:qrr9z74jw9cfsu8sfzmd3pd72ftenu4dhc5nr02gav"; // update if needed

// ------------------------- Helpers & Types -------------------------

interface UTXO {
  outpoint: { txid: string; outIdx: number };
  blockHeight: number;
  isCoinbase: boolean;
  value: string; // sats as string
  isFinal: boolean;
  token?: any;
}

interface PayoutRecipient {
  address: string;
  amount: number; // sats
  betId: string;
  userId: string;
}

function log(...args: any[]) {
  console.log("[send-payouts]", ...args);
}
function warn(...args: any[]) {
  console.warn("[send-payouts]", ...args);
}
function failResp(msg: string, status = 500) {
  return new Response(JSON.stringify({ success: false, error: msg }), {
    status,
    headers: corsHeaders,
  });
}
function okResp(obj: any) {
  return new Response(JSON.stringify(obj), { status: 200, headers: corsHeaders });
}

function ensureEcashAddress(addr: string) {
  if (!addr || typeof addr !== "string") throw new Error("Invalid address");
  if (!addr.startsWith("ecash:")) throw new Error("Address must start with 'ecash:'");
  return addr;
}

async function fetchJson(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} - ${txt}`);
  }
  return res.json();
}

// ------------------------- UTXO / Chronik -------------------------

async function getUTXOs(address: string): Promise<UTXO[]> {
  try {
    const addressHash = address.replace("ecash:", "");
    const url = `${CHRONIK_URL}/script/p2pkh/${addressHash}/utxos`;
    const json = await fetchJson(url);
    return json.utxos ?? [];
  } catch (err) {
    warn("getUTXOs error:", err instanceof Error ? err.message : err);
    return [];
  }
}

// ------------------------- WIF decode (bs58check) -------------------------
async function decodeWIF(wif: string): Promise<Uint8Array> {
  try {
    const bs58check = await import("https://esm.sh/bs58check@3");
    const decoded: Uint8Array = bs58check.default.decode(wif);
    if (!decoded || decoded.length < 33) throw new Error("Invalid WIF length");
    const compressed = decoded.length === 34;
    const priv = decoded.slice(1, compressed ? 33 : decoded.length);
    return new Uint8Array(priv);
  } catch (err) {
    warn("decodeWIF failed:", err instanceof Error ? err.message : err);
    throw new Error("Invalid WIF");
  }
}

// ------------------------- Byte helpers -------------------------

const ensureHashBytes = (hash: any): Uint8Array => {
  if (hash instanceof Uint8Array) return hash;
  if (Array.isArray(hash)) return new Uint8Array(hash);
  if (typeof hash === "string") {
    const hex = hash.replace(/^0x/, "");
    const arr = new Uint8Array(hex.length / 2);
    for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.substr(i * 2, 2), 16);
    return arr;
  }
  return new Uint8Array(hash);
};

const bytesToHex = (bytes: Uint8Array): string => {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
};

// ------------------------- Build & Sign Tx with ecash-agora -------------------------
async function buildTransactionWithEcashAgora(
  privateKeyWIF: string,
  escrowAddress: string,
  recipients: PayoutRecipient[],
): Promise<{ txHex: string; txid: string } | null> {
  if (!recipients || recipients.length === 0) {
    warn("No recipients provided");
    return null;
  }
  try {
    const ecashAgora = await import("https://esm.sh/ecash-agora@0.2.1");
    const ecashaddr = await import("https://esm.sh/ecashaddrjs@1.5.13");

    const { Script, fromHex, toHex, TxBuilder, P2PKHSignatory, ALL_BIP143 } = ecashAgora as any;
    if (!Script || !TxBuilder || !P2PKHSignatory) throw new Error("ecash-agora missing exports");

    const privBytes = await decodeWIF(privateKeyWIF);
    if (!(privBytes instanceof Uint8Array) && !Array.isArray(privBytes)) {
      throw new Error("Private key is not Uint8Array");
    }

    const utxos = await getUTXOs(escrowAddress);
    if (!utxos || utxos.length === 0) {
      warn("No UTXOs found for escrow");
      return null;
    }

    const recipientsTotal = recipients.reduce((s, r) => s + Number(r.amount), 0);
    const estimatedSize = 10 + utxos.length * 150 + recipients.length * 35 + 50;
    const estimatedFee = Math.max(250, estimatedSize);
    let totalInput = 0n;
    const selected: UTXO[] = [];
    for (const u of utxos) {
      if ((u as any).token) continue;
      selected.push(u);
      totalInput += BigInt(u.value);
      if (totalInput >= BigInt(recipientsTotal + estimatedFee)) break;
    }

    if (totalInput < BigInt(recipientsTotal + estimatedFee)) {
      warn(`Insufficient funds: need ${recipientsTotal + estimatedFee}, have ${totalInput}`);
      return null;
    }

    const fee = BigInt(estimatedFee);
    const changeAmount = totalInput - BigInt(recipientsTotal) - fee;

    log(`Using ${selected.length} inputs, fee ${fee} sats, change ${changeAmount} sats`);

    const signatory = P2PKHSignatory(privBytes, ALL_BIP143);
    const txb = new TxBuilder();

    for (const u of selected) {
      txb.addInput({
        prevOut: {
          txid: u.outpoint.txid,
          outIdx: u.outpoint.outIdx,
        },
        signData: {
          value: BigInt(u.value),
          signatory,
        },
      });
    }

    for (const rec of recipients) {
      try {
        ensureEcashAddress(rec.address);
        const decoded = ecashaddr.decode(rec.address);
        const hashBytes = ensureHashBytes(decoded.hash);
        const script = Script.p2pkh(fromHex(bytesToHex(hashBytes)));
        txb.addOutput({
          value: BigInt(rec.amount),
          script,
        });
      } catch (err) {
        warn(
          "Skipping recipient (invalid address or decode error):",
          rec.address,
          err instanceof Error ? err.message : err,
        );
      }
    }

    if (changeAmount > 546n) {
      const decoded = ecashaddr.decode(escrowAddress);
      const hashBytes = ensureHashBytes(decoded.hash);
      const changeScript = Script.p2pkh(fromHex(bytesToHex(hashBytes)));
      txb.addOutput({
        value: changeAmount,
        script: changeScript,
      });
    }

    const tx = txb.sign();
    const txHex = toHex(tx.ser());
    const txid = toHex(tx.txid());
    return { txHex, txid };
  } catch (err) {
    warn("buildTransactionWithEcashAgora error:", err instanceof Error ? (err.stack ?? err.message) : err);
    return null;
  }
}

// ------------------------- Broadcast -------------------------
async function broadcastTransaction(txHex: string): Promise<string | null> {
  try {
    const res = await fetch(`${CHRONIK_URL}/tx`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawTx: txHex }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Chronik broadcast failed: ${res.status} ${res.statusText} ${body}`);
    }
    const json = await res.json();
    return json.txid ?? null;
  } catch (err) {
    warn("broadcastTransaction error:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ------------------------- MAIN -------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

  try {
    const body = await req.json().catch(() => ({}));
    const prediction_id = body?.prediction_id ?? null;
    log("Processing payouts for prediction:", prediction_id ?? "all pending");

    let query = supabase
      .from("bets")
      .select(
        `
        id,
        user_id,
        amount,
        payout_amount,
        users!inner(ecash_address)
      `,
      )
      .eq("status", "won")
      .is("payout_tx_hash", null)
      .not("payout_amount", "is", null);

    if (prediction_id) query = query.eq("prediction_id", prediction_id);

    const { data: wonBets, error: fetchError } = await query;

    if (fetchError) {
      log("DB fetch error:", fetchError);
      return failResp("Failed to fetch bets from DB");
    }

    if (!wonBets || wonBets.length === 0) {
      return okResp({ success: true, message: "No pending payouts", paid: 0 });
    }

    log(`Found ${wonBets.length} bets to pay out`);

    const userPayouts = new Map<string, PayoutRecipient>();
    for (const bet of wonBets as any[]) {
      // bet.users may be an array or object depending on select style
      let address: string | undefined;
      if (Array.isArray(bet.users)) {
        address = bet.users[0]?.ecash_address;
      } else {
        address = (bet.users as any)?.ecash_address;
      }

      if (!address) {
        warn("Skipping bet without address", bet.id);
        continue;
      }

      const existing = userPayouts.get(address);
      if (existing) {
        existing.amount += bet.payout_amount;
      } else {
        userPayouts.set(address, {
          address,
          amount: bet.payout_amount,
          betId: bet.id,
          userId: bet.user_id,
        });
      }
    }

    const recipients = Array.from(userPayouts.values());
    log(`Batched into ${recipients.length} recipients`);

    if (recipients.length === 0) return okResp({ success: true, message: "No valid recipients", paid: 0 });

    const escrowWIF = Deno.env.get("ESCROW_PRIVATE_KEY_WIF");
    if (!escrowWIF) {
      return failResp("ESCROW_PRIVATE_KEY_WIF not configured", 500);
    }

    try {
      ensureEcashAddress(ESCROW_ADDRESS);
    } catch (err) {
      return failResp(`Invalid escrow address: ${(err as Error).message}`, 500);
    }

    log("Building transaction...");
    const txResult = await buildTransactionWithEcashAgora(escrowWIF, ESCROW_ADDRESS, recipients);

    if (!txResult) {
      return failResp("Failed to build transaction", 500);
    }

    log("Broadcasting transaction...");
    const txid = await broadcastTransaction(txResult.txHex);
    if (!txid) return failResp("Broadcast failed", 500);

    log("Broadcast success txid:", txid);

    const betIds = (wonBets as any[]).map((b) => b.id);
    const { error: updateError } = await supabase
      .from("bets")
      .update({ payout_tx_hash: txid, status: "won" })
      .in("id", betIds);

    if (updateError) {
      warn("DB update failed after broadcast:", updateError);
      return failResp(`Payment sent (${txid}) but DB update failed: ${updateError.message}`, 500);
    }

    const totalPaid = recipients.reduce((s, r) => s + r.amount, 0);

    return okResp({
      success: true,
      tx_hash: txid,
      recipients: recipients.length,
      total_amount: totalPaid,
      bets_paid: wonBets.length,
      message: `Successfully paid ${recipients.length} winners (${wonBets.length} bets)`,
    });
  } catch (err) {
    console.error("Unhandled error:", err instanceof Error ? (err.stack ?? err.message) : err);
    return failResp("Internal error while sending payouts", 500);
  }
});
