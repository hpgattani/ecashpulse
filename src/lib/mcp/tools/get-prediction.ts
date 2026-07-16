import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

function anonClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "get_prediction",
  title: "Get prediction",
  description: "Fetch a single prediction market by ID, including pools, status, and dates.",
  inputSchema: {
    id: z.string().describe("Prediction market UUID."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ id }) => {
    const { data, error } = await anonClient()
      .from("predictions")
      .select("id, title, description, category, status, yes_pool, no_pool, end_date, resolution_date, resolved_at, image_url, created_at")
      .eq("id", id)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Prediction not found" }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { prediction: data },
    };
  },
});
