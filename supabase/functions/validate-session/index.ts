import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ecash_address } = await req.json();

    if (!ecash_address) {
      return new Response(JSON.stringify({ error: "Missing address" }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1️⃣ Find user created by PayButton webhook
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("ecash_address", ecash_address.toLowerCase())
      .maybeSingle();

    if (!user) {
      return new Response(JSON.stringify({ verified: false }), { headers: corsHeaders });
    }

    // 2️⃣ Find active session
    const { data: session } = await supabase
      .from("sessions")
      .select("token, expires_at")
      .eq("user_id", user.id)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!session) {
      return new Response(JSON.stringify({ verified: false }), { headers: corsHeaders });
    }

    // ✅ VERIFIED (SERVER ONLY)
    return new Response(
      JSON.stringify({
        verified: true,
        session_token: session.token,
      }),
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error("validate-session error:", error);
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500, headers: corsHeaders });
  }
});
