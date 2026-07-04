import type {
  CandleData,
  BacktestParams,
  BacktestResult,
  BacktestTrade,
  UserSettings,
  PriceData,
  IndicatorValues,
} from '@bottrade/shared'
import { calculateIndicators } from './calculator.js'
import { generateSignal } from './signals.js'
import { config } from './config.js'

interface OpenPosition {
  symbol: string
  direction: 'LONG' | 'SHORT'
  entryPrice: number
  stopLoss: number
  takeProfit: number
  score: number
  entryTime: number
}

export function runBacktest(
  candlesMap: Map<string, CandleData[]>,
  params: BacktestParams,
): BacktestResult {
  const trades: BacktestTrade[] = []
  const equityCurve: { timestamp: number; equity: number }[] = []
  const baseCapital = params.baseCapital ?? 100
  const leverage = params.leverage ?? 1
  const scoreThreshold = params.scoreThreshold ?? 85
  let equity = baseCapital

  // Build settings for signal generation
  const settings: UserSettings = {
    userMode: 'pro',
    baseCapital,
    leverage,
    fundingThreshold: 0.05,
    stochRsiHighThreshold: 90,
    stochRsiLowThreshold: 10,
    soundAlerts: false,
    desktopNotifications: false,
    pairs: params.symbols,
    favorites: params.symbols,
  }

  // Process each symbol
  for (const symbol of params.symbols) {
    const allCandles = candlesMap.get(symbol)
    if (!allCandles || allCandles.length < config.candles.minForSignals) continue

    let currentPosition: OpenPosition | null = null
    let prevIndicators: IndicatorValues | undefined

    // We need at least minForSignals candles to start, then iterate candle by candle
    const startIdx = config.candles.minForSignals
    for (let i = startIdx; i < allCandles.length; i++) {
      const windowCandles = allCandles.slice(Math.max(0, i - config.candles.bufferSize), i + 1)
      const currentCandle = allCandles[i]

      // Check if open position hit TP or SL on this candle
      if (currentPosition) {
        const exitResult = checkCandleForExit(currentPosition, currentCandle)
        if (exitResult) {
          const pnlPercent = currentPosition.direction === 'LONG'
            ? ((exitResult.price - currentPosition.entryPrice) / currentPosition.entryPrice) * 100
            : ((currentPosition.entryPrice - exitResult.price) / currentPosition.entryPrice) * 100
          const pnlValue = (pnlPercent / 100) * baseCapital * leverage

          trades.push({
            symbol,
            direction: currentPosition.direction,
            entryPrice: currentPosition.entryPrice,
            exitPrice: exitResult.price,
            stopLoss: currentPosition.stopLoss,
            takeProfit: currentPosition.takeProfit,
            result: exitResult.result,
            pnlPercent,
            pnlValue,
            score: currentPosition.score,
            entryTime: currentPosition.entryTime,
            exitTime: currentCandle.timestamp,
          })

          equity += pnlValue
          equityCurve.push({ timestamp: currentCandle.timestamp, equity })
          currentPosition = null
        }
      }

      // Calculate indicators for this candle
      const indicators = calculateIndicators(windowCandles, prevIndicators)

      // Build mock PriceData
      const priceData: PriceData = {
        symbol,
        price: currentCandle.close,
        markPrice: currentCandle.close,
        change24h: 0,
        volume24h: currentCandle.volume,
        fundingRate: 0, // No funding data in historical candles
        fundingCountdown: '00:00:00',
      }

      // Generate signal
      const signal = generateSignal(indicators, priceData, settings)

      // Open position if high confidence and no position open
      if (
        !currentPosition &&
        signal.confidence === 'high' &&
        signal.direction !== 'NEUTRO' &&
        isSignalAboveThreshold(signal.direction, signal.confluenceScore, scoreThreshold) &&
        signal.riskManagement
      ) {
        currentPosition = {
          symbol,
          direction: signal.direction,
          entryPrice: currentCandle.close,
          stopLoss: signal.riskManagement.stopLoss,
          takeProfit: signal.riskManagement.takeProfit,
          score: signal.confluenceScore,
          entryTime: currentCandle.timestamp,
        }
      }

      prevIndicators = indicators
    }

    // Close any remaining open position at last candle price
    if (currentPosition) {
      const lastCandle = allCandles[allCandles.length - 1]
      const pnlPercent = currentPosition.direction === 'LONG'
        ? ((lastCandle.close - currentPosition.entryPrice) / currentPosition.entryPrice) * 100
        : ((currentPosition.entryPrice - lastCandle.close) / currentPosition.entryPrice) * 100
      const pnlValue = (pnlPercent / 100) * baseCapital * leverage

      trades.push({
        symbol,
        direction: currentPosition.direction,
        entryPrice: currentPosition.entryPrice,
        exitPrice: lastCandle.close,
        stopLoss: currentPosition.stopLoss,
        takeProfit: currentPosition.takeProfit,
        result: pnlPercent >= 0 ? 'WIN' : 'LOSS',
        pnlPercent,
        pnlValue,
        score: currentPosition.score,
        entryTime: currentPosition.entryTime,
        exitTime: lastCandle.timestamp,
      })
      equity += pnlValue
      equityCurve.push({ timestamp: lastCandle.timestamp, equity })
    }
  }

  // Sort trades by entry time
  trades.sort((a, b) => a.entryTime - b.entryTime)

  // Calculate stats
  const stats = calculateStats(trades, baseCapital)

  // Per-symbol breakdown
  const perSymbol: Record<string, { trades: number; winRate: number; pnl: number }> = {}
  for (const symbol of params.symbols) {
    const symbolTrades = trades.filter(t => t.symbol === symbol)
    const symbolWins = symbolTrades.filter(t => t.result === 'WIN').length
    perSymbol[symbol] = {
      trades: symbolTrades.length,
      winRate: symbolTrades.length > 0 ? (symbolWins / symbolTrades.length) * 100 : 0,
      pnl: symbolTrades.reduce((sum, t) => sum + t.pnlPercent, 0),
    }
  }

  // Build cumulative equity curve if not already populated per-trade
  if (equityCurve.length === 0) {
    equityCurve.push({ timestamp: Date.now(), equity: params.baseCapital })
  }

  return {
    params,
    trades,
    stats,
    equityCurve,
    perSymbol,
  }
}

