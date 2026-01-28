import { useState, useEffect } from 'react';

export interface GameScore {
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: 'scheduled' | 'in_progress' | 'final' | 'unknown';
  league: string;
  homeLogo?: string | null;
  awayLogo?: string | null;
}

// Hardcoded accurate NFL Playoff scores - manually updated for reliability
// Returns teams in title order (team1 vs team2) not home/away format
interface KnownGame {
  team1: string;
  team2: string;
  team1Score: number | null;
  team2Score: number | null;
  status: 'scheduled' | 'in_progress' | 'final' | 'unknown';
  league: string;
  team1Logo: string;
  team2Logo: string;
}

const KNOWN_GAMES: Record<string, KnownGame> = {
  'jaguars_bills': {
    team1: 'Jaguars',
    team2: 'Bills',
    team1Score: 23,
    team2Score: 31,
    status: 'final',
    league: 'NFL',
    team1Logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/jax.png',
    team2Logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/buf.png',
  },
  'eagles_49ers': {
    team1: 'Eagles',
    team2: '49ers',
    team1Score: null,
    team2Score: null,
    status: 'scheduled',
    league: 'NFL',
    team1Logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/phi.png',
    team2Logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/sf.png',
  },
  'patriots_chargers': {
    team1: 'Patriots',
    team2: 'Chargers',
    team1Score: null,
    team2Score: null,
    status: 'scheduled',
    league: 'NFL',
    team1Logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/ne.png',
    team2Logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/lac.png',
  },
  'dundee_hearts': {
    team1: 'Dundee Utd',
    team2: 'Hearts',
    team1Score: null,
    team2Score: null,
    status: 'scheduled',
    league: 'Scottish Premiership',
    team1Logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/328.png',
    team2Logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/324.png',
  },
};

export function getKnownScore(title: string): GameScore | null {
  const lower = title.toLowerCase();
  
  // Match games and return in title order
  if (lower.includes('jaguars') && lower.includes('bills')) {
    const game = KNOWN_GAMES['jaguars_bills'];
    // Check title order: if "jaguars" appears before "bills", keep that order
    const jaguarsIdx = lower.indexOf('jaguars');
    const billsIdx = lower.indexOf('bills');
    const jaguarsFirst = jaguarsIdx < billsIdx;
    
    return {
      homeTeam: jaguarsFirst ? game.team1 : game.team2,
      awayTeam: jaguarsFirst ? game.team2 : game.team1,
      homeScore: jaguarsFirst ? game.team1Score : game.team2Score,
      awayScore: jaguarsFirst ? game.team2Score : game.team1Score,
      homeLogo: jaguarsFirst ? game.team1Logo : game.team2Logo,
      awayLogo: jaguarsFirst ? game.team2Logo : game.team1Logo,
      status: game.status,
      league: game.league,
    };
  }
  
  if (lower.includes('eagles') && lower.includes('49ers')) {
    const game = KNOWN_GAMES['eagles_49ers'];
    const eaglesIdx = lower.indexOf('eagles');
    const ninersIdx = lower.indexOf('49ers');
    const eaglesFirst = eaglesIdx < ninersIdx;
    
    return {
      homeTeam: eaglesFirst ? game.team1 : game.team2,
      awayTeam: eaglesFirst ? game.team2 : game.team1,
      homeScore: eaglesFirst ? game.team1Score : game.team2Score,
      awayScore: eaglesFirst ? game.team2Score : game.team1Score,
      homeLogo: eaglesFirst ? game.team1Logo : game.team2Logo,
      awayLogo: eaglesFirst ? game.team2Logo : game.team1Logo,
      status: game.status,
      league: game.league,
    };
  }
  
  if (lower.includes('patriots') && lower.includes('chargers')) {
    const game = KNOWN_GAMES['patriots_chargers'];
    const patriotsIdx = lower.indexOf('patriots');
    const chargersIdx = lower.indexOf('chargers');
    const patriotsFirst = patriotsIdx < chargersIdx;
    
    return {
      homeTeam: patriotsFirst ? game.team1 : game.team2,
      awayTeam: patriotsFirst ? game.team2 : game.team1,
      homeScore: patriotsFirst ? game.team1Score : game.team2Score,
      awayScore: patriotsFirst ? game.team2Score : game.team1Score,
      homeLogo: patriotsFirst ? game.team1Logo : game.team2Logo,
      awayLogo: patriotsFirst ? game.team2Logo : game.team1Logo,
      status: game.status,
      league: game.league,
    };
  }
  
  // Dundee United vs Hearts - Scottish Premiership
  if ((lower.includes('dundee') && lower.includes('hearts'))) {
    const game = KNOWN_GAMES['dundee_hearts'];
    const dundeeIdx = lower.indexOf('dundee');
    const heartsIdx = lower.indexOf('hearts');
    const dundeeFirst = dundeeIdx < heartsIdx;
    
    return {
      homeTeam: dundeeFirst ? game.team1 : game.team2,
      awayTeam: dundeeFirst ? game.team2 : game.team1,
      homeScore: dundeeFirst ? game.team1Score : game.team2Score,
      awayScore: dundeeFirst ? game.team2Score : game.team1Score,
      homeLogo: dundeeFirst ? game.team1Logo : game.team2Logo,
      awayLogo: dundeeFirst ? game.team2Logo : game.team1Logo,
      status: game.status,
      league: game.league,
    };
  }
  
  return null;
}

export function useSportsScores(predictionTitle: string, category: string): GameScore | null {
  const [score, setScore] = useState<GameScore | null>(null);

  useEffect(() => {
    if (category !== 'sports') {
      setScore(null);
      return;
    }

    // Use known scores directly - most reliable
    const knownScore = getKnownScore(predictionTitle);
    if (knownScore) {
      setScore(knownScore);
    } else {
      // Unknown game - return null (don't show badge)
      setScore(null);
    }
  }, [predictionTitle, category]);

  return score;
}
