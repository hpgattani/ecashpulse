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
  language: string;
  
  // Hero
  heroTitle1: string;
  heroTitle2: string;
  heroSubtitle: string;
  poweredBy: string;
  startTrading: string;
  exploreMarkets: string;
  payWithCashtab: string;
  payWithMarlin: string;
  
  // Markets section
  activeMarkets: string;
  browseMarkets: string;
  failedToLoad: string;
  noMarketsFound: string;
  
  // Trending section
  trendingNow: string;
  hot: string;
  
  // How it works
  howItWorksTitle: string;
  howItWorksSubtitle: string;
  step1Title: string;
  step1Desc: string;
  step2Title: string;
  step2Desc: string;
  step3Title: string;
  step3Desc: string;
  step4Title: string;
  step4Desc: string;
  
  // Prediction cards
  volume: string;
  vol: string;
  ends: string;
  betYes: string;
  betNo: string;
  betUp: string;
  betDown: string;
  yes: string;
  no: string;
  up: string;
  down: string;
  multi: string;
  linkCopied: string;
  yourBet: string;
  on: string;
  
  // Activity
  recentActivity: string;
  justNow: string;
  minutesAgo: string;
  hoursAgo: string;
  daysAgo: string;
  noActivity: string;
  beFirst: string;
  
  // Bet modal
  placeYourBet: string;
  bettingOn: string;
  betting: string;
  yourPick: string;
  currentOdds: string;
  yourPosition: string;
  winMultiplier: string;
  betAmount: string;
  enterAmount: string;
  ifYouWin: string;
  estimatedIfYouWin: string;
  totalPayout: string;
  profit: string;
  payoutDepends: string;
  platformFee: string;
  betPlaced: string;
  betConfirmed: string;
  connectWallet: string;
  connectWalletDesc: string;
  cancel: string;
  oddsChangeWarning: string;
  
  // Footer
  platform: string;
  resources: string;
  aboutEcash: string;
  getWallet: string;
  payButtonDocs: string;
  footerDesc: string;
  copyright: string;
  disclaimer: string;
  
  // Auth
  verifyOwnership: string;
  
  // Categories
  all: string;
  crypto: string;
  politics: string;
  sports: string;
  economics: string;
  entertainment: string;
  elections: string;
  tech: string;
}

