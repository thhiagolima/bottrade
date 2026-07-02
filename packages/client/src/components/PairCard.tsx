import type { PairAnalysis, Trade, TradeRecommendation, TradeStats } from '@bottrade/shared'
import { useStore } from '../store/useStore'
import PriceHeader from './PriceHeader'
import IndicatorPanel from './IndicatorPanel'
import SignalPanel from './SignalPanel'
import RiskPanel from './RiskPanel'
import { formatPrice } from '../utils/format'

const directionBorderColor: Record<string, string> = {
  LONG: 'border-l-bull',
  SHORT: 'border-l-bear',
  NEUTRO: 'border-l-warn',
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

  return (
    <div className="px-3 py-1.5 flex items-center justify-between text-xs border-t border-card-border">
      <span className={`font-bold ${dirColor}`}>
        TRADE ABERTO: {trade.direction} @ ${formatPrice(trade.entryPrice)}
      </span>
      <span className={`font-mono-num font-bold ${isPositive ? 'text-bull' : 'text-bear'}`}>
        {isPositive ? '+' : ''}{pnl.toFixed(2)}%
      </span>
    </div>
  )
}

function RecommendationBar({ recommendation }: { recommendation: TradeRecommendation }) {
  const colorClass = recommendationColors[recommendation.type] ?? recommendationColors.HOLD

  return (
    <div className={`px-3 py-1.5 border-t border-card-border ${colorClass} border-l-2`}>
      <div className="text-xs font-bold">{recommendation.suggestedAction}</div>
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

function WinRateLine({ stats }: { stats: TradeStats | undefined }) {
  if (!stats || stats.totalTrades === 0) {
    return (
      <div className="px-3 py-1 text-xs text-muted border-t border-card-border">
        Sem historico de trades
      </div>
    )
  }

  return (
    <div className="px-3 py-1 text-xs text-muted border-t border-card-border">
      Win Rate: <span className="font-bold text-white">{stats.winRate.toFixed(0)}%</span>{' '}
      ({stats.wins}/{stats.totalTrades})
    </div>
  )
}

export default function PairCard({ analysis }: { analysis: PairAnalysis }) {
  const connected = useStore((state) => state.connectionStatus[analysis.symbol] ?? true)
  const openTrade = useStore((state) => state.openTrades[analysis.symbol])
  const recommendation = useStore((state) => state.tradeRecommendations[analysis.symbol])
  const stats = useStore((state) => state.tradeStats[analysis.symbol])
  const direction = analysis.signal?.direction ?? 'NEUTRO'

  return (
    <div
      className={`relative bg-card border border-card-border rounded-lg overflow-hidden border-l-4 ${directionBorderColor[direction] ?? 'border-l-warn'} ${!connected ? 'grayscale' : ''}`}
    >
      {/* Disconnected overlay */}
      {!connected && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
          <span className="text-sm font-bold text-bear tracking-wider">DESCONECTADO</span>
        </div>
      )}

      {/* Loading state */}
      {analysis.lastUpdate === 0 ? (
        <div className="flex items-center justify-center h-32 text-muted text-sm">
          Carregando indicadores...
        </div>
      ) : (
        <>
          <PriceHeader price={analysis.price} />
          <IndicatorPanel indicators={analysis.indicators} price={analysis.price.price} />
          <SignalPanel signal={analysis.signal} />
          <RiskPanel risk={analysis.signal.riskManagement} />
          {openTrade && <TradeOpenBadge trade={openTrade} currentPrice={analysis.price.price} />}
          {openTrade && recommendation && <RecommendationBar recommendation={recommendation} />}
          <WinRateLine stats={stats} />
        </>
      )}
    </div>
  )
}
