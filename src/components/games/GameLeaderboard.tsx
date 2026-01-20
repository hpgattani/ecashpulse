import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Medal } from "lucide-react";

interface MiniGame {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
}

interface LeaderboardEntry {
  player_address_hash: string;
  score: number;
  rank: number;
}

interface GameLeaderboardProps {
  game: MiniGame;
}

const GameLeaderboard = ({ game }: GameLeaderboardProps) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [totalPot, setTotalPot] = useState(0);
  const [loading, setLoading] = useState(true);

  const getWeekNumber = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now.getTime() - start.getTime();
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    return Math.ceil(diff / oneWeek);
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [game.id]);

  const fetchLeaderboard = async () => {
    const week = getWeekNumber();
    const year = new Date().getFullYear();

    // Get top scores for this game this week
    const { data: sessions, error } = await supabase
      .from("game_sessions")
      .select("player_address_hash, score")
      .eq("game_id", game.id)
      .eq("week_number", week)
      .eq("year", year)
      .eq("is_competitive", true)
      .order("score", { ascending: false })
      .limit(10);

    if (!error && sessions) {
      // Group by player and get best score
      const playerScores = new Map<string, number>();
      sessions.forEach((s) => {
        const current = playerScores.get(s.player_address_hash) || 0;
        if (s.score > current) {
          playerScores.set(s.player_address_hash, s.score);
        }
      });

      const ranked = Array.from(playerScores.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([address, score], index) => ({
          player_address_hash: address,
          score,
          rank: index + 1,
        }));

      setEntries(ranked);

      // Calculate total pot (count of competitive sessions * entry fee)
      const { count } = await supabase
        .from("game_sessions")
        .select("*", { count: "exact", head: true })
        .eq("game_id", game.id)
        .eq("week_number", week)
        .eq("year", year)
        .eq("is_competitive", true);

      // Assuming $1 XEC entry = dynamic based on price
      setTotalPot((count || 0) * 100); // Placeholder in sats
    }

    setLoading(false);
  };

  const formatAddress = (hash: string) => {
    if (hash.length < 12) return hash;
    return `${hash.slice(0, 8)}...${hash.slice(-4)}`;
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <span className="text-xl">🥇</span>;
    if (rank === 2) return <span className="text-xl">🥈</span>;
    if (rank === 3) return <span className="text-xl">🥉</span>;
    return <span className="text-muted-foreground font-mono">#{rank}</span>;
  };

  const getPrizeShare = (rank: number) => {
    if (totalPot === 0) return null;
    const netPot = totalPot * 0.99; // After 1% fee
    if (rank === 1) return Math.floor(netPot * 0.6);
    if (rank === 2) return Math.floor(netPot * 0.25);
    if (rank === 3) return Math.floor(netPot * 0.15);
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card overflow-hidden"
    >
      <div className="p-4 border-b border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{game.icon}</span>
          <div>
            <h3 className="font-bold text-foreground">{game.name}</h3>
            <p className="text-xs text-muted-foreground">Week {getWeekNumber()} Leaderboard</p>
          </div>
        </div>
        {totalPot > 0 && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Prize Pool</p>
            <p className="font-bold text-primary">{(totalPot / 100).toLocaleString()} XEC</p>
          </div>
        )}
      </div>

      <div className="p-4">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-muted/20 rounded animate-pulse" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Trophy className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No scores yet this week</p>
            <p className="text-sm">Be the first to compete!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => {
              const prize = getPrizeShare(entry.rank);
              return (
                <div
                  key={entry.player_address_hash}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    entry.rank <= 3 ? "bg-primary/10 border border-primary/20" : "bg-muted/20"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {getRankIcon(entry.rank)}
                    <span className="font-mono text-sm text-foreground">
                      {formatAddress(entry.player_address_hash)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    {prize && (
                      <span className="text-xs text-primary font-medium">
                        +{(prize / 100).toLocaleString()} XEC
                      </span>
                    )}
                    <span className="font-bold text-foreground">{entry.score.toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default GameLeaderboard;