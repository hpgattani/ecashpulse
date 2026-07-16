import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

function anonClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_predictions",
  title: "List predictions",
  description:
    "List prediction markets on eCash Pulse. Filter by status (active, resolved, awaiting_resolution) and category. Returns title, pools, dates, and status.",
  inputSchema: {
    status: z
      .enum(["active", "resolved", "awaiting_resolution", "cancelled"])
      .optional()
      .describe("Filter by market status. Omit for all statuses."),
    category: z.string().optional().describe("Filter by category (e.g. sports, crypto, politics)."),
    limit: z.number().int().min(1).max(50).default(20),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ status, category, limit }) => {
    let q = anonClient()
      .from("predictions")
      .select("id, title, description, category, status, yes_pool, no_pool, end_date, resolution_date, resolved_at, image_url, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (status) q = q.eq("status", status);
    if (category) q = q.eq("category", category);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { predictions: data ?? [] },
    };
  },
});
