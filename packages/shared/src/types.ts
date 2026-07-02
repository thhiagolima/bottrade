export interface CandleData {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface IndicatorValues {
  ma20: number; ma50: number; ma100: number; ma200: number
  ema20: number; ema50: number
  macd: { macd: number; signal: number; histogram: number; trend: 'bullish' | 'bearish' | 'neutral'; divergence: 'bullish' | 'bearish' | null }
  stochRsi: { k: number; d: number; zone: 'overbought' | 'oversold' | 'neutral'; persistentOverbought: boolean; persistentOversold: boolean }
  volume: { current: number; average: number; isSpike: boolean; candleDirection: 'green' | 'red' }
  // New indicators
  rsi?: { value: number; zone: 'overbought' | 'oversold' | 'neutral'; divergence: 'bullish' | 'bearish' | null }
  bollingerBands?: { upper: number; middle: number; lower: number; width: number; percentB: number; squeeze: boolean }
  atr?: { value: number; percent: number }
  adx?: { value: number; plusDI: number; minusDI: number; trending: boolean }
  vwap?: { value: number; priceAbove: boolean }
  williamsR?: { value: number; zone: 'overbought' | 'oversold' | 'neutral' }
  cci?: { value: number; zone: 'overbought' | 'oversold' | 'neutral' }
  mfi?: { value: number; zone: 'overbought' | 'oversold' | 'neutral' }
  obv?: { value: number; trend: 'rising' | 'falling' | 'flat' }
  parabolicSar?: { value: number; trend: 'bullish' | 'bearish' }
  smartMoney?: SmartMoneyData
}

export interface FVG {
  type: 'bullish' | 'bearish'
  top: number
  bottom: number
  timestamp: number
  filled: boolean
}

export interface OrderBlock {
  type: 'bullish' | 'bearish'
  high: number
  low: number
  timestamp: number
  strength: number // 1-3 based on move strength after OB
}

export interface StructureBreak {
  type: 'BOS' | 'CHoCH'
  direction: 'bullish' | 'bearish'
  level: number
  timestamp: number
}

export interface CandlePattern {
  name: string  // 'Bullish Engulfing', 'Bearish Engulfing', 'Hammer', 'Shooting Star', 'Doji', 'Pin Bar', 'Morning Star', 'Evening Star'
  type: 'bullish' | 'bearish' | 'neutral'
  significance: 'strong' | 'moderate' | 'weak'
  timestamp: number
}

export interface SRZone {
  level: number
  type: 'support' | 'resistance'
  touches: number  // how many times price reacted
  strength: 'strong' | 'moderate' | 'weak'
}

export interface SmartMoneyData {
  fvgs: FVG[]           // recent unfilled FVGs (max 5)
  orderBlocks: OrderBlock[]  // recent OBs (max 5)
  structureBreaks: StructureBreak[]  // recent BOS/CHoCH (max 3)
  candlePatterns: CandlePattern[]    // recent patterns (max 3)
  srZones: SRZone[]      // key S/R levels (max 5)
  liquiditySweep: { detected: boolean; direction: 'bullish' | 'bearish' | null; level: number | null }
  trend: 'bullish' | 'bearish' | 'ranging'  // based on structure
}

export interface ExternalData {
  openInterest?: { value: number; change: number; trend: 'rising' | 'falling' | 'stable' }
  longShortRatio?: { ratio: number; longPercent: number; shortPercent: number; crowded: 'long' | 'short' | 'neutral' }
  fearGreed?: { value: number; label: string }
}

export interface IndicatorToggles {
  ma: boolean
  ema: boolean
  macd: boolean
  stochRsi: boolean
  volume: boolean
  rsi: boolean
  bollingerBands: boolean
  atr: boolean
  adx: boolean
  vwap: boolean
  williamsR?: boolean
  cci?: boolean
  mfi?: boolean
  obv?: boolean
  parabolicSar?: boolean
  openInterest: boolean
  longShortRatio: boolean
  fearGreed: boolean
}

export interface PriceData {
  symbol: string
  price: number
  markPrice: number
  change24h: number
  volume24h: number
  fundingRate: number
  fundingCountdown: string // formato "HH:MM:SS"
}

export interface RiskManagement {
  entry: number
  stopLoss: number
  takeProfit: number
  stopLossPercent: number
  takeProfitPercent: number
  positionSize: number
  margin: number
  riskRewardRatio: number
  leverage: number
}

export interface Alert {
  type: 'direction-change' | 'funding-extreme' | 'stochrsi-extreme' | 'full-alignment'
  symbol: string
  message: string
  severity: 'info' | 'warning' | 'critical'
  timestamp: number
}

export interface SignalData {
  direction: 'LONG' | 'SHORT' | 'NEUTRO'
  confluenceScore: number
  confidence: 'normal' | 'high'
  alerts: Alert[]
  riskManagement: RiskManagement | null // null quando NEUTRO
  criticalDecision: string
  actionPoints: string[]
  entryTrigger?: string
  reversalTrigger?: string
  overrides: string[]
}

export interface TimeframeAnalysis {
  interval: '15m' | '1h' | '4h'
  direction: 'LONG' | 'SHORT' | 'NEUTRO'
  score: number
  trend: string // e.g. "Bullish", "Bearish", "Lateral"
  keyLevels: { ma20: number; ma50: number; ma200: number }
}

export interface MultiTimeframeData {
  '15m': TimeframeAnalysis
  '1h': TimeframeAnalysis | null
  '4h': TimeframeAnalysis | null
  alignment: 'aligned' | 'conflicting' | 'partial'
  summary: string // e.g. "15min: LONG | 1h: NEUTRO | 4h: SHORT → conflito"
}

export interface PairAnalysis {
  symbol: string
  candles: CandleData[]
  indicators: IndicatorValues
  price: PriceData
  signal: SignalData
  lastUpdate: number
  multiTimeframe?: MultiTimeframeData
  externalData?: ExternalData
  entryCheck?: EntryCheckResult
  btcCorrelation?: {
    btcDirection: 'LONG' | 'SHORT' | 'NEUTRO'
    btcScore: number
    aligned: boolean
    warning: string | null
  }
}

export interface CustomAlert {
  id: string
  symbol: string
  condition: 'price_above' | 'price_below' | 'score_above' | 'score_below' | 'funding_above' | 'funding_below'
  value: number
  message: string
  triggered: boolean
  createdAt: string
}

export interface AutoTradeConfig {
  enabled: boolean
  mode: 'semi' | 'auto'  // semi = needs confirm, auto = executes automatically
  maxOpenTrades: number   // max concurrent trades (default 3)
  maxDailyTrades: number  // max trades per day (default 10)
  allowedPairs: string[]  // empty = all favorites
}

export interface OrderRequest {
  symbol: string
  side: 'BUY' | 'SELL'
  type: 'MARKET'
  quantity: number
  stopLoss: number
  takeProfit: number
}

export interface OrderResult {
  success: boolean
  orderId?: string
  symbol: string
  side: string
  price?: number
  quantity?: number
  error?: string
  timestamp: number
}

export interface WebhookConfig {
  url: string
  type: 'discord' | 'slack' | 'custom'
  events: string[] // 'trade_opened', 'trade_closed', 'high_confidence'
  active: boolean
}

export type UserMode = 'simple' | 'trader' | 'pro'

export interface ScoreConfig {
  longThreshold?: number
  shortThreshold?: number
  highConfidenceLong?: number
  highConfidenceShort?: number
  weights?: {
    structure?: number
    macd?: number
    stochRsi?: number
    volume?: number
    funding?: number
    emaAlignment?: number
  }
}

export interface StrategyProfile {
  id: string
  name: string
  scoreConfig?: ScoreConfig
  riskConfig?: RiskConfig
  indicatorToggles?: IndicatorToggles
  indicatorPeriods?: UserSettings['indicatorPeriods']
}

export interface RiskConfig {
  slMode: 'auto' | 'atr' | 'fixed'   // auto = ATR + MAs + S/R, atr = ATR only, fixed = percentage
  slFixedPercent: number              // used when slMode='fixed' (e.g. 1.5 means 1.5%)
  atrMultiplier: number               // ATR multiplier for SL distance (default 2.0)
  tpMode: 'rr' | 'fixed'             // rr = risk:reward ratio, fixed = percentage
  tpFixedPercent: number              // used when tpMode='fixed' (e.g. 3.0 means 3%)
  rrRatio: number                     // R:R ratio when tpMode='rr' (default 2.0)
  useSmartMoneySR: boolean            // adjust SL/TP with S/R zones
  minSlPercent: number                // minimum SL distance % (default 0.5)
  maxSlPercent: number                // maximum SL distance % (default 5.0)
}

export interface UserSettings {
  userMode: UserMode          // padrão 'trader'
  baseCapital: number        // padrão R$100
  leverage: number           // padrão 5
  fundingThreshold: number   // padrão 0.05
  stochRsiHighThreshold: number  // padrão 90
  stochRsiLowThreshold: number   // padrão 10
  soundAlerts: boolean
  desktopNotifications: boolean
  pairs: string[]            // pares com kline + indicadores (favoritos)
  favorites: string[]        // pares favoritados pelo usuário
  customAlerts?: CustomAlert[]
  telegramBotToken?: string
  telegramChatId?: string
  binanceApiKey?: string
  binanceApiSecret?: string
  autoTrade?: AutoTradeConfig
  indicatorToggles?: IndicatorToggles
  webhooks?: WebhookConfig[]
  // Score configuration (advanced)
  scoreConfig?: ScoreConfig
  riskConfig?: RiskConfig
  indicatorPeriods?: {
    rsiPeriod?: number       // default 14
    stochRsiPeriod?: number  // default 14
    stochRsiK?: number       // default 3
    stochRsiD?: number       // default 3
    macdFast?: number        // default 12
    macdSlow?: number        // default 26
    macdSignal?: number      // default 9
    bollingerPeriod?: number // default 20
    bollingerStdDev?: number // default 2
    atrPeriod?: number       // default 14
    adxPeriod?: number       // default 14
    cciPeriod?: number       // default 20
    mfiPeriod?: number       // default 14
    williamsRPeriod?: number // default 14
  }
  strategyProfiles?: StrategyProfile[]
  pairProfileAssignments?: Record<string, string>
  paperProfileAssignments?: Record<string, string>
}

export interface HeatScore {
  score: number           // 0-100
  label: 'QUENTE' | 'MORNO' | 'FRIO'
  reasons: string[]       // e.g. ["Funding -0.08% — possível squeeze", "Alta +8.5%"]
  momentum: number        // 0-35 points
  fundingPressure: number // 0-35 points
  volumeRank: number      // 0-30 points
}

export interface BasicPairData {
  symbol: string
  price: number
  change24h: number
  volume24h: number
  fundingRate: number
  markPrice: number
  heatScore?: HeatScore
  confluenceScore?: number
  signalDirection?: 'LONG' | 'SHORT' | 'NEUTRO'
}

// Registro de sinal retornado pelo histórico (mapeamento da tabela signals)
export interface SignalRecord {
  id: number
  symbol: string
  direction: 'LONG' | 'SHORT' | 'NEUTRO'
  confluenceScore: number
  confidence: 'normal' | 'high'
  entryPrice: number
  stopLoss: number | null
  takeProfit: number | null
  riskRewardRatio: number | null
  fundingRate: number | null
  criticalDecision: string | null
  actionPoints: string[]
  overrides: string[]
  createdAt: string // ISO 8601
}

export interface Trade {
  id?: number
  symbol: string
  direction: 'LONG' | 'SHORT'
  entryPrice: number
  stopLoss: number
  takeProfit: number
  exitPrice: number | null
  result: 'WIN' | 'LOSS' | null
  exitReason?: 'TP' | 'SL' | 'SCORE_EXIT' | 'TIME_STOP' | 'TRAILING_SL'
  pnlPercent: number | null
  confluenceScore: number
  status: 'OPEN' | 'CLOSED'
  openedAt: string
  closedAt: string | null
  // Partial TP tracking
  partialTpPrice?: number | null  // price when partial TP was taken
  partialTpPnl?: number | null    // P&L% at partial TP
  partialTpAt?: string | null     // timestamp of partial TP
  // Runtime state (not persisted in DB)
  currentStopLoss?: number
  partialClosed?: boolean
  candleCount?: number
  peakPnl?: number
}

export interface EntryFilter {
  name: string
  passed: boolean
  detail: string
}

export interface EntryCheckResult {
  allowed: boolean
  filters: EntryFilter[]
  passedCount: number
  totalCount: number
}

export interface TradeRecommendation {
  type: 'HOLD' | 'PARTIAL_50' | 'PARTIAL_75' | 'CLOSE_100' | 'MOVE_SL'
  message: string
  reasons: string[]
  unrealizedPnl: number
  suggestedAction: string
  newStopLoss?: number
}

export interface TradeStats {
  symbol: string | null
  totalTrades: number
  wins: number
  losses: number
  winRate: number
  avgWinPnl: number
  avgLossPnl: number
  bestTrade: number
  worstTrade: number
}

// ── Performance ──────────────────────────────────────────────

export interface PerformanceData {
  equityCurve: { timestamp: string; equity: number; trade: { symbol: string; direction: string; pnlPercent: number } }[]
  bySymbol: { symbol: string; trades: number; wins: number; losses: number; winRate: number; pnl: number }[]
  byDirection: { direction: string; trades: number; wins: number; losses: number; winRate: number; pnl: number }[]
  byPeriod: { period: string; trades: number; wins: number; pnl: number }[]
  maxDrawdown: number
  bestDay: { date: string; pnl: number }
  worstDay: { date: string; pnl: number }
  totalPnl: number
  winRate: number
  totalTrades: number
  profitFactor: number
  recentTrades: Trade[]
}

// ── Backtest ──────────────────────────────────────────────

export interface BacktestParams {
  symbols: string[]           // pares para testar
  period: '7d' | '30d' | '90d'
  scoreThreshold: number      // score mínimo para abrir trade (padrão: 85)
  leverage: number
  baseCapital: number
}

export interface BacktestTrade {
  symbol: string
  direction: 'LONG' | 'SHORT'
  entryPrice: number
  exitPrice: number
  stopLoss: number
  takeProfit: number
  result: 'WIN' | 'LOSS'
  pnlPercent: number
  pnlValue: number
  score: number
  entryTime: number
  exitTime: number
}

// ── Plans ───────────────────────────────────────────────────────────

export type PlanType = 'free' | 'pro' | 'trader'

export interface PlanLimits {
  maxFavorites: number
  maxBacktestsPerDay: number
  multiTimeframe: boolean
  paperTrading: boolean
  backtest: boolean
  autoTrade: boolean
  executeOrders: boolean
  telegramAlerts: boolean
  customAlerts: boolean
  allIndicators: boolean
  exportData: boolean
  apiAccess: boolean
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  free: {
    maxFavorites: 3,
    maxBacktestsPerDay: 1,
    multiTimeframe: false,
    paperTrading: false,
    backtest: false,
    autoTrade: false,
    executeOrders: false,
    telegramAlerts: false,
    customAlerts: false,
    allIndicators: false,
    exportData: false,
    apiAccess: false,
  },
  pro: {
    maxFavorites: 999,
    maxBacktestsPerDay: 10,
    multiTimeframe: true,
    paperTrading: true,
    backtest: true,
    autoTrade: false,
    executeOrders: false,
    telegramAlerts: true,
    customAlerts: true,
    allIndicators: true,
    exportData: true,
    apiAccess: false,
  },
  trader: {
    maxFavorites: 999,
    maxBacktestsPerDay: 999,
    multiTimeframe: true,
    paperTrading: true,
    backtest: true,
    autoTrade: true,
    executeOrders: true,
    telegramAlerts: true,
    customAlerts: true,
    allIndicators: true,
    exportData: true,
    apiAccess: true,
  },
}

export interface BacktestResult {
  params: BacktestParams
  trades: BacktestTrade[]
  stats: {
    totalTrades: number
    wins: number
    losses: number
    winRate: number
    totalPnlPercent: number
    totalPnlValue: number
    avgWinPnl: number
    avgLossPnl: number
    bestTrade: number
    worstTrade: number
    maxDrawdown: number
    profitFactor: number
    sharpeRatio: number
  }
  equityCurve: { timestamp: number; equity: number }[]
  perSymbol: Record<string, {
    trades: number
    winRate: number
    pnl: number
  }>
}
