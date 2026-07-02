import { EventEmitter } from 'events'
import WebSocket from 'ws'
import axios from 'axios'
import type { CandleData, PriceData, BasicPairData } from '@bottrade/shared'
import { config } from './config.js'
import { fetchMarketCandles, fetchTickerSnapshot, getExchangeName, getExchangeProvider } from './exchangeMarket.js'

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00'
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds].map(v => String(v).padStart(2, '0')).join(':')
}

// State for a favorited pair (has kline stream + candles + indicators)
interface FavoriteState {
  ws: WebSocket | null
  candles: CandleData[]
  priceData: PriceData
  pingTimer: ReturnType<typeof setInterval> | null
  reconnectAttempt: number
  reconnectTimer: ReturnType<typeof setTimeout> | null
  closing: boolean
}

export class BinanceWSManager extends EventEmitter {
  // Favorited pairs: full kline stream + candle data
  private favorites: Map<string, FavoriteState> = new Map()
  // ALL pairs: basic price data from aggregate streams
  private allPairs: Map<string, BasicPairData> = new Map()
  // Aggregate WebSocket connections
  private markPriceWs: WebSocket | null = null
  private tickerWs: WebSocket | null = null
  private markPricePingTimer: ReturnType<typeof setInterval> | null = null
  private tickerPingTimer: ReturnType<typeof setInterval> | null = null
  private tickerPollTimer: ReturnType<typeof setInterval> | null = null
  private markPriceReconnectAttempt = 0
  private tickerReconnectAttempt = 0
  private aggregateClosing = false

  private activeRestUrl: string = config.binance.restBaseUrl
  private activeWsUrl: string = config.binance.wsBaseUrl

  constructor(favoritePairs: string[]) {
    super()
    for (const symbol of favoritePairs) {
      this.favorites.set(symbol, this.createFavoriteState(symbol))
    }
  }

  private createFavoriteState(symbol: string): FavoriteState {
    return {
      ws: null,
      candles: [],
      priceData: {
        symbol,
        price: 0,
        markPrice: 0,
        change24h: 0,
        volume24h: 0,
        fundingRate: 0,
        fundingCountdown: '00:00:00',
      },
      pingTimer: null,
      reconnectAttempt: 0,
      reconnectTimer: null,
      closing: false,
    }
  }

  async start(): Promise<void> {
    await this.findWorkingUrls()

    // 1. Start aggregate streams for ALL pairs
    this.connectAggregateStreams()

    // 2. Init favorite pairs (kline streams + historical candles)
    const promises: Promise<void>[] = []
    for (const symbol of this.favorites.keys()) {
      promises.push(this.initFavorite(symbol))
    }
    await Promise.all(promises)
  }

  stop(): void {
    this.aggregateClosing = true
    if (this.tickerPollTimer) { clearInterval(this.tickerPollTimer); this.tickerPollTimer = null }
    // Close aggregate streams
    this.closeAggregateWs(this.markPriceWs, this.markPricePingTimer)
    this.closeAggregateWs(this.tickerWs, this.tickerPingTimer)
    this.markPriceWs = null
    this.tickerWs = null
    // Close favorite kline streams
    for (const state of this.favorites.values()) {
      state.closing = true
      this.cleanupConnection(state)
    }
  }

  // ── Favorite management ─────────────────────────────────────

  async addFavorite(symbol: string): Promise<void> {
    if (this.favorites.has(symbol)) return
    this.favorites.set(symbol, this.createFavoriteState(symbol))
    // Copy price data from allPairs if available
    let basic = this.allPairs.get(symbol)
    if (!basic || basic.price <= 0) {
      const snapshot = await fetchTickerSnapshot(symbol)
      basic = snapshot.get(symbol)
      if (basic) this.allPairs.set(symbol, basic)
    }
    const state = this.favorites.get(symbol)!
    if (basic) {
      state.priceData.price = basic.price
      state.priceData.markPrice = basic.markPrice
      state.priceData.change24h = basic.change24h
      state.priceData.volume24h = basic.volume24h
      state.priceData.fundingRate = basic.fundingRate
    }
    await this.initFavorite(symbol)
  }

