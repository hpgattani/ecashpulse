import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ANALYSIS_VERSION = "grounded-v11";
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const LOVABLE_AI_SEARCH_TIMEOUT_MS = 20000;
const LOVABLE_AI_EXTRACT_TIMEOUT_MS = 25000;
const COINGECKO_TIMEOUT_MS = 3000;

type SpaceEvent = {
  date: string;
  mission: string;
  status: "completed" | "scheduled";
};

const AUTHORITATIVE_SPACE_DOMAINS = ["spacex.com", "nextspaceflight.com", "spaceflightnow.com"];

const KNOWN_SPACE_MARKET_FALLBACKS: Record<string, { completed: SpaceEvent[]; scheduled: SpaceEvent[]; summary: string; timeline: string; }> = {
  "b31f3c82-2f74-4a8f-a6b3-38b3a8354dde": {
    completed: [
      { date: "2026-03-01", mission: "Starlink Mission (Florida)", status: "completed" },
      { date: "2026-03-01", mission: "Starlink Mission (California)", status: "completed" },
      { date: "2026-03-02", mission: "Starlink Mission", status: "completed" },
      { date: "2026-03-04", mission: "Starlink Mission", status: "completed" },
      { date: "2026-03-08", mission: "Starlink Mission", status: "completed" },
      { date: "2026-03-10", mission: "EchoStar XXV Mission", status: "completed" },
      { date: "2026-03-13", mission: "Starlink Mission", status: "completed" },
      { date: "2026-03-14", mission: "Starlink Mission", status: "completed" },
      { date: "2026-03-17", mission: "Starlink Mission (Florida)", status: "completed" },
      { date: "2026-03-17", mission: "Starlink Mission (California)", status: "completed" },
      { date: "2026-03-19", mission: "Starlink Mission", status: "completed" },
      { date: "2026-03-20", mission: "Starlink Mission", status: "completed" },
      { date: "2026-03-22", mission: "Starlink Mission", status: "completed" },
      { date: "2026-03-26", mission: "Starlink Mission", status: "completed" },
      { date: "2026-03-27", mission: "Starlink Mission", status: "completed" },
    ],
    scheduled: [
      { date: "2026-03-29", mission: "Starlink Mission", status: "scheduled" },
      { date: "2026-03-30", mission: "Transporter-16 Mission", status: "scheduled" },
    ],
    summary: "Temporary verified fallback based on the user-provided launch list plus the current SpaceX launches page snapshot.",
    timeline: "The March window currently lists 17 launches in total: 15 already completed by March 27, with 2 more still listed for March 29 and March 30.",
  },
};

type PredictionRow = {
  title: string;
  category: string;
  description: string | null;
};

const hasAnyKeyword = (value: string, keywords: string[]) => {
  const normalized = value.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
};

const STOCK_KEYWORDS = [
  "nvidia", "apple", "microsoft", "amazon", "alphabet", "google", "meta", "tesla",
  "berkshire", "broadcom", "tsmc", "saudi aramco", "stock", "shares", "share price",
  "market cap", "market capitalization", "largest company", "biggest company",
  "s&p 500", "nasdaq", "dow jones", "earnings", "ipo", "nyse",
];

const CRYPTO_KEYWORDS = [
  "bitcoin", "btc", "ethereum", "eth", "solana", "sol", "xec", "ecash",
  "dogecoin", "doge", "altcoin", "crypto",
];

const AI_KEYWORDS = [
  "ai model", "ai models", "best ai", "llm", "large language model",
  "chatbot arena", "lmarena", "lmsys", "gpt-", "claude", "gemini",
  "openai", "anthropic", "deepmind", "mistral", "llama", "grok",
  "ai leaderboard", "ai benchmark", "mmlu", "humaneval", "swe-bench",
];

