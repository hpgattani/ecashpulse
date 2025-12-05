import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Info, AlertCircle, Loader2, Copy, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Official escrow address
const ESCROW_ADDRESS = 'ecash:qr6pwzt7glvmq6ryr4305kat0vnv2wy69qjxpdwz5a';

interface Prediction {
  id: string;
  question: string;
  yesOdds: number;
  noOdds: number;
  escrowAddress?: string;
}

interface BetModalProps {
  isOpen: boolean;
  onClose: () => void;
  prediction: Prediction;
  position: 'yes' | 'no';
}

const BetModal = ({ isOpen, onClose, prediction, position }: BetModalProps) => {
  const payButtonRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [txHash, setTxHash] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [betAmount, setBetAmount] = useState('');
  const [pendingBetId, setPendingBetId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    await navigator.clipboard.writeText(ESCROW_ADDRESS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Poll for automatic payment detection
  const pollForPayment = useCallback(async (betId: string) => {
    if (!betId) return;
    
    try {
      const { data: bet } = await supabase
        .from('bets')
        .select('status, tx_hash')
        .eq('id', betId)
        .single();

      if (bet?.status === 'confirmed') {
        setIsPolling(false);
        toast({
          title: 'Payment Confirmed!',
          description: 'Your bet has been automatically confirmed.',
        });
        onClose();
        setPendingBetId(null);
        setTxHash('');
        setBetAmount('');
      }
    } catch (error) {
      console.error('Poll error:', error);
    }
  }, [toast, onClose]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isPolling && pendingBetId) {
      interval = setInterval(() => pollForPayment(pendingBetId), 5000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPolling, pendingBetId, pollForPayment]);

  useEffect(() => {
    if (isOpen && payButtonRef.current && user && betAmount) {
      payButtonRef.current.innerHTML = '';
      
      const payButton = document.createElement('div');
      payButton.className = 'paybutton';
      payButton.setAttribute('to', ESCROW_ADDRESS);
      payButton.setAttribute('amount', betAmount);
      payButton.setAttribute('text', `Pay ${betAmount} XEC`);
      payButton.setAttribute('hover-text', 'Send eCash');
      payButton.setAttribute('success-text', 'Payment Sent!');
      payButton.setAttribute('theme', JSON.stringify({
        palette: {
          primary: position === 'yes' ? '#10b981' : '#ef4444',
          secondary: '#1a1a2e',
          tertiary: '#ffffff'
        }
      }));
      payButton.setAttribute('op-return', `ECASHPULSE:${prediction.id}:${position}:${user.id}`);
      
      payButtonRef.current.appendChild(payButton);

      if (!document.querySelector('script[src*="paybutton"]')) {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@paybutton/paybutton/dist/paybutton.js';
        script.async = true;
        document.body.appendChild(script);
      } else if ((window as any).PayButton) {
        (window as any).PayButton.render(payButton, {
          to: ESCROW_ADDRESS,
          amount: parseFloat(betAmount) || 0,
          text: `Pay ${betAmount} XEC`,
          hoverText: 'Send eCash',
          successText: 'Payment Sent!',
          opReturn: `ECASHPULSE:${prediction.id}:${position}:${user.id}`,
          theme: {
            palette: {
              primary: position === 'yes' ? '#10b981' : '#ef4444',
              secondary: '#1a1a2e',
              tertiary: '#ffffff'
            }
          },
          onSuccess: (txid: string) => {
            setTxHash(txid);
          }
        });
      }
    }
  }, [isOpen, position, user, prediction.id, betAmount]);

  const createPendingBet = async () => {
    if (!user || !betAmount || parseFloat(betAmount) < 1) {
      toast({
        title: 'Amount Required',
        description: 'Please enter the bet amount (minimum 1 XEC).',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const amountSatoshis = Math.round(parseFloat(betAmount) * 100);

      const { data, error } = await supabase.functions.invoke('process-bet', {
        body: {
          user_id: user.id,
          prediction_id: prediction.id,
          position,
          amount: amountSatoshis,
        },
      });

      if (error) throw error;

      setPendingBetId(data.bet_id);
      setIsPolling(true);
      
      toast({
        title: 'Bet Created',
        description: `Send ${betAmount} XEC to the escrow address to confirm.`,
      });
    } catch (error: any) {
      console.error('Error creating bet:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create bet.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmWithTxHash = async () => {
    if (!pendingBetId || !txHash.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please create a bet first and provide the transaction hash.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('confirm-transaction', {
        body: {
          bet_id: pendingBetId,
          tx_hash: txHash.trim(),
        },
      });

      if (error) throw error;

      toast({
        title: 'Bet Confirmed!',
        description: `Your ${position.toUpperCase()} bet has been confirmed.`,
      });

      onClose();
      setPendingBetId(null);
      setTxHash('');
      setBetAmount('');
      setIsPolling(false);
    } catch (error: any) {
      console.error('Error confirming bet:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to confirm bet.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-50 p-4"
            >
              <div className="glass-card glow-primary p-6 text-center">
                <AlertCircle className="w-12 h-12 text-primary mx-auto mb-4" />
                <h2 className="font-display font-bold text-xl text-foreground mb-2">
                  Connect Your Wallet
                </h2>
                <p className="text-muted-foreground mb-6">
                  Please login with your eCash address to place bets.
                </p>
                <div className="flex gap-3 justify-center">
                  <Button variant="outline" onClick={onClose}>Cancel</Button>
                  <Button onClick={() => navigate('/auth')}>Connect</Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-50 p-3 sm:p-4"
          >
            <div className="glass-card glow-primary p-4 sm:p-6 max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between mb-4 sm:mb-6">
                <div>
                  <h2 className="font-display font-bold text-lg sm:text-xl text-foreground mb-1">
                    Place Your Bet
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Betting <span className={position === 'yes' ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
                      {position.toUpperCase()}
                    </span>
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 sm:h-10 sm:w-10">
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </Button>
              </div>

              <div className="p-4 rounded-lg bg-muted/50 mb-6">
                <h3 className="font-medium text-foreground mb-2 text-sm">{prediction.question}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Your Position:</span>
                    <span className={position === 'yes' ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
                      {position.toUpperCase()} ({position === 'yes' ? prediction.yesOdds : prediction.noOdds}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Win Multiplier:</span>
                    <span className="text-primary font-semibold">
                      {(100 / (position === 'yes' ? prediction.yesOdds : prediction.noOdds)).toFixed(2)}x
                    </span>
                  </div>
                  {betAmount && parseFloat(betAmount) > 0 && (
                    <div className="flex items-center justify-between border-t border-border/50 pt-2 mt-2">
                      <span className="text-muted-foreground">Potential Payout:</span>
                      <span className="text-emerald-400 font-bold text-lg">
                        {((parseFloat(betAmount) * 100) / (position === 'yes' ? prediction.yesOdds : prediction.noOdds)).toFixed(2)} XEC
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Escrow Address */}
              <div className="p-2 sm:p-3 rounded-lg bg-primary/10 mb-4">
                <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">Send XEC to:</p>
                <div className="flex items-center gap-1 sm:gap-2">
                  <code className="text-[9px] sm:text-xs text-primary font-mono flex-1 break-all leading-relaxed">
                    {ESCROW_ADDRESS}
                  </code>
                  <Button variant="ghost" size="icon" onClick={copyAddress} className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0">
                    {copied ? <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-400" /> : <Copy className="w-3 h-3 sm:w-4 sm:h-4" />}
                  </Button>
                </div>
              </div>

              {!pendingBetId ? (
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">
                      Bet Amount (XEC)
                    </label>
                    <Input
                      type="number"
                      placeholder="Enter amount (min 1 XEC)"
                      value={betAmount}
                      onChange={(e) => setBetAmount(e.target.value)}
                      min="1"
                      step="1"
                    />
                  </div>

                  <Button
                    className="w-full"
                    onClick={createPendingBet}
                    disabled={isSubmitting || !betAmount || parseFloat(betAmount) < 1}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating Bet...
                      </>
                    ) : (
                      'Create Bet'
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 mb-6">
                  {isPolling && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 text-emerald-400 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Waiting for payment... (auto-detecting)</span>
                    </div>
                  )}

                  <div ref={payButtonRef} className="flex justify-center min-h-[60px]" />

                  <div className="text-center text-sm text-muted-foreground">or</div>

                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">
                      Manual TX Hash Confirmation
                    </label>
                    <Input
                      type="text"
                      placeholder="Paste your TX hash"
                      value={txHash}
                      onChange={(e) => setTxHash(e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>

                  <Button
                    className="w-full"
                    onClick={confirmWithTxHash}
                    disabled={isSubmitting || !txHash.trim()}
                    variant="secondary"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Confirming...
                      </>
                    ) : (
                      'Confirm with TX Hash'
                    )}
                  </Button>
                </div>
              )}

              <div className="flex items-start gap-2 p-2 sm:p-3 rounded-lg bg-primary/10 text-xs sm:text-sm">
                <Info className="w-3 h-3 sm:w-4 sm:h-4 text-primary mt-0.5 flex-shrink-0" />
                <div className="text-muted-foreground text-[11px] sm:text-sm">
                  <p className="mb-1">1% platform fee applies to all bets.</p>
                  <p>Your bet will be auto-confirmed when payment is detected.</p>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default BetModal;
