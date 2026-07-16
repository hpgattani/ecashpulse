import { defineMcp } from "@lovable.dev/mcp-js";
import listPredictions from "./tools/list-predictions";
import getPrediction from "./tools/get-prediction";
import getLeaderboard from "./tools/get-leaderboard";
import getPlatformStats from "./tools/get-platform-stats";
import listRaffles from "./tools/list-raffles";
import getTopVolume from "./tools/get-top-volume";

export default defineMcp({
  name: "ecash-pulse-mcp",
  title: "eCash Pulse MCP",
  version: "0.1.0",
  instructions:
    "Public read-only tools for eCash Pulse, a decentralized prediction market on eCash. Use these to browse prediction markets, the leaderboard, platform stats, top-volume markets, and raffles. No user or wallet data is exposed.",
  tools: [listPredictions, getPrediction, getLeaderboard, getPlatformStats, listRaffles, getTopVolume],
});
