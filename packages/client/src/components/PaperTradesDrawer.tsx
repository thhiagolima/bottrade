import { useState, useEffect, useCallback } from 'react'
import type { Trade, TradeStats } from '@bottrade/shared'
import { useStore } from '../store/useStore'
import { emitGetPaperTrades, emitGetPaperStats, emitGetTradeStats, emitAnalyzePair } from '../hooks/useSocket'
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
  const header = 'Symbol,Direction,Entry Price,Exit Price,Stop Loss,Take Profit,Result,P&L %,Exit Reason,Score,Status,Opened At,Closed At'
  const rows = trades.map(t =>
    `${t.symbol},${t.direction},${t.entryPrice},${t.exitPrice ?? ''},${t.stopLoss},${t.takeProfit},${t.result ?? ''},${t.pnlPercent ?? ''},${t.exitReason ?? ''},${t.confluenceScore},${t.status},${t.openedAt},${t.closedAt ?? ''}`
  )
  downloadFile([header, ...rows].join('\n'), `bottrade-paper-trades-${Date.now()}.csv`, 'text/csv')
}

function exportJSON(trades: Trade[]) {
  downloadFile(JSON.stringify(trades, null, 2), `bottrade-paper-trades-${Date.now()}.json`, 'application/json')
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

const exitReasonLabels: Record<string, string> = {
  TP: 'TP',
  SL: 'SL',
  SCORE_EXIT: 'Score',
  TIME_STOP: 'Tempo',
  TRAILING_SL: 'Trail',
}

export default function PaperTradesDrawer() {
  const togglePaperTrades = useStore((state) => state.togglePaperTrades)
  const selectPair = useStore((state) => state.selectPair)
  const setTempAnalysis = useStore((state) => state.setTempAnalysis)
  const favorites = useStore((state) => state.favorites)
  const allPairs = useStore((state) => state.allPairs)

  const navigateToPair = (symbol: string) => {
    if (favorites.includes(symbol)) {
      selectPair(symbol)
      togglePaperTrades()
    } else {
      emitAnalyzePair(symbol, (analysis) => {
        if (analysis) {
          setTempAnalysis(analysis)
          selectPair(symbol)
          togglePaperTrades()
        }
      })
    }
  }

  const [trades, setTrades] = useState<Trade[]>([])
  const [total, setTotal] = useState(0)
  const [paperStats, setPaperStats] = useState<TradeStats | null>(null)
  const [favStats, setFavStats] = useState<TradeStats | null>(null)
  const [filterSymbol, setFilterSymbol] = useState<string>('')
  const [page, setPage] = useState(0)
  const [symbols, setSymbols] = useState<string[]>([])

  const loadData = useCallback(() => {
    const symbol = filterSymbol || undefined
    const offset = page * PAGE_SIZE

    emitGetPaperTrades({ symbol, limit: PAGE_SIZE, offset }, (data) => {
      setTrades(data.trades)
      setTotal(data.total)
      // Extract unique symbols for filter dropdown
      const uniqueSymbols = [...new Set(data.trades.map(t => t.symbol))]
      setSymbols(prev => {
        const merged = [...new Set([...prev, ...uniqueSymbols])]
        return merged.sort()
      })
    })

    emitGetPaperStats({ symbol }, (data) => {
      setPaperStats(data)
    })

    // Load fav stats for comparison
    emitGetTradeStats({ symbol }, (data) => {
      setFavStats(data)
    })
  }, [filterSymbol, page])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Also load all symbols on mount
  useEffect(() => {
    emitGetPaperTrades({ limit: 100, offset: 0 }, (data) => {
      const uniqueSymbols = [...new Set(data.trades.map(t => t.symbol))]
      setSymbols(uniqueSymbols.sort())
    })
  }, [])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={togglePaperTrades}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 z-50 h-full w-full md:w-[680px] max-w-full bg-card border-l border-card-border overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-card-border">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold">Paper Trades</h2>
            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-purple-500/20 text-purple-400 border border-purple-500/30 uppercase tracking-wider">
              Simulados
            </span>
          </div>
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
              onClick={togglePaperTrades}
              className="p-1 rounded hover:bg-card-border transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Open Paper Trades */}
        {(() => {
          const openTrades = trades.filter(t => t.status === 'OPEN')
          if (openTrades.length === 0) return null
          return (
            <div className="p-4 border-b border-card-border">
              <div className="text-xs text-muted font-bold mb-2 uppercase tracking-wider">
                Paper Trades Abertos ({openTrades.length})
              </div>
              <div className="space-y-2">
                {openTrades.map((t) => {
                  const currentPrice = allPairs[t.symbol]?.price ?? 0
                  const pnl = currentPrice > 0
                    ? t.direction === 'LONG'
                      ? ((currentPrice - t.entryPrice) / t.entryPrice) * 100
                      : ((t.entryPrice - currentPrice) / t.entryPrice) * 100
                    : 0
                  const pnlPositive = pnl >= 0
                  return (
                    <div key={t.id} className="bg-bg rounded p-2 border border-purple-500/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button onClick={() => navigateToPair(t.symbol)} className="font-bold text-xs text-purple-400 hover:underline">{t.symbol}</button>
                          <span className={`px-1 py-0.5 text-[10px] font-bold rounded ${t.direction === 'LONG' ? 'bg-bull/20 text-bull' : 'bg-bear/20 text-bear'}`}>
                            {t.direction}
                          </span>
                          {t.partialClosed && <span className="text-[10px] text-warn">PT</span>}
                        </div>
                        <span className={`font-mono-num font-bold text-sm ${pnlPositive ? 'text-bull' : 'text-bear'}`}>
                          {pnlPositive ? '+' : ''}{pnl.toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1 text-[10px] text-muted font-mono-num">
                        <span>Entry: {formatPrice(t.entryPrice)}</span>
                        <span>Atual: <span className="text-white">{currentPrice > 0 ? formatPrice(currentPrice) : '-'}</span></span>
                        <span>SL: <span className="text-bear">{formatPrice(t.stopLoss)}</span></span>
                        <span>TP: <span className="text-bull">{formatPrice(t.takeProfit)}</span></span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* Comparison: Favoritos vs Paper */}
        {(paperStats || favStats) && (
          <div className="p-4 border-b border-card-border">
            <div className="text-xs text-muted font-bold mb-2 uppercase tracking-wider">Favoritos vs Paper</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-bg rounded p-3 border border-card-border/50">
                <div className="text-[10px] text-muted uppercase tracking-wider mb-2 text-center">Favoritos (Real)</div>
                {favStats ? (
                  <div className="space-y-1 text-center">
                    <div className={`text-lg font-bold font-mono-num ${favStats.winRate >= 50 ? 'text-bull' : 'text-bear'}`}>
                      {favStats.winRate.toFixed(1)}%
                    </div>
                    <div className="text-[10px] text-muted">{favStats.totalTrades} trades</div>
                    <div className="flex justify-center gap-2 text-[10px]">
                      <span className="text-bull">{favStats.wins}W</span>
                      <span className="text-bear">{favStats.losses}L</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-muted text-xs">--</div>
                )}
              </div>
              <div className="bg-bg rounded p-3 border border-purple-500/20">
                <div className="text-[10px] text-purple-400 uppercase tracking-wider mb-2 text-center">Paper (Simulado)</div>
                {paperStats ? (
                  <div className="space-y-1 text-center">
                    <div className={`text-lg font-bold font-mono-num ${paperStats.winRate >= 50 ? 'text-bull' : 'text-bear'}`}>
                      {paperStats.winRate.toFixed(1)}%
                    </div>
                    <div className="text-[10px] text-muted">{paperStats.totalTrades} trades</div>
                    <div className="flex justify-center gap-2 text-[10px]">
                      <span className="text-bull">{paperStats.wins}W</span>
                      <span className="text-bear">{paperStats.losses}L</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-muted text-xs">--</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Stats Section */}
        {paperStats && (
          <div className="p-4 border-b border-card-border space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <StatBox label="Win Rate" value={`${paperStats.winRate.toFixed(1)}%`} color={paperStats.winRate >= 50 ? 'text-bull' : 'text-bear'} />
              <StatBox label="Total" value={String(paperStats.totalTrades)} color="text-white" />
              <StatBox label="Wins" value={String(paperStats.wins)} color="text-bull" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <StatBox label="Losses" value={String(paperStats.losses)} color="text-bear" />
              <StatBox label="Avg Win" value={`${paperStats.avgWinPnl.toFixed(2)}%`} color="text-bull" />
              <StatBox label="Avg Loss" value={`${paperStats.avgLossPnl.toFixed(2)}%`} color="text-bear" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatBox label="Melhor" value={`${paperStats.bestTrade.toFixed(2)}%`} color="text-bull" />
              <StatBox label="Pior" value={`${paperStats.worstTrade.toFixed(2)}%`} color="text-bear" />
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
            {symbols.map((sym) => (
              <option key={sym} value={sym}>{sym}</option>
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
                <th className="px-3 py-2 text-center">Motivo</th>
                <th className="px-3 py-2 text-right">Abriu</th>
                <th className="px-3 py-2 text-right">Fechou</th>
              </tr>
            </thead>
            <tbody>
              {trades.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-muted">
                    Nenhum paper trade encontrado
                  </td>
                </tr>
              ) : (
                trades.map((trade) => (
                  <tr key={trade.id} className="border-b border-card-border/50 hover:bg-purple-500/5">
                    <td className="px-3 py-2 font-mono-num">
                      <div className="flex items-center gap-1">
                        <button onClick={() => navigateToPair(trade.symbol)} className="text-purple-400 hover:underline cursor-pointer">{trade.symbol}</button>
                        <span className="px-1 py-0.5 text-[10px] font-bold rounded bg-purple-500/15 text-purple-400">P</span>
                      </div>
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
                    <td className="px-3 py-2 text-center text-muted text-[10px]">
                      {trade.exitReason ? (exitReasonLabels[trade.exitReason] ?? trade.exitReason) : '-'}
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