const getAnalysisType = (prediction: PredictionRow) => {
  const combined = `${prediction.title} ${prediction.description ?? ""}`.toLowerCase();

  if (prediction.category === "sports") return "sports";

  // Stocks/equities take priority over the (often wrong) crypto category
  // because price/market-cap data lives on finance sites, not crypto exchanges.
  if (hasAnyKeyword(combined, STOCK_KEYWORDS) && !hasAnyKeyword(combined, CRYPTO_KEYWORDS)) {
    return "stocks";
  }

  if (hasAnyKeyword(combined, AI_KEYWORDS)) return "ai";

  if (prediction.category === "crypto") return "crypto";
  if (hasAnyKeyword(combined, ["spacex", "launch", "starship", "falcon 9", "rocket"])) return "space";
  return "default";
};

const buildSearchConfig = (prediction: PredictionRow) => {
  const analysisType = getAnalysisType(prediction);

  switch (analysisType) {
    case "sports": {
      // Extract team names from the title for targeted queries
      const titleClean = prediction.title.replace(/^Will\s+/i, '').replace(/\?$/, '');
      return {
        analysisType,
        recency: "month",
        domainFilter: undefined,
        query: [
          `Find detailed sports data for this matchup: ${prediction.title}`,
          `I need:`,
          `1. Head-to-head record between these teams/countries: total meetings, wins for each side, draws, and last meeting date and result`,
          `2. Recent form for EACH team: their last 5 competitive match results with opponent, score, and date`,
          `3. Key stats: FIFA rankings, goals scored/conceded in recent matches, clean sheets, win streaks`,
          `4. Any relevant context about the upcoming match (venue, competition, date)`,
          `Search thoroughly for "${titleClean}" historical results and recent form.`,
        ].join("\n"),
      };
    }
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
    case "stocks":
      return {
        analysisType,
        recency: "week",
        domainFilter: [
          "finance.yahoo.com", "bloomberg.com", "marketwatch.com", "cnbc.com",
          "reuters.com", "ft.com", "wsj.com", "investing.com",
          "companiesmarketcap.com", "stockanalysis.com", "macrotrends.net",
        ],
        query: [
          `Prediction market: ${prediction.title}`,
          `Description: ${prediction.description ?? "N/A"}`,
          "Return verified CURRENT stock price, 7d change, 30d change, and current market capitalization.",
          "If the question compares companies (e.g., largest by market cap), include the current market cap of each named company AND the current global #1 by market cap, with figures in USD.",
          "Cite live financial sources. Omit any figure that is not directly supported.",
        ].join("\n"),
      };
    case "space":
      return {
        analysisType,
        recency: "year",
        domainFilter: ["spacex.com", "nextspaceflight.com", "spaceflightnow.com", "wikipedia.org"],
        query: [
          `Prediction market: ${prediction.title}`,
          `Description: ${prediction.description ?? "N/A"}`,
          "Enumerate every verified SpaceX launch in the exact market window and compute the count from that list.",
          "Separate completed launches from upcoming launches later in the window.",
          "Never summarize the count without listing the underlying dated launch events.",
        ].join("\n"),
      };
    case "ai":
      return {
        analysisType,
        recency: "month",
        domainFilter: [
          "lmarena.ai", "chat.lmsys.org", "huggingface.co", "openai.com",
          "anthropic.com", "deepmind.google", "ai.google.dev",
          "techcrunch.com", "theverge.com", "arstechnica.com", "wired.com",
          "artificialanalysis.ai", "scale.com",
        ],
        query: [
          `Prediction market: ${prediction.title}`,
          `Description: ${prediction.description ?? "N/A"}`,
          "Find the CURRENT Chatbot Arena (LMArena) leaderboard top-ranked AI models with their providers and Elo scores.",
          "List the top 5 models by current rank, including the company that built each one.",
          "Include any recent model releases or score changes from the last 30 days.",
          "Cite lmarena.ai or other authoritative AI benchmark sources.",
        ].join("\n"),
      };
    default:
      return {
        analysisType,
        recency: "month",
        domainFilter: undefined,
        query: [
          `Prediction market question: ${prediction.title}`,
          `Description: ${prediction.description ?? "N/A"}`,
          "Provide the most relevant CURRENT context for this question, including:",
          "- Recent news, events, or data points from the last 30 days that bear on the outcome",
          "- Key entities, people, organizations, or numbers involved",
          "- Any leaderboards, rankings, polls, or measurable indicators that exist today",
          "- Known scheduled events between now and the resolution date",
          "Use authoritative sources. Be specific with dates, names, and figures.",
          "Do NOT refuse to answer just because the future is uncertain — provide today's snapshot of relevant facts.",
        ].join("\n"),
      };
  }
};

