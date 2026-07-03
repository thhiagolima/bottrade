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
      className={`w-full min-w-0 text-left border-l-2 px-2.5 py-2.5 ${colors.border} transition-all duration-200 animate-fade-in ${
        selected ? 'bg-card-hover shadow-[inset_0_0_0_1px_var(--color-card-border)]' : 'hover:bg-card-border/30'
      }`}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(72px,auto)] gap-x-2 gap-y-1">
        <div className="min-w-0 flex items-center gap-1.5">
          <span className="min-w-0 truncate text-sm font-black tracking-tight text-white" title={analysis.symbol}>
            {analysis.symbol.replace('USDT', '')}
          </span>
          <span className={`flex-shrink-0 rounded px-1.5 py-0.5 text-[9px] font-black ${colors.bg} ${colors.text}`}>
            {direction}
          </span>
        </div>

        <span className="font-mono-num text-right text-xs font-bold tabular-nums text-white">
          {formatPrice(analysis.price.price)}
        </span>

        <div className="min-w-0 flex items-center gap-2 self-end">
          <div className="h-1 flex-1 overflow-hidden rounded-full score-bar-bg">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getScoreFillClass(direction)}`}
              style={{ width: `${scorePercent}%` }}
            />
          </div>
          <span className="w-8 text-right font-mono-num text-[10px] text-muted tabular-nums">
            {scorePercent.toFixed(0)}%
          </span>
        </div>

        <span className={`text-right font-mono-num text-xs font-black tabular-nums ${changePositive ? 'text-bull' : 'text-bear'}`}>
          {changePositive ? '+' : ''}{analysis.price.change24h.toFixed(2)}%
        </span>
      </div>
    </button>
  )
}
