import { useState } from 'react'
import type { PairAnalysis, Trade, TradeRecommendation, OrderRequest, IndicatorToggles, IndicatorValues, SignalData, PriceData, SmartMoneyData } from '@bottrade/shared'
import { useStore } from '../store/useStore'
import { emitExecuteOrder } from '../hooks/useSocket'
import toast from 'react-hot-toast'
import PriceHeader from './PriceHeader'
import IndicatorPanel from './IndicatorPanel'
import RiskPanel from './RiskPanel'
import SignalPanel from './SignalPanel'
import PairTradeHistory from './PairTradeHistory'
import MultiTimeframePanel from './MultiTimeframePanel'
import EntryChecklist from './EntryChecklist'
import { formatPrice, formatVolume } from '../utils/format'

const defaultToggles: IndicatorToggles = {
  ma: true, ema: true, macd: true, stochRsi: true, volume: true,
  rsi: true, bollingerBands: true, atr: true, adx: true, vwap: true,
  openInterest: true, longShortRatio: true, fearGreed: true,
}

const recommendationColors: Record<string, string> = {
  HOLD: 'bg-bull/20 border-bull text-bull',
  PARTIAL_50: 'bg-warn/20 border-warn text-warn',
  PARTIAL_75: 'bg-orange-500/20 border-orange-500 text-orange-400',
  CLOSE_100: 'bg-bear/20 border-bear text-bear',
  MOVE_SL: 'bg-warn/20 border-warn text-warn',
}

function TradeOpenBadge({ trade, currentPrice }: { trade: Trade; currentPrice: number }) {
  const pnl = trade.direction === 'LONG'
    ? ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100
    : ((trade.entryPrice - currentPrice) / trade.entryPrice) * 100
  const isPositive = pnl >= 0
  const dirColor = trade.direction === 'LONG' ? 'text-bull' : 'text-bear'

  const slDistance = trade.direction === 'LONG'
    ? ((trade.stopLoss - trade.entryPrice) / trade.entryPrice * 100)
    : ((trade.entryPrice - trade.stopLoss) / trade.entryPrice * 100)
  const tpDistance = trade.direction === 'LONG'
    ? ((trade.takeProfit - trade.entryPrice) / trade.entryPrice * 100)
    : ((trade.entryPrice - trade.takeProfit) / trade.entryPrice * 100)

  return (
    <div className="bg-card border border-card-border rounded-lg px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className={`font-bold text-sm ${dirColor}`}>
          TRADE ABERTO: {trade.direction} @ {formatPrice(trade.entryPrice)}
        </span>
        <span className={`font-mono-num font-bold text-sm ${isPositive ? 'text-bull' : 'text-bear'}`}>
          {isPositive ? '+' : ''}{pnl.toFixed(2)}%
        </span>
      </div>
      <div className="flex items-center gap-4 text-xs font-mono-num">
        <span className="text-bear">
          SL: {formatPrice(trade.stopLoss)} ({slDistance.toFixed(2)}%)
        </span>
        <span className="text-bull">
          TP: {formatPrice(trade.takeProfit)} ({tpDistance.toFixed(2)}%)
        </span>
        <span className="text-muted">
          R:R {Math.abs(tpDistance / slDistance).toFixed(1)}:1
        </span>
      </div>
    </div>
  )
}

