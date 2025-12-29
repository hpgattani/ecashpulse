import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'en' | 'pt-BR';

interface Translations {
  // Navigation
  markets: string;
  trending: string;
  howItWorks: string;
  myBets: string;
  connect: string;
  logout: string;
  editProfile: string;
  
  // Hero
  heroTitle: string;
  heroSubtitle: string;
  startPredicting: string;
  viewMarkets: string;
  
  // Prediction cards
  volume: string;
  ends: string;
  betYes: string;
  betNo: string;
  
  // Activity
  recentActivity: string;
  justNow: string;
  minutesAgo: string;
  hoursAgo: string;
  daysAgo: string;
  noActivity: string;
  beFirst: string;
  
  // Bet modal
  placeBet: string;
  amount: string;
  potentialWin: string;
  confirmBet: string;
  
  // Footer
  allRightsReserved: string;
  
  // Auth
  connectWallet: string;
  verifyOwnership: string;
  
  // Categories
  crypto: string;
  politics: string;
  sports: string;
  economics: string;
  entertainment: string;
  elections: string;
}

const translations: Record<Language, Translations> = {
  en: {
    markets: 'Markets',
    trending: 'Trending',
    howItWorks: 'How It Works',
    myBets: 'My Bets',
    connect: 'Connect',
    logout: 'Logout',
    editProfile: 'Edit Profile',
    heroTitle: 'Predict the Future with eCash',
    heroSubtitle: 'Bet on real-world events using XEC. Decentralized. Transparent. Exciting.',
    startPredicting: 'Start Predicting',
    viewMarkets: 'View Markets',
    volume: 'Volume',
    ends: 'Ends',
    betYes: 'Bet Yes',
    betNo: 'Bet No',
    recentActivity: 'Recent Activity',
    justNow: 'Just now',
    minutesAgo: 'm ago',
    hoursAgo: 'h ago',
    daysAgo: 'd ago',
    noActivity: 'No betting activity yet',
    beFirst: 'Be the first to place a bet!',
    placeBet: 'Place Bet',
    amount: 'Amount',
    potentialWin: 'Potential Win',
    confirmBet: 'Confirm Bet',
    allRightsReserved: 'All rights reserved',
    connectWallet: 'Connect Wallet',
    verifyOwnership: 'Verify Ownership',
    crypto: 'Crypto',
    politics: 'Politics',
    sports: 'Sports',
    economics: 'Economics',
    entertainment: 'Entertainment',
    elections: 'Elections',
  },
  'pt-BR': {
    markets: 'Mercados',
    trending: 'Em Alta',
    howItWorks: 'Como Funciona',
    myBets: 'Minhas Apostas',
    connect: 'Conectar',
    logout: 'Sair',
    editProfile: 'Editar Perfil',
    heroTitle: 'Preveja o Futuro com eCash',
    heroSubtitle: 'Aposte em eventos do mundo real usando XEC. Descentralizado. Transparente. Emocionante.',
    startPredicting: 'Começar a Prever',
    viewMarkets: 'Ver Mercados',
    volume: 'Volume',
    ends: 'Termina',
    betYes: 'Apostar Sim',
    betNo: 'Apostar Não',
    recentActivity: 'Atividade Recente',
    justNow: 'Agora',
    minutesAgo: 'min atrás',
    hoursAgo: 'h atrás',
    daysAgo: 'd atrás',
    noActivity: 'Nenhuma atividade de aposta ainda',
    beFirst: 'Seja o primeiro a apostar!',
    placeBet: 'Fazer Aposta',
    amount: 'Quantia',
    potentialWin: 'Ganho Potencial',
    confirmBet: 'Confirmar Aposta',
    allRightsReserved: 'Todos os direitos reservados',
    connectWallet: 'Conectar Carteira',
    verifyOwnership: 'Verificar Propriedade',
    crypto: 'Cripto',
    politics: 'Política',
    sports: 'Esportes',
    economics: 'Economia',
    entertainment: 'Entretenimento',
    elections: 'Eleições',
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    return (saved as Language) || 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: translations[language] }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
