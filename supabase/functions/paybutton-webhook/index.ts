import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as ed25519 from "https://esm.sh/@noble/ed25519@2.1.0";

/* -------------------- CORS -------------------- */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-paybutton-signature",
};

/* -------------------- PAYBUTTON KEY -------------------- */
const PAYBUTTON_PUBLIC_KEY = "302a300506032b6570032100bc0ff6268e2edb1232563603904e40af377243cd806372e427bd05f70bd1759a";

/* -------------------- HELPERS -------------------- */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function extractEd25519PublicKey(derHex: string): Uint8Array {
  // DER prefix + 32 byte key → take last 32 bytes
  return hexToBytes(derHex.slice(-64));
}

async function verifySignature(message: string, signatureHex: string, publicKey: Uint8Array): Promise<boolean> {
  try {
    const msgBytes = new TextEncoder().encode(message);
    const sigBytes = hexToBytes(signatureHex);
    return await ed25519.verifyAsync(sigBytes, msgBytes, publicKey);
  } catch {
    return false;
  }
}

function generateSessionToken(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

/* -------------------- TYPES -------------------- */
interface PayButtonWebhook {
  txid: string;
  address: string;
  amount: number;
  inputAddresses?: string[];
  opReturn?: string;
}

/* -------------------- SERVER -------------------- */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-paybutton-signature") || req.headers.get("X-PayButton-Signature");

    if (!signature) {
      return new Response("Missing signature", { status: 401 });
    }

    const publicKey = extractEd25519PublicKey(PAYBUTTON_PUBLIC_KEY);
    const valid = await verifySignature(rawBody, signature, publicKey);

    if (!valid) {
      return new Response("Invalid signature", { status: 401 });
    }

    /* -------------------------------------------------
       ✅ ACK PAYBUTTON IMMEDIATELY (CRITICAL FIX)
    ------------------------------------------------- */
    const ack = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    /* -------------------------------------------------
       🔄 ASYNC PROCESSING (NO TIMEOUT RISK)
    ------------------------------------------------- */
    queueMicrotask(async () => {
      try {
        const payload: PayButtonWebhook = JSON.parse(rawBody);
        const { txid, inputAddresses } = payload;

        const senderAddress = inputAddresses?.[0];
        if (!senderAddress) return;

        const ecashAddress = senderAddress.trim().toLowerCase();

        const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

        // Check existing user
        const { data: existingUser } = await supabase
          .from("users")
          .select("*")
          .eq("ecash_address", ecashAddress)
          .maybeSingle();

        let user = existingUser;

        if (!user) {
          const { data: newUser } = await supabase
            .from("users")
            .insert({ ecash_address: ecashAddress })
            .select()
            .single();
          user = newUser;
        } else {
          await supabase.from("users").update({ last_login_at: new Date().toISOString() }).eq("id", user.id);
        }

        if (!user) return;

        // Replace existing sessions
        await supabase.from("sessions").delete().eq("user_id", user.id);

        const token = generateSessionToken();
        const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        await supabase.from("sessions").insert({
          user_id: user.id,
          token,
          expires_at: expires.toISOString(),
        });

        console.log(`[PayButton] Auth success user=${user.id} tx=${txid}`);
      } catch (err) {
        console.error("[PayButton async error]", err);
      }
    });

    return ack;
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response("Server error", { status: 500 });
  }
});