function RecommendationBar({ recommendation }: { recommendation: TradeRecommendation }) {
  const colorClass = recommendationColors[recommendation.type] ?? recommendationColors.HOLD

  return (
    <div className={`bg-card border border-card-border rounded-lg px-4 py-3 border-l-4 ${colorClass}`}>
      <div className="text-sm font-bold">{recommendation.suggestedAction}</div>
      <div className="text-xs opacity-80 mt-0.5">{recommendation.message}</div>
      {recommendation.reasons.length > 0 && (
        <ul className="text-xs opacity-60 mt-1 list-disc list-inside">
          {recommendation.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function QuickSummary({ indicators, signal, price }: { indicators: IndicatorValues; signal: SignalData; price: PriceData }) {
  const maRows = [
    { value: indicators.ma20, label: 'MA20' },
    { value: indicators.ma50, label: 'MA50' },
    { value: indicators.ma100, label: 'MA100' },
    { value: indicators.ma200, label: 'MA200' },
    { value: indicators.ema20, label: 'EMA20' },
    { value: indicators.ema50, label: 'EMA50' },
  ]
  const aboveCount = maRows.filter(r => price.price >= r.value).length

  const stochZoneLabel = indicators.stochRsi.zone === 'overbought' ? 'SOBRECOMPRA' : indicators.stochRsi.zone === 'oversold' ? 'SOBREVENDA' : 'NEUTRO'
  const stochZoneColor = indicators.stochRsi.zone === 'overbought' ? 'text-bear' : indicators.stochRsi.zone === 'oversold' ? 'text-bull' : 'text-warn'

  const rsiZoneLabel = indicators.rsi ? (indicators.rsi.zone === 'overbought' ? 'SOBRECOMPRA' : indicators.rsi.zone === 'oversold' ? 'SOBREVENDA' : 'NEUTRO') : '-'
  const rsiZoneColor = indicators.rsi ? (indicators.rsi.zone === 'overbought' ? 'text-bear' : indicators.rsi.zone === 'oversold' ? 'text-bull' : 'text-warn') : 'text-muted'

  const maColor = aboveCount >= 4 ? 'text-bull' : aboveCount <= 2 ? 'text-bear' : 'text-warn'
  const maIcon = aboveCount >= 4 ? '\u25B2' : aboveCount <= 2 ? '\u25BC' : '\u2192'
  const macdColor = indicators.macd.histogram >= 0 ? 'text-bull' : 'text-bear'
  const macdIcon = indicators.macd.trend === 'bullish' ? '\u25B2' : indicators.macd.trend === 'bearish' ? '\u25BC' : '\u2192'
  const stochIcon = indicators.stochRsi.zone === 'overbought' ? '\u26A0' : indicators.stochRsi.zone === 'oversold' ? '\u26A0' : '\u2713'
  const rsiIcon = indicators.rsi ? (indicators.rsi.zone === 'overbought' ? '\u26A0' : indicators.rsi.zone === 'oversold' ? '\u26A0' : '\u2713') : '-'
  const adxIcon = indicators.adx ? (indicators.adx.trending ? '\u2713' : '\u26A0') : '-'
  const volRatio = indicators.volume.average > 0 ? (indicators.volume.current / indicators.volume.average).toFixed(1) : '0.0'

  return (
    <div className="flex flex-wrap gap-2">
      {/* MA pill */}
      <span className={`rounded-lg border border-card-border bg-bg/60 px-2 py-1 text-xs font-bold font-mono-num ${maColor}`}>
        MA {aboveCount}/6 {maIcon}
      </span>

      {/* MACD pill */}
      <span className={`rounded-lg border border-card-border bg-bg/60 px-2 py-1 text-xs font-bold font-mono-num ${macdColor}`}>
        MACD {indicators.macd.histogram >= 0 ? '+' : ''}{indicators.macd.histogram.toFixed(2)} {macdIcon}
      </span>

      {/* RSI pill */}
      {indicators.rsi && (
        <span className={`rounded-lg border border-card-border bg-bg/60 px-2 py-1 text-xs font-bold font-mono-num ${rsiZoneColor}`}>
          RSI {indicators.rsi.value.toFixed(0)} {rsiIcon}
        </span>
      )}

      {/* StochRSI pill */}
      <span className={`rounded-lg border border-card-border bg-bg/60 px-2 py-1 text-xs font-bold font-mono-num ${stochZoneColor}`}>
        StochRSI {indicators.stochRsi.k.toFixed(0)}/{indicators.stochRsi.d.toFixed(0)} {stochIcon}
      </span>

      {/* ADX pill */}
      {indicators.adx && (
        <span className={`rounded-lg border border-card-border bg-bg/60 px-2 py-1 text-xs font-bold font-mono-num ${indicators.adx.trending ? 'text-bull' : 'text-muted'}`}>
          ADX {indicators.adx.value.toFixed(0)} {adxIcon}
        </span>
      )}

      {/* Volume pill */}
      <span className={`rounded-lg border border-card-border bg-bg/60 px-2 py-1 text-xs font-bold font-mono-num ${indicators.volume.isSpike ? 'text-warn' : 'text-muted'}`}>
        Vol {volRatio}x
      </span>
    </div>
  )
}

function SmartMoneyPanel({ data }: { data: SmartMoneyData }) {
  const trendClass =
    data.trend === 'bullish' ? 'border-bull/25 bg-bull/10 text-bull' :
    data.trend === 'bearish' ? 'border-bear/25 bg-bear/10 text-bear' :
    'border-warn/25 bg-warn/10 text-warn'
  const trendLabel = data.trend === 'bullish' ? 'ALTA' : data.trend === 'bearish' ? 'BAIXA' : 'LATERAL'

  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-col gap-3 rounded-lg border border-card-border/80 bg-bg/25 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Estrutura Smart Money</h4>
          <p className="mt-1 text-[11px] text-dim">Zonas recentes, quebras de estrutura e liquidez detectada.</p>
        </div>
        <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-sm font-black ${trendClass}`}>
          {trendLabel}
        </span>
      </div>

      {data.structureBreaks.length > 0 && (
        <section className="rounded-lg border border-card-border/80 bg-bg/25 p-3">
          <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">BOS / CHoCH</h4>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.structureBreaks.map((sb, i) => (
            <div key={i} className="rounded-md border border-card-border/70 bg-card/55 p-2">
              <div className="flex items-center justify-between gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  sb.type === 'CHoCH' ? 'bg-accent/15 text-accent' : 'bg-card-border/70 text-muted'
              }`}>{sb.type}</span>
                <span className={`text-[10px] font-bold uppercase ${sb.direction === 'bullish' ? 'text-bull' : 'text-bear'}`}>
                  {sb.direction === 'bullish' ? 'Bullish' : 'Bearish'}
                </span>
              </div>
              <div className="mt-2 font-mono-num text-sm font-bold text-white">{formatPrice(sb.level)}</div>
            </div>
          ))}
          </div>
        </section>
      )}

      {(data.fvgs.length > 0 || data.orderBlocks.length > 0) && (
        <div className="grid gap-3 lg:grid-cols-2">
          {data.fvgs.length > 0 && (
            <section className="rounded-lg border border-card-border/80 bg-bg/25 p-3">
              <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Fair Value Gaps</h4>
              <div className="space-y-2">
                {data.fvgs.map((fvg, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 rounded-md border border-card-border/70 bg-card/55 px-3 py-2">
                    <span className={`font-bold ${fvg.type === 'bullish' ? 'text-bull' : 'text-bear'}`}>
                      {fvg.type === 'bullish' ? 'Bullish' : 'Bearish'}
                    </span>
                    <span className="text-right font-mono-num text-white">{formatPrice(fvg.bottom)} - {formatPrice(fvg.top)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {data.orderBlocks.length > 0 && (
            <section className="rounded-lg border border-card-border/80 bg-bg/25 p-3">
              <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Order Blocks</h4>
              <div className="space-y-2">
                {data.orderBlocks.map((ob, i) => (
                  <div key={i} className="rounded-md border border-card-border/70 bg-card/55 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className={`font-bold ${ob.type === 'bullish' ? 'text-bull' : 'text-bear'}`}>
                        {ob.type === 'bullish' ? 'Bullish' : 'Bearish'}
                      </span>
                      <span className="rounded-full bg-bg/60 px-2 py-0.5 text-[10px] font-bold text-muted">Forca {ob.strength}</span>
                    </div>
                    <div className="mt-1 font-mono-num text-white">{formatPrice(ob.low)} - {formatPrice(ob.high)}</div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {data.candlePatterns.length > 0 && (
        <section className="rounded-lg border border-card-border/80 bg-bg/25 p-3">
          <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Padroes de candle</h4>
          <div className="flex flex-wrap gap-1.5">
            {data.candlePatterns.map((cp, i) => (
              <span key={i} className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                cp.type === 'bullish' ? 'bg-bull/15 text-bull' : cp.type === 'bearish' ? 'bg-bear/15 text-bear' : 'bg-card-border text-muted'
              }`}>
                {cp.name} - {cp.significance}
              </span>
            ))}
          </div>
        </section>
      )}

      {data.liquiditySweep.detected && (
        <div className={`rounded-lg border px-3 py-2 font-bold ${
          data.liquiditySweep.direction === 'bullish' ? 'border-bull/20 bg-bull/10 text-bull' : 'border-bear/20 bg-bear/10 text-bear'
        }`}>
          Liquidity sweep {data.liquiditySweep.direction === 'bullish' ? 'bullish' : 'bearish'} @ {data.liquiditySweep.level != null ? formatPrice(data.liquiditySweep.level) : '-'}
        </div>
      )}

      {data.srZones.length > 0 && (
        <section className="rounded-lg border border-card-border/80 bg-bg/25 p-3">
          <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Suporte e resistencia</h4>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {data.srZones.slice(0, 6).map((sr, i) => (
            <div key={i} className="rounded-md border border-card-border/70 bg-card/55 px-3 py-2">
              <div className={`text-[10px] font-bold uppercase ${sr.type === 'support' ? 'text-bull' : 'text-bear'}`}>
                {sr.type === 'support' ? 'Suporte' : 'Resistencia'}
              </div>
              <div className="mt-1 font-mono-num text-sm font-bold text-white">{formatPrice(sr.level)}</div>
              <div className="mt-1 text-[11px] text-muted">{sr.touches} toques - {sr.strength}</div>
            </div>
          ))}
          </div>
        </section>
      )}
    </div>
  )
}

export default function PairDetail({ analysis }: { analysis: PairAnalysis }) {
  const openTrade = useStore((s) => s.openTrades[analysis.symbol])
  const recommendation = useStore((s) => s.tradeRecommendations[analysis.symbol])
  const settings = useStore((s) => s.settings)
  const toggles = settings.indicatorToggles ?? defaultToggles
  const ext = analysis.externalData
  const [orderLoading, setOrderLoading] = useState(false)
  const [confirmOrder, setConfirmOrder] = useState<OrderRequest | null>(null)
  const [detailTab, setDetailTab] = useState<'resumo' | 'indicadores' | 'smartmoney' | 'risco'>('resumo')
  const userMode = settings.userMode || 'trader'

  const canExecute = settings.autoTrade?.enabled
    && settings.autoTrade.mode === 'semi'
    && analysis.signal.direction !== 'NEUTRO'
    && analysis.signal.riskManagement
    && settings.binanceApiKey
    && settings.binanceApiSecret

  const handleExecuteOrder = () => {
    const rm = analysis.signal.riskManagement
    if (!rm) return
    const positionSize = settings.baseCapital * settings.leverage
    const quantity = positionSize / analysis.price.price

    const order: OrderRequest = {
      symbol: analysis.symbol,
      side: analysis.signal.direction === 'LONG' ? 'BUY' : 'SELL',
      type: 'MARKET',
      quantity: parseFloat(quantity.toFixed(3)),
      stopLoss: rm.stopLoss,
      takeProfit: rm.takeProfit,
    }

    setConfirmOrder(order)
  }

  const handleConfirmOrder = () => {
    if (!confirmOrder) return
    setOrderLoading(true)
    setConfirmOrder(null)
    emitExecuteOrder(confirmOrder, (result) => {
      setOrderLoading(false)
      if (result.success) {
        toast.success(`Ordem executada com sucesso! ID: ${result.orderId} — Preco: ${result.price}`)
      } else {
        toast.error(`Ordem falhou: ${result.error}`)
      }
    })
  }

  // Loading state
  if (analysis.lastUpdate === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted text-sm">
        Carregando indicadores...
      </div>
    )
  }

  // Simple mode: simplified signal text
  const simpleSignalText = analysis.signal.direction === 'LONG'
    ? 'Oportunidade de compra detectada'
    : analysis.signal.direction === 'SHORT'
      ? 'Oportunidade de venda detectada'
      : 'Sem oportunidade no momento'

  return (
    <div className="flex-1 min-w-0 overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(192,193,255,0.08),transparent_32%),var(--color-bg)] p-2 sm:p-3 md:p-5 space-y-3 md:space-y-5">
      {/* Price Header — all modes */}
      <div className="overflow-hidden rounded-xl border border-card-border bg-card/90 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
        <PriceHeader price={analysis.price} />
      </div>

      {/* Tabbed indicators/risk — trader and pro */}
      {userMode !== 'simple' && (
        <div className="overflow-hidden rounded-xl border border-card-border bg-card/90">
          <div className="flex overflow-x-auto border-b border-card-border bg-bg/25">
            {(['resumo', 'indicadores', 'smartmoney', 'risco'] as const)
              .filter(t => userMode === 'pro' || t !== 'smartmoney')
              .map(tab => (
                <button
                  key={tab}
                  onClick={() => setDetailTab(tab)}
                  className={`min-w-[112px] flex-1 px-3 py-3 text-xs font-bold transition-colors cursor-pointer ${
                    detailTab === tab ? 'text-white border-b-2 border-accent bg-card-hover/60' : 'text-muted hover:text-white border-b-2 border-transparent'
                  }`}
                >
                  {tab === 'resumo' ? 'Resumo' : tab === 'indicadores' ? 'Indicadores' : tab === 'smartmoney' ? 'Smart Money' : 'Risco'}
                </button>
              ))}
          </div>
          <div className="p-3">
            {detailTab === 'resumo' && <QuickSummary indicators={analysis.indicators} signal={analysis.signal} price={analysis.price} />}
            {detailTab === 'indicadores' && <IndicatorPanel indicators={analysis.indicators} price={analysis.price.price} />}
            {detailTab === 'smartmoney' && analysis.indicators.smartMoney && <SmartMoneyPanel data={analysis.indicators.smartMoney} />}
            {detailTab === 'risco' && <RiskPanel risk={analysis.signal.riskManagement} />}
          </div>
        </div>
      )}

      {/* Simple mode: simplified risk */}
      {userMode === 'simple' && analysis.signal.riskManagement && (
        <div className="rounded-xl border border-card-border bg-card">
          <RiskPanel risk={analysis.signal.riskManagement} />
        </div>
      )}

      {/* External Data — pro only */}
      {userMode === 'pro' && ext && (
        <div className="rounded-xl border border-card-border bg-card px-4 py-3 text-xs">
          <div className="mb-3">
            <h4 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Dados externos</h4>
            <p className="mt-1 text-[11px] text-dim">Contexto de mercado usado como filtro auxiliar.</p>
          </div>
          <div className="grid gap-2 md:grid-cols-3">

          {toggles.openInterest && ext.openInterest && (
            <div className="rounded-lg border border-card-border/75 bg-bg/25 p-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-dim">Open interest</div>
              <div className="mt-1 font-mono-num text-sm font-bold text-white">{formatVolume(ext.openInterest.value)}</div>
              <div className={`mt-1 font-mono-num text-xs font-bold ${ext.openInterest.change >= 0 ? 'text-bull' : 'text-bear'}`}>
                {ext.openInterest.change >= 0 ? '+' : ''}{ext.openInterest.change.toFixed(1)}%
                <span className="ml-1 text-muted">
                  {ext.openInterest.trend === 'rising' ? '\u2191' : ext.openInterest.trend === 'falling' ? '\u2193' : '\u2192'}
                </span>
              </div>
            </div>
          )}

          {toggles.longShortRatio && ext.longShortRatio && (
            <div className="rounded-lg border border-card-border/75 bg-bg/25 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-dim">Long / Short</div>
              {ext.longShortRatio.crowded !== 'neutral' && (
                <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[10px] font-bold text-warn">
                  Crowd {ext.longShortRatio.crowded === 'long' ? 'LONG' : 'SHORT'}
                </span>
              )}
              </div>
              <div className="mt-1 font-mono-num text-sm font-bold text-white">{ext.longShortRatio.ratio.toFixed(2)}</div>
              <div className="mt-1 text-xs text-muted">
                Long <span className="font-mono-num text-bull">{ext.longShortRatio.longPercent.toFixed(0)}%</span>
                {' / '}
                Short <span className="font-mono-num text-bear">{ext.longShortRatio.shortPercent.toFixed(0)}%</span>
              </div>
            </div>
          )}

          {toggles.fearGreed && ext.fearGreed && (
            <div className="rounded-lg border border-card-border/75 bg-bg/25 p-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-dim">Fear & Greed</div>
              <div className="mt-1 font-mono-num text-sm font-bold text-white">{ext.fearGreed.value}</div>
              <div className="mt-1 text-xs text-muted">{ext.fearGreed.label}</div>
            </div>
          )}
          </div>
        </div>
      )}

      {/* Signal Panel */}
      <div className="overflow-hidden rounded-xl border border-card-border bg-card">
        {userMode === 'simple' ? (
          /* Simplified signal for simple mode */
          <div className="px-3 py-2 space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 text-xs font-bold rounded ${
                analysis.signal.direction === 'LONG' ? 'bg-bull/15 text-bull' :
                analysis.signal.direction === 'SHORT' ? 'bg-bear/15 text-bear' :
                'bg-warn/15 text-warn'
              }`}>
                {analysis.signal.direction === 'LONG' ? 'COMPRA' : analysis.signal.direction === 'SHORT' ? 'VENDA' : 'NEUTRO'}
              </span>
              {analysis.signal.confidence === 'high' && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-accent/15 text-accent rounded">FORTE</span>
              )}
              <span className={`font-mono-num font-bold ml-auto ${
                analysis.signal.direction === 'LONG' ? 'text-bull' :
                analysis.signal.direction === 'SHORT' ? 'text-bear' : 'text-muted'
              }`}>{analysis.signal.confluenceScore.toFixed(0)}%</span>
            </div>
            <div className="w-full h-1 rounded score-bar-bg overflow-hidden">
              <div className={`h-full rounded transition-all duration-500 ${
                analysis.signal.direction === 'LONG' ? 'score-bar-fill-bull' :
                analysis.signal.direction === 'SHORT' ? 'score-bar-fill-bear' : 'score-bar-fill-neutral'
              }`} style={{ width: `${Math.min(100, Math.max(0, analysis.signal.confluenceScore))}%` }} />
            </div>
            <p className="text-xs text-muted italic">{simpleSignalText}</p>
          </div>
        ) : (
          /* Full signal for trader/pro */
          <>
            <SignalPanel signal={analysis.signal} />
            {analysis.btcCorrelation && analysis.symbol !== 'BTCUSDT' && (
              <div className={`px-3 py-2 text-xs font-bold border-t border-card-border ${
                analysis.btcCorrelation.warning ? 'bg-warn/10 text-warn' : 'bg-bull/10 text-bull'
              }`}>
                {analysis.btcCorrelation.warning
                  ? `-- ${analysis.btcCorrelation.warning}`
                  : `Alinhado com BTC (${analysis.btcCorrelation.btcDirection}, score: ${analysis.btcCorrelation.btcScore.toFixed(0)})`
                }
              </div>
            )}
            {/* MultiTimeframe — trader + pro */}
            {analysis.multiTimeframe && (
              <MultiTimeframePanel data={analysis.multiTimeframe} />
            )}
            {/* EntryChecklist — pro only */}
            {userMode === 'pro' && analysis.entryCheck && (
              <EntryChecklist check={analysis.entryCheck} />
            )}
          </>
        )}
      </div>

      {/* Execute Order Button (semi-auto mode) — trader + pro */}
      {userMode !== 'simple' && canExecute && (
        <button
          onClick={handleExecuteOrder}
          disabled={orderLoading}
          className={`w-full py-3 rounded-lg font-bold text-sm transition-colors ${
            analysis.signal.direction === 'LONG'
              ? 'bg-bull hover:bg-bull/80 text-white'
              : 'bg-bear hover:bg-bear/80 text-white'
          } ${orderLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {orderLoading
            ? 'Enviando ordem...'
            : `Executar ${analysis.signal.direction === 'LONG' ? 'COMPRA' : 'VENDA'} - ${analysis.symbol}`
          }
        </button>
      )}

      {/* Open Trade + Recommendation */}
      {openTrade && (
        <TradeOpenBadge trade={openTrade} currentPrice={analysis.price.price} />
      )}
      {openTrade && recommendation && (
        <RecommendationBar recommendation={recommendation} />
      )}

      {/* Trade History for this pair */}
      <PairTradeHistory symbol={analysis.symbol} />

      {/* Confirm Order Modal */}
      {confirmOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 cursor-pointer" onClick={() => setConfirmOrder(null)} />
          <div className="relative bg-card border border-card-border rounded-lg p-5 w-full max-w-sm mx-4 space-y-4 animate-fade-in">
            <h3 className="text-sm font-display font-bold">Confirmar Ordem</h3>
            <div className="space-y-2 text-xs font-mono-num">
              <div className="flex justify-between">
                <span className="text-muted">Par:</span>
                <span className="font-bold">{confirmOrder.symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Lado:</span>
                <span className={`font-bold ${confirmOrder.side === 'BUY' ? 'text-bull' : 'text-bear'}`}>{confirmOrder.side}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Quantidade:</span>
                <span>{confirmOrder.quantity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Stop Loss:</span>
                <span className="text-bear">{formatPrice(confirmOrder.stopLoss)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Take Profit:</span>
                <span className="text-bull">{formatPrice(confirmOrder.takeProfit)}</span>
              </div>
            </div>
            <div className="bg-warn/10 border border-warn/30 rounded px-3 py-2 text-warn text-[10px] leading-tight">
              Esta acao executara uma ordem real na Binance
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmOrder(null)}
                className="flex-1 py-2 rounded-lg text-xs font-bold bg-card-border/50 hover:bg-card-border text-muted hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmOrder}
                className="flex-1 py-2 rounded-lg text-xs font-bold bg-accent hover:bg-accent/80 text-white transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
