import type { MultiTimeframeData, TimeframeAnalysis } from '@bottrade/shared'
import { formatPrice } from '../utils/format'

const dirColors: Record<string, string> = {
  LONG: 'border-bull/25 bg-bull/10 text-bull',
  SHORT: 'border-bear/25 bg-bear/10 text-bear',
  NEUTRO: 'border-warn/25 bg-warn/10 text-warn',
}

const alignColors: Record<string, string> = {
  aligned: 'border-bull/25 bg-bull/10 text-bull',
  conflicting: 'border-bear/25 bg-bear/10 text-bear',
  partial: 'border-warn/25 bg-warn/10 text-warn',
}

const alignLabels: Record<string, string> = {
  aligned: 'ALINHADO',
  conflicting: 'CONFLITO',
  partial: 'PARCIAL',
}

function TimeframeCard({ tf, label }: { tf: TimeframeAnalysis | null; label: string }) {
  if (!tf) {
    return (
      <div className="rounded-lg border border-dashed border-card-border bg-bg/20 p-3">
        <div className="text-xs font-bold text-muted">{label}</div>
        <div className="mt-3 text-sm text-dim">Sem dados</div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-card-border/75 bg-bg/25 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-bold text-muted">{label}</div>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${dirColors[tf.direction]}`}>
          {tf.direction}
        </span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.08em] text-dim">Score</div>
          <div className="font-mono-num text-xl font-black text-white">{tf.score.toFixed(0)}</div>
        </div>
        <div className="text-right text-xs font-semibold text-muted">{tf.trend}</div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5 text-[10px]">
        <div className="rounded bg-card/60 p-1.5">
          <div className="text-dim">MA20</div>
          <div className="truncate font-mono-num text-white" title={formatPrice(tf.keyLevels.ma20)}>{formatPrice(tf.keyLevels.ma20)}</div>
        </div>
        <div className="rounded bg-card/60 p-1.5">
          <div className="text-dim">MA50</div>
          <div className="truncate font-mono-num text-white" title={formatPrice(tf.keyLevels.ma50)}>{formatPrice(tf.keyLevels.ma50)}</div>
        </div>
        <div className="rounded bg-card/60 p-1.5">
          <div className="text-dim">MA200</div>
          <div className="truncate font-mono-num text-white" title={formatPrice(tf.keyLevels.ma200)}>{formatPrice(tf.keyLevels.ma200)}</div>
        </div>
      </div>
    </div>
  )
}

export default function MultiTimeframePanel({ data }: { data: MultiTimeframeData }) {
  const alignClass = alignColors[data.alignment] ?? alignColors.partial

  return (
    <div className="border-t border-card-border px-3 py-3">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Multi-timeframe</h4>
          <p className="mt-1 text-xs leading-relaxed text-muted">{data.summary}</p>
        </div>
        <span className={`w-fit rounded-full border px-3 py-1 text-[10px] font-black ${alignClass}`}>
          {alignLabels[data.alignment]}
        </span>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <TimeframeCard tf={data['15m']} label="15m" />
        <TimeframeCard tf={data['1h']} label="1h" />
        <TimeframeCard tf={data['4h']} label="4h" />
      </div>
    </div>
  )
}
