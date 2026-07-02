// Pure functions shared between TradeTracker and PaperTradeTracker

export function calcPnl(direction: 'LONG' | 'SHORT', entryPrice: number, currentPrice: number): number {
  return direction === 'LONG'
    ? ((currentPrice - entryPrice) / entryPrice) * 100
    : ((entryPrice - currentPrice) / entryPrice) * 100
}

export function shouldTriggerPartialTp(
  trade: { direction: string; entryPrice: number; takeProfit: number; partialClosed?: boolean },
  currentPrice: number,
  partialTpRatio: number
): boolean {
  if (trade.partialClosed) return false
  const tpDistance = Math.abs(trade.takeProfit - trade.entryPrice)
  const partialTarget = trade.direction === 'LONG'
    ? trade.entryPrice + tpDistance * partialTpRatio
    : trade.entryPrice - tpDistance * partialTpRatio
  return trade.direction === 'LONG'
    ? currentPrice >= partialTarget
    : currentPrice <= partialTarget
}

export function calcTrailingStop(
  trade: { direction: string; entryPrice: number; currentStopLoss?: number },
  currentPrice: number,
  peakPnl: number
): number | null {
  // Returns new stop loss or null if no change
  const pnl = calcPnl(trade.direction as 'LONG' | 'SHORT', trade.entryPrice, currentPrice)
  if (pnl <= 0) return null
  const trailAmount = pnl * 0.5 // trail at 50% of profit
  const newSl = trade.direction === 'LONG'
    ? trade.entryPrice * (1 + trailAmount / 100)
    : trade.entryPrice * (1 - trailAmount / 100)
  const currentSl = trade.currentStopLoss ?? (trade.direction === 'LONG' ? 0 : Infinity)
  if (trade.direction === 'LONG' && newSl > currentSl) return newSl
  if (trade.direction === 'SHORT' && newSl < currentSl) return newSl
  return null
}

export function shouldExitOnScore(direction: string, confluenceScore: number): boolean {
  return (direction === 'LONG' && confluenceScore < 50) || (direction === 'SHORT' && confluenceScore > 50)
}

export function shouldExitOnTime(candleCount: number, pnlPercent: number, maxCandles: number, minPnl: number): boolean {
  return candleCount >= maxCandles && Math.abs(pnlPercent) < minPnl
}
