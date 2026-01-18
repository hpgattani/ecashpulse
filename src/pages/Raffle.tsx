import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Ticket, Plus, Users, Trophy, Clock, Loader2, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCryptoPrices } from '@/hooks/useCryptoPrices';
import { CreateRaffleModal } from '@/components/CreateRaffleModal';
import { RaffleCard } from '@/components/RaffleCard';
import { JoinRaffleModal } from '@/components/JoinRaffleModal';
import { MyRaffleEntriesModal } from '@/components/MyRaffleEntriesModal';
import { OfficialRafflesSection, OFFICIAL_EVENTS } from '@/components/OfficialRafflesSection';
import { InstantRaffleSection } from '@/components/InstantRaffleSection';
import { LightModeOrbs } from '@/components/LightModeOrbs';
import { GetTicketModal } from '@/components/GetTicketModal';
import { JoinInstantRaffleModal } from '@/components/JoinInstantRaffleModal';

interface Raffle {
  id: string;
  title: string;
  description: string | null;
  event_name: string;
  event_type: string;
  teams: string[];
  entry_cost: number;
  total_pot: number;
  status: string;
  winner_team: string | null;
  created_at: string;
  starts_at: string | null;
  ends_at: string | null;
  entries_count: number;
  total_spots: number;
  spots_remaining: number;
  is_official?: boolean;
  is_instant?: boolean;
}

