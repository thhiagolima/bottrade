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

const PAGE_SIZE = 20
const resultColors: Record<string, string> = { WIN: 'text-bull', LOSS: 'text-bear' }
const directionColors: Record<string, string> = { LONG: 'text-bull', SHORT: 'text-bear' }
const exitReasonLabels: Record<string, string> = { TP: 'TP', SL: 'SL', SCORE_EXIT: 'Score', TIME_STOP: 'Tempo', TRAILING_SL: 'Trail' }

export default function PaperPage() {
  const selectPair = useStore((s) => s.selectPair)
  const setTempAnalysis = useStore((s) => s.setTempAnalysis)
  const favorites = useStore((s) => s.favorites)
  const allPairs = useStore((s) => s.allPairs)
  const navigateTo = useStore((s) => s.navigateTo)

  const navigateToPair = (symbol: string) => {
    if (favorites.includes(symbol)) {
      selectPair(symbol)
      navigateTo('dashboard')
    } else {
      emitAnalyzePair(symbol, (analysis) => {
        if (analysis) {
          setTempAnalysis(analysis)
          selectPair(symbol)
          navigateTo('dashboard')
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
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(() => {
    setLoading(true)
    const symbol = filterSymbol || undefined
    const offset = page * PAGE_SIZE
    let pending = 3
    const done = () => { pending--; if (pending <= 0) setLoading(false) }
    emitGetPaperTrades({ symbol, limit: PAGE_SIZE, offset }, (data) => {
      setTrades(data.trades)
      setTotal(data.total)
      const uniqueSymbols = [...new Set(data.trades.map(t => t.symbol))]
      setSymbols(prev => [...new Set([...prev, ...uniqueSymbols])].sort())
      done()
    })
    emitGetPaperStats({ symbol }, (data) => { setPaperStats(data); done() })
    emitGetTradeStats({ symbol }, (data) => { setFavStats(data); done() })
  }, [filterSymbol, page])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => {
    emitGetPaperTrades({ limit: 100, offset: 0 }, (data) => {
      setSymbols([...new Set(data.trades.map(t => t.symbol))].sort())
    })
  }, [])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="h-full flex-1 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-card-border">
        <h3 className="text-xs font-bold">Paper Trades</h3>
        <span className="px-1 py-0.5 text-[10px] font-bold rounded bg-purple-500/20 text-purple-400 border border-purple-500/30 uppercase tracking-wider">Simulados</span>
        <div className="flex-1" />
        <button onClick={() => downloadFile(JSON.stringify(trades, null, 2), `bottrade-paper-${Date.now()}.json`, 'application/json')} disabled={trades.length === 0} className="px-2 py-1 text-[10px] font-bold text-muted hover:text-white bg-card-border/50 rounded transition-colors disabled:opacity-30">JSON</button>
      </div>

      {loading && trades.length === 0 && (
        <div className="text-center text-muted py-8">Carregando...</div>
      )}

      {/* Comparison: Favoritos vs Paper */}
      {(paperStats || favStats) && (
        <div className="px-3 py-2 border-b border-card-border">
          <div className="text-[11px] text-muted font-bold uppercase tracking-wider mb-1.5">Favoritos vs Paper</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-bg rounded px-3 py-2 border border-card-border/50">
              <div className="text-[10px] text-muted uppercase tracking-wider mb-1 text-center">Favoritos (Real)</div>
              {favStats ? (
                <div className="space-y-0.5 text-center">
                  <div className={`text-lg font-bold font-mono-num ${favStats.winRate >= 50 ? 'text-bull' : 'text-bear'}`}>{favStats.winRate.toFixed(1)}%</div>
                  <div className="text-[10px] text-muted font-mono-num">{favStats.totalTrades} trades</div>
                </div>
              ) : <div className="text-center text-muted text-xs">--</div>}
            </div>
            <div className="bg-bg rounded px-3 py-2 border border-purple-500/20">
              <div className="text-[10px] text-purple-400 uppercase tracking-wider mb-1 text-center">Paper (Simulado)</div>
              {paperStats ? (
                <div className="space-y-0.5 text-center">
                  <div className={`text-lg font-bold font-mono-num ${paperStats.winRate >= 50 ? 'text-bull' : 'text-bear'}`}>{paperStats.winRate.toFixed(1)}%</div>
                  <div className="text-[10px] text-muted font-mono-num">{paperStats.totalTrades} trades</div>
                </div>
              ) : <div className="text-center text-muted text-xs">--</div>}
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      {paperStats && (
        <div className="px-3 py-2 border-b border-card-border space-y-2">
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            <StatBox label="Win Rate" value={`${paperStats.winRate.toFixed(1)}%`} color={paperStats.winRate >= 50 ? 'text-bull' : 'text-bear'} />
            <StatBox label="Total" value={String(paperStats.totalTrades)} color="text-white" />
            <StatBox label="Wins" value={String(paperStats.wins)} color="text-bull" />
            <StatBox label="Losses" value={String(paperStats.losses)} color="text-bear" />
            <StatBox label="Avg Win" value={`${paperStats.avgWinPnl.toFixed(2)}%`} color="text-bull" />
            <StatBox label="Avg Loss" value={`${paperStats.avgLossPnl.toFixed(2)}%`} color="text-bear" />
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="px-3 py-2 border-b border-card-border">
        <select value={filterSymbol} onChange={(e) => { setFilterSymbol(e.target.value); setPage(0) }} className="w-full max-w-xs px-2 py-1 bg-bg border border-card-border rounded text-white text-xs">
          <option value="">Todos</option>
          {symbols.map((sym) => <option key={sym} value={sym}>{sym}</option>)}
        </select>
      </div>

      {/* Table -- open trades merged at top */}
      <div className="overflow-x-auto">
        <table className="data-table w-full">
          <thead><tr>
            <th className="text-left">Par</th><th className="text-left">Dir.</th><th className="text-right">Entry</th>
            <th className="text-right">Atual</th><th className="text-right">Exit</th><th className="text-center">Status</th><th className="text-right">P&L%</th>
            <th className="text-center">Motivo</th><th className="text-right">Abriu</th>
          </tr></thead>
          <tbody>
            {(() => {
              const openTrades = trades.filter(t => t.status === 'OPEN')
              const closedTrades = trades.filter(t => t.status !== 'OPEN')
              const sorted = [...openTrades, ...closedTrades]
              if (sorted.length === 0) {
                return <tr><td colSpan={9} className="px-3 py-8 text-center text-muted">Nenhum paper trade encontrado</td></tr>
              }
              return sorted.map((trade) => {
                const isOpen = trade.status === 'OPEN'
                const currentPrice = isOpen ? (allPairs[trade.symbol]?.price ?? 0) : 0
                const livePnl = isOpen && currentPrice > 0
                  ? (trade.direction === 'LONG' ? ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100 : ((trade.entryPrice - currentPrice) / trade.entryPrice) * 100)
                  : null
                const displayPnl = livePnl ?? trade.pnlPercent
                return (
                  <tr key={trade.id} className={isOpen ? 'border-l-2 border-purple-500' : ''}>
                    <td className="font-mono-num">
                      <button onClick={() => navigateToPair(trade.symbol)} className="text-purple-400 hover:underline">{trade.symbol}</button>
                    </td>
                    <td className={`font-bold ${directionColors[trade.direction]}`}>{trade.direction}</td>
                    <td className="text-right font-mono-num whitespace-nowrap">${formatPrice(trade.entryPrice)}</td>
                    <td className="text-right font-mono-num whitespace-nowrap">
                      {isOpen && currentPrice > 0 ? <span className="text-white">${formatPrice(currentPrice)}</span> : <span className="text-muted">-</span>}
                    </td>
                    <td className="text-right font-mono-num whitespace-nowrap">{trade.exitPrice != null ? `$${formatPrice(trade.exitPrice)}` : '-'}</td>
                    <td className="text-center font-bold whitespace-nowrap">
                      {isOpen ? (
                        <span className="inline-flex items-center gap-1 text-bull">
                          <span className="w-1.5 h-1.5 rounded-full bg-bull animate-pulse" />
                          ABERTO
                        </span>
                      ) : (
                        <span className={trade.result ? resultColors[trade.result] : 'text-muted'}>{trade.result ?? '-'}</span>
                      )}
                    </td>
                    <td className={`text-right font-mono-num font-bold whitespace-nowrap ${displayPnl != null ? (displayPnl >= 0 ? 'text-bull' : 'text-bear') : 'text-muted'}`}>
                      {displayPnl != null ? `${displayPnl >= 0 ? '+' : ''}${displayPnl.toFixed(2)}%` : '-'}
                    </td>
                    <td className="text-center text-muted text-[10px] whitespace-nowrap">{trade.exitReason ? (exitReasonLabels[trade.exitReason] ?? trade.exitReason) : '-'}</td>
                    <td className="text-right text-muted text-[10px] font-mono-num whitespace-nowrap">{formatDateTime(trade.openedAt)}</td>
                  </tr>
                )
              })
            })()}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-card-border text-xs text-muted">
          <span className="font-mono-num">Pagina {page + 1} de {totalPages} ({total} trades)</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="px-2 py-1 rounded bg-card-border hover:bg-card-border/80 disabled:opacity-30 disabled:cursor-not-allowed">Anterior</button>
            <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="px-2 py-1 rounded bg-card-border hover:bg-card-border/80 disabled:opacity-30 disabled:cursor-not-allowed">Proximo</button>
          </div>
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-bg rounded px-3 py-2 text-center">
      <div className="text-[11px] text-muted uppercase tracking-wider">{label}</div>
      <div className={`font-bold font-mono-num text-lg ${color}`}>{value}</div>
    </div>
  )
}
