import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Zap, Loader2, Dices, Clock, Users, Gift } from 'lucide-react';
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

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('6');
  const [teamCount, setTeamCount] = useState('8');
  const [creating, setCreating] = useState(false);

  const entryCostXec = Math.ceil(1 / xecPrice);

  // Get random subset of fictional teams
  const getRandomTeams = (count: number) => {
    const shuffled = [...FICTIONAL_TEAMS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  };

  const handleCreate = useCallback(async () => {
    if (!user || !sessionToken) return;

    setCreating(true);

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
          is_instant: true,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Instant Raffle Created!', {
          description: `Winner will be auto-picked in ${duration} hours`,
        });
        onSuccess();
        handleClose();
      } else {
        throw new Error(data.error || 'Failed to create raffle');
      }
    } catch (error: any) {
      console.error('Error creating instant raffle:', error);
      toast.error(error.message || 'Failed to create raffle');
    } finally {
      setCreating(false);
    }
  }, [user, sessionToken, title, description, teamCount, duration, entryCostXec, onSuccess]);

  const handleClose = () => {
    setCreating(false);
    setTitle('');
    setDescription('');
    setDuration('6');
    setTeamCount('8');
    onOpenChange(false);
  };

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

        <div className="space-y-4">
          {/* FREE Badge */}
          <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-lg p-3 flex items-center gap-2">
            <Gift className="w-5 h-5 text-green-400" />
            <div>
              <p className="text-sm font-semibold text-green-400">FREE to Create!</p>
              <p className="text-xs text-muted-foreground">No creation fee for instant raffles</p>
            </div>
          </div>

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
              <span className="text-muted-foreground">Entry Cost (per player)</span>
              <span className="font-mono font-semibold text-purple-400">
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
              Random fictional teams will be assigned. Others can see which teams are taken.
              At the deadline, the system automatically picks a winning team at random. Winner takes the pot minus 1% fee!
            </p>
          </div>

          <Button 
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold" 
            onClick={handleCreate}
            disabled={!user || creating}
          >
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Create Instant Raffle (FREE)
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
