import type { SignalData } from '@bottrade/shared'

const directionStyles: Record<string, string> = {
  LONG: 'bg-bull/15 text-bull',
  SHORT: 'bg-bear/15 text-bear',
  NEUTRO: 'bg-warn/15 text-warn',
}

function getScoreFillClass(direction: string): string {
  if (direction === 'LONG') return 'score-bar-fill-bull'
  if (direction === 'SHORT') return 'score-bar-fill-bear'
  return 'score-bar-fill-neutral'
}

function getScoreTextClass(direction: string): string {
  if (direction === 'LONG') return 'text-bull'
  if (direction === 'SHORT') return 'text-bear'
  return 'text-muted'
}

export default function SignalPanel({ signal }: { signal: SignalData }) {
  const scorePercent = Math.min(100, Math.max(0, signal.confluenceScore))
  const style = directionStyles[signal.direction] ?? directionStyles.NEUTRO

  return (
    <div className="border-t border-card-border px-3 py-2 space-y-2 text-xs" data-tour="signal-panel">
      {/* Direction Badge + Confidence + Score */}
      <div className="flex items-center gap-2">
        <span className={`px-2 py-0.5 text-xs font-bold rounded ${style}`}>
          {signal.direction}
        </span>
        {signal.confidence === 'high' && (
          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-accent/15 text-accent rounded">
            ALTA CONFIANCA
          </span>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className={`font-mono-num font-bold ${getScoreTextClass(signal.direction)}`}>{scorePercent.toFixed(0)}%</span>
        </div>
      </div>

      {/* Score Bar — thin solid fill */}
      <div className="w-full h-1 rounded score-bar-bg overflow-hidden">
        <div
          className={`h-full rounded transition-all duration-500 ${getScoreFillClass(signal.direction)}`}
          style={{ width: `${scorePercent}%` }}
        />
      </div>

      {/* Critical Decision */}
      {signal.criticalDecision && (
        <p className="text-xs text-muted italic">{signal.criticalDecision}</p>
      )}

      {/* Action Points */}
      {signal.actionPoints.length > 0 && (
        <ul className="space-y-0.5 text-muted">
          {signal.actionPoints.map((point: string, i: number) => (
            <li key={i} className="text-xs pl-2 border-l border-card-border">{point}</li>
          ))}
        </ul>
      )}

      {/* Entry/Reversal Triggers */}
      {signal.entryTrigger && (
        <div className="text-xs text-bull">
          <span className="font-bold">Entry: </span>{signal.entryTrigger}
        </div>
      )}
      {signal.reversalTrigger && (
        <div className="text-xs text-bear">
          <span className="font-bold">Reversal: </span>{signal.reversalTrigger}
        </div>
      )}

      {/* Override Warnings */}
      {signal.overrides.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {signal.overrides.map((override: string, i: number) => (
            <span key={i} className="px-1.5 py-0.5 text-[10px] font-bold bg-warn/20 text-warn rounded">
              {override}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
