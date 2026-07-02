import type { MultiTimeframeData, TimeframeAnalysis } from '@bottrade/shared'
import { formatPrice } from '../utils/format'

const dirColors: Record<string, string> = {
  LONG: 'text-bull',
  SHORT: 'text-bear',
  NEUTRO: 'text-warn',
}
const dirBg: Record<string, string> = {
  LONG: 'bg-bull/20',
  SHORT: 'bg-bear/20',
  NEUTRO: 'bg-warn/20',
}
const alignColors: Record<string, { bg: string; text: string }> = {
  aligned: { bg: 'bg-bull/20', text: 'text-bull' },
  conflicting: { bg: 'bg-bear/20', text: 'text-bear' },
  partial: { bg: 'bg-warn/20', text: 'text-warn' },
}
const alignLabels: Record<string, string> = {
  aligned: 'ALINHADO',
  conflicting: 'CONFLITO',
  partial: 'PARCIAL',
}

function TimeframeColumn({ tf, label }: { tf: TimeframeAnalysis | null; label: string }) {
  if (!tf) {
    return (
      <div className="flex-1 text-center space-y-1">
        <div className="text-xs text-muted font-semibold">{label}</div>
        <div className="text-xs text-muted">--</div>
      </div>
    )
  }

  return (
    <div className="flex-1 text-center space-y-1">
      <div className="text-xs text-muted font-semibold">{label}</div>
      <div className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${dirBg[tf.direction]} ${dirColors[tf.direction]}`}>
        {tf.direction}
      </div>
      <div className="text-xs font-mono-num text-foreground">{tf.score.toFixed(0)}</div>
      <div className="text-xs text-muted">{tf.trend}</div>
      <div className="space-y-0.5 text-xs font-mono-num text-muted">
        <div>MA20: {formatPrice(tf.keyLevels.ma20)}</div>
        <div>MA50: {formatPrice(tf.keyLevels.ma50)}</div>
        <div>MA200: {formatPrice(tf.keyLevels.ma200)}</div>
      </div>
    </div>
  )
}

export default function MultiTimeframePanel({ data }: { data: MultiTimeframeData }) {
  const ac = alignColors[data.alignment] ?? alignColors.partial

  return (
    <div className="border-t border-card-border px-3 py-3 space-y-2">
      {/* Header: alignment badge + summary */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted">Multi-Timeframe</span>
        <span className={`px-2 py-0.5 rounded text-xs font-bold ${ac.bg} ${ac.text}`}>
          {alignLabels[data.alignment]}
        </span>
      </div>

      {/* Summary line */}
      <div className="text-xs text-muted">{data.summary}</div>

      {/* 3-column grid */}
      <div className="flex gap-2 divide-x divide-card-border">
        <TimeframeColumn tf={data['15m']} label="15m" />
        <TimeframeColumn tf={data['1h']} label="1h" />
        <TimeframeColumn tf={data['4h']} label="4h" />
      </div>
    </div>
  )
}
