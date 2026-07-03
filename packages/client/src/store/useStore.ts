import { create } from 'zustand'
import type { PairAnalysis, PriceData, UserSettings, Trade, TradeStats, TradeRecommendation, BasicPairData, BacktestResult, EntryCheckResult } from '@bottrade/shared'

interface AppState {
  // Auth
  authToken: string | null
  authUser: { id: number; email: string; name: string; role: string; plan?: string } | null
  authLoading: boolean
  // Favorite pairs: full analysis
  pairs: Record<string, PairAnalysis>
  // ALL pairs: basic price data
  allPairs: Record<string, BasicPairData>
  favorites: string[]
  settings: UserSettings
  connectionStatus: Record<string, boolean>
  serverConnected: boolean
  settingsOpen: boolean
  openTrades: Record<string, Trade>
  tradeStats: Record<string, TradeStats>
  globalStats: TradeStats | null
  tradeRecommendations: Record<string, TradeRecommendation>
  paperEntryChecks: Record<string, EntryCheckResult>
  historyOpen: boolean
  selectedPair: string | null
  sidebarCollapsed: boolean
  sidebarTab: 'favorites' | 'all'
  sidebarSearch: string
  tempAnalysis: PairAnalysis | null
  analyzingPair: string | null
  backtestOpen: boolean
  backtestResult: BacktestResult | null
  backtestRunning: boolean
  performanceOpen: boolean
  customAlertsOpen: boolean
  paperTradesOpen: boolean
  compareMode: boolean
  comparePairs: string[]  // max 3 symbols
  mobileSidebarOpen: boolean
  theme: 'dark' | 'light'
  onboardingComplete: boolean
  tourComplete: boolean
  adminOpen: boolean
  // Navigation
  currentPage: 'dashboard' | 'trade' | 'signals' | 'trades' | 'paper' | 'backtest' | 'settings' | 'alerts' | 'admin'
  navigateTo: (page: string) => void
  // Actions
  updatePrice: (symbol: string, price: PriceData) => void
  updateAnalysis: (analysis: PairAnalysis) => void
  setAllPairs: (pairs: BasicPairData[]) => void
  setFavorites: (favorites: string[]) => void
  setConnectionStatus: (symbol: string, connected: boolean) => void
  setServerConnected: (connected: boolean) => void
  setSettings: (settings: UserSettings) => void
  setSnapshot: (analyses: PairAnalysis[], openTrades?: Trade[], globalStats?: TradeStats | null, allPairs?: BasicPairData[], favorites?: string[]) => void
  toggleSettings: () => void
  setOpenTrade: (trade: Trade) => void
  removeOpenTrade: (symbol: string) => void
  setTradeStats: (symbol: string, stats: TradeStats) => void
  setGlobalStats: (stats: TradeStats | null) => void
  setTradeRecommendation: (symbol: string, recommendation: TradeRecommendation) => void
  setPaperEntryCheck: (symbol: string, check: EntryCheckResult) => void
  toggleHistory: () => void
  selectPair: (symbol: string) => void
  toggleSidebar: () => void
  setSidebarTab: (tab: 'favorites' | 'all') => void
  setSidebarSearch: (search: string) => void
  setTempAnalysis: (analysis: PairAnalysis | null) => void
  setAnalyzingPair: (symbol: string | null) => void
  toggleBacktest: () => void
  setBacktestResult: (result: BacktestResult | null) => void
  setBacktestRunning: (running: boolean) => void
  togglePerformance: () => void
  toggleCustomAlerts: () => void
  togglePaperTrades: () => void
  toggleCompareMode: () => void
  toggleMobileSidebar: () => void
  closeMobileSidebar: () => void
  addComparePair: (symbol: string) => void
  removeComparePair: (symbol: string) => void
  clearComparePairs: () => void
  toggleTheme: () => void
  toggleAdmin: () => void
  completeOnboarding: () => void
  completeTour: () => void
  login: (user: { id: number; email: string; name: string; role: string }, token: string) => void
  deleteAccount: () => Promise<boolean>
  exportData: () => Promise<void>
  logout: () => void
  checkAuth: (token?: string | null) => Promise<void>
}

