import type { RiskManagement } from '@bottrade/shared'
import { formatPrice } from '../utils/format'

function RiskMetric({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string
  value: string
  detail?: string
  tone?: 'bull' | 'bear' | 'accent' | 'neutral'
}) {
  const toneClass =
    tone === 'bull' ? 'text-bull' :
    tone === 'bear' ? 'text-bear' :
    tone === 'accent' ? 'text-accent' : 'text-white'

  return (
    <div className="rounded-lg border border-card-border/75 bg-bg/25 px-3 py-2.5">
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-dim">{label}</div>
      <div className={`mt-1 break-words font-mono-num text-sm font-bold ${toneClass}`}>{value}</div>
      {detail && <div className="mt-1 text-[11px] leading-snug text-muted">{detail}</div>}
    </div>
  )
}

export default function RiskPanel({ risk }: { risk: RiskManagement | null }) {
  if (!risk) {
    return (
      <div className="border-t border-card-border px-3 py-4" data-tour="risk-panel">
        <div className="rounded-lg border border-dashed border-card-border bg-bg/20 px-3 py-4 text-center">
          <p className="text-xs font-semibold text-muted">Sem sugestao de trade para o sinal atual.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="border-t border-card-border px-3 py-3" data-tour="risk-panel">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Gestao de risco</h4>
          <p className="mt-1 text-[11px] text-dim">Sugestao calculada para o setup atual do par.</p>
        </div>
        <span className="rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1 font-mono-num text-xs font-bold text-accent">
          R:R {risk.riskRewardRatio.toFixed(2)}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <RiskMetric label="Entry" value={formatPrice(risk.entry)} />
        <RiskMetric
          label="Stop loss"
          value={formatPrice(risk.stopLoss)}
          tone="bear"
          detail={`${(risk.stopLossPercent ?? 0).toFixed(2)}%`}
        />
        <RiskMetric
          label="Take profit"
          value={formatPrice(risk.takeProfit)}
          tone="bull"
          detail={`+${(risk.takeProfitPercent ?? 0).toFixed(2)}%`}
        />
        <RiskMetric label="Alavancagem" value={`${risk.leverage}x`} tone="accent" />
        <RiskMetric label="Position" value={`${risk.positionSize.toFixed(2)} USDT`} />
        <RiskMetric label="Margin" value={`${risk.margin.toFixed(2)} USDT`} />
      </div>
    </div>
  )
}
