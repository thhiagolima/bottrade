import axios from 'axios'
import type { BasicPairData, CandleData, ExternalData } from '@bottrade/shared'
import { config } from './config.js'

type ExchangeProvider = 'binance' | 'bybit'

const prevOI = new Map<string, number>()
const prevOITimestamps = new Map<string, number>()

export function getExchangeProvider(): ExchangeProvider {
  return config.exchange.provider === 'bybit' ? 'bybit' : 'binance'
}

export function getExchangeName(): string {
  return getExchangeProvider() === 'bybit' ? 'Bybit' : 'Binance'
}

function bybitInterval(interval: string): string {
  const map: Record<string, string> = {
    '1m': '1',
    '3m': '3',
    '5m': '5',
    '15m': '15',
    '30m': '30',
    '1h': '60',
    '2h': '120',
    '4h': '240',
    '1d': 'D',
  }
  return map[interval] || interval
}

function mapBinanceCandles(data: unknown[]): CandleData[] {
  return data.map((row: unknown) => {
    const k = row as unknown[]
    return {
    timestamp: k[0] as number,
    open: parseFloat(k[1] as string),
    high: parseFloat(k[2] as string),
    low: parseFloat(k[3] as string),
    close: parseFloat(k[4] as string),
    volume: parseFloat(k[5] as string),
    }
  })
}

function mapBybitCandles(data: unknown[]): CandleData[] {
  return data
    .map((row: unknown) => {
      const k = row as unknown[]
      return {
        timestamp: parseInt(k[0] as string, 10),
        open: parseFloat(k[1] as string),
        high: parseFloat(k[2] as string),
        low: parseFloat(k[3] as string),
        close: parseFloat(k[4] as string),
        volume: parseFloat(k[5] as string),
      }
    })
    .sort((a, b) => a.timestamp - b.timestamp)
}

function getBinanceRestUrls(): string[] {
  return [config.binance.restBaseUrl, ...config.binance.altRestUrls]
}

async function getBybit<T>(path: string, params: Record<string, unknown> = {}): Promise<T> {
  const resp = await axios.get(`${config.bybit.restBaseUrl}${path}`, {
    params: { category: config.bybit.category, ...params },
    timeout: config.bybit.restTimeout,
    maxRedirects: 0,
    validateStatus: (s: number) => s === 200,
  })
  if (resp.data?.retCode !== 0) {
    throw new Error(resp.data?.retMsg || 'Bybit API error')
  }
  return resp.data as T
}

export async function fetchMarketCandles(
  symbol: string,
  interval: string = config.candles.interval,
  limit: number = config.candles.historyLimit,
  endTime?: number,
): Promise<CandleData[]> {
  if (getExchangeProvider() === 'bybit') {
    try {
      const data = await getBybit<{ result?: { list?: unknown[] } }>('/v5/market/kline', {
        symbol,
        interval: bybitInterval(interval),
        limit,
        ...(endTime ? { end: endTime } : {}),
      })
      return mapBybitCandles(data.result?.list || [])
    } catch {
      return []
    }
  }

  for (const baseUrl of getBinanceRestUrls()) {
    try {
      const resp = await axios.get(`${baseUrl}/fapi/v1/klines`, {
        params: { symbol, interval, limit, ...(endTime ? { endTime } : {}) },
        timeout: config.binance.restTimeout,
        maxRedirects: 0,
        validateStatus: (s: number) => s === 200,
      })
      if (Array.isArray(resp.data)) return mapBinanceCandles(resp.data)
    } catch {
      continue
    }
  }
  return []
}

export async function fetchExchangeSymbols(): Promise<string[]> {
  if (getExchangeProvider() === 'bybit') {
    try {
      const data = await getBybit<{ result?: { list?: Array<{ symbol: string; status: string; quoteCoin?: string }> } }>('/v5/market/instruments-info')
      return (data.result?.list || [])
        .filter(s => s.status === 'Trading' && (!s.quoteCoin || s.quoteCoin === 'USDT'))
        .map(s => s.symbol)
        .sort()
    } catch {
      return []
    }
  }

  for (const baseUrl of getBinanceRestUrls()) {
    try {
      const resp = await axios.get(`${baseUrl}/fapi/v1/exchangeInfo`, { timeout: config.binance.restTimeout })
      return (resp.data.symbols as Array<{ symbol: string; status: string; contractType: string }>)
        .filter(s => s.status === 'TRADING' && s.contractType === 'PERPETUAL')
        .map(s => s.symbol)
        .sort()
    } catch {
      continue
    }
  }
  return []
}

