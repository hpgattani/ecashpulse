import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as ed25519 from "https://esm.sh/@noble/ed25519@2.1.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-paybutton-signature",
};

const PAYBUTTON_PUBLIC_KEY = "302a300506032b6570032100bc0ff6268e2edb1232563603904e40af377243cd806372e427bd05f70bd1759a";
const EXPECTED_AMOUNT = 546; // satoshis for 5.46 XEC

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

function reconstructPayload(bodyObj: any): string {
  const keys = Object.keys(bodyObj).sort();
  return keys.map((k) => `${k}=${JSON.stringify(bodyObj[k])}`).join("+");
}

/* ---------- server ---------- */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    console.log("[Webhook] Raw body received:", rawBody.substring(0, 200) + "...");

    let signature = req.headers.get("x-paybutton-signature") || req.headers.get("X-PayButton-Signature");
    console.log("[Webhook] Signature header value:", signature ? signature.substring(0, 100) + "..." : "Missing");

    if (!signature) {
      console.error("[Webhook] Missing signature");
      return new Response(JSON.stringify({ ok: false, error: "Missing signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const publicKey = extractEd25519PublicKey(PAYBUTTON_PUBLIC_KEY);

    // Parse signature as JSON per PayButton docs
    let sigObj: { payload: string; signature: string } | null = null;
    let useFallback = false;
    try {
      sigObj = JSON.parse(signature);
      if (typeof sigObj.payload !== "string" || typeof sigObj.signature !== "string") {
        throw new Error("Invalid sigObj structure");
      }
    } catch (parseErr) {
      console.warn("[Webhook] Signature not JSON, falling back to raw hex mode:", parseErr.message);
      useFallback = true;
    }

    let validSig = false;
    if (useFallback) {
      // Old way: sign rawBody, sig as hex
      validSig = await verifySignature(rawBody, signature, publicKey);
    } else {
      // New way: reconstruct payload from body, match, then verify
      let bodyPayload;
      try {
        bodyPayload = JSON.parse(rawBody);
      } catch {
        return new Response(JSON.stringify({ ok: false, error: "Invalid JSON body" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const expectedPayload = reconstructPayload(bodyPayload);
      console.log("[Webhook] Reconstructed payload:", expectedPayload.substring(0, 200) + "...");
      console.log("[Webhook] Provided payload from header:", sigObj.payload.substring(0, 200) + "...");

      if (expectedPayload !== sigObj.payload) {
        console.error("[Webhook] Payload mismatch - possible tampering or wrong concat format");
        return new Response(JSON.stringify({ ok: false, error: "Payload mismatch" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      validSig = await verifySignature(sigObj.payload, sigObj.signature, publicKey);
    }

    console.log("[Webhook] Signature valid:", validSig);

    if (!validSig) {
      console.error("[Webhook] Invalid signature");
      return new Response(JSON.stringify({ ok: false, error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
      console.log("[Webhook] Parsed payload keys:", Object.keys(payload));
    } catch (parseErr) {
      console.error("[Webhook] JSON parse error:", parseErr);
      return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 🔥 handle ALL known PayButton payload shapes
    const sender = payload.inputAddresses?.[0] || payload.inputs?.[0]?.address || payload.from || null;
    console.log("[Webhook] Extracted sender:", sender);

    if (!sender) {
      console.error("[Webhook] PayButton payload missing sender:", payload);
      return new Response(JSON.stringify({ ok: false, error: "No sender address" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ecashAddress = sender.trim().toLowerCase();
    const totalAmount = (payload.outputs || []).reduce(
      (sum: number, out: any) => sum + (parseInt(out.value || 0) || 0),
      0,
    );
    console.log("[Webhook] Total amount check:", totalAmount >= EXPECTED_AMOUNT ? `${totalAmount}` : "FAIL");

    if (totalAmount < EXPECTED_AMOUNT) {
      return new Response(
        JSON.stringify({ ok: false, error: `Amount too low (got ${totalAmount} sat, need >=${EXPECTED_AMOUNT})` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    console.log("[Webhook] Supabase client created");

    // ---------- USER ----------
    let { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("ecash_address", ecashAddress)
      .maybeSingle();
    console.log("[Webhook] User query error:", userError, "User found:", !!user);

    if (!user) {
      const { data: newUser, error: insertError } = await supabase
        .from("users")
        .insert({ ecash_address: ecashAddress })
        .select()
        .single();
      if (insertError) {
        console.error("[Webhook] User insert error:", insertError);
        return new Response(JSON.stringify({ ok: false, error: `User creation failed: ${insertError.message}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      user = newUser;
      console.log("[Webhook] New user created:", user.id);
    }

    // ---------- SESSION ----------
    const { error: deleteError } = await supabase.from("sessions").delete().eq("user_id", user.id);
    if (deleteError) console.warn("[Webhook] Old session delete warning:", deleteError);

    const token = generateSessionToken();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const { error: insertSessionError } = await supabase.from("sessions").insert({
      user_id: user.id,
      token,
      expires_at: expires.toISOString(),
    });
    if (insertSessionError) {
      console.error("[Webhook] Session insert error:", insertSessionError);
      return new Response(
        JSON.stringify({ ok: false, error: `Session creation failed: ${insertSessionError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log("[PayButton] VERIFIED + SESSION CREATED", ecashAddress, "Token:", token.substring(0, 8) + "...");
    return new Response(JSON.stringify({ ok: true, session_token: token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("paybutton-webhook error:", err);
    return new Response(JSON.stringify({ ok: false, error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
