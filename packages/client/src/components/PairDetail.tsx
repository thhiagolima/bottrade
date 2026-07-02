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
    <div className="flex flex-wrap gap-1">
      {/* MA pill */}
      <span className={`text-[11px] px-1.5 py-0.5 rounded bg-card-border font-mono-num ${maColor}`}>
        MA {aboveCount}/6 {maIcon}
      </span>

      {/* MACD pill */}
      <span className={`text-[11px] px-1.5 py-0.5 rounded bg-card-border font-mono-num ${macdColor}`}>
        MACD {indicators.macd.histogram >= 0 ? '+' : ''}{indicators.macd.histogram.toFixed(2)} {macdIcon}
      </span>

      {/* RSI pill */}
      {indicators.rsi && (
        <span className={`text-[11px] px-1.5 py-0.5 rounded bg-card-border font-mono-num ${rsiZoneColor}`}>
          RSI {indicators.rsi.value.toFixed(0)} {rsiIcon}
        </span>
      )}

      {/* StochRSI pill */}
      <span className={`text-[11px] px-1.5 py-0.5 rounded bg-card-border font-mono-num ${stochZoneColor}`}>
        StochRSI {indicators.stochRsi.k.toFixed(0)}/{indicators.stochRsi.d.toFixed(0)} {stochIcon}
      </span>

      {/* ADX pill */}
      {indicators.adx && (
        <span className={`text-[11px] px-1.5 py-0.5 rounded bg-card-border font-mono-num ${indicators.adx.trending ? 'text-bull' : 'text-muted'}`}>
          ADX {indicators.adx.value.toFixed(0)} {adxIcon}
        </span>
      )}

      {/* Volume pill */}
      <span className={`text-[11px] px-1.5 py-0.5 rounded bg-card-border font-mono-num ${indicators.volume.isSpike ? 'text-warn' : 'text-muted'}`}>
        Vol {volRatio}x
      </span>
    </div>
  )
}

