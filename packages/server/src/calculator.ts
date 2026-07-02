import { SMA, EMA, MACD, StochasticRSI, RSI, BollingerBands, ATR, ADX, WilliamsR, CCI, MFI, OBV, PSAR } from 'technicalindicators'
import type { CandleData, IndicatorValues, UserSettings } from '@bottrade/shared'
import { analyzeSmartMoney } from './smartMoney.js'

/**
 * Detect divergence between price and MACD over the last 5 candles.
 * Bullish divergence: price makes lower low but MACD makes higher low.
 * Bearish divergence: price makes higher high but MACD makes lower high.
 */
function detectDivergence(
  closes: number[],
  macdValues: number[]
): 'bullish' | 'bearish' | null {
  if (closes.length < 5 || macdValues.length < 5) return null

  const recentCloses = closes.slice(-5)
  const recentMacd = macdValues.slice(-5)

  // Find swing lows (troughs): local minima
  const priceLows: { index: number; value: number }[] = []
  const macdLows: { index: number; value: number }[] = []
  // Find swing highs (peaks): local maxima
  const priceHighs: { index: number; value: number }[] = []
  const macdHighs: { index: number; value: number }[] = []

  for (let i = 1; i < recentCloses.length - 1; i++) {
    // Troughs
    if (recentCloses[i] <= recentCloses[i - 1] && recentCloses[i] <= recentCloses[i + 1]) {
      priceLows.push({ index: i, value: recentCloses[i] })
      macdLows.push({ index: i, value: recentMacd[i] })
    }
    // Peaks
    if (recentCloses[i] >= recentCloses[i - 1] && recentCloses[i] >= recentCloses[i + 1]) {
      priceHighs.push({ index: i, value: recentCloses[i] })
      macdHighs.push({ index: i, value: recentMacd[i] })
    }
  }

  // Also consider first and last elements as potential swing points
  // Check endpoints for lows
  if (recentCloses[0] <= recentCloses[1]) {
    priceLows.unshift({ index: 0, value: recentCloses[0] })
    macdLows.unshift({ index: 0, value: recentMacd[0] })
  }
  if (recentCloses[4] <= recentCloses[3]) {
    priceLows.push({ index: 4, value: recentCloses[4] })
    macdLows.push({ index: 4, value: recentMacd[4] })
  }
  // Check endpoints for highs
  if (recentCloses[0] >= recentCloses[1]) {
    priceHighs.unshift({ index: 0, value: recentCloses[0] })
    macdHighs.unshift({ index: 0, value: recentMacd[0] })
  }
  if (recentCloses[4] >= recentCloses[3]) {
    priceHighs.push({ index: 4, value: recentCloses[4] })
    macdHighs.push({ index: 4, value: recentMacd[4] })
  }

  // Bullish divergence: need at least 2 swing lows
  if (priceLows.length >= 2 && macdLows.length >= 2) {
    const lastPriceLow = priceLows[priceLows.length - 1]
    const prevPriceLow = priceLows[priceLows.length - 2]
    const lastMacdLow = macdLows[macdLows.length - 1]
    const prevMacdLow = macdLows[macdLows.length - 2]

    // Price makes lower low but MACD makes higher low
    if (lastPriceLow.value < prevPriceLow.value && lastMacdLow.value > prevMacdLow.value) {
      return 'bullish'
    }
  }

  // Bearish divergence: need at least 2 swing highs
  if (priceHighs.length >= 2 && macdHighs.length >= 2) {
    const lastPriceHigh = priceHighs[priceHighs.length - 1]
    const prevPriceHigh = priceHighs[priceHighs.length - 2]
    const lastMacdHigh = macdHighs[macdHighs.length - 1]
    const prevMacdHigh = macdHighs[macdHighs.length - 2]

    // Price makes higher high but MACD makes lower high
    if (lastPriceHigh.value > prevPriceHigh.value && lastMacdHigh.value < prevMacdHigh.value) {
      return 'bearish'
    }
  }

  return null
}

