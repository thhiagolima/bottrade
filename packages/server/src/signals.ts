import type {
  IndicatorValues,
  PriceData,
  UserSettings,
  SignalData,
  Alert,
  RiskManagement,
} from '@bottrade/shared'

// ---------------------------------------------------------------------------
// Sub-score functions
// ---------------------------------------------------------------------------

/** Structure score (0-25): how many MAs/EMAs are below price */
export function calcStructureScore(price: PriceData, indicators: IndicatorValues): number {
  const mas = [
    indicators.ma20,
    indicators.ma50,
    indicators.ma100,
    indicators.ma200,
    indicators.ema20,
    indicators.ema50,
  ]
  const above = mas.filter(ma => price.price > ma).length
  const map: Record<number, number> = { 6: 25, 5: 20, 4: 16, 3: 12, 2: 8, 1: 4, 0: 0 }
  return map[above] ?? 0
}

/** MACD score (0-20): histogram momentum */
export function calcMacdScore(indicators: IndicatorValues): number {
  const { histogram, trend } = indicators.macd

  if (histogram > 0 && trend === 'bullish') return 20
  if (histogram > 0 && trend !== 'bullish') return 14
  if (Math.abs(histogram) < 0.0001) return 10
  if (histogram < 0 && trend === 'bullish') return 6 // shrinking (going back toward zero)
  // histogram < 0 && trend bearish/neutral
  return 0
}

/** StochRSI score (0-20): K/D crossover and momentum */
export function calcStochRsiScore(indicators: IndicatorValues): number {
  const { k, d, zone } = indicators.stochRsi
  const diff = k - d

  // K crossed above D + neutral zone
  if (diff > 0 && zone === 'neutral') return 20
  // K > D + rising
  if (k > d) return 16
  // K approximately equal to D (within 5)
  if (Math.abs(diff) <= 5) return 10
  // K < D + falling
  if (k < d && zone !== 'neutral') return 4
  // K crossed below D + neutral zone
  if (k < d && zone === 'neutral') return 0

  return 10 // fallback
}

/** Volume score (0-15): volume spike and candle direction */
export function calcVolumeScore(indicators: IndicatorValues): number {
  const { isSpike, candleDirection } = indicators.volume

  if (isSpike && candleDirection === 'green') return 15
  if (!isSpike && candleDirection === 'green') return 10
  if (!isSpike && candleDirection === 'red') return 5
  if (isSpike && candleDirection === 'red') return 0

  return 7.5 // normal volume, no clear direction
}

/** Funding score (0-15): funding rate analysis */
export function calcFundingScore(price: PriceData): number {
  const rate = price.fundingRate

  // Rates from Binance are in decimal: 0.0001 = 0.01%
  // -0.05% = -0.0005, +0.03% = 0.0003, +0.05% = 0.0005
  if (rate < -0.0005) return 15
  if (rate >= -0.0005 && rate <= 0) return 12
  if (rate > 0 && rate <= 0.0003) return 7.5
  if (rate > 0.0003 && rate <= 0.0005) return 4
  return 0 // > +0.05%
}

/** EMA alignment score (0-5): EMA20 vs EMA50 relationship */
export function calcEmaAlignmentScore(indicators: IndicatorValues): number {
  const { ema20, ema50 } = indicators
  const gap = ema20 - ema50
  // Use MACD trend as proxy for distance direction
  const { trend } = indicators.macd

  const approximately = Math.abs(gap) / Math.max(ema20, ema50, 1) < 0.001

  if (approximately) return 2.5

  if (ema20 > ema50) {
    // distance growing = trend bullish (pulling away)
    if (trend === 'bullish') return 5
    return 3 // distance shrinking
  }

  // ema20 < ema50
  if (trend === 'bearish') return 0 // distance growing (more negative)
  return 2 // distance shrinking (converging)
}

// ---------------------------------------------------------------------------
// Risk Management
// ---------------------------------------------------------------------------

