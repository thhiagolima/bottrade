import { describe, it, expect } from 'vitest'
import {
  calcStructureScore,
  calcMacdScore,
  calcStochRsiScore,
  calcVolumeScore,
  calcFundingScore,
  calcEmaAlignmentScore,
  generateSignal,
  detectAlerts,
} from '../signals.js'
import type { IndicatorValues, PriceData, UserSettings, SignalData } from '@bottrade/shared'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeIndicators(overrides: Partial<IndicatorValues> = {}): IndicatorValues {
  return {
    ma20: 100, ma50: 98, ma100: 95, ma200: 90,
    ema20: 101, ema50: 99,
    macd: { macd: 1, signal: 0.5, histogram: 0.5, trend: 'bullish', divergence: null },
    stochRsi: { k: 50, d: 45, zone: 'neutral', persistentOverbought: false, persistentOversold: false },
    volume: { current: 1000, average: 800, isSpike: false, candleDirection: 'green' },
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

// ── calcStructureScore ──────────────────────────────────────────────────────

describe('calcStructureScore', () => {
  it('returns 25 when price is above all 6 MAs', () => {
    const indicators = makeIndicators()
    const price = makePrice({ price: 105 }) // above all MAs (90-101)
    expect(calcStructureScore(price, indicators)).toBe(25)
  })

  it('returns 0 when price is below all MAs', () => {
    const indicators = makeIndicators()
    const price = makePrice({ price: 80 }) // below all (90-101)
    expect(calcStructureScore(price, indicators)).toBe(0)
  })

  it('returns 12 when price is above 3 MAs', () => {
    // price=96 is above ma200=90, ma100=95 — that's 2. Let's go higher
    const indicators = makeIndicators()
    const price = makePrice({ price: 99 }) // above 90,95,98 = 3 MAs
    expect(calcStructureScore(price, indicators)).toBe(12)
  })
})

// ── calcMacdScore ───────────────────────────────────────────────────────────

describe('calcMacdScore', () => {
  it('returns 20 for positive histogram with bullish trend', () => {
    const ind = makeIndicators({
      macd: { macd: 1, signal: 0.5, histogram: 0.5, trend: 'bullish', divergence: null },
    })
    expect(calcMacdScore(ind)).toBe(20)
  })

  it('returns 14 for positive histogram without bullish trend', () => {
    const ind = makeIndicators({
      macd: { macd: 1, signal: 0.5, histogram: 0.5, trend: 'neutral', divergence: null },
    })
    expect(calcMacdScore(ind)).toBe(14)
  })

  it('returns 10 for zero histogram', () => {
    const ind = makeIndicators({
      macd: { macd: 0, signal: 0, histogram: 0, trend: 'neutral', divergence: null },
    })
    expect(calcMacdScore(ind)).toBe(10)
  })

  it('returns 0 for negative histogram with bearish trend', () => {
    const ind = makeIndicators({
      macd: { macd: -1, signal: -0.5, histogram: -0.5, trend: 'bearish', divergence: null },
    })
    expect(calcMacdScore(ind)).toBe(0)
  })

  it('returns 6 for negative histogram with bullish trend (recovering)', () => {
    const ind = makeIndicators({
      macd: { macd: -0.3, signal: -0.5, histogram: -0.2, trend: 'bullish', divergence: null },
    })
    expect(calcMacdScore(ind)).toBe(6)
  })
})

// ── calcStochRsiScore ───────────────────────────────────────────────────────

describe('calcStochRsiScore', () => {
  it('returns 20 for K > D in neutral zone (crossover)', () => {
    const ind = makeIndicators({
      stochRsi: { k: 55, d: 45, zone: 'neutral', persistentOverbought: false, persistentOversold: false },
    })
    expect(calcStochRsiScore(ind)).toBe(20)
  })

  it('returns 16 for K > D outside neutral zone', () => {
    const ind = makeIndicators({
      stochRsi: { k: 85, d: 80, zone: 'overbought', persistentOverbought: false, persistentOversold: false },
    })
    expect(calcStochRsiScore(ind)).toBe(16)
  })

  it('returns 10 when K approximately equals D', () => {
    const ind = makeIndicators({
      stochRsi: { k: 50, d: 52, zone: 'neutral', persistentOverbought: false, persistentOversold: false },
    })
    expect(calcStochRsiScore(ind)).toBe(10)
  })
})

// ── calcVolumeScore ─────────────────────────────────────────────────────────

describe('calcVolumeScore', () => {
  it('returns 15 for spike + green candle', () => {
    const ind = makeIndicators({
      volume: { current: 2000, average: 800, isSpike: true, candleDirection: 'green' },
    })
    expect(calcVolumeScore(ind)).toBe(15)
  })

  it('returns 0 for spike + red candle', () => {
    const ind = makeIndicators({
      volume: { current: 2000, average: 800, isSpike: true, candleDirection: 'red' },
    })
    expect(calcVolumeScore(ind)).toBe(0)
  })

  it('returns 10 for normal volume + green candle', () => {
    const ind = makeIndicators({
      volume: { current: 900, average: 800, isSpike: false, candleDirection: 'green' },
    })
    expect(calcVolumeScore(ind)).toBe(10)
  })

  it('returns 5 for normal volume + red candle', () => {
    const ind = makeIndicators({
      volume: { current: 900, average: 800, isSpike: false, candleDirection: 'red' },
    })
    expect(calcVolumeScore(ind)).toBe(5)
  })
})

// ── calcFundingScore ────────────────────────────────────────────────────────

describe('calcFundingScore', () => {
  it('returns 15 for very negative funding (< -0.05%)', () => {
    expect(calcFundingScore(makePrice({ fundingRate: -0.001 }))).toBe(15)
  })

  it('returns 12 for slightly negative funding', () => {
    expect(calcFundingScore(makePrice({ fundingRate: -0.0002 }))).toBe(12)
  })

  it('returns 7.5 for neutral funding', () => {
    expect(calcFundingScore(makePrice({ fundingRate: 0.0001 }))).toBe(7.5)
  })

  it('returns 0 for high positive funding (> +0.05%)', () => {
    expect(calcFundingScore(makePrice({ fundingRate: 0.001 }))).toBe(0)
  })
})

// ── calcEmaAlignmentScore ───────────────────────────────────────────────────

describe('calcEmaAlignmentScore', () => {
  it('returns 5 for EMA20 > EMA50 with bullish trend', () => {
    const ind = makeIndicators({ ema20: 105, ema50: 100 })
    expect(calcEmaAlignmentScore(ind)).toBe(5)
  })

  it('returns 0 for EMA20 < EMA50 with bearish trend', () => {
    const ind = makeIndicators({
      ema20: 95, ema50: 100,
      macd: { macd: -1, signal: -0.5, histogram: -0.5, trend: 'bearish', divergence: null },
    })
    expect(calcEmaAlignmentScore(ind)).toBe(0)
  })

  it('returns 2.5 for approximately equal EMAs', () => {
    const ind = makeIndicators({ ema20: 100, ema50: 100.05 })
    expect(calcEmaAlignmentScore(ind)).toBe(2.5)
  })
})

// ── generateSignal ──────────────────────────────────────────────────────────

describe('generateSignal', () => {
  it('generates LONG signal for bullish conditions', () => {
    const indicators = makeIndicators() // all bullish defaults
    const price = makePrice({ price: 105 }) // above all MAs
    const settings = makeSettings()

    const signal = generateSignal(indicators, price, settings)
    expect(signal.direction).toBe('LONG')
    expect(signal.confluenceScore).toBeGreaterThanOrEqual(65)
    expect(signal.riskManagement).not.toBeNull()
  })

  it('generates SHORT signal for bearish conditions', () => {
    const indicators = makeIndicators({
      macd: { macd: -1, signal: -0.5, histogram: -0.5, trend: 'bearish', divergence: null },
      stochRsi: { k: 20, d: 30, zone: 'oversold', persistentOverbought: false, persistentOversold: false },
      volume: { current: 2000, average: 800, isSpike: true, candleDirection: 'red' },
    })
    const price = makePrice({ price: 80, fundingRate: 0.001 }) // below all MAs, high funding
    const settings = makeSettings()

    const signal = generateSignal(indicators, price, settings)
    expect(signal.direction).toBe('SHORT')
    expect(signal.confluenceScore).toBeLessThanOrEqual(35)
  })

  it('generates NEUTRO signal for mixed conditions', () => {
    const indicators = makeIndicators({
      macd: { macd: 0, signal: 0, histogram: 0, trend: 'neutral', divergence: null },
      stochRsi: { k: 50, d: 50, zone: 'neutral', persistentOverbought: false, persistentOversold: false },
    })
    const price = makePrice({ price: 99, fundingRate: 0.0001 }) // price in the middle
    const settings = makeSettings()

    const signal = generateSignal(indicators, price, settings)
    expect(signal.direction).toBe('NEUTRO')
    expect(signal.riskManagement).toBeNull()
  })

  it('clamps score to [0, 100]', () => {
    // Create extreme bullish + divergence bonus to push above 100
    const indicators = makeIndicators({
      macd: { macd: 5, signal: 2, histogram: 3, trend: 'bullish', divergence: 'bullish' },
      stochRsi: { k: 60, d: 40, zone: 'neutral', persistentOverbought: false, persistentOversold: false },
      volume: { current: 2000, average: 800, isSpike: true, candleDirection: 'green' },
    })
    const price = makePrice({ price: 105, fundingRate: -0.001 })
    const settings = makeSettings()

    const signal = generateSignal(indicators, price, settings)
    expect(signal.confluenceScore).toBeLessThanOrEqual(100)
    expect(signal.confluenceScore).toBeGreaterThanOrEqual(0)
  })

  it('overrides LONG to NEUTRO when funding > +0.10%', () => {
    const indicators = makeIndicators()
    const price = makePrice({ price: 105, fundingRate: 0.0015 }) // > 0.001 = 0.10%
    const settings = makeSettings()

    const signal = generateSignal(indicators, price, settings)
    expect(signal.direction).toBe('NEUTRO')
    expect(signal.overrides).toContain('Funding > +0.10% — LONG bloqueado')
  })

  it('overrides SHORT to NEUTRO when funding < -0.10%', () => {
    const indicators = makeIndicators({
      macd: { macd: -1, signal: -0.5, histogram: -0.5, trend: 'bearish', divergence: null },
      stochRsi: { k: 15, d: 25, zone: 'oversold', persistentOverbought: false, persistentOversold: false },
      volume: { current: 2000, average: 800, isSpike: true, candleDirection: 'red' },
    })
    const price = makePrice({ price: 80, fundingRate: -0.0015 })
    const settings = makeSettings()

    const signal = generateSignal(indicators, price, settings)
    expect(signal.direction).toBe('NEUTRO')
    expect(signal.overrides).toContain('Funding < -0.10% — SHORT bloqueado')
  })

  it('blocks LONG when StochRSI K and D at 100', () => {
    const indicators = makeIndicators({
      stochRsi: { k: 100, d: 100, zone: 'overbought', persistentOverbought: true, persistentOversold: false },
    })
    const price = makePrice({ price: 105 })
    const settings = makeSettings()

    const signal = generateSignal(indicators, price, settings)
    expect(signal.overrides).toContain('StochRSI K e D em 100 — sinal de saida')
  })

  it('includes risk management for LONG with correct SL/TP', () => {
    const indicators = makeIndicators()
    const price = makePrice({ price: 105 })
    const settings = makeSettings({ baseCapital: 100, leverage: 10 })

    const signal = generateSignal(indicators, price, settings)
    if (signal.riskManagement) {
      expect(signal.riskManagement.entry).toBe(105)
      expect(signal.riskManagement.stopLoss).toBeLessThan(105)
      expect(signal.riskManagement.takeProfit).toBeGreaterThan(105)
      expect(signal.riskManagement.positionSize).toBe(1000) // 100 * 10
      expect(signal.riskManagement.margin).toBe(100) // 1000 / 10
      expect(signal.riskManagement.leverage).toBe(10)
    }
  })
})

// ── detectAlerts ────────────────────────────────────────────────────────────

describe('detectAlerts', () => {
  it('detects direction change', () => {
    const prevSignal: SignalData = {
      direction: 'LONG', confluenceScore: 70, confidence: 'normal',
      alerts: [], riskManagement: null, criticalDecision: '', actionPoints: [], overrides: [],
    }
    const signal: SignalData = {
      direction: 'SHORT', confluenceScore: 30, confidence: 'normal',
      alerts: [], riskManagement: null, criticalDecision: '', actionPoints: [], overrides: [],
    }
    const indicators = makeIndicators()
    const price = makePrice()
    const settings = makeSettings()

    const alerts = detectAlerts(signal, prevSignal, indicators, price, settings)
    expect(alerts.some(a => a.type === 'direction-change')).toBe(true)
  })

  it('detects funding extreme', () => {
    const signal: SignalData = {
      direction: 'NEUTRO', confluenceScore: 50, confidence: 'normal',
      alerts: [], riskManagement: null, criticalDecision: '', actionPoints: [], overrides: [],
    }
    const indicators = makeIndicators()
    const price = makePrice({ fundingRate: 0.002 }) // way above threshold
    const settings = makeSettings({ fundingThreshold: 0.05 })

    const alerts = detectAlerts(signal, undefined, indicators, price, settings)
    expect(alerts.some(a => a.type === 'funding-extreme')).toBe(true)
  })

  it('detects full alignment when score > 80', () => {
    const signal: SignalData = {
      direction: 'LONG', confluenceScore: 85, confidence: 'high',
      alerts: [], riskManagement: null, criticalDecision: '', actionPoints: [], overrides: [],
    }
    const indicators = makeIndicators()
    const price = makePrice()
    const settings = makeSettings()

    const alerts = detectAlerts(signal, undefined, indicators, price, settings)
    expect(alerts.some(a => a.type === 'full-alignment')).toBe(true)
  })

  it('does not alert on direction change if no previous signal', () => {
    const signal: SignalData = {
      direction: 'LONG', confluenceScore: 70, confidence: 'normal',
      alerts: [], riskManagement: null, criticalDecision: '', actionPoints: [], overrides: [],
    }
    const alerts = detectAlerts(signal, undefined, makeIndicators(), makePrice(), makeSettings())
    expect(alerts.some(a => a.type === 'direction-change')).toBe(false)
  })
})
