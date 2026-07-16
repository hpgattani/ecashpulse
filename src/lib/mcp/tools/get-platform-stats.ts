import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";

export default defineTool({
  name: "get_platform_stats",
  title: "Get platform stats",
  description: "Fetch aggregate eCash Pulse platform statistics: total volume, users, markets, and bets.",
  inputSchema: {},
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async () => {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.functions.invoke("get-platform-stats", { body: {} });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { stats: data },
    };
  },
});
