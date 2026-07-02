import { EventEmitter } from 'events'
import type {
  Trade, SignalData, IndicatorValues, PriceData, UserSettings,
  ExternalData, MultiTimeframeData, EntryFilter, EntryCheckResult, BasicPairData,
} from '@bottrade/shared'
import {
  insertPaperTrade, closePaperTrade, updatePaperPartialTp,
  getOpenPaperTrades, getPaperTradeHistory, getPaperTradeStats,
} from './database.js'
import {
  calcPnl as sharedCalcPnl,
  shouldExitOnScore as sharedShouldExitOnScore,
  shouldExitOnTime as sharedShouldExitOnTime,
} from './baseTradeEngine.js'

const CANDLE_INTERVAL_MS = 15 * 60 * 1000
const PARTIAL_TP_RATIO = 1.0
const TIME_STOP_CANDLES = 8
const TIME_STOP_MIN_PNL = 0.3
const FUNDING_BLACKOUT_MS = 30 * 60 * 1000
const COOLDOWN_AFTER_LOSS_MS = 4 * CANDLE_INTERVAL_MS
const CONSECUTIVE_LOSS_LIMIT = 2
const COOLDOWN_AFTER_STREAK_MS = 8 * CANDLE_INTERVAL_MS
const BASE_THRESHOLD = 85

export class PaperTradeTracker extends EventEmitter {
  private openTrades: Map<string, Trade> = new Map()
  private closedRecently: Map<string, number> = new Map()
  private consecutiveLosses: Map<string, number> = new Map()
  private recentResults: ('WIN' | 'LOSS')[] = []
  public userId: number = 0 // Multi-tenancy: set before use

  async init(): Promise<void> {
    try {
      const trades = await getOpenPaperTrades(this.userId)
      for (const t of trades) {
        t.currentStopLoss = t.stopLoss
        t.partialClosed = false
        t.candleCount = 0
        t.peakPnl = 0
        this.openTrades.set(t.symbol, t)
      }
      console.log(`[PaperTracker] Loaded ${trades.length} open paper trade(s)`)
    } catch (err) {
      console.error('[PaperTracker] Init error:', (err as Error).message)
    }
  }

  getOpenTradesMap(): Map<string, Trade> { return this.openTrades }

  // ── Called by batch scorer when a pair has high confidence ──

  async evaluateAndOpen(
    symbol: string,
    signal: SignalData,
    indicators: IndicatorValues,
    priceData: PriceData,
    settings: UserSettings,
    multiTimeframe?: MultiTimeframeData,
    externalData?: ExternalData,
  ): Promise<void> {
    if (this.openTrades.has(symbol)) return
    if (signal.confidence !== 'high' || signal.direction === 'NEUTRO' || !signal.riskManagement) return

    const check = this.evaluateFilters(symbol, signal, priceData, indicators, settings, multiTimeframe, externalData)
    this.emit('paper-entry-check', { symbol, check })

    if (!check.allowed) {
      const failed = check.filters.filter(f => !f.passed).map(f => f.name).join(', ')
      console.log(`[PaperTracker] ${symbol}: bloqueado (${check.passedCount}/${check.totalCount}) — ${failed}`)
      return
    }

    const trade: Record<string, unknown> = {
      symbol,
      direction: signal.direction,
      entryPrice: signal.riskManagement.entry,
      stopLoss: signal.riskManagement.stopLoss,
      takeProfit: signal.riskManagement.takeProfit,
      confluenceScore: signal.confluenceScore,
      entryFilters: check.filters,
    }

    try {
      const id = await insertPaperTrade(this.userId, trade)
      const saved: Trade = {
        id, symbol, direction: signal.direction as 'LONG' | 'SHORT',
        entryPrice: signal.riskManagement.entry, stopLoss: signal.riskManagement.stopLoss,
        takeProfit: signal.riskManagement.takeProfit, exitPrice: null, result: null,
        pnlPercent: null, confluenceScore: signal.confluenceScore, status: 'OPEN',
        openedAt: new Date().toISOString(), closedAt: null,
        currentStopLoss: signal.riskManagement.stopLoss, partialClosed: false, candleCount: 0, peakPnl: 0,
      }
      this.openTrades.set(symbol, saved)
      this.emit('paper-trade-opened', saved)
      console.log(`[PaperTracker] Paper trade opened: ${symbol} ${signal.direction} @ ${signal.riskManagement.entry}`)
    } catch (err) {
      console.error(`[PaperTracker] Insert error for ${symbol}:`, (err as Error).message)
    }
  }

  // ── Called on candle close for open paper trades ──

