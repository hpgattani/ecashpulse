import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Info, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

  // Get escrow address from prediction or use default
  const escrowAddress = prediction.escrowAddress || 'ecash:qz2708636snqhsxu8wnlka78h6fdp77ar59jrf5035';

  useEffect(() => {
    if (isOpen && payButtonRef.current && user) {
      // Clear any existing content
      payButtonRef.current.innerHTML = '';
      
      // Create PayButton element
      const payButton = document.createElement('div');
      payButton.className = 'paybutton';
      payButton.setAttribute('to', escrowAddress);
      payButton.setAttribute('amount', '0');
      payButton.setAttribute('text', `Bet ${position.toUpperCase()}`);
      payButton.setAttribute('hover-text', 'Send eCash');
      payButton.setAttribute('success-text', 'Payment Sent!');
      payButton.setAttribute('theme', JSON.stringify({
        palette: {
          primary: position === 'yes' ? '#10b981' : '#ef4444',
          secondary: '#1a1a2e',
          tertiary: '#ffffff'
        }
      }));
      // Add opReturn to track the bet
      payButton.setAttribute('op-return', `ECASHPULSE:${prediction.id}:${position}:${user.id}`);
      
      payButtonRef.current.appendChild(payButton);

      // Load PayButton script if not already loaded
      if (!document.querySelector('script[src*="paybutton"]')) {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@paybutton/paybutton/dist/paybutton.js';
        script.async = true;
        document.body.appendChild(script);
      } else {
        // If script is already loaded, trigger PayButton render
        // @ts-ignore
        if (window.PayButton) {
          // @ts-ignore
          window.PayButton.render(payButton, {
            to: escrowAddress,
            amount: 0,
            text: `Bet ${position.toUpperCase()}`,
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
    }
  }, [isOpen, position, user, prediction.id, escrowAddress]);

  const handleManualConfirm = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (!txHash.trim()) {
      toast({
        title: 'Transaction Required',
        description: 'Please enter the transaction hash from your payment.',
        variant: 'destructive',
      });
      return;
    }

    if (!betAmount || parseFloat(betAmount) < 1) {
      toast({
        title: 'Amount Required',
        description: 'Please enter the bet amount in XEC.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Convert XEC to satoshis (1 XEC = 100 satoshis)
      const amountSatoshis = Math.round(parseFloat(betAmount) * 100);

      const { data, error } = await supabase.functions.invoke('process-bet', {
        body: {
          user_id: user.id,
          prediction_id: prediction.id,
          position,
          amount: amountSatoshis,
          tx_hash: txHash.trim(),
        },
      });

      if (error) throw error;

      toast({
        title: 'Bet Placed!',
        description: `Your ${position.toUpperCase()} bet of ${betAmount} XEC has been recorded.`,
      });

      onClose();
      setTxHash('');
      setBetAmount('');
    } catch (error: any) {
      console.error('Error placing bet:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to place bet. Please try again.',
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
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-50 p-4"
          >
            <div className="glass-card glow-primary p-6 max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="font-display font-bold text-xl text-foreground mb-1">
                    Place Your Bet
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Betting <span className={position === 'yes' ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
                      {position.toUpperCase()}
                    </span> on this prediction
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Prediction Info */}
              <div className="p-4 rounded-lg bg-muted/50 mb-6">
                <h3 className="font-medium text-foreground mb-2">{prediction.question}</h3>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Current Odds:</span>
                  <span className={position === 'yes' ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
                    {position === 'yes' ? prediction.yesOdds : prediction.noOdds}%
                  </span>
                </div>
              </div>

              {/* PayButton Container */}
              <div className="mb-6">
                <p className="text-sm text-muted-foreground mb-3 text-center">
                  Step 1: Send eCash using PayButton
                </p>
                <div ref={payButtonRef} className="flex justify-center min-h-[60px]" />
              </div>

              {/* Manual TX Confirmation */}
              <div className="space-y-4 mb-6 p-4 rounded-lg bg-muted/30">
                <p className="text-sm font-medium text-foreground">
                  Step 2: Confirm your transaction
                </p>
                
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">
                    Bet Amount (XEC)
                  </label>
                  <Input
                    type="number"
                    placeholder="Enter amount in XEC"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    min="1"
                    step="1"
                  />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">
                    Transaction Hash
                  </label>
                  <Input
                    type="text"
                    placeholder="Paste your TX hash here"
                    value={txHash}
                    onChange={(e) => setTxHash(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>

                <Button
                  className="w-full"
                  onClick={handleManualConfirm}
                  disabled={isSubmitting || !txHash.trim() || !betAmount}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Confirming...
                    </>
                  ) : (
                    'Confirm Bet'
                  )}
                </Button>
              </div>

              {/* Info */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/10 text-sm">
                <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div className="text-muted-foreground">
                  <p className="mb-1">1% platform fee applies to all bets.</p>
                  <p>Winnings are distributed proportionally when the market resolves.</p>
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