  removeFavorite(symbol: string): void {
    const state = this.favorites.get(symbol)
    if (!state) return
    state.closing = true
    this.cleanupConnection(state)
    this.favorites.delete(symbol)
  }

  isFavorite(symbol: string): boolean {
    return this.favorites.has(symbol)
  }

  getFavoriteSymbols(): string[] {
    return Array.from(this.favorites.keys())
  }

  getCandles(symbol: string): CandleData[] {
    return this.favorites.get(symbol)?.candles ?? []
  }

  getPriceData(symbol: string): PriceData | undefined {
    return this.favorites.get(symbol)?.priceData
  }

  getAllPairsData(): Map<string, BasicPairData> {
    return this.allPairs
  }

  getBasicPairData(symbol: string): BasicPairData | undefined {
    return this.allPairs.get(symbol)
  }

  getConnectionStatus(): { favorites: number; aggregateStreams: number } {
    let connectedFavorites = 0
    for (const state of this.favorites.values()) {
      if (state.ws && state.ws.readyState === WebSocket.OPEN) connectedFavorites++
    }
    let aggregateStreams = 0
    if (this.markPriceWs && this.markPriceWs.readyState === WebSocket.OPEN) aggregateStreams++
    if (this.tickerWs && this.tickerWs.readyState === WebSocket.OPEN) aggregateStreams++
    return { favorites: connectedFavorites, aggregateStreams }
  }

  // ── Aggregate streams (all pairs) ──────────────────────────

  private connectAggregateStreams(): void {
    if (getExchangeProvider() === 'bybit') {
      this.startBybitTickerPolling()
      return
    }
    this.connectMarkPriceStream()
    this.connectTickerStream()
  }

  private startBybitTickerPolling(): void {
    const refresh = async () => {
      if (this.aggregateClosing) return
      try {
        const snapshot = await fetchTickerSnapshot()
        for (const [symbol, data] of snapshot) {
          this.allPairs.set(symbol, data)
          const favState = this.favorites.get(symbol)
          if (favState) {
            favState.priceData = {
              ...favState.priceData,
              price: data.price,
              markPrice: data.markPrice,
              change24h: data.change24h,
              volume24h: data.volume24h,
              fundingRate: data.fundingRate,
            }
            this.emit('price-update', { symbol, priceData: { ...favState.priceData } })
          }
        }
        this.emit('all-pairs-update', this.allPairs)
      } catch (err) {
        this.emit('error', { symbol: 'ALL', error: err instanceof Error ? err : new Error(String(err)) })
      }
    }

    void refresh()
    this.tickerPollTimer = setInterval(() => { void refresh() }, config.bybit.tickersRefreshMs)
  }

