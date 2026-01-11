import { Trophy } from 'lucide-react';
import { useSportsScores } from '@/hooks/useSportsScores';

interface SportsScoreBadgeProps {
  title: string;
  category: string;
}

const TeamLogo = ({ src, alt }: { src: string | null | undefined; alt: string }) => {
  if (!src) return null;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className="h-5 w-5 rounded-sm object-contain"
      referrerPolicy="no-referrer"
    />
  );
};

const SportsScoreBadge = ({ title, category }: SportsScoreBadgeProps) => {
  const score = useSportsScores(title, category);

  if (category !== 'sports' || !score) return null;

  const hasScores = score.homeScore !== null && score.awayScore !== null;

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/90 backdrop-blur-sm border border-border shadow-lg text-xs">
      <Trophy className="w-3.5 h-3.5 text-amber-500" />
      
      {/* Away Team */}
      <div className="flex items-center gap-1.5">
        <TeamLogo src={score.awayLogo} alt={`${score.awayTeam} logo`} />
        <span className="text-foreground font-medium">{score.awayTeam}</span>
        <span className={`font-bold tabular-nums ${hasScores ? 'text-foreground' : 'text-muted-foreground'}`}>
          {hasScores ? score.awayScore : '-'}
        </span>
      </div>

      <span className="text-muted-foreground font-medium">@</span>

      {/* Home Team */}
      <div className="flex items-center gap-1.5">
        <span className={`font-bold tabular-nums ${hasScores ? 'text-foreground' : 'text-muted-foreground'}`}>
          {hasScores ? score.homeScore : '-'}
        </span>
        <span className="text-foreground font-medium">{score.homeTeam}</span>
        <TeamLogo src={score.homeLogo} alt={`${score.homeTeam} logo`} />
      </div>

      {/* Status */}
      {score.status === 'final' && (
        <span className="text-[10px] text-emerald-500 font-semibold uppercase tracking-wide">Final</span>
      )}
      {score.status === 'in_progress' && (
        <span className="text-[10px] text-orange-500 font-semibold uppercase tracking-wide animate-pulse">Live</span>
      )}
      {score.status === 'scheduled' && (
        <span className="text-[10px] text-muted-foreground font-medium uppercase">Upcoming</span>
      )}
    </div>
  );
};

export default SportsScoreBadge;
