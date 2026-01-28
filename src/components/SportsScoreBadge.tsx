import { Trophy } from 'lucide-react';
import { useNflScoreFromTitle } from '@/hooks/useNflScore';
import { getKnownScore } from '@/hooks/useSportsScores';
import { useMemo } from 'react';

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
  const isSports = category?.toLowerCase().trim() === 'sports';
  
  // First check for known static scores (including non-NFL like Scottish Premiership)
  const knownScore = useMemo(() => {
    if (!isSports) return null;
    return getKnownScore(title);
  }, [isSports, title]);
  
  // Use NFL API hook for NFL games
  const nflScore = useNflScoreFromTitle(title, isSports && !knownScore);

  // Prefer known scores over API for static matches, then NFL API
  const score = useMemo(() => {
    if (knownScore) {
      return {
        team1: knownScore.homeTeam,
        team2: knownScore.awayTeam,
        team1Score: knownScore.homeScore,
        team2Score: knownScore.awayScore,
        team1Logo: knownScore.homeLogo,
        team2Logo: knownScore.awayLogo,
        status: knownScore.status,
        league: knownScore.league,
        period: null,
        clock: null,
      };
    }
    return nflScore;
  }, [knownScore, nflScore]);

  if (!isSports || !score) return null;

  const hasScores = score.team1Score !== null && score.team2Score !== null;
  const liveLabel =
    score.status === 'in_progress' && score.period && score.clock
      ? `Q${score.period} · ${score.clock}`
      : score.status === 'in_progress'
        ? 'Live'
        : null;

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/90 backdrop-blur-sm border border-border shadow-lg text-xs">
      <Trophy className="w-3.5 h-3.5 text-amber-500" />

      {/* Team 1 (title order) */}
      <div className="flex items-center gap-1.5">
        <TeamLogo src={score.team1Logo} alt={`${score.team1} logo`} />
        <span className="text-foreground font-medium">{score.team1}</span>
        <span className={`font-bold tabular-nums ${hasScores ? 'text-foreground' : 'text-muted-foreground'}`}>
          {hasScores ? score.team1Score : '-'}
        </span>
      </div>

      <span className="text-muted-foreground font-medium">vs</span>

      {/* Team 2 (title order) */}
      <div className="flex items-center gap-1.5">
        <span className={`font-bold tabular-nums ${hasScores ? 'text-foreground' : 'text-muted-foreground'}`}>
          {hasScores ? score.team2Score : '-'}
        </span>
        <span className="text-foreground font-medium">{score.team2}</span>
        <TeamLogo src={score.team2Logo} alt={`${score.team2} logo`} />
      </div>

      {/* Status */}
      {score.status === 'final' && (
        <span className="text-[10px] text-emerald-500 font-semibold uppercase tracking-wide">Final</span>
      )}
      {score.status === 'in_progress' && liveLabel && (
        <span className="text-[10px] text-orange-500 font-semibold uppercase tracking-wide">{liveLabel}</span>
      )}
      {score.status === 'scheduled' && (
        <span className="text-[10px] text-muted-foreground font-medium uppercase">Upcoming</span>
      )}
    </div>
  );
};

export default SportsScoreBadge;
