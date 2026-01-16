import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Ticket, Loader2, AlertTriangle, CheckCircle, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useCryptoPrices } from '@/hooks/useCryptoPrices';

interface CreateRaffleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const ESCROW_ADDRESS = "ecash:qz6jsgshsv0v2tyuleptwr4at8xaxsakmstkhzc0pp";

const EVENT_OPTIONS = [
  { id: 'fifa_world_cup', name: 'FIFA World Cup 2026', category: 'sports', teams: 32 },
  { id: 'nfl_playoffs', name: 'NFL Playoffs 2026', category: 'sports', teams: 14 },
  { id: 'nba_finals', name: 'NBA Finals 2026', category: 'sports', teams: 16 },
  { id: 'champions_league', name: 'UEFA Champions League', category: 'sports', teams: 16 },
  { id: 'nfl_super_bowl', name: 'NFL Super Bowl (All Teams)', category: 'sports', teams: 32 },
  { id: 'mlb_world_series', name: 'MLB World Series (All Teams)', category: 'sports', teams: 30 },
  { id: 'nhl_stanley_cup', name: 'NHL Stanley Cup (All Teams)', category: 'sports', teams: 32 },
  { id: 'oscars', name: 'Oscars Best Picture 2026', category: 'entertainment', teams: 10 },
  { id: 'grammys', name: 'Grammy Album of Year 2026', category: 'entertainment', teams: 8 },
  { id: 'eurovision', name: 'Eurovision 2026', category: 'entertainment', teams: 25 },
  { id: 'the_voice_finale', name: 'The Voice Finale (Top 10)', category: 'entertainment', teams: 10 },
  { id: 'super_bowl_mvp', name: 'Super Bowl MVP 2026', category: 'sports', teams: 10 },
];