function calcRiskManagement(
  direction: 'LONG' | 'SHORT' | 'NEUTRO',
  score: number,
  price: PriceData,
  indicators: IndicatorValues,
  settings: UserSettings,
): RiskManagement | null {
  if (direction === 'NEUTRO') return null

  const entry = price.price
  const rc: import('@bottrade/shared').RiskConfig = settings.riskConfig ?? {
    slMode: 'auto',
    slFixedPercent: 1.5,
    atrMultiplier: 2.0,
    tpMode: 'rr',
    tpFixedPercent: 3.0,
    rrRatio: 2.0,
    useSmartMoneySR: true,
    minSlPercent: 0.5,
    maxSlPercent: 5.0,
  }

  // ── STOP LOSS ──────────────────────────────────────────
  let stopLossPrice: number

  if (rc.slMode === 'fixed') {
    // Fixed percentage from entry
    const pct = rc.slFixedPercent / 100
    stopLossPrice = direction === 'LONG'
      ? entry * (1 - pct)
      : entry * (1 + pct)

  } else if (rc.slMode === 'atr') {
    // ATR-only mode
    if (indicators.atr && indicators.atr.value > 0) {
      const atrDist = indicators.atr.value * rc.atrMultiplier
      stopLossPrice = direction === 'LONG' ? entry - atrDist : entry + atrDist
    } else {
      // Fallback to fixed if ATR unavailable
      const pct = rc.slFixedPercent / 100
      stopLossPrice = direction === 'LONG' ? entry * (1 - pct) : entry * (1 + pct)
    }

  } else {
    // Auto mode: ATR + MA + S/R (best of all)
    const mas = [indicators.ma20, indicators.ma50, indicators.ma100, indicators.ma200, indicators.ema20, indicators.ema50]

    if (indicators.atr && indicators.atr.value > 0) {
      // Start with ATR-based
      const atrDist = indicators.atr.value * rc.atrMultiplier
      stopLossPrice = direction === 'LONG' ? entry - atrDist : entry + atrDist
    } else if (direction === 'LONG') {
      // Nearest MA below
      const masBelow = mas.filter(m => m > 0 && m < entry).sort((a, b) => b - a)
      stopLossPrice = masBelow.length > 0 ? masBelow[0] * 0.998 : entry * (1 - rc.slFixedPercent / 100)
    } else {
      const masAbove = mas.filter(m => m > 0 && m > entry).sort((a, b) => a - b)
      stopLossPrice = masAbove.length > 0 ? masAbove[0] * 1.002 : entry * (1 + rc.slFixedPercent / 100)
    }

    // Improve with S/R zones if enabled
    if (rc.useSmartMoneySR && indicators.smartMoney?.srZones) {
      const zones = indicators.smartMoney.srZones
      if (direction === 'LONG') {
        const support = zones.filter(z => z.type === 'support' && z.level < entry && z.level > stopLossPrice && z.strength !== 'weak')
        if (support.length > 0) {
          const betterSL = support[0].level * 0.998
          if (betterSL > stopLossPrice) stopLossPrice = betterSL
        }
      } else {
        const resistance = zones.filter(z => z.type === 'resistance' && z.level > entry && z.level < stopLossPrice && z.strength !== 'weak')
        if (resistance.length > 0) {
          const betterSL = resistance[0].level * 1.002
          if (betterSL < stopLossPrice) stopLossPrice = betterSL
        }
      }
    }
  }

  // Enforce min/max SL distance
  const slDistance = Math.abs(entry - stopLossPrice)
  const slPercent = slDistance / entry
  if (slPercent < rc.minSlPercent / 100) {
    stopLossPrice = direction === 'LONG'
      ? entry * (1 - rc.minSlPercent / 100)
      : entry * (1 + rc.minSlPercent / 100)
  }
  if (slPercent > rc.maxSlPercent / 100) {
    stopLossPrice = direction === 'LONG'
      ? entry * (1 - rc.maxSlPercent / 100)
      : entry * (1 + rc.maxSlPercent / 100)
  }

  // ── TAKE PROFIT ────────────────────────────────────────
  const finalSlDistance = Math.abs(entry - stopLossPrice)
  let takeProfitPrice: number

  if (rc.tpMode === 'fixed') {
    const pct = rc.tpFixedPercent / 100
    takeProfitPrice = direction === 'LONG' ? entry * (1 + pct) : entry * (1 - pct)
  } else {
    // R:R ratio mode
    const ratio = rc.rrRatio
    takeProfitPrice = direction === 'LONG'
      ? entry + finalSlDistance * ratio
      : entry - finalSlDistance * ratio
  }

  // Improve TP with S/R zones (use as target if closer than calculated TP and still profitable)
  if (rc.useSmartMoneySR && indicators.smartMoney?.srZones) {
    const zones = indicators.smartMoney.srZones
    if (direction === 'LONG') {
      const resistance = zones.filter(z => z.type === 'resistance' && z.level > entry && z.level < takeProfitPrice && z.strength !== 'weak')
      // If there's strong resistance before our TP, consider it as TP (only if R:R still > 1)
      if (resistance.length > 0) {
        const srTP = resistance[resistance.length - 1].level * 0.998
        const srRR = (srTP - entry) / finalSlDistance
        if (srRR >= 1.5) takeProfitPrice = srTP // Use S/R as TP if R:R >= 1.5
      }
    } else {
      const support = zones.filter(z => z.type === 'support' && z.level < entry && z.level > takeProfitPrice && z.strength !== 'weak')
      if (support.length > 0) {
        const srTP = support[0].level * 1.002
        const srRR = (entry - srTP) / finalSlDistance
        if (srRR >= 1.5) takeProfitPrice = srTP
      }
    }
  }

  const stopLossPercent = (Math.abs(entry - stopLossPrice) / entry) * 100
  const takeProfitPercent = (Math.abs(takeProfitPrice - entry) / entry) * 100
  const riskRewardRatio = takeProfitPercent / stopLossPercent
  const positionSize = settings.baseCapital * settings.leverage
  const margin = positionSize / settings.leverage

  return {
    entry,
    stopLoss: stopLossPrice,
    takeProfit: takeProfitPrice,
    stopLossPercent,
    takeProfitPercent,
    positionSize,
    margin,
    riskRewardRatio,
    leverage: settings.leverage,
  }
}

