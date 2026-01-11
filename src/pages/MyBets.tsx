import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, Clock, CheckCircle2, XCircle, Loader2, FileText, Plus, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PredictionDetailModal from '@/components/PredictionDetailModal';
import BetModal from '@/components/BetModal';
import CountdownTimer from '@/components/CountdownTimer';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Outcome } from '@/hooks/usePredictions';

interface BetWithPrediction {
  id: string;
  position: 'yes' | 'no';
  amount: number;
  status: 'pending' | 'confirmed' | 'won' | 'lost' | 'refunded';
  tx_hash: string | null;
  payout_tx_hash: string | null;
  created_at: string;
  confirmed_at: string | null;
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
  };
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
  const [hedgePosition, setHedgePosition] = useState<'yes' | 'no'>('yes');
  const [hedgePrediction, setHedgePrediction] = useState<FullPrediction | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && sessionToken) {
      fetchBets();
      fetchSubmissions();
      // Subscribe to realtime updates
      const channel = supabase
        .channel('my-bets')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'bets',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchBets();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, sessionToken]);

  const fetchSubmissions = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('predictions')
        .select('id, title, description, category, status, end_date, yes_pool, no_pool, created_at')
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching submissions:', error);
        return;
      }

      setSubmissions(data || []);
    } catch (err) {
      console.error('Error fetching submissions:', err);
    }
    setSubmissionsLoading(false);
  };

  const fetchBets = async () => {
    if (!user || !sessionToken) return;

    try {
      // Use edge function with session token for authentication
      const { data, error } = await supabase.functions.invoke('get-user-bets', {
        body: { session_token: sessionToken }
      });

      if (error) {
        console.error('Error fetching bets:', error);
        return;
      }

      if (data?.bets) {
        setBets(data.bets as unknown as BetWithPrediction[]);
      }
    } catch (err) {
      console.error('Error fetching bets:', err);
    }
    setLoading(false);
  };

  const handleBetClick = async (bet: BetWithPrediction) => {
    // Fetch full prediction with outcomes
    const { data: prediction, error } = await supabase
      .from('predictions')
      .select('*')
      .eq('id', bet.prediction_id)
      .single();

    if (error || !prediction) return;

    const { data: outcomes } = await supabase
      .from('outcomes')
      .select('*')
      .eq('prediction_id', bet.prediction_id);

    const totalPool = prediction.yes_pool + prediction.no_pool;
    const yesOdds = totalPool > 0 ? Math.round((prediction.yes_pool / totalPool) * 100) : 50;
    const noOdds = totalPool > 0 ? Math.round((prediction.no_pool / totalPool) * 100) : 50;

    let mappedOutcomes: Outcome[] | undefined;

    const normalizedLabels = (outcomes || []).map((o) => o.label.toLowerCase().trim());
    const isStandardYesNo = (outcomes?.length ?? 0) === 2 && normalizedLabels.includes('yes') && normalizedLabels.includes('no');
    const isStandardUpDown = (outcomes?.length ?? 0) === 2 && normalizedLabels.includes('up') && normalizedLabels.includes('down');
    const isBinary = isStandardYesNo || isStandardUpDown;
    const isMultiOption = Boolean(outcomes && outcomes.length > 0 && (outcomes.length > 2 || !isBinary));

    if (isMultiOption) {
      const outcomeTotalPool = outcomes.reduce((sum, o) => sum + o.pool, 0);
      mappedOutcomes = outcomes.map(o => ({
        id: o.id,
        label: o.label,
        pool: o.pool,
        odds: outcomeTotalPool > 0 ? Math.round((o.pool / outcomeTotalPool) * 100) : Math.round(100 / outcomes.length)
      }));
    }

    const fullPrediction: FullPrediction = {
      id: prediction.id,
      question: prediction.title,
      description: prediction.description || '',
      category: prediction.category,
      yesOdds,
      noOdds,
      volume: totalPool,
      endDate: prediction.end_date,
      escrowAddress: prediction.escrow_address,
      isMultiOption,
      outcomes: mappedOutcomes,
      yesPool: prediction.yes_pool,
      noPool: prediction.no_pool,
    };

    setSelectedPrediction(fullPrediction);
    setIsModalOpen(true);
  };

  const handleHedgeBet = async (bet: BetWithPrediction, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Fetch full prediction
    const { data: prediction, error } = await supabase
      .from('predictions')
      .select('*')
      .eq('id', bet.prediction_id)
      .single();

    if (error || !prediction) return;

    // Check if betting is still open
    if (new Date(prediction.end_date) < new Date()) {
      return;
    }

    const totalPool = prediction.yes_pool + prediction.no_pool;
    const yesOdds = totalPool > 0 ? Math.round((prediction.yes_pool / totalPool) * 100) : 50;
    const noOdds = totalPool > 0 ? Math.round((prediction.no_pool / totalPool) * 100) : 50;

    const fullPrediction: FullPrediction = {
      id: prediction.id,
      question: prediction.title,
      description: prediction.description || '',
      category: prediction.category,
      yesOdds,
      noOdds,
      volume: totalPool,
      endDate: prediction.end_date,
      escrowAddress: prediction.escrow_address,
      yesPool: prediction.yes_pool,
      noPool: prediction.no_pool,
    };

    // Set opposite position for hedge
    const oppositePosition = bet.position === 'yes' ? 'no' : 'yes';
    setHedgePosition(oppositePosition);
    setHedgePrediction(fullPrediction);
    setHedgeBetOpen(true);
  };

  const formatXEC = (satoshis: number) => {
    const xec = satoshis / 100;
    return xec.toLocaleString() + ' XEC';
  };

  const formatDate = (dateStr: string) => {
    // Display in user's local timezone with locale-appropriate formatting
    const localeMap: Record<string, string> = {
      'en': 'en-US',
      'pt-BR': 'pt-BR',
      'ko': 'ko-KR',
      'ja': 'ja-JP'
    };
    return new Date(dateStr).toLocaleDateString(localeMap[language] || undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-500 border-yellow-500/50"><Clock className="w-3 h-3 mr-1" />{t.pending}</Badge>;
      case 'confirmed':
        return <Badge variant="outline" className="text-blue-500 border-blue-500/50"><CheckCircle2 className="w-3 h-3 mr-1" />{t.confirmed}</Badge>;
      case 'won':
        return <Badge variant="outline" className="text-emerald-500 border-emerald-500/50"><TrendingUp className="w-3 h-3 mr-1" />{t.won}</Badge>;
      case 'lost':
        return <Badge variant="outline" className="text-red-500 border-red-500/50"><TrendingDown className="w-3 h-3 mr-1" />{t.lost}</Badge>;
      case 'refunded':
        return <Badge variant="outline" className="text-muted-foreground"><XCircle className="w-3 h-3 mr-1" />{t.refunded}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSubmissionStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="outline" className="text-emerald-500 border-emerald-500/50"><CheckCircle2 className="w-3 h-3 mr-1" />{t.active}</Badge>;
      case 'resolved':
        return <Badge variant="outline" className="text-blue-500 border-blue-500/50"><CheckCircle2 className="w-3 h-3 mr-1" />{t.resolved}</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="text-red-500 border-red-500/50"><XCircle className="w-3 h-3 mr-1" />{t.cancelled}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{t.myBetsTitle} - eCash Pulse</title>
        <meta name="description" content={t.trackYourBets} />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8 pt-24">
          <div className="mb-8">
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t.backToMarkets}
            </Button>
            <h1 className="font-display text-3xl font-bold text-foreground">
              {t.myBetsTitle}
            </h1>
            <p className="text-muted-foreground mt-2">
              {t.trackYourBets}
            </p>
          </div>

          <Tabs defaultValue="bets" className="w-full">
            <div className="glass-card inline-flex p-1.5 mb-6 rounded-xl flex-wrap">
              <TabsList className="bg-transparent h-auto p-0 gap-1 flex-wrap">
                <TabsTrigger 
                  value="bets" 
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
                >
                  <TrendingUp className="w-4 h-4" />
                  {t.myBetsTitle}
                  {bets.length > 0 && (
                    <span className="ml-1 text-xs bg-muted/50 px-1.5 py-0.5 rounded-full">{bets.length}</span>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="pending" 
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg data-[state=active]:bg-yellow-500 data-[state=active]:text-yellow-950 transition-all"
                >
                  <Clock className="w-4 h-4" />
                  {t.pending}
                  {bets.filter(b => b.status === 'pending').length > 0 && (
                    <span className="ml-1 text-xs bg-yellow-400/30 px-1.5 py-0.5 rounded-full">
                      {bets.filter(b => b.status === 'pending').length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="submissions" 
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
                >
                  <FileText className="w-4 h-4" />
                  {t.mySubmissions}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="bets">
              {bets.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card p-12 text-center"
                >
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <TrendingUp className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h2 className="font-display text-xl font-semibold text-foreground mb-2">
                    {t.noBetsYet}
                  </h2>
                  <p className="text-muted-foreground mb-6">
                    {t.noBetsDesc}
                  </p>
                  <Button onClick={() => navigate('/')}>
                    {t.exploreMarkets}
                  </Button>
                </motion.div>
              ) : (
                <div className="space-y-4">
                  {bets.map((bet, index) => (
                    <motion.div
                      key={bet.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => handleBetClick(bet)}
                      className="glass-card p-4 md:p-6 cursor-pointer hover:border-primary/50 transition-colors"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="font-display font-semibold text-foreground mb-2 hover:text-primary transition-colors">
                            {translateTitle(bet.prediction?.title || 'Unknown Prediction')}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <Badge
                              variant={bet.position === 'yes' ? 'default' : 'destructive'}
                              className={bet.position === 'yes' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}
                            >
                              {bet.position === 'yes' ? t.yes.toUpperCase() : t.no.toUpperCase()}
                            </Badge>
                            {getStatusBadge(bet.status)}
                            <CountdownTimer endDate={bet.prediction.end_date} />
                            <span className="text-muted-foreground">
                              {formatDate(bet.created_at)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {/* Hedge Button - only show for active predictions with confirmed bets */}
                          {bet.status === 'confirmed' && 
                           bet.prediction.status === 'active' && 
                           new Date(bet.prediction.end_date) > new Date() && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5 border-amber-500/50 text-amber-500 hover:bg-amber-500/10 hover:text-amber-400"
                                    onClick={(e) => handleHedgeBet(bet, e)}
                                  >
                                    <Shield className="w-3.5 h-3.5" />
                                    {t.hedge || "Hedge"}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[200px] text-center">
                                  <p className="text-xs">{t.hedgeTooltip}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          <div className="text-right">
                            <p className="font-display font-bold text-lg text-foreground">
                              {formatXEC(bet.amount)}
                            </p>
                            {bet.payout_amount && (
                              <p className="text-sm text-emerald-400">
                                {t.won}: {formatXEC(bet.payout_amount)}
                              </p>
                            )}
                            <div className="flex gap-2 text-xs">
                              {bet.tx_hash && (
                                <a
                                  href={`https://explorer.e.cash/tx/${bet.tx_hash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-muted-foreground hover:text-primary hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {t.betTx}
                                </a>
                              )}
                              {bet.payout_tx_hash && (
                                <a
                                  href={`https://explorer.e.cash/tx/${bet.payout_tx_hash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-400 hover:underline font-medium"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {t.payoutTx}
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="pending">
              {bets.filter(b => b.status === 'pending').length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card p-12 text-center"
                >
                  <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-8 h-8 text-yellow-500" />
                  </div>
                  <h2 className="font-display text-xl font-semibold text-foreground mb-2">
                    {t.noPendingBets || "No Pending Bets"}
                  </h2>
                  <p className="text-muted-foreground mb-6">
                    {t.noPendingBetsDesc || "All your bets have been confirmed on the blockchain."}
                  </p>
                  <Button onClick={() => navigate('/')}>
                    {t.exploreMarkets}
                  </Button>
                </motion.div>
              ) : (
                <div className="space-y-4">
                  <div className="glass-card p-4 border-yellow-500/30 bg-yellow-500/5">
                    <div className="flex items-center gap-2 text-yellow-500">
                      <Clock className="w-5 h-5" />
                      <p className="text-sm font-medium">
                        {t.pendingBetsInfo || "These bets are waiting for blockchain confirmation. This usually takes 1-2 minutes."}
                      </p>
                    </div>
                  </div>
                  {bets.filter(b => b.status === 'pending').map((bet, index) => (
                    <motion.div
                      key={bet.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => handleBetClick(bet)}
                      className="glass-card p-4 md:p-6 cursor-pointer hover:border-yellow-500/50 transition-colors border-yellow-500/20"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="font-display font-semibold text-foreground mb-2 hover:text-primary transition-colors">
                            {translateTitle(bet.prediction?.title || 'Unknown Prediction')}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <Badge
                              variant={bet.position === 'yes' ? 'default' : 'destructive'}
                              className={bet.position === 'yes' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}
                            >
                              {bet.position === 'yes' ? t.yes.toUpperCase() : t.no.toUpperCase()}
                            </Badge>
                            {getStatusBadge(bet.status)}
                            <span className="text-muted-foreground">
                              {formatDate(bet.created_at)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-display font-bold text-lg text-foreground">
                            {formatXEC(bet.amount)}
                          </p>
                          {bet.tx_hash && (
                            <a
                              href={`https://explorer.e.cash/tx/${bet.tx_hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-muted-foreground hover:text-primary hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {t.viewTransaction || "View Transaction"}
                            </a>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="submissions">
              {submissionsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : submissions.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card p-12 text-center"
                >
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h2 className="font-display text-xl font-semibold text-foreground mb-2">
                    {t.noSubmissionsYet}
                  </h2>
                  <p className="text-muted-foreground mb-6">
                    {t.noSubmissionsDesc}
                  </p>
                  <Button onClick={() => navigate('/create-prediction')}>
                    <Plus className="w-4 h-4 mr-2" />
                    {t.createPrediction}
                  </Button>
                </motion.div>
              ) : (
                <div className="space-y-4">
                  {submissions.map((submission, index) => (
                    <motion.div
                      key={submission.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => navigate(`/prediction/${submission.id}`)}
                      className="glass-card p-4 md:p-6 cursor-pointer hover:border-primary/50 transition-colors"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="font-display font-semibold text-foreground mb-2 hover:text-primary transition-colors">
                            {translateTitle(submission.title)}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <Badge variant="secondary" className="capitalize">
                              {submission.category}
                            </Badge>
                            {getSubmissionStatusBadge(submission.status)}
                            <CountdownTimer endDate={submission.end_date} />
                            <span className="text-muted-foreground">
                              {formatDate(submission.created_at)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-display font-bold text-lg text-foreground">
                            {formatXEC(submission.yes_pool + submission.no_pool)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t.volume}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </main>
        <Footer />
      </div>

      <PredictionDetailModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedPrediction(null);
        }}
        prediction={selectedPrediction}
        onSelectOutcome={() => {}}
      />

      {hedgePrediction && (
        <BetModal
          isOpen={hedgeBetOpen}
          onClose={() => {
            setHedgeBetOpen(false);
            setHedgePrediction(null);
          }}
          prediction={{
            id: hedgePrediction.id,
            question: hedgePrediction.question,
            yesOdds: hedgePrediction.yesOdds,
            noOdds: hedgePrediction.noOdds,
            volume: hedgePrediction.volume / 100,
            endDate: hedgePrediction.endDate,
            escrowAddress: hedgePrediction.escrowAddress || '',
            yesPool: hedgePrediction.yesPool,
            noPool: hedgePrediction.noPool,
          }}
          position={hedgePosition}
          selectedOutcome={null}
        />
      )}
    </>
  );
};

export default MyBets;