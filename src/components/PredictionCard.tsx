import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, TrendingDown, Clock, Users, Zap, Share2, Check, CheckCircle2, Thermometer,
  Globe, Landmark, Trophy, Bitcoin, DollarSign, Globe2, BarChart3, Cpu, Theater, Map, Leaf, Vote, Film,
  Gavel, Flag, Coins, CircleDollarSign, Scale, Building2, Briefcase, Rocket, Gamepad2, Music2, Tv, Award
} from "lucide-react";
import BetModal from "./BetModal";
import { Outcome } from "@/hooks/usePredictions";
import { toast } from "sonner";
import { useUserBetSummaries, type UserBetSummary } from "@/hooks/useUserBetSummaries";
import CountdownTimer from "./CountdownTimer";
import { useLanguage } from "@/contexts/LanguageContext";
import { getKnownScore } from "@/hooks/useSportsScores";
import { triggerHaptic } from "@/hooks/useHaptic";

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

// Topic image component that detects relevant icons based on keywords
const TopicImage = ({ question, category }: { question: string; category: string }) => {
  const q = question.toLowerCase();
  
  // Keyword-based icon detection (like Polymarket)
  const getTopicIcon = () => {
    // Politics/Elections keywords
    if (q.includes('trump') || q.includes('biden') || q.includes('president') || q.includes('election')) {
      return { Icon: Landmark, bg: 'from-blue-500 to-red-500', emoji: '🇺🇸' };
    }
    if (q.includes('supreme court') || q.includes('tariff') || q.includes('court')) {
      return { Icon: Gavel, bg: 'from-slate-600 to-slate-800', emoji: '⚖️' };
    }
    if (q.includes('iran') || q.includes('israel') || q.includes('war') || q.includes('military') || q.includes('strike')) {
      return { Icon: Globe2, bg: 'from-amber-600 to-red-700', emoji: '🌍' };
    }
    if (q.includes('greenland') || q.includes('acquire') || q.includes('territory')) {
      return { Icon: Map, bg: 'from-cyan-400 to-blue-600', emoji: '🗺️' };
    }
    if (q.includes('portugal') || q.includes('brazil') || q.includes('uk') || q.includes('germany') || q.includes('france')) {
      return { Icon: Flag, bg: 'from-green-500 to-red-500', emoji: '🏛️' };
    }
    
    // Crypto keywords
    if (q.includes('bitcoin') || q.includes('btc')) {
      return { Icon: Bitcoin, bg: 'from-orange-400 to-amber-600', emoji: '₿' };
    }
    if (q.includes('ethereum') || q.includes('eth')) {
      return { Icon: Coins, bg: 'from-indigo-400 to-purple-600', emoji: '⟠' };
    }
    if (q.includes('solana') || q.includes('sol')) {
      return { Icon: Coins, bg: 'from-purple-400 to-cyan-400', emoji: '◎' };
    }
    if (q.includes('xec') || q.includes('ecash')) {
      return { Icon: CircleDollarSign, bg: 'from-blue-500 to-cyan-500', emoji: '💎' };
    }
    if (q.includes('crypto') || q.includes('token') || q.includes('coin')) {
      return { Icon: Coins, bg: 'from-yellow-500 to-orange-500', emoji: '🪙' };
    }
    
    // Sports keywords
    if (q.includes('super bowl') || q.includes('nfl') || q.includes('football')) {
      return { Icon: Trophy, bg: 'from-amber-500 to-yellow-600', emoji: '🏈' };
    }
    if (q.includes('nba') || q.includes('basketball') || q.includes('lakers') || q.includes('raptors')) {
      return { Icon: Trophy, bg: 'from-orange-500 to-red-500', emoji: '🏀' };
    }
    if (q.includes('soccer') || q.includes('premier league') || q.includes('champions league')) {
      return { Icon: Trophy, bg: 'from-green-500 to-emerald-600', emoji: '⚽' };
    }
    if (q.includes('tennis') || q.includes('wimbledon') || q.includes('serena')) {
      return { Icon: Trophy, bg: 'from-lime-400 to-green-500', emoji: '🎾' };
    }
    if (q.includes('ufc') || q.includes('mma') || q.includes('fight')) {
      return { Icon: Award, bg: 'from-red-600 to-black', emoji: '🥊' };
    }
    
    // Entertainment keywords
    if (q.includes('oscar') || q.includes('academy award') || q.includes('movie')) {
      return { Icon: Film, bg: 'from-yellow-400 to-amber-500', emoji: '🎬' };
    }
    if (q.includes('grammy') || q.includes('music') || q.includes('album')) {
      return { Icon: Music2, bg: 'from-pink-500 to-purple-600', emoji: '🎵' };
    }
    if (q.includes('game') || q.includes('gaming') || q.includes('esport')) {
      return { Icon: Gamepad2, bg: 'from-purple-500 to-indigo-600', emoji: '🎮' };
    }
    if (q.includes('show') || q.includes('series') || q.includes('emmy')) {
      return { Icon: Tv, bg: 'from-blue-500 to-indigo-600', emoji: '📺' };
    }
    
    // Tech keywords
    if (q.includes('ai') || q.includes('artificial intelligence') || q.includes('openai') || q.includes('gpt')) {
      return { Icon: Cpu, bg: 'from-cyan-400 to-blue-600', emoji: '🤖' };
    }
    if (q.includes('spacex') || q.includes('rocket') || q.includes('mars') || q.includes('launch')) {
      return { Icon: Rocket, bg: 'from-gray-600 to-slate-800', emoji: '🚀' };
    }
    if (q.includes('apple') || q.includes('google') || q.includes('microsoft') || q.includes('meta')) {
      return { Icon: Building2, bg: 'from-gray-500 to-gray-700', emoji: '🏢' };
    }
    
    // Economics/Finance keywords
    if (q.includes('fed') || q.includes('interest rate') || q.includes('federal reserve')) {
      return { Icon: Landmark, bg: 'from-emerald-500 to-green-700', emoji: '🏦' };
    }
    if (q.includes('stock') || q.includes('market') || q.includes('earnings') || q.includes('s&p')) {
      return { Icon: BarChart3, bg: 'from-green-500 to-emerald-600', emoji: '📈' };
    }
    if (q.includes('company') || q.includes('ceo') || q.includes('merger')) {
      return { Icon: Briefcase, bg: 'from-blue-600 to-indigo-700', emoji: '💼' };
    }
    
    // Climate keywords
    if (q.includes('climate') || q.includes('temperature') || q.includes('weather')) {
      return { Icon: Leaf, bg: 'from-green-400 to-emerald-600', emoji: '🌡️' };
    }
    
    // Default by category
    const categoryDefaults: Record<string, { Icon: React.ComponentType<{ className?: string }>, bg: string, emoji: string }> = {
      crypto: { Icon: Bitcoin, bg: 'from-orange-400 to-amber-600', emoji: '🪙' },
      politics: { Icon: Landmark, bg: 'from-slate-500 to-slate-700', emoji: '🏛️' },
      sports: { Icon: Trophy, bg: 'from-amber-400 to-yellow-600', emoji: '🏆' },
      tech: { Icon: Cpu, bg: 'from-cyan-400 to-blue-600', emoji: '💻' },
      entertainment: { Icon: Film, bg: 'from-pink-400 to-rose-600', emoji: '🎭' },
      economics: { Icon: TrendingUp, bg: 'from-green-400 to-emerald-600', emoji: '📊' },
      elections: { Icon: Vote, bg: 'from-indigo-400 to-blue-600', emoji: '🗳️' },
      finance: { Icon: DollarSign, bg: 'from-emerald-400 to-green-600', emoji: '💵' },
      geopolitics: { Icon: Globe2, bg: 'from-amber-500 to-orange-600', emoji: '🌐' },
      earnings: { Icon: BarChart3, bg: 'from-violet-400 to-purple-600', emoji: '📈' },
      world: { Icon: Globe, bg: 'from-teal-400 to-cyan-600', emoji: '🌍' },
      climate: { Icon: Leaf, bg: 'from-green-400 to-emerald-600', emoji: '🌿' },
    };
    
    return categoryDefaults[category] || { Icon: Globe, bg: 'from-blue-400 to-sky-600', emoji: '📌' };
  };

  const { Icon, bg, emoji } = getTopicIcon();

  return (
    <div className={`relative flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br ${bg} flex items-center justify-center shadow-lg ring-1 ring-white/10`}>
      <span className="text-lg md:text-xl">{emoji}</span>
      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-card border border-border/50 flex items-center justify-center shadow-sm">
        <Icon className="w-3 h-3 text-muted-foreground" />
      </div>
    </div>
  );
};

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

  // Check if betting is closed (endDate has passed but not yet resolved)
  const isBettingClosed = new Date(prediction.endDate) < new Date();
  
  // Check if this is a crypto prediction - these have a 1 hour buffer before resolution
  const cryptoKeywords = ['bitcoin', 'btc', 'ethereum', 'eth', 'solana', 'sol', 'xec', 'xrp', 'doge', 'ada', 'cardano', 'dogecoin', 'ripple', 'crypto'];
  const isCryptoPrediction = prediction.category === 'crypto' || 
    cryptoKeywords.some(kw => prediction.question.toLowerCase().includes(kw));

  // Get sports team logos if applicable
  const sportsScore = prediction.category === 'sports' ? getKnownScore(prediction.question) : null;

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
      tech: 'tech',
      entertainment: 'entertainment',
      economics: 'economics',
      elections: 'elections',
      finance: 'finance',
      geopolitics: 'geopolitics',
      earnings: 'earnings',
      world: 'world',
      climate: 'climate',
      // legacy/back-compat
      culture: 'entertainment',
    };

    const key = categoryMap[category];
    return key ? (t[key] || category) : category;
  };

  const formatVolume = (vol: number) => {
    if (vol >= 1000000) return `${(vol / 1000000).toFixed(1)}M XEC`;
    if (vol >= 1000) return `${(vol / 1000).toFixed(1)}K XEC`;
    return `${Math.round(vol).toLocaleString()} XEC`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    // Display in user's local timezone
    return date.toLocaleDateString(undefined, {
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

  const getCategoryIcon = (category: string) => {
    const categoryConfig: Record<string, { Icon: React.ComponentType<{ className?: string }>, gradient: string }> = {
      crypto: { Icon: Bitcoin, gradient: 'from-orange-400 via-amber-500 to-orange-600' },
      politics: { Icon: Landmark, gradient: 'from-slate-400 via-slate-500 to-slate-600' },
      sports: { Icon: Trophy, gradient: 'from-amber-400 via-yellow-500 to-amber-600' },
      tech: { Icon: Cpu, gradient: 'from-cyan-400 via-blue-500 to-cyan-600' },
      entertainment: { Icon: Film, gradient: 'from-pink-400 via-rose-500 to-pink-600' },
      economics: { Icon: TrendingUp, gradient: 'from-lime-400 via-green-500 to-lime-600' },
      elections: { Icon: Vote, gradient: 'from-indigo-400 via-blue-500 to-indigo-600' },
      finance: { Icon: DollarSign, gradient: 'from-emerald-400 via-green-500 to-emerald-600' },
      geopolitics: { Icon: Globe2, gradient: 'from-amber-500 via-orange-500 to-amber-600' },
      earnings: { Icon: BarChart3, gradient: 'from-violet-400 via-purple-500 to-violet-600' },
      world: { Icon: Map, gradient: 'from-teal-400 via-cyan-500 to-teal-600' },
      climate: { Icon: Leaf, gradient: 'from-green-400 via-emerald-500 to-green-600' },
    };
    const config = categoryConfig[category] || { Icon: Globe, gradient: 'from-blue-400 via-sky-500 to-blue-600' };
    return (
      <span className={`relative bg-gradient-to-br ${config.gradient} p-1.5 rounded-xl shadow-sm ring-1 ring-border/40`}>
        <span className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-b from-foreground/20 via-transparent to-transparent opacity-70" />
        <config.Icon className="relative w-4 h-4 text-white" />
      </span>
    );
  };

  const handleBet = (position: "yes" | "no") => {
    triggerHaptic('medium');
    setSelectedPosition(position);
    setSelectedOutcome(null);
    setIsBetModalOpen(true);
  };

  const handleOutcomeBet = (outcome: Outcome) => {
    triggerHaptic('medium');
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

  const handleShareToX = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/prediction/${prediction.id}`;
    const text = `${prediction.question}\n\nPlace your bet on eCash Pulse! 🎯`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(twitterUrl, '_blank', 'noopener,noreferrer,width=550,height=420');
  };

  const handleCardClick = () => {
    triggerHaptic('light');
    navigate(`/prediction/${prediction.id}`);
  };

  return (
    <>
      <motion.div
        whileHover={{ y: -4 }}
        className="glass-card overflow-hidden group cursor-pointer relative h-full flex flex-col"
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
                onClick={handleShareToX}
                className="hidden md:flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground text-xs transition-colors"
                title="Share to X"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </button>
              <button
                onClick={handleShare}
                className="flex items-center gap-1 px-2 py-1 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground text-xs transition-colors"
                title="Share"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Topic Image/Icon - Polymarket style */}
          <div className="flex items-start gap-3 mb-2">
            <TopicImage question={prediction.question} category={prediction.category} />
            <div className="flex-1 min-w-0">
              {/* Sports Team Logos */}
              {sportsScore && (sportsScore.homeLogo || sportsScore.awayLogo) && (
                <div className="flex items-center gap-3 mb-2 py-1.5 px-2 rounded-lg bg-muted/30 w-fit">
                  <div className="flex items-center gap-1.5">
                    {sportsScore.homeLogo && (
                      <img 
                        src={sportsScore.homeLogo} 
                        alt={sportsScore.homeTeam} 
                        className="w-5 h-5 object-contain"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    )}
                    <span className="text-xs font-medium text-foreground">{sportsScore.homeTeam}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium">vs</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-foreground">{sportsScore.awayTeam}</span>
                    {sportsScore.awayLogo && (
                      <img 
                        src={sportsScore.awayLogo} 
                        alt={sportsScore.awayTeam} 
                        className="w-5 h-5 object-contain"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    )}
                  </div>
                </div>
              )}

              <h3 className="font-display font-semibold text-foreground text-base md:text-lg leading-snug group-hover:text-primary transition-colors pr-12">
                {translateTitle(prediction.question)}
              </h3>
            </div>
          </div>
        </div>

        {/* Odds Display */}
        <div className="p-4 md:p-5">
          {isMultiOption ? (
            // Multi-option display - show all outcomes with glow effects
            <div className="space-y-2 mb-4 max-h-[200px] overflow-y-auto">
              {prediction.outcomes!.map((outcome, idx) => {
                const glowColors = [
                  { bg: 'from-emerald-500/20 to-emerald-600/10', border: 'border-emerald-500/40 hover:border-emerald-400', text: 'text-emerald-400', glow: 'hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]' },
                  { bg: 'from-red-500/20 to-red-600/10', border: 'border-red-500/40 hover:border-red-400', text: 'text-red-400', glow: 'hover:shadow-[0_0_20px_rgba(239,68,68,0.3)]' },
                  { bg: 'from-blue-500/20 to-blue-600/10', border: 'border-blue-500/40 hover:border-blue-400', text: 'text-blue-400', glow: 'hover:shadow-[0_0_20px_rgba(59,130,246,0.3)]' },
                  { bg: 'from-purple-500/20 to-purple-600/10', border: 'border-purple-500/40 hover:border-purple-400', text: 'text-purple-400', glow: 'hover:shadow-[0_0_20px_rgba(168,85,247,0.3)]' },
                  { bg: 'from-amber-500/20 to-amber-600/10', border: 'border-amber-500/40 hover:border-amber-400', text: 'text-amber-400', glow: 'hover:shadow-[0_0_20px_rgba(245,158,11,0.3)]' },
                  { bg: 'from-cyan-500/20 to-cyan-600/10', border: 'border-cyan-500/40 hover:border-cyan-400', text: 'text-cyan-400', glow: 'hover:shadow-[0_0_20px_rgba(6,182,212,0.3)]' },
                ];
                const colorIdx = idx % glowColors.length;
                const color = glowColors[colorIdx];
                
                return (
                  <button
                    key={outcome.id}
                    type="button"
                    disabled={isBettingClosed}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isBettingClosed) handleOutcomeBet(outcome);
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-lg bg-gradient-to-r ${color.bg} border ${color.border} ${isBettingClosed ? 'opacity-50 cursor-not-allowed' : `${color.glow} cursor-pointer hover:scale-[1.02]`} transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-primary/60`}
                  >
                    <span className="text-sm text-foreground font-medium truncate flex-1 mr-2">{outcome.label}</span>
                    <span className={`text-sm font-bold ${color.text}`}>{outcome.odds}%</span>
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

          {/* Crypto buffer notice */}
          {isCryptoPrediction && !isBettingClosed && (
            <div className="flex items-center gap-2 p-2 mb-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span className="text-xs text-amber-300">
                Betting closes 1 hour before resolution
              </span>
            </div>
          )}

          {/* Bet Buttons - Only show for non-multi-option */}
          {!isMultiOption && (
            isBettingClosed ? (
              <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-muted/50 border border-border/50">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Betting Closed - Awaiting Resolution</span>
              </div>
            ) : (
              <div className="flex gap-3 sm:gap-4">
                <Button variant="yes" size="sm" className="flex-1" onClick={(e) => { e.stopPropagation(); handleBet("yes"); }}>
                  {positiveBetLabel}
                </Button>
                <Button variant="no" size="sm" className="flex-1" onClick={(e) => { e.stopPropagation(); handleBet("no"); }}>
                  {negativeBetLabel}
                </Button>
              </div>
            )
          )}

          {/* NOTE: "Comments & Activity" button removed per request */}
        </div>
      </motion.div>

      <BetModal
        isOpen={isBetModalOpen}
        onClose={() => setIsBetModalOpen(false)}
        prediction={{
          ...prediction,
          category: prediction.category,
        }}
        position={selectedPosition}
        selectedOutcome={selectedOutcome}
      />
    </>
  );
};

export default PredictionCard;
