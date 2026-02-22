import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  FileText,
  Shield,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PredictionDetailModal from "@/components/PredictionDetailModal";
import BetModal from "@/components/BetModal";
import CountdownTimer from "@/components/CountdownTimer";

import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Outcome } from "@/hooks/usePredictions";

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

interface BetWithPrediction {
  id: string;
  position: "yes" | "no";
  amount: number;
  status: "pending" | "confirmed" | "won" | "lost" | "refunded";
  tx_hash: string | null;
  payout_tx_hash: string | null;
  created_at: string;
  payout_amount: number | null;
  prediction_id: string;
  prediction: {
    id: string;
    title: string;
    status: string;
    end_date: string;
    yes_pool: number;
    no_pool: number;
    description: string | null;
    category: string;
  } | null;
}

interface UserSubmission {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  end_date: string;
  yes_pool: number;
  no_pool: number;
  created_at: string;
}

interface FullPrediction {
  id: string;
  question: string;
  description: string;
  category: string;
  yesOdds: number;
  noOdds: number;
  volume: number;
  endDate: string;
  escrowAddress?: string;
  isMultiOption?: boolean;
  outcomes?: Outcome[];
  yesPool?: number;
  noPool?: number;
}

/* -------------------------------------------------------------------------- */
/*                                  Component                                 */
/* -------------------------------------------------------------------------- */

const MyBets = () => {
  const { user, sessionToken, loading: authLoading } = useAuth();
  const { t, translateTitle, language } = useLanguage();
  const navigate = useNavigate();

  const [bets, setBets] = useState<BetWithPrediction[]>([]);
  const [submissions, setSubmissions] = useState<UserSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [submissionsLoading, setSubmissionsLoading] = useState(true);

  const [selectedPrediction, setSelectedPrediction] = useState<FullPrediction | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hedgeBetOpen, setHedgeBetOpen] = useState(false);
  const [hedgePosition, setHedgePosition] = useState<"yes" | "no">("yes");
  const [hedgePrediction, setHedgePrediction] = useState<FullPrediction | null>(null);

  /* ------------------------------ Auth guard ------------------------------ */

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [authLoading, user, navigate]);

  /* ------------------------------- Fetching ------------------------------- */

  useEffect(() => {
    if (!user || !sessionToken) return;

    fetchBets();
    fetchSubmissions();

    const channel = supabase
      .channel("my-bets")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bets", filter: `user_id=eq.${user.id}` },
        fetchBets,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, sessionToken]);

  const fetchBets = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("get-user-bets", {
        body: { session_token: sessionToken },
      });

      if (!error && data?.bets) {
        setBets(data.bets as BetWithPrediction[]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubmissions = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from("predictions")
        .select("*")
        .eq("creator_id", user.id)
        .order("created_at", { ascending: false });

      setSubmissions(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmissionsLoading(false);
    }
  };

  /* ---------------------------- SAFE FILTER 🔥 ---------------------------- */

  const safeBets = bets.filter((b) => b.prediction);

  /* ------------------------------- Helpers -------------------------------- */

  const formatXEC = (sats: number) => `${(sats / 100).toLocaleString()} XEC`;

  const formatDate = (date: string) => {
    const locales: Record<string, string> = {
      en: "en-US",
      "pt-BR": "pt-BR",
      ko: "ko-KR",
      ja: "ja-JP",
    };

    return new Date(date).toLocaleString(locales[language] || undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="text-yellow-500">
            <Clock className="w-3 h-3 mr-1" />
            {t.pending}
          </Badge>
        );
      case "confirmed":
        return (
          <Badge variant="outline" className="text-blue-500">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {t.confirmed}
          </Badge>
        );
      case "won":
        return (
          <Badge variant="outline" className="text-emerald-500">
            <TrendingUp className="w-3 h-3 mr-1" />
            {t.won}
          </Badge>
        );
      case "lost":
        return (
          <Badge variant="outline" className="text-red-500">
            <TrendingDown className="w-3 h-3 mr-1" />
            {t.lost}
          </Badge>
        );
      case "refunded":
        return (
          <Badge variant="outline">
            <XCircle className="w-3 h-3 mr-1" />
            {t.refunded}
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  /* ------------------------------- Loading -------------------------------- */

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  /* -------------------------------- Render -------------------------------- */

  return (
    <>
      <Helmet>
        <title>{t.myBetsTitle} - eCash Pulse</title>
        <meta name="description" content={t.trackYourBets} />
      </Helmet>

      <div className="min-h-screen">
        <Header />

        <main className="container mx-auto px-4 py-8 pt-24">
          <Button variant="ghost" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t.backToMarkets}
          </Button>

          <h1 className="text-3xl font-bold mt-4">{t.myBetsTitle}</h1>
          <p className="text-muted-foreground">{t.trackYourBets}</p>

          <Tabs defaultValue="bets" className="mt-6">
            <TabsList>
              <TabsTrigger value="bets">
                {t.myBetsTitle} ({safeBets.length})
              </TabsTrigger>
              <TabsTrigger value="pending">{t.pending}</TabsTrigger>
            </TabsList>

            <TabsContent value="bets" className="space-y-4 mt-4">
              {safeBets.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">{t.noBetsYet}</div>
              ) : (
                safeBets.map((bet) => (
                  <button
                    key={bet.id}
                    type="button"
                    className="glass-card p-4 cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all w-full text-left relative z-10"
                    onClick={() => navigate(`/prediction/${bet.prediction_id}`)}
                  >
                    <h3 className="font-semibold">{translateTitle(bet.prediction!.title)}</h3>

                    <div className="flex gap-2 text-sm mt-2">
                      {getStatusBadge(bet.status)}
                      <CountdownTimer endDate={bet.prediction!.end_date} />
                      <span className="text-muted-foreground">{formatDate(bet.created_at)}</span>
                    </div>

                    <div className="mt-3 font-bold">{formatXEC(bet.amount)}</div>
                  </button>
                ))
              )}
            </TabsContent>
          </Tabs>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default MyBets;
