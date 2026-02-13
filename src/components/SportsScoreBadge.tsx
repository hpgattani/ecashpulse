import { useState } from 'react';
import { Trophy } from 'lucide-react';
import { useNflScoreFromTitle } from '@/hooks/useNflScore';
import { getKnownScore } from '@/hooks/useSportsScores';
import { useMemo } from 'react';
import { useCricketScore } from '@/hooks/useCricketScore';
import CricketScorecardModal from './CricketScorecardModal';

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
  const [scorecardOpen, setScorecardOpen] = useState(false);

  // Detect cricket match
  const isCricketMatch = useMemo(() => {
    if (!isSports) return false;
    const lower = title.toLowerCase();
    return lower.includes('scotland') && lower.includes('england') && 
           (lower.includes('cricket') || lower.includes('t20') || lower.includes('icc'));
  }, [isSports, title]);

  // Fetch live cricket score
  const { score: cricketScore } = useCricketScore(isCricketMatch);
  
  // First check for known static scores (including non-NFL like Scottish Premiership)
  const knownScore = useMemo(() => {
    if (!isSports) return null;
    return getKnownScore(title);
  }, [isSports, title]);
  
  // Use NFL API hook for NFL games
  const nflScore = useNflScoreFromTitle(title, isSports && !knownScore && !isCricketMatch);

  // Build unified score object
  const score = useMemo(() => {
    // If live cricket data is available, prefer it
    if (isCricketMatch && cricketScore) {
      return {
        team1: cricketScore.team1,
        team2: cricketScore.team2,
        team1Score: cricketScore.team1Score,
        team2Score: cricketScore.team2Score,
        team1Logo: knownScore?.homeLogo || null,
        team2Logo: knownScore?.awayLogo || null,
        status: cricketScore.status,
        league: 'ICC T20 World Cup',
        period: null,
        clock: null,
        isCricket: true,
      };
    }
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
        isCricket: isCricketMatch,
      };
    }
    return nflScore ? { ...nflScore, isCricket: false } : null;
  }, [knownScore, nflScore, cricketScore, isCricketMatch]);

  if (!isSports || !score) return null;

  const hasScores = score.team1Score !== null && score.team2Score !== null;
  const isCricket = score.isCricket;
  
  const liveLabel =
    score.status === 'in_progress' && score.period && score.clock
      ? `Q${score.period} · ${score.clock}`
      : score.status === 'in_progress'
        ? 'Live'
        : null;

  const handleClick = (e: React.MouseEvent) => {
    if (isCricket) {
      e.stopPropagation();
      e.preventDefault();
      setScorecardOpen(true);
    }
  };

  return (
    <>
      <div
        onClick={handleClick}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/90 backdrop-blur-sm border border-border shadow-lg text-xs ${
          isCricket ? 'cursor-pointer hover:bg-muted/60 active:scale-95 transition-all' : ''
        }`}
      >
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
        {score.status === 'in_progress' && (
          <span className="text-[10px] text-orange-500 font-semibold uppercase tracking-wide flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
            {liveLabel || 'Live'}
          </span>
        )}
        {score.status === 'scheduled' && (
          <span className="text-[10px] text-muted-foreground font-medium uppercase">Upcoming</span>
        )}

        {/* Tap hint for cricket */}
        {isCricket && (
          <span className="text-[9px] text-muted-foreground/60 ml-0.5">Tap</span>
        )}
      </div>

      {/* Cricket Scorecard Modal */}
      {isCricket && (
        <CricketScorecardModal
          open={scorecardOpen}
          onOpenChange={setScorecardOpen}
          matchId={cricketScore?.id || null}
          team1Score={typeof score.team1Score === 'string' ? score.team1Score : null}
          team2Score={typeof score.team2Score === 'string' ? score.team2Score : null}
          status={score.status}
          statusText={cricketScore?.statusText || ''}
          venue={cricketScore?.venue || ''}
        />
      )}
    </>
  );
};

export default SportsScoreBadge;