// ---------------------------------------------------------------------------
// Helpers: count MAs above/below
// ---------------------------------------------------------------------------

function countMasAbovePrice(price: PriceData, indicators: IndicatorValues): number {
  const mas = [
    indicators.ma20, indicators.ma50, indicators.ma100, indicators.ma200,
    indicators.ema20, indicators.ema50,
  ]
  return mas.filter(ma => price.price > ma).length
}

// ---------------------------------------------------------------------------
// Action Points
// ---------------------------------------------------------------------------

function buildActionPoints(indicators: IndicatorValues, price: PriceData): string[] {
  const points: string[] = []
  const masAbove = countMasAbovePrice(price, indicators)

  if (masAbove === 6) {
    points.push('Preco acima de todas as medias — estrutura bullish')
  } else if (masAbove === 0) {
    points.push('Preco abaixo de todas as medias — estrutura bearish')
  } else if (masAbove >= 4) {
    points.push(`Preco acima de ${masAbove}/6 medias — tendencia de alta`)
  } else if (masAbove <= 2) {
    points.push(`Preco acima de apenas ${masAbove}/6 medias — tendencia de baixa`)
  }

  // MACD
  const { histogram, trend } = indicators.macd
  if (histogram > 0 && trend === 'bullish') {
    points.push('MACD com momentum crescente')
  } else if (histogram > 0) {
    points.push('MACD positivo mas perdendo forca')
  } else if (histogram < 0 && trend === 'bullish') {
    points.push('MACD negativo mas se recuperando')
  } else if (histogram < 0) {
    points.push('MACD com momentum decrescente')
  }

  if (indicators.macd.divergence === 'bullish') {
    points.push('Divergencia bullish no MACD detectada')
  } else if (indicators.macd.divergence === 'bearish') {
    points.push('Divergencia bearish no MACD detectada')
  }

  // StochRSI
  const { k, zone, persistentOverbought, persistentOversold } = indicators.stochRsi
  if (zone === 'overbought') {
    points.push('StochRSI em zona de sobrecompra — cautela')
  } else if (zone === 'oversold') {
    points.push('StochRSI em zona de sobrevenda — possivel reversao')
  }
  if (persistentOverbought) {
    points.push('StochRSI sobrecomprado por 3+ candles — exaustao provavel')
  }
  if (persistentOversold) {
    points.push('StochRSI sobrevendido por 3+ candles — bounce provavel')
  }

  // Volume
  if (indicators.volume.isSpike && indicators.volume.candleDirection === 'green') {
    points.push('Volume spike confirmando direcao de alta')
  } else if (indicators.volume.isSpike && indicators.volume.candleDirection === 'red') {
    points.push('Volume spike confirmando direcao de baixa')
  }

  // Funding
  if (price.fundingRate < -0.001) {
    points.push('Funding extremamente negativo — shorts pagando longs')
  } else if (price.fundingRate > 0.001) {
    points.push('Funding extremamente positivo — longs pagando shorts')
  }

  // EMA alignment
  if (indicators.ema20 > indicators.ema50) {
    points.push('EMA20 acima da EMA50 — alinhamento bullish')
  } else if (indicators.ema20 < indicators.ema50) {
    points.push('EMA20 abaixo da EMA50 — alinhamento bearish')
  }

  // New indicators
  if (indicators.rsi) {
    if (indicators.rsi.zone === 'overbought') points.push(`RSI em ${indicators.rsi.value.toFixed(0)} — sobrecompra`)
    else if (indicators.rsi.zone === 'oversold') points.push(`RSI em ${indicators.rsi.value.toFixed(0)} — sobrevenda`)
    if (indicators.rsi.divergence === 'bullish') points.push('Divergencia bullish no RSI')
    else if (indicators.rsi.divergence === 'bearish') points.push('Divergencia bearish no RSI')
  }

  if (indicators.bollingerBands) {
    if (indicators.bollingerBands.squeeze) points.push('Bollinger Bands em squeeze — breakout iminente')
    if (indicators.bollingerBands.percentB < 0.05) points.push('Preco na banda inferior — possivel bounce')
    else if (indicators.bollingerBands.percentB > 0.95) points.push('Preco na banda superior — possivel rejeicao')
  }

  if (indicators.adx) {
    if (indicators.adx.trending) points.push(`ADX ${indicators.adx.value.toFixed(0)} — mercado em tendencia`)
    else points.push(`ADX ${indicators.adx.value.toFixed(0)} — mercado lateral, cautela`)
  }

  if (indicators.vwap) {
    if (indicators.vwap.priceAbove) points.push('Preco acima do VWAP — pressao compradora')
    else points.push('Preco abaixo do VWAP — pressao vendedora')
  }

  if (indicators.atr) {
    if (indicators.atr.percent > 3) points.push(`ATR ${indicators.atr.percent.toFixed(1)}% — volatilidade alta`)
  }

  return points
}

