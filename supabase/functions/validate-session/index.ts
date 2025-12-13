import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHRONIK_URL = "https://chronik.be.cash/xec";
const EXPECTED_AMOUNT = 540; // ~5.4 XEC (lenient)

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

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    /* -------- SESSION REFRESH -------- */
    if (session_token) {
      const { data: session } = await supabase
        .from("sessions")
        .select("*")
        .eq("token", session_token)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (!session) {
        return new Response(JSON.stringify({ valid: false }), { headers: corsHeaders });
      }

      return new Response(JSON.stringify({ valid: true, session_token }), { headers: corsHeaders });
    }

    /* -------- LOGIN (ON-CHAIN ONLY) -------- */
    if (!ecash_address || !tx_hash) {
      return new Response(JSON.stringify({ valid: false }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const addr = ecash_address.trim().toLowerCase();

    // 🔍 Fetch TX from blockchain
    const res = await fetch(`${CHRONIK_URL}/tx/${tx_hash}`);
    if (!res.ok) {
      return new Response(JSON.stringify({ valid: false }), { headers: corsHeaders });
    }

    const tx: ChronikTx = await res.json();

    const senderOk = tx.inputs.some((i) => (i.address || "").toLowerCase() === addr);

    const amountOk = tx.outputs.some((o) => parseInt(o.value) >= EXPECTED_AMOUNT);

    if (!senderOk || !amountOk) {
      return new Response(JSON.stringify({ valid: false }), { headers: corsHeaders });
    }

    // ✅ Create / get user
    let { data: user } = await supabase.from("users").select("*").eq("ecash_address", addr).maybeSingle();

    if (!user) {
      const { data } = await supabase.from("users").insert({ ecash_address: addr }).select().single();
      user = data;
    }

    // ✅ Create session
    const token = generateSessionToken();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await supabase.from("sessions").insert({
      user_id: user.id,
      token,
      expires_at: expires.toISOString(),
    });

    return new Response(
      JSON.stringify({
        valid: true,
        session_token: token,
      }),
      { headers: corsHeaders },
    );
  } catch (err) {
    console.error("validate-session error:", err);
    return new Response(JSON.stringify({ valid: false }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
