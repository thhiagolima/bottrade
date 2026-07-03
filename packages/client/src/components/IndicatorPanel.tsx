import { useState } from 'react'
import type { ReactNode } from 'react'
import type { IndicatorToggles, IndicatorValues } from '@bottrade/shared'
import { useStore } from '../store/useStore'
import { formatPrice, formatVolume } from '../utils/format'

const defaultToggles: IndicatorToggles = {
  ma: true, ema: true, macd: true, stochRsi: true, volume: true,
  rsi: true, bollingerBands: true, atr: true, adx: true, vwap: true,
  williamsR: true, cci: true, mfi: true, obv: true, parabolicSar: true,
  openInterest: true, longShortRatio: true, fearGreed: true,
}

function getMacdTrendText(trend: string, histogram: number): string {
  if (trend === 'bullish') return histogram > 0 ? 'Momentum bullish crescendo' : 'Momentum bullish enfraquecendo'
  if (trend === 'bearish') return histogram < 0 ? 'Momentum bearish crescendo' : 'Momentum bearish enfraquecendo'
  return 'Momentum neutro'
}

function getZoneLabel(zone: 'overbought' | 'oversold' | 'neutral'): string {
  if (zone === 'overbought') return 'SOBRECOMPRA'
  if (zone === 'oversold') return 'SOBREVENDA'
  return 'NEUTRO'
}

function getZoneClass(zone: 'overbought' | 'oversold' | 'neutral'): string {
  if (zone === 'overbought') return 'text-bear bg-bear/10 border-bear/20'
  if (zone === 'oversold') return 'text-bull bg-bull/10 border-bull/20'
  return 'text-warn bg-warn/10 border-warn/20'
}

function DirectionIcon({ ok }: { ok: boolean }) {
  return ok ? (
    <svg className="h-3.5 w-3.5 text-bull" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ) : (
    <svg className="h-3.5 w-3.5 text-bear" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-card-border/80 bg-bg/25 p-3">
      <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">{title}</h4>
      {children}
    </section>
  )
}