// ---------------------------------------------------------------------------
// Critical Decision Text
// ---------------------------------------------------------------------------

function buildCriticalDecision(
  direction: 'LONG' | 'SHORT' | 'NEUTRO',
  indicators: IndicatorValues,
  price: PriceData,
): string {
  if (direction === 'NEUTRO') {
    return 'Sem confluencia suficiente — aguardar'
  }

  const reasons: string[] = []
  const masAbove = countMasAbovePrice(price, indicators)

  if (direction === 'LONG') {
    if (masAbove >= 4) reasons.push('estrutura de medias favoravel')
    if (indicators.macd.histogram > 0) reasons.push('MACD positivo')
    if (indicators.stochRsi.k > indicators.stochRsi.d) reasons.push('StochRSI ascendente')
    if (indicators.volume.isSpike && indicators.volume.candleDirection === 'green') reasons.push('volume confirmando')
    if (price.fundingRate < 0) reasons.push('funding favoravel')
    if (indicators.ema20 > indicators.ema50) reasons.push('EMAs alinhadas')
    return `Estrutura favoravel para LONG — ${reasons.length > 0 ? reasons.join(', ') : 'confluencia de indicadores'}`
  }

  // SHORT
  if (masAbove <= 2) reasons.push('estrutura de medias favoravel')
  if (indicators.macd.histogram < 0) reasons.push('MACD negativo')
  if (indicators.stochRsi.k < indicators.stochRsi.d) reasons.push('StochRSI descendente')
  if (indicators.volume.isSpike && indicators.volume.candleDirection === 'red') reasons.push('volume confirmando')
  if (price.fundingRate > 0) reasons.push('funding favoravel')
  if (indicators.ema20 < indicators.ema50) reasons.push('EMAs alinhadas')
  return `Estrutura favoravel para SHORT — ${reasons.length > 0 ? reasons.join(', ') : 'confluencia de indicadores'}`
}