export async function fetchTickerSnapshot(symbol?: string): Promise<Map<string, BasicPairData>> {
  const result = new Map<string, BasicPairData>()

  if (getExchangeProvider() === 'bybit') {
    const data = await getBybit<{
      result?: {
        list?: Array<{
          symbol: string
          lastPrice?: string
          markPrice?: string
          price24hPcnt?: string
          turnover24h?: string
          volume24h?: string
          fundingRate?: string
        }>
      }
    }>('/v5/market/tickers', symbol ? { symbol } : {})

    for (const item of data.result?.list || []) {
      const price = parseFloat(item.lastPrice || '0')
      const markPrice = parseFloat(item.markPrice || item.lastPrice || '0')
      result.set(item.symbol, {
        symbol: item.symbol,
        price,
        markPrice,
        change24h: parseFloat(item.price24hPcnt || '0') * 100,
        volume24h: parseFloat(item.turnover24h || item.volume24h || '0'),
        fundingRate: parseFloat(item.fundingRate || '0'),
      })
    }
    return result
  }

  const tickersBySymbol = new Map<string, BasicPairData>()
  for (const baseUrl of getBinanceRestUrls()) {
    try {
      const resp = await axios.get(`${baseUrl}/fapi/v1/ticker/24hr`, {
        params: symbol ? { symbol } : {},
        timeout: config.binance.restTimeout,
        maxRedirects: 0,
        validateStatus: (s: number) => s === 200,
      })
      const rows = Array.isArray(resp.data) ? resp.data : [resp.data]
      for (const item of rows as Array<Record<string, unknown>>) {
        const itemSymbol = String(item.symbol || '')
        if (!itemSymbol) continue
        tickersBySymbol.set(itemSymbol, {
          symbol: itemSymbol,
          price: parseFloat(String(item.lastPrice ?? '0')),
          markPrice: parseFloat(String(item.lastPrice ?? '0')),
          change24h: parseFloat(String(item.priceChangePercent ?? '0')),
          volume24h: parseFloat(String(item.quoteVolume ?? '0')),
          fundingRate: 0,
        })
      }
      break
    } catch {
      continue
    }
  }

  for (const baseUrl of getBinanceRestUrls()) {
    try {
      const resp = await axios.get(`${baseUrl}/fapi/v1/premiumIndex`, {
        params: symbol ? { symbol } : {},
        timeout: config.binance.restTimeout,
        maxRedirects: 0,
        validateStatus: (s: number) => s === 200,
      })
      const rows = Array.isArray(resp.data) ? resp.data : [resp.data]
      for (const item of rows as Array<Record<string, unknown>>) {
        const itemSymbol = String(item.symbol || '')
        const existing = tickersBySymbol.get(itemSymbol)
        if (!existing) continue
        existing.markPrice = parseFloat(String(item.markPrice ?? existing.markPrice))
        existing.fundingRate = parseFloat(String(item.lastFundingRate ?? '0'))
      }
      break
    } catch {
      continue
    }
  }

  for (const [itemSymbol, data] of tickersBySymbol) {
    if (data.price > 0) result.set(itemSymbol, data)
  }
  return result
}

function updateOpenInterestTrend(symbol: string, value: number): ExternalData['openInterest'] {
  const prev = prevOI.get(symbol) ?? value
  const change = prev > 0 ? ((value - prev) / prev) * 100 : 0
  prevOI.set(symbol, value)
  prevOITimestamps.set(symbol, Date.now())

  const OI_TTL = 60 * 60 * 1000
  for (const [sym, ts] of prevOITimestamps) {
    if (Date.now() - ts > OI_TTL) {
      prevOI.delete(sym)
      prevOITimestamps.delete(sym)
    }
  }

  let trend: 'rising' | 'falling' | 'stable' = 'stable'
  if (change > 1) trend = 'rising'
  else if (change < -1) trend = 'falling'

  return { value, change, trend }
}

export async function fetchExchangeExternalData(symbol: string): Promise<ExternalData> {
  const data: ExternalData = {}

  if (getExchangeProvider() === 'bybit') {
    try {
      const oi = await getBybit<{ result?: { list?: Array<{ openInterest: string }> } }>('/v5/market/open-interest', {
        symbol,
        intervalTime: '5min',
        limit: 1,
      })
      const value = parseFloat(oi.result?.list?.[0]?.openInterest || '0')
      if (value > 0) data.openInterest = updateOpenInterestTrend(symbol, value)
    } catch {
      // Optional signal input.
    }
    return data
  }

  for (const baseUrl of getBinanceRestUrls()) {
    try {
      const resp = await axios.get(`${baseUrl}/fapi/v1/openInterest`, {
        params: { symbol },
        timeout: 5000,
        maxRedirects: 0,
        validateStatus: (s: number) => s === 200,
      })
      const value = parseFloat(resp.data.openInterest)
      data.openInterest = updateOpenInterestTrend(symbol, value)
      break
    } catch { continue }
  }

  for (const baseUrl of getBinanceRestUrls()) {
    try {
      const resp = await axios.get(`${baseUrl}/futures/data/globalLongShortAccountRatio`, {
        params: { symbol, period: '5m', limit: 1 },
        timeout: 5000,
        maxRedirects: 0,
        validateStatus: (s: number) => s === 200,
      })
      if (Array.isArray(resp.data) && resp.data.length > 0) {
        const item = resp.data[0]
        const longPercent = parseFloat(item.longAccount) * 100
        const shortPercent = parseFloat(item.shortAccount) * 100
        const ratio = parseFloat(item.longShortRatio)
        let crowded: 'long' | 'short' | 'neutral' = 'neutral'
        if (ratio > 2.0) crowded = 'long'
        else if (ratio < 0.5) crowded = 'short'
        data.longShortRatio = { ratio, longPercent, shortPercent, crowded }
      }
      break
    } catch { continue }
  }

  return data
}
