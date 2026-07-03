import { useCallback, useEffect, useState } from 'react'
import type { Trade, TradeStats } from '@bottrade/shared'
import { useStore } from '../store/useStore'
import { emitGetTradeHistory, emitGetTradeStats } from '../hooks/useSocket'
import { formatDateTime, formatPrice } from '../utils/format'

const resultColors: Record<string, string> = {
  WIN: 'text-bull bg-bull/10 border-bull/20',
  LOSS: 'text-bear bg-bear/10 border-bear/20',
}

const directionColors: Record<string, string> = {
  LONG: 'text-bull',
  SHORT: 'text-bear',
}

function TradeMobileCard({ trade }: { trade: Trade }) {
  const pnlClass = trade.pnlPercent != null ? (trade.pnlPercent >= 0 ? 'text-bull' : 'text-bear') : 'text-muted'
  const resultClass = trade.result ? resultColors[trade.result] : 'text-muted bg-bg/30 border-card-border'

  return (
    <div className="rounded-lg border border-card-border/75 bg-bg/20 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={`text-sm font-black ${directionColors[trade.direction]}`}>{trade.direction}</div>
          <div className="mt-1 font-mono-num text-xs text-muted">Entry ${formatPrice(trade.entryPrice)}</div>
        </div>
        <span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${resultClass}`}>
          {trade.result ?? 'OPEN'}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-dim">Partial TP</div>
          <div className="font-mono-num text-bull">
            {trade.partialTpPrice != null ? `$${formatPrice(trade.partialTpPrice)}` : '-'}
          </div>
        </div>
        <div>
          <div className="text-dim">Exit</div>
          <div className="font-mono-num text-white">{trade.exitPrice != null ? `$${formatPrice(trade.exitPrice)}` : '-'}</div>
        </div>
        <div>
          <div className="text-dim">P&L</div>
          <div className={`font-mono-num font-bold ${pnlClass}`}>
            {trade.pnlPercent != null ? `${trade.pnlPercent >= 0 ? '+' : ''}${trade.pnlPercent.toFixed(2)}%` : '-'}
          </div>
        </div>
        <div>
          <div className="text-dim">Abriu</div>
          <div className="font-mono-num text-[10px] text-muted">{formatDateTime(trade.openedAt)}</div>
        </div>
      </div>
    </div>
  )
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
    <div className="overflow-hidden rounded-xl border border-card-border bg-card">
      <div className="flex flex-col gap-2 border-b border-card-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Historico de trades</h4>
          <p className="mt-1 text-[11px] text-dim">Ultimas operacoes registradas para {symbol}.</p>
        </div>
        {stats && stats.totalTrades > 0 && (
          <div className="flex flex-wrap gap-2 text-xs text-muted">
            <span className="rounded-full border border-card-border bg-bg/30 px-2.5 py-1">
              Win rate <span className="font-mono-num font-bold text-white">{stats.winRate.toFixed(0)}%</span>
            </span>
            <span className="rounded-full border border-card-border bg-bg/30 px-2.5 py-1">
              {stats.wins}/{stats.totalTrades} wins
            </span>
          </div>
        )}
      </div>

      {trades.length === 0 ? (
        <div className="px-3 py-8 text-center text-sm text-muted">
          Sem historico de trades
        </div>
      ) : (
        <>
          <div className="space-y-2 p-3 md:hidden">
            {trades.map((trade) => <TradeMobileCard key={trade.id} trade={trade} />)}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-card-border/60 bg-bg/20 text-muted">
                  <th className="px-3 py-2 text-left">Dir.</th>
                  <th className="px-3 py-2 text-right">Entry</th>
                  <th className="px-3 py-2 text-right">Partial TP</th>
                  <th className="px-3 py-2 text-right">Exit</th>
                  <th className="px-3 py-2 text-center">Resultado</th>
                  <th className="px-3 py-2 text-right">P&L%</th>
                  <th className="px-3 py-2 text-right">Abriu</th>
                  <th className="px-3 py-2 text-right">Fechou</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade) => (
                  <tr key={trade.id} className="border-b border-card-border/30 hover:bg-bg/20">
                    <td className={`px-3 py-2 font-bold ${directionColors[trade.direction]}`}>
                      {trade.direction}
                    </td>
                    <td className="px-3 py-2 text-right font-mono-num">
                      ${formatPrice(trade.entryPrice)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono-num">
                      {trade.partialTpPrice != null ? (
                        <span className="text-bull">
                          ${formatPrice(trade.partialTpPrice)}
                          <span className="ml-1 text-[10px]">(+{(trade.partialTpPnl ?? 0).toFixed(2)}%)</span>
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono-num">
                      {trade.exitPrice != null ? `$${formatPrice(trade.exitPrice)}` : '-'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${trade.result ? resultColors[trade.result] : 'border-card-border bg-bg/30 text-muted'}`}>
                        {trade.result ?? 'OPEN'}
                      </span>
                    </td>
                    <td className={`px-3 py-2 text-right font-mono-num font-bold ${trade.pnlPercent != null ? (trade.pnlPercent >= 0 ? 'text-bull' : 'text-bear') : 'text-muted'}`}>
                      {trade.pnlPercent != null ? `${trade.pnlPercent >= 0 ? '+' : ''}${trade.pnlPercent.toFixed(2)}%` : '-'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono-num text-[10px] text-muted">
                      {formatDateTime(trade.openedAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono-num text-[10px] text-muted">
                      {formatDateTime(trade.closedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="border-t border-card-border px-3 py-2">
        <button
          onClick={() => navigateTo('signals')}
          className="cursor-pointer text-xs font-semibold text-accent transition-colors hover:text-white hover:underline"
        >
          Ver historico completo
        </button>
      </div>
    </div>
  )
}