// ---------------------------------------------------------------------------
// Alert Detection
// ---------------------------------------------------------------------------

export function detectAlerts(
  signal: SignalData,
  prevSignal: SignalData | undefined,
  indicators: IndicatorValues,
  price: PriceData,
  settings: UserSettings,
): Alert[] {
  const alerts: Alert[] = []
  const now = Date.now()

  // Direction change
  if (prevSignal && prevSignal.direction !== signal.direction) {
    alerts.push({
      type: 'direction-change',
      symbol: price.symbol,
      message: `Direcao mudou de ${prevSignal.direction} para ${signal.direction}`,
      severity: 'warning',
      timestamp: now,
    })
  }

  // Funding exceeds threshold
  // settings.fundingThreshold is in percentage (e.g. 0.05 means 0.05%)
  const fundingThresholdDecimal = settings.fundingThreshold / 100
  if (Math.abs(price.fundingRate) > fundingThresholdDecimal) {
    alerts.push({
      type: 'funding-extreme',
      symbol: price.symbol,
      message: `Funding rate ${(price.fundingRate * 100).toFixed(4)}% excede threshold de ${settings.fundingThreshold}%`,
      severity: Math.abs(price.fundingRate) > 0.001 ? 'critical' : 'warning',
      timestamp: now,
    })
  }

  // StochRSI extreme zones
  if (indicators.stochRsi.k > settings.stochRsiHighThreshold) {
    alerts.push({
      type: 'stochrsi-extreme',
      symbol: price.symbol,
      message: `StochRSI K em ${indicators.stochRsi.k.toFixed(1)} — zona de sobrecompra`,
      severity: 'warning',
      timestamp: now,
    })
  }
  if (indicators.stochRsi.k < settings.stochRsiLowThreshold) {
    alerts.push({
      type: 'stochrsi-extreme',
      symbol: price.symbol,
      message: `StochRSI K em ${indicators.stochRsi.k.toFixed(1)} — zona de sobrevenda`,
      severity: 'warning',
      timestamp: now,
    })
  }

  // Full alignment (score > 80)
  if (signal.confluenceScore > 80) {
    alerts.push({
      type: 'full-alignment',
      symbol: price.symbol,
      message: `Alinhamento completo — score ${signal.confluenceScore.toFixed(1)}`,
      severity: 'info',
      timestamp: now,
    })
  }

  return alerts
}

