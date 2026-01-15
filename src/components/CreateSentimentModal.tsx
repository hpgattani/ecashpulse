import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { EyeOff, Loader2, AlertTriangle, Coins, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { useCryptoPrices } from '@/hooks/useCryptoPrices';

interface CreateSentimentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// Same escrow address used for betting
const ESCROW_ADDRESS = "ecash:qz6jsgshsv0v2tyuleptwr4at8xaxsakmstkhzc0pp";

// Slider range: $0.05 to $5 in ~$0.10 increments
const MIN_VOTE_COST = 500;
const MAX_VOTE_COST = 50000;
const VOTE_COST_STEP = 1000;

export function CreateSentimentModal({ open, onOpenChange, onSuccess }: CreateSentimentModalProps) {
  const { user, sessionToken } = useAuth();
  const { prices } = useCryptoPrices();
  const payButtonRef = useRef<HTMLDivElement>(null);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [voteCost, setVoteCost] = useState(5000);
  const [step, setStep] = useState<'form' | 'payment' | 'confirming' | 'success'>('form');
  const [submitting, setSubmitting] = useState(false);

  // Dynamic XEC amount for $1 based on live price
  const xecPrice = prices.ecash || 0.0001; // Fallback to ~$0.0001 per XEC
  const creationFeeXec = Math.ceil(1 / xecPrice); // $1 worth of XEC

  // Calculate USD equivalent for vote cost
  const voteCostUsd = (voteCost * xecPrice).toFixed(2);
  const sliderPercent = ((voteCost - MIN_VOTE_COST) / (MAX_VOTE_COST - MIN_VOTE_COST)) * 100;

  const handleSubmitTopic = async () => {
    if (!title.trim()) {
      toast.error('Please enter a topic title');
      return;
    }
    if (title.length < 10) {
      toast.error('Topic title must be at least 10 characters');
      return;
    }
    setStep('payment');
  };

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
    if (!user || !sessionToken) return;

    closePayButtonModal();
    setSubmitting(true);
    setStep('confirming');

    try {
      const { data, error } = await supabase.functions.invoke('create-sentiment-topic', {
        body: {
          title: title.trim(),
          description: description.trim() || null,
          vote_cost: voteCost,
          tx_hash: txHash || `pb_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
          session_token: sessionToken
        }
      });

      if (error) throw error;

      if (data.success) {
        setStep('success');
        toast.success('Payment Sent!', {
          description: `Topic created with ${creationFeeXec.toLocaleString()} XEC fee`
        });
        
        setTimeout(() => {
          onSuccess();
          onOpenChange(false);
          resetForm();
        }, 1500);
      } else {
        throw new Error(data.error || 'Failed to create topic');
      }
    } catch (error: any) {
      console.error('Error creating sentiment topic:', error);
      toast.error(error.message || 'Failed to create topic');
      setStep('payment');
    } finally {
      setSubmitting(false);
    }
  }, [user, sessionToken, title, description, voteCost, creationFeeXec, closePayButtonModal, onSuccess, onOpenChange]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setVoteCost(5000);
    setStep('form');
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
    if (step !== 'payment' || !payButtonRef.current || !user || !sessionToken) {
      if (payButtonRef.current) {
        payButtonRef.current.innerHTML = "";
      }
      return;
    }

    payButtonRef.current.innerHTML = "";

    const renderButton = () => {
      if (!payButtonRef.current) return;

      payButtonRef.current.innerHTML = "";

      const buttonContainer = document.createElement("div");
      buttonContainer.id = `paybutton-sentiment-${Date.now()}`;
      payButtonRef.current.appendChild(buttonContainer);

      if ((window as any).PayButton) {
        (window as any).PayButton.render(buttonContainer, {
          to: ESCROW_ADDRESS,
          amount: creationFeeXec,
          currency: "XEC",
          text: `Pay ${creationFeeXec.toLocaleString()} XEC (~$1)`,
          hoverText: "Confirm",
          successText: "Payment Sent!",
          autoClose: true,
          hideToasts: true,
          theme: {
            palette: {
              primary: "#10b981",
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
  }, [step, user, sessionToken, creationFeeXec, handlePaymentSuccess]);

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) resetForm();
      onOpenChange(open);
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <EyeOff className="w-5 h-5 text-primary" />
            Create Sentiment Topic
          </DialogTitle>
          <DialogDescription>
            Create a topic for anonymous public sentiment. Fee: ~$1 ({creationFeeXec.toLocaleString()} XEC)
          </DialogDescription>
        </DialogHeader>

        {step === 'form' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-foreground">Topic Title</Label>
              <Input
                id="title"
                placeholder="e.g., Should eCash focus more on DeFi?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground">
                {title.length}/200 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-foreground">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Add more context to your topic..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                {description.length}/500 characters
              </p>
            </div>

            {/* Liquid Glass Vote Cost Slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-foreground flex items-center gap-2">
                  <Coins className="w-4 h-4 text-primary" />
                  Vote Cost
                </Label>
                <Badge variant="outline" className="font-mono">
                  ~${voteCostUsd}
                </Badge>
              </div>
              
              <div className="relative">
                {/* Liquid Glass Slider Track */}
                <div className="relative h-14 rounded-2xl">
                  {/* Glass background with proper styling */}
                  <div 
                    className="absolute inset-0 rounded-2xl overflow-hidden"
                    style={{
                      background: 'var(--glass-bg)',
                      boxShadow: 'var(--glass-shadow)',
                      backdropFilter: 'var(--glass-blur)',
                    }}
                  >
                    {/* Specular highlight */}
                    <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-transparent" />
                  </div>
                  
                  {/* Animated fill */}
                  <motion.div 
                    className="absolute top-1 bottom-1 left-1 rounded-xl overflow-hidden"
                    initial={false}
                    animate={{ width: `calc(${Math.max(5, sliderPercent)}% - 8px)` }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  >
                    {/* Gradient fill */}
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/40 via-primary/60 to-primary/50 rounded-xl" />
                    
                    {/* Shimmer effect */}
                    <motion.div 
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                      animate={{ x: ['-200%', '200%'] }}
                      transition={{ repeat: Infinity, duration: 2.5, ease: 'linear' }}
                    />
                    
                    {/* Top highlight */}
                    <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent rounded-t-xl" />
                  </motion.div>
                  
                  {/* Slider Input - on top for interaction */}
                  <input
                    type="range"
                    min={MIN_VOTE_COST}
                    max={MAX_VOTE_COST}
                    step={VOTE_COST_STEP}
                    value={voteCost}
                    onChange={(e) => setVoteCost(Number(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-40"
                  />
                  
                  {/* Value display inside slider */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                    <motion.span 
                      key={voteCost}
                      initial={{ scale: 1.1, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.15 }}
                      className="font-display font-bold text-lg text-foreground drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]"
                    >
                      {voteCost.toLocaleString()} XEC
                    </motion.span>
                  </div>
                  
                  {/* Thumb indicator - pure CSS, no motion */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-7 h-7 pointer-events-none z-30 transition-all duration-200 ease-out"
                    style={{ 
                      left: `calc(${sliderPercent}% - ${sliderPercent * 0.28}px + 4px)`
                    }}
                  >
                    <div className="w-full h-full rounded-full bg-gradient-to-br from-primary via-primary to-primary/80 shadow-lg shadow-primary/40 border-2 border-white/40">
                      <div className="absolute inset-1 rounded-full bg-gradient-to-b from-white/50 to-transparent" />
                    </div>
                  </div>
                </div>
                
                {/* Range labels */}
                <div className="flex justify-between mt-2.5 text-xs text-muted-foreground px-1">
                  <span>$0.05</span>
                  <span className="text-foreground/50">drag to adjust</span>
                  <span>$5.00</span>
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground text-center">
                Set the cost for each vote on your topic
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                <span className="text-sm font-medium text-foreground">Important</span>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1 ml-6">
                <li>• Creation fee is non-refundable</li>
                <li>• Your address will be hashed for anonymity</li>
                <li>• Topic will be active for 7 days</li>
                <li>• All funds support eCash Pulse treasury</li>
              </ul>
            </div>

            <Button className="w-full" onClick={handleSubmitTopic}>
              Continue to Payment
            </Button>
          </div>
        )}

        {step === 'payment' && (
          <div className="space-y-4">
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
              <p className="text-sm text-foreground font-medium">Creation Fee:</p>
              <div className="flex items-center justify-between bg-background rounded-lg p-3">
                <span className="font-mono text-lg font-bold text-primary">
                  {creationFeeXec.toLocaleString()} XEC
                </span>
                <Badge variant="outline">~$1</Badge>
              </div>
              
              <div className="mt-3 pt-3 border-t border-border/50">
                <p className="text-xs text-muted-foreground">
                  Vote cost: <span className="text-foreground font-medium">{voteCost.toLocaleString()} XEC (~${voteCostUsd})</span> per vote
                </p>
              </div>
            </div>

            {/* PayButton container */}
            <div ref={payButtonRef} className="min-h-[52px]" />

            <Button variant="outline" className="w-full" onClick={() => setStep('form')}>
              Back
            </Button>
          </div>
        )}

        {step === 'confirming' && (
          <div className="py-8 text-center">
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
            <p className="text-foreground font-medium">Creating your topic...</p>
            <p className="text-sm text-muted-foreground mt-2">
              This may take a moment
            </p>
          </div>
        )}

        {step === 'success' && (
          <div className="py-8 text-center">
            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <h2 className="font-display font-bold text-xl text-foreground mb-2">Topic Created!</h2>
            <p className="text-muted-foreground">
              Your sentiment topic is now live
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
