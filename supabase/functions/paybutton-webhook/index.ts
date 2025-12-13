import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ORIGINAL expected amount (unchanged)
const EXPECTED_AMOUNT = 546; // 5.46 XEC

function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

interface PayButtonWebhook {
  txid: string;
  amount: number;
  address: string;
  inputAddresses?: string[];
  opReturn?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ✅ Just parse payload (like original)
    const payload: PayButtonWebhook = await req.json();

    const { txid, amount, inputAddresses } = payload;

    if (!txid || !inputAddresses?.length) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400, headers: corsHeaders });
    }

    // ORIGINAL sender logic
    const senderAddress = inputAddresses[0].trim().toLowerCase();

    // ORIGINAL amount logic (no leniency, no chain checks)
    if (Number(amount) !== EXPECTED_AMOUNT) {
      return new Response(JSON.stringify({ error: "Invalid amount" }), { status: 401, headers: corsHeaders });
    }

    // ---------- USER ----------
    let { data: user } = await supabase.from("users").select("*").eq("ecash_address", senderAddress).maybeSingle();

    if (!user) {
      const { data } = await supabase.from("users").insert({ ecash_address: senderAddress }).select().single();
      user = data;
    }

    // ---------- SESSION ----------
    await supabase.from("sessions").delete().eq("user_id", user.id);

    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await supabase.from("sessions").insert({
      user_id: user.id,
      token: sessionToken,
      expires_at: expiresAt.toISOString(),
    });

    console.log(`[PayButton] Auth success (original logic): ${senderAddress}, tx=${txid}`);

    return new Response(
      JSON.stringify({
        success: true,
        session_token: sessionToken,
        tx_hash: txid,
      }),
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error("PayButton webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: corsHeaders });
  }
});