export default function Raffle() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, sessionToken } = useAuth();
  const { prices } = useCryptoPrices();
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedRaffle, setSelectedRaffle] = useState<Raffle | null>(null);
  const [myEntriesOpen, setMyEntriesOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'full' | 'resolved'>('all');
  
  // Deep-link state
  const [deepLinkOfficialEvent, setDeepLinkOfficialEvent] = useState<typeof OFFICIAL_EVENTS[0] | null>(null);
  const [deepLinkInstantRaffle, setDeepLinkInstantRaffle] = useState<Raffle | null>(null);

  const xecPrice = prices.ecash || 0.0001;
  const creationFeeXec = Math.ceil(1 / xecPrice);

  const fetchRaffles = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-raffles', {
        body: {},
      });

      if (error) throw error;
      setRaffles(data.raffles || []);
      return data.raffles || [];
    } catch (error) {
      console.error('Error fetching raffles:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRaffles();
  }, []);

  // Handle deep-link query params
  useEffect(() => {
    const officialId = searchParams.get('official');
    const instantId = searchParams.get('instant');
    const customId = searchParams.get('custom');

    if (officialId) {
      const event = OFFICIAL_EVENTS.find(e => e.id === officialId);
      if (event) {
        setDeepLinkOfficialEvent(event);
        // Clear query param
        setSearchParams({}, { replace: true });
      }
    }

    if (instantId && raffles.length > 0) {
      const instantRaffle = raffles.find(r => r.id === instantId && r.is_instant);
      if (instantRaffle) {
        setDeepLinkInstantRaffle(instantRaffle);
        setSearchParams({}, { replace: true });
      }
    }

    if (customId && raffles.length > 0) {
      const customRaffle = raffles.find(r => r.id === customId && !r.is_official && !r.is_instant);
      if (customRaffle) {
        setSelectedRaffle(customRaffle);
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, raffles]);

  // Real-time updates
  useEffect(() => {
    const channel = supabase
      .channel('raffles-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'raffles' }, () => {
        setTimeout(fetchRaffles, 500);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'raffle_entries' }, () => {
        setTimeout(fetchRaffles, 500);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Filter out official and instant raffles for the community section
  const communityRaffles = raffles.filter(r => !r.is_official && !r.is_instant);
  
  const filteredRaffles = communityRaffles.filter(r => {
    if (filter === 'all') return true;
    return r.status === filter;
  });

  const openRaffles = communityRaffles.filter(r => r.status === 'open').length;
  const fullRaffles = communityRaffles.filter(r => r.status === 'full').length;
  const resolvedRaffles = communityRaffles.filter(r => r.status === 'resolved').length;

  return (
    <div className="min-h-screen">
      <LightModeOrbs />
      <Header />
      
      <main className="container mx-auto px-4 py-8 relative z-10">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <Ticket className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary font-medium">Raffle Maker</span>
          </div>
          
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">
            Create & Join Raffles
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-8">
            Pick an event, get a random team assignment. When your team wins, you take the entire pot! 
            Only you can see your team until the event concludes.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            {user && (
              <Button
                variant="outline"
                onClick={() => setMyEntriesOpen(true)}
                className="border-primary/30"
              >
                <Ticket className="w-4 h-4 mr-2" />
                My Entries
              </Button>
            )}
          </div>
          
          {!user && (
            <p className="text-sm text-muted-foreground mt-4">
              Connect your wallet to get tickets or create custom raffles
            </p>
          )}
        </div>

        {/* Official Events Section */}
        <div className="mb-12">
          <OfficialRafflesSection xecPrice={xecPrice} onRaffleCreated={fetchRaffles} />
        </div>

        {/* "Can't Wait for a Game" - Instant Raffles Section */}
        <div className="mb-12">
          <InstantRaffleSection xecPrice={xecPrice} onRaffleCreated={fetchRaffles} />
        </div>

        {/* Divider */}
        <div className="relative my-12">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border/50"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="px-4 bg-background text-muted-foreground text-sm">Community Custom Raffles</span>
          </div>
        </div>

        {/* Create Custom Raffle Button */}
        <div className="flex justify-center mb-8">
          <Button
            onClick={() => setCreateOpen(true)}
            className="liquid-glass-button"
            disabled={!user}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Custom Raffle (~$1 / {creationFeeXec.toLocaleString()} XEC)
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto mb-8">
          <div className="glass-card p-4 text-center">
            <div className="text-2xl font-bold text-foreground">{openRaffles}</div>
            <div className="text-xs text-muted-foreground">Open</div>
          </div>
          <div className="glass-card p-4 text-center">
            <div className="text-2xl font-bold text-foreground">{fullRaffles}</div>
            <div className="text-xs text-muted-foreground">Full</div>
          </div>
          <div className="glass-card p-4 text-center">
            <div className="text-2xl font-bold text-foreground">{resolvedRaffles}</div>
            <div className="text-xs text-muted-foreground">Resolved</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex justify-center gap-2 mb-8 flex-wrap">
          {(['all', 'open', 'full', 'resolved'] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f)}
              className={filter === f ? '' : 'bg-muted/60'}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </Button>
          ))}
        </div>

        {/* Raffles Grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredRaffles.length === 0 ? (
          <div className="text-center py-12">
            <Ticket className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No community raffles found</p>
            {user && (
              <Button
                onClick={() => setCreateOpen(true)}
                className="mt-4"
                variant="outline"
              >
                Create the first custom raffle
              </Button>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRaffles.map((raffle) => (
              <RaffleCard
                key={raffle.id}
                raffle={raffle}
                xecPrice={xecPrice}
                onJoin={() => setSelectedRaffle(raffle)}
              />
            ))}
          </div>
        )}
      </main>

      <Footer />

      <CreateRaffleModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => {
          fetchRaffles();
          setCreateOpen(false);
        }}
      />

      {selectedRaffle && (
        <JoinRaffleModal
          open={!!selectedRaffle}
          onOpenChange={(open) => !open && setSelectedRaffle(null)}
          raffle={selectedRaffle}
          xecPrice={xecPrice}
          onSuccess={() => {
            fetchRaffles();
            setSelectedRaffle(null);
          }}
        />
      )}

      <MyRaffleEntriesModal
        open={myEntriesOpen}
        onOpenChange={setMyEntriesOpen}
      />

      {/* Deep-link modals */}
      {deepLinkOfficialEvent && (
        <GetTicketModal
          open={!!deepLinkOfficialEvent}
          onOpenChange={(open) => !open && setDeepLinkOfficialEvent(null)}
          officialEvent={deepLinkOfficialEvent}
          xecPrice={xecPrice}
          onSuccess={() => {
            fetchRaffles();
            setDeepLinkOfficialEvent(null);
          }}
        />
      )}

      {deepLinkInstantRaffle && (
        <JoinInstantRaffleModal
          open={!!deepLinkInstantRaffle}
          onOpenChange={(open) => !open && setDeepLinkInstantRaffle(null)}
          raffle={deepLinkInstantRaffle}
          xecPrice={xecPrice}
          onSuccess={() => {
            fetchRaffles();
            setDeepLinkInstantRaffle(null);
          }}
        />
      )}
    </div>
  );
}
