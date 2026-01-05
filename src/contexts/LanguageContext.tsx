import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'en' | 'pt-BR' | 'ko' | 'ja';

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
  searchPlaceholder: string;
  searchMarkets: string;
  
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
  
  // Resolved section
  recentlyResolved: string;
  resolvedSubtitle: string;
  yesWon: string;
  noWon: string;
  totalPool: string;
  
  // Leaderboard section
  winnersCircle: string;
  topWinners: string;
  leaderboardSubtitle: string;
  wins: string;
  bets: string;
  noWinnersYet: string;
  beFirstWinner: string;
  
  // Transparent Betting section
  transparentBetting: string;
  transparentBettingDesc: string;
  wallet: string;
  
  // My Bets page
  myBetsTitle: string;
  trackYourBets: string;
  backToMarkets: string;
  noBetsYet: string;
  noBetsDesc: string;
  pending: string;
  confirmed: string;
  won: string;
  lost: string;
  refunded: string;
  betTx: string;
  payoutTx: string;
  
  // Public Bets statuses
  statusConfirmed: string;
  statusPending: string;
  statusWon: string;
  statusLost: string;
  statusRefunded: string;
}

// Common prediction title translations
const predictionTitleTranslations: Record<string, Record<Language, string>> = {
  // Crypto predictions
  "Will Bitcoin reach $100k?": { 
    en: "Will Bitcoin reach $100k?", 
    "pt-BR": "O Bitcoin atingirá $100k?",
    ko: "비트코인이 $100k에 도달할까요?",
    ja: "ビットコインは$100kに達するか？"
  },
  "Will Ethereum flip Bitcoin?": { 
    en: "Will Ethereum flip Bitcoin?", 
    "pt-BR": "O Ethereum vai superar o Bitcoin?",
    ko: "이더리움이 비트코인을 추월할까요?",
    ja: "イーサリアムはビットコインを超えるか？"
  },
  "Bitcoin Up or Down?": { 
    en: "Bitcoin Up or Down?", 
    "pt-BR": "Bitcoin vai subir ou descer?",
    ko: "비트코인 상승 또는 하락?",
    ja: "ビットコイン上昇か下落か？"
  },
  "Ethereum Up or Down?": { 
    en: "Ethereum Up or Down?", 
    "pt-BR": "Ethereum vai subir ou descer?",
    ko: "이더리움 상승 또는 하락?",
    ja: "イーサリアム上昇か下落か？"
  },
  "Solana Up or Down?": { 
    en: "Solana Up or Down?", 
    "pt-BR": "Solana vai subir ou descer?",
    ko: "솔라나 상승 또는 하락?",
    ja: "ソラナ上昇か下落か？"
  },
  "XRP Up or Down?": { 
    en: "XRP Up or Down?", 
    "pt-BR": "XRP vai subir ou descer?",
    ko: "XRP 상승 또는 하락?",
    ja: "XRP上昇か下落か？"
  },
  "Dogecoin Up or Down?": { 
    en: "Dogecoin Up or Down?", 
    "pt-BR": "Dogecoin vai subir ou descer?",
    ko: "도지코인 상승 또는 하락?",
    ja: "ドージコイン上昇か下落か？"
  },
  
  // Politics/Elections
  "Which party will win the House in 2026?": { 
    en: "Which party will win the House in 2026?", 
    "pt-BR": "Qual partido vai ganhar a Câmara em 2026?",
    ko: "2026년에 어느 당이 하원을 장악할까요?",
    ja: "2026年にどの党が下院を制するか？"
  },
  "Will President Lula win the 2026 Brazilian election?": { 
    en: "Will President Lula win the 2026 Brazilian election?", 
    "pt-BR": "O Presidente Lula vencerá a eleição brasileira de 2026?",
    ko: "룰라 대통령이 2026년 브라질 선거에서 승리할까요?",
    ja: "ルーラ大統領は2026年ブラジル選挙で勝つか？"
  },
  
  // Sports
  "Will India win the Cricket World Cup?": { 
    en: "Will India win the Cricket World Cup?", 
    "pt-BR": "A Índia vai ganhar a Copa do Mundo de Críquete?",
    ko: "인도가 크리켓 월드컵에서 우승할까요?",
    ja: "インドはクリケットワールドカップで優勝するか？"
  },
};

