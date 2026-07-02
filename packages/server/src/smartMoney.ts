import type { CandleData, FVG, OrderBlock, StructureBreak, CandlePattern, SRZone, SmartMoneyData } from '@bottrade/shared'

// --- FVG Detection ---
export function detectFVGs(candles: CandleData[], lookback = 50): FVG[] {
  const fvgs: FVG[] = []
  const recent = candles.slice(-lookback)

  for (let i = 2; i < recent.length; i++) {
    const c1 = recent[i - 2]
    const c2 = recent[i - 1] // middle candle (the gap)
    const c3 = recent[i]

    // Bullish FVG: candle1 high < candle3 low (gap up)
    if (c1.high < c3.low) {
      const gap: FVG = { type: 'bullish', top: c3.low, bottom: c1.high, timestamp: c2.timestamp, filled: false }
      // Check if filled by subsequent candles
      for (let j = i + 1; j < recent.length; j++) {
        if (recent[j].low <= gap.bottom) { gap.filled = true; break }
      }
      if (!gap.filled) fvgs.push(gap)
    }

    // Bearish FVG: candle1 low > candle3 high (gap down)
    if (c1.low > c3.high) {
      const gap: FVG = { type: 'bearish', top: c1.low, bottom: c3.high, timestamp: c2.timestamp, filled: false }
      for (let j = i + 1; j < recent.length; j++) {
        if (recent[j].high >= gap.top) { gap.filled = true; break }
      }
      if (!gap.filled) fvgs.push(gap)
    }
  }

  return fvgs.slice(-5) // keep last 5 unfilled
}

// --- Swing Points ---
function findSwingPoints(candles: CandleData[], leftBars = 3, rightBars = 3): { highs: { price: number; index: number; timestamp: number }[]; lows: { price: number; index: number; timestamp: number }[] } {
  const highs: { price: number; index: number; timestamp: number }[] = []
  const lows: { price: number; index: number; timestamp: number }[] = []

  for (let i = leftBars; i < candles.length - rightBars; i++) {
    let isSwingHigh = true
    let isSwingLow = true

    for (let j = i - leftBars; j <= i + rightBars; j++) {
      if (j === i) continue
      if (candles[j].high >= candles[i].high) isSwingHigh = false
      if (candles[j].low <= candles[i].low) isSwingLow = false
    }

    if (isSwingHigh) highs.push({ price: candles[i].high, index: i, timestamp: candles[i].timestamp })
    if (isSwingLow) lows.push({ price: candles[i].low, index: i, timestamp: candles[i].timestamp })
  }

  return { highs, lows }
}

// --- Break of Structure / Change of Character ---
export function detectStructureBreaks(candles: CandleData[], lookback = 100): { breaks: StructureBreak[]; trend: 'bullish' | 'bearish' | 'ranging' } {
  const recent = candles.slice(-lookback)
  const { highs, lows } = findSwingPoints(recent)
  const breaks: StructureBreak[] = []

  // Track trend via higher highs/higher lows or lower highs/lower lows
  let lastTrend: 'bullish' | 'bearish' | 'ranging' = 'ranging'

  if (highs.length >= 2 && lows.length >= 2) {
    const lastHH = highs[highs.length - 1].price > highs[highs.length - 2].price
    const lastHL = lows[lows.length - 1].price > lows[lows.length - 2].price
    const lastLH = highs[highs.length - 1].price < highs[highs.length - 2].price
    const lastLL = lows[lows.length - 1].price < lows[lows.length - 2].price

    if (lastHH && lastHL) lastTrend = 'bullish'
    else if (lastLH && lastLL) lastTrend = 'bearish'
  }

  // Detect BOS and CHoCH from recent candles
  const currentPrice = recent[recent.length - 1].close

  for (let i = 1; i < highs.length; i++) {
    // Bullish BOS: price broke above previous swing high in uptrend
    if (currentPrice > highs[i].price && i === highs.length - 1) {
      const type = lastTrend === 'bullish' ? 'BOS' : 'CHoCH'
      breaks.push({ type, direction: 'bullish', level: highs[i].price, timestamp: highs[i].timestamp })
    }
  }

  for (let i = 1; i < lows.length; i++) {
    // Bearish BOS: price broke below previous swing low in downtrend
    if (currentPrice < lows[i].price && i === lows.length - 1) {
      const type = lastTrend === 'bearish' ? 'BOS' : 'CHoCH'
      breaks.push({ type, direction: 'bearish', level: lows[i].price, timestamp: lows[i].timestamp })
    }
  }

  return { breaks: breaks.slice(-3), trend: lastTrend }
}