function SmartMoneyPanel({ data }: { data: SmartMoneyData }) {
  return (
    <div className="space-y-2 text-xs">
      {/* Trend */}
      <div className="flex items-center justify-between">
        <span className="text-muted">Estrutura</span>
        <span className={data.trend === 'bullish' ? 'text-bull font-bold' : data.trend === 'bearish' ? 'text-bear font-bold' : 'text-muted'}>
          {data.trend === 'bullish' ? 'ALTA' : data.trend === 'bearish' ? 'BAIXA' : 'LATERAL'}
        </span>
      </div>

      {/* BOS/CHoCH */}
      {data.structureBreaks.length > 0 && (
        <div className="space-y-1">
          {data.structureBreaks.map((sb, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                sb.type === 'CHoCH' ? 'bg-accent/20 text-accent' : 'bg-card-border text-muted'
              }`}>{sb.type}</span>
              <span className={`font-mono-num ${sb.direction === 'bullish' ? 'text-bull' : 'text-bear'}`}>
                {sb.level.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* FVGs */}
      {data.fvgs.length > 0 && (
        <div>
          <span className="text-muted">FVG: </span>
          {data.fvgs.map((fvg, i) => (
            <span key={i} className={`mr-2 font-mono-num ${fvg.type === 'bullish' ? 'text-bull' : 'text-bear'}`}>
              {fvg.type === 'bullish' ? '\u25B2' : '\u25BC'} {fvg.bottom.toFixed(2)}-{fvg.top.toFixed(2)}
            </span>
          ))}
        </div>
      )}

      {/* Order Blocks */}
      {data.orderBlocks.length > 0 && (
        <div>
          <span className="text-muted">OB: </span>
          {data.orderBlocks.map((ob, i) => (
            <span key={i} className={`mr-2 font-mono-num ${ob.type === 'bullish' ? 'text-bull' : 'text-bear'}`}>
              {ob.type === 'bullish' ? '\u25B2' : '\u25BC'} {ob.low.toFixed(2)}-{ob.high.toFixed(2)} (F{ob.strength})
            </span>
          ))}
        </div>
      )}

      {/* Candle Patterns */}
      {data.candlePatterns.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {data.candlePatterns.map((cp, i) => (
            <span key={i} className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              cp.type === 'bullish' ? 'bg-bull/20 text-bull' : cp.type === 'bearish' ? 'bg-bear/20 text-bear' : 'bg-card-border text-muted'
            }`}>
              {cp.name}
            </span>
          ))}
        </div>
      )}

      {/* Liquidity Sweep */}
      {data.liquiditySweep.detected && (
        <div className={`font-bold px-2 py-1 rounded ${
          data.liquiditySweep.direction === 'bullish' ? 'bg-bull/20 text-bull' : 'bg-bear/20 text-bear'
        }`}>
          LIQUIDITY SWEEP {data.liquiditySweep.direction === 'bullish' ? '\u25B2' : '\u25BC'} @ {data.liquiditySweep.level?.toFixed(2)}
        </div>
      )}

      {/* S/R Zones */}
      {data.srZones.length > 0 && (
        <div className="space-y-0.5">
          <span className="text-muted">S/R:</span>
          {data.srZones.slice(0, 3).map((sr, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className={sr.type === 'support' ? 'text-bull' : 'text-bear'}>
                {sr.type === 'support' ? 'Suporte' : 'Resistencia'}
              </span>
              <span className="font-mono-num">{sr.level.toFixed(2)} <span className="text-muted">({sr.touches}x {sr.strength})</span></span>
            </div>
          ))}
        </div>
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
    <div className="flex-1 min-w-0 overflow-y-auto p-1.5 sm:p-2 md:p-4 space-y-2.5 md:space-y-4">
      {/* Price Header — all modes */}
      <div className="bg-card border border-card-border rounded-lg">
        <PriceHeader price={analysis.price} />
      </div>

      {/* Tabbed indicators/risk — trader and pro */}
      {userMode !== 'simple' && (
        <div className="bg-card border border-card-border rounded-lg overflow-hidden">
          <div className="grid grid-cols-3 border-b border-card-border">
            {(['resumo', 'indicadores', 'smartmoney', 'risco'] as const)
              .filter(t => userMode === 'pro' || t !== 'smartmoney')
              .map(tab => (
                <button
                  key={tab}
                  onClick={() => setDetailTab(tab)}
                  className={`min-w-0 px-2 py-2 text-[11px] md:text-xs font-medium transition-colors cursor-pointer ${
                    detailTab === tab ? 'text-white border-b-2 border-accent' : 'text-muted hover:text-white border-b-2 border-transparent'
                  }`}
                >
                  {tab === 'resumo' ? 'Resumo' : tab === 'indicadores' ? 'Indicadores' : tab === 'smartmoney' ? 'Smart Money' : 'Risco'}
                </button>
              ))}
          </div>
          <div className="p-1.5 sm:p-2">
            {detailTab === 'resumo' && <QuickSummary indicators={analysis.indicators} signal={analysis.signal} price={analysis.price} />}
            {detailTab === 'indicadores' && <IndicatorPanel indicators={analysis.indicators} price={analysis.price.price} />}
            {detailTab === 'smartmoney' && analysis.indicators.smartMoney && <SmartMoneyPanel data={analysis.indicators.smartMoney} />}
            {detailTab === 'risco' && <RiskPanel risk={analysis.signal.riskManagement} />}
          </div>
        </div>
      )}

      {/* Simple mode: simplified risk */}
      {userMode === 'simple' && analysis.signal.riskManagement && (
        <div className="bg-card border border-card-border rounded-lg">
          <RiskPanel risk={analysis.signal.riskManagement} />
        </div>
      )}

      {/* External Data — pro only */}
      {userMode === 'pro' && ext && (
        <div className="bg-card border border-card-border rounded-lg px-4 py-3 space-y-2 text-xs">
          <h4 className="text-muted font-bold text-[10px] uppercase tracking-wider">Dados Externos</h4>

          {toggles.openInterest && ext.openInterest && (
            <div className="flex items-center gap-2">
              <span className="text-muted">OI:</span>
              <span className="font-mono-num text-white">{formatVolume(ext.openInterest.value)}</span>
              <span className={`font-mono-num font-bold ${ext.openInterest.change >= 0 ? 'text-bull' : 'text-bear'}`}>
                ({ext.openInterest.change >= 0 ? '+' : ''}{ext.openInterest.change.toFixed(1)}%)
              </span>
              <span>
                {ext.openInterest.trend === 'rising' ? '\u2191' : ext.openInterest.trend === 'falling' ? '\u2193' : '\u2192'}
              </span>
            </div>
          )}

          {toggles.longShortRatio && ext.longShortRatio && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-muted">L/S:</span>
              <span className="font-mono-num font-bold text-white">{ext.longShortRatio.ratio.toFixed(2)}</span>
              <span className="text-muted">
                (Long: <span className="font-mono-num text-bull">{ext.longShortRatio.longPercent.toFixed(0)}%</span>
                {' | '}Short: <span className="font-mono-num text-bear">{ext.longShortRatio.shortPercent.toFixed(0)}%</span>)
              </span>
              {ext.longShortRatio.crowded !== 'neutral' && (
                <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold bg-warn/20 text-warn rounded">
                  <svg className="w-3 h-3 text-warn inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> CROWD {ext.longShortRatio.crowded === 'long' ? 'LONG' : 'SHORT'}
                </span>
              )}
            </div>
          )}

          {toggles.fearGreed && ext.fearGreed && (
            <div className="flex items-center gap-2">
              <span className="text-muted">Fear & Greed:</span>
              <span className="font-mono-num font-bold text-white">{ext.fearGreed.value}</span>
              <span className="text-muted">- {ext.fearGreed.label}</span>
            </div>
          )}
        </div>
      )}

      {/* Signal Panel */}
      <div className="bg-card border border-card-border rounded-lg">
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
