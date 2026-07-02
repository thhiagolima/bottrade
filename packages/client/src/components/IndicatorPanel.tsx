import { useState } from 'react'
import type { IndicatorValues, IndicatorToggles } from '@bottrade/shared'
import { useStore } from '../store/useStore'
import { formatPrice, formatVolume } from '../utils/format'

const defaultToggles: IndicatorToggles = {
  ma: true, ema: true, macd: true, stochRsi: true, volume: true,
  rsi: true, bollingerBands: true, atr: true, adx: true, vwap: true,
  williamsR: true, cci: true, mfi: true, obv: true, parabolicSar: true,
  openInterest: true, longShortRatio: true, fearGreed: true,
}

function getMacdTrendText(trend: string, histogram: number): string {
  if (trend === 'bullish') {
    return histogram > 0 ? 'Momentum bullish crescendo' : 'Momentum bullish enfraquecendo'
  }
  if (trend === 'bearish') {
    return histogram < 0 ? 'Momentum bearish crescendo' : 'Momentum bearish enfraquecendo'
  }
  return 'Momentum neutro'
}

export default function IndicatorPanel({ indicators, price }: { indicators: IndicatorValues; price: number }) {
  const [expanded, setExpanded] = useState(true)
  const toggles = useStore((s) => s.settings.indicatorToggles) ?? defaultToggles

  const maRows: { name: string; value: number; group: 'ma' | 'ema' }[] = [
    { name: 'MA20', value: indicators.ma20, group: 'ma' },
    { name: 'MA50', value: indicators.ma50, group: 'ma' },
    { name: 'MA100', value: indicators.ma100, group: 'ma' },
    { name: 'MA200', value: indicators.ma200, group: 'ma' },
    { name: 'EMA20', value: indicators.ema20, group: 'ema' },
    { name: 'EMA50', value: indicators.ema50, group: 'ema' },
  ]

  const filteredMaRows = maRows.filter((row) =>
    row.group === 'ma' ? toggles.ma : toggles.ema
  )

  const { macd } = indicators
  const { stochRsi, volume, rsi, bollingerBands, atr, adx, vwap } = indicators

  const zoneLabel =
    stochRsi.zone === 'overbought' ? 'SOBRECOMPRA' :
    stochRsi.zone === 'oversold' ? 'SOBREVENDA' : 'NEUTRO'

  const zoneColor =
    stochRsi.zone === 'overbought' ? 'text-bear' :
    stochRsi.zone === 'oversold' ? 'text-bull' : 'text-warn'

  return (
    <div className="border-t border-card-border" data-tour="indicator-panel">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-muted hover:text-white transition-colors"
      >
        <span>INDICADORES</span>
        <span>{expanded ? '\u25B2' : '\u25BC'}</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 text-xs">
          {/* Moving Averages */}
          {filteredMaRows.length > 0 && (
            <div>
              <h4 className="text-muted font-bold mb-1">Médias Móveis</h4>
              <table className="w-full">
                <tbody>
                  {filteredMaRows.map((row) => (
                    <tr key={row.name} className="border-b border-card-border/50">
                      <td className="py-0.5 text-muted">{row.name}</td>
                      <td className="py-0.5 font-mono-num text-right">
                        {formatPrice(row.value)}
                      </td>
                      <td className="py-0.5 text-right w-8">
                        {price >= row.value ? <svg className="w-3 h-3 text-bull inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> : <svg className="w-3 h-3 text-bear inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* MACD */}
          {toggles.macd && (
            <div>
              <h4 className="text-muted font-bold mb-1">MACD</h4>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-muted">Histograma:</span>
                  <span className={`font-mono-num font-bold ${macd.histogram >= 0 ? 'text-bull' : 'text-bear'}`}>
                    {macd.histogram.toFixed(4)}
                  </span>
                </div>
                <div className="text-muted">
                  {getMacdTrendText(macd.trend, macd.histogram)}
                </div>
                {macd.divergence && (
                  <span
                    className={`inline-block px-1.5 py-0.5 text-[10px] font-bold rounded ${
                      macd.divergence === 'bullish'
                        ? 'bg-bull/20 text-bull'
                        : 'bg-bear/20 text-bear'
                    }`}
                  >
                    DIV {macd.divergence === 'bullish' ? 'BULLISH' : 'BEARISH'}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* StochRSI */}
          {toggles.stochRsi && (
            <div>
              <h4 className="text-muted font-bold mb-1">StochRSI</h4>
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="text-muted">K: <span className="font-mono-num text-white">{stochRsi.k.toFixed(2)}</span></span>
                  <span className="text-muted">D: <span className="font-mono-num text-white">{stochRsi.d.toFixed(2)}</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-bold ${zoneColor}`}>{zoneLabel}</span>
                  {(stochRsi.persistentOverbought || stochRsi.persistentOversold) && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-warn/20 text-warn rounded">
                      PERSISTENTE
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* RSI */}
          {toggles.rsi && rsi && (
            <div>
              <h4 className="text-muted font-bold mb-1">RSI</h4>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-muted">Valor:</span>
                  <span className="font-mono-num font-bold text-white">{rsi.value.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-bold ${
                    rsi.zone === 'overbought' ? 'text-bear' :
                    rsi.zone === 'oversold' ? 'text-bull' : 'text-warn'
                  }`}>
                    {rsi.zone === 'overbought' ? 'SOBRECOMPRA' :
                     rsi.zone === 'oversold' ? 'SOBREVENDA' : 'NEUTRO'}
                  </span>
                  {rsi.divergence && (
                    <span
                      className={`inline-block px-1.5 py-0.5 text-[10px] font-bold rounded ${
                        rsi.divergence === 'bullish'
                          ? 'bg-bull/20 text-bull'
                          : 'bg-bear/20 text-bear'
                      }`}
                    >
                      DIV {rsi.divergence === 'bullish' ? 'BULLISH' : 'BEARISH'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Bollinger Bands */}
          {toggles.bollingerBands && bollingerBands && (
            <div>
              <h4 className="text-muted font-bold mb-1">Bollinger Bands</h4>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-muted">Superior:</span>
                  <span className="font-mono-num text-white">{formatPrice(bollingerBands.upper)}</span>
                  <span className="text-muted">|</span>
                  <span className="text-muted">Inferior:</span>
                  <span className="font-mono-num text-white">{formatPrice(bollingerBands.lower)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted">Largura:</span>
                  <span className="font-mono-num text-white">{bollingerBands.width.toFixed(1)}%</span>
                  <span className="text-muted">|</span>
                  <span className="text-muted">%B:</span>
                  <span className="font-mono-num text-white">{bollingerBands.percentB.toFixed(2)}</span>
                </div>
                {bollingerBands.squeeze && (
                  <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold bg-warn/20 text-warn rounded">
                    SQUEEZE
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ATR */}
          {toggles.atr && atr && (
            <div className="flex items-center gap-2">
              <span className="text-muted font-bold">ATR:</span>
              <span className="font-mono-num text-white">{atr.value.toFixed(2)}</span>
              <span className="font-mono-num text-muted">({atr.percent.toFixed(2)}%)</span>
            </div>
          )}

          {/* ADX */}
          {toggles.adx && adx && (
            <div>
              <h4 className="text-muted font-bold mb-1">ADX</h4>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-muted">ADX:</span>
                  <span className="font-mono-num font-bold text-white">{adx.value.toFixed(1)}</span>
                  {adx.trending && (
                    <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold bg-bull/20 text-bull rounded">
                      TENDÊNCIA
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted">+DI:</span>
                  <span className="font-mono-num text-white">{adx.plusDI.toFixed(1)}</span>
                  <span className="text-muted">|</span>
                  <span className="text-muted">-DI:</span>
                  <span className="font-mono-num text-white">{adx.minusDI.toFixed(1)}</span>
                </div>
              </div>
            </div>
          )}

          {/* VWAP */}
          {toggles.vwap && vwap && (
            <div className="flex items-center gap-2">
              <span className="text-muted font-bold">VWAP:</span>
              <span className="font-mono-num text-white">{formatPrice(vwap.value)}</span>
              <span className="flex items-center gap-1">{vwap.priceAbove ? <><svg className="w-3 h-3 text-bull inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> Acima</> : <><svg className="w-3 h-3 text-bear inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Abaixo</>}</span>
            </div>
          )}

          {/* Williams %R */}
          {toggles.williamsR !== false && indicators.williamsR && (
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-[var(--color-text)]">Williams %R</h4>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">Valor:</span>
                <span className={`text-xs font-mono-num font-bold ${
                  indicators.williamsR.zone === 'oversold' ? 'text-bull' :
                  indicators.williamsR.zone === 'overbought' ? 'text-bear' : 'text-warn'
                }`}>{indicators.williamsR.value.toFixed(2)}</span>
              </div>
              <div className={`text-xs font-bold ${
                indicators.williamsR.zone === 'oversold' ? 'text-bull' :
                indicators.williamsR.zone === 'overbought' ? 'text-bear' : 'text-warn'
              }`}>
                {indicators.williamsR.zone === 'oversold' ? 'SOBREVENDA' :
                 indicators.williamsR.zone === 'overbought' ? 'SOBRECOMPRA' : 'NEUTRO'}
              </div>
            </div>
          )}

          {/* CCI */}
          {toggles.cci !== false && indicators.cci && (
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-[var(--color-text)]">CCI</h4>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">Valor:</span>
                <span className={`text-xs font-mono-num font-bold ${
                  indicators.cci.zone === 'oversold' ? 'text-bull' :
                  indicators.cci.zone === 'overbought' ? 'text-bear' : 'text-warn'
                }`}>{indicators.cci.value.toFixed(2)}</span>
              </div>
              <div className={`text-xs font-bold ${
                indicators.cci.zone === 'oversold' ? 'text-bull' :
                indicators.cci.zone === 'overbought' ? 'text-bear' : 'text-warn'
              }`}>
                {indicators.cci.zone === 'oversold' ? 'SOBREVENDA' :
                 indicators.cci.zone === 'overbought' ? 'SOBRECOMPRA' : 'NEUTRO'}
              </div>
            </div>
          )}

          {/* MFI */}
          {toggles.mfi !== false && indicators.mfi && (
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-[var(--color-text)]">MFI</h4>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">Valor:</span>
                <span className={`text-xs font-mono-num font-bold ${
                  indicators.mfi.zone === 'oversold' ? 'text-bull' :
                  indicators.mfi.zone === 'overbought' ? 'text-bear' : 'text-warn'
                }`}>{indicators.mfi.value.toFixed(2)}</span>
              </div>
              <div className={`text-xs font-bold ${
                indicators.mfi.zone === 'oversold' ? 'text-bull' :
                indicators.mfi.zone === 'overbought' ? 'text-bear' : 'text-warn'
              }`}>
                {indicators.mfi.zone === 'oversold' ? 'SOBREVENDA' :
                 indicators.mfi.zone === 'overbought' ? 'SOBRECOMPRA' : 'NEUTRO'}
              </div>
            </div>
          )}

          {/* OBV */}
          {toggles.obv !== false && indicators.obv && (
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-[var(--color-text)]">OBV</h4>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">Valor:</span>
                <span className="text-xs font-mono-num font-bold text-white">{formatVolume(indicators.obv.value)}</span>
              </div>
              <div className={`text-xs font-bold ${
                indicators.obv.trend === 'rising' ? 'text-bull' :
                indicators.obv.trend === 'falling' ? 'text-bear' : 'text-warn'
              }`}>
                {indicators.obv.trend === 'rising' ? '\u2191 Crescente' :
                 indicators.obv.trend === 'falling' ? '\u2193 Decrescente' : '\u2192 Lateral'}
              </div>
            </div>
          )}

          {/* Parabolic SAR */}
          {toggles.parabolicSar !== false && indicators.parabolicSar && (
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-[var(--color-text)]">Parabolic SAR</h4>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">Valor:</span>
                <span className="text-xs font-mono-num font-bold text-white">{formatPrice(indicators.parabolicSar.value)}</span>
              </div>
              <div className={`text-xs font-bold ${
                indicators.parabolicSar.trend === 'bullish' ? 'text-bull' : 'text-bear'
              }`}>
                {indicators.parabolicSar.trend === 'bullish' ? 'Bullish (Preco acima do SAR)' : 'Bearish (Preco abaixo do SAR)'}
              </div>
            </div>
          )}

          {/* Volume */}
          {toggles.volume && (
            <div>
              <h4 className="text-muted font-bold mb-1">Volume</h4>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-muted">Atual:</span>
                  <span className="font-mono-num">{formatVolume(volume.current)}</span>
                  <span className="text-muted">Média:</span>
                  <span className="font-mono-num">{formatVolume(volume.average)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-block w-3 h-3 rounded-sm ${volume.candleDirection === 'green' ? 'bg-bull' : 'bg-bear'}`} />
                  {volume.isSpike && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-warn/20 text-warn rounded">
                      <svg className="w-3 h-3 text-warn inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> SPIKE
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Smart Money moved to PairDetail SmartMoneyPanel tab */}
        </div>
      )}
    </div>
  )
}
