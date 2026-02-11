import { useState, useEffect } from 'react';

// Import local team logos
import dundeeUtdLogo from '@/assets/teams/dundee-united.jpg';
import heartsLogo from '@/assets/teams/hearts.jpg';
import scotlandCricketLogo from '@/assets/teams/scotland-cricket.png';
import englandCricketLogo from '@/assets/teams/england-cricket.png';

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

// Team logos - local files for SPL, external URLs for others
const SCOTTISH_LOGOS = {
  dundeeUtd: dundeeUtdLogo,
  hearts: heartsLogo,
  // Wikipedia CDN for other Scottish teams
  celtic: 'https://upload.wikimedia.org/wikipedia/en/thumb/3/35/Celtic_FC.svg/200px-Celtic_FC.svg.png',
  rangers: 'https://upload.wikimedia.org/wikipedia/en/thumb/4/43/Rangers_FC.svg/200px-Rangers_FC.svg.png',
  aberdeen: 'https://upload.wikimedia.org/wikipedia/en/thumb/4/4f/Aberdeen_FC_logo.svg/200px-Aberdeen_FC_logo.svg.png',
  hibernian: 'https://upload.wikimedia.org/wikipedia/en/thumb/a/a3/Hibernian_FC_logo.svg/200px-Hibernian_FC_logo.svg.png',
  motherwell: 'https://upload.wikimedia.org/wikipedia/en/thumb/4/42/Motherwell_FC_crest.svg/200px-Motherwell_FC_crest.svg.png',
  stMirren: 'https://upload.wikimedia.org/wikipedia/en/thumb/5/5e/St_Mirren_FC_logo.svg/200px-St_Mirren_FC_logo.svg.png',
  kilmarnock: 'https://upload.wikimedia.org/wikipedia/en/thumb/4/4d/Kilmarnock_FC_logo.svg/200px-Kilmarnock_FC_logo.svg.png',
  rossCounty: 'https://upload.wikimedia.org/wikipedia/en/thumb/7/7c/Ross_County_F.C._logo.svg/200px-Ross_County_F.C._logo.svg.png',
  dundee: 'https://upload.wikimedia.org/wikipedia/en/thumb/5/5c/Dundee_FC_2023.svg/200px-Dundee_FC_2023.svg.png',
  stJohnstone: 'https://upload.wikimedia.org/wikipedia/en/thumb/1/1c/St_Johnstone_FC_logo.svg/200px-St_Johnstone_FC_logo.svg.png',
};

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
  // Scottish Premiership matches
  'dundee_hearts': {
    team1: 'Dundee Utd',
    team2: 'Hearts',
    team1Score: null,
    team2Score: null,
    status: 'scheduled',
    league: 'Scottish Premiership',
    team1Logo: SCOTTISH_LOGOS.dundeeUtd,
    team2Logo: SCOTTISH_LOGOS.hearts,
  },
  'celtic_rangers': {
    team1: 'Celtic',
    team2: 'Rangers',
    team1Score: null,
    team2Score: null,
    status: 'scheduled',
    league: 'Scottish Premiership',
    team1Logo: SCOTTISH_LOGOS.celtic,
    team2Logo: SCOTTISH_LOGOS.rangers,
  },
  'aberdeen_hibernian': {
    team1: 'Aberdeen',
    team2: 'Hibernian',
    team1Score: null,
    team2Score: null,
    status: 'scheduled',
    league: 'Scottish Premiership',
    team1Logo: SCOTTISH_LOGOS.aberdeen,
    team2Logo: SCOTTISH_LOGOS.hibernian,
  },
  'motherwell_kilmarnock': {
    team1: 'Motherwell',
    team2: 'Kilmarnock',
    team1Score: null,
    team2Score: null,
    status: 'scheduled',
    league: 'Scottish Premiership',
    team1Logo: SCOTTISH_LOGOS.motherwell,
    team2Logo: SCOTTISH_LOGOS.kilmarnock,
  },
  'stmirren_rossCounty': {
    team1: 'St Mirren',
    team2: 'Ross County',
    team1Score: null,
    team2Score: null,
    status: 'scheduled',
    league: 'Scottish Premiership',
    team1Logo: SCOTTISH_LOGOS.stMirren,
    team2Logo: SCOTTISH_LOGOS.rossCounty,
  },
  // ICC T20 World Cup 2026
  'scotland_england_cricket': {
    team1: 'Scotland',
    team2: 'England',
    team1Score: null,
    team2Score: null,
    status: 'scheduled',
    league: 'ICC T20 World Cup',
    team1Logo: scotlandCricketLogo,
    team2Logo: englandCricketLogo,
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
  
  // Celtic vs Rangers - Old Firm Derby
  if ((lower.includes('celtic') && lower.includes('rangers'))) {
    const game = KNOWN_GAMES['celtic_rangers'];
    const celticIdx = lower.indexOf('celtic');
    const rangersIdx = lower.indexOf('rangers');
    const celticFirst = celticIdx < rangersIdx;
    
    return {
      homeTeam: celticFirst ? game.team1 : game.team2,
      awayTeam: celticFirst ? game.team2 : game.team1,
      homeScore: celticFirst ? game.team1Score : game.team2Score,
      awayScore: celticFirst ? game.team2Score : game.team1Score,
      homeLogo: celticFirst ? game.team1Logo : game.team2Logo,
      awayLogo: celticFirst ? game.team2Logo : game.team1Logo,
      status: game.status,
      league: game.league,
    };
  }
  
  // Aberdeen vs Hibernian
  if ((lower.includes('aberdeen') && (lower.includes('hibernian') || lower.includes('hibs')))) {
    const game = KNOWN_GAMES['aberdeen_hibernian'];
    const aberdeenIdx = lower.indexOf('aberdeen');
    const hibsIdx = Math.min(
      lower.includes('hibernian') ? lower.indexOf('hibernian') : Infinity,
      lower.includes('hibs') ? lower.indexOf('hibs') : Infinity
    );
    const aberdeenFirst = aberdeenIdx < hibsIdx;
    
    return {
      homeTeam: aberdeenFirst ? game.team1 : game.team2,
      awayTeam: aberdeenFirst ? game.team2 : game.team1,
      homeScore: aberdeenFirst ? game.team1Score : game.team2Score,
      awayScore: aberdeenFirst ? game.team2Score : game.team1Score,
      homeLogo: aberdeenFirst ? game.team1Logo : game.team2Logo,
      awayLogo: aberdeenFirst ? game.team2Logo : game.team1Logo,
      status: game.status,
      league: game.league,
    };
  }
  
  // Motherwell vs Kilmarnock
  if ((lower.includes('motherwell') && lower.includes('kilmarnock'))) {
    const game = KNOWN_GAMES['motherwell_kilmarnock'];
    const motherwellIdx = lower.indexOf('motherwell');
    const kilmarnockIdx = lower.indexOf('kilmarnock');
    const motherwellFirst = motherwellIdx < kilmarnockIdx;
    
    return {
      homeTeam: motherwellFirst ? game.team1 : game.team2,
      awayTeam: motherwellFirst ? game.team2 : game.team1,
      homeScore: motherwellFirst ? game.team1Score : game.team2Score,
      awayScore: motherwellFirst ? game.team2Score : game.team1Score,
      homeLogo: motherwellFirst ? game.team1Logo : game.team2Logo,
      awayLogo: motherwellFirst ? game.team2Logo : game.team1Logo,
      status: game.status,
      league: game.league,
    };
  }
  
  // St Mirren vs Ross County
  if (((lower.includes('st mirren') || lower.includes('st. mirren')) && lower.includes('ross county'))) {
    const game = KNOWN_GAMES['stmirren_rossCounty'];
    const stMirrenIdx = Math.min(
      lower.includes('st mirren') ? lower.indexOf('st mirren') : Infinity,
      lower.includes('st. mirren') ? lower.indexOf('st. mirren') : Infinity
    );
    const rossCountyIdx = lower.indexOf('ross county');
    const stMirrenFirst = stMirrenIdx < rossCountyIdx;
    
    return {
      homeTeam: stMirrenFirst ? game.team1 : game.team2,
      awayTeam: stMirrenFirst ? game.team2 : game.team1,
      homeScore: stMirrenFirst ? game.team1Score : game.team2Score,
      awayScore: stMirrenFirst ? game.team2Score : game.team1Score,
      homeLogo: stMirrenFirst ? game.team1Logo : game.team2Logo,
      awayLogo: stMirrenFirst ? game.team2Logo : game.team1Logo,
      status: game.status,
      league: game.league,
    };
  }
  // Scotland vs England - ICC T20 World Cup
  if (lower.includes('scotland') && lower.includes('england')) {
    const game = KNOWN_GAMES['scotland_england_cricket'];
    const scotlandIdx = lower.indexOf('scotland');
    const englandIdx = lower.indexOf('england');
    const scotlandFirst = scotlandIdx < englandIdx;
    
    return {
      homeTeam: scotlandFirst ? game.team1 : game.team2,
      awayTeam: scotlandFirst ? game.team2 : game.team1,
      homeScore: scotlandFirst ? game.team1Score : game.team2Score,
      awayScore: scotlandFirst ? game.team2Score : game.team1Score,
      homeLogo: scotlandFirst ? game.team1Logo : game.team2Logo,
      awayLogo: scotlandFirst ? game.team2Logo : game.team1Logo,
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
