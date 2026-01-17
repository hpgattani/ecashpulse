import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Zap, Loader2, Dices, Clock, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { FICTIONAL_TEAMS } from './InstantRaffleSection';

interface CreateInstantRaffleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  xecPrice: number;
  onSuccess: () => void;
}

const ESCROW_ADDRESS = "ecash:qz6jsgshsv0v2tyuleptwr4at8xaxsakmstkhzc0pp";

const DURATION_OPTIONS = [
  { value: '1', label: '1 hour' },
  { value: '2', label: '2 hours' },
  { value: '6', label: '6 hours' },
  { value: '12', label: '12 hours' },
  { value: '24', label: '24 hours' },
];

const TEAM_COUNT_OPTIONS = [
  { value: '4', label: '4 teams' },
  { value: '8', label: '8 teams' },
  { value: '12', label: '12 teams' },
  { value: '16', label: '16 teams' },
];

export function CreateInstantRaffleModal({ open, onOpenChange, xecPrice, onSuccess }: CreateInstantRaffleModalProps) {
  const { user, sessionToken } = useAuth();
  const payButtonRef = useRef<HTMLDivElement>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('6');
  const [teamCount, setTeamCount] = useState('8');
  const [step, setStep] = useState<'form' | 'payment' | 'creating'>('form');

  const creationFeeXec = Math.ceil(1 / xecPrice);
  const entryCostXec = Math.ceil(1 / xecPrice);

  // Get random subset of fictional teams
  const getRandomTeams = (count: number) => {
    const shuffled = [...FICTIONAL_TEAMS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
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
    setStep('creating');

    try {
      const teams = getRandomTeams(parseInt(teamCount));
      const endsAt = new Date(Date.now() + parseInt(duration) * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase.functions.invoke('create-raffle', {
        body: {
          title: title || `Instant Raffle #${Date.now().toString().slice(-6)}`,
          description: description || 'Quick raffle with fictional teams - winner auto-picked at deadline!',
          event_id: 'instant_raffle',
          teams,
          entry_cost_xec: entryCostXec,
          ends_at: endsAt,
          session_token: sessionToken,
          creation_fee_tx: txHash,
          is_instant: true,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Instant Raffle Created!', {
          description: `Winner will be picked in ${duration} hours`,
        });
        onSuccess();
        handleClose();
      } else {
        throw new Error(data.error || 'Failed to create raffle');
      }
    } catch (error: any) {
      console.error('Error creating instant raffle:', error);
      toast.error(error.message || 'Failed to create raffle');
      setStep('form');
    }
  }, [user, sessionToken, title, description, teamCount, duration, entryCostXec, closePayButtonModal, onSuccess]);

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
      buttonContainer.id = `paybutton-instant-${Date.now()}`;
      payButtonRef.current.appendChild(buttonContainer);

      if ((window as any).PayButton) {
        (window as any).PayButton.render(buttonContainer, {
          to: ESCROW_ADDRESS,
          amount: creationFeeXec,
          currency: 'XEC',
          text: `Pay ${creationFeeXec.toLocaleString()} XEC`,
          hoverText: 'Confirm',
          successText: 'Payment Sent!',
          autoClose: true,
          hideToasts: true,
          theme: {
            palette: {
              primary: '#a855f7',
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
  }, [step, user, creationFeeXec, handlePaymentSuccess]);

  const handleClose = () => {
    setStep('form');
    setTitle('');
    setDescription('');
    setDuration('6');
    setTeamCount('8');
    onOpenChange(false);
  };

  const canProceed = title.trim().length > 0 || true; // Title optional for instant raffles

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-400" />
            Create Instant Raffle
          </DialogTitle>
          <DialogDescription>
            Create a quick raffle with fictional teams - winner auto-picked at deadline!
          </DialogDescription>
        </DialogHeader>

        {step === 'form' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title (optional)</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Quick Friday Raffle"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Winner takes all!"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Duration
                </Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  Teams
                </Label>
                <Select value={teamCount} onValueChange={setTeamCount}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEAM_COUNT_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Creation Fee</span>
                <span className="font-mono font-semibold text-purple-400">
                  {creationFeeXec.toLocaleString()} XEC (~$1)
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Entry Cost (per player)</span>
                <span className="font-mono text-foreground">
                  {entryCostXec.toLocaleString()} XEC (~$1)
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Max Pot</span>
                <span className="font-mono text-foreground">
                  {(entryCostXec * parseInt(teamCount)).toLocaleString()} XEC (~${parseInt(teamCount)})
                </span>
              </div>
            </div>

            <div className="bg-muted/30 rounded-lg p-3 flex items-start gap-2">
              <Dices className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Random fictional teams will be assigned. At the deadline, the system automatically 
                picks a winning team at random. Winner takes the pot minus 1% fee!
              </p>
            </div>

            <Button 
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold" 
              onClick={() => setStep('payment')}
              disabled={!user}
            >
              <Zap className="w-4 h-4 mr-2" />
              Create Instant Raffle
            </Button>
          </div>
        )}

        {step === 'payment' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">Creation Fee</span>
                <div className="text-right">
                  <span className="font-mono text-lg font-bold text-purple-400">
                    {creationFeeXec.toLocaleString()} XEC
                  </span>
                  <div className="text-xs text-muted-foreground">~$1</div>
                </div>
              </div>
            </div>

            <div ref={payButtonRef} className="min-h-[52px] flex justify-center" />

            <Button variant="outline" className="w-full" onClick={() => setStep('form')}>
              Back
            </Button>
          </div>
        )}

        {step === 'creating' && (
          <div className="py-8 text-center">
            <Loader2 className="w-12 h-12 text-purple-400 animate-spin mx-auto mb-4" />
            <p className="text-foreground font-medium">Creating your instant raffle...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