export function CreateRaffleModal({ open, onOpenChange, onSuccess }: CreateRaffleModalProps) {
  const { user, sessionToken } = useAuth();
  const { prices } = useCryptoPrices();
  const payButtonRef = useRef<HTMLDivElement>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedEvent, setSelectedEvent] = useState('');
  const [potSizeUsd, setPotSizeUsd] = useState(50);
  const [step, setStep] = useState<'form' | 'payment' | 'confirming' | 'success'>('form');
  const [submitting, setSubmitting] = useState(false);

  const xecPrice = prices.ecash || 0.0001;
  const creationFeeXec = Math.ceil(1 / xecPrice);

  const selectedEventData = EVENT_OPTIONS.find(e => e.id === selectedEvent);
  const entryCostUsd = selectedEventData ? (potSizeUsd / selectedEventData.teams).toFixed(2) : '0';
  const entryCostXec = selectedEventData ? Math.ceil(potSizeUsd / selectedEventData.teams / xecPrice) : 0;

  const handleSubmit = () => {
    if (!title.trim() || title.length < 5) {
      toast.error('Title must be at least 5 characters');
      return;
    }
    if (!selectedEvent) {
      toast.error('Please select an event');
      return;
    }
    setStep('payment');
  };

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
    setSubmitting(true);
    setStep('confirming');

    try {
      const { data, error } = await supabase.functions.invoke('create-raffle', {
        body: {
          event_id: selectedEvent,
          title: title.trim(),
          description: description.trim() || null,
          entry_cost_usd: potSizeUsd,
          session_token: sessionToken,
          tx_hash: txHash,
        },
      });

      if (error) throw error;

      if (data.success) {
        setStep('success');
        toast.success('Payment Sent!', {
          description: `Raffle created with ${creationFeeXec.toLocaleString()} XEC fee`,
        });

        setTimeout(() => {
          onSuccess();
          resetForm();
        }, 1500);
      } else {
        throw new Error(data.error || 'Failed to create raffle');
      }
    } catch (error: any) {
      console.error('Error creating raffle:', error);
      toast.error(error.message || 'Failed to create raffle');
      setStep('payment');
    } finally {
      setSubmitting(false);
    }
  }, [user, sessionToken, selectedEvent, title, description, potSizeUsd, creationFeeXec, closePayButtonModal, onSuccess]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setSelectedEvent('');
    setPotSizeUsd(50);
    setStep('form');
    setSubmitting(false);
  };

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
      buttonContainer.id = `paybutton-raffle-${Date.now()}`;
      payButtonRef.current.appendChild(buttonContainer);

      if ((window as any).PayButton) {
        (window as any).PayButton.render(buttonContainer, {
          to: ESCROW_ADDRESS,
          amount: creationFeeXec,
          currency: 'XEC',
          text: `Pay ${creationFeeXec.toLocaleString()} XEC (~$1)`,
          hoverText: 'Confirm',
          successText: 'Payment Sent!',
          autoClose: true,
          hideToasts: true,
          theme: {
            palette: {
              primary: '#10b981',
              secondary: '#1e293b',
              tertiary: '#ffffff',
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
  }, [step, user, creationFeeXec, handlePaymentSuccess]);

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) resetForm(); onOpenChange(open); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="w-5 h-5 text-primary" />
            Create Raffle
          </DialogTitle>
          <DialogDescription>
            Create a raffle for an event. Fee: ~$1 ({creationFeeXec.toLocaleString()} XEC)
          </DialogDescription>
        </DialogHeader>

        {step === 'form' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-foreground">Raffle Title</Label>
              <Input
                id="title"
                placeholder="e.g., World Cup Winner Pool"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="event" className="text-foreground">Select Event</Label>
              <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an event..." />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_OPTIONS.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      <div className="flex items-center gap-2">
                        <span>{event.category === 'sports' ? '🏆' : '🎭'}</span>
                        <span>{event.name}</span>
                        <Badge variant="outline" className="ml-2 text-xs">{event.teams} teams</Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pot" className="text-foreground">Target Pot Size (USD)</Label>
              <Select value={potSizeUsd.toString()} onValueChange={(v) => setPotSizeUsd(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">$25</SelectItem>
                  <SelectItem value="50">$50</SelectItem>
                  <SelectItem value="100">$100</SelectItem>
                  <SelectItem value="250">$250</SelectItem>
                  <SelectItem value="500">$500</SelectItem>
                </SelectContent>
              </Select>
              {selectedEventData && (
                <p className="text-xs text-muted-foreground">
                  Entry cost: ~${entryCostUsd} ({entryCostXec.toLocaleString()} XEC) per team
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-foreground">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Add details about your raffle..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={2}
              />
            </div>

            {selectedEventData && (
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Users className="w-4 h-4" />
                  {selectedEventData.teams} teams available
                </div>
                <p className="text-xs text-muted-foreground">
                  Each participant pays ~${entryCostUsd} to get a random team. Winner takes all (minus 1% fee).
                </p>
              </div>
            )}

            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                <span className="text-sm font-medium text-foreground">Important</span>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1 ml-6">
                <li>• $1 creation fee is non-refundable</li>
                <li>• Team assignments are hidden from others</li>
                <li>• 1% platform fee on winning payout</li>
              </ul>
            </div>

            <Button className="w-full" onClick={handleSubmit} disabled={!selectedEvent}>
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
            </div>

            <div ref={payButtonRef} className="min-h-[52px] flex justify-center" />

            <Button variant="outline" className="w-full" onClick={() => setStep('form')}>
              Back
            </Button>
          </div>
        )}

        {step === 'confirming' && (
          <div className="py-8 text-center">
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
            <p className="text-foreground font-medium">Creating your raffle...</p>
          </div>
        )}

        {step === 'success' && (
          <div className="py-8 text-center">
            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <h2 className="font-display font-bold text-xl text-foreground mb-2">Raffle Created!</h2>
            <p className="text-muted-foreground">Your raffle is now live</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