// Dynamic translation patterns
const translationPatterns: Array<{ pattern: RegExp; en: string; ptBR: string; ko: string; ja: string }> = [
  { pattern: /^Will (.+) reach \$(.+)\?$/i, en: "Will $1 reach $$2?", ptBR: "$1 atingirá $$2?", ko: "$1이(가) $$2에 도달할까요?", ja: "$1は$$2に達するか？" },
  { pattern: /^(.+) Up or Down\?$/i, en: "$1 Up or Down?", ptBR: "$1 vai subir ou descer?", ko: "$1 상승 또는 하락?", ja: "$1上昇か下落か？" },
  { pattern: /^Will (.+) go up\?$/i, en: "Will $1 go up?", ptBR: "$1 vai subir?", ko: "$1이(가) 상승할까요?", ja: "$1は上昇するか？" },
  { pattern: /^Will (.+) go down\?$/i, en: "Will $1 go down?", ptBR: "$1 vai descer?", ko: "$1이(가) 하락할까요?", ja: "$1は下落するか？" },
  { pattern: /^Will (.+) win (.+)\?$/i, en: "Will $1 win $2?", ptBR: "$1 vai ganhar $2?", ko: "$1이(가) $2에서 우승할까요?", ja: "$1は$2で勝つか？" },
  { pattern: /^Which (.+) will win (.+)\?$/i, en: "Which $1 will win $2?", ptBR: "Qual $1 vai ganhar $2?", ko: "어떤 $1이(가) $2에서 이길까요?", ja: "どの$1が$2で勝つか？" },
  { pattern: /^Will (.+) beat (.+)\?$/i, en: "Will $1 beat $2?", ptBR: "$1 vai vencer $2?", ko: "$1이(가) $2을(를) 이길까요?", ja: "$1は$2に勝つか？" },
  { pattern: /^Will (.+) happen\?$/i, en: "Will $1 happen?", ptBR: "$1 vai acontecer?", ko: "$1이(가) 일어날까요?", ja: "$1は起こるか？" },
  { pattern: /^Will (.+) close above \$(.+)\?$/i, en: "Will $1 close above $$2?", ptBR: "$1 vai fechar acima de $$2?", ko: "$1이(가) $$2 이상에서 마감할까요?", ja: "$1は$$2以上で終わるか？" },
  { pattern: /^Will (.+) trade above \$(.+)\?$/i, en: "Will $1 trade above $$2?", ptBR: "$1 vai negociar acima de $$2?", ko: "$1이(가) $$2 이상에서 거래될까요?", ja: "$1は$$2以上で取引されるか？" },
];

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
    searchPlaceholder: 'Search markets...',
    searchMarkets: 'Search',
    
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
    
    // Resolved section
    recentlyResolved: 'Recently Resolved',
    resolvedSubtitle: 'Markets that have been settled with winners paid out automatically',
    yesWon: 'YES Won',
    noWon: 'NO Won',
    totalPool: 'Total Pool',
    
    // Leaderboard section
    winnersCircle: 'Winners Circle',
    topWinners: 'Top Winners',
    leaderboardSubtitle: 'The most successful bettors who have won predictions',
    wins: 'wins',
    bets: 'bets',
    noWinnersYet: 'No winners yet. Be the first to win a prediction!',
    beFirstWinner: 'Be the first to win a prediction!',
    
    // Transparent Betting section
    transparentBetting: 'Transparent Betting',
    transparentBettingDesc: 'All bets are publicly visible with verifiable transaction IDs',
    wallet: 'Wallet',
    
    // My Bets page
    myBetsTitle: 'My Bets',
    trackYourBets: 'Track all your predictions and winnings',
    backToMarkets: 'Back to Markets',
    noBetsYet: 'No bets yet',
    noBetsDesc: 'Start trading on prediction markets to see your bets here',
    pending: 'Pending',
    confirmed: 'Confirmed',
    won: 'Won',
    lost: 'Lost',
    refunded: 'Refunded',
    betTx: 'Bet TX',
    payoutTx: 'Payout TX',
    
    // Public Bets statuses
    statusConfirmed: 'Confirmed',
    statusPending: 'Pending',
    statusWon: 'Won',
    statusLost: 'Lost',
    statusRefunded: 'Refunded',
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
    searchPlaceholder: 'Buscar mercados...',
    searchMarkets: 'Buscar',
    
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
    
    // Resolved section
    recentlyResolved: 'Resolvidos Recentemente',
    resolvedSubtitle: 'Mercados que foram liquidados com vencedores pagos automaticamente',
    yesWon: 'SIM Venceu',
    noWon: 'NÃO Venceu',
    totalPool: 'Pool Total',
    
    // Leaderboard section
    winnersCircle: 'Círculo dos Vencedores',
    topWinners: 'Maiores Vencedores',
    leaderboardSubtitle: 'Os apostadores mais bem-sucedidos que venceram previsões',
    wins: 'vitórias',
    bets: 'apostas',
    noWinnersYet: 'Nenhum vencedor ainda. Seja o primeiro a vencer uma previsão!',
    beFirstWinner: 'Seja o primeiro a vencer uma previsão!',
    
    // Transparent Betting section
    transparentBetting: 'Apostas Transparentes',
    transparentBettingDesc: 'Todas as apostas são publicamente visíveis com IDs de transação verificáveis',
    wallet: 'Carteira',
    
    // My Bets page
    myBetsTitle: 'Minhas Apostas',
    trackYourBets: 'Acompanhe todas as suas previsões e ganhos',
    backToMarkets: 'Voltar aos Mercados',
    noBetsYet: 'Nenhuma aposta ainda',
    noBetsDesc: 'Comece a negociar nos mercados de previsão para ver suas apostas aqui',
    pending: 'Pendente',
    confirmed: 'Confirmado',
    won: 'Ganhou',
    lost: 'Perdeu',
    refunded: 'Reembolsado',
    betTx: 'TX da Aposta',
    payoutTx: 'TX do Pagamento',
    
    // Public Bets statuses
    statusConfirmed: 'Confirmado',
    statusPending: 'Pendente',
    statusWon: 'Ganhou',
    statusLost: 'Perdeu',
    statusRefunded: 'Reembolsado',
  },
  ko: {
    // Navigation
    markets: '마켓',
    trending: '인기',
    howItWorks: '이용방법',
    myBets: '내 베팅',
    connect: '연결',
    logout: '로그아웃',
    editProfile: '프로필 수정',
    language: '언어',
    
    // Hero
    heroTitle1: '미래를 예측하고,',
    heroTitle2: '자신있게 베팅하세요',
    heroSubtitle: 'eCash 기반 탈중앙화 예측 마켓. 즉시 정산과 거의 제로에 가까운 수수료로 실제 이벤트에 거래하세요.',
    poweredBy: 'Powered by',
    startTrading: '거래 시작',
    exploreMarkets: '마켓 탐색',
    payWithCashtab: 'Cashtab으로 결제',
    payWithMarlin: 'Marlin으로 결제',
    
    // Markets section
    activeMarkets: '활성 마켓',
    browseMarkets: '카테고리별 예측 마켓을 탐색하세요. eCash로 베팅하고 예측이 맞으면 승리하세요.',
    failedToLoad: '마켓 로드 실패. 다시 시도해주세요.',
    noMarketsFound: '이 카테고리에 마켓이 없습니다.',
    searchPlaceholder: '마켓 검색...',
    searchMarkets: '검색',
    
    // Trending section
    trendingNow: '현재 인기',
    hot: '핫',
    
    // How it works
    howItWorksTitle: '이용방법',
    howItWorksSubtitle: '몇 분 안에 예측을 시작하세요. 복잡한 설정 없이 eCash로 구동되는 순수 예측 마켓.',
    step1Title: '지갑 연결',
    step1Desc: 'eCash 주소를 연결하여 거래를 시작하세요. 가입 불필요.',
    step2Title: '마켓 찾기',
    step2Desc: '암호화폐, 정치, 스포츠 등 예측 마켓을 탐색하세요.',
    step3Title: '베팅하기',
    step3Desc: 'eCash를 사용하여 모든 결과에 YES 또는 NO 베팅. 즉시 거래.',
    step4Title: '수익 수령',
    step4Desc: '마켓이 해결되면 승자는 자동으로 지갑으로 지급받습니다.',
    
    // Prediction cards
    volume: '거래량',
    vol: '거래량',
    ends: '종료',
    betYes: 'Yes 베팅',
    betNo: 'No 베팅',
    betUp: '상승 베팅',
    betDown: '하락 베팅',
    yes: 'Yes',
    no: 'No',
    up: '상승',
    down: '하락',
    multi: '다중',
    linkCopied: '링크 복사됨!',
    yourBet: '내 베팅',
    on: '에',
    
    // Activity
    recentActivity: '최근 활동',
    justNow: '방금',
    minutesAgo: '분 전',
    hoursAgo: '시간 전',
    daysAgo: '일 전',
    noActivity: '아직 베팅 활동이 없습니다',
    beFirst: '첫 베팅을 해보세요!',
    
    // Bet modal
    placeYourBet: '베팅하기',
    bettingOn: '베팅 대상',
    betting: '베팅',
    yourPick: '선택',
    currentOdds: '현재 배당률',
    yourPosition: '내 포지션',
    winMultiplier: '승리 배율',
    betAmount: '베팅 금액 (XEC)',
    enterAmount: '금액 입력',
    ifYouWin: '승리 시:',
    estimatedIfYouWin: '예상 승리 금액:',
    totalPayout: '총 지급액',
    profit: '수익',
    payoutDepends: '지급액은 최종 풀 크기에 따라 달라집니다. 현재 베팅 없음.',
    platformFee: '1% 플랫폼 수수료 적용. 결제는 온체인으로 처리됩니다.',
    betPlaced: '베팅 완료!',
    betConfirmed: '베팅이 확인되었습니다.',
    connectWallet: '지갑 연결',
    connectWalletDesc: '베팅하려면 eCash 주소로 로그인하세요.',
    cancel: '취소',
    oddsChangeWarning: '베팅이 이루어질수록 배당률이 변경됩니다. 반대 베팅이 없으면 베팅금이 환불됩니다.',
    
    // Footer
    platform: '플랫폼',
    resources: '리소스',
    aboutEcash: 'eCash 소개',
    getWallet: '지갑 받기',
    payButtonDocs: 'PayButton 문서',
    footerDesc: 'eCash 기반 탈중앙화 예측 마켓. 즉시 정산과 거의 제로에 가까운 수수료로 실제 이벤트에 거래하세요.',
    copyright: '© 2025 eCash Pulse. Powered by eCash (XEC).',
    disclaimer: '예측 마켓은 정보 제공 목적입니다. 책임감 있게 거래하세요.',
    
    // Auth
    verifyOwnership: '소유권 확인',
    
    // Categories
    all: '전체',
    crypto: '암호화폐',
    politics: '정치',
    sports: '스포츠',
    economics: '경제',
    entertainment: '엔터테인먼트',
    elections: '선거',
    tech: '기술',
    
    // Resolved section
    recentlyResolved: '최근 해결됨',
    resolvedSubtitle: '정산되어 승자에게 자동 지급된 마켓',
    yesWon: 'YES 승리',
    noWon: 'NO 승리',
    totalPool: '총 풀',
    
    // Leaderboard section
    winnersCircle: '승자 서클',
    topWinners: '상위 승자',
    leaderboardSubtitle: '예측에서 승리한 가장 성공적인 베터들',
    wins: '승',
    bets: '베팅',
    noWinnersYet: '아직 승자가 없습니다. 첫 승리자가 되세요!',
    beFirstWinner: '첫 승리자가 되세요!',
    
    // Transparent Betting section
    transparentBetting: '투명한 베팅',
    transparentBettingDesc: '모든 베팅은 검증 가능한 거래 ID와 함께 공개됩니다',
    wallet: '지갑',
    
    // My Bets page
    myBetsTitle: '내 베팅',
    trackYourBets: '모든 예측과 수익을 추적하세요',
    backToMarkets: '마켓으로 돌아가기',
    noBetsYet: '아직 베팅이 없습니다',
    noBetsDesc: '예측 마켓에서 거래를 시작하여 여기서 베팅을 확인하세요',
    pending: '대기 중',
    confirmed: '확인됨',
    won: '승리',
    lost: '패배',
    refunded: '환불됨',
    betTx: '베팅 TX',
    payoutTx: '지급 TX',
    
    // Public Bets statuses
    statusConfirmed: '확인됨',
    statusPending: '대기 중',
    statusWon: '승리',
    statusLost: '패배',
    statusRefunded: '환불됨',
  },
  ja: {
    // Navigation
    markets: 'マーケット',
    trending: 'トレンド',
    howItWorks: '使い方',
    myBets: 'マイベット',
    connect: '接続',
    logout: 'ログアウト',
    editProfile: 'プロフィール編集',
    language: '言語',
    
    // Hero
    heroTitle1: '未来を予測し、',
    heroTitle2: '自信を持ってベット',
    heroSubtitle: 'eCash上に構築された分散型予測マーケット。即時決済とほぼゼロの手数料で実世界のイベントに取引。',
    poweredBy: 'Powered by',
    startTrading: '取引開始',
    exploreMarkets: 'マーケットを探索',
    payWithCashtab: 'Cashtabで支払う',
    payWithMarlin: 'Marlinで支払う',
    
    // Markets section
    activeMarkets: 'アクティブマーケット',
    browseMarkets: 'カテゴリ別の予測マーケットを閲覧。eCashでベットし、予測が正しければ勝利。',
    failedToLoad: 'マーケットの読み込みに失敗しました。もう一度お試しください。',
    noMarketsFound: 'このカテゴリにマーケットがありません。',
    searchPlaceholder: 'マーケットを検索...',
    searchMarkets: '検索',
    
    // Trending section
    trendingNow: '現在のトレンド',
    hot: 'ホット',
    
    // How it works
    howItWorksTitle: '使い方',
    howItWorksSubtitle: '数分で予測を開始。複雑な設定なし、eCashで動く純粋な予測マーケット。',
    step1Title: 'ウォレットを接続',
    step1Desc: 'eCashアドレスをリンクして取引開始。サインアップ不要。',
    step2Title: 'マーケットを見つける',
    step2Desc: '暗号通貨、政治、スポーツなどの予測マーケットを閲覧。',
    step3Title: 'ベットする',
    step3Desc: 'eCashを使って任意の結果にYESまたはNOベット。即時取引。',
    step4Title: '賞金を受け取る',
    step4Desc: 'マーケットが解決されると、勝者は自動的にウォレットに支払われます。',
    
    // Prediction cards
    volume: '出来高',
    vol: '出来高',
    ends: '終了',
    betYes: 'Yesにベット',
    betNo: 'Noにベット',
    betUp: '上昇にベット',
    betDown: '下落にベット',
    yes: 'Yes',
    no: 'No',
    up: '上昇',
    down: '下落',
    multi: 'マルチ',
    linkCopied: 'リンクをコピーしました！',
    yourBet: 'あなたのベット',
    on: 'に',
    
    // Activity
    recentActivity: '最近のアクティビティ',
    justNow: 'たった今',
    minutesAgo: '分前',
    hoursAgo: '時間前',
    daysAgo: '日前',
    noActivity: 'まだベッティング活動がありません',
    beFirst: '最初にベットしてください！',
    
    // Bet modal
    placeYourBet: 'ベットする',
    bettingOn: 'ベット対象',
    betting: 'ベッティング',
    yourPick: 'あなたの選択',
    currentOdds: '現在のオッズ',
    yourPosition: 'あなたのポジション',
    winMultiplier: '勝利倍率',
    betAmount: 'ベット額 (XEC)',
    enterAmount: '金額を入力',
    ifYouWin: '勝った場合:',
    estimatedIfYouWin: '勝った場合の予想:',
    totalPayout: '総支払額',
    profit: '利益',
    payoutDepends: '支払額は最終プールサイズによります。現在ベットなし。',
    platformFee: '1%のプラットフォーム手数料が適用。支払いはオンチェーンで処理。',
    betPlaced: 'ベット完了！',
    betConfirmed: 'ベットが確認されました。',
    connectWallet: 'ウォレットを接続',
    connectWalletDesc: 'ベットするにはeCashアドレスでログインしてください。',
    cancel: 'キャンセル',
    oddsChangeWarning: 'ベットが行われるとオッズが変わります。反対のベットがない場合、賭け金は返金されます。',
    
    // Footer
    platform: 'プラットフォーム',
    resources: 'リソース',
    aboutEcash: 'eCashについて',
    getWallet: 'ウォレットを取得',
    payButtonDocs: 'PayButtonドキュメント',
    footerDesc: 'eCash上に構築された分散型予測マーケット。即時決済とほぼゼロの手数料で実世界のイベントに取引。',
    copyright: '© 2025 eCash Pulse. Powered by eCash (XEC).',
    disclaimer: '予測マーケットは情報提供目的のみです。責任を持って取引してください。',
    
    // Auth
    verifyOwnership: '所有権を確認',
    
    // Categories
    all: 'すべて',
    crypto: '暗号通貨',
    politics: '政治',
    sports: 'スポーツ',
    economics: '経済',
    entertainment: 'エンターテインメント',
    elections: '選挙',
    tech: 'テクノロジー',
    
    // Resolved section
    recentlyResolved: '最近解決',
    resolvedSubtitle: '勝者に自動支払いされた決済済みマーケット',
    yesWon: 'YES勝利',
    noWon: 'NO勝利',
    totalPool: '総プール',
    
    // Leaderboard section
    winnersCircle: '勝者サークル',
    topWinners: 'トップ勝者',
    leaderboardSubtitle: '予測で勝利した最も成功したベッター',
    wins: '勝',
    bets: 'ベット',
    noWinnersYet: 'まだ勝者がいません。最初の勝者になってください！',
    beFirstWinner: '最初の勝者になってください！',
    
    // Transparent Betting section
    transparentBetting: '透明なベッティング',
    transparentBettingDesc: 'すべてのベットは検証可能なトランザクションIDで公開されます',
    wallet: 'ウォレット',
    
    // My Bets page
    myBetsTitle: 'マイベット',
    trackYourBets: 'すべての予測と賞金を追跡',
    backToMarkets: 'マーケットに戻る',
    noBetsYet: 'まだベットがありません',
    noBetsDesc: '予測マーケットで取引を開始してここでベットを確認',
    pending: '保留中',
    confirmed: '確認済み',
    won: '勝利',
    lost: '敗北',
    refunded: '返金済み',
    betTx: 'ベットTX',
    payoutTx: '支払いTX',
    
    // Public Bets statuses
    statusConfirmed: '確認済み',
    statusPending: '保留中',
    statusWon: '勝利',
    statusLost: '敗北',
    statusRefunded: '返金済み',
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
  translateTitle: (title: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Function to translate prediction titles
const translatePredictionTitle = (title: string, language: Language): string => {
  if (language === 'en') return title;
  
  // Check exact matches first
  if (predictionTitleTranslations[title]) {
    return predictionTitleTranslations[title][language] || title;
  }
  
  // Try pattern matching - only for Portuguese (Korean/Japanese patterns cause broken mixed text)
  if (language === 'pt-BR') {
    for (const { pattern, ptBR } of translationPatterns) {
      const match = title.match(pattern);
      if (match) {
        let translated = ptBR;
        for (let i = 1; i < match.length; i++) {
          translated = translated.replace(`$${i}`, match[i]);
        }
        return translated;
      }
    }
  }
  
  // Fallback: For Korean and Japanese, don't do word-level replacements as they break grammar
  // Only Portuguese can safely use word-level translations
  if (language === 'ko' || language === 'ja') {
    return title; // Return original English title if no exact/pattern match
  }
  
  // Portuguese word-level fallback (safe for similar grammar structure)
  let translated = title;
  
  const ptBrWords: Record<string, string> = {
    'Will': 'Vai',
    'win': 'ganhar',
    'reach': 'atingir',
    'above': 'acima de',
    'below': 'abaixo de',
    'close': 'fechar',
    'trade': 'negociar',
    'Up or Down': 'subir ou descer',
    'go up': 'subir',
    'go down': 'descer',
    'the House': 'a Câmara',
    'the Senate': 'o Senado',
    'election': 'eleição',
    'elections': 'eleições',
    'President': 'Presidente',
    'World Cup': 'Copa do Mundo',
    'Championship': 'Campeonato',
    'Super Bowl': 'Super Bowl',
    'Finals': 'Finais',
    'today': 'hoje',
    'tomorrow': 'amanhã',
    'this week': 'esta semana',
    'this month': 'este mês',
    'this year': 'este ano',
    'next': 'próximo',
    'before': 'antes de',
    'after': 'depois de',
    'in 2025': 'em 2025',
    'in 2026': 'em 2026',
    'in 2027': 'em 2027',
    'January': 'Janeiro',
    'February': 'Fevereiro',
    'March': 'Março',
    'April': 'Abril',
    'May': 'Maio',
    'June': 'Junho',
    'July': 'Julho',
    'August': 'Agosto',
    'September': 'Setembro',
    'October': 'Outubro',
    'November': 'Novembro',
    'December': 'Dezembro',
  };
  
  if (language === 'pt-BR') {
    for (const [en, trans] of Object.entries(ptBrWords)) {
      if (trans) {
        translated = translated.replace(new RegExp(`\\b${en}\\b`, 'gi'), trans);
      }
    }
  }
  
  return translated;
};

// Detect browser language and map to supported languages
const detectBrowserLanguage = (): Language => {
  const browserLang = navigator.language || (navigator as any).userLanguage || 'en';
  const langCode = browserLang.toLowerCase();
  
  // Check for exact matches first
  if (langCode === 'pt-br' || langCode.startsWith('pt')) return 'pt-BR';
  if (langCode === 'ko' || langCode.startsWith('ko')) return 'ko';
  if (langCode === 'ja' || langCode.startsWith('ja')) return 'ja';
  
  // Default to English
  return 'en';
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    if (saved) return saved as Language;
    
    // Auto-detect from browser if no saved preference
    return detectBrowserLanguage();
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  };

  const translateTitle = (title: string) => translatePredictionTitle(title, language);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: translations[language], translateTitle }}>
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