const defaultSettings: UserSettings = {
  userMode: 'trader',
  baseCapital: 100,
  leverage: 5,
  fundingThreshold: 0.05,
  stochRsiHighThreshold: 90,
  stochRsiLowThreshold: 10,
  soundAlerts: true,
  desktopNotifications: false,
  pairs: ['ETHUSDT', 'BTCUSDT'],
  favorites: ['ETHUSDT', 'BTCUSDT'],
  indicatorToggles: {
    ma: true, ema: true, macd: true, stochRsi: true, volume: true,
    rsi: true, bollingerBands: true, atr: true, adx: true, vwap: true,
    williamsR: true, cci: true, mfi: true, obv: true, parabolicSar: true,
    openInterest: true, longShortRatio: true, fearGreed: true,
  },
  riskConfig: {
    slMode: 'auto',
    slFixedPercent: 1.5,
    atrMultiplier: 2.0,
    tpMode: 'rr',
    tpFixedPercent: 3.0,
    rrRatio: 2.0,
    useSmartMoneySR: true,
    minSlPercent: 0.5,
    maxSlPercent: 5.0,
  },
}

export const useStore = create<AppState>((set, get) => ({
  authToken: null,
  authUser: null,
  authLoading: true,
  pairs: {},
  allPairs: {},
  favorites: ['ETHUSDT', 'BTCUSDT'],
  settings: defaultSettings,
  connectionStatus: {},
  serverConnected: false,
  settingsOpen: false,
  openTrades: {},
  tradeStats: {},
  globalStats: null,
  tradeRecommendations: {},
  paperEntryChecks: {},
  historyOpen: false,
  selectedPair: null,
  sidebarCollapsed: false,
  sidebarTab: 'favorites',
  sidebarSearch: '',
  tempAnalysis: null,
  analyzingPair: null,
  backtestOpen: false,
  backtestResult: null,
  backtestRunning: false,
  performanceOpen: false,
  customAlertsOpen: false,
  paperTradesOpen: false,
  compareMode: false,
  comparePairs: [],
  mobileSidebarOpen: false,
  theme: (localStorage.getItem('bottrade-theme') as 'dark' | 'light') || 'dark',
  adminOpen: false,
  onboardingComplete: localStorage.getItem('bottrade_onboarded') === 'true',
  tourComplete: localStorage.getItem('bottrade_tour') === 'true',
  currentPage: 'dashboard',
  navigateTo: (page) => set({ currentPage: page as AppState['currentPage'] }),

  updatePrice: (symbol: string, price: PriceData) => {
    const existing = get().pairs[symbol]
    if (existing) {
      set({ pairs: { ...get().pairs, [symbol]: { ...existing, price } } })
    } else {
      const placeholder: PairAnalysis = {
        symbol,
        candles: [],
        indicators: {
          ma20: 0, ma50: 0, ma100: 0, ma200: 0,
          ema20: 0, ema50: 0,
          macd: { macd: 0, signal: 0, histogram: 0, trend: 'neutral', divergence: null },
          stochRsi: { k: 50, d: 50, zone: 'neutral', persistentOverbought: false, persistentOversold: false },
          volume: { current: 0, average: 0, isSpike: false, candleDirection: 'green' },
        },
        price,
        signal: {
          direction: 'NEUTRO',
          confluenceScore: 50,
          confidence: 'normal',
          alerts: [],
          riskManagement: null,
          criticalDecision: 'Aguardando dados...',
          actionPoints: ['Carregando indicadores — aguardando primeiro candle de 15min fechar'],
          overrides: [],
        },
        lastUpdate: 0,
      }
      set({ pairs: { ...get().pairs, [symbol]: placeholder } })
    }
  },

  updateAnalysis: (analysis: PairAnalysis) => {
    set({ pairs: { ...get().pairs, [analysis.symbol]: analysis } })
  },

  setAllPairs: (pairs: BasicPairData[]) => {
    if (pairs.length === 0 && Object.keys(get().allPairs).length > 0) return
    const record: Record<string, BasicPairData> = { ...get().allPairs }
    for (const p of pairs) {
      record[p.symbol] = { ...(record[p.symbol] ?? {}), ...p }
    }
    set({ allPairs: record })
  },

  setFavorites: (favorites: string[]) => {
    const currentSelected = get().selectedPair
    const allPairs = get().allPairs
    set({
      favorites,
      selectedPair: currentSelected && (favorites.includes(currentSelected) || allPairs[currentSelected])
        ? currentSelected
        : (favorites[0] ?? null),
    })
  },

  setConnectionStatus: (symbol: string, connected: boolean) => {
    set({ connectionStatus: { ...get().connectionStatus, [symbol]: connected } })
  },

  setServerConnected: (connected: boolean) => {
    set({ serverConnected: connected })
  },

  setSettings: (settings: UserSettings) => {
    const favorites = settings.favorites ?? settings.pairs
    const currentSelected = get().selectedPair
    const allPairs = get().allPairs
    set({
      settings,
      favorites,
      selectedPair: currentSelected && (favorites.includes(currentSelected) || allPairs[currentSelected])
        ? currentSelected
        : (favorites[0] ?? null),
    })
  },

  setSnapshot: (analyses: PairAnalysis[], openTrades?: Trade[], globalStats?: TradeStats | null, allPairs?: BasicPairData[], favorites?: string[]) => {
    const pairs: Record<string, PairAnalysis> = {}
    for (const analysis of analyses) {
      pairs[analysis.symbol] = analysis
    }
    const tradesRecord: Record<string, Trade> = {}
    if (openTrades) {
      for (const trade of openTrades) {
        tradesRecord[trade.symbol] = trade
      }
    }
    const allPairsRecord: Record<string, BasicPairData> = { ...get().allPairs }
    if (allPairs) {
      for (const p of allPairs) {
        allPairsRecord[p.symbol] = { ...(allPairsRecord[p.symbol] ?? {}), ...p }
      }
    }
    const nextFavorites = favorites ?? get().favorites
    const currentSelected = get().selectedPair
    const firstSymbol = analyses.length > 0 ? analyses[0].symbol : (nextFavorites[0] ?? null)
    const selectedPair = currentSelected && (nextFavorites.includes(currentSelected) || allPairsRecord[currentSelected]) ? currentSelected : firstSymbol
    set({
      pairs,
      openTrades: tradesRecord,
      globalStats: globalStats ?? null,
      selectedPair,
      ...(allPairs ? { allPairs: allPairsRecord } : {}),
      ...(favorites ? { favorites } : {}),
    })
  },

  toggleSettings: () => {
    set({ settingsOpen: !get().settingsOpen })
  },

  setOpenTrade: (trade: Trade) => {
    set({ openTrades: { ...get().openTrades, [trade.symbol]: trade } })
  },

  removeOpenTrade: (symbol: string) => {
    const { [symbol]: _, ...rest } = get().openTrades
    const { [symbol]: _r, ...restRec } = get().tradeRecommendations
    set({ openTrades: rest, tradeRecommendations: restRec })
  },

  setTradeStats: (symbol: string, stats: TradeStats) => {
    set({ tradeStats: { ...get().tradeStats, [symbol]: stats } })
  },

  setGlobalStats: (stats: TradeStats | null) => {
    set({ globalStats: stats })
  },

  setTradeRecommendation: (symbol: string, recommendation: TradeRecommendation) => {
    set({ tradeRecommendations: { ...get().tradeRecommendations, [symbol]: recommendation } })
  },

  setPaperEntryCheck: (symbol: string, check: EntryCheckResult) => {
    set({ paperEntryChecks: { ...get().paperEntryChecks, [symbol]: check } })
  },

  toggleHistory: () => {
    set({ historyOpen: !get().historyOpen })
  },

  selectPair: (symbol: string) => {
    set({ selectedPair: symbol })
  },

  toggleSidebar: () => {
    set({ sidebarCollapsed: !get().sidebarCollapsed })
  },

  setSidebarTab: (tab: 'favorites' | 'all') => {
    set({ sidebarTab: tab })
  },

  setSidebarSearch: (search: string) => {
    set({ sidebarSearch: search })
  },

  setTempAnalysis: (analysis: PairAnalysis | null) => {
    set({ tempAnalysis: analysis })
  },

  setAnalyzingPair: (symbol: string | null) => {
    set({ analyzingPair: symbol })
  },

  toggleBacktest: () => {
    set({ backtestOpen: !get().backtestOpen })
  },

  setBacktestResult: (result: BacktestResult | null) => {
    set({ backtestResult: result })
  },

  setBacktestRunning: (running: boolean) => {
    set({ backtestRunning: running })
  },

  togglePerformance: () => {
    set({ performanceOpen: !get().performanceOpen })
  },

  toggleCustomAlerts: () => {
    set({ customAlertsOpen: !get().customAlertsOpen })
  },

  togglePaperTrades: () => {
    set({ paperTradesOpen: !get().paperTradesOpen })
  },

  toggleCompareMode: () => {
    const current = get().compareMode
    set({ compareMode: !current, comparePairs: current ? [] : get().comparePairs })
  },

  toggleMobileSidebar: () => {
    set({ mobileSidebarOpen: !get().mobileSidebarOpen })
  },

  closeMobileSidebar: () => {
    set({ mobileSidebarOpen: false })
  },

  addComparePair: (symbol: string) => {
    const { comparePairs } = get()
    if (comparePairs.length < 3 && !comparePairs.includes(symbol)) {
      set({ comparePairs: [...comparePairs, symbol] })
    }
  },

  removeComparePair: (symbol: string) => {
    set({ comparePairs: get().comparePairs.filter((s) => s !== symbol) })
  },

  clearComparePairs: () => {
    set({ comparePairs: [] })
  },

  completeOnboarding: () => {
    localStorage.setItem('bottrade_onboarded', 'true')
    set({ onboardingComplete: true })
  },

  completeTour: () => {
    localStorage.setItem('bottrade_tour', 'true')
    set({ tourComplete: true })
  },

  toggleAdmin: () => {
    set({ adminOpen: !get().adminOpen })
  },

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem('bottrade-theme', next)
    document.documentElement.setAttribute('data-theme', next)
    set({ theme: next })
  },

  deleteAccount: async () => {
    const token = get().authToken
    if (!token) return false
    try {
      const res = await fetch('/api/account', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) return false
      get().logout()
      return true
    } catch {
      return false
    }
  },

  exportData: async () => {
    const token = get().authToken
    if (!token) return
    try {
      const res = await fetch('/api/account/export', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) return
      const data = await res.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bottrade-export-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // silent fail
    }
  },

  login: (user, token) => {
    set({ authToken: token, authUser: user, authLoading: false })
  },

  logout: () => {
    set({ authToken: null, authUser: null, authLoading: false })
  },

  checkAuth: async (token) => {
    if (!token) {
      set({ authToken: null, authUser: null, authLoading: false })
      return
    }
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        console.warn('[Auth] /api/auth/me failed:', res.status, body)
        throw new Error('Invalid token')
      }
      const data = await res.json()
      set({ authToken: token, authUser: data.user, authLoading: false })
    } catch (err) {
      console.warn('[Auth] Failed to load current user:', err)
      set({ authToken: null, authUser: null, authLoading: false })
    }
  },
}))
