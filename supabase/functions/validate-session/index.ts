import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AUTH_ADDRESS = "ecash:qrr9z74jw9cfsu8sfzmd3pd72ftenu4dhc5nr02gav";
const CHRONIK_URL = "https://chronik.be.cash/xec";

function generateSessionToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

interface ChronikTx {
  inputs: { address?: string | null }[];
  outputs: { value: string; outputScript: string }[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session_token, ecash_address, tx_hash } = await req.json();

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    /* ---------------- SESSION REFRESH ---------------- */
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

      const { data: user } = await supabase.from("users").select("*").eq("id", session.user_id).maybeSingle();

      return new Response(
        JSON.stringify({
          valid: true,
          user,
          session_token,
        }),
        { headers: corsHeaders },
      );
    }

    /* ---------------- LOGIN ---------------- */
    if (!ecash_address) {
      return new Response(JSON.stringify({ valid: false }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const address = ecash_address.trim().toLowerCase();

    let { data: user } = await supabase.from("users").select("*").eq("ecash_address", address).maybeSingle();

    let session = null;

    if (user) {
      const { data } = await supabase
        .from("sessions")
        .select("*")
        .eq("user_id", user.id)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      session = data;
    }

    /* --------- FALLBACK: CHRONIK VERIFY --------- */
    if (!session && tx_hash) {
      const res = await fetch(`${CHRONIK_URL}/tx/${tx_hash}`);
      if (!res.ok) {
        return new Response(JSON.stringify({ valid: false }), { headers: corsHeaders });
      }

      const tx: ChronikTx = await res.json();

      const senderOk = tx.inputs.some((i) => (i.address || "").toLowerCase() === address);

      if (!senderOk) {
        return new Response(JSON.stringify({ valid: false }), { headers: corsHeaders });
      }

      const amountOk = tx.outputs.some((o) => parseInt(o.value) >= 540);

      if (!amountOk) {
        return new Response(JSON.stringify({ valid: false }), { headers: corsHeaders });
      }

      if (!user) {
        const { data } = await supabase.from("users").insert({ ecash_address: address }).select().single();

        user = data;
      }

      const token = generateSessionToken();
      const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await supabase.from("sessions").insert({
        user_id: user.id,
        token,
        expires_at: expires.toISOString(),
      });

      session = { token };
    }

    if (!session) {
      return new Response(JSON.stringify({ valid: false }), { headers: corsHeaders });
    }

    return new Response(
      JSON.stringify({
        valid: true,
        user,
        session_token: session.token,
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