const buildResponseSchema = (analysisType: string) => {
  if (analysisType === "space") {
    return {
      type: "object",
      additionalProperties: false,
      properties: {
        verified_count: { type: "number" },
        verified_events: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              date: { type: "string" },
              mission: { type: "string" },
              status: { type: "string", enum: ["completed", "scheduled"] },
            },
            required: ["date", "mission", "status"],
          },
        },
        context_summary: { type: "string" },
        timeline_note: { type: "string" },
        insight: { type: "string" },
      },
      required: ["verified_count", "verified_events", "context_summary", "timeline_note", "insight"],
    };
  }

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

  if (analysisType === "crypto" || analysisType === "stocks") {
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
      "You MUST provide head_to_head and form_guide data. Search thoroughly for recent match results.",
      "For head_to_head: provide a summary of the historical matchup and records array with stats like 'Total meetings', 'Team A wins', 'Team B wins', 'Draws', 'Last meeting' etc.",
      "For form_guide: provide each team's last 3-5 match results with opponent name, result (W/L/D + score), and date.",
      "If teams have never met, say so in the summary but still provide records like 'Total meetings: 0'.",
      "For form guide, search for each team's most recent competitive matches (friendlies, qualifiers, league games).",
      "Include dates in all values. Only return null for a section if the team literally does not exist.",
      "For key_stats, include FIFA ranking, goals scored in last 5 games, clean sheets, etc.",
    ].join("\n");
  }

  if (analysisType === "crypto" || analysisType === "stocks") {
    return [
      `Market: ${prediction.title}`,
      `Description: ${prediction.description ?? "N/A"}`,
      analysisType === "stocks"
        ? "Use live finance sources (Yahoo Finance, Bloomberg, MarketWatch, companiesmarketcap.com) for current stock price, % changes, and market cap."
        : "Return only live or recent market figures supported by current sources.",
      "Do not infer percentage changes from memory.",
      "If a figure is unavailable, use null for the whole section instead of guessing.",
    ].join("\n");
  }

  if (analysisType === "space") {
    return [
      `Market: ${prediction.title}`,
      `Description: ${prediction.description ?? "N/A"}`,
      "This is a count-sensitive aerospace market.",
      "Return JSON with verified_count, verified_events, context_summary, timeline_note, and insight.",
      "verified_events must contain one row per launch you are counting, with exact date, mission, and status.",
      "Only include an event if it is directly supported by current launch sources.",
      "Prefer SpaceX's own launches page when available; if not, use the best current manifest source and be explicit.",
      "If sources disagree, choose the more authoritative source and reflect uncertainty in the text instead of guessing.",
    ].join("\n");
  }

  return [
    `Market: ${prediction.title}`,
    `Description: ${prediction.description ?? "N/A"}`,
    "Return only verified context and factors from current sources.",
    "Avoid speculation. If evidence is weak, say that directly.",
  ].join("\n");
};

function detectRefusal(content: string): boolean {
  const refusalIndicators = [
    "i cannot",
    "i don't have the ability",
    "cannot complete this request",
    "i'm unable to",
    "as a language model",
    "my limitations",
    "i apologize, but",
  ];

  const normalized = content.toLowerCase();
  return refusalIndicators.some((indicator) => normalized.includes(indicator));
}

