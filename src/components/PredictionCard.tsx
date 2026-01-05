import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, TrendingDown, Clock, Users, Zap, Share2, Check, CheckCircle2, Thermometer
} from "lucide-react";
import BetModal from "./BetModal";
import { Outcome } from "@/hooks/usePredictions";
import { toast } from "sonner";
import { useUserBetSummaries, type UserBetSummary } from "@/hooks/useUserBetSummaries";
import CountdownTimer from "./CountdownTimer";
import { useLanguage } from "@/contexts/LanguageContext";

interface Prediction {
  id: string;
  question: string;
  description: string;
  category: "crypto" | "politics" | "sports" | "tech" | "entertainment" | "economics" | "elections" | "finance" | "geopolitics" | "earnings" | "world" | "climate";
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
  // Raw pool values in satoshis for accurate payout calculation
  yesPool?: number;
  noPool?: number;
}

interface ClimateData {
  temperature: number;
  location: string;
  description: string;
}

interface PredictionCardProps {
  prediction: Prediction;
  index: number;
  livePrice?: { price: number | null; symbol: string } | null;
  climateData?: ClimateData | null;
}

const PredictionCard = ({ prediction, index, livePrice, climateData }: PredictionCardProps) => {
  const navigate = useNavigate();
  const { t, translateTitle } = useLanguage();
  const { betByPredictionId } = useUserBetSummaries();
  const userBet: UserBetSummary | null = betByPredictionId[prediction.id] ?? null;

  const [isBetModalOpen, setIsBetModalOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<"yes" | "no">("yes");
  const [selectedOutcome, setSelectedOutcome] = useState<Outcome | null>(null);
  const [copied, setCopied] = useState(false);

  const [stampOpen, setStampOpen] = useState(false);
  const closeTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!userBet) setStampOpen(false);
  }, [userBet]);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) window.clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  const toggleStamp = (e: any) => {
    e.stopPropagation();

    setStampOpen((v) => {
      const next = !v;
      if (closeTimeoutRef.current) window.clearTimeout(closeTimeoutRef.current);
      if (next) {
        closeTimeoutRef.current = window.setTimeout(() => setStampOpen(false), 2600);
      }
      return next;
    });
  };
  const isMultiOption =
    Boolean(prediction.isMultiOption) && Array.isArray(prediction.outcomes) && prediction.outcomes.length > 0;

  // Detect if this is an Up/Down prediction (binary but not Yes/No)
  const outcomeLabels = prediction.outcomes?.map(o => o.label.toLowerCase().trim()) || [];
  const isUpDown = !isMultiOption && outcomeLabels.includes('up') && outcomeLabels.includes('down');
  const positiveLabel = isUpDown ? t.up : t.yes;
  const negativeLabel = isUpDown ? t.down : t.no;
  const positiveBetLabel = isUpDown ? t.betUp : t.betYes;
  const negativeBetLabel = isUpDown ? t.betDown : t.betNo;

  // Category translations
  const getCategoryLabel = (category: string) => {
    const categoryMap: Record<string, keyof typeof t> = {
      crypto: 'crypto',
      politics: 'politics',
      sports: 'sports',
      economics: 'economics',
      entertainment: 'entertainment',
      elections: 'elections',
      tech: 'tech',
    };
    return t[categoryMap[category] || 'crypto'] || category;
  };

  const formatVolume = (vol: number) => {
    if (vol >= 1000000) return `${(vol / 1000000).toFixed(1)}M XEC`;
    if (vol >= 1000) return `${(vol / 1000).toFixed(1)}K XEC`;
    return `${Math.round(vol).toLocaleString()} XEC`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    // Display in IST (UTC+5:30)
    return date.toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    });
  };

  const formatPrice = (price: number | null, symbol: string) => {
    if (price === null) return null;
    if (price < 0.01) return `$${price.toFixed(6)}`;
    if (price < 1) return `$${price.toFixed(4)}`;
    if (price < 100) return `$${price.toFixed(2)}`;
    return `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  const getCategoryIcon = (category: string) => {
    const categoryConfig: Record<string, { emoji: string, gradient: string }> = {
      crypto: { emoji: '₿', gradient: 'from-orange-400 to-amber-500' },
      politics: { emoji: '🏛️', gradient: 'from-slate-400 to-zinc-500' },
      sports: { emoji: '🏆', gradient: 'from-amber-400 to-yellow-500' },
      tech: { emoji: '💻', gradient: 'from-cyan-400 to-blue-500' },
      entertainment: { emoji: '🎭', gradient: 'from-pink-400 to-rose-500' },
      economics: { emoji: '📈', gradient: 'from-lime-400 to-green-500' },
      elections: { emoji: '🗳️', gradient: 'from-indigo-400 to-blue-500' },
      finance: { emoji: '💵', gradient: 'from-emerald-400 to-green-500' },
      geopolitics: { emoji: '🌍', gradient: 'from-amber-500 to-orange-600' },
      earnings: { emoji: '📊', gradient: 'from-violet-400 to-purple-500' },
      world: { emoji: '🗺️', gradient: 'from-teal-400 to-cyan-500' },
      climate: { emoji: '🌱', gradient: 'from-green-400 to-emerald-500' },
    };
    const config = categoryConfig[category] || { emoji: '🌐', gradient: 'from-blue-400 to-cyan-400' };
    return (
      <span 
        className={`text-lg bg-gradient-to-br ${config.gradient} rounded-md p-0.5`}
        style={{ 
          filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.3))',
          textShadow: '0 0 8px rgba(255,255,255,0.5)'
        }}
      >
        {config.emoji}
      </span>
    );
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

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/prediction/${prediction.id}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: prediction.question,
          text: prediction.description || "Check out this prediction!",
          url,
        });
      } catch (err) {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(t.linkCopied);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCardClick = () => {
    navigate(`/prediction/${prediction.id}`);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: index * 0.1, duration: 0.4 }}
        whileHover={{ y: -4 }}
        className="glass-card overflow-hidden group cursor-pointer relative"
        onClick={handleCardClick}
      >
        {/* Bet Placed Watermark Stamp (rubber-stamp seal) */}
        {userBet && (
          <div className="absolute top-3 right-3 z-10 group/stamp">
            <button
              type="button"
              aria-label="View your bet details"
              onClick={toggleStamp}
              className={
                "relative w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-full border-2 border-primary/70 bg-primary/5 backdrop-blur-sm rotate-[-12deg] transition-all duration-300 cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 " +
                "group-hover/stamp:scale-110 group-hover/stamp:rotate-0 group-hover/stamp:border-primary group-hover/stamp:shadow-[0_0_24px_hsl(var(--primary)/0.45)] " +
                (stampOpen ? "scale-110 rotate-0 border-primary shadow-[0_0_24px_hsl(var(--primary)/0.45)]" : "")
              }
            >
              {/* inner texture + dashed ring */}
              <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_30%,hsl(var(--primary)_/_0.16),transparent_62%)]" />
              <div className="absolute inset-1 rounded-full border border-primary/40 border-dashed" />

              <span className="absolute top-2 left-1/2 -translate-x-1/2 text-[9px] md:text-[10px] tracking-[0.32em] text-primary/90 font-semibold">
                BET
              </span>
              <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[9px] md:text-[10px] tracking-[0.24em] text-primary/90 font-semibold">
                PLACED
              </span>

              <CheckCircle2 className="relative w-6 h-6 md:w-7 md:h-7 text-primary" />

              {/* pick hint */}
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] md:text-[10px] px-1.5 py-0.5 rounded-full bg-card border border-primary/30 text-primary font-semibold">
                {(userBet.picks?.length || 0) > 1
                  ? `${userBet.picks.length}x`
                  : String(userBet.outcome_label || userBet.position).toUpperCase().slice(0, 6)}
              </span>
            </button>

            {/* Tooltip on hover OR tap */}
            <div
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className={
                "absolute top-full right-0 mt-2 transition-all duration-200 z-20 " +
                (stampOpen
                  ? "opacity-100 scale-100 pointer-events-auto"
                  : "opacity-0 scale-95 pointer-events-none group-hover/stamp:opacity-100 group-hover/stamp:scale-100 group-hover/stamp:pointer-events-auto")
              }
            >
              <div className="bg-card border border-primary/40 rounded-lg px-3 py-2 shadow-lg shadow-primary/20 min-w-[120px]">
                <p className="text-xs text-muted-foreground mb-0.5">{t.yourBet}</p>
                <p className="text-sm font-bold text-primary">{(userBet.amount / 100).toLocaleString()} XEC</p>
                <div className="text-xs font-medium text-foreground mt-0.5">
                  {(() => {
                    const picks = userBet.picks?.length
                      ? userBet.picks
                      : [userBet.outcome_label || String(userBet.position).toUpperCase()];
                    if (picks.length === 1) {
                      return <span>{t.on} <span className="text-primary">{picks[0]}</span></span>;
                    }
                    return (
                      <ul className="list-disc pl-3 mt-1 space-y-0.5">
                        {picks.map((p, i) => (
                          <li key={i} className="text-primary">{p}</li>
                        ))}
                      </ul>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="p-4 md:p-5 border-b border-border/30">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              {getCategoryIcon(prediction.category)}
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                {getCategoryLabel(prediction.category)}
              </span>
              {isMultiOption && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">{t.multi}</span>
              )}
            </div>
            <div className="flex items-center gap-2 mr-14">
              {livePrice?.price != null && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/20 text-accent text-xs font-mono">
                  <Zap className="w-3 h-3" />
                  {livePrice.symbol}: {formatPrice(livePrice.price, livePrice.symbol)}
                </div>
              )}
              {climateData && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-mono">
                  <Thermometer className="w-3 h-3" />
                  {climateData.temperature}°C • {climateData.location}
                </div>
              )}
              {prediction.trending && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">
                  <TrendingUp className="w-3 h-3" />
                  {t.hot}
                </div>
              )}
              <button
                onClick={handleShare}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground text-xs transition-colors"
              >
                {copied ? <Check className="w-3 h-3" /> : <Share2 className="w-3 h-3" />}
              </button>
            </div>
          </div>

          <h3 className="font-display font-semibold text-foreground text-base md:text-lg leading-snug group-hover:text-primary transition-colors pr-12">
            {translateTitle(prediction.question)}
          </h3>
        </div>

        {/* Odds Display */}
        <div className="p-4 md:p-5">
          {isMultiOption ? (
            // Multi-option display - show all outcomes with colors
            <div className="space-y-2 mb-4 max-h-[200px] overflow-y-auto">
              {prediction.outcomes!.map((outcome, idx) => {
                const colors = [
                  'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 hover:border-emerald-400',
                  'from-red-500/20 to-red-600/10 border-red-500/30 hover:border-red-400',
                  'from-blue-500/20 to-blue-600/10 border-blue-500/30 hover:border-blue-400',
                  'from-purple-500/20 to-purple-600/10 border-purple-500/30 hover:border-purple-400',
                ];
                const textColors = ['text-emerald-400', 'text-red-400', 'text-blue-400', 'text-purple-400'];
                const colorIdx = idx % colors.length;
                
                return (
                  <button
                    key={outcome.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOutcomeBet(outcome);
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-lg bg-gradient-to-r ${colors[colorIdx]} border transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/60 hover:scale-[1.01]`}
                  >
                    <span className="text-sm text-foreground font-medium truncate flex-1 mr-2">{outcome.label}</span>
                    <span className={`text-sm font-bold ${textColors[colorIdx]}`}>{outcome.odds}%</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-emerald-400 font-semibold">{positiveLabel} {prediction.yesOdds}%</span>
                <span className="text-red-400 font-semibold">{negativeLabel} {prediction.noOdds}%</span>
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
              {formatVolume(prediction.volume)} {t.vol}
            </div>
            <CountdownTimer endDate={prediction.endDate} />
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
              <Button variant="yes" size="sm" className="flex-1" onClick={(e) => { e.stopPropagation(); handleBet("yes"); }}>
                {positiveBetLabel}
              </Button>
              <Button variant="no" size="sm" className="flex-1" onClick={(e) => { e.stopPropagation(); handleBet("no"); }}>
                {negativeBetLabel}
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
