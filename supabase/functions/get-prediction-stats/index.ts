import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ANALYSIS_VERSION = "grounded-v3";

type PredictionRow = {
  title: string;
  category: string;
  description: string | null;
};

const hasAnyKeyword = (value: string, keywords: string[]) => {
  const normalized = value.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
};

const getAnalysisType = (prediction: PredictionRow) => {
  const combined = `${prediction.title} ${prediction.description ?? ""}`.toLowerCase();

  if (prediction.category === "sports") return "sports";
  if (prediction.category === "crypto") return "crypto";
  if (hasAnyKeyword(combined, ["spacex", "launch", "starship", "falcon 9", "rocket"])) return "space";
  return "default";
};

const buildSearchConfig = (prediction: PredictionRow) => {
  const analysisType = getAnalysisType(prediction);

  switch (analysisType) {
    case "sports":
      return {
        analysisType,
        recency: "month",
        domainFilter: undefined,
        query: [
          `Prediction market: ${prediction.title}`,
          "Return only verified team form, recent results with dates, head-to-head records, and key matchup statistics.",
          "If a stat cannot be verified from current sources, omit it instead of estimating.",
        ].join("\n"),
      };
    case "crypto":
      return {
        analysisType,
        recency: "week",
        domainFilter: ["coingecko.com", "coinmarketcap.com", "binance.com", "kraken.com", "investing.com"],
        query: [
          `Prediction market: ${prediction.title}`,
          "Return only verified current price context, 7d change, 30d change, and notable market drivers.",
          "Use live market sources and omit any figure that is not directly supported.",
        ].join("\n"),
      };
    case "space":
      return {
        analysisType,
        recency: "month",
        domainFilter: ["spacex.com", "nextspaceflight.com", "spaceflightnow.com", "wikipedia.org"],
        query: [
          `Prediction market: ${prediction.title}`,
          `Description: ${prediction.description ?? "N/A"}`,
          "Verify the exact count with a dated list of launches or mission events relevant to this market.",
          "Be extremely strict: if the market is count-based, provide the verified total as of today and the evidence behind it.",
          "Never estimate or compress multiple dates into an incorrect total.",
        ].join("\n"),
      };
    default:
      return {
        analysisType,
        recency: "month",
        domainFilter: undefined,
        query: [
          `Prediction market: ${prediction.title}`,
          `Description: ${prediction.description ?? "N/A"}`,
          "Return only current, verifiable context and key factors directly supported by live sources.",
          "If evidence is weak or conflicting, say so clearly instead of guessing.",
        ].join("\n"),
      };
  }
};

const buildResponseSchema = (analysisType: string) => {
  if (analysisType === "sports") {
    return {
      type: "object",
      additionalProperties: false,
      properties: {
        head_to_head: {
          type: ["object", "null"],
          additionalProperties: false,
          properties: {
            summary: { type: "string" },
            records: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  label: { type: "string" },
                  value: { type: "string" },
                },
                required: ["label", "value"],
              },
            },
          },
          required: ["summary", "records"],
        },
        form_guide: {
          type: ["object", "null"],
          additionalProperties: false,
          properties: {
            team_a: {
              type: ["object", "null"],
              additionalProperties: false,
              properties: {
                name: { type: "string" },
                recent: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      opponent: { type: "string" },
                      result: { type: "string" },
                      date: { type: "string" },
                    },
                    required: ["opponent", "result", "date"],
                  },
                },
              },
              required: ["name", "recent"],
            },
            team_b: {
              type: ["object", "null"],
              additionalProperties: false,
              properties: {
                name: { type: "string" },
                recent: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      opponent: { type: "string" },
                      result: { type: "string" },
                      date: { type: "string" },
                    },
                    required: ["opponent", "result", "date"],
                  },
                },
              },
              required: ["name", "recent"],
            },
          },
          required: ["team_a", "team_b"],
        },
        key_stats: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              label: { type: "string" },
              team_a: { type: "string" },
              team_b: { type: "string" },
            },
            required: ["label", "team_a", "team_b"],
          },
        },
        insight: { type: "string" },
      },
      required: ["head_to_head", "form_guide", "key_stats", "insight"],
    };
  }

  if (analysisType === "crypto") {
    return {
      type: "object",
      additionalProperties: false,
      properties: {
        price_context: {
          type: ["object", "null"],
          additionalProperties: false,
          properties: {
            current_price: { type: "string" },
            price_30d_change: { type: "string" },
            price_7d_change: { type: "string" },
          },
          required: ["current_price", "price_30d_change", "price_7d_change"],
        },
        key_metrics: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              label: { type: "string" },
              value: { type: "string" },
            },
            required: ["label", "value"],
          },
        },
        market_sentiment: {
          type: ["object", "null"],
          additionalProperties: false,
          properties: {
            summary: { type: "string" },
            signals: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  label: { type: "string" },
                  direction: { type: "string", enum: ["bullish", "bearish", "neutral"] },
                },
                required: ["label", "direction"],
              },
            },
          },
          required: ["summary", "signals"],
        },
        insight: { type: "string" },
      },
      required: ["price_context", "key_metrics", "market_sentiment", "insight"],
    };
  }

  return {
    type: "object",
    additionalProperties: false,
    properties: {
      context: {
        type: "object",
        additionalProperties: false,
        properties: {
          summary: { type: "string" },
        },
        required: ["summary"],
      },
      key_factors: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            label: { type: "string" },
            detail: { type: "string" },
            direction: { type: "string", enum: ["for", "against", "neutral"] },
          },
          required: ["label", "detail", "direction"],
        },
      },
      historical_precedent: {
        type: ["object", "null"],
        additionalProperties: false,
        properties: {
          summary: { type: "string" },
        },
        required: ["summary"],
      },
      insight: { type: "string" },
    },
    required: ["context", "key_factors", "historical_precedent", "insight"],
  };
};

