import axios from 'axios'
import type { ExternalData } from '@bottrade/shared'
import { fetchExchangeExternalData } from './exchangeMarket.js'

// Cache to avoid rate limits
const cache = new Map<string, { data: ExternalData; timestamp: number }>()
const CACHE_TTL = 60_000 // 1 minute

export async function fetchExternalData(symbol: string): Promise<ExternalData> {
  const cached = cache.get(symbol)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }

  const data: ExternalData = await fetchExchangeExternalData(symbol)

  // Fear & Greed Index (public API, independent from the selected exchange)
  try {
    const resp = await axios.get('https://api.alternative.me/fng/?limit=1', { timeout: 5000 })
    if (resp.data?.data?.[0]) {
      const fg = resp.data.data[0]
      data.fearGreed = {
        value: parseInt(fg.value, 10),
        label: fg.value_classification,
      }
    }
  } catch {
    // Non-critical, ignore
  }

  cache.set(symbol, { data, timestamp: Date.now() })
  return data
}
