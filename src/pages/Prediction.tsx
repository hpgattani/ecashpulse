import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { ArrowLeft, Share2, Clock, Users, TrendingUp, TrendingDown, Copy, Check, CheckCircle2, Activity, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BetModal from "@/components/BetModal";
import { Outcome } from "@/hooks/usePredictions";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

interface PredictionData {
  id: string;
  title: string;
  description: string | null;
  category: string;
  yes_pool: number;
  no_pool: number;
  end_date: string;
  status: string;
  escrow_address: string;
  outcomes?: Outcome[];
}

interface UserBet {
  position: string;
  amount: number;
  outcome_label?: string;
}

interface BetActivity {
  id: string;
  amount: number;
  position: string;
  address: string;
  timestamp: string;
  outcome_label?: string;
}

const Prediction = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { t, translateTitle } = useLanguage();
  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBetModalOpen, setIsBetModalOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<"yes" | "no">("yes");
  const [selectedOutcome, setSelectedOutcome] = useState<Outcome | null>(null);
  const [copied, setCopied] = useState(false);
  const [userBet, setUserBet] = useState<UserBet | null>(null);
  const [activities, setActivities] = useState<BetActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);

  const fetchPrediction = async () => {
    if (!id) return;

    const { data: predData, error: predError } = await supabase
      .from("predictions")
      .select("*")
      .eq("id", id)
      .single();

    if (predError || !predData) {
      setLoading(false);
      return;
    }

    // Fetch outcomes
    const { data: outcomesData } = await supabase
      .from("outcomes")
      .select("*")
      .eq("prediction_id", id);

    // Calculate odds - use outcomes.pool if available, otherwise fallback to yes_pool/no_pool
    const outcomeTotalPool = outcomesData?.reduce((sum, oc) => sum + oc.pool, 0) || 0;
    const predictionTotalPool = predData.yes_pool + predData.no_pool;
    
    const outcomes: Outcome[] = outcomesData?.map((o, index) => {
      // If outcomes have their own pools, use them
      if (outcomeTotalPool > 0) {
        return {
          id: o.id,
          label: o.label,
          pool: o.pool,
          odds: Math.round((o.pool / outcomeTotalPool) * 100),
        };
      }
      
      // Fallback: map first outcome to yes_pool, second to no_pool
      // This handles legacy data where bets were placed with position instead of outcome_id
      if (outcomesData && outcomesData.length === 2 && predictionTotalPool > 0) {
        const isFirstOutcome = index === 0;
        const pool = isFirstOutcome ? predData.yes_pool : predData.no_pool;
        return {
          id: o.id,
          label: o.label,
          pool: pool,
          odds: Math.round((pool / predictionTotalPool) * 100),
        };
      }
      
      // Default equal split
      return {
        id: o.id,
        label: o.label,
        pool: o.pool,
        odds: Math.round(100 / (outcomesData?.length || 2)),
      };
    }) || [];

    setPrediction({
      ...predData,
      outcomes: outcomes.length > 0 ? outcomes : undefined,
    });
    setLoading(false);
  };

  useEffect(() => {
    fetchPrediction();

    // Real-time subscription for instant odds updates
    const channel = supabase
      .channel(`prediction-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'predictions',
          filter: `id=eq.${id}`,
        },
        () => {
          console.log('[Realtime] Prediction updated');
          fetchPrediction();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bets',
          filter: `prediction_id=eq.${id}`,
        },
        () => {
          console.log('[Realtime] Bet placed on this prediction');
          setTimeout(() => fetchPrediction(), 500);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'outcomes',
          filter: `prediction_id=eq.${id}`,
        },
        () => {
          console.log('[Realtime] Outcome updated');
          fetchPrediction();
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status);
      });

    // Listen for manual refresh events
    const handleRefresh = () => fetchPrediction();
    window.addEventListener('predictions:refetch', handleRefresh);

    return () => {
      window.removeEventListener('predictions:refetch', handleRefresh);
      supabase.removeChannel(channel);
    };
  }, [id]);

  // Fetch user's bet on this prediction
  useEffect(() => {
    const fetchUserBet = async () => {
      if (!id || !user) {
        setUserBet(null);
        return;
      }

      const { data: bets } = await supabase
        .from("bets")
        .select("position, amount, outcome_id, status")
        .eq("prediction_id", id)
        .eq("user_id", user.id)
        .in("status", ["pending", "confirmed", "won", "lost"]);

      if (bets && bets.length > 0) {
        // Sum up all bets by the user on this prediction
        const totalAmount = bets.reduce((sum, b) => sum + b.amount, 0);
        const firstBet = bets[0];
        
        // If multi-option, get the outcome label
        let outcomeLabel: string | undefined;
        if (firstBet.outcome_id) {
          const { data: outcome } = await supabase
            .from("outcomes")
            .select("label")
            .eq("id", firstBet.outcome_id)
            .single();
          outcomeLabel = outcome?.label;
        }

        setUserBet({
          position: firstBet.position,
          amount: totalAmount,
          outcome_label: outcomeLabel,
        });
      } else {
        setUserBet(null);
      }
    };

    fetchUserBet();
  }, [id, user, isBetModalOpen]);

  // Fetch betting activity for this prediction
  useEffect(() => {
    const fetchActivities = async () => {
      if (!id) return;
      setActivitiesLoading(true);

      try {
        const { data, error } = await supabase.functions.invoke('get-prediction-activity', {
          body: { prediction_id: id, limit: 10 }
        });

        if (!error && data?.activities) {
          setActivities(data.activities);
        }
      } catch (err) {
        console.error('Error fetching activities:', err);
      } finally {
        setActivitiesLoading(false);
      }
    };

    fetchActivities();

    // Refresh on bet events
    const handleRefresh = () => fetchActivities();
    window.addEventListener('userbets:refetch', handleRefresh);

    return () => {
      window.removeEventListener('userbets:refetch', handleRefresh);
    };
  }, [id]);
  const handleShare = async () => {
    const url = window.location.href;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: prediction?.title || "Prediction",
          text: prediction?.description || "Check out this prediction!",
          url,
        });
      } catch (err) {
        // User cancelled or error
      }
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatVolume = (satoshis: number) => {
    const xec = satoshis / 100;
    if (xec >= 1000000) return `${(xec / 1000000).toFixed(1)}M XEC`;
    if (xec >= 1000) return `${(xec / 1000).toFixed(0)}K XEC`;
    return `${xec.toFixed(0)} XEC`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    // Display in IST (Asia/Kolkata)
    return date.toLocaleDateString("en-IN", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Kolkata",
    });
  };

  const formatActivityDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t.justNow;
    if (diffMins < 60) return `${diffMins}${t.minutesAgo}`;
    if (diffHours < 24) return `${diffHours}${t.hoursAgo}`;
    if (diffDays < 7) return `${diffDays}${t.daysAgo}`;
    return date.toLocaleDateString("en-IN", { month: "short", day: "numeric", timeZone: "Asia/Kolkata" });
  };

  const formatAddress = (address: string) => {
    if (!address) return 'Anonymous';
    const clean = address.replace('ecash:', '');
    return `${clean.slice(0, 6)}...${clean.slice(-4)}`;
  };
  const getCategoryEmoji = (category: string) => {
    const emojis: Record<string, string> = {
      crypto: "₿",
      politics: "🏛️",
      sports: "⚽",
      tech: "🚀",
      entertainment: "🎬",
      economics: "📈",
      elections: "🗳️",
    };
    return emojis[category] || "🌐";
  };

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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!prediction) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Prediction not found</h1>
          <Link to="/">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Markets
            </Button>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const totalPool = prediction.yes_pool + prediction.no_pool;
  const yesOdds = totalPool > 0 ? Math.round((prediction.yes_pool / totalPool) * 100) : 50;
  const noOdds = totalPool > 0 ? Math.round((prediction.no_pool / totalPool) * 100) : 50;
  const isMultiOption = (() => {
    const outcomes = prediction.outcomes;
    if (!outcomes || outcomes.length === 0) return false;

    const labels = outcomes.map((o) => o.label.toLowerCase().trim());
    const isStandardYesNo = outcomes.length === 2 && labels.includes("yes") && labels.includes("no");
    const isStandardUpDown = outcomes.length === 2 && labels.includes("up") && labels.includes("down");
    const isBinary = isStandardYesNo || isStandardUpDown;

    return outcomes.length > 2 || !isBinary;
  })();

  const handleBet = (position: "yes" | "no") => {
    setSelectedPosition(position);
    setSelectedOutcome(null);
    setIsBetModalOpen(true);
  };

  const handleOutcomeBet = (outcome: Outcome) => {
    setSelectedOutcome(outcome);
    setSelectedPosition("yes");
    setIsBetModalOpen(true);
  };

  const predictionForModal = {
    id: prediction.id,
    question: prediction.title,
    description: prediction.description || "",
    category: prediction.category as "crypto" | "politics" | "sports" | "tech" | "entertainment" | "economics" | "elections",
    yesOdds,
    noOdds,
    volume: totalPool / 100,
    endDate: prediction.end_date,
    escrowAddress: prediction.escrow_address,
    isMultiOption,
    outcomes: prediction.outcomes,
  };

  return (
    <>
      <Helmet>
        <title>{prediction.title} | eCash Predictions</title>
        <meta name="description" content={prediction.description || prediction.title} />
        <meta property="og:title" content={prediction.title} />
        <meta property="og:description" content={prediction.description || "Bet on this prediction with eCash"} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={window.location.href} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={prediction.title} />
        <meta name="twitter:description" content={prediction.description || "Bet on this prediction with eCash"} />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Header />

        <main className="container mx-auto px-4 py-8 md:py-12">
          <div className="max-w-3xl mx-auto">
            {/* Back link */}
            <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6">
              <ArrowLeft className="w-4 h-4" />
              {t.markets}
            </Link>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card overflow-hidden"
            >
              {/* Header */}
              <div className="p-6 border-b border-border/30">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getCategoryEmoji(prediction.category)}</span>
                    <span className="text-sm uppercase tracking-wider text-muted-foreground font-medium">
                      {getCategoryLabel(prediction.category)}
                    </span>
                    {isMultiOption && (
                      <span className="text-xs px-2 py-1 rounded bg-primary/20 text-primary font-medium">{t.multi}</span>
                    )}
                    {prediction.status !== "active" && (
                      <span className={`text-xs px-2 py-1 rounded font-medium ${
                        prediction.status === "resolved_yes" ? "bg-emerald-500/20 text-emerald-400" :
                        prediction.status === "resolved_no" ? "bg-red-500/20 text-red-400" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {prediction.status.replace("_", " ").toUpperCase()}
                      </span>
                    )}
                  </div>
                  <Button variant="outline" size="sm" onClick={handleShare}>
                    {copied ? <Check className="w-4 h-4 mr-2" /> : <Share2 className="w-4 h-4 mr-2" />}
                    {copied ? "Copied!" : "Share"}
                  </Button>
                </div>

                <h1 className="font-display font-bold text-2xl md:text-3xl text-foreground leading-tight">
                  {translateTitle(prediction.title)}
                </h1>

                {prediction.description && (
                  <p className="mt-4 text-muted-foreground">{prediction.description}</p>
                )}

                {/* User Bet Indicator */}
                {userBet && (
                  <div className="mt-4 flex items-center gap-2 px-4 py-3 rounded-lg bg-primary/10 border border-primary/30">
                    <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-sm font-medium text-foreground">
                      You bet {(userBet.amount / 100).toLocaleString()} XEC on{" "}
                      <span className="text-primary font-semibold">
                        {userBet.outcome_label || userBet.position.toUpperCase()}
                      </span>
                    </span>
                  </div>
                )}
              </div>

              {/* Odds Display */}
              <div className="p-6">
                {isMultiOption ? (
                  <div className="space-y-3 mb-6">
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">Outcomes</h3>
                    {prediction.outcomes!.map((outcome, index) => {
                      const colors = [
                        'from-emerald-500/20 to-emerald-600/10 border-emerald-500/40 hover:border-emerald-400',
                        'from-red-500/20 to-red-600/10 border-red-500/40 hover:border-red-400',
                        'from-blue-500/20 to-blue-600/10 border-blue-500/40 hover:border-blue-400',
                        'from-purple-500/20 to-purple-600/10 border-purple-500/40 hover:border-purple-400',
                      ];
                      const textColors = ['text-emerald-400', 'text-red-400', 'text-blue-400', 'text-purple-400'];
                      const bgColors = ['bg-emerald-400', 'bg-red-400', 'bg-blue-400', 'bg-purple-400'];
                      const colorIndex = index % colors.length;
                      
                      return (
                        <button
                          key={outcome.id}
                          type="button"
                          onClick={() => prediction.status === "active" && handleOutcomeBet(outcome)}
                          disabled={prediction.status !== "active"}
                          className={`w-full flex items-center justify-between p-4 rounded-xl bg-gradient-to-r ${colors[colorIndex]} border transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01]`}
                        >
                          <span className="text-foreground font-semibold text-base">{outcome.label}</span>
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-16 rounded-full bg-muted/50 overflow-hidden">
                              <div className={`h-full rounded-full ${bgColors[colorIndex]}`} style={{ width: `${outcome.odds}%` }} />
                            </div>
                            <span className={`text-xl font-bold ${textColors[colorIndex]}`}>{outcome.odds}%</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mb-6">
                    <div className="flex justify-between text-sm mb-3">
                      <span className="text-emerald-400 font-semibold text-lg">{t.yes} {yesOdds}%</span>
                      <span className="text-red-400 font-semibold text-lg">{t.no} {noOdds}%</span>
                    </div>
                    <div className="h-4 rounded-full bg-muted overflow-hidden flex">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${yesOdds}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="odds-bar-yes"
                      />
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${noOdds}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="odds-bar-no"
                      />
                    </div>
                  </div>
                )}

                {/* Stats */}
                <div className="flex flex-wrap gap-4 mb-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>{formatVolume(totalPool)} {t.volume}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>{t.ends} {formatDate(prediction.end_date)}</span>
                  </div>
                </div>

                {/* Bet Buttons */}
                {prediction.status === "active" && !isMultiOption && (
                  <div className="flex gap-3">
                    <Button variant="yes" size="lg" className="flex-1" onClick={() => handleBet("yes")}>
                      {t.betYes}
                    </Button>
                    <Button variant="no" size="lg" className="flex-1" onClick={() => handleBet("no")}>
                      {t.betNo}
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Activity Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-card mt-6 overflow-hidden"
            >
              <div className="p-4 md:p-6 border-b border-border/30">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  <h2 className="font-display font-semibold text-lg text-foreground">{t.recentActivity}</h2>
                </div>
              </div>

              <div className="p-4 md:p-6">
                {activitiesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : activities.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">{t.noActivity}</p>
                    <p className="text-xs mt-1">{t.beFirst}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activities.map((activity, index) => (
                      <motion.div
                        key={activity.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            activity.position === 'yes' ? 'bg-emerald-500/20' : 'bg-red-500/20'
                          }`}>
                            {activity.position === 'yes' ? (
                              <TrendingUp className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <TrendingDown className="w-4 h-4 text-red-400" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {formatAddress(activity.address)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatActivityDate(activity.timestamp)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-foreground">
                            {(activity.amount / 100).toLocaleString()} XEC
                          </p>
                          <p className={`text-xs font-medium ${
                            activity.position === 'yes' ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {activity.outcome_label || activity.position.toUpperCase()}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </main>

        <Footer />
      </div>

      <BetModal
        isOpen={isBetModalOpen}
        onClose={() => setIsBetModalOpen(false)}
        prediction={predictionForModal}
        position={selectedPosition}
        selectedOutcome={selectedOutcome}
      />
    </>
  );
};

export default Prediction;
