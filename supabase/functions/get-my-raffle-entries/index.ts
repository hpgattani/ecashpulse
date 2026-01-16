import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Hash address for comparison
async function hashAddress(address: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(address);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { session_token, raffle_id } = await req.json();

    if (!session_token) {
      return new Response(JSON.stringify({ error: "Session token required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate session
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("user_id, expires_at")
      .eq("token", session_token)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, ecash_address")
      .eq("id", session.user_id)
      .single();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const addressHash = await hashAddress(user.ecash_address);

    // Get user's entries
    let query = supabase
      .from("raffle_entries")
      .select("*, raffles(*)")
      .eq("participant_address_hash", addressHash)
      .order("created_at", { ascending: false });

    if (raffle_id) {
      query = query.eq("raffle_id", raffle_id);
    }

    const { data: entries, error } = await query;

    if (error) {
      console.error("Error fetching entries:", error);
      return new Response(JSON.stringify({ error: "Failed to fetch entries" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // User can see their own team assignments
    return new Response(JSON.stringify({ entries }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});