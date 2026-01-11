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
      className="h-4 w-4 rounded-sm object-contain"
      referrerPolicy="no-referrer"
    />
  );
};

const SportsScoreBadge = ({ title, category }: SportsScoreBadgeProps) => {
  const score = useSportsScores(title, category);

  if (category !== 'sports' || !score) return null;

  const hasScores = score.homeScore !== null && score.awayScore !== null;
  const shortHome = score.homeTeam.split(' ').pop() || score.homeTeam;
  const shortAway = score.awayTeam.split(' ').pop() || score.awayTeam;

  return (
    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-muted/70 border border-border text-xs">
      <Trophy className="w-3.5 h-3.5 text-muted-foreground" />

      <div className="inline-flex items-center gap-1.5">
        <TeamLogo src={score.awayLogo} alt={`${score.awayTeam} logo`} />
        <span className="text-foreground font-medium">{shortAway}</span>
        <span className="text-foreground/80 tabular-nums">{hasScores ? score.awayScore : '-'}</span>
      </div>

      <span className="text-muted-foreground">vs</span>

      <div className="inline-flex items-center gap-1.5">
        <TeamLogo src={score.homeLogo} alt={`${score.homeTeam} logo`} />
        <span className="text-foreground font-medium">{shortHome}</span>
        <span className="text-foreground/80 tabular-nums">{hasScores ? score.homeScore : '-'}</span>
      </div>

      {score.status === 'final' && (
        <span className="text-[10px] text-muted-foreground uppercase">Final</span>
      )}
      {score.status === 'in_progress' && (
        <span className="text-[10px] text-muted-foreground uppercase">
          {score.period ? `Q${score.period}` : 'Live'}{score.clock ? ` • ${score.clock}` : ''}
        </span>
      )}
    </div>
  );
};

export default SportsScoreBadge;
