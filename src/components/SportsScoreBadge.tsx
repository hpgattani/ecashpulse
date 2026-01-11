import { Trophy } from 'lucide-react';
import { getKnownScore } from '@/hooks/useSportsScores';

interface SportsScoreBadgeProps {
  title: string;
  category: string;
}

const SportsScoreBadge = ({ title, category }: SportsScoreBadgeProps) => {
  if (category !== 'sports') {
    return null;
  }

  const score = getKnownScore(title);
  
  if (!score) {
    return null;
  }

  const hasScores = score.homeScore !== null && score.awayScore !== null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
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
      </div>
    </div>
  );
};

export default SportsScoreBadge;