const translations: Record<Language, Translations> = {
  en: {
    // Navigation
    markets: 'Markets',
    trending: 'Trending',
    howItWorks: 'How It Works',
    myBets: 'My Bets',
    connect: 'Connect',
    logout: 'Logout',
    editProfile: 'Edit Profile',
    language: 'Language',
    
    // Hero
    heroTitle1: 'Predict the Future,',
    heroTitle2: 'Bet with Confidence',
    heroSubtitle: 'The decentralized prediction market built on eCash. Trade on real-world events with instant settlements and near-zero fees.',
    poweredBy: 'Powered by',
    startTrading: 'Start Trading',
    exploreMarkets: 'Explore Markets',
    payWithCashtab: 'Pay with Cashtab',
    payWithMarlin: 'Pay with Marlin',
    
    // Markets section
    activeMarkets: 'Active Markets',
    browseMarkets: 'Browse prediction markets across categories. Place bets using eCash and win if your prediction is correct.',
    failedToLoad: 'Failed to load markets. Please try again.',
    noMarketsFound: 'No markets found in this category.',
    
    // Trending section
    trendingNow: 'Trending Now',
    hot: 'Hot',
    
    // How it works
    howItWorksTitle: 'How It Works',
    howItWorksSubtitle: 'Start predicting in minutes. No complicated setup, just pure prediction markets powered by eCash.',
    step1Title: 'Connect Your Wallet',
    step1Desc: 'Link your eCash address to start trading. No sign-up required.',
    step2Title: 'Find a Market',
    step2Desc: 'Browse prediction markets across crypto, politics, sports, and more.',
    step3Title: 'Place Your Bet',
    step3Desc: 'Bet YES or NO on any outcome using eCash. Instant transactions.',
    step4Title: 'Collect Winnings',
    step4Desc: 'When the market resolves, winners get paid automatically to their wallet.',
    
    // Prediction cards
    volume: 'Volume',
    vol: 'Vol',
    ends: 'Ends',
    betYes: 'Bet Yes',
    betNo: 'Bet No',
    betUp: 'Bet Up',
    betDown: 'Bet Down',
    yes: 'Yes',
    no: 'No',
    up: 'Up',
    down: 'Down',
    multi: 'Multi',
    linkCopied: 'Link copied!',
    yourBet: 'Your Bet',
    on: 'on',
    
    // Activity
    recentActivity: 'Recent Activity',
    justNow: 'Just now',
    minutesAgo: 'm ago',
    hoursAgo: 'h ago',
    daysAgo: 'd ago',
    noActivity: 'No betting activity yet',
    beFirst: 'Be the first to place a bet!',
    
    // Bet modal
    placeYourBet: 'Place Your Bet',
    bettingOn: 'Betting on',
    betting: 'Betting',
    yourPick: 'Your Pick',
    currentOdds: 'Current Odds',
    yourPosition: 'Your Position',
    winMultiplier: 'Win Multiplier',
    betAmount: 'Bet Amount (XEC)',
    enterAmount: 'Enter amount',
    ifYouWin: 'If you win:',
    estimatedIfYouWin: 'Estimated if you win:',
    totalPayout: 'Total Payout',
    profit: 'Profit',
    payoutDepends: 'Payout depends on final pool size. Currently no bets placed.',
    platformFee: '1% platform fee applies. Payments are processed on-chain.',
    betPlaced: 'Bet Placed!',
    betConfirmed: 'Your bet has been confirmed.',
    connectWallet: 'Connect Your Wallet',
    connectWalletDesc: 'Please login with your eCash address to place bets.',
    cancel: 'Cancel',
    oddsChangeWarning: 'Odds change as bets are placed. If no opposing bets, you get your stake back.',
    
    // Footer
    platform: 'Platform',
    resources: 'Resources',
    aboutEcash: 'About eCash',
    getWallet: 'Get a Wallet',
    payButtonDocs: 'PayButton Docs',
    footerDesc: 'The decentralized prediction market built on eCash. Trade on real-world events with instant settlements and near-zero fees.',
    copyright: '© 2025 eCash Pulse. Powered by eCash (XEC).',
    disclaimer: 'Prediction markets are for informational purposes only. Trade responsibly.',
    
    // Auth
    verifyOwnership: 'Verify Ownership',
    
    // Categories
    all: 'All',
    crypto: 'Crypto',
    politics: 'Politics',
    sports: 'Sports',
    economics: 'Economics',
    entertainment: 'Entertainment',
    elections: 'Elections',
    tech: 'Tech',
  },
  'pt-BR': {
    // Navigation
    markets: 'Mercados',
    trending: 'Em Alta',
    howItWorks: 'Como Funciona',
    myBets: 'Minhas Apostas',
    connect: 'Conectar',
    logout: 'Sair',
    editProfile: 'Editar Perfil',
    language: 'Idioma',
    
    // Hero
    heroTitle1: 'Preveja o Futuro,',
    heroTitle2: 'Aposte com Confiança',
    heroSubtitle: 'O mercado de previsões descentralizado construído em eCash. Negocie eventos do mundo real com liquidações instantâneas e taxas quase zero.',
    poweredBy: 'Desenvolvido por',
    startTrading: 'Começar a Negociar',
    exploreMarkets: 'Explorar Mercados',
    payWithCashtab: 'Pagar com Cashtab',
    payWithMarlin: 'Pagar com Marlin',
    
    // Markets section
    activeMarkets: 'Mercados Ativos',
    browseMarkets: 'Navegue pelos mercados de previsão em diversas categorias. Faça apostas usando eCash e ganhe se sua previsão estiver correta.',
    failedToLoad: 'Falha ao carregar mercados. Por favor, tente novamente.',
    noMarketsFound: 'Nenhum mercado encontrado nesta categoria.',
    
    // Trending section
    trendingNow: 'Em Alta Agora',
    hot: 'Quente',
    
    // How it works
    howItWorksTitle: 'Como Funciona',
    howItWorksSubtitle: 'Comece a prever em minutos. Sem configuração complicada, apenas mercados de previsão puros alimentados por eCash.',
    step1Title: 'Conecte Sua Carteira',
    step1Desc: 'Vincule seu endereço eCash para começar a negociar. Sem necessidade de cadastro.',
    step2Title: 'Encontre um Mercado',
    step2Desc: 'Navegue pelos mercados de previsão em cripto, política, esportes e muito mais.',
    step3Title: 'Faça Sua Aposta',
    step3Desc: 'Aposte SIM ou NÃO em qualquer resultado usando eCash. Transações instantâneas.',
    step4Title: 'Receba os Ganhos',
    step4Desc: 'Quando o mercado é resolvido, os vencedores são pagos automaticamente em suas carteiras.',
    
    // Prediction cards
    volume: 'Volume',
    vol: 'Vol',
    ends: 'Termina',
    betYes: 'Apostar Sim',
    betNo: 'Apostar Não',
    betUp: 'Apostar Alta',
    betDown: 'Apostar Baixa',
    yes: 'Sim',
    no: 'Não',
    up: 'Alta',
    down: 'Baixa',
    multi: 'Multi',
    linkCopied: 'Link copiado!',
    yourBet: 'Sua Aposta',
    on: 'em',
    
    // Activity
    recentActivity: 'Atividade Recente',
    justNow: 'Agora',
    minutesAgo: 'min atrás',
    hoursAgo: 'h atrás',
    daysAgo: 'd atrás',
    noActivity: 'Nenhuma atividade de aposta ainda',
    beFirst: 'Seja o primeiro a apostar!',
    
    // Bet modal
    placeYourBet: 'Faça Sua Aposta',
    bettingOn: 'Apostando em',
    betting: 'Apostando',
    yourPick: 'Sua Escolha',
    currentOdds: 'Probabilidades Atuais',
    yourPosition: 'Sua Posição',
    winMultiplier: 'Multiplicador de Ganho',
    betAmount: 'Valor da Aposta (XEC)',
    enterAmount: 'Digite o valor',
    ifYouWin: 'Se você ganhar:',
    estimatedIfYouWin: 'Estimado se você ganhar:',
    totalPayout: 'Pagamento Total',
    profit: 'Lucro',
    payoutDepends: 'O pagamento depende do tamanho final do pool. Atualmente sem apostas.',
    platformFee: 'Taxa de 1% da plataforma. Pagamentos processados na blockchain.',
    betPlaced: 'Aposta Realizada!',
    betConfirmed: 'Sua aposta foi confirmada.',
    connectWallet: 'Conecte Sua Carteira',
    connectWalletDesc: 'Por favor, faça login com seu endereço eCash para fazer apostas.',
    cancel: 'Cancelar',
    oddsChangeWarning: 'As probabilidades mudam conforme as apostas são feitas. Se não houver apostas opostas, você recebe sua aposta de volta.',
    
    // Footer
    platform: 'Plataforma',
    resources: 'Recursos',
    aboutEcash: 'Sobre o eCash',
    getWallet: 'Obter uma Carteira',
    payButtonDocs: 'Documentação PayButton',
    footerDesc: 'O mercado de previsões descentralizado construído em eCash. Negocie eventos do mundo real com liquidações instantâneas e taxas quase zero.',
    copyright: '© 2025 eCash Pulse. Desenvolvido por eCash (XEC).',
    disclaimer: 'Os mercados de previsão são apenas para fins informativos. Negocie com responsabilidade.',
    
    // Auth
    verifyOwnership: 'Verificar Propriedade',
    
    // Categories
    all: 'Todos',
    crypto: 'Cripto',
    politics: 'Política',
    sports: 'Esportes',
    economics: 'Economia',
    entertainment: 'Entretenimento',
    elections: 'Eleições',
    tech: 'Tecnologia',
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
