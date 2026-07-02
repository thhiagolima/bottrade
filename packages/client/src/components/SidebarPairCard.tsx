import type { PairAnalysis } from '@bottrade/shared'
import { formatPrice } from '../utils/format'

const directionColors: Record<string, { bg: string; border: string; text: string }> = {
  LONG: { bg: 'bg-bull/15', border: 'border-l-bull', text: 'text-bull' },
  SHORT: { bg: 'bg-bear/15', border: 'border-l-bear', text: 'text-bear' },
  NEUTRO: { bg: 'bg-warn/15', border: 'border-l-warn', text: 'text-warn' },
}

function getScoreFillClass(direction: string): string {
  if (direction === 'LONG') return 'score-bar-fill-bull'
  if (direction === 'SHORT') return 'score-bar-fill-bear'
  return 'score-bar-fill-neutral'
}

export default function SidebarPairCard({
  analysis,
  selected,
  onClick,
}: {
  analysis: PairAnalysis
  selected: boolean
  onClick: () => void
}) {
  const direction = analysis.signal?.direction ?? 'NEUTRO'
  const colors = directionColors[direction] ?? directionColors.NEUTRO
  const scorePercent = Math.min(100, Math.max(0, analysis.signal.confluenceScore))
  const changePositive = analysis.price.change24h >= 0

  return (
    <button
      onClick={onClick}
      className={`w-full min-w-0 text-left py-1.5 px-2 border-l-2 ${colors.border} transition-all duration-200 animate-fade-in ${
        selected ? 'bg-card-hover' : 'hover:bg-card-border/30'
      }`}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-0.5">
        <div className="min-w-0 flex items-center gap-1.5">
          <span className="min-w-0 truncate font-bold text-xs font-body" title={analysis.symbol}>
            {analysis.symbol.replace('USDT', '')}
          </span>
          <span className={`flex-shrink-0 text-[10px] px-1 py-0 font-bold rounded ${colors.bg} ${colors.text}`}>
            {direction}
          </span>
        </div>

        <span className="font-mono-num text-xs text-right tabular-nums">
          {formatPrice(analysis.price.price)}
        </span>

        <div className="min-w-0 flex items-center gap-2">
          <div className="flex-1 h-0.5 rounded-full overflow-hidden score-bar-bg">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getScoreFillClass(direction)}`}
              style={{ width: `${scorePercent}%` }}
            />
          </div>
          <span className="font-mono-num text-[10px] text-muted w-7 text-right tabular-nums">
            {scorePercent.toFixed(0)}%
          </span>
        </div>

        <span className={`font-mono-num text-[10px] font-bold text-right tabular-nums ${changePositive ? 'text-bull' : 'text-bear'}`}>
          {changePositive ? '+' : ''}{analysis.price.change24h.toFixed(2)}%
        </span>
      </div>
    </button>
  )
}
