import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Zap, Users, Trophy, Clock, Ticket, CheckCircle, Share2 } from 'lucide-react';
import CountdownTimer from './CountdownTimer';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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
}

interface InstantRaffleCardProps {
  raffle: InstantRaffle;
  xecPrice: number;
  onJoin: () => void;
  resolved?: boolean;
}

export function InstantRaffleCard({ raffle, xecPrice, onJoin, resolved }: InstantRaffleCardProps) {
  const { user } = useAuth();
  const entryCostUsd = (raffle.entry_cost * xecPrice).toFixed(2);
  const potUsd = (raffle.total_pot * xecPrice).toFixed(2);
  const isFull = raffle.spots_remaining === 0;

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/raffle?instant=${raffle.id}`;
    const shareText = `🎲 Join my instant raffle: "${raffle.title}" - Pot: ${raffle.total_pot.toLocaleString()} XEC (~$${potUsd})`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: raffle.title,
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
          toast.success('Link copied to clipboard!');
        }
      }
    } else {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      toast.success('Link copied to clipboard!');
    }
  };

  return (
    <div className={`glass-card p-4 space-y-3 border-2 transition-colors relative overflow-hidden ${
      resolved 
        ? 'border-emerald-500/30 opacity-80' 
        : 'border-purple-500/20 hover:border-purple-500/40'
    }`}>
      {/* Instant Badge */}
      <div className="absolute -top-1 -right-1">
        <Badge className={`text-xs font-bold rounded-tl-none rounded-br-none ${
          resolved 
            ? 'bg-emerald-500 text-white'
            : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
        }`}>
          {resolved ? (
            <>
              <CheckCircle className="w-3 h-3 mr-1" />
              Resolved
            </>
          ) : (
            <>
              <Zap className="w-3 h-3 mr-1" />
              Instant
            </>
          )}
        </Badge>
      </div>

      {/* Title & Share */}
      <div className="pt-2 flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold text-foreground text-sm pr-8 line-clamp-2">
            {raffle.title}
          </h3>
          {raffle.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{raffle.description}</p>
          )}
        </div>
        {!resolved && (
          <button
            onClick={handleShare}
            className="p-1.5 rounded-full hover:bg-muted/50 transition-colors shrink-0"
            aria-label="Share raffle"
          >
            <Share2 className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors" />
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 text-xs">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Users className="w-3.5 h-3.5" />
          <span>{raffle.entries_count}/{raffle.total_spots}</span>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <Trophy className="w-3.5 h-3.5" />
          <span className="font-mono">{raffle.total_pot.toLocaleString()} XEC</span>
        </div>
      </div>

      {/* Timer or Winner */}
      {resolved ? (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Winner</p>
          <p className="font-display font-bold text-emerald-400">{raffle.winner_team}</p>
          <p className="text-xs text-muted-foreground mt-1">Pot: ${potUsd}</p>
        </div>
      ) : raffle.ends_at ? (
        <div className="bg-muted/30 rounded-lg p-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Ends in
            </span>
            <CountdownTimer endDate={raffle.ends_at} />
          </div>
        </div>
      ) : null}

      {/* Entry Cost & Action */}
      {!resolved && (
        <>
          <div className="flex justify-between items-center text-xs bg-muted/20 rounded-lg p-2">
            <span className="text-muted-foreground">Entry</span>
            <span className="font-mono font-semibold text-purple-400">
              {raffle.entry_cost.toLocaleString()} XEC (~${entryCostUsd})
            </span>
          </div>

          <Button 
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold text-sm h-9"
            onClick={onJoin}
            disabled={!user || isFull}
          >
            {isFull ? (
              'Full - Waiting for Roll'
            ) : (
              <>
                <Ticket className="w-4 h-4 mr-2" />
                Join Raffle
              </>
            )}
          </Button>

          {isFull && (
            <p className="text-xs text-center text-purple-400">
              All spots taken! Winner will be picked when deadline passes
            </p>
          )}
        </>
      )}
    </div>
  );
}
