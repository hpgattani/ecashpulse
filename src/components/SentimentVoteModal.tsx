import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ThumbsUp, ThumbsDown, Loader2, CheckCircle } from 'lucide-react';
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
  const renderedRef = useRef(false);
  const retryRef = useRef<ReturnType<typeof setTimeout>>();

  const [step, setStep] = useState<'payment' | 'confirming' | 'success'>('payment');

  const close = useCallback(() => {
    setStep('payment');
    renderedRef.current = false;
    onOpenChange(false);
  }, [onOpenChange]);

  const cleanupPayButton = useCallback(() => {
    ['.paybutton-modal', '.paybutton-overlay', '[class*="paybutton"][class*="modal"]',
     '[class*="paybutton"][class*="overlay"]', '.ReactModal__Overlay'].forEach(sel => {
      document.querySelectorAll(sel).forEach(el => el.remove());
    });
  }, []);

  const handlePaymentSuccess = useCallback(async (txHash?: string) => {
    if (!user || !sessionToken || !topic || !position) return;
    cleanupPayButton();
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
      if (data?.success) {
        setStep('success');
        toast.success('Vote submitted!');
        setTimeout(() => {
          onSuccess();
          close();
        }, 1500);
      } else {
        throw new Error(data?.error || 'Failed to submit vote');
      }
    } catch (error: any) {
      console.error('Vote error:', error);
      toast.error(error.message || 'Failed to submit vote');
      setStep('payment');
    }
  }, [user, sessionToken, topic, position, cleanupPayButton, onSuccess, close]);

  // Render PayButton with retry
  useEffect(() => {
    if (!open || step !== 'payment' || !topic || !position || !user || !sessionToken) {
      renderedRef.current = false;
      if (payButtonRef.current) payButtonRef.current.innerHTML = '';
      return;
    }

    renderedRef.current = false;
    let attempts = 0;

    const tryRender = () => {
      const el = payButtonRef.current;
      const PB = (window as any).PayButton;
      if (!el || renderedRef.current) return;

      if (!PB) {
        attempts++;
        if (attempts < 40) retryRef.current = setTimeout(tryRender, 250);
        return;
      }

      el.innerHTML = '';
      const btn = document.createElement('div');
      btn.id = `pb-vote-${Date.now()}`;
      el.appendChild(btn);

      const isAgree = position === 'agree';
      const voteCost = topic.vote_cost || 500;

      PB.render(btn, {
        to: ESCROW_ADDRESS,
        amount: voteCost,
        currency: 'XEC',
        text: `Vote ${isAgree ? 'Agree' : 'Disagree'} – ${voteCost.toLocaleString()} XEC`,
        hoverText: 'Confirm',
        successText: 'Vote Sent!',
        autoClose: true,
        hideToasts: true,
        theme: {
          palette: {
            primary: isAgree ? '#22c55e' : '#ef4444',
            secondary: '#1e293b',
            tertiary: '#ffffff',
          },
        },
        onSuccess: (txResult: any) => {
          let txHash: string | undefined;
          if (typeof txResult === 'string') txHash = txResult;
          else if (txResult?.hash) txHash = txResult.hash;
          else if (txResult?.txid) txHash = txResult.txid;
          else if (txResult?.txId) txHash = txResult.txId;
          handlePaymentSuccess(txHash);
        },
        onError: (err: any) => {
          console.error('PayButton error:', err);
          toast.error('Payment failed. Please try again.');
        },
      });
      renderedRef.current = true;
    };

    retryRef.current = setTimeout(tryRender, 150);
    return () => {
      if (retryRef.current) clearTimeout(retryRef.current);
      if (payButtonRef.current) payButtonRef.current.innerHTML = '';
    };
  }, [open, step, topic, position, user, sessionToken, handlePaymentSuccess]);

  if (!topic || !position) return null;

  const isAgree = position === 'agree';
  const voteCost = topic.vote_cost || 500;
  const xecPrice = prices.ecash || 0.00000771;
  const voteCostUsd = (voteCost * xecPrice).toFixed(2);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={close}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-4 top-[50%] -translate-y-1/2 z-50 mx-auto max-w-md rounded-2xl border border-border/50 bg-card p-6 shadow-2xl"
          >
            {/* Close button */}
            <button
              onClick={close}
              className="absolute top-4 right-4 p-1 rounded-full hover:bg-muted transition-colors text-muted-foreground"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                {isAgree ? (
                  <ThumbsUp className="w-5 h-5 text-green-500" />
                ) : (
                  <ThumbsDown className="w-5 h-5 text-red-500" />
                )}
                <h2 className="font-display font-bold text-lg text-foreground">
                  {isAgree ? 'Agree' : 'Disagree'}
                </h2>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">
                "{topic.title}"
              </p>
            </div>

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

                <div
                  ref={payButtonRef}
                  className="min-h-[52px] flex justify-center"
                  style={{ isolation: 'isolate', zIndex: 60, pointerEvents: 'auto' }}
                />
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
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
