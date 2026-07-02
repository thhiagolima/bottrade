import { useState, useEffect, useCallback } from 'react'
import type { Trade, TradeStats } from '@bottrade/shared'
import { useStore } from '../store/useStore'
import { emitGetTradeHistory, emitGetTradeStats } from '../hooks/useSocket'
import { formatPrice, formatDateTime } from '../utils/format'

const resultColors: Record<string, string> = {
  WIN: 'text-bull',
  LOSS: 'text-bear',
}

const directionColors: Record<string, string> = {
  LONG: 'text-bull',
  SHORT: 'text-bear',
}

export default function PairTradeHistory({ symbol }: { symbol: string }) {
  const navigateTo = useStore((s) => s.navigateTo)
  const [trades, setTrades] = useState<Trade[]>([])
  const [stats, setStats] = useState<TradeStats | null>(null)

  const loadData = useCallback(() => {
    emitGetTradeHistory({ symbol, limit: 5 }, (data) => {
      setTrades(data.trades)
    })
    emitGetTradeStats({ symbol }, (data) => {
      setStats(data)
    })
  }, [symbol])

  useEffect(() => {
    loadData()
  }, [loadData])

  return (
    <div className="bg-card border border-card-border rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-card-border flex items-center justify-between">
        <h4 className="text-xs font-bold text-muted">HISTORICO DE TRADES</h4>
        {stats && stats.totalTrades > 0 && (
          <span className="text-xs text-muted">
            Win Rate: <span className="font-bold text-white font-mono-num">{stats.winRate.toFixed(0)}%</span>{' '}
            ({stats.wins}/{stats.totalTrades})
          </span>
        )}
      </div>

      {trades.length === 0 ? (
        <div className="px-3 py-4 text-xs text-muted text-center">
          Sem historico de trades
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted border-b border-card-border/50">
                <th className="px-3 py-1.5 text-left">Dir.</th>
                <th className="px-3 py-1.5 text-right">Entry</th>
                <th className="px-3 py-1.5 text-right">Partial TP</th>
                <th className="px-3 py-1.5 text-right">Exit</th>
                <th className="px-3 py-1.5 text-center">Resultado</th>
                <th className="px-3 py-1.5 text-right">P&L%</th>
                <th className="px-3 py-1.5 text-right">Abriu</th>
                <th className="px-3 py-1.5 text-right">Fechou</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => (
                <tr key={trade.id} className="border-b border-card-border/30 hover:bg-card-border/20">
                  <td className={`px-3 py-1.5 font-bold ${directionColors[trade.direction]}`}>
                    {trade.direction}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono-num">
                    ${formatPrice(trade.entryPrice)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono-num">
                    {trade.partialTpPrice != null ? (
                      <span className="text-bull">
                        ${formatPrice(trade.partialTpPrice)}
                        <span className="text-[10px] ml-0.5">(+{(trade.partialTpPnl ?? 0).toFixed(2)}%)</span>
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono-num">
                    {trade.exitPrice != null ? `$${formatPrice(trade.exitPrice)}` : '-'}
                  </td>
                  <td className={`px-3 py-1.5 text-center font-bold ${trade.result ? resultColors[trade.result] : 'text-muted'}`}>
                    {trade.result ?? 'OPEN'}
                  </td>
                  <td className={`px-3 py-1.5 text-right font-mono-num font-bold ${trade.pnlPercent != null ? (trade.pnlPercent >= 0 ? 'text-bull' : 'text-bear') : 'text-muted'}`}>
                    {trade.pnlPercent != null ? `${trade.pnlPercent >= 0 ? '+' : ''}${trade.pnlPercent.toFixed(2)}%` : '-'}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono-num text-muted text-[10px] whitespace-nowrap">
                    {formatDateTime(trade.openedAt)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono-num text-muted text-[10px] whitespace-nowrap">
                    {formatDateTime(trade.closedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="px-3 py-1.5 border-t border-card-border">
        <button
          onClick={() => navigateTo('signals')}
          className="text-xs text-muted hover:text-white hover:underline transition-colors cursor-pointer"
        >
          Ver historico completo
        </button>
      </div>
    </div>
  )
}
