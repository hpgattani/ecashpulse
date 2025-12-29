export interface Prediction {
  id: string;
  question: string;
  description: string;
  category: 'crypto' | 'politics' | 'sports' | 'tech' | 'entertainment' | 'economics' | 'elections';
  yesOdds: number;
  noOdds: number;
  volume: number;
  endDate: string;
  image?: string;
  trending?: boolean;
  change24h?: number;
}

export interface UserProfile {
  id: string;
  username: string;
  ecashAddress: string;
  avatar?: string;
  totalBets: number;
  winRate: number;
  joined: string;
}

export interface Bet {
  id: string;
  predictionId: string;
  userId: string;
  amount: number;
  position: 'yes' | 'no';
  timestamp: string;
}