const buildPerplexityPrompt = (prediction: PredictionRow, analysisType: string) => {
  if (analysisType === "sports") {
    return [
      `Market: ${prediction.title}`,
      `Description: ${prediction.description ?? "N/A"}`,
      "Return sports data only if it is currently verifiable.",
      "For head-to-head and form guide, include dates inside the values and omit unsupported claims.",
      "If some sections cannot be verified, return null for those sections and keep the insight cautious.",
    ].join("\n");
  }

  if (analysisType === "crypto") {
    return [
      `Market: ${prediction.title}`,
      `Description: ${prediction.description ?? "N/A"}`,
      "Return only live or recent market figures supported by current sources.",
      "Do not infer percentage changes from memory.",
      "If a figure is unavailable, use null for the whole section instead of guessing.",
    ].join("\n");
  }

  if (analysisType === "space") {
    return [
      `Market: ${prediction.title}`,
      `Description: ${prediction.description ?? "N/A"}`,
      "This is a count-sensitive aerospace market.",
      "In context.summary, state the verified current count as of today.",
      "In key_factors, include a dated count verification factor and at least one timeline factor.",
      "If sources disagree, explicitly mention the conflict and choose the more authoritative source only when justified.",
      "Never reduce or rewrite the count incorrectly.",
    ].join("\n");
  }

  return [
    `Market: ${prediction.title}`,
    `Description: ${prediction.description ?? "N/A"}`,
    "Return only verified context and factors from current sources.",
    "Avoid speculation. If evidence is weak, say that directly.",
  ].join("\n");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prediction_id, force_refresh } = await req.json();
    if (!prediction_id) {
      return new Response(JSON.stringify({ error: "prediction_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Check cache first (skip if force_refresh)
    if (!force_refresh) {
      const { data: cached } = await supabase
        .from("prediction_stats")
        .select("stats_json, expires_at")
        .eq("prediction_id", prediction_id)
        .single();

      const cachedVersion = cached?.stats_json && typeof cached.stats_json === "object"
        ? (cached.stats_json as Record<string, unknown>)._analysis_version
        : null;

      if (
        cached &&
        cachedVersion === ANALYSIS_VERSION &&
        new Date(cached.expires_at) > new Date()
      ) {
        return new Response(JSON.stringify({ stats: cached.stats_json, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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

    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY_1") || Deno.env.get("PERPLEXITY_API_KEY");
    if (!PERPLEXITY_API_KEY) {
      return new Response(JSON.stringify({ error: "Live analysis is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { analysisType, query, recency, domainFilter } = buildSearchConfig(prediction);
    const perplexityResponse = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-pro",
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: [
              "You are a strict fact-checking analyst for a prediction market UI.",
              "Return ONLY valid JSON matching the provided schema.",
              "Use only live, source-supported facts.",
              "If data cannot be verified, return null for that section or write a cautious statement instead of guessing.",
              "Never invent counts, scores, dates, prices, percentages, launches, or records.",
              `Current date: ${new Date().toISOString().split("T")[0]}`,
            ].join(" "),
          },
          { role: "user", content: buildPerplexityPrompt(prediction, analysisType) },
        ],
        search_recency_filter: recency,
        ...(domainFilter ? { search_domain_filter: domainFilter } : {}),
        response_format: {
          type: "json_schema",
          json_schema: {
            name: `prediction_analysis_${analysisType}`,
            schema: buildResponseSchema(analysisType),
          },
        },
      }),
    });

    if (!perplexityResponse.ok) {
      const status = perplexityResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again later" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("Perplexity error:", status, await perplexityResponse.text());
      return new Response(JSON.stringify({ error: "Failed to generate live stats" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await perplexityResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "{}";

    let statsJson: Record<string, unknown>;
    try {
      statsJson = JSON.parse(rawContent);
    } catch {
      console.error("Failed to parse Perplexity response:", rawContent);
      return new Response(JSON.stringify({ error: "Live stats returned invalid data" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    statsJson._category = prediction.category;
    statsJson._analysis_type = analysisType;
    statsJson._analysis_version = ANALYSIS_VERSION;
    statsJson._generated_at = new Date().toISOString();
    statsJson._citations = Array.isArray(aiData.citations) ? aiData.citations.slice(0, 8) : [];

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