// ---------------------------------------------------------------------------
// Main: generateSignal
// ---------------------------------------------------------------------------

export function generateSignal(
  indicators: IndicatorValues,
  price: PriceData,
  settings: UserSettings,
  prevSignal?: SignalData,
): SignalData {
  // 1. Calculate all sub-scores
  const structureScore = calcStructureScore(price, indicators)
  const macdScore = calcMacdScore(indicators)
  const stochRsiScore = calcStochRsiScore(indicators)
  const volumeScore = calcVolumeScore(indicators)
  const fundingScore = calcFundingScore(price)
  const emaAlignmentScore = calcEmaAlignmentScore(indicators)

  // Apply indicator toggles — skip disabled indicators
  const toggles: Partial<import('@bottrade/shared').IndicatorToggles> = settings.indicatorToggles || {}

  // Use custom weights if provided
  const scoreConfig = settings.scoreConfig || {}
  const weights = scoreConfig.weights || {}
  const structureMax = weights.structure ?? 25
  const macdMax = weights.macd ?? 20
  const stochRsiMax = weights.stochRsi ?? 20
  const volumeMax = weights.volume ?? 15
  const fundingMax = weights.funding ?? 15
  const emaAlignmentMax = weights.emaAlignment ?? 5

  interface ScoreComponent {
    name: string
    score: number
    maxScore: number
    enabled: boolean
  }

  const components: ScoreComponent[] = [
    { name: 'structure', score: structureScore * (structureMax / 25), maxScore: structureMax, enabled: toggles.ma !== false || toggles.ema !== false },
    { name: 'macd', score: macdScore * (macdMax / 20), maxScore: macdMax, enabled: toggles.macd !== false },
    { name: 'stochRsi', score: stochRsiScore * (stochRsiMax / 20), maxScore: stochRsiMax, enabled: toggles.stochRsi !== false },
    { name: 'volume', score: volumeScore * (volumeMax / 15), maxScore: volumeMax, enabled: toggles.volume !== false },
    { name: 'funding', score: fundingScore * (fundingMax / 15), maxScore: fundingMax, enabled: true }, // Always active (market data)
    { name: 'emaAlignment', score: emaAlignmentScore * (emaAlignmentMax / 5), maxScore: emaAlignmentMax, enabled: toggles.ema !== false },
  ]

  // Calculate weighted score based only on enabled components
  const enabledComponents = components.filter(c => c.enabled)
  const totalMaxEnabled = enabledComponents.reduce((sum, c) => sum + c.maxScore, 0)
  const totalScoreEnabled = enabledComponents.reduce((sum, c) => sum + c.score, 0)

  // Normalize to 0-100 scale
  let score = totalMaxEnabled > 0 ? (totalScoreEnabled / totalMaxEnabled) * 100 : 50

  // 1b. New indicator bonuses (optional, ±5 each)
  // RSI confirmation (only if RSI toggle is on)
  if (toggles.rsi !== false && indicators.rsi) {
    if (indicators.rsi.zone === 'oversold') score += 4 // bullish
    else if (indicators.rsi.zone === 'overbought') score -= 4 // bearish
    if (indicators.rsi.divergence === 'bullish') score += 5
    else if (indicators.rsi.divergence === 'bearish') score -= 5
  }

  // ADX trend strength (only if ADX toggle is on)
  if (toggles.adx !== false && indicators.adx) {
    if (!indicators.adx.trending) {
      // No trend = reduce confidence, pull score toward 50
      score = score + (50 - score) * 0.08
    }
    // DI crossover confirmation
    if (indicators.adx.plusDI > indicators.adx.minusDI) score += 2
    else if (indicators.adx.minusDI > indicators.adx.plusDI) score -= 2
  }

  // Bollinger Bands (only if BB toggle is on)
  if (toggles.bollingerBands !== false && indicators.bollingerBands) {
    // Price near lower band = bullish potential
    if (indicators.bollingerBands.percentB < 0.1) score += 3
    // Price near upper band = bearish potential
    else if (indicators.bollingerBands.percentB > 0.9) score -= 3
    // Squeeze = breakout coming, amplify existing signal
    if (indicators.bollingerBands.squeeze) {
      if (score > 55) score += 3
      else if (score < 45) score -= 3
    }
  }

  // VWAP (only if VWAP toggle is on)
  if (toggles.vwap !== false && indicators.vwap) {
    if (indicators.vwap.priceAbove) score += 2
    else score -= 2
  }

  // Smart Money scoring (if available)
  const smActionPoints: string[] = []
  if (indicators.smartMoney) {
    const sm = indicators.smartMoney

    // FVG near current price (+/- 3 points)
    const nearFVG = sm.fvgs.find(f => {
      const mid = (f.top + f.bottom) / 2
      return Math.abs(mid - price.price) / price.price < 0.01 // within 1%
    })
    if (nearFVG) {
      if (nearFVG.type === 'bullish') score += 3
      else score -= 3
      smActionPoints.push(`FVG ${nearFVG.type} proximo — preço pode reagir`)
    }

    // Order Block support (+/- 4 points)
    const nearOB = sm.orderBlocks.find(ob => {
      return Math.abs(price.price - (ob.type === 'bullish' ? ob.low : ob.high)) / price.price < 0.008
    })
    if (nearOB) {
      if (nearOB.type === 'bullish') { score += nearOB.strength * 1.5; smActionPoints.push(`Order Block bullish (força ${nearOB.strength}) — suporte Smart Money`) }
      else { score -= nearOB.strength * 1.5; smActionPoints.push(`Order Block bearish (força ${nearOB.strength}) — resistência Smart Money`) }
    }

    // BOS/CHoCH (+/- 8 points)
    if (sm.structureBreaks.length > 0) {
      const lastBreak = sm.structureBreaks[sm.structureBreaks.length - 1]
      if (lastBreak.type === 'CHoCH') {
        // Change of Character is a stronger signal
        if (lastBreak.direction === 'bullish') { score += 8; smActionPoints.push('CHoCH bullish — mudança de caráter para alta') }
        else { score -= 8; smActionPoints.push('CHoCH bearish — mudança de caráter para baixa') }
      } else {
        // BOS confirms existing trend
        if (lastBreak.direction === 'bullish') { score += 5; smActionPoints.push('BOS bullish — estrutura de alta confirmada') }
        else { score -= 5; smActionPoints.push('BOS bearish — estrutura de baixa confirmada') }
      }
    }

    // Candle patterns (+/- 5 points)
    for (const pattern of sm.candlePatterns) {
      const pts = pattern.significance === 'strong' ? 5 : pattern.significance === 'moderate' ? 3 : 1
      if (pattern.type === 'bullish') { score += pts; smActionPoints.push(`${pattern.name} — padrão bullish ${pattern.significance}`) }
      else if (pattern.type === 'bearish') { score -= pts; smActionPoints.push(`${pattern.name} — padrão bearish ${pattern.significance}`) }
    }

    // Liquidity sweep (+/- 6 points — strong reversal signal)
    if (sm.liquiditySweep.detected) {
      if (sm.liquiditySweep.direction === 'bullish') { score += 6; smActionPoints.push('Liquidity sweep bullish — stops varridos, reversão provável') }
      else { score -= 6; smActionPoints.push('Liquidity sweep bearish — stops varridos, reversão provável') }
    }

    // Smart Money trend alignment (+/- 3)
    if (sm.trend === 'bullish') { score += 3; smActionPoints.push('Estrutura Smart Money: tendência de alta') }
    else if (sm.trend === 'bearish') { score -= 3; smActionPoints.push('Estrutura Smart Money: tendência de baixa') }
  }

  // 2. Context multiplier
  const masAbove = countMasAbovePrice(price, indicators)
  if (masAbove >= 4 && score < 50) {
    score *= 0.7
  } else if (masAbove <= 2 && score > 50) {
    score *= 0.7
  }

  // 3. Divergence bonus
  if (indicators.macd.divergence === 'bullish') {
    score += 15
  } else if (indicators.macd.divergence === 'bearish') {
    score -= 15
  }

  // 4. Clamp [0, 100]
  score = Math.max(0, Math.min(100, score))

  // 5. Classify direction and confidence (configurable thresholds)
  const longThreshold = scoreConfig.longThreshold ?? 65
  const shortThreshold = scoreConfig.shortThreshold ?? 35
  const highConfLong = scoreConfig.highConfidenceLong ?? 85
  const highConfShort = scoreConfig.highConfidenceShort ?? 15

  let direction: 'LONG' | 'SHORT' | 'NEUTRO'
  let confidence: 'normal' | 'high'

  if (score >= highConfLong) {
    direction = 'LONG'
    confidence = 'high'
  } else if (score >= longThreshold) {
    direction = 'LONG'
    confidence = 'normal'
  } else if (score > shortThreshold) {
    direction = 'NEUTRO'
    confidence = 'normal'
  } else if (score > highConfShort) {
    direction = 'SHORT'
    confidence = 'normal'
  } else {
    direction = 'SHORT'
    confidence = 'high'
  }

  // 6. Overrides
  const overrides: string[] = []

  // Funding > +0.10% (0.001 decimal): block LONG
  if (price.fundingRate > 0.001) {
    overrides.push('Funding > +0.10% — LONG bloqueado')
    if (direction === 'LONG') {
      direction = 'NEUTRO'
      confidence = 'normal'
    }
  }

  // Funding < -0.10%: block SHORT
  if (price.fundingRate < -0.001) {
    overrides.push('Funding < -0.10% — SHORT bloqueado')
    if (direction === 'SHORT') {
      direction = 'NEUTRO'
      confidence = 'normal'
    }
  }

  // Funding < -0.20% (-0.002 decimal)
  if (price.fundingRate < -0.002) {
    overrides.push('FUNDING EXTREMO — nao operar short')
  }

  // StochRSI K and D = 100: block new LONG
  if (indicators.stochRsi.k === 100 && indicators.stochRsi.d === 100) {
    overrides.push('StochRSI K e D em 100 — sinal de saida')
    if (direction === 'LONG') {
      direction = 'NEUTRO'
      confidence = 'normal'
    }
  }

  // StochRSI K = 0: block new SHORT
  if (indicators.stochRsi.k === 0) {
    overrides.push('StochRSI K em 0 — bounce iminente')
    if (direction === 'SHORT') {
      direction = 'NEUTRO'
      confidence = 'normal'
    }
  }

  // Persistent overbought: reduce LONG confidence
  if (indicators.stochRsi.persistentOverbought && direction === 'LONG') {
    overrides.push('StochRSI sobrecomprado persistente — confianca reduzida')
    confidence = 'normal'
  }

  // Persistent oversold: reduce SHORT confidence
  if (indicators.stochRsi.persistentOversold && direction === 'SHORT') {
    overrides.push('StochRSI sobrevendido persistente — confianca reduzida')
    confidence = 'normal'
  }

  // Build output components
  const riskManagement = calcRiskManagement(direction, score, price, indicators, settings)
  const criticalDecision = buildCriticalDecision(direction, indicators, price)
  const actionPoints = buildActionPoints(indicators, price)
  actionPoints.push(...smActionPoints)

  // Build signal (alerts will be populated after)
  const signal: SignalData = {
    direction,
    confluenceScore: Math.round(score * 100) / 100,
    confidence,
    alerts: [],
    riskManagement,
    criticalDecision,
    actionPoints,
    overrides,
  }

  // Detect alerts
  signal.alerts = detectAlerts(signal, prevSignal, indicators, price, settings)

  return signal
}
