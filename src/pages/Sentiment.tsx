import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EyeOff, Plus, ThumbsUp, ThumbsDown, Shield, Users, Clock, Sparkles, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { CreateSentimentModal } from "@/components/CreateSentimentModal";
import { SentimentVoteModal } from "@/components/SentimentVoteModal";
import { formatDistanceToNow } from "date-fns";

/* =======================
   CONFIG
======================= */
const TREASURY_ADDRESS = "ecash:qz6jsgshsv0v2tyuleptwr4at8xaxsakmstkhzc0pp";

const CREATE_TOPIC_USD = 1;

/* =======================
   TYPES
======================= */
interface SentimentTopic {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  expires_at: string;
  status: string;
  vote_cost: number;
  agree_count: number;
  disagree_count: number;
}

/* =======================
   COMPONENT
======================= */
const Sentiment = () => {
  const { user } = useAuth();
  const [topics, setTopics] = useState<SentimentTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<SentimentTopic | null>(null);
  const [votePosition, setVotePosition] = useState<"agree" | "disagree" | null>(null);

  const [xecPriceUsd, setXecPriceUsd] = useState<number | null>(null);

  /* =======================
     FETCH XEC PRICE
  ======================= */
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const { data } = await supabase.functions.invoke("coingecko-price", {
          body: { symbol: "ecash" },
        });
        setXecPriceUsd(data?.usd ?? null);
      } catch {
        setXecPriceUsd(null);
      }
    };
    fetchPrice();
  }, []);

  const createTopicCostXec = xecPriceUsd !== null ? Math.ceil(CREATE_TOPIC_USD / xecPriceUsd) : null;

  /* =======================
     FETCH TOPICS
  ======================= */
  const fetchTopics = async () => {
    try {
      const { data: topicsData, error } = await supabase
        .from("sentiment_topics")
        .select("id, title, description, created_at, expires_at, status, vote_cost")
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const topicsWithCounts = await Promise.all(
        (topicsData || []).map(async (topic) => {
          const { data: votes } = await supabase.from("sentiment_votes").select("position").eq("topic_id", topic.id);

          const agree_count = votes?.filter((v) => v.position === "agree").length || 0;
          const disagree_count = votes?.filter((v) => v.position === "disagree").length || 0;

          return {
            ...topic,
            vote_cost: topic.vote_cost || 500,
            agree_count,
            disagree_count,
          };
        }),
      );

      setTopics(topicsWithCounts);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load sentiment topics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopics();
  }, []);

  const handleVote = (topic: SentimentTopic, position: "agree" | "disagree") => {
    if (!user) {
      toast.error("Please connect your wallet to vote");
      return;
    }
    setSelectedTopic(topic);
    setVotePosition(position);
  };

  return (
    <>
      <Helmet>
        <title>Public Sentiment | eCash Pulse</title>
        <meta name="description" content="Anonymous sentiment voting powered by eCash." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Header />

        <main className="pt-24 pb-16">
          {/* HERO */}
          <section className="px-4 mb-12">
            <div className="max-w-4xl mx-auto text-center">
              <Badge variant="outline" className="mb-4 px-4 py-1.5 border-primary/30 bg-primary/5">
                <EyeOff className="w-3.5 h-3.5 mr-1.5" />
                100% Anonymous
              </Badge>

              <h1 className="font-display font-bold text-3xl md:text-5xl mb-4">
                Public <span className="text-primary">Sentiment</span>
              </h1>

              <p className="text-muted-foreground text-lg mb-8">
                Express opinions anonymously. No rewards. No tracking.
              </p>

              <Button
                size="lg"
                onClick={() => {
                  if (!user) {
                    toast.error("Please connect your wallet first");
                    return;
                  }
                  setIsCreateOpen(true);
                }}
              >
                <Plus className="w-5 h-5 mr-2" />
                Create Topic (~$1 / {createTopicCostXec ? `${createTopicCostXec.toLocaleString()} XEC` : "…"})
              </Button>
            </div>
          </section>

          {/* TOPICS */}
          <section className="px-4">
            <div className="max-w-4xl mx-auto space-y-4">
              {loading ? (
                <Card>
                  <CardContent className="py-10 text-center">Loading topics…</CardContent>
                </Card>
              ) : topics.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center">No active topics</CardContent>
                </Card>
              ) : (
                topics.map((topic) => {
                  const total = topic.agree_count + topic.disagree_count || 1;
                  const agreePercent = (topic.agree_count / total) * 100;

                  return (
                    <Card key={topic.id}>
                      <CardHeader>
                        <div className="flex justify-between">
                          <CardTitle>{topic.title}</CardTitle>
                          <Badge variant="outline">
                            <Clock className="w-3 h-3 mr-1" />
                            {formatDistanceToNow(new Date(topic.expires_at), { addSuffix: true })}
                          </Badge>
                        </div>
                        {topic.description && <p className="text-sm text-muted-foreground mt-2">{topic.description}</p>}
                      </CardHeader>

                      <CardContent>
                        <Progress value={agreePercent} className="mb-4" />

                        <div className="flex gap-3">
                          <Button variant="outline" className="flex-1" onClick={() => handleVote(topic, "agree")}>
                            <ThumbsUp className="w-4 h-4 mr-1" />
                            Agree ({topic.vote_cost} XEC)
                          </Button>
                          <Button variant="outline" className="flex-1" onClick={() => handleVote(topic, "disagree")}>
                            <ThumbsDown className="w-4 h-4 mr-1" />
                            Disagree ({topic.vote_cost} XEC)
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </section>
        </main>

        <Footer />
      </div>

      <CreateSentimentModal open={isCreateOpen} onOpenChange={setIsCreateOpen} onSuccess={fetchTopics} />

      <SentimentVoteModal
        open={!!selectedTopic && !!votePosition}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTopic(null);
            setVotePosition(null);
          }
        }}
        topic={selectedTopic}
        position={votePosition}
        onSuccess={fetchTopics}
      />
    </>
  );
};

export default Sentiment;
