import { Trophy } from 'lucide-react';
import { useSportsScores } from '@/hooks/useSportsScores';

interface SportsScoreBadgeProps {
  title: string;
  category: string;
}

const SportsScoreBadge = ({ title, category }: SportsScoreBadgeProps) => {
  const score = useSportsScores(title, category);
  
  if (category !== 'sports' || !score) {
    return null;
  }

  const hasScores = score.homeScore !== null && score.awayScore !== null;

  if (!hasScores) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/80 border border-border text-xs">
        <Trophy className="w-3 h-3 text-muted-foreground" />
        <span className="text-muted-foreground">Pending</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-xs">
      <Trophy className="w-3 h-3 text-emerald-400" />
      <span className="text-foreground font-medium">{score.homeTeam}</span>
      <span className="text-emerald-400 font-bold">{score.homeScore}</span>
      <span className="text-muted-foreground">-</span>
      <span className="text-red-400 font-bold">{score.awayScore}</span>
      <span className="text-foreground font-medium">{score.awayTeam}</span>
      {score.status === 'final' && (
        <span className="text-[10px] text-emerald-400 font-medium uppercase">Final</span>
      )}
    </div>
  );
};

export default SportsScoreBadge;
