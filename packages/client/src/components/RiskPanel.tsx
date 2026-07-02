import type { RiskManagement } from '@bottrade/shared'
import { formatPrice } from '../utils/format'

export default function RiskPanel({ risk }: { risk: RiskManagement | null }) {
  if (!risk) {
    return (
      <div className="border-t border-card-border px-3 py-2">
        <p className="text-xs text-dim">Sem sugestao de trade</p>
      </div>
    )
  }

  return (
    <div className="border-t border-card-border px-3 py-2 text-xs" data-tour="risk-panel">
      <div className="space-y-0.5">
        <div className="flex items-center justify-between">
          <span className="text-dim">Entry</span>
          <span className="font-mono-num">{formatPrice(risk.entry)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-dim">SL</span>
          <span className="font-mono-num text-bear">
            {formatPrice(risk.stopLoss)} ({(risk.stopLossPercent ?? 0).toFixed(2)}%)
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-dim">TP</span>
          <span className="font-mono-num text-bull">
            {formatPrice(risk.takeProfit)} (+{(risk.takeProfitPercent ?? 0).toFixed(2)}%)
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-dim">R:R</span>
          <span className="font-mono-num font-bold text-accent">{risk.riskRewardRatio.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-dim">Position</span>
          <span className="font-mono-num">{risk.positionSize.toFixed(2)} USDT</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-dim">Margin</span>
          <span className="font-mono-num">{risk.margin.toFixed(2)} USDT</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-dim">Leverage</span>
          <span className="font-mono-num font-bold">{risk.leverage}x</span>
        </div>
      </div>
    </div>
  )
}
