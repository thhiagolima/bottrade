import type { SignalData } from '@bottrade/shared'

const directionStyles: Record<string, string> = {
  LONG: 'border-bull/25 bg-bull/10 text-bull',
  SHORT: 'border-bear/25 bg-bear/10 text-bear',
  NEUTRO: 'border-warn/25 bg-warn/10 text-warn',
}

function getScoreFillClass(direction: string): string {
  if (direction === 'LONG') return 'score-bar-fill-bull'
  if (direction === 'SHORT') return 'score-bar-fill-bear'
  return 'score-bar-fill-neutral'
}

function getScoreTextClass(direction: string): string {
  if (direction === 'LONG') return 'text-bull'
  if (direction === 'SHORT') return 'text-bear'
  return 'text-warn'
}

export default function SignalPanel({ signal }: { signal: SignalData }) {
  const scorePercent = Math.min(100, Math.max(0, signal.confluenceScore))
  const style = directionStyles[signal.direction] ?? directionStyles.NEUTRO

  return (
    <div className="border-t border-card-border px-3 py-3" data-tour="signal-panel">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-sm font-black ${style}`}>
              {signal.direction}
            </span>
            {signal.confidence === 'high' && (
              <span className="rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-accent">
                Alta confianca
              </span>
            )}
          </div>
          {signal.criticalDecision && (
            <p className="mt-3 max-w-5xl text-sm italic leading-relaxed text-muted">{signal.criticalDecision}</p>
          )}
        </div>

        <div className="shrink-0 rounded-lg border border-card-border/80 bg-bg/30 px-4 py-3 text-right">
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-dim">Score</div>
          <div className={`font-mono-num text-2xl font-black leading-none ${getScoreTextClass(signal.direction)}`}>
            {scorePercent.toFixed(0)}%
          </div>
        </div>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-card-border/60">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getScoreFillClass(signal.direction)}`}
          style={{ width: `${scorePercent}%` }}
        />
      </div>

      {signal.actionPoints.length > 0 && (
        <div className="mt-4 rounded-lg border border-card-border/75 bg-bg/20 p-3">
          <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Leitura do setup</h4>
          <ul className="grid gap-2 text-sm text-muted lg:grid-cols-2">
            {signal.actionPoints.map((point: string, i: number) => (
              <li key={i} className="border-l border-card-border pl-3 leading-snug">
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(signal.entryTrigger || signal.reversalTrigger || signal.overrides.length > 0) && (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {signal.entryTrigger && (
            <div className="rounded-lg border border-bull/20 bg-bull/5 px-3 py-2 text-sm text-bull">
              <span className="font-bold">Entrada: </span>{signal.entryTrigger}
            </div>
          )}
          {signal.reversalTrigger && (
            <div className="rounded-lg border border-bear/20 bg-bear/5 px-3 py-2 text-sm text-bear">
              <span className="font-bold">Reversao: </span>{signal.reversalTrigger}
            </div>
          )}
          {signal.overrides.length > 0 && (
            <div className="rounded-lg border border-warn/20 bg-warn/5 px-3 py-2 md:col-span-2">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-warn">Bloqueios e alertas</div>
              <div className="flex flex-wrap gap-1.5">
                {signal.overrides.map((override: string, i: number) => (
                  <span key={i} className="rounded-full bg-warn/15 px-2 py-1 text-[10px] font-bold text-warn">
                    {override}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