  async onCandleClose(symbol: string, signal: SignalData, currentPrice: number): Promise<void> {
    const trade = this.openTrades.get(symbol)
    if (!trade) return

    trade.candleCount = (trade.candleCount ?? 0) + 1

    // Score exit
    if (sharedShouldExitOnScore(trade.direction, signal.confluenceScore)) {
      const pnl = this.calcPnl(trade, currentPrice)
      await this.closeTrade(trade, currentPrice, pnl >= 0 ? 'WIN' : 'LOSS', 'SCORE_EXIT')
      return
    }

    // Time stop
    if (sharedShouldExitOnTime(trade.candleCount ?? 0, this.calcPnl(trade, currentPrice), TIME_STOP_CANDLES, TIME_STOP_MIN_PNL)) {
      const pnl = this.calcPnl(trade, currentPrice)
      await this.closeTrade(trade, currentPrice, pnl >= 0 ? 'WIN' : 'LOSS', 'TIME_STOP')
      return
    }
  }

  // ── Called on every price update from aggregate streams ──

  async checkPrice(symbol: string, price: number): Promise<void> {
    const trade = this.openTrades.get(symbol)
    if (!trade || !price || price <= 0) return

    const effectiveSL = trade.currentStopLoss ?? trade.stopLoss
    const pnl = this.calcPnl(trade, price)
    if (pnl > (trade.peakPnl ?? 0)) trade.peakPnl = pnl

    // Partial TP
    if (!trade.partialClosed) {
      const riskDist = Math.abs(trade.entryPrice - trade.stopLoss)
      const target = trade.direction === 'LONG'
        ? trade.entryPrice + riskDist * PARTIAL_TP_RATIO
        : trade.entryPrice - riskDist * PARTIAL_TP_RATIO

      const hit = trade.direction === 'LONG' ? price >= target : price <= target
      if (hit) {
        trade.partialClosed = true
        trade.currentStopLoss = trade.entryPrice
        const ptPnl = this.calcPnl(trade, price)
        trade.partialTpPrice = price
        trade.partialTpPnl = ptPnl
        if (trade.id) updatePaperPartialTp(this.userId, trade.id, price, ptPnl).catch(() => {})
        this.emit('paper-trade-partial', { symbol, price, pnl: ptPnl })
      }
    }

    // Trailing stop
    if (trade.partialClosed) {
      const tpDist = Math.abs(trade.takeProfit - trade.entryPrice)
      const progress = trade.direction === 'LONG' ? price - trade.entryPrice : trade.entryPrice - price
      if (progress > tpDist * 0.5) {
        const trail = trade.direction === 'LONG' ? price - progress * 0.5 : price + progress * 0.5
        if (trade.direction === 'LONG' && trail > (trade.currentStopLoss ?? trade.stopLoss)) trade.currentStopLoss = trail
        else if (trade.direction === 'SHORT' && trail < (trade.currentStopLoss ?? trade.stopLoss)) trade.currentStopLoss = trail
      }
    }

    // TP hit
    if ((trade.direction === 'LONG' && price >= trade.takeProfit) || (trade.direction === 'SHORT' && price <= trade.takeProfit)) {
      await this.closeTrade(trade, price, 'WIN', 'TP')
      return
    }

    // SL hit
    if (trade.direction === 'LONG' && price <= effectiveSL) {
      const r = this.calcPnl(trade, effectiveSL) >= 0 ? 'WIN' : 'LOSS'
      await this.closeTrade(trade, effectiveSL, r as 'WIN' | 'LOSS', effectiveSL > trade.stopLoss ? 'TRAILING_SL' : 'SL')
    } else if (trade.direction === 'SHORT' && price >= effectiveSL) {
      const r = this.calcPnl(trade, effectiveSL) >= 0 ? 'WIN' : 'LOSS'
      await this.closeTrade(trade, effectiveSL, r as 'WIN' | 'LOSS', effectiveSL < trade.stopLoss ? 'TRAILING_SL' : 'SL')
    }
  }

  // ── Filters (same as real TradeTracker) ──