function MetricCard({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string
  value: string
  detail?: string
  tone?: 'bull' | 'bear' | 'warn' | 'neutral'
}) {
  const toneClass =
    tone === 'bull' ? 'text-bull' :
    tone === 'bear' ? 'text-bear' :
    tone === 'warn' ? 'text-warn' : 'text-white'

  return (
    <div className="rounded-md border border-card-border/70 bg-card/55 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-dim">{label}</div>
      <div className={`mt-1 break-words font-mono-num text-sm font-bold ${toneClass}`}>{value}</div>
      {detail && <div className="mt-1 text-[11px] leading-snug text-muted">{detail}</div>}
    </div>
  )
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

  const filteredMaRows = maRows.filter((row) => row.group === 'ma' ? toggles.ma : toggles.ema)
  const { macd, stochRsi, volume, rsi, bollingerBands, atr, adx, vwap } = indicators

  return (
    <div className="border-t border-card-border" data-tour="indicator-panel">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3 py-3 text-xs font-bold text-muted transition-colors hover:text-white"
      >
        <span>INDICADORES</span>
        <span>{expanded ? '\u25B2' : '\u25BC'}</span>
      </button>

      {expanded && (
        <div className="space-y-3 px-3 pb-3 text-xs">
          {filteredMaRows.length > 0 && (
            <Section title="Medias moveis">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {filteredMaRows.map((row) => {
                  const above = price >= row.value
                  return (
                    <div key={row.name} className="rounded-md border border-card-border/70 bg-card/60 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-muted">{row.name}</span>
                        <DirectionIcon ok={above} />
                      </div>
                      <div className="mt-2 truncate font-mono-num text-sm font-bold text-white" title={formatPrice(row.value)}>
                        {formatPrice(row.value)}
                      </div>
                      <div className={`mt-1 text-[10px] font-bold ${above ? 'text-bull' : 'text-bear'}`}>
                        {above ? 'Preco acima' : 'Preco abaixo'}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Section>
          )}

          <div className="grid gap-3 lg:grid-cols-2">
            {toggles.macd && (
              <Section title="MACD">
                <div className="grid gap-2 sm:grid-cols-2">
                  <MetricCard
                    label="Histograma"
                    value={macd.histogram.toFixed(4)}
                    tone={macd.histogram >= 0 ? 'bull' : 'bear'}
                    detail={getMacdTrendText(macd.trend, macd.histogram)}
                  />
                  <MetricCard
                    label="Divergencia"
                    value={macd.divergence ? `DIV ${macd.divergence.toUpperCase()}` : 'Sem divergencia'}
                    tone={macd.divergence === 'bullish' ? 'bull' : macd.divergence === 'bearish' ? 'bear' : 'neutral'}
                    detail={`MACD ${macd.macd.toFixed(4)} / Signal ${macd.signal.toFixed(4)}`}
                  />
                </div>
              </Section>
            )}

            {toggles.stochRsi && (
              <Section title="StochRSI">
                <div className="grid gap-2 sm:grid-cols-3">
                  <MetricCard label="K" value={stochRsi.k.toFixed(2)} />
                  <MetricCard label="D" value={stochRsi.d.toFixed(2)} />
                  <div className={`rounded-md border px-3 py-2 ${getZoneClass(stochRsi.zone)}`}>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.06em] opacity-75">Zona</div>
                    <div className="mt-1 text-sm font-bold">{getZoneLabel(stochRsi.zone)}</div>
                    {(stochRsi.persistentOverbought || stochRsi.persistentOversold) && (
                      <div className="mt-1 text-[10px] font-bold">PERSISTENTE</div>
                    )}
                  </div>
                </div>
              </Section>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {toggles.rsi && rsi && (
              <MetricCard
                label="RSI"
                value={rsi.value.toFixed(2)}
                tone={rsi.zone === 'oversold' ? 'bull' : rsi.zone === 'overbought' ? 'bear' : 'warn'}
                detail={`${getZoneLabel(rsi.zone)}${rsi.divergence ? ` - DIV ${rsi.divergence.toUpperCase()}` : ''}`}
              />
            )}

            {toggles.bollingerBands && bollingerBands && (
              <MetricCard
                label="Bollinger Bands"
                value={`${bollingerBands.percentB.toFixed(2)} %B`}
                tone={bollingerBands.squeeze ? 'warn' : 'neutral'}
                detail={`Sup ${formatPrice(bollingerBands.upper)} / Inf ${formatPrice(bollingerBands.lower)} / Larg ${bollingerBands.width.toFixed(1)}%${bollingerBands.squeeze ? ' / SQUEEZE' : ''}`}
              />
            )}

            {toggles.atr && atr && (
              <MetricCard label="ATR" value={atr.value.toFixed(2)} detail={`${atr.percent.toFixed(2)}% de variacao media`} />
            )}

            {toggles.adx && adx && (
              <MetricCard
                label="ADX"
                value={adx.value.toFixed(1)}
                tone={adx.trending ? 'bull' : 'neutral'}
                detail={`+DI ${adx.plusDI.toFixed(1)} / -DI ${adx.minusDI.toFixed(1)}${adx.trending ? ' / Tendencia' : ' / Lateral'}`}
              />
            )}

            {toggles.vwap && vwap && (
              <MetricCard
                label="VWAP"
                value={formatPrice(vwap.value)}
                tone={vwap.priceAbove ? 'bull' : 'bear'}
                detail={vwap.priceAbove ? 'Preco acima da VWAP' : 'Preco abaixo da VWAP'}
              />
            )}

            {toggles.williamsR !== false && indicators.williamsR && (
              <MetricCard
                label="Williams %R"
                value={indicators.williamsR.value.toFixed(2)}
                tone={indicators.williamsR.zone === 'oversold' ? 'bull' : indicators.williamsR.zone === 'overbought' ? 'bear' : 'warn'}
                detail={getZoneLabel(indicators.williamsR.zone)}
              />
            )}

            {toggles.cci !== false && indicators.cci && (
              <MetricCard
                label="CCI"
                value={indicators.cci.value.toFixed(2)}
                tone={indicators.cci.zone === 'oversold' ? 'bull' : indicators.cci.zone === 'overbought' ? 'bear' : 'warn'}
                detail={getZoneLabel(indicators.cci.zone)}
              />
            )}

            {toggles.mfi !== false && indicators.mfi && (
              <MetricCard
                label="MFI"
                value={indicators.mfi.value.toFixed(2)}
                tone={indicators.mfi.zone === 'oversold' ? 'bull' : indicators.mfi.zone === 'overbought' ? 'bear' : 'warn'}
                detail={getZoneLabel(indicators.mfi.zone)}
              />
            )}

            {toggles.obv !== false && indicators.obv && (
              <MetricCard
                label="OBV"
                value={formatVolume(indicators.obv.value)}
                tone={indicators.obv.trend === 'rising' ? 'bull' : indicators.obv.trend === 'falling' ? 'bear' : 'warn'}
                detail={indicators.obv.trend === 'rising' ? 'Crescente' : indicators.obv.trend === 'falling' ? 'Decrescente' : 'Lateral'}
              />
            )}

            {toggles.parabolicSar !== false && indicators.parabolicSar && (
              <MetricCard
                label="Parabolic SAR"
                value={formatPrice(indicators.parabolicSar.value)}
                tone={indicators.parabolicSar.trend === 'bullish' ? 'bull' : 'bear'}
                detail={indicators.parabolicSar.trend === 'bullish' ? 'Bullish, preco acima do SAR' : 'Bearish, preco abaixo do SAR'}
              />
            )}

            {toggles.volume && (
              <MetricCard
                label="Volume"
                value={formatVolume(volume.current)}
                tone={volume.candleDirection === 'green' ? 'bull' : 'bear'}
                detail={`Media ${formatVolume(volume.average)}${volume.isSpike ? ' / SPIKE' : ''}`}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
