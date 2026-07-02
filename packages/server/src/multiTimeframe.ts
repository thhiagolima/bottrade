import type { CandleData, TimeframeAnalysis, MultiTimeframeData, UserSettings } from '@bottrade/shared'
import { calculateIndicators } from './calculator.js'
import { fetchMarketCandles } from './exchangeMarket.js'

// Cache to avoid re-fetching too frequently
const cache = new Map<string, { data: MultiTimeframeData; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function fetchCandlesForInterval(symbol: string, interval: string, limit = 200): Promise<CandleData[]> {
  return fetchMarketCandles(symbol, interval, limit)
}

function analyzeTimeframe(candles: CandleData[], interval: '15m' | '1h' | '4h'): TimeframeAnalysis | null {
  if (candles.length < 50) return null // Need minimum candles

  const indicators = calculateIndicators(candles)
  const price = candles[candles.length - 1].close

  // Count MAs above/below price for direction
  const mas = [indicators.ma20, indicators.ma50, indicators.ma100, indicators.ma200, indicators.ema20, indicators.ema50]
  const aboveCount = mas.filter(ma => ma > 0 && price > ma).length

  let direction: 'LONG' | 'SHORT' | 'NEUTRO'
  let score: number
  let trend: string

  if (aboveCount >= 5) {
    direction = 'LONG'; score = 70 + (aboveCount - 5) * 15; trend = 'Bullish'
  } else if (aboveCount >= 3) {
    direction = 'NEUTRO'; score = 40 + aboveCount * 5; trend = 'Lateral'
  } else {
    direction = 'SHORT'; score = 10 + aboveCount * 10; trend = 'Bearish'
  }

  // Adjust with MACD
  if (indicators.macd.trend === 'bullish') { score += 5; if (trend === 'Lateral') trend = 'Bullish tendencia' }
  else if (indicators.macd.trend === 'bearish') { score -= 5; if (trend === 'Lateral') trend = 'Bearish tendencia' }

  score = Math.max(0, Math.min(100, score))

  return {
    interval,
    direction,
    score,
    trend,
    keyLevels: { ma20: indicators.ma20, ma50: indicators.ma50, ma200: indicators.ma200 },
  }
}

function determineAlignment(tf15m: TimeframeAnalysis, tf1h: TimeframeAnalysis | null, tf4h: TimeframeAnalysis | null): { alignment: 'aligned' | 'conflicting' | 'partial'; summary: string } {
  const dirs = [tf15m.direction]
  if (tf1h) dirs.push(tf1h.direction)
  if (tf4h) dirs.push(tf4h.direction)

  const nonNeutral = dirs.filter(d => d !== 'NEUTRO')
  const allSame = nonNeutral.length > 0 && nonNeutral.every(d => d === nonNeutral[0])
  const hasConflict = nonNeutral.some(d => d === 'LONG') && nonNeutral.some(d => d === 'SHORT')

  let alignment: 'aligned' | 'conflicting' | 'partial'
  if (allSame && nonNeutral.length >= 2) alignment = 'aligned'
  else if (hasConflict) alignment = 'conflicting'
  else alignment = 'partial'

  const parts = [`15m: ${tf15m.direction}`]
  if (tf1h) parts.push(`1h: ${tf1h.direction}`)
  if (tf4h) parts.push(`4h: ${tf4h.direction}`)

  let suffix = ''
  if (alignment === 'aligned') suffix = ' → alinhado'
  else if (alignment === 'conflicting') suffix = ' → conflito'
  else suffix = ' → parcial'

  return { alignment, summary: parts.join(' | ') + suffix }
}

export async function getMultiTimeframeData(
  symbol: string,
  tf15mAnalysis: TimeframeAnalysis,
  _settings: UserSettings
): Promise<MultiTimeframeData> {
  // Check cache
  const cached = cache.get(symbol)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    // Update 15m from live data
    cached.data['15m'] = tf15mAnalysis
    const { alignment, summary } = determineAlignment(tf15mAnalysis, cached.data['1h'], cached.data['4h'])
    cached.data.alignment = alignment
    cached.data.summary = summary
    return cached.data
  }

  // Fetch 1h and 4h candles
  const [candles1h, candles4h] = await Promise.all([
    fetchCandlesForInterval(symbol, '1h'),
    fetchCandlesForInterval(symbol, '4h'),
  ])

  const tf1h = analyzeTimeframe(candles1h, '1h')
  const tf4h = analyzeTimeframe(candles4h, '4h')
  const { alignment, summary } = determineAlignment(tf15mAnalysis, tf1h, tf4h)

  const data: MultiTimeframeData = {
    '15m': tf15mAnalysis,
    '1h': tf1h,
    '4h': tf4h,
    alignment,
    summary,
  }

  cache.set(symbol, { data, timestamp: Date.now() })

  // Limit cache size: delete oldest entries if > 100
  if (cache.size > 100) {
    let oldestKey: string | null = null
    let oldestTs = Infinity
    for (const [key, entry] of cache) {
      if (entry.timestamp < oldestTs) {
        oldestTs = entry.timestamp
        oldestKey = key
      }
    }
    if (oldestKey) cache.delete(oldestKey)
  }

  return data
}
