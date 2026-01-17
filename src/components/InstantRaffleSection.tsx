import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Zap, Ticket, Timer, Users, Trophy, Loader2, Dices } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { InstantRaffleCard } from './InstantRaffleCard';
import { CreateInstantRaffleModal } from './CreateInstantRaffleModal';
import { JoinInstantRaffleModal } from './JoinInstantRaffleModal';

// Fictional team names for instant raffles
export const FICTIONAL_TEAMS = [
  'Phoenix Rising', 'Thunder Wolves', 'Crystal Dragons', 'Shadow Hawks',
  'Golden Lions', 'Arctic Foxes', 'Storm Eagles', 'Crimson Knights',
  'Emerald Titans', 'Silver Serpents', 'Blazing Comets', 'Lunar Owls',
  'Iron Bears', 'Mystic Ravens', 'Neon Tigers', 'Cosmic Falcons'
];

interface InstantRaffle {
  id: string;
  title: string;
  description: string | null;
  teams: string[];
  entry_cost: number;
  total_pot: number;
  status: string;
  winner_team: string | null;
  created_at: string;
  ends_at: string | null;
  entries_count: number;
  total_spots: number;
  spots_remaining: number;
  is_instant?: boolean;
}

interface InstantRaffleSectionProps {
  xecPrice: number;
  onRaffleCreated: () => void;
}

export function InstantRaffleSection({ xecPrice, onRaffleCreated }: InstantRaffleSectionProps) {
  const { user } = useAuth();
  const [instantRaffles, setInstantRaffles] = useState<InstantRaffle[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedRaffle, setSelectedRaffle] = useState<InstantRaffle | null>(null);

  const entryCostXec = Math.ceil(1 / xecPrice);

  const fetchInstantRaffles = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-raffles', {
        body: { instant_only: true },
      });

      if (error) throw error;
      const raffles = (data.raffles || []).filter((r: InstantRaffle) => r.is_instant);
      setInstantRaffles(raffles);
    } catch (error) {
      console.error('Error fetching instant raffles:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstantRaffles();
  }, []);

  // Subscribe to real-time updates
  useEffect(() => {
    const channel = supabase
      .channel('instant-raffles')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'raffles' },
        () => {
          setTimeout(fetchInstantRaffles, 500);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'raffle_entries' },
        () => {
          setTimeout(fetchInstantRaffles, 500);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const openRaffles = instantRaffles.filter(r => r.status === 'open');
  const resolvedRaffles = instantRaffles.filter(r => r.status === 'resolved');

  return (
    <div className="space-y-6">
      {/* Instant Raffles Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30">
            <Zap className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-semibold text-purple-400">Can't Wait for a Game?</span>
          </div>
          <span className="text-sm text-muted-foreground hidden sm:inline">FREE to create • $1 entry • Random fictional teams • Auto-picks winner!</span>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-gradient-to-r from-purple-500/5 to-pink-500/5 border border-purple-500/20 rounded-xl p-4">
        <h4 className="font-medium text-foreground text-sm mb-3 flex items-center gap-2">
          <Dices className="w-4 h-4 text-purple-400" />
          How It Works - No Real Games Required!
        </h4>
        <div className="grid sm:grid-cols-3 gap-3 text-xs">
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-purple-400 text-[10px] font-bold">1</span>
            </div>
            <div>
              <p className="font-medium text-foreground">Pay $1 Entry</p>
              <p className="text-muted-foreground">Get a random fictional team (others can see which teams are taken)</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-purple-400 text-[10px] font-bold">2</span>
            </div>
            <div>
              <p className="font-medium text-foreground">Wait for Deadline</p>
              <p className="text-muted-foreground">Others can join until deadline or all spots fill</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-purple-400 text-[10px] font-bold">3</span>
            </div>
            <div>
              <p className="font-medium text-foreground">Auto-Roll Winner</p>
              <p className="text-muted-foreground">System randomly picks a winning team - winner takes pot!</p>
            </div>
          </div>
        </div>
      </div>

      {/* Active Instant Raffles */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
        </div>
      ) : openRaffles.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-purple-500/20 rounded-xl">
          <Zap className="w-10 h-10 mx-auto text-purple-400/40 mb-3" />
          <p className="text-muted-foreground text-sm">No active instant raffles yet</p>
          <p className="text-xs text-muted-foreground mt-1">Create one below - it's FREE!</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {openRaffles.map((raffle) => (
            <InstantRaffleCard
              key={raffle.id}
              raffle={raffle}
              xecPrice={xecPrice}
              onJoin={() => setSelectedRaffle(raffle)}
            />
          ))}
        </div>
      )}

      {/* Recently Resolved */}
      {resolvedRaffles.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            Recently Resolved
          </h4>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {resolvedRaffles.slice(0, 3).map((raffle) => (
              <InstantRaffleCard
                key={raffle.id}
                raffle={raffle}
                xecPrice={xecPrice}
                onJoin={() => {}}
                resolved
              />
            ))}
          </div>
        </div>
      )}

      {/* Create Instant Raffle Button at bottom */}
      <div className="flex justify-center pt-4">
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold"
          disabled={!user}
        >
          <Dices className="w-4 h-4 mr-2" />
          Create Instant Raffle (FREE)
        </Button>
      </div>

      {!user && (
        <p className="text-sm text-center text-muted-foreground">
          Connect your wallet to create or join instant raffles
        </p>
      )}

      {/* Modals */}
      <CreateInstantRaffleModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        xecPrice={xecPrice}
        onSuccess={() => {
          fetchInstantRaffles();
          onRaffleCreated();
          setCreateOpen(false);
        }}
      />

      {selectedRaffle && (
        <JoinInstantRaffleModal
          open={!!selectedRaffle}
          onOpenChange={(open) => !open && setSelectedRaffle(null)}
          raffle={selectedRaffle}
          xecPrice={xecPrice}
          onSuccess={() => {
            fetchInstantRaffles();
            onRaffleCreated();
            setSelectedRaffle(null);
          }}
        />
      )}
    </div>
  );
}
