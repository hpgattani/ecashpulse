import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ChronikClient } from "https://esm.sh/chronik-client@0.8.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHRONIK_URL = "https://chronik.be.cash/xec";
const ESCROW_ADDRESS = "ecash:qrr9z74jw9cfsu8sfzmd3pd72ftenu4dhc5nr02gav";

// ==================== eCash Transaction Building ====================

interface UTXO {
  outpoint: { txid: string; outIdx: number };
  blockHeight: number;
  isCoinbase: boolean;
  value: string;
  isFinal: boolean;
  token?: any;
}

interface PayoutRecipient {
  address: string;
  amount: number;
  betId: string;
  userId: string;
}

// Decode WIF (Wallet Import Format) private key
function decodeWIF(wif: string): Uint8Array {
  const b58chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const decoded = [];

  for (let i = 0; i < wif.length; i++) {
    let carry = b58chars.indexOf(wif[i]);
    if (carry < 0) throw new Error("Invalid WIF character");

    for (let j = 0; j < decoded.length; j++) {
      carry += decoded[j] * 58;
      decoded[j] = carry & 0xff;
      carry >>= 8;
    }

    while (carry > 0) {
      decoded.push(carry & 0xff);
      carry >>= 8;
    }
  }

  // Remove checksum (last 4 bytes) and version byte (first byte)
  const payload = new Uint8Array(decoded.slice(1, decoded.length - 4));

  // If compressed flag exists (33 bytes), remove it (last byte)
  return payload.length === 33 ? payload.slice(0, 32) : payload;
}

// Convert eCash cashaddr to P2PKH outputScript hex
function addressToOutputScript(address: string): string | null {
  try {
    const addr = address.replace("ecash:", "");
    const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

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
    const hashHex = hash.map((b) => b.toString(16).padStart(2, "0")).join("");

    // P2PKH: OP_DUP OP_HASH160 <pubkeyhash> OP_EQUALVERIFY OP_CHECKSIG
    return `76a914${hashHex}88ac`;
  } catch (error) {
    console.error("Address conversion error:", error);
    return null;
  }
}

// Get UTXOs for an address
async function getUTXOs(address: string): Promise<UTXO[]> {
  try {
    const addressHash = address.replace("ecash:", "");
    const response = await fetch(`${CHRONIK_URL}/script/p2pkh/${addressHash}/utxos`);

    if (!response.ok) {
      console.error("Failed to fetch UTXOs:", response.status);
      return [];
    }

    const data = await response.json();
    return data.utxos || [];
  } catch (error) {
    console.error("Error fetching UTXOs:", error);
    return [];
  }
}

// Build and sign a transaction
async function buildAndSignTransaction(
  privateKeyWIF: string,
  escrowAddress: string,
  recipients: PayoutRecipient[],
  changeAddress: string,
): Promise<{ txHex: string; txid: string } | null> {
  try {
    // Get UTXOs from escrow address
    const utxos = await getUTXOs(escrowAddress);

    if (utxos.length === 0) {
      console.error("No UTXOs available in escrow");
      return null;
    }

    // Calculate total payout amount
    const totalPayout = recipients.reduce((sum, r) => sum + r.amount, 0);
    const estimatedFee = 250 + utxos.length * 150 + recipients.length * 35; // Conservative fee estimate
    const requiredAmount = totalPayout + estimatedFee;

    // Select UTXOs (simple strategy: use all)
    let totalInput = 0;
    const selectedUtxos: UTXO[] = [];

    for (const utxo of utxos) {
      if (utxo.token) continue; // Skip token UTXOs
      selectedUtxos.push(utxo);
      totalInput += parseInt(utxo.value);
      if (totalInput >= requiredAmount) break;
    }

    if (totalInput < requiredAmount) {
      console.error(`Insufficient funds: need ${requiredAmount}, have ${totalInput}`);
      return null;
    }

    const changeAmount = totalInput - totalPayout - estimatedFee;

    // Build transaction manually
    // This is a simplified implementation - in production, use a proper eCash library
    console.log(`Building tx: ${selectedUtxos.length} inputs, ${recipients.length} outputs, change: ${changeAmount}`);

    // For now, we'll use the Chronik broadcast endpoint with a pre-built transaction
    // In production, you should use ecash-lib or similar library to properly build and sign

    // This is a placeholder - actual implementation would require:
    // 1. Proper transaction serialization
    // 2. Signature generation using ECDSA
    // 3. Script building

    console.warn("Transaction building requires full eCash library integration");
    return null;
  } catch (error) {
    console.error("Error building transaction:", error);
    return null;
  }
}

