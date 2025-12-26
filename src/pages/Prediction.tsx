import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { ArrowLeft, Share2, Clock, Users, TrendingUp, TrendingDown, Copy, Check, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BetModal from "@/components/BetModal";
import { Outcome } from "@/hooks/usePredictions";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

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

const Prediction = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBetModalOpen, setIsBetModalOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<"yes" | "no">("yes");
  const [selectedOutcome, setSelectedOutcome] = useState<Outcome | null>(null);
  const [copied, setCopied] = useState(false);
  const [userBet, setUserBet] = useState<UserBet | null>(null);

  useEffect(() => {
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

      const outcomes: Outcome[] = outcomesData?.map((o) => {
        const totalPool = outcomesData.reduce((sum, oc) => sum + oc.pool, 0);
        return {
          id: o.id,
          label: o.label,
          pool: o.pool,
          odds: totalPool > 0 ? Math.round((o.pool / totalPool) * 100) : Math.round(100 / outcomesData.length),
        };
      }) || [];

      setPrediction({
        ...predData,
        outcomes: outcomes.length > 0 ? outcomes : undefined,
      });
      setLoading(false);
    };

    fetchPrediction();
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
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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
    category: prediction.category as "crypto" | "politics" | "sports" | "tech" | "entertainment" | "economics",
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
              Back to Markets
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
                      {prediction.category}
                    </span>
                    {isMultiOption && (
                      <span className="text-xs px-2 py-1 rounded bg-primary/20 text-primary font-medium">Multi-Option</span>
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
                  {prediction.title}
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
                  <div className="space-y-2 mb-6">
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">Outcomes</h3>
                    {prediction.outcomes!.map((outcome) => (
                      <button
                        key={outcome.id}
                        type="button"
                        onClick={() => prediction.status === "active" && handleOutcomeBet(outcome)}
                        disabled={prediction.status !== "active"}
                        className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/60 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="text-foreground font-medium">{outcome.label}</span>
                        <span className="text-lg font-bold text-primary">{outcome.odds}%</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mb-6">
                    <div className="flex justify-between text-sm mb-3">
                      <span className="text-emerald-400 font-semibold text-lg">Yes {yesOdds}%</span>
                      <span className="text-red-400 font-semibold text-lg">No {noOdds}%</span>
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
                    <span>{formatVolume(totalPool)} Volume</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>Ends {formatDate(prediction.end_date)}</span>
                  </div>
                </div>

                {/* Bet Buttons */}
                {prediction.status === "active" && !isMultiOption && (
                  <div className="flex gap-3">
                    <Button variant="yes" size="lg" className="flex-1" onClick={() => handleBet("yes")}>
                      Bet Yes
                    </Button>
                    <Button variant="no" size="lg" className="flex-1" onClick={() => handleBet("no")}>
                      Bet No
                    </Button>
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
