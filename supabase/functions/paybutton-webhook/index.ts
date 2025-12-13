import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as ed25519 from "https://esm.sh/@noble/ed25519@2.1.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-paybutton-signature",
};

const PAYBUTTON_PUBLIC_KEY = "302a300506032b6570032100bc0ff6268e2edb1232563603904e40af377243cd806372e427bd05f70bd1759a";

/* ---------- helpers ---------- */
function hexToBytes(hex: string): Uint8Array {
  return Uint8Array.from(hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
}

function extractEd25519PublicKey(derHex: string): Uint8Array {
  return hexToBytes(derHex.slice(-64));
}

async function verifySignature(message: string, signatureHex: string, publicKey: Uint8Array) {
  const msg = new TextEncoder().encode(message);
  const sig = hexToBytes(signatureHex);
  return ed25519.verifyAsync(sig, msg, publicKey);
}

function generateSessionToken(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

/* ---------- server ---------- */
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

    const payload = JSON.parse(rawBody);

    // 🔥 handle ALL known PayButton payload shapes
    const sender = payload.inputAddresses?.[0] || payload.inputs?.[0]?.address || payload.from || null;

    if (!sender) {
      console.error("PayButton payload missing sender:", payload);
      return new Response("No sender address", { status: 400 });
    }

    const ecashAddress = sender.trim().toLowerCase();

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ---------- USER ----------
    let { data: user } = await supabase.from("users").select("*").eq("ecash_address", ecashAddress).maybeSingle();

    if (!user) {
      const { data } = await supabase.from("users").insert({ ecash_address: ecashAddress }).select().single();
      user = data;
    }

    // ---------- SESSION ----------
    await supabase.from("sessions").delete().eq("user_id", user.id);

    const token = generateSessionToken();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await supabase.from("sessions").insert({
      user_id: user.id,
      token,
      expires_at: expires.toISOString(),
    });

    console.log("[PayButton] VERIFIED + SESSION CREATED", ecashAddress);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("paybutton-webhook error:", err);
    return new Response("Server error", { status: 500 });
  }
});
