import type { BasicPairData, HeatScore } from '@bottrade/shared'

export function calculateHeatScore(pair: BasicPairData, volumePercentile: number): HeatScore {
  const reasons: string[] = []

  // Momentum score (0-35)
  const absChange = Math.abs(pair.change24h)
  let momentum = 0
  if (absChange >= 10) { momentum = 35; reasons.push(`${pair.change24h > 0 ? 'Alta' : 'Queda'} de ${pair.change24h.toFixed(1)}% — movimento extremo`) }
  else if (absChange >= 5) { momentum = 28; reasons.push(`${pair.change24h > 0 ? 'Alta' : 'Queda'} de ${pair.change24h.toFixed(1)}% — momentum forte`) }
  else if (absChange >= 3) { momentum = 18; reasons.push(`Variação ${pair.change24h > 0 ? '+' : ''}${pair.change24h.toFixed(1)}%`) }
  else if (absChange >= 1.5) { momentum = 10 }
  else { momentum = 3 }

  // Funding pressure score (0-35)
  const fundingPercent = pair.fundingRate * 100
  const absFunding = Math.abs(fundingPercent)
  let fundingPressure = 0
  if (absFunding >= 0.1) { fundingPressure = 35; reasons.push(`Funding ${fundingPercent.toFixed(4)}% — EXTREMO`) }
  else if (absFunding >= 0.05) { fundingPressure = 25; reasons.push(`Funding ${fundingPercent.toFixed(4)}% — pressão ${fundingPercent > 0 ? 'de longs' : 'de shorts'}`) }
  else if (absFunding >= 0.03) { fundingPressure = 15; reasons.push(`Funding ${fundingPercent.toFixed(4)}%`) }
  else { fundingPressure = 5 }

  // Bonus: momentum + funding aligned (both suggest same direction = stronger signal)
  if (absChange >= 3 && absFunding >= 0.03) {
    const momentumBullish = pair.change24h > 0
    const fundingBearishPressure = fundingPercent > 0 // longs paying = crowded long
    if (momentumBullish && fundingBearishPressure) {
      reasons.push('Longs crowded + alta forte — risco de correção')
    } else if (!momentumBullish && !fundingBearishPressure) {
      reasons.push('Shorts crowded + queda forte — possível squeeze')
    }
  }

  // Volume rank score (0-30)
  // volumePercentile is 0-1 where 1 = highest volume
  const volumeRank = Math.round(volumePercentile * 30)
  if (volumePercentile >= 0.9) { reasons.push('Volume no top 10%') }
  else if (volumePercentile >= 0.8) { reasons.push('Volume alto') }

  const score = Math.min(100, momentum + fundingPressure + volumeRank)

  let label: 'QUENTE' | 'MORNO' | 'FRIO'
  if (score >= 60) label = 'QUENTE'
  else if (score >= 35) label = 'MORNO'
  else label = 'FRIO'

  return { score, label, reasons, momentum, fundingPressure, volumeRank }
}

export function calculateAllHeatScores(pairs: Map<string, BasicPairData>): Map<string, HeatScore> {
  // Calculate volume percentiles
  const entries = Array.from(pairs.entries()).filter(([, p]) => p.price > 0 && p.volume24h > 0)
  const sortedByVolume = entries.map(([s, p]) => ({ symbol: s, volume: p.volume24h })).sort((a, b) => a.volume - b.volume)
  const volumePercentiles = new Map<string, number>()
  for (let i = 0; i < sortedByVolume.length; i++) {
    volumePercentiles.set(sortedByVolume[i].symbol, i / Math.max(1, sortedByVolume.length - 1))
  }

  const result = new Map<string, HeatScore>()
  for (const [symbol, pair] of pairs) {
    if (pair.price <= 0) continue
    const percentile = volumePercentiles.get(symbol) ?? 0.5
    result.set(symbol, calculateHeatScore(pair, percentile))
  }
  return result
}
