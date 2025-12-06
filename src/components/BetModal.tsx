import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Info, AlertCircle, Calculator, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  const { user, sessionToken } = useAuth();
  const navigate = useNavigate();
  const [betAmount, setBetAmount] = useState('100');
  const [betSuccess, setBetSuccess] = useState(false);

  // Calculate potential payout
  const currentOdds = position === 'yes' ? prediction.yesOdds : prediction.noOdds;
  const winMultiplier = currentOdds > 0 ? (100 / currentOdds) : 1;
  const potentialPayout = betAmount ? (parseFloat(betAmount) * winMultiplier).toFixed(2) : '0';
  const potentialProfit = betAmount ? ((parseFloat(betAmount) * winMultiplier) - parseFloat(betAmount)).toFixed(2) : '0';

  // Record bet in background - no blocking UI
  const recordBet = useCallback(async (txHash?: string) => {
    if (!user || !sessionToken) return;
    
    const betAmountNum = Math.round(parseFloat(betAmount));
    console.log('[BetModal] Recording bet, amount:', betAmountNum, 'txHash:', txHash);
    
    // Show success immediately - payment already confirmed by PayButton
    setBetSuccess(true);
    toast.success('Bet placed!', {
      description: `${position.toUpperCase()} bet of ${betAmount} XEC confirmed.`
    });
    
    // Close modal after brief success display
    setTimeout(() => {
      setBetSuccess(false);
      onClose();
    }, 1500);
    
    // Record bet in background (don't await, don't block)
    supabase.functions.invoke('process-bet', {
      body: {
        session_token: sessionToken,
        prediction_id: prediction.id,
        position,
        amount: betAmountNum,
        tx_hash: txHash || `pb_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
      }
    }).then(({ data, error }) => {
      console.log('[BetModal] Bet recorded:', data, error);
      if (error || data?.error) {
        console.error('[BetModal] Background bet recording failed:', error || data?.error);
      }
    });
  }, [user, sessionToken, betAmount, prediction.id, position, onClose]);

  // Load PayButton script
  useEffect(() => {
    if (!document.querySelector('script[src*="paybutton"]')) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@paybutton/paybutton/dist/paybutton.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // Render PayButton when modal opens and amount changes
  useEffect(() => {
    if (!isOpen || !payButtonRef.current || !user || !sessionToken || betSuccess) {
      if (payButtonRef.current) {
        payButtonRef.current.innerHTML = '';
      }
      return;
    }

    const amount = parseFloat(betAmount) || 0;
    if (amount <= 0) {
      payButtonRef.current.innerHTML = '';
      return;
    }

    payButtonRef.current.innerHTML = '';

    const renderButton = () => {
      if (!payButtonRef.current) return;
      
      payButtonRef.current.innerHTML = '';
      
      const buttonContainer = document.createElement('div');
      buttonContainer.id = `paybutton-${prediction.id}-${Date.now()}`;
      payButtonRef.current.appendChild(buttonContainer);

      if ((window as any).PayButton) {
        (window as any).PayButton.render(buttonContainer, {
          to: ESCROW_ADDRESS,
          amount: amount,
          currency: 'XEC',
          text: 'Place Bet',
          hoverText: 'Confirm',
          successText: 'Payment Sent!',
          theme: {
            palette: {
              primary: position === 'yes' ? '#10b981' : '#ef4444',
              secondary: '#1e293b',
              tertiary: '#ffffff'
            }
          },
          onSuccess: (txResult: any) => {
            console.log('[BetModal] PayButton success:', txResult);
            
            // Extract tx hash if available
            let txHash: string | undefined;
            if (typeof txResult === 'string') {
              txHash = txResult;
            } else if (txResult?.hash) {
              txHash = txResult.hash;
            } else if (txResult?.txid) {
              txHash = txResult.txid;
            } else if (txResult?.txId) {
              txHash = txResult.txId;
            }
            
            // Record the bet immediately
            recordBet(txHash);
          },
          onError: (error: any) => {
            console.error('PayButton error:', error);
            toast.error('Payment failed', {
              description: 'Please try again.'
            });
          }
        });
      }
    };

    const timeoutId = setTimeout(renderButton, 100);
    
    return () => {
      clearTimeout(timeoutId);
      if (payButtonRef.current) {
        payButtonRef.current.innerHTML = '';
      }
    };
  }, [isOpen, betAmount, user, sessionToken, prediction.id, position, betSuccess, recordBet]);

  if (!user || !sessionToken) {
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
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="glass-card glow-primary p-6 text-center w-full max-w-md">
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
            className="fixed inset-x-4 top-4 bottom-4 mx-auto max-w-md z-50 flex items-center"
          >
            <div className="glass-card glow-primary p-4 sm:p-6 w-full max-h-full overflow-y-auto">
              {/* Success State */}
              {betSuccess ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                  <h2 className="font-display font-bold text-xl text-foreground mb-2">
                    Bet Placed!
                  </h2>
                  <p className="text-muted-foreground">
                    Your {position.toUpperCase()} bet has been confirmed.
                  </p>
                </div>
              ) : (
                <>
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

                  {/* Bet Amount */}
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
                        className="text-lg font-semibold h-12"
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
                          <span className="text-emerald-400 font-bold">+{potentialProfit} XEC</span>
                        </div>
                      </div>
                    )}

                    {/* PayButton Container */}
                    <div ref={payButtonRef} className="min-h-[50px]" />

                    {/* Info */}
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30">
                      <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-muted-foreground">
                        1% platform fee applies. Payments are processed on-chain.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default BetModal;
