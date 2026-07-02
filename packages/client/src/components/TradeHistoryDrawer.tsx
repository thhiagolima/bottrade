import { useState, useEffect, useCallback } from 'react'
import type { Trade, TradeStats } from '@bottrade/shared'
import { useStore } from '../store/useStore'
import { emitGetTradeHistory, emitGetTradeStats, emitAnalyzePair } from '../hooks/useSocket'
import { formatPrice, formatDateTime } from '../utils/format'

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function exportCSV(trades: Trade[]) {
  const header = 'Symbol,Direction,Entry Price,Exit Price,Stop Loss,Take Profit,Result,P&L %,Score,Status,Opened At,Closed At'
  const rows = trades.map(t =>
    `${t.symbol},${t.direction},${t.entryPrice},${t.exitPrice ?? ''},${t.stopLoss},${t.takeProfit},${t.result ?? ''},${t.pnlPercent ?? ''},${t.confluenceScore},${t.status},${t.openedAt},${t.closedAt ?? ''}`
  )
  downloadFile([header, ...rows].join('\n'), `bottrade-trades-${Date.now()}.csv`, 'text/csv')
}

function exportJSON(trades: Trade[]) {
  downloadFile(JSON.stringify(trades, null, 2), `bottrade-trades-${Date.now()}.json`, 'application/json')
}

const PAGE_SIZE = 20

const resultColors: Record<string, string> = {
  WIN: 'text-bull',
  LOSS: 'text-bear',
}

const directionColors: Record<string, string> = {
  LONG: 'text-bull',
  SHORT: 'text-bear',
}

export default function TradeHistoryDrawer() {
  const toggleHistory = useStore((state) => state.toggleHistory)
  const selectPair = useStore((state) => state.selectPair)
  const setTempAnalysis = useStore((state) => state.setTempAnalysis)
  const favorites = useStore((state) => state.favorites)
  const settings = useStore((state) => state.settings)

  const navigateToPair = (symbol: string) => {
    if (favorites.includes(symbol)) {
      selectPair(symbol)
      toggleHistory()
    } else {
      emitAnalyzePair(symbol, (analysis) => {
        if (analysis) {
          setTempAnalysis(analysis)
          selectPair(symbol)
          toggleHistory()
        }
      })
    }
  }

  const [trades, setTrades] = useState<Trade[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<TradeStats | null>(null)
  const [filterSymbol, setFilterSymbol] = useState<string>('')
  const [page, setPage] = useState(0)

  const loadData = useCallback(() => {
    const symbol = filterSymbol || undefined
    const offset = page * PAGE_SIZE

    emitGetTradeHistory({ symbol, limit: PAGE_SIZE, offset }, (data) => {
      setTrades(data.trades)
      setTotal(data.total)
    })

    emitGetTradeStats({ symbol }, (data) => {
      setStats(data)
    })
  }, [filterSymbol, page])

  useEffect(() => {
    loadData()
  }, [loadData])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={toggleHistory}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 z-50 h-full w-full md:w-[680px] max-w-full bg-card border-l border-card-border overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-card-border">
          <h2 className="text-lg font-bold">Historico de Trades</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportCSV(trades)}
              disabled={trades.length === 0}
              className="px-2 py-1 text-[10px] font-bold text-muted hover:text-white bg-card-border/50 rounded transition-colors disabled:opacity-30"
              title="Exportar CSV"
            >
              CSV
            </button>
            <button
              onClick={() => exportJSON(trades)}
              disabled={trades.length === 0}
              className="px-2 py-1 text-[10px] font-bold text-muted hover:text-white bg-card-border/50 rounded transition-colors disabled:opacity-30"
              title="Exportar JSON"
            >
              JSON
            </button>
            <button
              onClick={toggleHistory}
              className="p-1 rounded hover:bg-card-border transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Stats Section */}
        {stats && (
          <div className="p-4 border-b border-card-border space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <StatBox label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} color={stats.winRate >= 50 ? 'text-bull' : 'text-bear'} />
              <StatBox label="Total" value={String(stats.totalTrades)} color="text-white" />
              <StatBox label="Wins" value={String(stats.wins)} color="text-bull" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <StatBox label="Losses" value={String(stats.losses)} color="text-bear" />
              <StatBox label="Avg Win" value={`${stats.avgWinPnl.toFixed(2)}%`} color="text-bull" />
              <StatBox label="Avg Loss" value={`${stats.avgLossPnl.toFixed(2)}%`} color="text-bear" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatBox label="Melhor" value={`${stats.bestTrade.toFixed(2)}%`} color="text-bull" />
              <StatBox label="Pior" value={`${stats.worstTrade.toFixed(2)}%`} color="text-bear" />
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="p-4 border-b border-card-border">
          <select
            value={filterSymbol}
            onChange={(e) => { setFilterSymbol(e.target.value); setPage(0) }}
            className="w-full px-3 py-2 bg-bg border border-card-border rounded text-white text-sm"
          >
            <option value="">Todos</option>
            {settings.pairs.map((pair: string) => (
              <option key={pair} value={pair}>{pair}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted border-b border-card-border">
                <th className="px-3 py-2 text-left">Par</th>
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
              {trades.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-muted">
                    Nenhum trade encontrado
                  </td>
                </tr>
              ) : (
                trades.map((trade) => (
                  <tr key={trade.id} className="border-b border-card-border/50 hover:bg-card-border/30">
                    <td className="px-3 py-2 font-mono-num">
                      <button onClick={() => navigateToPair(trade.symbol)} className="text-bull hover:underline cursor-pointer">{trade.symbol}</button>
                    </td>
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
                          <span className="text-[10px] ml-0.5">(+{(trade.partialTpPnl ?? 0).toFixed(2)}%)</span>
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono-num">
                      {trade.exitPrice != null ? `$${formatPrice(trade.exitPrice)}` : '-'}
                    </td>
                    <td className={`px-3 py-2 text-center font-bold ${trade.result ? resultColors[trade.result] : 'text-muted'}`}>
                      {trade.result ?? 'OPEN'}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono-num font-bold ${trade.pnlPercent != null ? (trade.pnlPercent >= 0 ? 'text-bull' : 'text-bear') : 'text-muted'}`}>
                      {trade.pnlPercent != null ? `${trade.pnlPercent >= 0 ? '+' : ''}${trade.pnlPercent.toFixed(2)}%` : '-'}
                    </td>
                    <td className="px-3 py-2 text-right text-muted text-[10px] font-mono-num">
                      {formatDateTime(trade.openedAt)}
                    </td>
                    <td className="px-3 py-2 text-right text-muted text-[10px] font-mono-num">
                      {formatDateTime(trade.closedAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-card-border text-xs text-muted">
            <span>
              Pagina {page + 1} de {totalPages} ({total} trades)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="px-3 py-1 rounded bg-card-border hover:bg-card-border/80 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1 rounded bg-card-border hover:bg-card-border/80 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Proximo
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-bg rounded p-2 text-center">
      <div className="text-muted text-xs">{label}</div>
      <div className={`font-bold font-mono-num text-sm ${color}`}>{value}</div>
    </div>
  )
}