function isSignalAboveThreshold(direction: 'LONG' | 'SHORT', score: number, threshold: number): boolean {
  return direction === 'LONG' ? score >= threshold : score <= 100 - threshold
}

function checkCandleForExit(
  position: OpenPosition,
  candle: CandleData,
): { price: number; result: 'WIN' | 'LOSS' } | null {
  if (position.direction === 'LONG') {
    // Check SL first (worst case)
    if (candle.low <= position.stopLoss) {
      return { price: position.stopLoss, result: 'LOSS' }
    }
    // Check TP
    if (candle.high >= position.takeProfit) {
      return { price: position.takeProfit, result: 'WIN' }
    }
  } else {
    // SHORT
    // Check SL first
    if (candle.high >= position.stopLoss) {
      return { price: position.stopLoss, result: 'LOSS' }
    }
    // Check TP
    if (candle.low <= position.takeProfit) {
      return { price: position.takeProfit, result: 'WIN' }
    }
  }
  return null
}

function calculateStats(trades: BacktestTrade[], baseCapital: number) {
  const wins = trades.filter(t => t.result === 'WIN')
  const losses = trades.filter(t => t.result === 'LOSS')

  const totalPnlPercent = trades.reduce((sum, t) => sum + t.pnlPercent, 0)
  const totalPnlValue = trades.reduce((sum, t) => sum + t.pnlValue, 0)

  const avgWinPnl = wins.length > 0 ? wins.reduce((s, t) => s + t.pnlPercent, 0) / wins.length : 0
  const avgLossPnl = losses.length > 0 ? losses.reduce((s, t) => s + t.pnlPercent, 0) / losses.length : 0

  const grossProfit = wins.reduce((s, t) => s + t.pnlValue, 0)
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnlValue, 0))
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0

  // Max drawdown
  let peak = baseCapital
  let maxDrawdown = 0
  let equity = baseCapital
  for (const trade of trades) {
    equity += trade.pnlValue
    if (equity > peak) peak = equity
    const drawdown = ((peak - equity) / peak) * 100
    if (drawdown > maxDrawdown) maxDrawdown = drawdown
  }

  // Sharpe ratio (simplified: mean return / std dev of returns)
  const returns = trades.map(t => t.pnlPercent)
  const meanReturn = returns.length > 0 ? returns.reduce((s, r) => s + r, 0) / returns.length : 0
  const variance = returns.length > 1
    ? returns.reduce((s, r) => s + Math.pow(r - meanReturn, 2), 0) / (returns.length - 1)
    : 0
  const stdDev = Math.sqrt(variance)
  const sharpeRatio = stdDev > 0 ? meanReturn / stdDev : 0

  return {
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: trades.length > 0 ? (wins.length / trades.length) * 100 : 0,
    totalPnlPercent,
    totalPnlValue,
    avgWinPnl,
    avgLossPnl,
    bestTrade: trades.length > 0 ? Math.max(...trades.map(t => t.pnlPercent)) : 0,
    worstTrade: trades.length > 0 ? Math.min(...trades.map(t => t.pnlPercent)) : 0,
    maxDrawdown,
    profitFactor,
    sharpeRatio,
  }
}
