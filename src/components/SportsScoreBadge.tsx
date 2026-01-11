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

  // homeTeam/awayTeam now represent first/second team in title order (not actual home/away)
  const firstTeam = score.homeTeam;
  const secondTeam = score.awayTeam;
  const firstScore = score.homeScore;
  const secondScore = score.awayScore;
  const firstLogo = score.homeLogo;
  const secondLogo = score.awayLogo;

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/90 backdrop-blur-sm border border-border shadow-lg text-xs">
      <Trophy className="w-3.5 h-3.5 text-amber-500" />
      
      {/* First Team (as appears in title) */}
      <div className="flex items-center gap-1.5">
        <TeamLogo src={firstLogo} alt={`${firstTeam} logo`} />
        <span className="text-foreground font-medium">{firstTeam}</span>
        <span className={`font-bold tabular-nums ${hasScores ? 'text-foreground' : 'text-muted-foreground'}`}>
          {hasScores ? firstScore : '-'}
        </span>
      </div>

      <span className="text-muted-foreground font-medium">vs</span>

      {/* Second Team (as appears in title) */}
      <div className="flex items-center gap-1.5">
        <span className={`font-bold tabular-nums ${hasScores ? 'text-foreground' : 'text-muted-foreground'}`}>
          {hasScores ? secondScore : '-'}
        </span>
        <span className="text-foreground font-medium">{secondTeam}</span>
        <TeamLogo src={secondLogo} alt={`${secondTeam} logo`} />
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