  private evaluateFilters(
    symbol: string, signal: SignalData, priceData: PriceData,
    indicators: IndicatorValues, settings: UserSettings,
    multiTimeframe?: MultiTimeframeData, externalData?: ExternalData,
  ): EntryCheckResult {
    const filters: EntryFilter[] = []

    // Score threshold
    const threshold = this.getDynamicThreshold()
    const scoreOk = signal.direction === 'LONG' ? signal.confluenceScore >= threshold : signal.confluenceScore <= (100 - threshold)
    filters.push({ name: 'Score', passed: scoreOk, detail: `${signal.confluenceScore.toFixed(0)}% (threshold: ${threshold})` })

    // Multi-timeframe
    if (multiTimeframe) {
      const dirs = [multiTimeframe['15m'].direction, multiTimeframe['1h']?.direction, multiTimeframe['4h']?.direction].filter(Boolean)
      const aligned = dirs.filter(d => d === signal.direction).length
      const total = dirs.filter(d => d !== 'NEUTRO').length
      const ok = total < 2 || aligned >= 2
      filters.push({ name: 'Multi-TF', passed: ok, detail: `${aligned}/${total} alinhados` })
    }

    // ADX
    if (indicators.adx) {
      filters.push({ name: 'ADX', passed: indicators.adx.trending, detail: `ADX ${indicators.adx.value.toFixed(0)}` })
    }

    // Volume
    const volOk = indicators.volume.current >= indicators.volume.average * 0.8
    filters.push({ name: 'Volume', passed: volOk, detail: `${(indicators.volume.current / 1000).toFixed(1)}K / ${(indicators.volume.average / 1000).toFixed(1)}K` })

    // Funding blackout
    let fundOk = true
    if (priceData.fundingCountdown && priceData.fundingCountdown !== '00:00:00') {
      const parts = priceData.fundingCountdown.split(':').map(Number)
      const ms = (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000
      fundOk = !(ms < FUNDING_BLACKOUT_MS && ms > 0)
    }
    filters.push({ name: 'Funding', passed: fundOk, detail: priceData.fundingCountdown })

    // L/S Ratio
    if (externalData?.longShortRatio) {
      const { crowded, ratio } = externalData.longShortRatio
      const ok = !((crowded === 'long' && signal.direction === 'LONG') || (crowded === 'short' && signal.direction === 'SHORT'))
      filters.push({ name: 'L/S Ratio', passed: ok, detail: `${ratio.toFixed(2)} (${crowded})` })
    }

    // Cooldown
    const last = this.closedRecently.get(symbol)
    let cdOk = true
    if (last) {
      const losses = this.consecutiveLosses.get(symbol) ?? 0
      const cdMs = losses >= CONSECUTIVE_LOSS_LIMIT ? COOLDOWN_AFTER_STREAK_MS : COOLDOWN_AFTER_LOSS_MS
      cdOk = Date.now() - last >= cdMs
    }
    filters.push({ name: 'Cooldown', passed: cdOk, detail: cdOk ? 'OK' : 'Em cooldown' })

    const passedCount = filters.filter(f => f.passed).length
    return { allowed: filters.every(f => f.passed), filters, passedCount, totalCount: filters.length }
  }

  private getDynamicThreshold(): number {
    if (this.recentResults.length < 5) return BASE_THRESHOLD
    const losses = this.recentResults.slice(-5).filter(r => r === 'LOSS').length
    return losses >= 3 ? 90 : BASE_THRESHOLD
  }

  private calcPnl(trade: Trade, price: number): number {
    return sharedCalcPnl(trade.direction as 'LONG' | 'SHORT', trade.entryPrice, price)
  }

  private async closeTrade(trade: Trade, exitPrice: number, result: 'WIN' | 'LOSS', reason: string): Promise<void> {
    const pnl = this.calcPnl(trade, exitPrice)
    const finalResult = pnl >= 0 ? 'WIN' : 'LOSS'
    try {
      if (trade.id) await closePaperTrade(this.userId, trade.id, exitPrice, finalResult, pnl, reason)
      const closed: Trade = { ...trade, exitPrice, result: finalResult, exitReason: reason as Trade['exitReason'], pnlPercent: pnl, status: 'CLOSED', closedAt: new Date().toISOString() }
      this.openTrades.delete(trade.symbol)
      this.closedRecently.set(trade.symbol, Date.now())

      // Cleanup old cooldowns (keep only last hour)
      const ONE_HOUR = 60 * 60 * 1000
      for (const [sym, ts] of this.closedRecently) {
        if (Date.now() - ts > ONE_HOUR) this.closedRecently.delete(sym)
      }

      if (finalResult === 'LOSS') this.consecutiveLosses.set(trade.symbol, (this.consecutiveLosses.get(trade.symbol) ?? 0) + 1)
      else this.consecutiveLosses.set(trade.symbol, 0)
      this.recentResults.push(finalResult)
      if (this.recentResults.length > 10) this.recentResults = this.recentResults.slice(-10)
      this.emit('paper-trade-closed', closed)
      console.log(`[PaperTracker] Closed: ${trade.symbol} ${finalResult} (${reason}) P&L: ${pnl.toFixed(2)}%`)
    } catch (err) {
      console.error(`[PaperTracker] Close error:`, (err as Error).message)
    }
  }

  async getHistory(symbol?: string, limit = 50, offset = 0) { return getPaperTradeHistory(this.userId, symbol, limit, offset) }
  async getStats(symbol?: string) { return getPaperTradeStats(this.userId, symbol) }
}
