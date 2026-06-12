import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, Ticket, Loader2, ChevronRight, Share2, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { OfficialRaffleCard } from './OfficialRaffleCard';
import { GetTicketModal } from './GetTicketModal';
import { toast } from 'sonner';

// Country flag emojis for The Voice editions
const VOICE_COUNTRIES = {
  'the_voice_us': { flag: '🇺🇸', name: 'The Voice USA' },
  'the_voice_uk': { flag: '🇬🇧', name: 'The Voice UK' },
  'the_voice_australia': { flag: '🇦🇺', name: 'The Voice Australia' },
  'the_voice_germany': { flag: '🇩🇪', name: 'The Voice Germany' },
  'the_voice_france': { flag: '🇫🇷', name: 'The Voice France' },
  'the_voice_india': { flag: '🇮🇳', name: 'The Voice India' },
};

type OfficialEvent = {
  id: string;
  name: string;
  category: string;
  teams: string[];
  description: string;
  flag: string;
  entryCostUsd?: number;
  entryCostXec?: number;
  teamsPerEntry?: number;
};

// Official events that don't require creation fee
export const OFFICIAL_EVENTS: OfficialEvent[] = [
  {
    id: 'fifa_world_cup_2026',
    name: 'FIFA World Cup 2026',
    category: 'sports',
    teams: ['United States', 'Canada', 'Mexico', 'Japan', 'South Korea', 'Iran', 'Saudi Arabia', 'Jordan', 'Uzbekistan', 'Iraq', 'Qatar', 'South Africa', 'Morocco', 'Egypt', 'Tunisia', 'Algeria', 'Ghana', 'Senegal', 'Ivory Coast', 'Cape Verde', 'Congo DR', 'Panama', 'Curaçao', 'Haiti', 'Argentina', 'Brazil', 'Uruguay', 'Colombia', 'Ecuador', 'Paraguay', 'New Zealand', 'England', 'France', 'Spain', 'Germany', 'Portugal', 'Netherlands', 'Belgium', 'Croatia', 'Switzerland', 'Austria', 'Norway', 'Scotland', 'Sweden', 'Türkiye', 'Bosnia and Herzegovina', 'Czechia', 'Bolivia'],
    entryCostXec: 50000,
    teamsPerEntry: 2,
    description: 'Get a ticket — you receive 2 random teams. Win it all if either lifts the trophy!',
    flag: '🏆',
  },
  {
    id: 'nfl_super_bowl',
    name: 'NFL Super Bowl 2026',
    category: 'sports',
    teams: ['Kansas City Chiefs', 'San Francisco 49ers', 'Philadelphia Eagles', 'Buffalo Bills', 'Dallas Cowboys', 'Detroit Lions', 'Baltimore Ravens', 'Miami Dolphins', 'Cleveland Browns', 'Green Bay Packers', 'New York Jets', 'Los Angeles Rams', 'Cincinnati Bengals', 'Seattle Seahawks', 'Jacksonville Jaguars', 'Minnesota Vikings', 'Tampa Bay Buccaneers', 'Pittsburgh Steelers', 'Atlanta Falcons', 'Los Angeles Chargers', 'New Orleans Saints', 'Denver Broncos', 'Indianapolis Colts', 'Las Vegas Raiders', 'Tennessee Titans', 'Arizona Cardinals', 'Houston Texans', 'New York Giants', 'Washington Commanders', 'Carolina Panthers', 'Chicago Bears', 'New England Patriots'],
    entryCostUsd: 2,
    description: 'Pick a team to win Super Bowl 2026!',
    flag: '🏈',
  },
  {
    id: 'mlb_world_series',
    name: 'MLB World Series 2026',
    category: 'sports',
    teams: ['New York Yankees', 'Los Angeles Dodgers', 'Atlanta Braves', 'Houston Astros', 'Philadelphia Phillies', 'San Diego Padres', 'Seattle Mariners', 'Cleveland Guardians', 'Toronto Blue Jays', 'New York Mets', 'St. Louis Cardinals', 'Tampa Bay Rays', 'Baltimore Orioles', 'Minnesota Twins', 'Milwaukee Brewers', 'Arizona Diamondbacks', 'Chicago Cubs', 'Texas Rangers', 'Boston Red Sox', 'Detroit Tigers', 'Los Angeles Angels', 'San Francisco Giants', 'Chicago White Sox', 'Cincinnati Reds', 'Kansas City Royals', 'Colorado Rockies', 'Pittsburgh Pirates', 'Miami Marlins', 'Washington Nationals', 'Oakland Athletics'],
    entryCostUsd: 2,
    description: 'Pick a team to win World Series 2026!',
    flag: '⚾',
  },
  {
    id: 't20_world_cup_2026',
    name: 'T20 World Cup 2026',
    category: 'sports',
    teams: ['India', 'Australia', 'England', 'Pakistan', 'South Africa', 'New Zealand', 'West Indies', 'Sri Lanka', 'Afghanistan', 'Ireland', 'Netherlands', 'Zimbabwe', 'Scotland', 'Nepal', 'USA', 'Canada', 'UAE', 'Oman', 'Namibia', 'Italy'],
    entryCostUsd: 2.50,
    description: 'Pick a team to win T20 World Cup 2026!',
    flag: '🏏',
  },
  {
    id: 'the_voice_us',
    name: 'The Voice USA',
    category: 'entertainment',
    teams: ['Contestant 1', 'Contestant 2', 'Contestant 3', 'Contestant 4', 'Contestant 5', 'Contestant 6', 'Contestant 7', 'Contestant 8', 'Contestant 9', 'Contestant 10'],
    entryCostUsd: 5,
    description: 'Pick who wins The Voice USA!',
    flag: '🇺🇸',
  },
  {
    id: 'the_voice_uk',
    name: 'The Voice UK',
    category: 'entertainment',
    teams: ['Contestant 1', 'Contestant 2', 'Contestant 3', 'Contestant 4', 'Contestant 5', 'Contestant 6', 'Contestant 7', 'Contestant 8', 'Contestant 9', 'Contestant 10'],
    entryCostUsd: 5,
    description: 'Pick who wins The Voice UK!',
    flag: '🇬🇧',
  },
  {
    id: 'the_voice_australia',
    name: 'The Voice Australia',
    category: 'entertainment',
    teams: ['Contestant 1', 'Contestant 2', 'Contestant 3', 'Contestant 4', 'Contestant 5', 'Contestant 6', 'Contestant 7', 'Contestant 8', 'Contestant 9', 'Contestant 10'],
    entryCostUsd: 5,
    description: 'Pick who wins The Voice Australia!',
    flag: '🇦🇺',
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
  const [viewParticipantsRaffle, setViewParticipantsRaffle] = useState<Raffle | null>(null);

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

  // Check which events have active official raffles. Prefer an open raffle;
  // otherwise surface the most recent full/resolved raffle so users can view
  // participants instead of triggering creation of a duplicate raffle.
  const getEventStatus = (eventId: string) => {
    const eventName = OFFICIAL_EVENTS.find(e => e.id === eventId)?.name;
    if (!eventName) return { hasRaffle: false, raffle: null, soldOutRaffle: null };

    const matching = officialRaffles.filter(r => r.event_name === eventName);
    const openRaffle = matching.find(r => r.status === 'open') || null;
    const soldOutRaffle =
      matching.find(r => r.status === 'full' || r.status === 'resolved') || null;

    if (openRaffle) return { hasRaffle: true, raffle: openRaffle, soldOutRaffle };
    return { hasRaffle: false, raffle: null, soldOutRaffle };
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
          const { hasRaffle, raffle, soldOutRaffle } = getEventStatus(event.id);
          const entryCostXec = event.entryCostXec
            ? event.entryCostXec
            : event.entryCostUsd
              ? Math.ceil(event.entryCostUsd / xecPrice)
              : 0;
          const entryCostUsdDisplay = event.entryCostUsd
            ? event.entryCostUsd.toFixed(2)
            : (entryCostXec * xecPrice).toFixed(2);
          
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
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg">{event.flag}</span>
                    <Badge variant="outline" className="text-xs">{event.teams.length} teams</Badge>
                    {event.teamsPerEntry && event.teamsPerEntry > 1 && (
                      <Badge variant="outline" className="text-xs border-emerald-500/40 text-emerald-400">
                        {event.teamsPerEntry} per ticket
                      </Badge>
                    )}
                  </div>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const shareUrl = `${window.location.origin}/raffle?official=${event.id}`;
                      const costLabel = event.entryCostXec
                        ? `${event.entryCostXec.toLocaleString()} XEC`
                        : `$${event.entryCostUsd}`;
                      const shareText = `🎟️ ${event.name} - Pick your team & win the pot! Entry: ${costLabel}`;
                      try {
                        if (navigator.share) {
                          await navigator.share({ title: event.name, text: shareText, url: shareUrl });
                        } else {
                          await navigator.clipboard.writeText(shareUrl);
                          toast.success('Link copied to clipboard!');
                        }
                      } catch (err) {
                        if ((err as Error).name !== 'AbortError') {
                          await navigator.clipboard.writeText(shareUrl);
                          toast.success('Link copied to clipboard!');
                        }
                      }
                    }}
                    className="p-1.5 rounded-full hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
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
                <div className="text-xs text-muted-foreground">~${entryCostUsdDisplay}</div>
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
              ) : soldOutRaffle ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      {soldOutRaffle.entries_count}/{soldOutRaffle.total_spots} joined
                    </span>
                    <span className="text-amber-400 font-medium">
                      {soldOutRaffle.status === 'resolved' ? 'Resolved' : 'Sold Out'}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full border-amber-500/40 text-amber-300 hover:bg-amber-500/10 text-sm h-9"
                    onClick={() => setViewParticipantsRaffle(soldOutRaffle)}
                  >
                    <Users className="w-4 h-4 mr-2" />
                    View Participants
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
