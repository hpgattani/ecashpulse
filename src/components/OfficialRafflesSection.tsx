import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, Ticket, Loader2, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { OfficialRaffleCard } from './OfficialRaffleCard';
import { GetTicketModal } from './GetTicketModal';

// Official events that don't require creation fee
export const OFFICIAL_EVENTS = [
  { 
    id: 'nfl_super_bowl', 
    name: 'NFL Super Bowl 2026', 
    category: 'sports', 
    teams: ['Kansas City Chiefs', 'San Francisco 49ers', 'Philadelphia Eagles', 'Buffalo Bills', 'Dallas Cowboys', 'Detroit Lions', 'Baltimore Ravens', 'Miami Dolphins', 'Cleveland Browns', 'Green Bay Packers', 'New York Jets', 'Los Angeles Rams', 'Cincinnati Bengals', 'Seattle Seahawks', 'Jacksonville Jaguars', 'Minnesota Vikings', 'Tampa Bay Buccaneers', 'Pittsburgh Steelers', 'Atlanta Falcons', 'Los Angeles Chargers', 'New Orleans Saints', 'Denver Broncos', 'Indianapolis Colts', 'Las Vegas Raiders', 'Tennessee Titans', 'Arizona Cardinals', 'Houston Texans', 'New York Giants', 'Washington Commanders', 'Carolina Panthers', 'Chicago Bears', 'New England Patriots'],
    entryCostUsd: 2,
    description: 'Pick a team to win Super Bowl 2026!'
  },
  { 
    id: 'mlb_world_series', 
    name: 'MLB World Series 2026', 
    category: 'sports', 
    teams: ['New York Yankees', 'Los Angeles Dodgers', 'Atlanta Braves', 'Houston Astros', 'Philadelphia Phillies', 'San Diego Padres', 'Seattle Mariners', 'Cleveland Guardians', 'Toronto Blue Jays', 'New York Mets', 'St. Louis Cardinals', 'Tampa Bay Rays', 'Baltimore Orioles', 'Minnesota Twins', 'Milwaukee Brewers', 'Arizona Diamondbacks', 'Chicago Cubs', 'Texas Rangers', 'Boston Red Sox', 'Detroit Tigers', 'Los Angeles Angels', 'San Francisco Giants', 'Chicago White Sox', 'Cincinnati Reds', 'Kansas City Royals', 'Colorado Rockies', 'Pittsburgh Pirates', 'Miami Marlins', 'Washington Nationals', 'Oakland Athletics'],
    entryCostUsd: 2,
    description: 'Pick a team to win World Series 2026!'
  },
  { 
    id: 't20_world_cup_2026', 
    name: 'T20 World Cup 2026', 
    category: 'sports', 
    teams: ['India', 'Australia', 'England', 'Pakistan', 'South Africa', 'New Zealand', 'West Indies', 'Sri Lanka', 'Bangladesh', 'Afghanistan', 'Ireland', 'Netherlands', 'Zimbabwe', 'Scotland', 'Nepal', 'USA', 'Canada', 'UAE', 'Oman', 'Namibia'],
    entryCostUsd: 2.50,
    description: 'Pick a team to win T20 World Cup 2026!'
  },
  { 
    id: 'the_voice_finale', 
    name: 'The Voice Season Finale', 
    category: 'entertainment', 
    teams: ['Contestant 1', 'Contestant 2', 'Contestant 3', 'Contestant 4', 'Contestant 5', 'Contestant 6', 'Contestant 7', 'Contestant 8', 'Contestant 9', 'Contestant 10'],
    entryCostUsd: 5,
    description: 'Pick who wins The Voice!'
  },
];

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
}

interface OfficialRafflesSectionProps {
  xecPrice: number;
  onRaffleCreated: () => void;
}

