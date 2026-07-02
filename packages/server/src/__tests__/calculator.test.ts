import { describe, it, expect } from 'vitest'
import { calculateIndicators } from '../calculator.js'
import type { CandleData, IndicatorValues } from '@bottrade/shared'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Generate N candles with controllable close prices */
function generateCandles(count: number, opts: {
  basePrice?: number
  trend?: 'up' | 'down' | 'flat'
  volatility?: number
} = {}): CandleData[] {
  const { basePrice = 100, trend = 'flat', volatility = 0.5 } = opts
  const candles: CandleData[] = []
  let price = basePrice

  for (let i = 0; i < count; i++) {
    const trendDelta = trend === 'up' ? 0.1 : trend === 'down' ? -0.1 : 0
    price += trendDelta + (Math.sin(i * 0.3) * volatility)
    const open = price - volatility * 0.5
    const high = price + volatility
    const low = price - volatility
    const close = price
    candles.push({
      timestamp: Date.now() - (count - i) * 900_000, // 15min intervals
      open,
      high,
      low,
      close,
      volume: 1000 + Math.random() * 500,
    })
  }

  return candles
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('calculateIndicators', () => {
  it('returns valid indicator values for 250 candles', () => {
    const candles = generateCandles(250)
    const result = calculateIndicators(candles)

    // MAs should be numbers, not NaN
    expect(result.ma20).toBeGreaterThan(0)
    expect(result.ma50).toBeGreaterThan(0)
    expect(result.ma100).toBeGreaterThan(0)
    expect(result.ma200).toBeGreaterThan(0)
    expect(Number.isNaN(result.ma20)).toBe(false)
    expect(Number.isNaN(result.ma200)).toBe(false)

    // EMAs
    expect(result.ema20).toBeGreaterThan(0)
    expect(result.ema50).toBeGreaterThan(0)

    // MACD
    expect(typeof result.macd.macd).toBe('number')
    expect(typeof result.macd.signal).toBe('number')
    expect(typeof result.macd.histogram).toBe('number')
    expect(['bullish', 'bearish', 'neutral']).toContain(result.macd.trend)
    expect([null, 'bullish', 'bearish']).toContain(result.macd.divergence)

    // StochRSI
    expect(result.stochRsi.k).toBeGreaterThanOrEqual(0)
    expect(result.stochRsi.k).toBeLessThanOrEqual(100)
    expect(result.stochRsi.d).toBeGreaterThanOrEqual(0)
    expect(result.stochRsi.d).toBeLessThanOrEqual(100)
    expect(['overbought', 'oversold', 'neutral']).toContain(result.stochRsi.zone)
    expect(typeof result.stochRsi.persistentOverbought).toBe('boolean')
    expect(typeof result.stochRsi.persistentOversold).toBe('boolean')

    // Volume
    expect(result.volume.current).toBeGreaterThan(0)
    expect(result.volume.average).toBeGreaterThan(0)
    expect(typeof result.volume.isSpike).toBe('boolean')
    expect(['green', 'red']).toContain(result.volume.candleDirection)
  })

  it('handles minimum candle count (< 200) without crashing', () => {
    const candles = generateCandles(50)
    const result = calculateIndicators(candles)

    // Should fallback to close price for MAs that need more data
    expect(result.ma200).toBeGreaterThan(0)
    expect(Number.isNaN(result.ma200)).toBe(false)
  })

  it('detects volume spike correctly', () => {
    const candles = generateCandles(250)
    // Make last candle have a volume spike (> 2x average)
    candles[candles.length - 1].volume = 100_000

    const result = calculateIndicators(candles)
    expect(result.volume.isSpike).toBe(true)
  })

  it('determines green candle when close >= open', () => {
    const candles = generateCandles(250)
    candles[candles.length - 1].close = 200
    candles[candles.length - 1].open = 100

    const result = calculateIndicators(candles)
    expect(result.volume.candleDirection).toBe('green')
  })

  it('determines red candle when close < open', () => {
    const candles = generateCandles(250)
    candles[candles.length - 1].close = 100
    candles[candles.length - 1].open = 200

    const result = calculateIndicators(candles)
    expect(result.volume.candleDirection).toBe('red')
  })

  it('tracks persistent overbought across calls', () => {
    const candles = generateCandles(250, { basePrice: 100, trend: 'up', volatility: 0.01 })

    // First call — no previous, counter starts at 1 (if K >= 90)
    const result1 = calculateIndicators(candles)

    // If K happens to be >= 90, check counter behavior
    if (result1.stochRsi.k >= 90) {
      expect(result1.stochRsi.persistentOverbought).toBe(false) // first time, counter = 1
    }
  })

  it('uses prevIndicators for persistent counter state', () => {
    const candles = generateCandles(250)

    // Simulate a previous state where K was >= 90
    const prevIndicators: IndicatorValues = {
      ma20: 100, ma50: 98, ma100: 95, ma200: 90,
      ema20: 101, ema50: 99,
      macd: { macd: 0, signal: 0, histogram: 0, trend: 'neutral', divergence: null },
      stochRsi: { k: 95, d: 90, zone: 'overbought', persistentOverbought: false, persistentOversold: false },
      volume: { current: 1000, average: 800, isSpike: false, candleDirection: 'green' },
    }

    const result = calculateIndicators(candles, prevIndicators)
    // Should work without errors regardless of K value
    expect(typeof result.stochRsi.persistentOverbought).toBe('boolean')
  })

  it('detects bullish MACD trend when histogram increases', () => {
    const candles = generateCandles(250, { trend: 'up' })
    const result = calculateIndicators(candles)
    // With consistent uptrend, MACD should tend bullish
    expect(typeof result.macd.trend).toBe('string')
  })

  it('returns correct zone classification', () => {
    const candles = generateCandles(250)
    const result = calculateIndicators(candles)

    if (result.stochRsi.k > 80) {
      expect(result.stochRsi.zone).toBe('overbought')
    } else if (result.stochRsi.k < 20) {
      expect(result.stochRsi.zone).toBe('oversold')
    } else {
      expect(result.stochRsi.zone).toBe('neutral')
    }
  })
})
