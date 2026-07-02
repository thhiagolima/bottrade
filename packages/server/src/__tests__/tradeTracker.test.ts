import { describe, it, expect, vi, beforeEach } from 'vitest'
import type {
  SignalData, IndicatorValues, PriceData, UserSettings,
  MultiTimeframeData, ExternalData, Trade,
} from '@bottrade/shared'

// Mock the database module
vi.mock('../database.js', () => ({
  pool: { execute: vi.fn(), getConnection: vi.fn() },
  insertTrade: vi.fn().mockResolvedValue(1),
  closeTrade: vi.fn().mockResolvedValue(undefined),
  updatePartialTp: vi.fn().mockResolvedValue(undefined),
  updateTradeRuntimeState: vi.fn().mockResolvedValue(undefined),
  getOpenTrades: vi.fn().mockResolvedValue([]),
  getTradeHistory: vi.fn().mockResolvedValue({ trades: [], total: 0 }),
  getTradeStats: vi.fn().mockResolvedValue({ totalTrades: 0, wins: 0, losses: 0, winRate: 0, avgWinPnl: 0, avgLossPnl: 0, bestTrade: 0, worstTrade: 0, symbol: null }),
}))

import { TradeTracker } from '../tradeTracker.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeIndicators(overrides: Partial<IndicatorValues> = {}): IndicatorValues {
  return {
    ma20: 100, ma50: 98, ma100: 95, ma200: 90,
    ema20: 101, ema50: 99,
    macd: { macd: 1, signal: 0.5, histogram: 0.5, trend: 'bullish', divergence: null },
    stochRsi: { k: 50, d: 45, zone: 'neutral', persistentOverbought: false, persistentOversold: false },
    volume: { current: 1000, average: 800, isSpike: false, candleDirection: 'green' },
    adx: { value: 30, plusDI: 25, minusDI: 15, trending: true },
    ...overrides,
  }
}

function makePrice(overrides: Partial<PriceData> = {}): PriceData {
  return {
    symbol: 'ETHUSDT',
    price: 105,
    markPrice: 105.1,
    change24h: 2.5,
    volume24h: 500000,
    fundingRate: 0.0001,
    fundingCountdown: '04:00:00',
    ...overrides,
  }
}

function makeSettings(overrides: Partial<UserSettings> = {}): UserSettings {
  return {
    userMode: 'pro',
    baseCapital: 100,
    leverage: 5,
    fundingThreshold: 0.05,
    stochRsiHighThreshold: 90,
    stochRsiLowThreshold: 10,
    soundAlerts: true,
    desktopNotifications: false,
    pairs: ['ETHUSDT', 'BTCUSDT'],
    favorites: ['ETHUSDT', 'BTCUSDT'],
    ...overrides,
  }
}

function makeHighConfidenceLongSignal(): SignalData {
  return {
    direction: 'LONG',
    confluenceScore: 90,
    confidence: 'high',
    alerts: [],
    riskManagement: {
      entry: 100, stopLoss: 98, takeProfit: 106,
      stopLossPercent: 2, takeProfitPercent: 6,
      positionSize: 500, margin: 100, riskRewardRatio: 3, leverage: 5,
    },
    criticalDecision: '',
    actionPoints: [],
    overrides: [],
  }
}

function makeMultiTimeframe(): MultiTimeframeData {
  return {
    '15m': { interval: '15m', direction: 'LONG', score: 85, trend: 'Bullish', keyLevels: { ma20: 100, ma50: 98, ma200: 90 } },
    '1h': { interval: '1h', direction: 'LONG', score: 75, trend: 'Bullish', keyLevels: { ma20: 100, ma50: 98, ma200: 90 } },
    '4h': { interval: '4h', direction: 'LONG', score: 70, trend: 'Bullish', keyLevels: { ma20: 100, ma50: 98, ma200: 90 } },
    alignment: 'aligned',
    summary: '15m: LONG | 1h: LONG | 4h: LONG',
  }
}

function makeExternalData(): ExternalData {
  return {
    longShortRatio: { ratio: 0.8, longPercent: 44, shortPercent: 56, crowded: 'short' },
  }
}

function makeTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: 1,
    symbol: 'ETHUSDT',
    direction: 'LONG',
    entryPrice: 100,
    stopLoss: 98,
    takeProfit: 106,
    exitPrice: null,
    result: null,
    pnlPercent: null,
    confluenceScore: 90,
    status: 'OPEN',
    openedAt: new Date().toISOString(),
    closedAt: null,
    currentStopLoss: 98,
    partialClosed: false,
    candleCount: 0,
    peakPnl: 0,
    ...overrides,
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('TradeTracker.evaluateEntryFilters', () => {
  let tracker: TradeTracker

  beforeEach(() => {
    tracker = new TradeTracker()
    tracker.userId = 1
  })

  it('blocks entry when trade is already open for symbol', () => {
    // Simulate open trade
    tracker.getOpenTradesMap().set('ETHUSDT', makeTrade())

    const signal = makeHighConfidenceLongSignal()
    const result = tracker.evaluateEntryFilters('ETHUSDT', signal, makePrice(), makeIndicators(), makeSettings())
    expect(result.allowed).toBe(false)
    expect(result.filters[0].name).toBe('Trade Aberto')
  })

  it('blocks entry when signal is not high confidence', () => {
    const signal: SignalData = {
      ...makeHighConfidenceLongSignal(),
      confidence: 'normal',
      confluenceScore: 60,
    }
    const result = tracker.evaluateEntryFilters('ETHUSDT', signal, makePrice(), makeIndicators(), makeSettings())
    expect(result.allowed).toBe(false)
    expect(result.filters[0].name).toBe('Alta Confiança')
  })

  it('blocks entry when direction is NEUTRO', () => {
    const signal: SignalData = {
      ...makeHighConfidenceLongSignal(),
      direction: 'NEUTRO',
    }
    const result = tracker.evaluateEntryFilters('ETHUSDT', signal, makePrice(), makeIndicators(), makeSettings())
    expect(result.allowed).toBe(false)
  })

  it('blocks entry when no risk management', () => {
    const signal: SignalData = {
      ...makeHighConfidenceLongSignal(),
      riskManagement: null,
    }
    const result = tracker.evaluateEntryFilters('ETHUSDT', signal, makePrice(), makeIndicators(), makeSettings())
    expect(result.allowed).toBe(false)
  })

  it('allows entry when all filters pass', () => {
    const signal = makeHighConfidenceLongSignal()
    const result = tracker.evaluateEntryFilters(
      'ETHUSDT', signal, makePrice(), makeIndicators(), makeSettings(),
      makeMultiTimeframe(), makeExternalData(),
    )
    expect(result.allowed).toBe(true)
    expect(result.passedCount).toBe(result.totalCount)
  })

  it('blocks when volume is below 80% of average', () => {
    const indicators = makeIndicators({
      volume: { current: 500, average: 1000, isSpike: false, candleDirection: 'green' },
    })
    const signal = makeHighConfidenceLongSignal()
    const result = tracker.evaluateEntryFilters(
      'ETHUSDT', signal, makePrice(), indicators, makeSettings(),
      makeMultiTimeframe(), makeExternalData(),
    )
    const volFilter = result.filters.find(f => f.name === 'Volume')
    expect(volFilter).toBeDefined()
    expect(volFilter!.passed).toBe(false)
  })

  it('blocks during funding blackout (within 30 min)', () => {
    const price = makePrice({ fundingCountdown: '00:15:00' })
    const signal = makeHighConfidenceLongSignal()
    const result = tracker.evaluateEntryFilters(
      'ETHUSDT', signal, price, makeIndicators(), makeSettings(),
      makeMultiTimeframe(), makeExternalData(),
    )
    const fundingFilter = result.filters.find(f => f.name === 'Funding Timing')
    expect(fundingFilter).toBeDefined()
    expect(fundingFilter!.passed).toBe(false)
  })

  it('allows entry outside funding blackout', () => {
    const price = makePrice({ fundingCountdown: '02:00:00' })
    const signal = makeHighConfidenceLongSignal()
    const result = tracker.evaluateEntryFilters(
      'ETHUSDT', signal, price, makeIndicators(), makeSettings(),
      makeMultiTimeframe(), makeExternalData(),
    )
    const fundingFilter = result.filters.find(f => f.name === 'Funding Timing')
    expect(fundingFilter!.passed).toBe(true)
  })

  it('blocks when crowd is in same direction as signal (L/S ratio)', () => {
    const externalData: ExternalData = {
      longShortRatio: { ratio: 1.5, longPercent: 60, shortPercent: 40, crowded: 'long' },
    }
    const signal = makeHighConfidenceLongSignal() // LONG signal, crowd is LONG = block
    const result = tracker.evaluateEntryFilters(
      'ETHUSDT', signal, makePrice(), makeIndicators(), makeSettings(),
      makeMultiTimeframe(), externalData,
    )
    const lsFilter = result.filters.find(f => f.name === 'Long/Short Ratio')
    expect(lsFilter).toBeDefined()
    expect(lsFilter!.passed).toBe(false)
  })

  it('marks multi-timeframe filter as passed (ignored) when data unavailable', () => {
    const signal = makeHighConfidenceLongSignal()
    const result = tracker.evaluateEntryFilters(
      'ETHUSDT', signal, makePrice(), makeIndicators(), makeSettings(),
      undefined, makeExternalData(),
    )
    const mtfFilter = result.filters.find(f => f.name === 'Multi-Timeframe')
    expect(mtfFilter!.passed).toBe(true)
    expect(mtfFilter!.detail).toContain('ignorado')
  })

  it('blocks when multi-timeframe is not aligned', () => {
    const mtf: MultiTimeframeData = {
      '15m': { interval: '15m', direction: 'LONG', score: 85, trend: 'Bullish', keyLevels: { ma20: 100, ma50: 98, ma200: 90 } },
      '1h': { interval: '1h', direction: 'SHORT', score: 30, trend: 'Bearish', keyLevels: { ma20: 100, ma50: 98, ma200: 90 } },
      '4h': { interval: '4h', direction: 'SHORT', score: 25, trend: 'Bearish', keyLevels: { ma20: 100, ma50: 98, ma200: 90 } },
      alignment: 'conflicting',
      summary: '15m: LONG | 1h: SHORT | 4h: SHORT',
    }
    const signal = makeHighConfidenceLongSignal()
    const result = tracker.evaluateEntryFilters(
      'ETHUSDT', signal, makePrice(), makeIndicators(), makeSettings(),
      mtf, makeExternalData(),
    )
    const mtfFilter = result.filters.find(f => f.name === 'Multi-Timeframe')
    expect(mtfFilter!.passed).toBe(false)
  })

  it('returns correct passedCount and totalCount', () => {
    const signal = makeHighConfidenceLongSignal()
    const result = tracker.evaluateEntryFilters(
      'ETHUSDT', signal, makePrice(), makeIndicators(), makeSettings(),
      makeMultiTimeframe(), makeExternalData(),
    )
    expect(result.totalCount).toBe(result.filters.length)
    expect(result.passedCount).toBe(result.filters.filter(f => f.passed).length)
  })
})