// --- Order Blocks ---
export function detectOrderBlocks(candles: CandleData[], lookback = 50): OrderBlock[] {
  const recent = candles.slice(-lookback)
  const blocks: OrderBlock[] = []
  const currentPrice = recent[recent.length - 1].close

  for (let i = 1; i < recent.length - 3; i++) {
    const c = recent[i]
    const isBearishCandle = c.close < c.open
    const isBullishCandle = c.close > c.open

    // Bullish OB: last bearish candle before strong bullish move
    if (isBearishCandle) {
      const moveAfter = (recent[i + 1].close - c.close) / c.close * 100
      const moveAfter2 = (recent[i + 2].close - c.close) / c.close * 100
      if (moveAfter > 0.3 && moveAfter2 > 0.5) {
        const strength = moveAfter2 > 1.5 ? 3 : moveAfter2 > 0.8 ? 2 : 1
        // Only keep if price hasn't gone below the OB yet (still valid)
        if (currentPrice >= c.low) {
          blocks.push({ type: 'bullish', high: c.high, low: c.low, timestamp: c.timestamp, strength })
        }
      }
    }

    // Bearish OB: last bullish candle before strong bearish move
    if (isBullishCandle) {
      const moveAfter = (c.close - recent[i + 1].close) / c.close * 100
      const moveAfter2 = (c.close - recent[i + 2].close) / c.close * 100
      if (moveAfter > 0.3 && moveAfter2 > 0.5) {
        const strength = moveAfter2 > 1.5 ? 3 : moveAfter2 > 0.8 ? 2 : 1
        if (currentPrice <= c.high) {
          blocks.push({ type: 'bearish', high: c.high, low: c.low, timestamp: c.timestamp, strength })
        }
      }
    }
  }

  return blocks.slice(-5)
}

// --- Candle Patterns ---
export function detectCandlePatterns(candles: CandleData[]): CandlePattern[] {
  const patterns: CandlePattern[] = []
  const len = candles.length
  if (len < 3) return patterns

  const c = candles[len - 1] // current
  const p = candles[len - 2] // previous
  const pp = candles[len - 3] // 2 ago

  const bodyC = Math.abs(c.close - c.open)
  const bodyP = Math.abs(p.close - p.open)
  const rangeC = c.high - c.low

  // Doji: body < 10% of range
  if (rangeC > 0 && bodyC / rangeC < 0.1) {
    patterns.push({ name: 'Doji', type: 'neutral', significance: 'moderate', timestamp: c.timestamp })
  }

  // Hammer: small body at top, long lower wick (>2x body)
  const lowerWickC = Math.min(c.open, c.close) - c.low
  const upperWickC = c.high - Math.max(c.open, c.close)
  if (lowerWickC > bodyC * 2 && upperWickC < bodyC * 0.5 && bodyC > 0) {
    patterns.push({ name: 'Hammer', type: 'bullish', significance: 'strong', timestamp: c.timestamp })
  }

  // Shooting Star: small body at bottom, long upper wick (>2x body)
  if (upperWickC > bodyC * 2 && lowerWickC < bodyC * 0.5 && bodyC > 0) {
    patterns.push({ name: 'Shooting Star', type: 'bearish', significance: 'strong', timestamp: c.timestamp })
  }

  // Pin Bar (bullish): long lower wick > 2/3 of total range, body in upper 1/3
  if (rangeC > 0 && lowerWickC / rangeC > 0.66) {
    patterns.push({ name: 'Pin Bar Bullish', type: 'bullish', significance: 'strong', timestamp: c.timestamp })
  }
  // Pin Bar (bearish): long upper wick > 2/3 of total range
  if (rangeC > 0 && upperWickC / rangeC > 0.66) {
    patterns.push({ name: 'Pin Bar Bearish', type: 'bearish', significance: 'strong', timestamp: c.timestamp })
  }

  // Bullish Engulfing: previous bearish, current bullish, current body engulfs previous
  if (p.close < p.open && c.close > c.open && c.close > p.open && c.open < p.close) {
    patterns.push({ name: 'Bullish Engulfing', type: 'bullish', significance: 'strong', timestamp: c.timestamp })
  }

  // Bearish Engulfing
  if (p.close > p.open && c.close < c.open && c.open > p.close && c.close < p.open) {
    patterns.push({ name: 'Bearish Engulfing', type: 'bearish', significance: 'strong', timestamp: c.timestamp })
  }

  // Morning Star: bearish candle, small body (doji-like), bullish candle
  if (pp.close < pp.open && bodyP < bodyC * 0.3 && c.close > c.open && c.close > (pp.open + pp.close) / 2) {
    patterns.push({ name: 'Morning Star', type: 'bullish', significance: 'strong', timestamp: c.timestamp })
  }

  // Evening Star
  if (pp.close > pp.open && bodyP < bodyC * 0.3 && c.close < c.open && c.close < (pp.open + pp.close) / 2) {
    patterns.push({ name: 'Evening Star', type: 'bearish', significance: 'strong', timestamp: c.timestamp })
  }

  return patterns.slice(-3)
}

