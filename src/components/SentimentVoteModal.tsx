import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ThumbsUp, ThumbsDown, Loader2, EyeOff, Shield, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useCryptoPrices } from '@/hooks/useCryptoPrices';

interface SentimentVoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topic: {
    id: string;
    title: string;
    vote_cost: number;
  } | null;
  position: 'agree' | 'disagree' | null;
  onSuccess: () => void;
}

// Same escrow address used for betting
const ESCROW_ADDRESS = "ecash:qz6jsgshsv0v2tyuleptwr4at8xaxsakmstkhzc0pp";

export function SentimentVoteModal({ open, onOpenChange, topic, position, onSuccess }: SentimentVoteModalProps) {
  const { user, sessionToken } = useAuth();
  const { prices } = useCryptoPrices();
  const payButtonRef = useRef<HTMLDivElement>(null);
  
  const [step, setStep] = useState<'info' | 'payment' | 'confirming' | 'success'>('info');
  const [submitting, setSubmitting] = useState(false);

  // Close any PayButton modals/overlays
  const closePayButtonModal = useCallback(() => {
    const selectors = [
      '.paybutton-modal',
      '.paybutton-overlay', 
      '[class*="paybutton"][class*="modal"]',
      '[class*="paybutton"][class*="overlay"]',
      '.ReactModal__Overlay',
      '[data-paybutton-modal]',
    ];
    
    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        (el as HTMLElement).style.display = 'none';
        el.remove();
      });
    });

    if (payButtonRef.current) {
      payButtonRef.current.innerHTML = '';
    }
  }, []);

  const handlePaymentSuccess = useCallback(async (txHash?: string) => {
    if (!user || !sessionToken || !topic || !position) return;

    closePayButtonModal();
    setSubmitting(true);
    setStep('confirming');

    try {
      const { data, error } = await supabase.functions.invoke('submit-sentiment-vote', {
        body: {
          topic_id: topic.id,
          position,
          tx_hash: txHash || `pb_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
          session_token: sessionToken
        }
      });

      if (error) throw error;

      if (data.success) {
        setStep('success');
        toast.success('Payment Sent!', {
          description: `Vote submitted anonymously`
        });
        
        setTimeout(() => {
          onSuccess();
          onOpenChange(false);
          resetForm();
        }, 1500);
      } else {
        throw new Error(data.error || 'Failed to submit vote');
      }
    } catch (error: any) {
      console.error('Error submitting vote:', error);
      toast.error(error.message || 'Failed to submit vote');
      setStep('payment');
    } finally {
      setSubmitting(false);
    }
  }, [user, sessionToken, topic, position, closePayButtonModal, onSuccess, onOpenChange]);

  const resetForm = () => {
    setStep('info');
    setSubmitting(false);
  };

  // Load PayButton script
  useEffect(() => {
    if (!document.querySelector('script[src*="paybutton"]')) {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/@paybutton/paybutton/dist/paybutton.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // Render PayButton
  useEffect(() => {
    if (step !== 'payment' || !payButtonRef.current || !user || !sessionToken || !topic) {
      if (payButtonRef.current) {
        payButtonRef.current.innerHTML = "";
      }
      return;
    }

    const voteCost = topic.vote_cost || 500;

    payButtonRef.current.innerHTML = "";

    const renderButton = () => {
      if (!payButtonRef.current) return;

      payButtonRef.current.innerHTML = "";

      const buttonContainer = document.createElement("div");
      buttonContainer.id = `paybutton-vote-${Date.now()}`;
      payButtonRef.current.appendChild(buttonContainer);

      const isAgree = position === 'agree';

      if ((window as any).PayButton) {
        (window as any).PayButton.render(buttonContainer, {
          to: ESCROW_ADDRESS,
          amount: voteCost,
          currency: "XEC",
          text: `Vote ${isAgree ? 'Agree' : 'Disagree'} - ${voteCost.toLocaleString()} XEC`,
          hoverText: "Confirm",
          successText: "Vote Sent!",
          autoClose: true,
          hideToasts: true,
          theme: {
            palette: {
              primary: isAgree ? "#22c55e" : "#ef4444",
              secondary: "#1e293b",
              tertiary: "#ffffff",
            },
          },
          onSuccess: (txResult: any) => {
            let txHash: string | undefined;
            if (typeof txResult === "string") {
              txHash = txResult;
            } else if (txResult?.hash) {
              txHash = txResult.hash;
            } else if (txResult?.txid) {
              txHash = txResult.txid;
            } else if (txResult?.txId) {
              txHash = txResult.txId;
            }
            handlePaymentSuccess(txHash);
          },
          onError: (error: any) => {
            console.error("PayButton error:", error);
            toast.error("Payment failed", {
              description: "Please try again.",
            });
          },
        });
      }
    };

    const timeoutId = setTimeout(renderButton, 100);

    return () => {
      clearTimeout(timeoutId);
      if (payButtonRef.current) {
        payButtonRef.current.innerHTML = "";
      }
    };
  }, [step, user, sessionToken, topic, position, handlePaymentSuccess]);

  if (!topic || !position) return null;

  const isAgree = position === 'agree';
  const voteCost = topic.vote_cost || 500;
  
  // Dynamic USD calculation based on live price
  const xecPrice = prices.ecash || 0.0001;
  const voteCostUsd = (voteCost * xecPrice).toFixed(2);

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) resetForm();
      onOpenChange(open);
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isAgree ? (
              <ThumbsUp className="w-5 h-5 text-green-500" />
            ) : (
              <ThumbsDown className="w-5 h-5 text-red-500" />
            )}
            {isAgree ? 'Agree' : 'Disagree'} with Topic
          </DialogTitle>
          <DialogDescription className="line-clamp-2">
            "{topic.title}"
          </DialogDescription>
        </DialogHeader>

        {step === 'info' && (
          <div className="space-y-4">
            <div className={`rounded-lg p-4 border ${isAgree ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isAgree ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                  {isAgree ? (
                    <ThumbsUp className="w-5 h-5 text-green-500" />
                  ) : (
                    <ThumbsDown className="w-5 h-5 text-red-500" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    You're voting: <span className={isAgree ? 'text-green-500' : 'text-red-500'}>{isAgree ? 'AGREE' : 'DISAGREE'}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">Amount: {voteCost.toLocaleString()} XEC (~${voteCostUsd})</p>
                </div>
              </div>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-primary">
                <Shield className="w-4 h-4" />
                <span className="font-medium text-sm">Anonymous Voting</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Your wallet address will be <strong className="text-foreground">cryptographically hashed</strong> and only a 
                redacted version (e.g., a1b2****c3d4) will be stored. Your identity remains private.
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <EyeOff className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">No Payouts</span>
              </div>
              <p className="text-xs text-muted-foreground">
                All votes contribute to eCash Pulse treasury. This is purely for sentiment gauging.
              </p>
            </div>

            <Button className="w-full" onClick={() => setStep('payment')}>
              Continue to Payment
            </Button>
          </div>
        )}

        {step === 'payment' && (
          <div className="space-y-4">
            <div className={`border rounded-lg p-4 space-y-3 ${isAgree ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
              <p className="text-sm text-foreground font-medium">Vote Cost:</p>
              <div className="flex items-center justify-between bg-background rounded-lg p-3">
                <span className={`font-mono text-lg font-bold ${isAgree ? 'text-green-500' : 'text-red-500'}`}>
                  {voteCost.toLocaleString()} XEC
                </span>
                <span className={`text-sm px-2 py-1 rounded ${isAgree ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                  ~${voteCostUsd}
                </span>
              </div>
            </div>

            {/* PayButton container - full width */}
            <div ref={payButtonRef} className="min-h-[52px] w-full [&>div]:w-full [&_button]:w-full" />

            <Button variant="outline" className="w-full" onClick={() => setStep('info')}>
              Back
            </Button>
          </div>
        )}

        {step === 'confirming' && (
          <div className="py-8 text-center">
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
            <p className="text-foreground font-medium">Verifying & recording vote...</p>
            <p className="text-sm text-muted-foreground mt-2">
              Your address is being anonymized
            </p>
          </div>
        )}

        {step === 'success' && (
          <div className="py-8 text-center">
            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <h2 className="font-display font-bold text-xl text-foreground mb-2">Vote Submitted!</h2>
            <p className="text-muted-foreground">
              Your anonymous vote has been recorded
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