  private connectMarkPriceStream(): void {
    if (this.aggregateClosing) return
    const baseWs = this.activeWsUrl.endsWith('/stream') ? this.activeWsUrl.slice(0, -'/stream'.length) : this.activeWsUrl
    const url = `${baseWs}/ws/!markPrice@arr@1s`
    console.log(`[WS] Connecting aggregate markPrice stream: ${url}`)
    const ws = new WebSocket(url)
    this.markPriceWs = ws

    ws.on('open', () => {
      console.log('[WS] Aggregate markPrice stream connected')
      this.markPriceReconnectAttempt = 0
      this.markPricePingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.ping()
      }, config.ws.pingInterval)
    })

    ws.on('message', (raw: WebSocket.RawData) => {
      try {
        const arr = JSON.parse(raw.toString()) as Array<Record<string, unknown>>
        for (const item of arr) {
          const symbol = item.s as string
          const markPrice = parseFloat(item.p as string)
          const fundingRate = parseFloat(item.r as string)
          const nextFundingTime = item.T as number
          const fundingCountdown = formatCountdown(nextFundingTime - Date.now())

          // Update allPairs map
          const existing = this.allPairs.get(symbol)
          if (existing) {
            existing.markPrice = markPrice
            existing.fundingRate = fundingRate
          } else {
            this.allPairs.set(symbol, {
              symbol, price: 0, change24h: 0, volume24h: 0,
              markPrice, fundingRate,
            })
          }

          // Update favorite price data if exists
          const favState = this.favorites.get(symbol)
          if (favState) {
            favState.priceData.markPrice = markPrice
            favState.priceData.fundingRate = fundingRate
            favState.priceData.fundingCountdown = fundingCountdown
            this.emit('price-update', { symbol, priceData: { ...favState.priceData } })
          }
        }
        // Emit bulk update for all-pairs sidebar
        this.emit('all-pairs-update', this.allPairs)
      } catch {
        // ignore parse errors
      }
    })

    ws.on('close', () => {
      console.log('[WS] Aggregate markPrice stream closed')
      if (this.markPricePingTimer) { clearInterval(this.markPricePingTimer); this.markPricePingTimer = null }
      if (!this.aggregateClosing) this.scheduleAggregateReconnect('markPrice')
    })

    ws.on('error', (err: Error) => {
      console.error('[WS] Aggregate markPrice stream error:', err.message)
    })
  }

  private connectTickerStream(): void {
    if (this.aggregateClosing) return
    const baseWs = this.activeWsUrl.endsWith('/stream') ? this.activeWsUrl.slice(0, -'/stream'.length) : this.activeWsUrl
    const url = `${baseWs}/ws/!ticker@arr`
    console.log(`[WS] Connecting aggregate ticker stream: ${url}`)
    const ws = new WebSocket(url)
    this.tickerWs = ws

    ws.on('open', () => {
      console.log('[WS] Aggregate ticker stream connected')
      this.tickerReconnectAttempt = 0
      this.tickerPingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.ping()
      }, config.ws.pingInterval)
    })

    ws.on('message', (raw: WebSocket.RawData) => {
      try {
        const arr = JSON.parse(raw.toString()) as Array<Record<string, unknown>>
        for (const item of arr) {
          const symbol = item.s as string
          const price = parseFloat(item.c as string)
          const change24h = parseFloat(item.P as string)
          const volume24h = parseFloat(item.q as string)

          // Update allPairs map
          const existing = this.allPairs.get(symbol)
          if (existing) {
            existing.price = price
            existing.change24h = change24h
            existing.volume24h = volume24h
          } else {
            this.allPairs.set(symbol, {
              symbol, price, change24h, volume24h,
              markPrice: 0, fundingRate: 0,
            })
          }

          // Update favorite price data if exists
          const favState = this.favorites.get(symbol)
          if (favState) {
            favState.priceData.price = price
            favState.priceData.change24h = change24h
            favState.priceData.volume24h = volume24h
            this.emit('price-update', { symbol, priceData: { ...favState.priceData } })
          }
        }
      } catch {
        // ignore parse errors
      }
    })

    ws.on('close', () => {
      console.log('[WS] Aggregate ticker stream closed')
      if (this.tickerPingTimer) { clearInterval(this.tickerPingTimer); this.tickerPingTimer = null }
      if (!this.aggregateClosing) this.scheduleAggregateReconnect('ticker')
    })

    ws.on('error', (err: Error) => {
      console.error('[WS] Aggregate ticker stream error:', err.message)
    })
  }

  private scheduleAggregateReconnect(type: 'markPrice' | 'ticker'): void {
    const attempt = type === 'markPrice' ? this.markPriceReconnectAttempt : this.tickerReconnectAttempt
    const delay = Math.min(config.ws.reconnectBaseDelay * Math.pow(2, attempt), config.ws.reconnectMaxDelay)

    if (type === 'markPrice') {
      this.markPriceReconnectAttempt++
      setTimeout(() => { if (!this.aggregateClosing) this.connectMarkPriceStream() }, delay)
    } else {
      this.tickerReconnectAttempt++
      setTimeout(() => { if (!this.aggregateClosing) this.connectTickerStream() }, delay)
    }
  }

  private closeAggregateWs(ws: WebSocket | null, timer: ReturnType<typeof setInterval> | null): void {
    if (timer) clearInterval(timer)
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      ws.removeAllListeners()
      ws.close()
    }
  }

  // ── Favorite kline streams ─────────────────────────────────

  private async initFavorite(symbol: string): Promise<void> {
    const state = this.favorites.get(symbol)
    if (!state) return
    try {
      state.candles = await this.fetchCandles(symbol)
      this.connectFavoriteWS(symbol)
    } catch (err) {
      this.emit('error', { symbol, error: err instanceof Error ? err : new Error(String(err)) })
    }
  }

  private connectFavoriteWS(symbol: string): void {
    const state = this.favorites.get(symbol)
    if (!state || state.closing) return

    if (getExchangeProvider() === 'bybit') {
      this.connectBybitFavoriteWS(symbol, state)
      return
    }

    const s = symbol.toLowerCase()
    // Subscribe to kline + markPrice + ticker for full data
    const url = `${this.activeWsUrl}?streams=${s}@kline_${config.candles.interval}/${s}@markPrice@1s/${s}@ticker`
    const ws = new WebSocket(url)
    state.ws = ws

    ws.on('open', () => {
      state.reconnectAttempt = 0
      this.emit('connection-status', { symbol, connected: true })
      state.pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.ping()
      }, config.ws.pingInterval)
    })

    ws.on('message', (raw: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(raw.toString())
        this.handleFavoriteMessage(symbol, msg)
      } catch {
        // ignore parse errors
      }
    })

    ws.on('close', () => {
      this.emit('connection-status', { symbol, connected: false })
      this.cleanupTimers(state)
      if (!state.closing) this.scheduleFavoriteReconnect(symbol)
    })

    ws.on('error', () => {
      // close fires after error
    })
  }

  private connectBybitFavoriteWS(symbol: string, state: FavoriteState): void {
    const ws = new WebSocket(config.bybit.wsBaseUrl)
    state.ws = ws

    ws.on('open', () => {
      state.reconnectAttempt = 0
      this.emit('connection-status', { symbol, connected: true })
      ws.send(JSON.stringify({ op: 'subscribe', args: [`kline.15.${symbol}`, `tickers.${symbol}`] }))
      state.pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ op: 'ping' }))
      }, config.ws.pingInterval)
    })

    ws.on('message', (raw: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(raw.toString())
        this.handleBybitFavoriteMessage(symbol, msg)
      } catch {
        // ignore parse errors
      }
    })

    ws.on('close', () => {
      this.emit('connection-status', { symbol, connected: false })
      this.cleanupTimers(state)
      if (!state.closing) this.scheduleFavoriteReconnect(symbol)
    })

    ws.on('error', () => {
      // close fires after error
    })
  }

  private handleFavoriteMessage(symbol: string, msg: { stream?: string; data?: Record<string, unknown> }): void {
    const state = this.favorites.get(symbol)
    if (!state || !msg.stream || !msg.data) return

    const data = msg.data as Record<string, unknown>

    if (msg.stream.includes(`@kline_${config.candles.interval}`)) {
      const k = data.k as Record<string, unknown>
      if (k && k.x === true) {
        const candle: CandleData = {
          timestamp: k.t as number,
          open: parseFloat(k.o as string),
          high: parseFloat(k.h as string),
          low: parseFloat(k.l as string),
          close: parseFloat(k.c as string),
          volume: parseFloat(k.v as string),
        }
        state.candles.push(candle)
        if (state.candles.length > config.candles.bufferSize) {
          state.candles.splice(0, state.candles.length - config.candles.bufferSize)
        }
        this.emit('candle-closed', { symbol, candles: state.candles })
      }
    } else if (msg.stream.includes('@markPrice')) {
      state.priceData.markPrice = parseFloat(data.p as string)
      state.priceData.fundingRate = parseFloat(data.r as string)
      const nextFundingTime = data.T as number
      state.priceData.fundingCountdown = formatCountdown(nextFundingTime - Date.now())
      this.emit('price-update', { symbol, priceData: { ...state.priceData } })
    } else if (msg.stream.includes('@ticker')) {
      state.priceData.price = parseFloat(data.c as string)
      state.priceData.change24h = parseFloat(data.P as string)
      state.priceData.volume24h = parseFloat(data.q as string)
      this.emit('price-update', { symbol, priceData: { ...state.priceData } })
    }
  }

  private handleBybitFavoriteMessage(symbol: string, msg: { topic?: string; data?: unknown }): void {
    const state = this.favorites.get(symbol)
    if (!state || !msg.topic || !msg.data) return

    if (msg.topic.startsWith('kline.')) {
      const rows = Array.isArray(msg.data) ? msg.data : []
      const k = rows[0] as Record<string, unknown> | undefined
      if (k && k.confirm === true) {
        const candle: CandleData = {
          timestamp: typeof k.start === 'number' ? k.start : parseInt(String(k.start), 10),
          open: parseFloat(String(k.open)),
          high: parseFloat(String(k.high)),
          low: parseFloat(String(k.low)),
          close: parseFloat(String(k.close)),
          volume: parseFloat(String(k.volume)),
        }
        state.candles.push(candle)
        if (state.candles.length > config.candles.bufferSize) {
          state.candles.splice(0, state.candles.length - config.candles.bufferSize)
        }
        this.emit('candle-closed', { symbol, candles: state.candles })
      }
      return
    }

    if (msg.topic.startsWith('tickers.')) {
      const data = msg.data as Record<string, unknown>
      const price = parseFloat(String(data.lastPrice ?? state.priceData.price))
      const markPrice = parseFloat(String(data.markPrice ?? data.lastPrice ?? state.priceData.markPrice))
      state.priceData.price = Number.isFinite(price) ? price : state.priceData.price
      state.priceData.markPrice = Number.isFinite(markPrice) ? markPrice : state.priceData.markPrice
      state.priceData.change24h = parseFloat(String(data.price24hPcnt ?? '0')) * 100
      state.priceData.volume24h = parseFloat(String(data.turnover24h ?? data.volume24h ?? '0'))
      state.priceData.fundingRate = parseFloat(String(data.fundingRate ?? '0'))
      const nextFundingTime = Number(data.nextFundingTime)
      if (Number.isFinite(nextFundingTime)) {
        state.priceData.fundingCountdown = formatCountdown(nextFundingTime - Date.now())
      }
      this.emit('price-update', { symbol, priceData: { ...state.priceData } })
    }
  }

  private scheduleFavoriteReconnect(symbol: string): void {
    const state = this.favorites.get(symbol)
    if (!state || state.closing) return

    const delay = Math.min(
      config.ws.reconnectBaseDelay * Math.pow(2, state.reconnectAttempt),
      config.ws.reconnectMaxDelay,
    )
    state.reconnectAttempt++

    state.reconnectTimer = setTimeout(async () => {
      if (state.closing) return
      try {
        state.candles = await this.fetchCandles(symbol)
      } catch {
        // proceed anyway
      }
      this.connectFavoriteWS(symbol)
    }, delay)
  }

  private cleanupConnection(state: FavoriteState): void {
    this.cleanupTimers(state)
    if (state.ws) {
      state.ws.removeAllListeners()
      if (state.ws.readyState === WebSocket.OPEN || state.ws.readyState === WebSocket.CONNECTING) {
        state.ws.close()
      }
      state.ws = null
    }
  }

  private cleanupTimers(state: FavoriteState): void {
    if (state.pingTimer) { clearInterval(state.pingTimer); state.pingTimer = null }
    if (state.reconnectTimer) { clearTimeout(state.reconnectTimer); state.reconnectTimer = null }
  }

  // ── URL discovery ──────────────────────────────────────────

  private async findWorkingUrls(): Promise<void> {
    if (getExchangeProvider() === 'bybit') {
      this.activeRestUrl = config.bybit.restBaseUrl
      this.activeWsUrl = config.bybit.wsBaseUrl
      console.log(`[WS] Using ${getExchangeName()} endpoint: REST=${this.activeRestUrl} WS=${this.activeWsUrl}`)
      return
    }

    const allRestUrls = [config.binance.restBaseUrl, ...config.binance.altRestUrls]
    const allWsUrls = [config.binance.wsBaseUrl, ...config.binance.altWsUrls]

    for (let i = 0; i < allRestUrls.length; i++) {
      try {
        const testUrl = `${allRestUrls[i]}/fapi/v1/ping`
        const resp = await axios.get(testUrl, {
          timeout: 5000,
          maxRedirects: 0,
          validateStatus: (status) => status === 200,
        })
        const contentType = resp.headers['content-type'] || ''
        if (typeof resp.data === 'string' && !contentType.includes('application/json')) {
          continue
        }
        this.activeRestUrl = allRestUrls[i]
        this.activeWsUrl = allWsUrls[i] || config.binance.wsBaseUrl
        console.log(`[WS] Using ${getExchangeName()} endpoint: REST=${this.activeRestUrl} WS=${this.activeWsUrl}`)
        return
      } catch {
        // try next
      }
    }
    console.error(`[WS] All ${getExchangeName()} endpoints failed. Will retry on reconnect.`)
  }

  // ── REST candle fetch ──────────────────────────────────────

  async fetchCandles(symbol: string, attempt = 0, rateLimitRetries = 0): Promise<CandleData[]> {
    if (getExchangeProvider() === 'bybit') {
      return fetchMarketCandles(symbol)
    }

    const MAX_RATE_LIMIT_RETRIES = 3

    try {
      const url = `${this.activeRestUrl}/fapi/v1/klines`
      const resp = await axios.get(url, {
        params: {
          symbol,
          interval: config.candles.interval,
          limit: config.candles.historyLimit,
        },
        timeout: config.binance.restTimeout,
        maxRedirects: 0,
        validateStatus: (status) => status === 200,
      })

      const data = resp.data
      if (!Array.isArray(data)) {
        console.error(`[WS] Unexpected klines response for ${symbol}:`, typeof data)
        return []
      }
      return data.map((k: unknown[]) => ({
        timestamp: k[0] as number,
        open: parseFloat(k[1] as string),
        high: parseFloat(k[2] as string),
        low: parseFloat(k[3] as string),
        close: parseFloat(k[4] as string),
        volume: parseFloat(k[5] as string),
      }))
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        const status = err.response.status

        if (status === 418 || status === 451) {
          await this.findWorkingUrls()
          if (attempt < config.binance.restMaxRetries) {
            return this.fetchCandles(symbol, attempt + 1)
          }
          throw new Error(`All Binance endpoints blocked (HTTP ${status}) for ${symbol}`)
        }

        if (status === 429) {
          if (rateLimitRetries >= MAX_RATE_LIMIT_RETRIES) {
            throw new Error(`Rate limited after ${MAX_RATE_LIMIT_RETRIES} retries for ${symbol}`)
          }
          const retryAfter = parseInt(err.response.headers['retry-after'] as string, 10)
          const waitMs = (isNaN(retryAfter) ? 5 : retryAfter) * 1000
          await new Promise(resolve => setTimeout(resolve, waitMs))
          return this.fetchCandles(symbol, attempt, rateLimitRetries + 1)
        }

        if (status >= 500 && attempt < config.binance.restMaxRetries) {
          const delay = config.ws.reconnectBaseDelay * Math.pow(2, attempt)
          await new Promise(resolve => setTimeout(resolve, delay))
          return this.fetchCandles(symbol, attempt + 1)
        }
      }

      throw err
    }
  }
}