export function calculateIndicators(
  candles: CandleData[],
  prevIndicators?: IndicatorValues | null,
  periods?: UserSettings['indicatorPeriods']
): IndicatorValues {
  const p = periods || {}
  const closes = candles.map(c => c.close)
  const highs = candles.map(c => c.high)
  const lows = candles.map(c => c.low)
  const volumes = candles.map(c => c.volume)
  const lastCandle = candles[candles.length - 1]
  const currentClose = lastCandle.close

  // --- Moving Averages ---
  const sma20 = SMA.calculate({ period: 20, values: closes })
  const sma50 = SMA.calculate({ period: 50, values: closes })
  const sma100 = SMA.calculate({ period: 100, values: closes })
  const sma200 = SMA.calculate({ period: 200, values: closes })

  const ema20 = EMA.calculate({ period: 20, values: closes })
  const ema50 = EMA.calculate({ period: 50, values: closes })

  // --- MACD ---
  const macdResult = MACD.calculate({
    values: closes,
    fastPeriod: p.macdFast ?? 12,
    slowPeriod: p.macdSlow ?? 26,
    signalPeriod: p.macdSignal ?? 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  })

  const lastMacd = macdResult.length > 0
    ? macdResult[macdResult.length - 1]
    : { MACD: 0, signal: 0, histogram: 0 }

  const macdVal = lastMacd.MACD ?? 0
  const signalVal = lastMacd.signal ?? 0
  const histogramVal = lastMacd.histogram ?? 0

  // Determine trend from histogram direction
  let macdTrend: 'bullish' | 'bearish' | 'neutral' = 'neutral'
  if (macdResult.length >= 2) {
    const prevHistogram = macdResult[macdResult.length - 2].histogram ?? 0
    if (histogramVal > prevHistogram) {
      macdTrend = 'bullish'
    } else if (histogramVal < prevHistogram) {
      macdTrend = 'bearish'
    }
  }

  // Divergence detection using MACD values aligned with closes
  const macdValues = macdResult
    .map(m => m.MACD)
    .filter((v): v is number => v !== undefined)
  const divergence = detectDivergence(closes, macdValues)

  // --- Stochastic RSI ---
  const stochResult = StochasticRSI.calculate({
    values: closes,
    rsiPeriod: p.stochRsiPeriod ?? 14,
    stochasticPeriod: p.stochRsiPeriod ?? 14,
    kPeriod: p.stochRsiK ?? 3,
    dPeriod: p.stochRsiD ?? 3,
  })

  const lastStoch = stochResult.length > 0
    ? stochResult[stochResult.length - 1]
    : { k: 50, d: 50 }

  // Clamp K/D to [0, 100] — floating point can produce tiny negatives
  const kVal = Math.max(0, Math.min(100, lastStoch.k))
  const dVal = Math.max(0, Math.min(100, lastStoch.d))

  // Zone
  let zone: 'overbought' | 'oversold' | 'neutral' = 'neutral'
  if (kVal > 80) zone = 'overbought'
  else if (kVal < 20) zone = 'oversold'

  // Persistent counters from previous state
  const prevOverboughtCount = prevIndicators?.stochRsi?.persistentOverbought
    ? 3  // was already persistent, carry at least 3
    : 0
  const prevOversoldCount = prevIndicators?.stochRsi?.persistentOversold
    ? 3
    : 0

  // We track consecutive candles via a simple approach:
  // Since we only have a boolean in the interface, we infer the counter from prev state
  let overboughtCounter: number
  let oversoldCounter: number

  // For overbought: K >= 90
  if (kVal >= 90) {
    // If previously persistent, counter was >= 3, increment
    // If not, we check if prev was also in overbought zone to estimate
    if (prevIndicators?.stochRsi?.persistentOverbought) {
      overboughtCounter = prevOverboughtCount + 1
    } else if (prevIndicators?.stochRsi && prevIndicators.stochRsi.k >= 90) {
      // Previous K was also >= 90, so counter is at least 2
      overboughtCounter = 2
    } else {
      overboughtCounter = 1
    }
  } else {
    overboughtCounter = 0
  }

  // For oversold: K <= 10
  if (kVal <= 10) {
    if (prevIndicators?.stochRsi?.persistentOversold) {
      oversoldCounter = prevOversoldCount + 1
    } else if (prevIndicators?.stochRsi && prevIndicators.stochRsi.k <= 10) {
      oversoldCounter = 2
    } else {
      oversoldCounter = 1
    }
  } else {
    oversoldCounter = 0
  }

  const persistentOverbought = overboughtCounter >= 3
  const persistentOversold = oversoldCounter >= 3

  // --- Volume ---
  const volumeSma20 = SMA.calculate({ period: 20, values: volumes })
  const currentVolume = lastCandle.volume
  const averageVolume = volumeSma20.length > 0
    ? volumeSma20[volumeSma20.length - 1]
    : currentVolume
  const isSpike = currentVolume > averageVolume * 2
  const candleDirection: 'green' | 'red' = lastCandle.close >= lastCandle.open ? 'green' : 'red'

  // --- RSI ---
  const rsiValues = RSI.calculate({ values: closes, period: p.rsiPeriod ?? 14 })
  const rsiValue = rsiValues.length > 0 ? rsiValues[rsiValues.length - 1] : 50
  const rsiZone = rsiValue >= 70 ? 'overbought' : rsiValue <= 30 ? 'oversold' : 'neutral'

  let rsiDivergence: 'bullish' | 'bearish' | null = null
  if (rsiValues.length >= 10) {
    const recentRsi = rsiValues.slice(-10)
    const recentCloses = closes.slice(-10)
    const lastHigh = Math.max(...recentCloses.slice(-5))
    const prevHigh = Math.max(...recentCloses.slice(0, 5))
    const lastRsiHigh = Math.max(...recentRsi.slice(-5))
    const prevRsiHigh = Math.max(...recentRsi.slice(0, 5))
    if (lastHigh > prevHigh && lastRsiHigh < prevRsiHigh) rsiDivergence = 'bearish'
    const lastLow = Math.min(...recentCloses.slice(-5))
    const prevLow = Math.min(...recentCloses.slice(0, 5))
    const lastRsiLow = Math.min(...recentRsi.slice(-5))
    const prevRsiLow = Math.min(...recentRsi.slice(0, 5))
    if (lastLow < prevLow && lastRsiLow > prevRsiLow) rsiDivergence = 'bullish'
  }

  // --- Bollinger Bands ---
  const bbValues = BollingerBands.calculate({ values: closes, period: p.bollingerPeriod ?? 20, stdDev: p.bollingerStdDev ?? 2 })

  // --- ATR ---
  const atrValues = ATR.calculate({ high: highs, low: lows, close: closes, period: p.atrPeriod ?? 14 })

  // --- ADX ---
  const adxValues = ADX.calculate({ high: highs, low: lows, close: closes, period: p.adxPeriod ?? 14 })

  // --- VWAP ---
  const vwapPeriod = Math.min(candles.length, 96)
  const vwapCandles = candles.slice(-vwapPeriod)
  let cumPV = 0
  let cumVol = 0
  for (const c of vwapCandles) {
    const typicalPrice = (c.high + c.low + c.close) / 3
    cumPV += typicalPrice * c.volume
    cumVol += c.volume
  }
  const vwapValue = cumVol > 0 ? cumPV / cumVol : currentClose

  // --- Build result ---
  const result: IndicatorValues = {
    ma20: sma20.length > 0 ? sma20[sma20.length - 1] : closes[closes.length - 1],
    ma50: sma50.length > 0 ? sma50[sma50.length - 1] : closes[closes.length - 1],
    ma100: sma100.length > 0 ? sma100[sma100.length - 1] : closes[closes.length - 1],
    ma200: sma200.length > 0 ? sma200[sma200.length - 1] : closes[closes.length - 1],
    ema20: ema20.length > 0 ? ema20[ema20.length - 1] : closes[closes.length - 1],
    ema50: ema50.length > 0 ? ema50[ema50.length - 1] : closes[closes.length - 1],
    macd: {
      macd: macdVal,
      signal: signalVal,
      histogram: histogramVal,
      trend: macdTrend,
      divergence,
    },
    stochRsi: {
      k: kVal,
      d: dVal,
      zone,
      persistentOverbought,
      persistentOversold,
    },
    volume: {
      current: currentVolume,
      average: averageVolume,
      isSpike,
      candleDirection,
    },
  }

  // --- Attach optional indicators ---
  result.rsi = { value: rsiValue, zone: rsiZone, divergence: rsiDivergence }

  if (bbValues.length > 0) {
    const bb = bbValues[bbValues.length - 1]
    const width = (bb.upper - bb.lower) / bb.middle
    const bandwidth = bb.upper - bb.lower
    const percentB = bandwidth > 0 ? (currentClose - bb.lower) / bandwidth : 0.5
    const recentWidths = bbValues.slice(-20).map(b => (b.upper - b.lower) / b.middle)
    const avgWidth = recentWidths.reduce((s, w) => s + w, 0) / recentWidths.length
    const squeeze = width < avgWidth * 0.75
    result.bollingerBands = { upper: bb.upper, middle: bb.middle, lower: bb.lower, width, percentB, squeeze }
  }

  if (atrValues.length > 0) {
    const atrValue = atrValues[atrValues.length - 1]
    const atrPercent = (atrValue / currentClose) * 100
    result.atr = { value: atrValue, percent: atrPercent }
  }

  if (adxValues.length > 0) {
    const adx = adxValues[adxValues.length - 1]
    result.adx = { value: adx.adx, plusDI: adx.pdi, minusDI: adx.mdi, trending: adx.adx >= 25 }
  }

  result.vwap = { value: vwapValue, priceAbove: currentClose > vwapValue }

  // Williams %R
  const wrValues = WilliamsR.calculate({ high: highs, low: lows, close: closes, period: p.williamsRPeriod ?? 14 })
  if (wrValues.length > 0) {
    const wr = wrValues[wrValues.length - 1]
    result.williamsR = {
      value: wr,
      zone: wr < -80 ? 'oversold' : wr > -20 ? 'overbought' : 'neutral'
    }
  }

  // CCI
  const cciValues = CCI.calculate({ high: highs, low: lows, close: closes, period: p.cciPeriod ?? 20 })
  if (cciValues.length > 0) {
    const cci = cciValues[cciValues.length - 1]
    result.cci = {
      value: cci,
      zone: cci > 100 ? 'overbought' : cci < -100 ? 'oversold' : 'neutral'
    }
  }

  // MFI
  const mfiValues = MFI.calculate({ high: highs, low: lows, close: closes, volume: volumes, period: p.mfiPeriod ?? 14 })
  if (mfiValues.length > 0) {
    const mfi = mfiValues[mfiValues.length - 1]
    result.mfi = {
      value: mfi,
      zone: mfi > 80 ? 'overbought' : mfi < 20 ? 'oversold' : 'neutral'
    }
  }

  // OBV
  const obvValues = OBV.calculate({ close: closes, volume: volumes })
  if (obvValues.length > 1) {
    const obv = obvValues[obvValues.length - 1]
    const prevObv = obvValues[obvValues.length - 2]
    result.obv = {
      value: obv,
      trend: obv > prevObv ? 'rising' : obv < prevObv ? 'falling' : 'flat'
    }
  }

  // Parabolic SAR
  const psarValues = PSAR.calculate({ high: highs, low: lows, step: 0.02, max: 0.2 })
  if (psarValues.length > 0) {
    const psar = psarValues[psarValues.length - 1]
    result.parabolicSar = {
      value: psar,
      trend: currentClose > psar ? 'bullish' : 'bearish'
    }
  }

  // Smart Money analysis
  result.smartMoney = analyzeSmartMoney(candles)

  return result
}
