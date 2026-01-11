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
const KNOWN_SCORES: Record<string, GameScore> = {
  'jaguars_bills': {
    homeTeam: 'Bills',
    awayTeam: 'Jaguars',
    homeScore: 31,
    awayScore: 23,
    status: 'final',
    league: 'NFL',
    homeLogo: 'https://a.espncdn.com/i/teamlogos/nfl/500/buf.png',
    awayLogo: 'https://a.espncdn.com/i/teamlogos/nfl/500/jax.png',
  },
  'eagles_49ers': {
    homeTeam: 'Eagles',
    awayTeam: '49ers',
    homeScore: null,
    awayScore: null,
    status: 'scheduled',
    league: 'NFL',
    homeLogo: 'https://a.espncdn.com/i/teamlogos/nfl/500/phi.png',
    awayLogo: 'https://a.espncdn.com/i/teamlogos/nfl/500/sf.png',
  },
  'rams_panthers': {
    homeTeam: 'Rams',
    awayTeam: 'Panthers',
    homeScore: null,
    awayScore: null,
    status: 'scheduled',
    league: 'NFL',
    homeLogo: 'https://a.espncdn.com/i/teamlogos/nfl/500/lar.png',
    awayLogo: 'https://a.espncdn.com/i/teamlogos/nfl/500/car.png',
  },
  'patriots_chargers': {
    homeTeam: 'Patriots',
    awayTeam: 'Chargers',
    homeScore: null,
    awayScore: null,
    status: 'scheduled',
    league: 'NFL',
    homeLogo: 'https://a.espncdn.com/i/teamlogos/nfl/500/ne.png',
    awayLogo: 'https://a.espncdn.com/i/teamlogos/nfl/500/lac.png',
  },
  'packers_bears': {
    homeTeam: 'Packers',
    awayTeam: 'Bears',
    homeScore: null,
    awayScore: null,
    status: 'scheduled',
    league: 'NFL',
    homeLogo: 'https://a.espncdn.com/i/teamlogos/nfl/500/gb.png',
    awayLogo: 'https://a.espncdn.com/i/teamlogos/nfl/500/chi.png',
  },
};

export function getKnownScore(title: string): GameScore | null {
  const lower = title.toLowerCase();
  
  if (lower.includes('jaguars') && lower.includes('bills')) {
    return KNOWN_SCORES['jaguars_bills'];
  }
  if (lower.includes('eagles') && lower.includes('49ers')) {
    return KNOWN_SCORES['eagles_49ers'];
  }
  if (lower.includes('rams') && lower.includes('panthers')) {
    return KNOWN_SCORES['rams_panthers'];
  }
  if (lower.includes('patriots') && lower.includes('chargers')) {
    return KNOWN_SCORES['patriots_chargers'];
  }
  if (lower.includes('packers') && lower.includes('bears')) {
    return KNOWN_SCORES['packers_bears'];
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
