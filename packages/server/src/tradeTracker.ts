import { EventEmitter } from 'events'
import type {
  Trade, TradeRecommendation, TradeStats, SignalData,
  IndicatorValues, PriceData, UserSettings, ExternalData,
  MultiTimeframeData, EntryFilter, EntryCheckResult,
} from '@bottrade/shared'
import {
  insertTrade,
  closeTrade as dbCloseTrade,
  updatePartialTp as dbUpdatePartialTp,
  updateTradeRuntimeState,
  getOpenTrades,
  getTradeHistory as dbGetTradeHistory,
  getTradeStats as dbGetTradeStats,
} from './database.js'
import {
  calcPnl as sharedCalcPnl,
  shouldExitOnScore as sharedShouldExitOnScore,
  shouldExitOnTime as sharedShouldExitOnTime,
} from './baseTradeEngine.js'

// ── Configuration ────────────────────────────────────────────────────────────

const CANDLE_INTERVAL_MS = 15 * 60 * 1000 // 15min
const MAX_RISK_PERCENT = 0.02 // 2% max risk per trade
const PARTIAL_TP_RATIO = 1.0 // Take 50% at 1:1 R:R
const TRAILING_ACTIVATION = 0.5 // Activate trailing at 50% of TP distance
const TIME_STOP_CANDLES = 8 // Close after 8 candles (2h) if no progress
const TIME_STOP_MIN_PNL = 0.3 // Minimum P&L% to consider "progress"
const FUNDING_BLACKOUT_MS = 30 * 60 * 1000 // 30min before funding

// Cooldowns
const COOLDOWN_AFTER_WIN = 1 // candles
const COOLDOWN_AFTER_LOSS = 4 // candles
const COOLDOWN_AFTER_STREAK = 8 // candles after 2+ consecutive losses
const CONSECUTIVE_LOSS_LIMIT = 2

// Dynamic threshold
const BASE_SCORE_THRESHOLD = 85
const ELEVATED_SCORE_THRESHOLD = 90
const PERFORMANCE_LOOKBACK = 5 // last N trades to evaluate

export class TradeTracker extends EventEmitter {
  private openTrades: Map<string, Trade> = new Map()
  private closedRecently: Map<string, number> = new Map() // symbol → timestamp
  private consecutiveLosses: Map<string, number> = new Map() // symbol → count
  private recentResults: ('WIN' | 'LOSS')[] = [] // last N results globally
  public userId: number = 0 // Multi-tenancy: set before use

  async init(): Promise<void> {
    try {
      const trades = await getOpenTrades(this.userId)
      for (const trade of trades) {
        // Load persisted runtime state, fallback to defaults
        trade.currentStopLoss = trade.currentStopLoss ?? trade.stopLoss
        trade.partialClosed = trade.partialClosed ?? false
        trade.candleCount = trade.candleCount ?? 0
        trade.peakPnl = trade.peakPnl ?? 0
        this.openTrades.set(trade.symbol, trade)
      }
      console.log(`[TradeTracker] Loaded ${trades.length} open trade(s)`)
    } catch (err) {
      console.error('[TradeTracker] Failed to load open trades:', (err as Error).message)
    }
  }

  getOpenTradesMap(): Map<string, Trade> {
    return this.openTrades
  }

  // ── Entry Filters ────────────────────────────────────────────────────────

