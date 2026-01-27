import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Gamepad2, Clock, Users, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GameCard from "@/components/games/GameCard";
import GameLeaderboard from "@/components/games/GameLeaderboard";
import GamePlayModal from "@/components/games/GamePlayModal";
import ExternalGameCard from "@/components/games/ExternalGameCard";

// External games from itch.io and similar platforms
const EXTERNAL_GAMES = [
  {
    id: "keyboard-ants",
    name: "My Keyboard is Full of Ants",
    description: "A quirky typing game where ants invade your keyboard! Type fast to clear them out.",
    icon: "🐜",
    url: "https://plasmastarfish.itch.io/my-keyboard-is-full-of-ants",
    embedUrl: "https://itch.io/embed-upload/11655206?color=1a1a2e",
    platform: "PC Only",
    gameDbId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  },
];

interface MiniGame {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  is_active: boolean;
}

const Games = () => {
  const { t } = useLanguage();
  const [games, setGames] = useState<MiniGame[]>([]);
  const [selectedGame, setSelectedGame] = useState<MiniGame | null>(null);
  const [isPlayModalOpen, setIsPlayModalOpen] = useState(false);
  const [playMode, setPlayMode] = useState<"competitive" | "demo">("competitive");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGames();
  }, []);

  const fetchGames = async () => {
    const { data, error } = await supabase
      .from("mini_games")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (!error && data) {
      setGames(data);
    }
    setLoading(false);
  };

  const handlePlay = (game: MiniGame, mode: "competitive" | "demo") => {
    setSelectedGame(game);
    setPlayMode(mode);
    setIsPlayModalOpen(true);
  };

  const getWeekNumber = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now.getTime() - start.getTime();
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    return Math.ceil(diff / oneWeek);
  };

  const getTimeUntilReset = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysUntilSunday = (7 - dayOfWeek) % 7 || 7;
    const nextSunday = new Date(now);
    nextSunday.setDate(now.getDate() + daysUntilSunday);
    nextSunday.setHours(23, 59, 59, 999);
    
    const diff = nextSunday.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    return `${days}d ${hours}h`;
  };

  return (
    <>
      <Helmet>
        <title>Mini Games | eCash Pulse</title>
        <meta name="description" content="Play mini games, compete on weekly leaderboards, and win XEC prizes!" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Header />

        <main className="container mx-auto px-4 pt-24 pb-16">
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
              <Gamepad2 className="w-5 h-5" />
              <span className="text-sm font-medium">Mini Games Arena</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Play, Compete & Win
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Enter weekly competitions for $1 XEC. Top 3 players split the prize pool!
            </p>
          </motion.div>

          {/* Stats Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
          >
            <div className="glass-card p-4 text-center">
              <Trophy className="w-6 h-6 text-amber-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">Week {getWeekNumber()}</p>
              <p className="text-xs text-muted-foreground">Current Week</p>
            </div>
            <div className="glass-card p-4 text-center">
              <Clock className="w-6 h-6 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{getTimeUntilReset()}</p>
              <p className="text-xs text-muted-foreground">Until Reset</p>
            </div>
            <div className="glass-card p-4 text-center">
              <DollarSign className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">$1 XEC</p>
              <p className="text-xs text-muted-foreground">Entry Fee</p>
            </div>
            <div className="glass-card p-4 text-center">
              <Users className="w-6 h-6 text-blue-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">Top 3</p>
              <p className="text-xs text-muted-foreground">Win Prizes</p>
            </div>
          </motion.div>

          {/* Prize Distribution Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="glass-card p-4 mb-8"
          >
            <div className="flex flex-wrap justify-center gap-6 text-center">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🥇</span>
                <div>
                  <p className="font-bold text-foreground">1st Place</p>
                  <p className="text-primary text-sm">60% of pool</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">🥈</span>
                <div>
                  <p className="font-bold text-foreground">2nd Place</p>
                  <p className="text-primary text-sm">25% of pool</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">🥉</span>
                <div>
                  <p className="font-bold text-foreground">3rd Place</p>
                  <p className="text-primary text-sm">15% of pool</p>
                </div>
              </div>
              <div className="text-xs text-muted-foreground self-center">
                (1% platform fee deducted)
              </div>
            </div>
          </motion.div>

          {/* Games Grid */}
          <Tabs defaultValue="games" className="w-full">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
              <TabsTrigger value="games">
                <Gamepad2 className="w-4 h-4 mr-2" />
                Games
              </TabsTrigger>
              <TabsTrigger value="leaderboards">
                <Trophy className="w-4 h-4 mr-2" />
                Leaderboards
              </TabsTrigger>
            </TabsList>

            <TabsContent value="games">
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="glass-card p-6 animate-pulse">
                      <div className="w-16 h-16 bg-muted/30 rounded-xl mx-auto mb-4" />
                      <div className="h-6 bg-muted/30 rounded w-3/4 mx-auto mb-2" />
                      <div className="h-4 bg-muted/30 rounded w-full mb-4" />
                      <div className="h-10 bg-muted/30 rounded" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {games.map((game, index) => (
                      <GameCard
                        key={game.id}
                        game={game}
                        index={index}
                        onPlay={(mode) => handlePlay(game, mode)}
                      />
                    ))}
                  </div>
                  
                  {/* External Games Section */}
                  {EXTERNAL_GAMES.length > 0 && (
                    <div className="mt-12">
                      <h3 className="text-xl font-bold text-foreground mb-6 text-center">
                        🎮 More Games
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {EXTERNAL_GAMES.map((game, index) => (
                          <ExternalGameCard
                            key={game.id}
                            game={game}
                            index={index + games.length}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="leaderboards">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {games.map((game) => (
                  <GameLeaderboard key={game.id} game={game} />
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </main>

        <Footer />
      </div>

      {selectedGame && (
        <GamePlayModal
          game={selectedGame}
          mode={playMode}
          isOpen={isPlayModalOpen}
          onClose={() => {
            setIsPlayModalOpen(false);
            setSelectedGame(null);
          }}
        />
      )}
    </>
  );
};

export default Games;