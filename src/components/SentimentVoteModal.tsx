import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ThumbsUp, ThumbsDown, Loader2, CheckCircle } from 'lucide-react';
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

const ESCROW_ADDRESS = "ecash:qz6jsgshsv0v2tyuleptwr4at8xaxsakmstkhzc0pp";

export function SentimentVoteModal({ open, onOpenChange, topic, position, onSuccess }: SentimentVoteModalProps) {
  const { user, sessionToken } = useAuth();
  const { prices } = useCryptoPrices();
  const payButtonRef = useRef<HTMLDivElement>(null);
  
  const [step, setStep] = useState<'payment' | 'confirming' | 'success'>('payment');
  const [submitting, setSubmitting] = useState(false);

  const closePayButtonModal = useCallback(() => {
    const selectors = [
      '.paybutton-modal', '.paybutton-overlay',
      '[class*="paybutton"][class*="modal"]', '[class*="paybutton"][class*="overlay"]',
      '.ReactModal__Overlay', '[data-paybutton-modal]',
    ];
    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        (el as HTMLElement).style.display = 'none';
        el.remove();
      });
    });
    if (payButtonRef.current) payButtonRef.current.innerHTML = '';
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
        toast.success('Vote submitted!');
        setTimeout(() => {
          onSuccess();
          onOpenChange(false);
          setStep('payment');
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
    console.log('[SentimentVote] useEffect triggered:', { step, open, hasUser: !!user, hasToken: !!sessionToken, hasTopic: !!topic, hasPosition: !!position, hasRef: !!payButtonRef.current });
    
    if (step !== 'payment' || !payButtonRef.current || !user || !sessionToken || !topic || !open) {
      if (payButtonRef.current) payButtonRef.current.innerHTML = "";
      return;
    }

    const voteCost = topic.vote_cost || 500;
    payButtonRef.current.innerHTML = "";
    let attempts = 0;
    let timeoutId: ReturnType<typeof setTimeout>;

    const renderButton = () => {
      if (!payButtonRef.current) return;
      payButtonRef.current.innerHTML = "";

      const PB = (window as any).PayButton;
      console.log('[SentimentVote] renderButton attempt', attempts, 'PayButton available:', !!PB);
      
      if (!PB) {
        attempts++;
        if (attempts < 30) {
          timeoutId = setTimeout(renderButton, 500);
        } else {
          console.error('[SentimentVote] PayButton never loaded');
        }
        return;
      }

      const buttonContainer = document.createElement("div");
      buttonContainer.id = `paybutton-vote-${Date.now()}`;
      payButtonRef.current.appendChild(buttonContainer);

      const isAgree = position === 'agree';

      try {
        PB.render(buttonContainer, {
          to: ESCROW_ADDRESS,
          amount: voteCost,
          currency: "XEC",
          text: `Vote ${isAgree ? 'Agree' : 'Disagree'} – ${voteCost.toLocaleString()} XEC`,
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
            if (typeof txResult === "string") txHash = txResult;
            else if (txResult?.hash) txHash = txResult.hash;
            else if (txResult?.txid) txHash = txResult.txid;
            else if (txResult?.txId) txHash = txResult.txId;
            handlePaymentSuccess(txHash);
          },
          onError: (error: any) => {
            console.error("PayButton error:", error);
            toast.error("Payment failed. Please try again.");
          },
        });
        console.log('[SentimentVote] PayButton.render() called successfully');
      } catch (err) {
        console.error('[SentimentVote] PayButton.render() threw:', err);
      }
    };

    timeoutId = setTimeout(renderButton, 300);
    return () => {
      clearTimeout(timeoutId);
      if (payButtonRef.current) payButtonRef.current.innerHTML = "";
    };
  }, [step, user, sessionToken, topic, position, open, handlePaymentSuccess]);

  if (!topic || !position) return null;

  const isAgree = position === 'agree';
  const voteCost = topic.vote_cost || 500;
  const xecPrice = prices.ecash || 0.00000771;
  const voteCostUsd = (voteCost * xecPrice).toFixed(2);

  return (
    <Dialog open={open} onOpenChange={(o) => {
      if (!o) setStep('payment');
      onOpenChange(o);
    }}>
      <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isAgree ? (
              <ThumbsUp className="w-5 h-5 text-green-500" />
            ) : (
              <ThumbsDown className="w-5 h-5 text-red-500" />
            )}
            {isAgree ? 'Agree' : 'Disagree'}
          </DialogTitle>
          <DialogDescription className="line-clamp-2">
            "{topic.title}"
          </DialogDescription>
        </DialogHeader>

        {step === 'payment' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
              <span className="text-sm text-muted-foreground">Vote cost</span>
              <div className="text-right">
                <span className={`font-mono font-bold ${isAgree ? 'text-green-500' : 'text-red-500'}`}>
                  {voteCost.toLocaleString()} XEC
                </span>
                <span className="text-xs text-muted-foreground ml-2">(~${voteCostUsd})</span>
              </div>
            </div>

            <div ref={payButtonRef} className="min-h-[52px] flex justify-center isolation-isolate z-[60]" style={{ pointerEvents: 'auto' }} />
          </div>
        )}

        {step === 'confirming' && (
          <div className="py-8 text-center">
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
            <p className="text-foreground font-medium">Recording vote...</p>
          </div>
        )}

        {step === 'success' && (
          <div className="py-8 text-center">
            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <h2 className="font-display font-bold text-xl text-foreground mb-2">Vote Submitted!</h2>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