// ── checkPriceForExits ────────────────────────────────────────────────────

describe('TradeTracker.checkPriceForExits', () => {
  let tracker: TradeTracker

  beforeEach(() => {
    tracker = new TradeTracker()
    tracker.userId = 1
  })

  it('does nothing when no open trade for symbol', async () => {
    await tracker.checkPriceForExits('ETHUSDT', 100)
    // Should not throw or emit
  })

  it('does nothing for invalid price', async () => {
    tracker.getOpenTradesMap().set('ETHUSDT', makeTrade())
    await tracker.checkPriceForExits('ETHUSDT', 0)
    await tracker.checkPriceForExits('ETHUSDT', -1)
    // Trade should still be open
    expect(tracker.getOpenTradesMap().has('ETHUSDT')).toBe(true)
  })

  it('closes LONG trade on take profit hit', async () => {
    const trade = makeTrade({ entryPrice: 100, takeProfit: 106, stopLoss: 98 })
    tracker.getOpenTradesMap().set('ETHUSDT', trade)

    const closedEvents: unknown[] = []
    tracker.on('trade-closed', (data) => closedEvents.push(data))

    await tracker.checkPriceForExits('ETHUSDT', 107) // above TP
    expect(tracker.getOpenTradesMap().has('ETHUSDT')).toBe(false)
    expect(closedEvents).toHaveLength(1)
    expect((closedEvents[0] as Trade).result).toBe('WIN')
  })

  it('closes LONG trade on stop loss hit', async () => {
    const trade = makeTrade({ entryPrice: 100, takeProfit: 106, stopLoss: 98, currentStopLoss: 98 })
    tracker.getOpenTradesMap().set('ETHUSDT', trade)

    const closedEvents: unknown[] = []
    tracker.on('trade-closed', (data) => closedEvents.push(data))

    await tracker.checkPriceForExits('ETHUSDT', 97) // below SL
    expect(tracker.getOpenTradesMap().has('ETHUSDT')).toBe(false)
    expect(closedEvents).toHaveLength(1)
    expect((closedEvents[0] as Trade).result).toBe('LOSS')
  })

  it('closes SHORT trade on take profit hit', async () => {
    const trade = makeTrade({
      direction: 'SHORT', entryPrice: 100, takeProfit: 94, stopLoss: 102, currentStopLoss: 102,
    })
    tracker.getOpenTradesMap().set('ETHUSDT', trade)

    const closedEvents: unknown[] = []
    tracker.on('trade-closed', (data) => closedEvents.push(data))

    await tracker.checkPriceForExits('ETHUSDT', 93)
    expect((closedEvents[0] as Trade).result).toBe('WIN')
  })

  it('closes SHORT trade on stop loss hit', async () => {
    const trade = makeTrade({
      direction: 'SHORT', entryPrice: 100, takeProfit: 94, stopLoss: 102, currentStopLoss: 102,
    })
    tracker.getOpenTradesMap().set('ETHUSDT', trade)

    const closedEvents: unknown[] = []
    tracker.on('trade-closed', (data) => closedEvents.push(data))

    await tracker.checkPriceForExits('ETHUSDT', 103)
    expect((closedEvents[0] as Trade).result).toBe('LOSS')
  })

  it('triggers partial TP and moves SL to breakeven for LONG', async () => {
    const trade = makeTrade({
      entryPrice: 100, stopLoss: 98, takeProfit: 106,
      currentStopLoss: 98, partialClosed: false,
    })
    tracker.getOpenTradesMap().set('ETHUSDT', trade)

    const partialEvents: unknown[] = []
    tracker.on('trade-partial', (data) => partialEvents.push(data))

    // Price at 1:1 R:R (risk = 2, so partial at 102)
    await tracker.checkPriceForExits('ETHUSDT', 102)

    expect(trade.partialClosed).toBe(true)
    expect(trade.currentStopLoss).toBe(100) // moved to breakeven
    expect(partialEvents).toHaveLength(1)
  })

  it('triggers partial TP for SHORT at 1:1 R:R', async () => {
    const trade = makeTrade({
      direction: 'SHORT', entryPrice: 100, stopLoss: 102, takeProfit: 94,
      currentStopLoss: 102, partialClosed: false,
    })
    tracker.getOpenTradesMap().set('ETHUSDT', trade)

    // Risk = 2, so partial at 98
    await tracker.checkPriceForExits('ETHUSDT', 97.5)
    expect(trade.partialClosed).toBe(true)
    expect(trade.currentStopLoss).toBe(100)
  })

  it('tracks peak P&L', async () => {
    const trade = makeTrade({ entryPrice: 100, stopLoss: 98, takeProfit: 110, peakPnl: 0 })
    tracker.getOpenTradesMap().set('ETHUSDT', trade)

    await tracker.checkPriceForExits('ETHUSDT', 101) // +1%
    expect(trade.peakPnl).toBe(1)

    await tracker.checkPriceForExits('ETHUSDT', 103) // +3%
    expect(trade.peakPnl).toBe(3)

    await tracker.checkPriceForExits('ETHUSDT', 101.5) // drop to +1.5%, peak should stay at 3
    expect(trade.peakPnl).toBe(3)
  })
})

