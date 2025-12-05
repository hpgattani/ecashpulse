import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Info, AlertCircle, Loader2, Calculator } from 'lucide-react';
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
  const [betAmount, setBetAmount] = useState('100');
  const [pendingBetId, setPendingBetId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isCreatingBet, setIsCreatingBet] = useState(false);

  // Calculate potential payout
  const currentOdds = position === 'yes' ? prediction.yesOdds : prediction.noOdds;
  const winMultiplier = currentOdds > 0 ? (100 / currentOdds) : 1;
  const potentialPayout = betAmount ? (parseFloat(betAmount) * winMultiplier).toFixed(2) : '0';
  const potentialProfit = betAmount ? ((parseFloat(betAmount) * winMultiplier) - parseFloat(betAmount)).toFixed(2) : '0';

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
          title: 'Bet Confirmed!',
          description: `Your ${position.toUpperCase()} bet has been confirmed.`,
        });
        onClose();
        resetModal();
      }
    } catch (error) {
      console.error('Poll error:', error);
    }
  }, [toast, onClose, position]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isPolling && pendingBetId) {
      interval = setInterval(() => pollForPayment(pendingBetId), 5000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPolling, pendingBetId, pollForPayment]);

  const resetModal = () => {
    setPendingBetId(null);
    setBetAmount('100');
    setIsPolling(false);
    setIsCreatingBet(false);
  };

  // Load PayButton script on mount
  useEffect(() => {
    if (!document.querySelector('script[src*="paybutton"]')) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@paybutton/paybutton/dist/paybutton.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // Create pending bet and render PayButton
  const createBetAndShowPayButton = async () => {
    if (!user || !betAmount || parseFloat(betAmount) < 1) {
      toast({
        title: 'Amount Required',
        description: 'Please enter a bet amount (minimum 1 XEC).',
        variant: 'destructive',
      });
      return;
    }

    setIsCreatingBet(true);

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

      // Render PayButton after bet is created
      setTimeout(() => renderPayButton(data.bet_id), 100);
      
    } catch (error: any) {
      console.error('Error creating bet:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create bet.',
        variant: 'destructive',
      });
      setIsCreatingBet(false);
    }
  };

  const renderPayButton = (betId: string) => {
    if (!payButtonRef.current || !user) return;

    // Clear previous button
    payButtonRef.current.innerHTML = '';
    
    const amount = parseFloat(betAmount) || 0;
    if (amount <= 0) return;

    // Create PayButton element with attributes
    const payButton = document.createElement('div');
    payButton.className = 'paybutton';
    payButton.setAttribute('to', ESCROW_ADDRESS);
    payButton.setAttribute('amount', amount.toString());
    payButton.setAttribute('text', 'Bet');
    payButton.setAttribute('hover-text', 'Predict');
    payButton.setAttribute('success-text', 'You bet!');
    payButton.setAttribute('op-return', `ECASHPULSE:${prediction.id}:${position}:${user.id}`);
    
    payButtonRef.current.appendChild(payButton);

    // Use PayButton API if available
    if ((window as any).PayButton) {
      try {
        (window as any).PayButton.render(payButton, {
          to: ESCROW_ADDRESS,
          amount: amount,
          currency: 'XEC',
          text: 'Bet',
          hoverText: 'Predict',
          successText: 'You bet!',
          opReturn: `ECASHPULSE:${prediction.id}:${position}:${user.id}`,
          theme: {
            palette: {
              primary: position === 'yes' ? '#10b981' : '#ef4444',
              secondary: '#1a1a2e',
              tertiary: '#ffffff'
            }
          },
          onSuccess: async (txid: string) => {
            console.log('PayButton success:', txid);
            // Auto-confirm the bet
            try {
              await supabase.functions.invoke('confirm-transaction', {
                body: { bet_id: betId, tx_hash: txid },
              });
              toast({
                title: 'Bet Confirmed!',
                description: `Your ${position.toUpperCase()} bet of ${betAmount} XEC is confirmed!`,
              });
              onClose();
              resetModal();
            } catch (err) {
              console.error('Auto-confirm error:', err);
            }
          }
        });
      } catch (error) {
        console.error('PayButton render error:', error);
      }
    }
    
    setIsCreatingBet(false);
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
              <div className="flex items-start justify-between mb-4">
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
                <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Prediction Info */}
              <div className="p-3 rounded-lg bg-muted/50 mb-4">
                <h3 className="font-medium text-foreground mb-2 text-sm">{prediction.question}</h3>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Your Position:</span>
                  <span className={position === 'yes' ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
                    {position.toUpperCase()} ({currentOdds}%)
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Win Multiplier:</span>
                  <span className="text-primary font-semibold">{winMultiplier.toFixed(2)}x</span>
                </div>
              </div>

              {!pendingBetId ? (
                /* Step 1: Enter Amount */
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">
                      Bet Amount (XEC)
                    </label>
                    <Input
                      type="number"
                      placeholder="Enter amount"
                      value={betAmount}
                      onChange={(e) => setBetAmount(e.target.value)}
                      min="1"
                      step="1"
                      className="text-lg font-semibold"
                    />
                  </div>

                  {/* Payout Preview */}
                  {betAmount && parseFloat(betAmount) > 0 && (
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Calculator className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm font-medium text-emerald-400">If you win:</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Payout:</span>
                        <span className="text-emerald-400 font-bold">{potentialPayout} XEC</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Profit:</span>
                        <span className="text-emerald-400">+{potentialProfit} XEC</span>
                      </div>
                    </div>
                  )}

                  <Button
                    className="w-full"
                    onClick={createBetAndShowPayButton}
                    disabled={isCreatingBet || !betAmount || parseFloat(betAmount) < 1}
                  >
                    {isCreatingBet ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Preparing...
                      </>
                    ) : (
                      `Continue to Pay ${betAmount || '0'} XEC`
                    )}
                  </Button>
                </div>
              ) : (
                /* Step 2: PayButton */
                <div className="space-y-4">
                  {isPolling && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 text-primary text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Waiting for payment...</span>
                    </div>
                  )}

                  {/* PayButton Container */}
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-sm text-muted-foreground">
                      Pay <span className="text-foreground font-semibold">{betAmount} XEC</span> to confirm your bet:
                    </p>
                    <div 
                      ref={payButtonRef} 
                      className="w-full flex justify-center min-h-[50px] [&_.paybutton]:min-w-[200px]"
                    />
                  </div>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      resetModal();
                    }}
                  >
                    Cancel & Go Back
                  </Button>
                </div>
              )}

              {/* Info */}
              <div className="flex items-start gap-2 p-2 rounded-lg bg-primary/10 text-xs mt-4">
                <Info className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" />
                <div className="text-muted-foreground">
                  1% platform fee applies. Payment auto-confirms on blockchain.
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