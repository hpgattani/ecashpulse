import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import sodium from "https://esm.sh/libsodium-wrappers-sumo";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-paybutton-signature",
};

// PayButton public key (HEX → Uint8Array)
const PAYBUTTON_PUBLIC_KEY_HEX =
  "302a300506032b6570032100bc0ff6268e2edb1232563603904e40af377243cd806372e427bd05f70bd1759a";

// WordPress uses libsodium crypto_sign_open
// This is the SAME primitive via WASM
function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

function generateSessionToken(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

interface PayButtonWebhook {
  txid: string;
  amount: number;
  inputAddresses?: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- INIT LIBSODIUM (WASM) ---
    await sodium.ready;

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // --- RAW BODY (CRITICAL) ---
    const rawBody = await req.text();

    const signatureBase64 = req.headers.get("x-paybutton-signature") || req.headers.get("X-PayButton-Signature");

    if (!signatureBase64) {
      console.error("Missing PayButton signature");
      return new Response("Missing signature", { status: 401 });
    }

    // WordPress: crypto_sign_open( signed_message, public_key )
    const signedMessage = sodium.from_base64(signatureBase64, sodium.base64_variants.ORIGINAL);

    const publicKey = hexToBytes(PAYBUTTON_PUBLIC_KEY_HEX).slice(-32);

    let openedMessage: Uint8Array;

    try {
      openedMessage = sodium.crypto_sign_open(signedMessage, publicKey);
    } catch (err) {
      console.error("crypto_sign_open FAILED", err);
      return new Response("Invalid signature", { status: 401 });
    }

    const decodedPayload = new TextDecoder().decode(openedMessage);

    // WordPress compares decoded payload to body
    if (decodedPayload !== rawBody) {
      console.error("Payload mismatch");
      return new Response("Payload mismatch", { status: 401 });
    }

    console.log("PayButton signature VERIFIED via libsodium");

    // --- PARSE JSON ---
    const payload: PayButtonWebhook = JSON.parse(rawBody);

    const { txid, inputAddresses } = payload;

    if (!txid || !inputAddresses?.length) {
      return new Response("Invalid payload", { status: 400 });
    }

    const userAddress = inputAddresses[0].trim().toLowerCase();

    // --- USER ---
    let { data: user } = await supabase.from("users").select("*").eq("ecash_address", userAddress).maybeSingle();

    if (!user) {
      const { data } = await supabase.from("users").insert({ ecash_address: userAddress }).select().single();
      user = data;
    }

    // --- SESSION ---
    await supabase.from("sessions").delete().eq("user_id", user.id);

    const token = generateSessionToken();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await supabase.from("sessions").insert({
      user_id: user.id,
      token,
      expires_at: expires.toISOString(),
    });

    console.log("Auth success (true WordPress crypto):", userAddress, txid);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook fatal error:", err);
    return new Response("Server error", { status: 500 });
  }
});
