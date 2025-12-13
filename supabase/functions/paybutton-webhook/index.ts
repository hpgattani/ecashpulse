import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// EXPECTED auth amount (unchanged)
const EXPECTED_AMOUNT = 5.46; // XEC

interface PayButtonWebhook {
  txid: string;
  amount: number;
  address: string;
  inputAddresses?: string[];
  opReturn?: string;
}

function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ✅ Just parse payload (NO signature verification)
    const payload: PayButtonWebhook = await req.json();

    const { txid, amount, inputAddresses } = payload;

    console.log("PayButton webhook received:", payload);

    if (!txid || !inputAddresses?.length) {
      return new Response(JSON.stringify({ error: "Invalid webhook payload" }), { status: 400, headers: corsHeaders });
    }

    const senderAddress = inputAddresses[0].trim().toLowerCase();

    // ✅ ORIGINAL amount check (same behavior)
    if (Number(amount) !== EXPECTED_AMOUNT) {
      console.error("Invalid amount:", amount);
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

    console.log(`Auth successful via webhook: ${senderAddress}, tx=${txid}`);

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
