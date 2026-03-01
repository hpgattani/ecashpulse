import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Ticket, Loader2, CheckCircle, AlertTriangle, Shuffle, Eye, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';

interface Raffle {
  id: string;
  title: string;
  event_name: string;
  entry_cost: number;
  total_spots: number;
  spots_remaining: number;
  teams: string[];
}

interface JoinRaffleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  raffle: Raffle;
  xecPrice: number;
  onSuccess: () => void;
}

const ESCROW_ADDRESS = "ecash:qz6jsgshsv0v2tyuleptwr4at8xaxsakmstkhzc0pp";

export function JoinRaffleModal({ open, onOpenChange, raffle, xecPrice, onSuccess }: JoinRaffleModalProps) {
  const { user, sessionToken } = useAuth();
  const payButtonRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);
  const retryRef = useRef<ReturnType<typeof setTimeout>>();

  const [step, setStep] = useState<'info' | 'payment' | 'confirming' | 'reveal'>('info');
  const [assignedTeam, setAssignedTeam] = useState<string | null>(null);
  const [shuffling, setShuffling] = useState(false);
  const [displayTeam, setDisplayTeam] = useState('');

  const entryCostUsd = (raffle.entry_cost * xecPrice).toFixed(2);

  const cleanupPayButton = useCallback(() => {
    ['.paybutton-modal', '.paybutton-overlay', '[class*="paybutton"][class*="modal"]',
     '[class*="paybutton"][class*="overlay"]', '.ReactModal__Overlay'].forEach(sel => {
      document.querySelectorAll(sel).forEach(el => el.remove());
    });
  }, []);

  const handleClose = useCallback(() => {
    cleanupPayButton();
    renderedRef.current = false;
    if (retryRef.current) clearTimeout(retryRef.current);
    const hadTeam = assignedTeam;
    setStep('info');
    setAssignedTeam(null);
    setDisplayTeam('');
    onOpenChange(false);
    if (hadTeam) onSuccess();
  }, [assignedTeam, cleanupPayButton, onOpenChange, onSuccess]);

  const handlePaymentSuccess = useCallback(async (txHash?: string) => {
    if (!user || !sessionToken) return;
    cleanupPayButton();
    setStep('confirming');

    try {
      const { data, error } = await supabase.functions.invoke('join-raffle', {
        body: { raffle_id: raffle.id, session_token: sessionToken, tx_hash: txHash },
      });
      if (error) throw error;

      if (data.success) {
        toast.success('Payment Sent!', { description: `Entry fee: ${raffle.entry_cost.toLocaleString()} XEC` });
        setShuffling(true);
        setStep('reveal');
        const teams = raffle.teams;
        let count = 0;
        const interval = setInterval(() => {
          setDisplayTeam(teams[Math.floor(Math.random() * teams.length)]);
          count++;
          if (count > 20) {
            clearInterval(interval);
            setShuffling(false);
            setAssignedTeam(data.assigned_team);
            setDisplayTeam(data.assigned_team);
          }
        }, 100);
      } else {
        throw new Error(data.error || 'Failed to join raffle');
      }
    } catch (error: any) {
      console.error('Error joining raffle:', error);
      toast.error(error.message || 'Failed to join raffle');
      setStep('info');
    }
  }, [user, sessionToken, raffle, cleanupPayButton]);

  useEffect(() => {
    if (!open || step !== 'payment' || !user) {
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
      btn.id = `pb-join-${Date.now()}`;
      el.appendChild(btn);

      PB.render(btn, {
        to: ESCROW_ADDRESS,
        amount: raffle.entry_cost,
        currency: 'XEC',
        text: `Pay ${raffle.entry_cost.toLocaleString()} XEC`,
        hoverText: 'Confirm',
        successText: 'Payment Sent!',
        autoClose: true,
        hideToasts: true,
        theme: { palette: { primary: '#10b981', secondary: '#1e293b', tertiary: '#ffffff' } },
        onSuccess: (txResult: any) => {
          let txHash: string | undefined;
          if (typeof txResult === 'string') txHash = txResult;
          else if (txResult?.hash) txHash = txResult.hash;
          else if (txResult?.txid) txHash = txResult.txid;
          handlePaymentSuccess(txHash);
        },
        onError: (err: any) => {
          console.error('PayButton error:', err);
          toast.error('Payment failed');
        },
      });
      renderedRef.current = true;
    };

    retryRef.current = setTimeout(tryRender, 150);
    return () => {
      if (retryRef.current) clearTimeout(retryRef.current);
      if (payButtonRef.current) payButtonRef.current.innerHTML = '';
    };
  }, [open, step, user, raffle.entry_cost, handlePaymentSuccess]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={handleClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-4 top-[50%] -translate-y-1/2 z-50 mx-auto max-w-md rounded-2xl border border-border/50 bg-card p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <button onClick={handleClose} className="absolute top-4 right-4 p-1 rounded-full hover:bg-muted transition-colors text-muted-foreground">
              <X className="w-5 h-5" />
            </button>

            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <Ticket className="w-5 h-5 text-primary" />
                <h2 className="font-display font-bold text-lg text-foreground">Join Raffle</h2>
              </div>
              <p className="text-sm text-muted-foreground">{raffle.title}</p>
            </div>

            {step === 'info' && (
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Event</span>
                    <span className="font-medium text-foreground">{raffle.event_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Spots Remaining</span>
                    <span className="font-medium text-foreground">{raffle.spots_remaining}/{raffle.total_spots}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Entry Cost</span>
                    <span className="font-mono font-bold text-primary">{raffle.entry_cost.toLocaleString()} XEC (~${entryCostUsd})</span>
                  </div>
                </div>

                <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 flex items-start gap-3">
                  <Shuffle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Random Team Assignment</p>
                    <p className="text-xs text-muted-foreground mt-1">After payment, you'll be randomly assigned one of the remaining teams. Only you can see your team until the event concludes.</p>
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">Entry fee is non-refundable. If your team wins, you receive the entire pot (minus 1% fee).</p>
                </div>

                <Button className="w-full" onClick={() => setStep('payment')} disabled={!user}>
                  <Ticket className="w-4 h-4 mr-2" />
                  Pay {raffle.entry_cost.toLocaleString()} XEC to Join
                </Button>

                {!user && <p className="text-xs text-center text-muted-foreground">Connect your wallet to join</p>}
              </div>
            )}

            {step === 'payment' && (
              <div className="space-y-4">
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground">Entry Fee</span>
                    <div className="text-right">
                      <span className="font-mono text-lg font-bold text-primary">{raffle.entry_cost.toLocaleString()} XEC</span>
                      <div className="text-xs text-muted-foreground">~${entryCostUsd}</div>
                    </div>
                  </div>
                </div>
                <div ref={payButtonRef} className="min-h-[52px] flex justify-center" style={{ isolation: 'isolate', zIndex: 60, pointerEvents: 'auto' }} />
                <Button variant="outline" className="w-full" onClick={() => setStep('info')}>Back</Button>
              </div>
            )}

            {step === 'confirming' && (
              <div className="py-8 text-center">
                <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
                <p className="text-foreground font-medium">Joining raffle...</p>
              </div>
            )}

            {step === 'reveal' && (
              <div className="py-8 text-center">
                <AnimatePresence mode="wait">
                  {shuffling ? (
                    <motion.div key="shuffling" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                      <Shuffle className="w-12 h-12 text-primary mx-auto animate-pulse" />
                      <motion.div key={displayTeam} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="font-display text-2xl font-bold text-foreground">{displayTeam || '???'}</motion.div>
                      <p className="text-muted-foreground">Assigning your team...</p>
                    </motion.div>
                  ) : (
                    <motion.div key="revealed" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200 }} className="space-y-4">
                      <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
                        <CheckCircle className="w-10 h-10 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-muted-foreground text-sm mb-2">You got:</p>
                        <h2 className="font-display text-3xl font-bold text-foreground">{assignedTeam}</h2>
                      </div>
                      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                        <Eye className="w-3.5 h-3.5" />
                        Only you can see this
                      </div>
                      <Button className="w-full mt-4" onClick={handleClose}>Done</Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