  evaluateEntryFilters(
    symbol: string,
    signal: SignalData,
    priceData: PriceData,
    indicators: IndicatorValues,
    settings: UserSettings,
    multiTimeframe?: MultiTimeframeData,
    externalData?: ExternalData,
  ): EntryCheckResult {
    const filters: EntryFilter[] = []

    // Pre-check: already open or not high confidence (these are hard blocks, not filters)
    if (this.openTrades.has(symbol)) {
      return { allowed: false, filters: [{ name: 'Trade Aberto', passed: false, detail: 'Já existe trade aberto para este par' }], passedCount: 0, totalCount: 1 }
    }
    if (signal.confidence !== 'high' || signal.direction === 'NEUTRO' || !signal.riskManagement) {
      return { allowed: false, filters: [{ name: 'Alta Confiança', passed: false, detail: `Score ${signal.confluenceScore.toFixed(0)}% — precisa >= 85 ou <= 15` }], passedCount: 0, totalCount: 1 }
    }

    // Filter 1: Dynamic score threshold
    const threshold = this.getDynamicThreshold()
    const scoreOk = signal.direction === 'LONG'
      ? signal.confluenceScore >= threshold
      : signal.confluenceScore <= (100 - threshold)
    filters.push({
      name: 'Score Threshold',
      passed: scoreOk,
      detail: scoreOk
        ? `Score ${signal.confluenceScore.toFixed(0)}% ≥ ${threshold} (dinâmico)`
        : `Score ${signal.confluenceScore.toFixed(0)}% < ${threshold} (dinâmico)`,
    })

    // Filter 2: Multi-timeframe gate
    let mtfOk = true
    if (multiTimeframe) {
      const dirs = [
        multiTimeframe['15m'].direction,
        multiTimeframe['1h']?.direction,
        multiTimeframe['4h']?.direction,
      ].filter(Boolean)
      const alignedCount = dirs.filter(d => d === signal.direction).length
      const totalNonNeutral = dirs.filter(d => d !== 'NEUTRO').length
      mtfOk = totalNonNeutral < 2 || alignedCount >= 2
      const tfSummary = `15m:${multiTimeframe['15m'].direction} 1h:${multiTimeframe['1h']?.direction ?? '?'} 4h:${multiTimeframe['4h']?.direction ?? '?'}`
      filters.push({
        name: 'Multi-Timeframe',
        passed: mtfOk,
        detail: mtfOk ? `Alinhado (${alignedCount}/${totalNonNeutral}) — ${tfSummary}` : `Não alinhado (${alignedCount}/${totalNonNeutral}) — ${tfSummary}`,
      })
    } else {
      filters.push({ name: 'Multi-Timeframe', passed: true, detail: 'Dados MTF indisponíveis — ignorado' })
    }

    // Filter 3: ADX trending
    let adxOk = true
    if (indicators.adx) {
      adxOk = indicators.adx.trending
      filters.push({
        name: 'ADX Tendência',
        passed: adxOk,
        detail: adxOk ? `ADX ${indicators.adx.value.toFixed(0)} ≥ 25 — mercado em tendência` : `ADX ${indicators.adx.value.toFixed(0)} < 25 — mercado lateral`,
      })
    } else {
      filters.push({ name: 'ADX Tendência', passed: true, detail: 'ADX indisponível — ignorado' })
    }

    // Filter 4: Volume confirmation
    const volOk = indicators.volume.current >= indicators.volume.average * 0.8
    filters.push({
      name: 'Volume',
      passed: volOk,
      detail: volOk
        ? `Volume ${(indicators.volume.current / 1000).toFixed(1)}K ≥ 80% da média`
        : `Volume ${(indicators.volume.current / 1000).toFixed(1)}K < 80% da média (${(indicators.volume.average / 1000).toFixed(1)}K)`,
    })

    // Filter 5: Funding blackout
    let fundingOk = true
    const countdown = priceData.fundingCountdown
    if (countdown && countdown !== '00:00:00') {
      const parts = countdown.split(':').map(Number)
      const totalMs = (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000
      fundingOk = !(totalMs < FUNDING_BLACKOUT_MS && totalMs > 0)
    }
    filters.push({
      name: 'Funding Timing',
      passed: fundingOk,
      detail: fundingOk ? `Fora do blackout (${countdown})` : `Funding em ${countdown} — dentro do blackout de 30min`,
    })

    // Filter 6: L/S Ratio
    let lsOk = true
    if (externalData?.longShortRatio) {
      const { crowded, ratio } = externalData.longShortRatio
      const sameDir = (crowded === 'long' && signal.direction === 'LONG') || (crowded === 'short' && signal.direction === 'SHORT')
      lsOk = !sameDir
      filters.push({
        name: 'Long/Short Ratio',
        passed: lsOk,
        detail: lsOk
          ? `Ratio ${ratio.toFixed(2)} — crowd não está na mesma direção`
          : `Ratio ${ratio.toFixed(2)} — crowd está ${crowded} (contra-indicador)`,
      })
    } else {
      filters.push({ name: 'Long/Short Ratio', passed: true, detail: 'Dados indisponíveis — ignorado' })
    }

    // Filter 7: Cooldown
    let cooldownOk = true
    const lastClosed = this.closedRecently.get(symbol)
    if (lastClosed) {
      const losses = this.consecutiveLosses.get(symbol) ?? 0
      const cooldownCandles = losses >= CONSECUTIVE_LOSS_LIMIT ? COOLDOWN_AFTER_STREAK : COOLDOWN_AFTER_LOSS
      const cooldownMs = cooldownCandles * CANDLE_INTERVAL_MS
      if (Date.now() - lastClosed < cooldownMs) {
        cooldownOk = false
        const remaining = Math.ceil((cooldownMs - (Date.now() - lastClosed)) / CANDLE_INTERVAL_MS)
        filters.push({ name: 'Cooldown', passed: false, detail: `${remaining} candle(s) restantes (${losses} losses consecutivos)` })
      } else {
        filters.push({ name: 'Cooldown', passed: true, detail: 'Cooldown expirado' })
      }
    } else {
      filters.push({ name: 'Cooldown', passed: true, detail: 'Sem cooldown ativo' })
    }

    const passedCount = filters.filter(f => f.passed).length
    const totalCount = filters.length
    // Require at least 5 of 7 filters (71%) — allows some flexibility
    const allowed = passedCount >= Math.min(5, totalCount)

    return { allowed, filters, passedCount, totalCount }
  }

  // ── Dynamic threshold ──────────────────────────────────────────────────

  private getDynamicThreshold(): number {
    if (this.recentResults.length < PERFORMANCE_LOOKBACK) return BASE_SCORE_THRESHOLD
    const recent = this.recentResults.slice(-PERFORMANCE_LOOKBACK)
    const losses = recent.filter(r => r === 'LOSS').length
    // If 3+ losses in last 5 trades, raise threshold
    if (losses >= 3) return ELEVATED_SCORE_THRESHOLD
    return BASE_SCORE_THRESHOLD
  }

  // ── Risk-based position sizing ─────────────────────────────────────────

  private calcPositionSize(
    signal: SignalData,
    settings: UserSettings,
  ): number {
    if (!signal.riskManagement) return settings.baseCapital * settings.leverage

    const entry = signal.riskManagement.entry
    const sl = signal.riskManagement.stopLoss
    const riskDistance = Math.abs(entry - sl) / entry // % distance to SL

    if (riskDistance <= 0) return settings.baseCapital * settings.leverage

    // Max risk = 2% of capital
    const maxRiskAmount = settings.baseCapital * MAX_RISK_PERCENT
    // Position size that risks exactly 2%
    const positionSize = maxRiskAmount / riskDistance

    // Cap at capital × leverage
    const maxPosition = settings.baseCapital * settings.leverage
    return Math.min(positionSize, maxPosition)
  }

  // ── Main entry point ───────────────────────────────────────────────────

  async checkSignalForTrade(
    symbol: string,
    signal: SignalData,
    currentPrice: number,
    indicators?: IndicatorValues,
    priceData?: PriceData,
    settings?: UserSettings,
    multiTimeframe?: MultiTimeframeData,
    externalData?: ExternalData,
  ): Promise<void> {
    const existing = this.openTrades.get(symbol)

    // If trade is open, handle candle tick + recommendation + score exit
    if (existing) {
      // Increment candle count
      existing.candleCount = (existing.candleCount ?? 0) + 1

      // Score deterioration exit
      if (this.shouldExitOnScore(existing, signal)) {
        const pnl = this.calcPnl(existing, currentPrice)
        const result: 'WIN' | 'LOSS' = pnl >= 0 ? 'WIN' : 'LOSS'
        await this.closeTradeWithResult(existing, currentPrice, result, 'SCORE_EXIT')
        return
      }

      // Time stop
      if (this.shouldExitOnTime(existing, currentPrice)) {
        const pnl = this.calcPnl(existing, currentPrice)
        const result: 'WIN' | 'LOSS' = pnl >= 0 ? 'WIN' : 'LOSS'
        await this.closeTradeWithResult(existing, currentPrice, result, 'TIME_STOP')
        return
      }

      // Generate recommendation
      if (indicators && priceData) {
        const recommendation = this.generateRecommendation(existing, signal, indicators, priceData)
        this.emit('trade-recommendation', { symbol, recommendation })
      }

      // Persist runtime state to DB
      if (existing.id != null) {
        updateTradeRuntimeState(this.userId, existing.id, {
          currentStopLoss: existing.currentStopLoss ?? existing.stopLoss,
          partialClosed: existing.partialClosed ?? false,
          candleCount: existing.candleCount ?? 0,
          peakPnl: existing.peakPnl ?? 0,
        }).catch(err => console.error(`[TradeTracker] Failed to persist runtime state:`, (err as Error).message))
      }
      return
    }

    // Try to open new trade
    if (indicators && priceData && settings) {
      const check = this.evaluateEntryFilters(symbol, signal, priceData, indicators, settings, multiTimeframe, externalData)
      // Emit the check result for the frontend
      this.emit('entry-check', { symbol, check })

      if (!check.allowed) {
        const failed = check.filters.filter(f => !f.passed).map(f => f.name).join(', ')
        console.log(`[TradeTracker] ${symbol}: entrada bloqueada (${check.passedCount}/${check.totalCount}) — ${failed}`)
        return
      }

      const positionSize = this.calcPositionSize(signal, settings)

      const now = new Date().toISOString()
      const trade: Omit<Trade, 'id'> = {
        symbol,
        direction: signal.direction as 'LONG' | 'SHORT',
        entryPrice: signal.riskManagement!.entry,
        stopLoss: signal.riskManagement!.stopLoss,
        takeProfit: signal.riskManagement!.takeProfit,
        exitPrice: null,
        result: null,
        pnlPercent: null,
        confluenceScore: signal.confluenceScore,
        status: 'OPEN',
        openedAt: now,
        closedAt: null,
        // Runtime state
        currentStopLoss: signal.riskManagement!.stopLoss,
        partialClosed: false,
        candleCount: 0,
        peakPnl: 0,
      }

      try {
        const id = await insertTrade(this.userId, trade)
        const savedTrade: Trade = { ...trade, id }
        this.openTrades.set(symbol, savedTrade)
        this.emit('trade-opened', savedTrade)
        console.log(`[TradeTracker] Trade opened: ${symbol} ${trade.direction} @ ${trade.entryPrice} (pos: ${positionSize.toFixed(2)} USDT, threshold: ${this.getDynamicThreshold()})`)
      } catch (err) {
        console.error(`[TradeTracker] Failed to insert trade for ${symbol}:`, (err as Error).message)
      }
    }
  }

  // ── Price-based exits (runs every ~1s) ─────────────────────────────────

  async checkPriceForExits(symbol: string, currentPrice: number): Promise<void> {
    const trade = this.openTrades.get(symbol)
    if (!trade || !currentPrice || currentPrice <= 0) return

    const effectiveSL = trade.currentStopLoss ?? trade.stopLoss
    const pnl = this.calcPnl(trade, currentPrice)

    // Track peak P&L for trailing
    if (pnl > (trade.peakPnl ?? 0)) {
      trade.peakPnl = pnl
    }

    // Partial TP: close 50% at 1:1 R:R
    if (!trade.partialClosed) {
      const riskDistance = Math.abs(trade.entryPrice - trade.stopLoss)
      const partialTarget = trade.direction === 'LONG'
        ? trade.entryPrice + riskDistance * PARTIAL_TP_RATIO
        : trade.entryPrice - riskDistance * PARTIAL_TP_RATIO

      if (trade.direction === 'LONG' && currentPrice >= partialTarget) {
        trade.partialClosed = true
        trade.currentStopLoss = trade.entryPrice
        const partialPnl = this.calcPnl(trade, currentPrice)
        trade.partialTpPrice = currentPrice
        trade.partialTpPnl = partialPnl
        trade.partialTpAt = new Date().toISOString()
        if (trade.id != null) {
          dbUpdatePartialTp(this.userId, trade.id, currentPrice, partialPnl).catch(err =>
            console.error(`[TradeTracker] Failed to save partial TP:`, err.message))
          updateTradeRuntimeState(this.userId, trade.id, {
            currentStopLoss: trade.currentStopLoss,
            partialClosed: true,
            candleCount: trade.candleCount ?? 0,
            peakPnl: trade.peakPnl ?? 0,
          }).catch(err => console.error(`[TradeTracker] Failed to persist runtime state:`, (err as Error).message))
        }
        this.emit('trade-partial', { symbol, trade, message: `Partial TP 50% @ ${currentPrice.toFixed(2)} (+${partialPnl.toFixed(2)}%) — SL movido para breakeven` })
        console.log(`[TradeTracker] ${symbol}: Partial TP at ${currentPrice.toFixed(2)} (+${partialPnl.toFixed(2)}%), SL → breakeven`)
      } else if (trade.direction === 'SHORT' && currentPrice <= partialTarget) {
        trade.partialClosed = true
        trade.currentStopLoss = trade.entryPrice
        const partialPnl = this.calcPnl(trade, currentPrice)
        trade.partialTpPrice = currentPrice
        trade.partialTpPnl = partialPnl
        trade.partialTpAt = new Date().toISOString()
        if (trade.id != null) {
          dbUpdatePartialTp(this.userId, trade.id, currentPrice, partialPnl).catch(err =>
            console.error(`[TradeTracker] Failed to save partial TP:`, err.message))
          updateTradeRuntimeState(this.userId, trade.id, {
            currentStopLoss: trade.currentStopLoss,
            partialClosed: true,
            candleCount: trade.candleCount ?? 0,
            peakPnl: trade.peakPnl ?? 0,
          }).catch(err => console.error(`[TradeTracker] Failed to persist runtime state:`, (err as Error).message))
        }
        this.emit('trade-partial', { symbol, trade, message: `Partial TP 50% @ ${currentPrice.toFixed(2)} (+${partialPnl.toFixed(2)}%) — SL movido para breakeven` })
        console.log(`[TradeTracker] ${symbol}: Partial TP at ${currentPrice.toFixed(2)} (+${partialPnl.toFixed(2)}%), SL → breakeven`)
      }
    }

    // Trailing stop: after 50% of TP distance, trail the SL
    if (trade.partialClosed) {
      const tpDistance = Math.abs(trade.takeProfit - trade.entryPrice)
      const progress = trade.direction === 'LONG'
        ? currentPrice - trade.entryPrice
        : trade.entryPrice - currentPrice

      if (progress > tpDistance * TRAILING_ACTIVATION) {
        // Trail SL at 50% of the current profit
        const trailSL = trade.direction === 'LONG'
          ? currentPrice - (progress * 0.5)
          : currentPrice + (progress * 0.5)

        if (trade.direction === 'LONG' && trailSL > (trade.currentStopLoss ?? trade.stopLoss)) {
          trade.currentStopLoss = trailSL
        } else if (trade.direction === 'SHORT' && trailSL < (trade.currentStopLoss ?? trade.stopLoss)) {
          trade.currentStopLoss = trailSL
        }
      }
    }

    // Check TP hit
    if (trade.direction === 'LONG') {
      if (currentPrice >= trade.takeProfit) {
        await this.closeTradeWithResult(trade, currentPrice, 'WIN', 'TP')
        return
      }
    } else {
      if (currentPrice <= trade.takeProfit) {
        await this.closeTradeWithResult(trade, currentPrice, 'WIN', 'TP')
        return
      }
    }

    // Check SL hit (using trailing SL)
    if (trade.direction === 'LONG') {
      if (currentPrice <= effectiveSL) {
        const reason = effectiveSL > trade.stopLoss ? 'TRAILING_SL' : 'SL'
        const result: 'WIN' | 'LOSS' = this.calcPnl(trade, effectiveSL) >= 0 ? 'WIN' : 'LOSS'
        await this.closeTradeWithResult(trade, effectiveSL, result, reason)
      }
    } else {
      if (currentPrice >= effectiveSL) {
        const reason = effectiveSL < trade.stopLoss ? 'TRAILING_SL' : 'SL'
        const result: 'WIN' | 'LOSS' = this.calcPnl(trade, effectiveSL) >= 0 ? 'WIN' : 'LOSS'
        await this.closeTradeWithResult(trade, effectiveSL, result, reason)
      }
    }
  }

  // ── Score deterioration exit ───────────────────────────────────────────

  private shouldExitOnScore(trade: Trade, signal: SignalData): boolean {
    return sharedShouldExitOnScore(trade.direction, signal.confluenceScore)
  }

  // ── Time stop ──────────────────────────────────────────────────────────

  private shouldExitOnTime(trade: Trade, currentPrice: number): boolean {
    const pnl = this.calcPnl(trade, currentPrice)
    return sharedShouldExitOnTime(trade.candleCount ?? 0, pnl, TIME_STOP_CANDLES, TIME_STOP_MIN_PNL)
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private calcPnl(trade: Trade, currentPrice: number): number {
    return sharedCalcPnl(trade.direction as 'LONG' | 'SHORT', trade.entryPrice, currentPrice)
  }

  generateRecommendation(
    trade: Trade,
    signal: SignalData,
    indicators: IndicatorValues,
    priceData: PriceData
  ): TradeRecommendation {
    const currentPrice = priceData.price
    const unrealizedPnl = this.calcPnl(trade, currentPrice)

    const contraReasons: string[] = []

    if (trade.direction === 'LONG') {
      if (indicators.macd.histogram < 0 || indicators.macd.trend === 'bearish') {
        contraReasons.push('MACD perdendo momentum')
      }
      if (indicators.stochRsi.persistentOverbought) {
        contraReasons.push('StochRSI sobrecompra persistente')
      }
      if (indicators.macd.divergence === 'bearish') {
        contraReasons.push('Divergência bearish')
      }
      if (indicators.volume.isSpike && indicators.volume.candleDirection === 'red') {
        contraReasons.push('Volume spike vermelho')
      }
      if (signal.confluenceScore < 65) {
        contraReasons.push(`Score caiu para ${signal.confluenceScore.toFixed(0)}`)
      }
      if (indicators.rsi && indicators.rsi.zone === 'overbought') {
        contraReasons.push('RSI em sobrecompra')
      }
      if (indicators.adx && !indicators.adx.trending) {
        contraReasons.push('ADX indica mercado lateral')
      }
    } else {
      if (indicators.macd.histogram > 0 || indicators.macd.trend === 'bullish') {
        contraReasons.push('MACD ganhando momentum')
      }
      if (indicators.stochRsi.persistentOversold) {
        contraReasons.push('StochRSI sobrevenda persistente')
      }
      if (indicators.macd.divergence === 'bullish') {
        contraReasons.push('Divergência bullish')
      }
      if (indicators.volume.isSpike && indicators.volume.candleDirection === 'green') {
        contraReasons.push('Volume spike verde')
      }
      if (signal.confluenceScore > 35) {
        contraReasons.push(`Score subiu para ${signal.confluenceScore.toFixed(0)}`)
      }
      if (indicators.rsi && indicators.rsi.zone === 'oversold') {
        contraReasons.push('RSI em sobrevenda')
      }
      if (indicators.adx && !indicators.adx.trending) {
        contraReasons.push('ADX indica mercado lateral')
      }
    }

    const contraCount = contraReasons.length
    const effectiveSL = trade.currentStopLoss ?? trade.stopLoss
    const tpDistance = Math.abs(trade.takeProfit - trade.entryPrice)
    const priceAdvance = trade.direction === 'LONG'
      ? currentPrice - trade.entryPrice
      : trade.entryPrice - currentPrice
    const advancedPastHalf = priceAdvance > 0 && priceAdvance > tpDistance * 0.5

    let type: TradeRecommendation['type']
    let message: string
    let suggestedAction: string
    let newStopLoss: number | undefined

    if (advancedPastHalf && contraCount <= 1) {
      type = 'MOVE_SL'
      message = `Mover SL para breakeven — proteger lucro`
      suggestedAction = 'Mover SL'
      newStopLoss = trade.entryPrice
    } else if (contraCount >= 4) {
      type = 'CLOSE_100'
      message = 'Realizar 100% — sinais claros de reversão'
      suggestedAction = 'Fechar posição'
    } else if (contraCount === 3) {
      type = 'PARTIAL_75'
      message = `Realizar 75% — ${contraReasons.slice(0, 2).join(', ')}`
      suggestedAction = 'Realizar 75%'
    } else if (contraCount === 2) {
      type = 'PARTIAL_50'
      message = `Cogitar realizar 50% — ${contraReasons.join(', ')}`
      suggestedAction = 'Realizar 50%'
    } else if (contraCount === 1) {
      type = 'HOLD'
      message = `Manter com cautela — ${contraReasons[0]}`
      suggestedAction = 'Manter'
    } else {
      type = 'HOLD'
      message = trade.partialClosed
        ? `Manter — partial TP realizado, SL em breakeven`
        : 'Manter — momentum confirma direção'
      suggestedAction = 'Manter'
    }

    return { type, message, reasons: contraReasons, unrealizedPnl, suggestedAction, newStopLoss }
  }

  // ── Trade history & stats ──────────────────────────────────────────────

  async getTradeHistoryData(symbol?: string, limit = 50, offset = 0): Promise<{ trades: Trade[]; total: number }> {
    return dbGetTradeHistory(this.userId, symbol, limit, offset)
  }

  async getStats(symbol?: string): Promise<TradeStats> {
    return dbGetTradeStats(this.userId, symbol)
  }

  // ── Close trade ────────────────────────────────────────────────────────

  private async closeTradeWithResult(
    trade: Trade,
    exitPrice: number,
    result: 'WIN' | 'LOSS',
    exitReason: 'TP' | 'SL' | 'SCORE_EXIT' | 'TIME_STOP' | 'TRAILING_SL' = 'SL'
  ): Promise<void> {
    const pnlPercent = this.calcPnl(trade, exitPrice)
    // If trailing SL moved above entry and hit, it's actually a win
    const finalResult = pnlPercent >= 0 ? 'WIN' : 'LOSS'

    try {
      if (trade.id != null) {
        await dbCloseTrade(this.userId, trade.id, exitPrice, finalResult, pnlPercent)
      }

      const closedTrade: Trade = {
        ...trade,
        exitPrice,
        result: finalResult,
        exitReason,
        pnlPercent,
        status: 'CLOSED',
        closedAt: new Date().toISOString(),
      }

      this.openTrades.delete(trade.symbol)
      this.closedRecently.set(trade.symbol, Date.now())

      // Cleanup old cooldowns (keep only last hour)
      const ONE_HOUR = 60 * 60 * 1000
      for (const [sym, ts] of this.closedRecently) {
        if (Date.now() - ts > ONE_HOUR) this.closedRecently.delete(sym)
      }

      // Track consecutive losses
      if (finalResult === 'LOSS') {
        const current = this.consecutiveLosses.get(trade.symbol) ?? 0
        this.consecutiveLosses.set(trade.symbol, current + 1)
      } else {
        this.consecutiveLosses.set(trade.symbol, 0)
      }

      // Track recent results for dynamic threshold
      this.recentResults.push(finalResult)
      if (this.recentResults.length > PERFORMANCE_LOOKBACK * 2) {
        this.recentResults = this.recentResults.slice(-PERFORMANCE_LOOKBACK * 2)
      }

      this.emit('trade-closed', closedTrade)
      console.log(
        `[TradeTracker] Trade closed: ${trade.symbol} ${finalResult} (${exitReason}) P&L: ${pnlPercent.toFixed(2)}%`
      )
    } catch (err) {
      console.error(`[TradeTracker] Failed to close trade for ${trade.symbol}:`, (err as Error).message)
    }
  }
}