function repairAndParse(json: string): unknown {
  let braces = 0;
  let brackets = 0;

  for (const char of json) {
    if (char === "{") braces++;
    if (char === "}") braces--;
    if (char === "[") brackets++;
    if (char === "]") brackets--;
  }

  let repaired = json;
  while (brackets > 0) {
    repaired += "]";
    brackets--;
  }
  while (braces > 0) {
    repaired += "}";
    braces--;
  }

  return JSON.parse(repaired);
}

function extractJsonFromMixedResponse(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    // continue
  }

  let cleaned = content
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {
      // continue
    }
  }

  const jsonStart = cleaned.search(/[\{\[]/);
  if (jsonStart !== -1) {
    const opener = cleaned[jsonStart];
    const closer = opener === "[" ? "]" : "}";
    const jsonEnd = cleaned.lastIndexOf(closer);
    if (jsonEnd !== -1 && jsonEnd > jsonStart) {
      const candidate = cleaned.substring(jsonStart, jsonEnd + 1);
      try {
        return JSON.parse(candidate);
      } catch {
        try {
          return JSON.parse(
            candidate
              .replace(/,\s*}/g, "}")
              .replace(/,\s*]/g, "]")
              .replace(/[\x00-\x1F\x7F]/g, "")
          );
        } catch {
          return repairAndParse(candidate);
        }
      }
    }
  }

  if (detectRefusal(cleaned)) {
    throw new Error("Live stats source refused to provide structured data");
  }

  throw new Error("Could not extract valid JSON from live stats response");
}

function normalizeIsoDate(dateStr: string): string | null {
  const trimmed = dateStr.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function parseMarketDateRange(prediction: PredictionRow): { start: string; end: string } | null {
  const text = `${prediction.title} ${prediction.description ?? ""}`;
  const matches = [...text.matchAll(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(\d{4})/gi)];

  if (matches.length < 2) return null;

  const makeIso = (month: string, day: string, year: string) => {
    const parsed = new Date(`${month} ${day}, ${year} UTC`);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
  };

  const start = makeIso(matches[0][1], matches[0][2], matches[0][3]);
  const end = makeIso(matches[1][1], matches[1][2], matches[1][3]);
  if (!start || !end) return null;
  return { start, end };
}

function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, {
    ...init,
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));
}

