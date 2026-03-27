import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prediction_id } = await req.json();
    if (!prediction_id) {
      return new Response(JSON.stringify({ error: "prediction_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Check cache first
    const { data: cached } = await supabase
      .from("prediction_stats")
      .select("stats_json, expires_at")
      .eq("prediction_id", prediction_id)
      .single();

    if (cached && new Date(cached.expires_at) > new Date()) {
      return new Response(JSON.stringify({ stats: cached.stats_json, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch prediction details
    const { data: prediction, error: predErr } = await supabase
      .from("predictions")
      .select("title, category, description")
      .eq("id", prediction_id)
      .single();

    if (predErr || !prediction) {
      return new Response(JSON.stringify({ error: "Prediction not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Use Perplexity to get real-time grounded data
    let searchContext = "";
    if (PERPLEXITY_API_KEY) {
      try {
        const searchQuery = prediction.category === "sports"
          ? `${prediction.title} latest results stats standings form guide ${new Date().getFullYear()}`
          : prediction.category === "crypto"
          ? `${prediction.title} current price market data today`
          : `${prediction.title} latest news facts data ${new Date().getFullYear()}`;

        const perplexityRes = await fetch("https://api.perplexity.ai/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "sonar",
            messages: [
              { role: "system", content: "Provide factual, up-to-date data with specific numbers, dates, and results. Be precise and cite sources." },
              { role: "user", content: searchQuery },
            ],
            search_recency_filter: "week",
          }),
        });

        if (perplexityRes.ok) {
          const perplexityData = await perplexityRes.json();
          searchContext = perplexityData.choices?.[0]?.message?.content || "";
          const citations = perplexityData.citations || [];
          if (citations.length > 0) {
            searchContext += "\n\nSources: " + citations.slice(0, 5).join(", ");
          }
          console.log("Perplexity search successful, got", searchContext.length, "chars");
        } else {
          console.error("Perplexity search failed:", perplexityRes.status);
        }
      } catch (e) {
        console.error("Perplexity search error:", e);
      }
    }

    // Step 2: Build category-specific prompt with real data context
    const realDataBlock = searchContext
      ? `\n\nREAL-TIME DATA (use ONLY this data for facts, numbers, and results — do NOT invent or estimate any data):\n${searchContext}`
      : "\n\nIMPORTANT: No real-time data available. For every stat, clearly label it as 'estimated' or 'unverified'. Do NOT present any number as factual.";

    const categoryPrompts: Record<string, string> = {
      sports: `Analyze this sports prediction market: "${prediction.title}"${realDataBlock}

Return a JSON object with these sections (use null for any section where you lack verified data):
{
  "head_to_head": { "summary": "Brief h2h summary", "records": [{"label": "Last 5 meetings", "value": "e.g. Team A: 3W, Team B: 1W, 1D"}] },
  "form_guide": { "team_a": {"name": "Team name", "recent": [{"opponent": "vs X", "result": "W 3-1", "date": "Mar 2026"}]}, "team_b": {"name": "Team name", "recent": [{"opponent": "vs Y", "result": "L 0-2", "date": "Mar 2026"}]} },
  "key_stats": [{"label": "stat name", "team_a": "value", "team_b": "value"}],
  "insight": "One-line analytical insight for bettors"
}`,
      crypto: `Analyze this crypto prediction market: "${prediction.title}"${realDataBlock}

Return a JSON object with these sections (use null for any section where you lack verified data):
{
  "price_context": { "current_price": "latest known price", "price_30d_change": "% change", "price_7d_change": "% change" },
  "key_metrics": [{"label": "metric name", "value": "metric value"}],
  "market_sentiment": { "summary": "brief sentiment analysis", "signals": [{"label": "signal name", "direction": "bullish|bearish|neutral"}] },
  "insight": "One-line analytical insight for bettors"
}`,
      default: `Analyze this prediction market: "${prediction.title}" (category: ${prediction.category})${realDataBlock}

Return a JSON object with these sections (use null for any section where you lack verified data):
{
  "context": { "summary": "2-3 sentence background context" },
  "key_factors": [{"label": "factor name", "detail": "brief explanation", "direction": "for|against|neutral"}],
  "historical_precedent": { "summary": "relevant historical comparison if any" },
  "insight": "One-line analytical insight for bettors"
}`
    };

    const prompt = categoryPrompts[prediction.category] || categoryPrompts.default;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "You are a sports and market analytics expert. Return ONLY valid JSON, no markdown fences. Be concise and data-driven. ONLY use facts from the provided real-time data. If no real-time data is provided, clearly label everything as estimated. NEVER invent specific scores, dates, or statistics. Current date: " + new Date().toISOString().split("T")[0],
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again later" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI gateway error:", status, await aiResponse.text());
      return new Response(JSON.stringify({ error: "Failed to generate stats" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "{}";

    // Parse JSON - strip markdown fences if present
    let statsJson: Record<string, unknown>;
    try {
      const cleaned = rawContent.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      statsJson = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", rawContent);
      statsJson = { insight: rawContent, parse_error: true };
    }

    // Add metadata
    statsJson._category = prediction.category;
    statsJson._generated_at = new Date().toISOString();

    // Upsert cache (24h expiry)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("prediction_stats").upsert(
      {
        prediction_id,
        stats_json: statsJson,
        generated_at: new Date().toISOString(),
        expires_at: expiresAt,
      },
      { onConflict: "prediction_id" }
    );

    return new Response(JSON.stringify({ stats: statsJson, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("get-prediction-stats error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
