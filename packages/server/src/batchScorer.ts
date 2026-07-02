import type { CandleData, BasicPairData, UserSettings, PriceData, SignalData, IndicatorValues } from '@bottrade/shared'
import { calculateIndicators } from './calculator.js'
import { generateSignal } from './signals.js'
import { fetchMarketCandles } from './exchangeMarket.js'

export interface BatchScoreResult {
  symbol: string
  score: number
  direction: 'LONG' | 'SHORT' | 'NEUTRO'
  // Full data for high-confidence signals (used by paper tracker)
  signal?: SignalData
  indicators?: IndicatorValues
  priceData?: PriceData
}

let isRunning = false

async function fetchCandlesQuick(symbol: string): Promise<CandleData[]> {
  return fetchMarketCandles(symbol)
}

export async function runBatchScoring(
  allPairs: Map<string, BasicPairData>,
  settings: UserSettings,
  favoritePairs: Set<string>,
): Promise<BatchScoreResult[]> {
  if (isRunning) return []
  isRunning = true

  const results: BatchScoreResult[] = []
  const symbols = Array.from(allPairs.keys())
    .filter(s => s.endsWith('USDT') && !favoritePairs.has(s) && (allPairs.get(s)?.price ?? 0) > 0)

  console.log(`[BatchScorer] Starting batch scoring for ${symbols.length} pairs...`)
  const startTime = Date.now()

  // Process in batches of 10 to avoid rate limits
  const BATCH_SIZE = 10
  const DELAY_BETWEEN_BATCHES = 1000

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE)

    const promises = batch.map(async (symbol) => {
      try {
        const candles = await fetchCandlesQuick(symbol)
        if (candles.length < 50) return null // Not enough data

        const indicators = calculateIndicators(candles)
        const basicData = allPairs.get(symbol)
        const priceData: PriceData = {
          symbol,
          price: basicData?.price ?? candles[candles.length - 1].close,
          markPrice: basicData?.markPrice ?? 0,
          change24h: basicData?.change24h ?? 0,
          volume24h: basicData?.volume24h ?? 0,
          fundingRate: basicData?.fundingRate ?? 0,
          fundingCountdown: '00:00:00',
        }

        const signal = generateSignal(indicators, priceData, settings)

        const result: BatchScoreResult = { symbol, score: signal.confluenceScore, direction: signal.direction }
        // Include full data for high-confidence signals
        if (signal.confidence === 'high' && signal.direction !== 'NEUTRO') {
          result.signal = signal
          result.indicators = indicators
          result.priceData = priceData
        }
        return result
      } catch {
        return null
      }
    })

    const batchResults = await Promise.all(promises)
    for (const r of batchResults) {
      if (r) results.push(r as BatchScoreResult)
    }

    // Delay between batches to avoid rate limits
    if (i + BATCH_SIZE < symbols.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES))
    }
  }

  isRunning = false
  const duration = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`[BatchScorer] Complete: ${results.length} pairs scored in ${duration}s`)

  return results
}
