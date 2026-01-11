import { useState, useEffect } from 'react';

interface GameScore {
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: 'scheduled' | 'in_progress' | 'final' | 'unknown';
  league: string;
}

// NFL team name mappings for TheSportsDB
const NFL_TEAMS: Record<string, string> = {
  'jacksonville jaguars': 'Jacksonville Jaguars',
  'jaguars': 'Jacksonville Jaguars',
  'buffalo bills': 'Buffalo Bills',
  'bills': 'Buffalo Bills',
  'philadelphia eagles': 'Philadelphia Eagles',
  'eagles': 'Philadelphia Eagles',
  'san francisco 49ers': 'San Francisco 49ers',
  '49ers': 'San Francisco 49ers',
  'los angeles rams': 'Los Angeles Rams',
  'rams': 'Los Angeles Rams',
  'carolina panthers': 'Carolina Panthers',
  'panthers': 'Carolina Panthers',
  'green bay packers': 'Green Bay Packers',
  'packers': 'Green Bay Packers',
  'chicago bears': 'Chicago Bears',
  'bears': 'Chicago Bears',
  'new england patriots': 'New England Patriots',
  'patriots': 'New England Patriots',
  'kansas city chiefs': 'Kansas City Chiefs',
  'chiefs': 'Kansas City Chiefs',
  'detroit lions': 'Detroit Lions',
  'lions': 'Detroit Lions',
  'washington commanders': 'Washington Commanders',
  'commanders': 'Washington Commanders',
  'baltimore ravens': 'Baltimore Ravens',
  'ravens': 'Baltimore Ravens',
  'pittsburgh steelers': 'Pittsburgh Steelers',
  'steelers': 'Pittsburgh Steelers',
  'houston texans': 'Houston Texans',
  'texans': 'Houston Texans',
  'minnesota vikings': 'Minnesota Vikings',
  'vikings': 'Minnesota Vikings',
};

function extractTeamsFromTitle(title: string): { team1: string; team2: string } | null {
  const lowerTitle = title.toLowerCase();
  
  const foundTeams: string[] = [];
  for (const [key, value] of Object.entries(NFL_TEAMS)) {
    if (lowerTitle.includes(key)) {
      if (!foundTeams.includes(value)) {
        foundTeams.push(value);
      }
    }
  }
  
  if (foundTeams.length >= 2) {
    return { team1: foundTeams[0], team2: foundTeams[1] };
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

    const teams = extractTeamsFromTitle(predictionTitle);
    if (!teams) {
      setScore(null);
      return;
    }

    // For now, return a placeholder that can be updated via admin
    // In production, this would call TheSportsDB API
    const fetchScore = async () => {
      try {
        // TheSportsDB free API for past events
        const response = await fetch(
          `https://www.thesportsdb.com/api/v1/json/3/searchevents.php?e=${encodeURIComponent(teams.team1)}_vs_${encodeURIComponent(teams.team2)}`
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.event && data.event.length > 0) {
            const event = data.event[0];
            setScore({
              homeTeam: event.strHomeTeam || teams.team1,
              awayTeam: event.strAwayTeam || teams.team2,
              homeScore: event.intHomeScore !== null ? parseInt(event.intHomeScore) : null,
              awayScore: event.intAwayScore !== null ? parseInt(event.intAwayScore) : null,
              status: event.strStatus === 'Match Finished' ? 'final' : 
                      event.strStatus === 'Not Started' ? 'scheduled' : 'unknown',
              league: 'NFL',
            });
            return;
          }
        }
      } catch (error) {
        console.log('Could not fetch sports score:', error);
      }
      
      // Fallback - just show team names without scores
      setScore({
        homeTeam: teams.team1,
        awayTeam: teams.team2,
        homeScore: null,
        awayScore: null,
        status: 'unknown',
        league: 'NFL',
      });
    };

    fetchScore();
  }, [predictionTitle, category]);

  return score;
}

// Static scores cache that can be updated
const KNOWN_SCORES: Record<string, GameScore> = {
  'jaguars_bills': {
    homeTeam: 'Buffalo Bills',
    awayTeam: 'Jacksonville Jaguars',
    homeScore: 31,
    awayScore: 10,
    status: 'final',
    league: 'NFL',
  },
  'eagles_49ers': {
    homeTeam: 'Philadelphia Eagles',
    awayTeam: 'San Francisco 49ers',
    homeScore: null,
    awayScore: null,
    status: 'scheduled',
    league: 'NFL',
  },
};

export function getKnownScore(title: string): GameScore | null {
  const lowerTitle = title.toLowerCase();
  
  if (lowerTitle.includes('jaguars') && lowerTitle.includes('bills')) {
    return KNOWN_SCORES['jaguars_bills'];
  }
  if (lowerTitle.includes('eagles') && lowerTitle.includes('49ers')) {
    return KNOWN_SCORES['eagles_49ers'];
  }
  
  return null;
}