// ── generateRecommendation ────────────────────────────────────────────────

describe('TradeTracker.generateRecommendation', () => {
  let tracker: TradeTracker

  beforeEach(() => {
    tracker = new TradeTracker()
  })

  it('recommends HOLD when no contra signals', () => {
    const trade = makeTrade()
    const signal: SignalData = {
      direction: 'LONG', confluenceScore: 85, confidence: 'high',
      alerts: [], riskManagement: null, criticalDecision: '', actionPoints: [], overrides: [],
    }
    const indicators = makeIndicators()
    const price = makePrice({ price: 101 })

    const rec = tracker.generateRecommendation(trade, signal, indicators, price)
    expect(rec.type).toBe('HOLD')
    expect(rec.reasons).toHaveLength(0)
  })

  it('recommends CLOSE_100 when 4+ contra signals for LONG', () => {
    const trade = makeTrade()
    const signal: SignalData = {
      direction: 'LONG', confluenceScore: 40, confidence: 'normal',
      alerts: [], riskManagement: null, criticalDecision: '', actionPoints: [], overrides: [],
    }
    const indicators = makeIndicators({
      macd: { macd: -1, signal: -0.5, histogram: -0.5, trend: 'bearish', divergence: 'bearish' },
      stochRsi: { k: 95, d: 90, zone: 'overbought', persistentOverbought: true, persistentOversold: false },
      volume: { current: 2000, average: 800, isSpike: true, candleDirection: 'red' },
    })
    const price = makePrice({ price: 101 })

    const rec = tracker.generateRecommendation(trade, signal, indicators, price)
    expect(rec.type).toBe('CLOSE_100')
    expect(rec.reasons.length).toBeGreaterThanOrEqual(4)
  })

  it('recommends PARTIAL_75 when 3 contra signals', () => {
    const trade = makeTrade()
    const signal: SignalData = {
      direction: 'LONG', confluenceScore: 55, confidence: 'normal',
      alerts: [], riskManagement: null, criticalDecision: '', actionPoints: [], overrides: [],
    }
    const indicators = makeIndicators({
      macd: { macd: -0.5, signal: 0, histogram: -0.5, trend: 'bearish', divergence: null },
      stochRsi: { k: 95, d: 90, zone: 'overbought', persistentOverbought: true, persistentOversold: false },
    })
    const price = makePrice({ price: 101 })

    const rec = tracker.generateRecommendation(trade, signal, indicators, price)
    expect(rec.type).toBe('PARTIAL_75')
    expect(rec.reasons).toHaveLength(3)
  })

  it('recommends MOVE_SL when price is past 50% of TP with 0-1 contra', () => {
    const trade = makeTrade({
      entryPrice: 100, takeProfit: 106, stopLoss: 98, currentStopLoss: 98,
    })
    const signal: SignalData = {
      direction: 'LONG', confluenceScore: 85, confidence: 'high',
      alerts: [], riskManagement: null, criticalDecision: '', actionPoints: [], overrides: [],
    }
    const indicators = makeIndicators()
    // Price at 104 = more than 50% of TP distance (3 / 6)
    const price = makePrice({ price: 104 })

    const rec = tracker.generateRecommendation(trade, signal, indicators, price)
    expect(rec.type).toBe('MOVE_SL')
    expect(rec.newStopLoss).toBe(100) // breakeven
  })

  it('computes unrealizedPnl correctly for LONG', () => {
    const trade = makeTrade({ entryPrice: 100 })
    const signal: SignalData = {
      direction: 'LONG', confluenceScore: 80, confidence: 'high',
      alerts: [], riskManagement: null, criticalDecision: '', actionPoints: [], overrides: [],
    }
    const price = makePrice({ price: 105 })

    const rec = tracker.generateRecommendation(trade, signal, makeIndicators(), price)
    expect(rec.unrealizedPnl).toBeCloseTo(5, 1) // (105-100)/100 * 100 = 5%
  })

  it('computes unrealizedPnl correctly for SHORT', () => {
    const trade = makeTrade({ direction: 'SHORT', entryPrice: 100 })
    const signal: SignalData = {
      direction: 'SHORT', confluenceScore: 20, confidence: 'high',
      alerts: [], riskManagement: null, criticalDecision: '', actionPoints: [], overrides: [],
    }
    const price = makePrice({ price: 95 })

    const rec = tracker.generateRecommendation(trade, signal, makeIndicators({
      macd: { macd: -1, signal: -0.5, histogram: -0.5, trend: 'bearish', divergence: null },
    }), price)
    expect(rec.unrealizedPnl).toBeCloseTo(5, 1) // (100-95)/100 * 100 = 5%
  })
})
