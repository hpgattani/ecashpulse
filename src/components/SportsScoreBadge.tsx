import { Trophy, Loader2 } from 'lucide-react';
import { useSportsScores } from '@/hooks/useSportsScores';

interface SportsScoreBadgeProps {
  title: string;
  category: string;
}

const SportsScoreBadge = ({ title, category }: SportsScoreBadgeProps) => {
  const score = useSportsScores(title, category);
  
  if (category !== 'sports') {
    return null;
  }

  if (!score) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/80 border border-border">
        <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
        <span className="text-xs text-muted-foreground">Loading...</span>
      </div>
    );
  }

  const hasScores = score.homeScore !== null && score.awayScore !== null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
      <Trophy className="w-3.5 h-3.5 text-emerald-400" />
      <div className="flex items-center gap-2 text-xs font-medium">
        {hasScores ? (
          <>
            <span className="text-foreground">{score.homeTeam.split(' ').pop()}</span>
            <span className="text-emerald-400 font-bold">{score.homeScore}</span>
            <span className="text-muted-foreground">-</span>
            <span className="text-red-400 font-bold">{score.awayScore}</span>
            <span className="text-foreground">{score.awayTeam.split(' ').pop()}</span>
          </>
        ) : (
          <span className="text-muted-foreground">Score pending</span>
        )}
        {score.status === 'final' && (
          <span className="text-[10px] text-muted-foreground uppercase ml-1">Final</span>
        )}
        {score.status === 'in_progress' && (
          <span className="text-[10px] text-orange-400 uppercase ml-1 animate-pulse">Live</span>
        )}
      </div>
    </div>
  );
};

export default SportsScoreBadge;
