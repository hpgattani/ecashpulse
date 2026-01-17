import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Ticket, Users, Trophy, Star, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface OfficialRaffle {
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

interface OfficialRaffleCardProps {
  raffle: OfficialRaffle;
  xecPrice: number;
  onJoin: () => void;
}

export function OfficialRaffleCard({ raffle, xecPrice, onJoin }: OfficialRaffleCardProps) {
  const entryCostUsd = (raffle.entry_cost * xecPrice).toFixed(2);
  const totalPotUsd = (raffle.total_pot * xecPrice).toFixed(2);
  const progressPercent = (raffle.entries_count / raffle.total_spots) * 100;

  const getStatusBadge = () => {
    switch (raffle.status) {
      case 'open':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Open</Badge>;
      case 'full':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Full</Badge>;
      case 'resolved':
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Resolved</Badge>;
      default:
        return <Badge variant="outline">{raffle.status}</Badge>;
    }
  };

  const getCategoryBadge = () => {
    if (raffle.event_type === 'sports') {
      return <Badge variant="outline" className="text-xs">🏆 Sports</Badge>;
    }
    return <Badge variant="outline" className="text-xs">🎭 Entertainment</Badge>;
  };

  return (
    <div className="glass-card p-5 space-y-4 hover:shadow-lg transition-shadow border-2 border-primary/30 relative overflow-hidden">
      {/* Official Badge */}
      <div className="absolute top-0 right-0">
        <div className="bg-gradient-to-r from-amber-500 to-yellow-400 text-black text-xs font-bold px-3 py-1 rounded-bl-lg flex items-center gap-1">
          <Star className="w-3 h-3" />
          Official
        </div>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-2 pt-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold text-foreground truncate">{raffle.title}</h3>
          <p className="text-sm text-muted-foreground truncate">{raffle.event_name}</p>
        </div>
        {getStatusBadge()}
      </div>

      {/* Category & Time */}
      <div className="flex items-center gap-2 flex-wrap">
        {getCategoryBadge()}
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {formatDistanceToNow(new Date(raffle.created_at), { addSuffix: true })}
        </span>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {raffle.entries_count}/{raffle.total_spots} spots
          </span>
          <span className="text-foreground font-medium">
            {raffle.spots_remaining} left
          </span>
        </div>
        <Progress value={progressPercent} className="h-2" />
      </div>

      {/* Pot & Entry Cost */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-muted/30 rounded-lg p-3 text-center">
          <div className="text-xs text-muted-foreground mb-1">Entry Cost</div>
          <div className="font-mono font-semibold text-foreground">
            {raffle.entry_cost.toLocaleString()} XEC
          </div>
          <div className="text-xs text-muted-foreground">~${entryCostUsd}</div>
        </div>
        <div className="bg-primary/10 rounded-lg p-3 text-center">
          <div className="text-xs text-muted-foreground mb-1">Prize Pool</div>
          <div className="font-mono font-semibold text-primary">
            {raffle.total_pot.toLocaleString()} XEC
          </div>
          <div className="text-xs text-muted-foreground">~${totalPotUsd}</div>
        </div>
      </div>

      {/* Winner display for resolved */}
      {raffle.status === 'resolved' && raffle.winner_team && (
        <div className="bg-gradient-to-r from-amber-500/20 to-yellow-500/20 rounded-lg p-3 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-400" />
          <div>
            <div className="text-xs text-muted-foreground">Winner</div>
            <div className="font-semibold text-foreground">{raffle.winner_team}</div>
          </div>
        </div>
      )}

      {/* Action Button */}
      {raffle.status === 'open' && raffle.spots_remaining > 0 && (
        <Button className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black font-bold" onClick={onJoin}>
          <Ticket className="w-4 h-4 mr-2" />
          Get Ticket - {raffle.entry_cost.toLocaleString()} XEC
        </Button>
      )}

      {raffle.status === 'full' && (
        <Button variant="outline" className="w-full" disabled>
          All Spots Filled
        </Button>
      )}

      {raffle.status === 'resolved' && (
        <Button variant="outline" className="w-full" disabled>
          <Trophy className="w-4 h-4 mr-2" />
          Completed
        </Button>
      )}
    </div>
  );
}