// Build transaction using ecash-agora
async function buildTransactionWithEcashAgora(
  privateKeyWIF: string,
  escrowAddress: string,
  recipients: PayoutRecipient[],
): Promise<{ txHex: string; txid: string } | null> {
  try {
    // Import ecash-agora and ecashaddrjs
    const { Script, fromHex, toHex, shaRmd160, Tx, TxBuilder, P2PKHSignatory, ALL_BIP143 } = await import(
      "https://esm.sh/ecash-agora@0.2.1"
    );
    const ecashaddr = await import("https://esm.sh/ecashaddrjs@1.5.13");

    // Decode WIF private key
    const privateKeyBytes = decodeWIF(privateKeyWIF);

    // Get UTXOs
    const utxos = await getUTXOs(escrowAddress);
    if (utxos.length === 0) {
      console.error("No UTXOs available");
      return null;
    }

    // Calculate amounts
    const totalPayout = recipients.reduce((sum, r) => sum + r.amount, 0);
    let totalInput = 0;
    const selectedUtxos: UTXO[] = [];

    for (const utxo of utxos) {
      if (utxo.token) continue; // Skip token UTXOs
      selectedUtxos.push(utxo);
      totalInput += parseInt(utxo.value);
    }

    if (selectedUtxos.length === 0) {
      console.error("No usable UTXOs found");
      return null;
    }

    // Calculate fee (conservative estimate: 1 sat/byte)
    const estimatedSize = 10 + selectedUtxos.length * 150 + recipients.length * 35 + 50;
    const fee = Math.max(250, estimatedSize);
    const changeAmount = totalInput - totalPayout - fee;

    if (changeAmount < -fee) {
      console.error(`Insufficient funds: need ${totalPayout + fee}, have ${totalInput}`);
      return null;
    }

    console.log(`Building tx: ${selectedUtxos.length} inputs, ${recipients.length} outputs, change: ${changeAmount}`);

    // Create P2PKH signatory
    const signatory = P2PKHSignatory(privateKeyBytes, ALL_BIP143);

    // Build transaction using TxBuilder
    const txBuilder = new TxBuilder();

    // Add inputs
    for (const utxo of selectedUtxos) {
      txBuilder.addInput({
        prevOut: {
          txid: utxo.outpoint.txid,
          outIdx: utxo.outpoint.outIdx,
        },
        signData: {
          value: BigInt(utxo.value),
          signatory,
        },
      });
    }

    // Add payout outputs
    for (const recipient of recipients) {
      // Convert address to script
      const decoded = ecashaddr.decode(recipient.address);
      const script = Script.p2pkh(fromHex(decoded.hash));

      txBuilder.addOutput({
        value: BigInt(recipient.amount),
        script,
      });
    }

    // Add change output if significant (above dust threshold of 546 sats)
    if (changeAmount > 546) {
      const decoded = ecashaddr.decode(escrowAddress);
      const script = Script.p2pkh(fromHex(decoded.hash));

      txBuilder.addOutput({
        value: BigInt(changeAmount),
        script,
      });
    }

    // Build and sign transaction
    const tx = txBuilder.sign();
    const txHex = toHex(tx.ser());
    const txid = toHex(tx.txid());

    return { txHex, txid };
  } catch (error) {
    console.error("Error building transaction with ecash-agora:", error);
    console.error("Error details:", error instanceof Error ? error.stack : error);
    return null;
  }
}

// Broadcast transaction
async function broadcastTransaction(txHex: string): Promise<string | null> {
  try {
    const response = await fetch(`${CHRONIK_URL}/tx`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawTx: txHex }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Broadcast failed:", error);
      return null;
    }

    const data = await response.json();
    return data.txid;
  } catch (error) {
    console.error("Broadcast error:", error);
    return null;
  }
}

// ==================== MAIN HANDLER ====================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

  try {
    const { prediction_id } = await req.json();

    console.log(`Processing payouts for prediction: ${prediction_id || "all pending"}`);

    // Get all won bets that haven't been paid out yet
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

    if (prediction_id) {
      query = query.eq("prediction_id", prediction_id);
    }

    const { data: wonBets, error: fetchError } = await query;

    if (fetchError) {
      throw fetchError;
    }

    if (!wonBets || wonBets.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No pending payouts",
          paid: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`Found ${wonBets.length} bets to pay out`);

    // Group payouts by user (to batch multiple winnings)
    const userPayouts = new Map<string, PayoutRecipient>();

    for (const bet of wonBets) {
      const address = bet.users.ecash_address;
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
    console.log(`Batched into ${recipients.length} recipients`);

    // Get escrow wallet credentials from environment
    const escrowPrivateKey = Deno.env.get("ESCROW_PRIVATE_KEY_WIF");

    if (!escrowPrivateKey) {
      throw new Error("ESCROW_PRIVATE_KEY_WIF environment variable not set");
    }

    // Build and broadcast transaction
    console.log("Building transaction...");
    const txResult = await buildTransactionWithEcashAgora(escrowPrivateKey, ESCROW_ADDRESS, recipients);

    if (!txResult) {
      throw new Error("Failed to build transaction");
    }

    console.log("Broadcasting transaction...");
    const txid = await broadcastTransaction(txResult.txHex);

    if (!txid) {
      throw new Error("Failed to broadcast transaction");
    }

    console.log(`Transaction broadcast successfully: ${txid}`);

    // Update all paid bets with the transaction hash
    const betIds = wonBets.map((b) => b.id);
    const { error: updateError } = await supabase
      .from("bets")
      .update({
        payout_tx_hash: txid,
        status: "won", // Ensure status stays 'won'
      })
      .in("id", betIds);

    if (updateError) {
      console.error("Error updating bets:", updateError);
      // Transaction was sent, but database update failed - needs manual intervention
      throw new Error(`Payment sent (${txid}) but database update failed: ${updateError.message}`);
    }

    const totalPaid = recipients.reduce((sum, r) => sum + r.amount, 0);

    return new Response(
      JSON.stringify({
        success: true,
        tx_hash: txid,
        recipients: recipients.length,
        total_amount: totalPaid,
        bets_paid: wonBets.length,
        message: `Successfully paid ${recipients.length} winners (${wonBets.length} bets)`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Send payouts error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to send payouts",
        details: error instanceof Error ? error.stack : undefined,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