export function OfficialRafflesSection({ xecPrice, onRaffleCreated }: OfficialRafflesSectionProps) {
  const { user, sessionToken } = useAuth();
  const [officialRaffles, setOfficialRaffles] = useState<Raffle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<typeof OFFICIAL_EVENTS[0] | null>(null);
  const [selectedRaffle, setSelectedRaffle] = useState<Raffle | null>(null);

  const fetchOfficialRaffles = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-raffles', {
        body: { official_only: true },
      });

      if (error) throw error;
      const raffles = (data.raffles || []).filter((r: Raffle) => r.is_official);
      setOfficialRaffles(raffles);
    } catch (error) {
      console.error('Error fetching official raffles:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOfficialRaffles();
  }, []);

  // Find or create official raffle for an event
  const handleGetTicket = async (event: typeof OFFICIAL_EVENTS[0]) => {
    // Check if an official raffle already exists for this event
    const existingRaffle = officialRaffles.find(
      r => r.event_name === event.name && r.status === 'open'
    );

    if (existingRaffle) {
      setSelectedRaffle(existingRaffle);
    } else {
      // Will create new official raffle via the modal
      setSelectedEvent(event);
    }
  };

  // Check which events have active official raffles
  const getEventStatus = (eventId: string) => {
    const raffle = officialRaffles.find(
      r => r.event_name === OFFICIAL_EVENTS.find(e => e.id === eventId)?.name && r.status === 'open'
    );
    if (raffle) {
      return { hasRaffle: true, raffle };
    }
    return { hasRaffle: false, raffle: null };
  };

  return (
    <div className="space-y-6">
      {/* Official Events Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30">
          <Star className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold text-amber-400">Official Events</span>
        </div>
        <span className="text-sm text-muted-foreground">No creation fee • Just get your ticket!</span>
      </div>

      {/* Official Event Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {OFFICIAL_EVENTS.map((event) => {
          const { hasRaffle, raffle } = getEventStatus(event.id);
          const entryCostXec = Math.ceil(event.entryCostUsd / xecPrice);
          
          return (
            <div 
              key={event.id}
              className="glass-card p-4 space-y-3 border-2 border-amber-500/20 hover:border-amber-500/40 transition-colors relative overflow-hidden"
            >
              {/* Official Badge */}
              <div className="absolute -top-1 -right-1">
                <Badge className="bg-gradient-to-r from-amber-500 to-yellow-400 text-black text-xs font-bold rounded-tl-none rounded-br-none">
                  <Star className="w-3 h-3 mr-1" />
                  Official
                </Badge>
              </div>

              {/* Event Info */}
              <div className="pt-2">
                <div className="flex items-center gap-2 mb-1">
                  <span>{event.category === 'sports' ? '🏆' : '🎭'}</span>
                  <Badge variant="outline" className="text-xs">{event.teams.length} teams</Badge>
                </div>
                <h3 className="font-display font-semibold text-foreground text-sm">{event.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">{event.description}</p>
              </div>

              {/* Entry Cost */}
              <div className="bg-muted/30 rounded-lg p-2 text-center">
                <div className="text-xs text-muted-foreground">Entry Cost</div>
                <div className="font-mono font-semibold text-foreground">
                  {entryCostXec.toLocaleString()} XEC
                </div>
                <div className="text-xs text-muted-foreground">~${event.entryCostUsd}</div>
              </div>

              {/* Status & Action */}
              {hasRaffle && raffle ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{raffle.entries_count}/{raffle.total_spots} joined</span>
                    <span className="text-emerald-400 font-medium">{raffle.spots_remaining} spots left</span>
                  </div>
                  <Button 
                    className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black font-bold text-sm h-9"
                    onClick={() => setSelectedRaffle(raffle)}
                    disabled={!user}
                  >
                    <Ticket className="w-4 h-4 mr-2" />
                    Get Ticket
                  </Button>
                </div>
              ) : (
                <Button 
                  className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black font-bold text-sm h-9"
                  onClick={() => handleGetTicket(event)}
                  disabled={!user}
                >
                  <Ticket className="w-4 h-4 mr-2" />
                  Get Ticket
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {!user && (
        <p className="text-sm text-center text-muted-foreground">
          Connect your wallet to get tickets for official events
        </p>
      )}

      {/* Get Ticket Modal for existing raffle */}
      {selectedRaffle && (
        <GetTicketModal
          open={!!selectedRaffle}
          onOpenChange={(open) => !open && setSelectedRaffle(null)}
          raffle={selectedRaffle}
          xecPrice={xecPrice}
          onSuccess={() => {
            fetchOfficialRaffles();
            onRaffleCreated();
            setSelectedRaffle(null);
          }}
        />
      )}

      {/* Get Ticket Modal for new official raffle */}
      {selectedEvent && (
        <GetTicketModal
          open={!!selectedEvent}
          onOpenChange={(open) => !open && setSelectedEvent(null)}
          officialEvent={selectedEvent}
          xecPrice={xecPrice}
          onSuccess={() => {
            fetchOfficialRaffles();
            onRaffleCreated();
            setSelectedEvent(null);
          }}
        />
      )}
    </div>
  );
}