// --- Support/Resistance Zones ---
export function detectSRZones(candles: CandleData[], lookback = 100): SRZone[] {
  const recent = candles.slice(-lookback)
  const { highs, lows } = findSwingPoints(recent, 2, 2)
  const currentPrice = recent[recent.length - 1].close
  const tolerance = currentPrice * 0.003 // 0.3% tolerance for "same level"

  // Cluster swing points into zones
  const levels: { price: number; type: 'support' | 'resistance'; touches: number }[] = []

  const allPoints = [
    ...highs.map(h => ({ price: h.price, type: 'resistance' as const })),
    ...lows.map(l => ({ price: l.price, type: 'support' as const })),
  ]

  for (const point of allPoints) {
    const existing = levels.find(l => Math.abs(l.price - point.price) < tolerance)
    if (existing) {
      existing.touches++
      existing.price = (existing.price + point.price) / 2 // average
    } else {
      levels.push({ price: point.price, type: point.type, touches: 1 })
    }
  }

  return levels
    .filter(l => l.touches >= 2) // at least 2 touches
    .map(l => ({
      level: l.price,
      type: l.type,
      touches: l.touches,
      strength: l.touches >= 4 ? 'strong' as const : l.touches >= 3 ? 'moderate' as const : 'weak' as const,
    }))
    .sort((a, b) => Math.abs(a.level - currentPrice) - Math.abs(b.level - currentPrice))
    .slice(0, 5)
}

// --- Liquidity Sweep Detection ---
export function detectLiquiditySweep(candles: CandleData[], lookback = 30): { detected: boolean; direction: 'bullish' | 'bearish' | null; level: number | null } {
  const recent = candles.slice(-lookback)
  const last = recent[recent.length - 1]
  const { highs, lows } = findSwingPoints(recent, 2, 2)

  // Bullish sweep: price dipped below swing low then closed above it
  for (let i = lows.length - 1; i >= Math.max(0, lows.length - 3); i--) {
    if (last.low < lows[i].price && last.close > lows[i].price) {
      return { detected: true, direction: 'bullish', level: lows[i].price }
    }
  }

  // Bearish sweep: price spiked above swing high then closed below it
  for (let i = highs.length - 1; i >= Math.max(0, highs.length - 3); i--) {
    if (last.high > highs[i].price && last.close < highs[i].price) {
      return { detected: true, direction: 'bearish', level: highs[i].price }
    }
  }

  return { detected: false, direction: null, level: null }
}

// --- Main function ---
export function analyzeSmartMoney(candles: CandleData[]): SmartMoneyData {
  if (candles.length < 30) {
    return {
      fvgs: [], orderBlocks: [], structureBreaks: [],
      candlePatterns: [], srZones: [],
      liquiditySweep: { detected: false, direction: null, level: null },
      trend: 'ranging',
    }
  }

  const fvgs = detectFVGs(candles)
  const orderBlocks = detectOrderBlocks(candles)
  const { breaks, trend } = detectStructureBreaks(candles)
  const candlePatterns = detectCandlePatterns(candles)
  const srZones = detectSRZones(candles)
  const liquiditySweep = detectLiquiditySweep(candles)

  return { fvgs, orderBlocks, structureBreaks: breaks, candlePatterns, srZones, liquiditySweep, trend }
}
