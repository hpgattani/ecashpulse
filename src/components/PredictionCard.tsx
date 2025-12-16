import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Clock, Users, Zap } from "lucide-react";
import BetModal from "./BetModal";
import { Outcome } from "@/hooks/usePredictions";

interface Prediction {
  id: string;
  question: string;
  description: string;
  category: "crypto" | "politics" | "sports" | "tech" | "entertainment" | "economics";
  yesOdds: number;
  noOdds: number;
  volume: number;
  endDate: string;
  image?: string;
  trending?: boolean;
  change24h?: number;
  escrowAddress?: string;
  isMultiOption?: boolean;
  outcomes?: Outcome[];
}

interface PredictionCardProps {
  prediction: Prediction;
  index: number;
  livePrice?: { price: number | null; symbol: string } | null;
}

const PredictionCard = ({ prediction, index, livePrice }: PredictionCardProps) => {
  const [isBetModalOpen, setIsBetModalOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<"yes" | "no">("yes");
  const [selectedOutcome, setSelectedOutcome] = useState<Outcome | null>(null);

  const isMultiOption =
    Boolean(prediction.isMultiOption) && Array.isArray(prediction.outcomes) && prediction.outcomes.length > 0;

  const formatVolume = (vol: number) => {
    if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `$${(vol / 1000).toFixed(0)}K`;
    if (vol >= 1) return `$${vol.toFixed(2)}`;
    return `$${vol.toFixed(4)}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatPrice = (price: number | null, symbol: string) => {
    if (price === null) return null;
    if (price < 0.01) return `$${price.toFixed(6)}`;
    if (price < 1) return `$${price.toFixed(4)}`;
    if (price < 100) return `$${price.toFixed(2)}`;
    return `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  const getCategoryEmoji = (category: string) => {
    const emojis: Record<string, string> = {
      crypto: "₿",
      politics: "🏛️",
      sports: "⚽",
      tech: "🚀",
      entertainment: "🎬",
      economics: "📈",
    };
    return emojis[category] || "🌐";
  };

  const handleBet = (position: "yes" | "no") => {
    setSelectedPosition(position);
    setSelectedOutcome(null);
    setIsBetModalOpen(true);
  };

  const handleOutcomeBet = (outcome: Outcome) => {
    setSelectedOutcome(outcome);
    setSelectedPosition("yes"); // always "bet on this outcome"
    setIsBetModalOpen(true);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1, duration: 0.4 }}
        whileHover={{ y: -4 }}
        className="glass-card overflow-hidden group"
      >
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-border/30">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">{getCategoryEmoji(prediction.category)}</span>
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                {prediction.category}
              </span>
              {isMultiOption && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">Multi</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {livePrice?.price != null && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/20 text-accent text-xs font-mono">
                  <Zap className="w-3 h-3" />
                  {livePrice.symbol}: {formatPrice(livePrice.price, livePrice.symbol)}
                </div>
              )}
              {prediction.trending && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">
                  <TrendingUp className="w-3 h-3" />
                  Hot
                </div>
              )}
            </div>
          </div>

          <h3 className="font-display font-semibold text-foreground text-base md:text-lg leading-snug group-hover:text-primary transition-colors">
            {prediction.question}
          </h3>
        </div>

        {/* Odds Display */}
        <div className="p-4 md:p-5">
          {isMultiOption ? (
            // Multi-option display - show all outcomes
            <div className="space-y-1.5 mb-4 max-h-[200px] overflow-y-auto">
              {prediction.outcomes!.map((outcome) => (
                <button
                  key={outcome.id}
                  type="button"
                  onClick={() => handleOutcomeBet(outcome)}
                  className="w-full flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/60"
                >
                  <span className="text-sm text-foreground font-medium truncate flex-1 mr-2">{outcome.label}</span>
                  <span className="text-sm font-bold text-primary">{outcome.odds}%</span>
                </button>
              ))}
            </div>
          ) : (
            // Yes/No display
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-emerald-400 font-semibold">Yes {prediction.yesOdds}%</span>
                <span className="text-red-400 font-semibold">No {prediction.noOdds}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${prediction.yesOdds}%` }}
                  transition={{
                    delay: index * 0.1 + 0.3,
                    duration: 0.8,
                    ease: "easeOut",
                  }}
                  className="odds-bar-yes"
                />
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${prediction.noOdds}%` }}
                  transition={{
                    delay: index * 0.1 + 0.3,
                    duration: 0.8,
                    ease: "easeOut",
                  }}
                  className="odds-bar-no"
                />
              </div>
            </div>
          )}

          {/* Stats Row */}
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {formatVolume(prediction.volume)} Vol
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDate(prediction.endDate)}
            </div>
            {typeof prediction.change24h === "number" && (
              <div
                className={`flex items-center gap-1 ${prediction.change24h >= 0 ? "text-emerald-400" : "text-red-400"}`}
              >
                {prediction.change24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(prediction.change24h)}%
              </div>
            )}
          </div>

          {/* Bet Buttons - Only show for non-multi-option */}
          {!isMultiOption && (
            <div className="flex gap-2">
              <Button variant="yes" size="sm" className="flex-1" onClick={() => handleBet("yes")}>
                Bet Yes
              </Button>
              <Button variant="no" size="sm" className="flex-1" onClick={() => handleBet("no")}>
                Bet No
              </Button>
            </div>
          )}

          {/* NOTE: "Comments & Activity" button removed per request */}
        </div>
      </motion.div>

      <BetModal
        isOpen={isBetModalOpen}
        onClose={() => setIsBetModalOpen(false)}
        prediction={prediction}
        position={selectedPosition}
        selectedOutcome={selectedOutcome}
      />
    </>
  );
};

export default PredictionCard;
