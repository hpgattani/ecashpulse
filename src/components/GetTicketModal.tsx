import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Ticket, Loader2, CheckCircle, AlertTriangle, Shuffle, Eye, Star } from 'lucide-react';
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

interface OfficialEvent {
  id: string;
  name: string;
  category: string;
  teams: string[];
  entryCostUsd: number;
  description: string;
}

interface GetTicketModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  raffle?: Raffle;
  officialEvent?: OfficialEvent;
  xecPrice: number;
  onSuccess: () => void;
}

const ESCROW_ADDRESS = "ecash:qz6jsgshsv0v2tyuleptwr4at8xaxsakmstkhzc0pp";

export function GetTicketModal({ open, onOpenChange, raffle, officialEvent, xecPrice, onSuccess }: GetTicketModalProps) {
  const { user, sessionToken } = useAuth();
  const payButtonRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState<'info' | 'payment' | 'confirming' | 'reveal'>('info');
  const [assignedTeam, setAssignedTeam] = useState<string | null>(null);
  const [shuffling, setShuffling] = useState(false);
  const [displayTeam, setDisplayTeam] = useState('');
  const [createdRaffleId, setCreatedRaffleId] = useState<string | null>(null);

  // Calculate costs
  const entryCost = raffle 
    ? raffle.entry_cost 
    : officialEvent 
      ? Math.ceil(officialEvent.entryCostUsd / xecPrice)
      : 0;
  
  const entryCostUsd = raffle 
    ? (raffle.entry_cost * xecPrice).toFixed(2)
    : officialEvent?.entryCostUsd.toFixed(2) || '0';

  const eventName = raffle?.event_name || officialEvent?.name || '';
  const teams = raffle?.teams || officialEvent?.teams || [];
  const totalSpots = raffle?.total_spots || teams.length;
  const spotsRemaining = raffle?.spots_remaining || teams.length;

  const closePayButtonModal = useCallback(() => {
    const selectors = ['.paybutton-modal', '.paybutton-overlay', '.ReactModal__Overlay'];
    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        (el as HTMLElement).style.display = 'none';
        el.remove();
      });
    });
    if (payButtonRef.current) payButtonRef.current.innerHTML = '';
  }, []);

  const handlePaymentSuccess = useCallback(async (txHash?: string) => {
    if (!user || !sessionToken) return;

    closePayButtonModal();
    setStep('confirming');

    try {
      let raffleId = raffle?.id || createdRaffleId;

      // If no raffle exists, create an official one first
      if (!raffleId && officialEvent) {
        const { data: createData, error: createError } = await supabase.functions.invoke('create-raffle', {
          body: {
            event_id: officialEvent.id,
            title: officialEvent.name,
            description: officialEvent.description,
            entry_cost_usd: officialEvent.entryCostUsd,
            session_token: sessionToken,
            is_official: true,
            skip_creation_fee: true, // Official raffles don't need creation fee
          },
        });

        if (createError) throw createError;
        if (!createData.success) throw new Error(createData.error || 'Failed to create official raffle');
        
        raffleId = createData.raffle_id;
        setCreatedRaffleId(raffleId);
      }

      // Now join the raffle
      const { data, error } = await supabase.functions.invoke('join-raffle', {
        body: {
          raffle_id: raffleId,
          session_token: sessionToken,
          tx_hash: txHash,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Ticket Purchased!', {
          description: `Entry fee: ${entryCost.toLocaleString()} XEC`,
        });

        // Start shuffle animation
        setShuffling(true);
        setStep('reveal');

        // Animate through random teams
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
        throw new Error(data.error || 'Failed to get ticket');
      }
    } catch (error: any) {
      console.error('Error getting ticket:', error);
      toast.error(error.message || 'Failed to get ticket');
      setStep('info');
    }
  }, [user, sessionToken, raffle, officialEvent, entryCost, teams, closePayButtonModal, createdRaffleId]);

  // Load PayButton script
  useEffect(() => {
    if (!document.querySelector('script[src*="paybutton"]')) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@paybutton/paybutton/dist/paybutton.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // Render PayButton
  useEffect(() => {
    if (step !== 'payment' || !payButtonRef.current || !user) return;

    payButtonRef.current.innerHTML = '';

    const renderButton = () => {
      if (!payButtonRef.current) return;
      payButtonRef.current.innerHTML = '';

      const buttonContainer = document.createElement('div');
      buttonContainer.id = `paybutton-ticket-${Date.now()}`;
      payButtonRef.current.appendChild(buttonContainer);

      if ((window as any).PayButton) {
        (window as any).PayButton.render(buttonContainer, {
          to: ESCROW_ADDRESS,
          amount: entryCost,
          currency: 'XEC',
          text: `Pay ${entryCost.toLocaleString()} XEC`,
          hoverText: 'Confirm',
          successText: 'Payment Sent!',
          autoClose: true,
          hideToasts: true,
          theme: {
            palette: {
              primary: '#f59e0b',
              secondary: '#1e293b',
              tertiary: '#000000',
            },
          },
          onSuccess: (txResult: any) => {
            let txHash: string | undefined;
            if (typeof txResult === 'string') txHash = txResult;
            else if (txResult?.hash) txHash = txResult.hash;
            else if (txResult?.txid) txHash = txResult.txid;
            handlePaymentSuccess(txHash);
          },
          onError: (error: any) => {
            console.error('PayButton error:', error);
            toast.error('Payment failed');
          },
        });
      }
    };

    const timeoutId = setTimeout(renderButton, 100);
    return () => {
      clearTimeout(timeoutId);
      if (payButtonRef.current) payButtonRef.current.innerHTML = '';
    };
  }, [step, user, entryCost, handlePaymentSuccess]);

  const handleClose = () => {
    setStep('info');
    setAssignedTeam(null);
    setDisplayTeam('');
    setCreatedRaffleId(null);
    onOpenChange(false);
    if (assignedTeam) onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-400" />
            Get Your Ticket
            <Badge className="bg-gradient-to-r from-amber-500 to-yellow-400 text-black text-xs ml-2">
              Official
            </Badge>
          </DialogTitle>
          <DialogDescription>{eventName}</DialogDescription>
        </DialogHeader>

        {step === 'info' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/20 rounded-lg p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Event</span>
                <span className="font-medium text-foreground">{eventName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Teams</span>
                <span className="font-medium text-foreground">{teams.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Spots Remaining</span>
                <span className="font-medium text-foreground">{spotsRemaining}/{totalSpots}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entry Cost</span>
                <span className="font-mono font-bold text-amber-400">
                  {entryCost.toLocaleString()} XEC (~${entryCostUsd})
                </span>
              </div>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 flex items-start gap-3">
              <Star className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">No Creation Fee!</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Official events are free to join. Just pay the entry cost and get your team!
                </p>
              </div>
            </div>

            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 flex items-start gap-3">
              <Shuffle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Random Team Assignment</p>
                <p className="text-xs text-muted-foreground mt-1">
                  After payment, you'll be randomly assigned a team. Only you can see your team!
                </p>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Entry fee is non-refundable. If your team wins, you receive the entire pot (minus 1% fee).
              </p>
            </div>

            <Button 
              className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black font-bold" 
              onClick={() => setStep('payment')} 
              disabled={!user}
            >
              <Ticket className="w-4 h-4 mr-2" />
              Pay {entryCost.toLocaleString()} XEC to Get Ticket
            </Button>

            {!user && (
              <p className="text-xs text-center text-muted-foreground">
                Connect your wallet to get your ticket
              </p>
            )}
          </div>
        )}

        {step === 'payment' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">Entry Fee</span>
                <div className="text-right">
                  <span className="font-mono text-lg font-bold text-amber-400">
                    {entryCost.toLocaleString()} XEC
                  </span>
                  <div className="text-xs text-muted-foreground">~${entryCostUsd}</div>
                </div>
              </div>
            </div>

            <div ref={payButtonRef} className="min-h-[52px] flex justify-center" />

            <Button variant="outline" className="w-full" onClick={() => setStep('info')}>
              Back
            </Button>
          </div>
        )}

        {step === 'confirming' && (
          <div className="py-8 text-center">
            <Loader2 className="w-12 h-12 text-amber-400 animate-spin mx-auto mb-4" />
            <p className="text-foreground font-medium">Getting your ticket...</p>
          </div>
        )}

        {step === 'reveal' && (
          <div className="py-8 text-center">
            <AnimatePresence mode="wait">
              {shuffling ? (
                <motion.div
                  key="shuffling"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4"
                >
                  <Shuffle className="w-12 h-12 text-amber-400 mx-auto animate-pulse" />
                  <motion.div
                    key={displayTeam}
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="font-display text-2xl font-bold text-foreground"
                  >
                    {displayTeam || '???'}
                  </motion.div>
                  <p className="text-muted-foreground">Assigning your team...</p>
                </motion.div>
              ) : (
                <motion.div
                  key="revealed"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 200 }}
                  className="space-y-4"
                >
                  <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-amber-500/20 to-yellow-500/20 flex items-center justify-center">
                    <CheckCircle className="w-10 h-10 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm mb-2">You got:</p>
                    <h2 className="font-display text-3xl font-bold text-foreground">
                      {assignedTeam}
                    </h2>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Eye className="w-3.5 h-3.5" />
                    Only you can see this
                  </div>
                  <Button className="w-full mt-4 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black font-bold" onClick={handleClose}>
                    Done
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
