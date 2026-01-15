import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  EyeOff, 
  Plus, 
  ThumbsUp, 
  ThumbsDown, 
  Shield, 
  Users, 
  Clock,
  Sparkles,
  Lock
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { CreateSentimentModal } from '@/components/CreateSentimentModal';
import { SentimentVoteModal } from '@/components/SentimentVoteModal';
import { formatDistanceToNow } from 'date-fns';

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

const Sentiment = () => {
  const { user } = useAuth();
  const [topics, setTopics] = useState<SentimentTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<SentimentTopic | null>(null);
  const [votePosition, setVotePosition] = useState<'agree' | 'disagree' | null>(null);

  const fetchTopics = async () => {
    try {
      // Fetch topics with vote counts
      const { data: topicsData, error: topicsError } = await supabase
        .from('sentiment_topics')
        .select('id, title, description, created_at, expires_at, status, vote_cost')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (topicsError) throw topicsError;

      // Fetch vote counts for each topic
      const topicsWithCounts = await Promise.all(
        (topicsData || []).map(async (topic) => {
          const { data: votes } = await supabase
            .from('sentiment_votes')
            .select('position')
            .eq('topic_id', topic.id);

          const agree_count = votes?.filter(v => v.position === 'agree').length || 0;
          const disagree_count = votes?.filter(v => v.position === 'disagree').length || 0;

          return { ...topic, vote_cost: topic.vote_cost || 500, agree_count, disagree_count };
        })
      );

      setTopics(topicsWithCounts);
    } catch (error) {
      console.error('Error fetching sentiment topics:', error);
      toast.error('Failed to load sentiment topics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopics();
  }, []);

  const handleVote = (topic: SentimentTopic, position: 'agree' | 'disagree') => {
    if (!user) {
      toast.error('Please connect your wallet to vote');
      return;
    }
    setSelectedTopic(topic);
    setVotePosition(position);
  };

  const redactAddress = (hash: string) => {
    return `${hash.slice(0, 4)}****${hash.slice(-4)}`;
  };

  return (
    <>
      <Helmet>
        <title>Public Sentiment - Anonymous Opinion Gauging | eCash Pulse</title>
        <meta name="description" content="Express your opinion anonymously on trending topics. Create sentiment topics for $1, vote with 500 XEC. All contributions support eCash Pulse treasury." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Header />
        
        <main className="pt-24 pb-16">
          {/* Hero Section */}
          <section className="px-4 mb-12">
            <div className="max-w-4xl mx-auto text-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <Badge variant="outline" className="mb-4 px-4 py-1.5 border-primary/30 bg-primary/5">
                  <EyeOff className="w-3.5 h-3.5 mr-1.5" />
                  100% Anonymous
                </Badge>
                
                <h1 className="font-display font-bold text-3xl md:text-5xl text-foreground mb-4">
                  Public <span className="text-primary">Sentiment</span>
                </h1>
                
                <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">
                  Express your true opinion without revealing your identity. 
                  Your address is cryptographically hashed and redacted—only your voice matters.
                </p>

                {/* Key Features */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto mb-8">
                  <Card className="bg-card/50 border-border/50">
                    <CardContent className="pt-6 text-center">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                        <Shield className="w-6 h-6 text-primary" />
                      </div>
                      <h3 className="font-semibold text-foreground mb-1">Anonymous Voting</h3>
                      <p className="text-sm text-muted-foreground">Addresses are hashed & redacted</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-card/50 border-border/50">
                    <CardContent className="pt-6 text-center">
                      <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-3">
                        <Lock className="w-6 h-6 text-accent" />
                      </div>
                      <h3 className="font-semibold text-foreground mb-1">Creator Sets Vote Cost</h3>
                      <p className="text-sm text-muted-foreground">$0.05 - $5 per vote</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-card/50 border-border/50">
                    <CardContent className="pt-6 text-center">
                      <div className="w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center mx-auto mb-3">
                        <Sparkles className="w-6 h-6 text-secondary-foreground" />
                      </div>
                      <h3 className="font-semibold text-foreground mb-1">Supports Treasury</h3>
                      <p className="text-sm text-muted-foreground">No payouts—funds eCash Pulse</p>
                    </CardContent>
                  </Card>
                </div>

                <Button 
                  size="lg" 
                  className="gap-2"
                  onClick={() => {
                    if (!user) {
                      toast.error('Please connect your wallet first');
                      return;
                    }
                    setIsCreateOpen(true);
                  }}
                >
                  <Plus className="w-5 h-5" />
                  Create Topic (~$1 / 10,000 XEC)
                </Button>
              </motion.div>
            </div>
          </section>

          {/* Topics Section */}
          <section className="px-4">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display font-bold text-xl text-foreground">
                  Active Topics
                </h2>
                <Badge variant="secondary" className="gap-1">
                  <Users className="w-3 h-3" />
                  {topics.length} Topics
                </Badge>
              </div>

              {loading ? (
                <div className="grid gap-4">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="py-6">
                        <div className="h-6 bg-muted rounded w-3/4 mb-4" />
                        <div className="h-4 bg-muted rounded w-1/2 mb-4" />
                        <div className="h-8 bg-muted rounded" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : topics.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-12 text-center">
                    <EyeOff className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-semibold text-foreground mb-2">No Active Topics</h3>
                    <p className="text-muted-foreground mb-4">Be the first to create a sentiment topic!</p>
                    <Button onClick={() => setIsCreateOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create First Topic
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {topics.map((topic, index) => {
                    const totalVotes = topic.agree_count + topic.disagree_count;
                    const agreePercent = totalVotes > 0 ? (topic.agree_count / totalVotes) * 100 : 50;
                    
                    return (
                      <motion.div
                        key={topic.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <Card className="overflow-hidden hover:border-primary/30 transition-colors">
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-4">
                              <CardTitle className="text-lg font-semibold text-foreground">
                                {topic.title}
                              </CardTitle>
                              <Badge variant="outline" className="shrink-0 gap-1 text-xs">
                                <Clock className="w-3 h-3" />
                                {formatDistanceToNow(new Date(topic.expires_at), { addSuffix: true })}
                              </Badge>
                            </div>
                            {topic.description && (
                              <p className="text-sm text-muted-foreground mt-2">
                                {topic.description}
                              </p>
                            )}
                          </CardHeader>
                          
                          <CardContent>
                            {/* Sentiment Bar */}
                            <div className="mb-4">
                              <div className="flex justify-between text-sm mb-2">
                                <span className="text-green-500 font-medium flex items-center gap-1">
                                  <ThumbsUp className="w-3.5 h-3.5" />
                                  Agree ({topic.agree_count})
                                </span>
                                <span className="text-red-500 font-medium flex items-center gap-1">
                                  Disagree ({topic.disagree_count})
                                  <ThumbsDown className="w-3.5 h-3.5" />
                                </span>
                              </div>
                              <div className="relative h-3 rounded-full overflow-hidden bg-red-500/20">
                                <div 
                                  className="absolute left-0 top-0 h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-500"
                                  style={{ width: `${agreePercent}%` }}
                                />
                              </div>
                              <p className="text-xs text-muted-foreground text-center mt-2">
                                {totalVotes} anonymous votes
                              </p>
                            </div>

                            {/* Vote Buttons */}
                            <div className="flex gap-3">
                              <Button 
                                variant="outline" 
                                className="flex-1 gap-2 border-green-500/30 hover:bg-green-500/10 hover:text-green-500 hover:border-green-500"
                                onClick={() => handleVote(topic, 'agree')}
                              >
                                <ThumbsUp className="w-4 h-4" />
                                Agree ({topic.vote_cost.toLocaleString()} XEC)
                              </Button>
                              <Button 
                                variant="outline" 
                                className="flex-1 gap-2 border-red-500/30 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500"
                                onClick={() => handleVote(topic, 'disagree')}
                              >
                                <ThumbsDown className="w-4 h-4" />
                                Disagree ({topic.vote_cost.toLocaleString()} XEC)
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Info Section */}
          <section className="px-4 mt-16">
            <div className="max-w-4xl mx-auto">
              <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
                <CardContent className="py-8">
                  <div className="text-center mb-6">
                    <EyeOff className="w-10 h-10 text-primary mx-auto mb-3" />
                    <h3 className="font-display font-bold text-xl text-foreground mb-2">
                      How Anonymity Works
                    </h3>
                  </div>
                  <div className="grid md:grid-cols-2 gap-6 text-sm">
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-xs font-bold text-primary">1</span>
                        </div>
                        <p className="text-muted-foreground">
                          Your eCash address is <strong className="text-foreground">cryptographically hashed</strong> using SHA-256 before storage.
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-xs font-bold text-primary">2</span>
                        </div>
                        <p className="text-muted-foreground">
                          Only a <strong className="text-foreground">redacted snippet</strong> (e.g., a1b2****c3d4) is shown publicly.
                        </p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-xs font-bold text-primary">3</span>
                        </div>
                        <p className="text-muted-foreground">
                          <strong className="text-foreground">No payouts</strong> means no need to track real addresses for winners.
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-xs font-bold text-primary">4</span>
                        </div>
                        <p className="text-muted-foreground">
                          All funds go to <strong className="text-foreground">eCash Pulse treasury</strong> to sustain the platform.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>
        </main>

        <Footer />
      </div>

      <CreateSentimentModal 
        open={isCreateOpen} 
        onOpenChange={setIsCreateOpen}
        onSuccess={fetchTopics}
      />

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