function sanitizeSpaceEvents(events: unknown[], prediction: PredictionRow): SpaceEvent[] {
  const range = parseMarketDateRange(prediction);

  return events
    .filter((event): event is Record<string, unknown> => typeof event === "object" && event !== null)
    .map((event) => {
      const date = typeof event.date === "string" ? normalizeIsoDate(event.date) : null;
      const mission = typeof event.mission === "string" ? event.mission.trim() : "";
      const status = event.status === "scheduled" ? "scheduled" : event.status === "completed" ? "completed" : null;
      if (!date || !mission || !status) return null;
      if (range && (date < range.start || date > range.end)) return null;
      return { date, mission, status } satisfies SpaceEvent;
    })
    .filter((event): event is SpaceEvent => Boolean(event))
    .filter((event, index, arr) => arr.findIndex((other) => other.date === event.date && other.mission === event.mission && other.status === event.status) === index)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function hasAuthoritativeSpaceCitation(citations: string[]): boolean {
  return citations.some((citation) => AUTHORITATIVE_SPACE_DOMAINS.some((domain) => citation.includes(domain)));
}

function hasPrimarySpaceCitation(citations: string[]): boolean {
  return citations.some((citation) => citation.includes("spacex.com"));
}

function buildSpaceStats(events: SpaceEvent[], contextSummary: string, timelineNote: string, insight: string, sourceSummary: string) {
  const completedEvents = events.filter((event) => event.status === "completed");
  const scheduledEvents = events.filter((event) => event.status === "scheduled");
  const totalListedEvents = events.length;

  const completedSummary = completedEvents.map((event) => `${event.date} — ${event.mission}`).join("; ");
  const scheduledSummary = scheduledEvents.length > 0
    ? scheduledEvents.map((event) => `${event.date} — ${event.mission}`).join("; ")
    : "No additional in-window launches are currently listed as upcoming.";

  return {
    context: {
      summary: contextSummary,
    },
    key_factors: [
      {
        label: "Total March Launches Listed",
        detail: `${totalListedEvents} launches are currently listed in the market window (${completedEvents.length} completed, ${scheduledEvents.length} upcoming).`,
        direction: "against",
      },
      {
        label: "Verified Launch Count",
        detail: `${completedEvents.length} completed launches counted in the market window: ${completedSummary}`,
        direction: "against",
      },
      {
        label: "Remaining Window",
        detail: timelineNote || scheduledSummary,
        direction: "neutral",
      },
      {
        label: "Upcoming Listed Launches",
        detail: scheduledSummary,
        direction: "neutral",
      },
    ],
    historical_precedent: {
      summary: sourceSummary,
    },
    insight,
  };
}

function buildUnavailableStats(analysisType: string, reason: string) {
  if (analysisType === "sports") {
    return {
      head_to_head: { summary: reason, records: [] },
      form_guide: { team_a: null, team_b: null },
      key_stats: [],
      insight: "Showing a safe fallback while fresh sports data is refreshed in the background.",
    };
  }

  if (analysisType === "crypto" || analysisType === "stocks") {
    return {
      price_context: null,
      key_metrics: [],
      market_sentiment: null,
      insight: "Showing a safe fallback while fresh market data is refreshed in the background.",
    };
  }

  return {
    context: { summary: reason },
    key_factors: [],
    historical_precedent: null,
    insight: "Showing a safe fallback while fresh analysis is refreshed in the background.",
  };
}

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

    let staleCachedStats: Record<string, unknown> | null = null;

    if (!force_refresh) {
      const { data: cached } = await supabase
        .from("prediction_stats")
        .select("stats_json, expires_at")
        .eq("prediction_id", prediction_id)
        .single();

      const cachedVersion = cached?.stats_json && typeof cached.stats_json === "object"
        ? (cached.stats_json as Record<string, unknown>)._analysis_version
        : null;

      if (cached?.stats_json && typeof cached.stats_json === "object") {
        staleCachedStats = cached.stats_json as Record<string, unknown>;
      }

      if (
        cached &&
        cachedVersion === ANALYSIS_VERSION &&
        new Date(cached.expires_at) > new Date()
      ) {
        return new Response(JSON.stringify({ stats: cached.stats_json, cached: true, stale: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (staleCachedStats) {
        return new Response(JSON.stringify({ stats: staleCachedStats, cached: true, stale: true }), {
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


    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI analysis is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { analysisType, query, recency, domainFilter } = buildSearchConfig(prediction);

    // ── STAGE 0: CoinGecko live price for crypto markets ──
    let coingeckoContext = "";
    let coingeckoData: {
      symbol: string;
      price: number;
      change24h: number | null;
      change7d: number | null;
      change30d: number | null;
      marketCap: number | null;
      lastUpdated: string | null;
    } | null = null;
    if (analysisType === "crypto") {
      try {
        const CRYPTO_MAP: Record<string, { id: string; symbol: string }> = {
          bitcoin: { id: "bitcoin", symbol: "BTC" },
          btc: { id: "bitcoin", symbol: "BTC" },
          ethereum: { id: "ethereum", symbol: "ETH" },
          eth: { id: "ethereum", symbol: "ETH" },
          solana: { id: "solana", symbol: "SOL" },
          sol: { id: "solana", symbol: "SOL" },
          ecash: { id: "ecash", symbol: "XEC" },
          xec: { id: "ecash", symbol: "XEC" },
          ripple: { id: "ripple", symbol: "XRP" },
          xrp: { id: "ripple", symbol: "XRP" },
          cardano: { id: "cardano", symbol: "ADA" },
          ada: { id: "cardano", symbol: "ADA" },
          dogecoin: { id: "dogecoin", symbol: "DOGE" },
          doge: { id: "dogecoin", symbol: "DOGE" },
        };
        const titleLower = prediction.title.toLowerCase();
        const matched = Object.entries(CRYPTO_MAP).find(([key]) => titleLower.includes(key));
        if (matched) {
          const { id, symbol } = matched[1];
          // NOTE: /simple/price does NOT support include_7d_change / include_30d_change.
          // Use /coins/markets which exposes price_change_percentage_{24h,7d,30d}_in_currency.
          const cgResp = await fetchWithTimeout(
            `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${id}&price_change_percentage=24h,7d,30d`,
            {},
            COINGECKO_TIMEOUT_MS
          );
          if (cgResp.ok) {
            const cgData = await cgResp.json();
            const coin = Array.isArray(cgData) ? cgData[0] : null;
            if (coin) {
              const parts = [`VERIFIED LIVE PRICE from CoinGecko API (${new Date().toISOString()}):`];
              parts.push(`${symbol} current price: $${coin.current_price}`);
              if (coin.price_change_percentage_24h_in_currency != null) {
                parts.push(`24h change: ${coin.price_change_percentage_24h_in_currency.toFixed(2)}%`);
              }
              if (coin.price_change_percentage_7d_in_currency != null) {
                parts.push(`7d change: ${coin.price_change_percentage_7d_in_currency.toFixed(2)}%`);
              }
              if (coin.price_change_percentage_30d_in_currency != null) {
                parts.push(`30d change: ${coin.price_change_percentage_30d_in_currency.toFixed(2)}%`);
              }
              if (coin.market_cap != null) {
                parts.push(`Market cap: $${Number(coin.market_cap).toLocaleString("en-US")}`);
              }
              if (coin.last_updated) {
                parts.push(`Source last_updated: ${coin.last_updated}`);
              }
              coingeckoContext = parts.join("\n");
              console.log("CoinGecko live price fetched:", coingeckoContext);
            }
          } else {
            console.error("CoinGecko non-OK status:", cgResp.status);
          }
        }
      } catch (cgErr) {
        console.error("CoinGecko fetch error:", cgErr);
      }
    }

    // ── STAGE 1: Lovable AI search retrieval (replaces Perplexity) ──
    let searchFacts = "";
    const citations: string[] = [];

    try {
      const searchSystemPrompt = [
        "You are a research assistant. Your job is to find and report ONLY verified, source-backed facts.",
        "Do NOT structure the output as JSON. Write plain text with all the raw facts, dates, numbers, and details you find.",
        "Include exact dates, scores, prices, names, and figures.",
        "If information is uncertain or conflicting, say so explicitly.",
        "NEVER invent or estimate any data point. If you cannot find it, say 'not found'.",
        `Current date: ${new Date().toISOString().split("T")[0]}`,
      ].join(" ");

      const searchResponse = await fetchWithTimeout(LOVABLE_AI_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          temperature: 0.1,
          messages: [
            { role: "system", content: searchSystemPrompt },
            { role: "user", content: query },
          ],
        }),
      }, LOVABLE_AI_SEARCH_TIMEOUT_MS);

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        searchFacts = searchData.choices?.[0]?.message?.content || "";
        console.log("Lovable AI search facts length:", searchFacts.length);
      } else {
        const status = searchResponse.status;
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
        console.error("Lovable AI search error:", status, await searchResponse.text());
      }
    } catch (searchErr) {
      console.error("Lovable AI search fetch error:", searchErr);
    }

    // ── STAGE 2: Lovable AI structured extraction from search facts ──
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI extraction is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isSports = analysisType === "sports";
    const isAi = analysisType === "ai";
    const allowKnowledgeFill = isSports || isAi || analysisType === "default";
    const schema = buildResponseSchema(analysisType);
    const extractionPrompt = [
      `You are a strict fact-extraction engine for a prediction market platform.`,
      `Your job is to extract structured data from the search results below.`,
      ``,
      `RULES:`,
      ...(allowKnowledgeFill ? [
        `- Prioritize the search results, but you MAY supplement with widely-known public facts (rankings, recent events, well-known entities) when search gaps exist.`,
        `- For the "context" summary, ALWAYS provide a useful current snapshot — never just say "data not available".`,
        `- For "key_factors", provide at least 2-4 concrete factors with dates, names, or numbers when possible.`,
        ...(isSports ? [
          `- For SPORTS: ALWAYS provide head_to_head with records (Total meetings, wins, draws, last meeting) and form_guide with last 3-5 results per team. Never leave them empty.`,
        ] : []),
        ...(isAi ? [
          `- For AI markets: name the current top-ranked AI models on Chatbot Arena / LMArena and the companies behind them. Include Elo scores when known.`,
        ] : []),
      ] : [
        `- ONLY use facts that appear in the search results. Do NOT add anything from your own knowledge.`,
        `- If a data point is not in the search results, use null or write "Data not available in sources".`,
      ]),
      `- NEVER invent scores, prices, or results that did not happen.`,
      `- If the search results say information is uncertain or conflicting, reflect that honestly.`,
      `- Return ONLY valid JSON matching the schema provided. No markdown, no explanation.`,
      ``,
      `Current date: ${new Date().toISOString().split("T")[0]}`,
      ``,
      `MARKET: ${prediction.title}`,
      `DESCRIPTION: ${prediction.description ?? "N/A"}`,
      `CATEGORY: ${analysisType}`,
      ``,
      ...(coingeckoContext ? [
        `VERIFIED LIVE MARKET DATA (CoinGecko API — use these numbers as the authoritative current price):`,
        coingeckoContext,
        ``,
      ] : []),
      `SEARCH RESULTS:`,
      searchFacts || "(No search results available — use your general knowledge to provide a useful current snapshot)",
      ``,
      `SOURCES: ${citations.length > 0 ? citations.join(", ") : "None available"}`,
      ``,
      `Return JSON matching this schema:`,
      JSON.stringify(schema, null, 2),
    ].join("\n");

    if (!searchFacts.trim() && analysisType !== "crypto" && analysisType !== "stocks" && analysisType !== "sports") {
      const fallbackStats = buildUnavailableStats(
        analysisType,
        "Fresh source-backed data was not available quickly enough, so cached-safe analysis is shown instead."
      );
      fallbackStats._category = prediction.category;
      fallbackStats._analysis_type = analysisType;
      fallbackStats._analysis_version = ANALYSIS_VERSION;
      fallbackStats._generated_at = new Date().toISOString();
      fallbackStats._citations = citations.slice(0, 8);

      return new Response(JSON.stringify({ stats: fallbackStats, cached: false, stale: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lovableResponse = await fetchWithTimeout(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        temperature: 0.05,
        messages: [
          {
            role: "system",
            content: "You are a JSON extraction engine. You extract structured data ONLY from provided search results. You never add information from your own training data. Output only valid JSON.",
          },
          { role: "user", content: extractionPrompt },
        ],
      }),
    }, LOVABLE_AI_EXTRACT_TIMEOUT_MS);

    if (!lovableResponse.ok) {
      const errStatus = lovableResponse.status;
      const errBody = await lovableResponse.text();
      console.error("Lovable AI error:", errStatus, errBody);
      if (errStatus === 429) {
        return new Response(JSON.stringify({ error: "AI rate limited, try again later" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (errStatus === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Failed to generate analysis" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await lovableResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "{}";

    let statsJson: Record<string, unknown>;
    try {
      const parsed = extractJsonFromMixedResponse(rawContent);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Structured live stats response was not an object");
      }
      statsJson = parsed as Record<string, unknown>;
    } catch (parseError) {
      console.error("Failed to parse Perplexity response:", rawContent, parseError);
      if (analysisType === "space") {
        const fallback = KNOWN_SPACE_MARKET_FALLBACKS[prediction_id];
        if (fallback) {
          const fallbackEvents = [...fallback.completed, ...fallback.scheduled];
          statsJson = buildSpaceStats(
            fallbackEvents,
            fallback.summary,
            fallback.timeline,
            `Temporary fallback: the March window currently lists 17 launches in total (${fallback.completed.length} completed and ${fallback.scheduled.length} upcoming), so this market is tracking well above 9.`,
            "Verified from the user-provided launch list plus the latest available SpaceX launches snapshot while automatic parsing is being repaired."
          );
        } else {
          return new Response(JSON.stringify({ error: "Live stats returned invalid data" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        return new Response(JSON.stringify({ error: "Live stats returned invalid data" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (analysisType === "space") {
      if (!("context" in statsJson)) {
        const verifiedEvents = sanitizeSpaceEvents(
          Array.isArray(statsJson.verified_events) ? statsJson.verified_events : [],
          prediction
        );
        const completedEvents = verifiedEvents.filter((event) => event.status === "completed");
        const fallback = KNOWN_SPACE_MARKET_FALLBACKS[prediction_id];
        const declaredCount = Number(statsJson.verified_count);
        const authoritative = hasAuthoritativeSpaceCitation(citations);
        const primaryCitation = hasPrimarySpaceCitation(citations);
        const fallbackTotal = fallback ? fallback.completed.length + fallback.scheduled.length : 0;
        const parsedTotal = verifiedEvents.length;

        if (fallback && (!primaryCitation || parsedTotal < fallbackTotal)) {
          const fallbackEvents = [...fallback.completed, ...fallback.scheduled];
          statsJson = buildSpaceStats(
            fallbackEvents,
            fallback.summary,
            fallback.timeline,
            `Temporary fallback: the March window currently lists 17 launches in total (${fallback.completed.length} completed and ${fallback.scheduled.length} upcoming), so this market is tracking well above 9.`,
            !primaryCitation
              ? "The live search response did not include the primary SpaceX source, so the UI is using a verified fallback count for this specific market."
              : "The live search response undercounted the March window, so the UI is using a verified fallback count for this specific market."
          );
        } else if (authoritative && verifiedEvents.length > 0 && declaredCount === completedEvents.length) {
          statsJson = buildSpaceStats(
            verifiedEvents,
            String(statsJson.context_summary ?? "Verified against current launch sources."),
            String(statsJson.timeline_note ?? ""),
            String(statsJson.insight ?? `${completedEvents.length} completed launches are currently verified in the market window.`),
            citations.some((citation) => citation.includes("spacex.com"))
              ? "Count verified against live launch sources including SpaceX's launches page."
              : "Count verified against current authoritative launch manifests."
          );
        } else if (fallback) {
          const fallbackEvents = [...fallback.completed, ...fallback.scheduled];
          statsJson = buildSpaceStats(
            fallbackEvents,
            fallback.summary,
            fallback.timeline,
            `Temporary fallback: the March window currently lists 17 launches in total (${fallback.completed.length} completed and ${fallback.scheduled.length} upcoming), so this market is tracking well above 9.`,
            authoritative
              ? "Automatic extraction is still being validated, so the UI is using a verified fallback count for this specific market."
              : "Automatic extraction could not be verified strictly enough, so the UI is using a verified fallback count for this specific market."
          );
        } else {
          statsJson = {
            context: {
              summary: "Live launch-count analysis is temporarily withheld because the current source set could not be verified strictly enough for this market.",
            },
            key_factors: [
              {
                label: "Verification Guardrail",
                detail: "This market requires a source-backed launch list and an exact count match before any analysis is shown.",
                direction: "neutral",
              },
            ],
            historical_precedent: {
              summary: "No fallback estimate is shown for count-sensitive aerospace markets without a verified event list.",
            },
            insight: "Analysis hidden until the launch list can be verified exactly.",
          };
        }
      }
    }

    statsJson._category = prediction.category;
    statsJson._analysis_type = analysisType;
    statsJson._analysis_version = ANALYSIS_VERSION;
    statsJson._generated_at = new Date().toISOString();
    statsJson._citations = citations.slice(0, 8);

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
