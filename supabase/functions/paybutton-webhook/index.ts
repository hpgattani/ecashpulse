// validate-session/index.ts (Fixed: Added type guard for 'err' in catch block)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHRONIK_URL = "https://chronik.be.cash/xec";
const EXPECTED_AMOUNT = 546; // exact satoshis for 5.46 XEC

function generateSessionToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

interface ChronikTx {
  inputs: { address?: string | null }[];
  outputs: { value: string }[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session_token, ecash_address, tx_hash } = await req.json();
    console.log("[Verify] Incoming request:", { session_token: !!session_token, ecash_address, tx_hash });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    /* -------- SESSION REFRESH -------- */
    if (session_token) {
      const { data: session } = await supabase
        .from("sessions")
        .select("*")
        .eq("token", session_token)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      console.log("[Verify] Session refresh:", !!session);
      if (!session) {
        return new Response(JSON.stringify({ valid: false, error: "Invalid or expired session" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ valid: true, session_token }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    /* -------- LOGIN (ON-CHAIN ONLY) -------- */
    if (!ecash_address || !tx_hash) {
      console.error("[Verify] Missing params");
      return new Response(JSON.stringify({ valid: false, error: "Missing ecash_address or tx_hash" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const addr = ecash_address.trim().toLowerCase();
    console.log("[Verify] Verifying TX for address:", addr);

    // 🔍 Fetch TX from blockchain (retry once for indexing lag)
    let tx: ChronikTx | null = null;
    let fetchError: string | null = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(`${CHRONIK_URL}/tx/${tx_hash}`);
        console.log(`[Verify] Fetch attempt ${attempt} status:`, res.status);
        if (!res.ok) {
          fetchError = `HTTP ${res.status}: ${await res.text()}`;
          if (attempt === 1) await new Promise((r) => setTimeout(r, 30000)); // Wait 30s for confirmation
          continue;
        }
        tx = await res.json();
        break;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        fetchError = errMsg;
        console.error(`[Verify] Fetch error attempt ${attempt}:`, fetchError);
        if (attempt === 1) await new Promise((r) => setTimeout(r, 30000));
      }
    }

    if (!tx) {
      console.error("[Verify] TX not found after retries:", { tx_hash, error: fetchError });
      return new Response(
        JSON.stringify({
          valid: false,
          error: `TX not found or unconfirmed: ${fetchError || "Unknown error"}. Wait 1-2 min and retry.`,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const senderOk = tx.inputs.some((i) => (i.address || "").toLowerCase() === addr);
    const amountOk = tx.outputs.some((o) => parseInt(o.value) >= EXPECTED_AMOUNT);
    console.log("[Verify] Checks:", { senderOk, amountOk, expected: EXPECTED_AMOUNT });

    if (!senderOk) {
      return new Response(JSON.stringify({ valid: false, error: "TX sender address mismatch" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!amountOk) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: `Amount too low (got < ${EXPECTED_AMOUNT} sat, need >=${EXPECTED_AMOUNT})`,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ✅ Create / get user
    let { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("ecash_address", addr)
      .maybeSingle();
    console.log("[Verify] User lookup:", !!user, userError);
    if (!user && userError) {
      return new Response(JSON.stringify({ valid: false, error: `User lookup failed: ${userError.message}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!user) {
      const { data: newUser, error: insertError } = await supabase
        .from("users")
        .insert({ ecash_address: addr })
        .select()
        .single();
      if (insertError) {
        console.error("[Verify] User insert error:", insertError);
        return new Response(JSON.stringify({ valid: false, error: `User creation failed: ${insertError.message}` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      user = newUser;
      console.log("[Verify] New user created:", user.id);
    }

    // ✅ Create session (delete old first)
    await supabase.from("sessions").delete().eq("user_id", user.id);
    const token = generateSessionToken();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const { error: sessionError } = await supabase.from("sessions").insert({
      user_id: user.id,
      token,
      expires_at: expires.toISOString(),
    });
    if (sessionError) {
      console.error("[Verify] Session insert error:", sessionError);
      return new Response(JSON.stringify({ valid: false, error: `Session failed: ${sessionError.message}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[Verify] SUCCESS: Session created for", addr, token.substring(0, 8) + "...");
    return new Response(JSON.stringify({ valid: true, session_token: token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("validate-session error:", errMsg);
    return new Response(JSON.stringify({ valid: false, error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
