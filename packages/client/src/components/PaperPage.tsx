import { useCallback, useEffect, useState } from 'react'
import type { Trade, TradeStats } from '@bottrade/shared'
import { useStore } from '../store/useStore'
import { emitAnalyzePair, emitGetPaperStats, emitGetPaperTrades, emitGetTradeStats } from '../hooks/useSocket'
import { formatDateTime, formatPrice } from '../utils/format'

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
const resultBadgeColors: Record<string, string> = {
  WIN: 'border-bull/25 bg-bull/10 text-bull',
  LOSS: 'border-bear/25 bg-bear/10 text-bear',
}
const directionColors: Record<string, string> = { LONG: 'text-bull', SHORT: 'text-bear' }
const exitReasonLabels: Record<string, string> = { TP: 'TP', SL: 'SL', SCORE_EXIT: 'Score', TIME_STOP: 'Tempo', TRAILING_SL: 'Trail' }

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-card-border/75 bg-bg/25 px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-dim">{label}</div>
      <div className={`mt-1 font-mono-num text-lg font-black ${color}`}>{value}</div>
    </div>
  )
}

function SummaryCard({ title, label, stats, accent }: { title: string; label: string; stats: TradeStats | null; accent: 'default' | 'paper' }) {
  const borderClass = accent === 'paper' ? 'border-accent/30' : 'border-card-border/75'
  const titleClass = accent === 'paper' ? 'text-accent' : 'text-muted'

  return (
    <div className={`rounded-xl border ${borderClass} bg-card/80 p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={`text-[10px] font-bold uppercase tracking-[0.08em] ${titleClass}`}>{title}</div>
          <div className="mt-1 text-xs text-dim">{label}</div>
        </div>
        {accent === 'paper' && <span className="rounded-full bg-accent/10 px-2 py-1 text-[10px] font-bold text-accent">SIMULADO</span>}
      </div>
      {stats ? (
        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <div className={`font-mono-num text-3xl font-black ${stats.winRate >= 50 ? 'text-bull' : 'text-bear'}`}>{stats.winRate.toFixed(1)}%</div>
            <div className="mt-1 text-[11px] text-muted">Win rate</div>
          </div>
          <div className="text-right">
            <div className="font-mono-num text-sm font-bold text-white">{stats.totalTrades}</div>
            <div className="mt-1 text-[11px] text-muted">trades</div>
          </div>
        </div>
      ) : (
        <div className="mt-4 text-sm text-muted">Sem dados</div>
      )}
    </div>
  )
}

function TradeMobileCard({
  trade,
  currentPrice,
  displayPnl,
  onSelectPair,
}: {
  trade: Trade
  currentPrice: number
  displayPnl: number | null | undefined
  onSelectPair: (symbol: string) => void
}) {
  const isOpen = trade.status === 'OPEN'
  const pnlClass = displayPnl != null ? (displayPnl >= 0 ? 'text-bull' : 'text-bear') : 'text-muted'
  const resultClass = isOpen
    ? 'border-accent/25 bg-accent/10 text-accent'
    : trade.result
      ? resultBadgeColors[trade.result]
      : 'border-card-border bg-bg/30 text-muted'

  return (
    <div className={`rounded-xl border bg-card/80 p-3 ${isOpen ? 'border-accent/35' : 'border-card-border/75'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <button onClick={() => onSelectPair(trade.symbol)} className="truncate font-mono-num text-sm font-black text-accent hover:underline">
            {trade.symbol}
          </button>
          <div className={`mt-1 text-xs font-bold ${directionColors[trade.direction]}`}>{trade.direction}</div>
        </div>
        <span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${resultClass}`}>
          {isOpen ? 'ABERTO' : trade.result ?? '-'}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-dim">Entry</div>
          <div className="font-mono-num text-white">${formatPrice(trade.entryPrice)}</div>
        </div>
        <div>
          <div className="text-dim">Atual</div>
          <div className="font-mono-num text-white">{isOpen && currentPrice > 0 ? `$${formatPrice(currentPrice)}` : '-'}</div>
        </div>
        <div>
          <div className="text-dim">Exit</div>
          <div className="font-mono-num text-white">{trade.exitPrice != null ? `$${formatPrice(trade.exitPrice)}` : '-'}</div>
        </div>
        <div>
          <div className="text-dim">P&L</div>
          <div className={`font-mono-num font-black ${pnlClass}`}>
            {displayPnl != null ? `${displayPnl >= 0 ? '+' : ''}${displayPnl.toFixed(2)}%` : '-'}
          </div>
        </div>
        <div>
          <div className="text-dim">Motivo</div>
          <div className="text-muted">{trade.exitReason ? (exitReasonLabels[trade.exitReason] ?? trade.exitReason) : '-'}</div>
        </div>
        <div>
          <div className="text-dim">Abriu</div>
          <div className="font-mono-num text-[10px] text-muted">{formatDateTime(trade.openedAt)}</div>
        </div>
      </div>
    </div>
  )
}

export default function PaperPage() {
  const selectPair = useStore((s) => s.selectPair)
  const setTempAnalysis = useStore((s) => s.setTempAnalysis)
  const favorites = useStore((s) => s.favorites)
  const allPairs = useStore((s) => s.allPairs)
  const navigateTo = useStore((s) => s.navigateTo)

  const navigateToPair = (symbol: string) => {
    if (favorites.includes(symbol)) {
      selectPair(symbol)
      navigateTo('trade')
    } else {
      emitAnalyzePair(symbol, (analysis) => {
        if (analysis) {
          setTempAnalysis(analysis)
          selectPair(symbol)
          navigateTo('trade')
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
  const sortedTrades = [...trades.filter(t => t.status === 'OPEN'), ...trades.filter(t => t.status !== 'OPEN')]

  const getLivePnl = (trade: Trade) => {
    const isOpen = trade.status === 'OPEN'
    const currentPrice = isOpen ? (allPairs[trade.symbol]?.price ?? 0) : 0
    if (!isOpen || currentPrice <= 0) return { currentPrice, displayPnl: trade.pnlPercent }
    const livePnl = trade.direction === 'LONG'
      ? ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100
      : ((trade.entryPrice - currentPrice) / trade.entryPrice) * 100
    return { currentPrice, displayPnl: livePnl }
  }

  return (
    <div className="h-full flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(67,233,178,0.07),transparent_30%),var(--color-bg)] p-3 md:p-5">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex flex-col gap-3 rounded-xl border border-card-border bg-card/90 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.18)] md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-black text-white">Paper trades</h2>
              <span className="rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-accent">Simulados</span>
            </div>
            <p className="mt-1 text-sm text-muted">Acompanhe entradas simuladas apenas dos pares monitorados.</p>
          </div>
          <button
            onClick={() => downloadFile(JSON.stringify(trades, null, 2), `bottrade-paper-${Date.now()}.json`, 'application/json')}
            disabled={trades.length === 0}
            className="w-full rounded-lg border border-card-border bg-bg/35 px-3 py-2 text-xs font-bold text-muted transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-30 md:w-auto"
          >
            Exportar JSON
          </button>
        </div>

        {loading && trades.length === 0 && (
          <div className="rounded-xl border border-card-border bg-card/90 px-4 py-12 text-center text-muted">Carregando...</div>
        )}

        {(paperStats || favStats) && (
          <div className="grid gap-3 md:grid-cols-2">
            <SummaryCard title="Favoritos" label="Trades reais dos pares monitorados" stats={favStats} accent="default" />
            <SummaryCard title="Paper" label="Performance simulada do paper trade" stats={paperStats} accent="paper" />
          </div>
        )}

        {paperStats && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
            <StatBox label="Win Rate" value={`${paperStats.winRate.toFixed(1)}%`} color={paperStats.winRate >= 50 ? 'text-bull' : 'text-bear'} />
            <StatBox label="Total" value={String(paperStats.totalTrades)} color="text-white" />
            <StatBox label="Wins" value={String(paperStats.wins)} color="text-bull" />
            <StatBox label="Losses" value={String(paperStats.losses)} color="text-bear" />
            <StatBox label="Avg Win" value={`${paperStats.avgWinPnl.toFixed(2)}%`} color="text-bull" />
            <StatBox label="Avg Loss" value={`${paperStats.avgLossPnl.toFixed(2)}%`} color="text-bear" />
          </div>
        )}

        <div className="rounded-xl border border-card-border bg-card/90">
          <div className="flex flex-col gap-3 border-b border-card-border p-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Historico paper</h3>
              <p className="mt-1 text-[11px] text-dim">{total} trades encontrados</p>
            </div>
            <select
              value={filterSymbol}
              onChange={(e) => { setFilterSymbol(e.target.value); setPage(0) }}
              className="w-full rounded-lg border border-card-border bg-bg px-3 py-2 text-xs text-white outline-none focus:border-accent md:max-w-xs"
            >
              <option value="">Todos os pares</option>
              {symbols.map((sym) => <option key={sym} value={sym}>{sym}</option>)}
            </select>
          </div>

          <div className="space-y-2 p-3 md:hidden">
            {sortedTrades.length === 0 ? (
              <div className="py-8 text-center text-muted">Nenhum paper trade encontrado</div>
            ) : sortedTrades.map((trade) => {
              const { currentPrice, displayPnl } = getLivePnl(trade)
              return (
                <TradeMobileCard
                  key={trade.id}
                  trade={trade}
                  currentPrice={currentPrice}
                  displayPnl={displayPnl}
                  onSelectPair={navigateToPair}
                />
              )
            })}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th className="text-left">Par</th>
                  <th className="text-left">Dir.</th>
                  <th className="text-right">Entry</th>
                  <th className="text-right">Atual</th>
                  <th className="text-right">Exit</th>
                  <th className="text-center">Status</th>
                  <th className="text-right">P&L%</th>
                  <th className="text-center">Motivo</th>
                  <th className="text-right">Abriu</th>
                </tr>
              </thead>
              <tbody>
                {sortedTrades.length === 0 ? (
                  <tr><td colSpan={9} className="px-3 py-8 text-center text-muted">Nenhum paper trade encontrado</td></tr>
                ) : sortedTrades.map((trade) => {
                  const isOpen = trade.status === 'OPEN'
                  const { currentPrice, displayPnl } = getLivePnl(trade)
                  return (
                    <tr key={trade.id} className={isOpen ? 'border-l-2 border-accent' : ''}>
                      <td className="font-mono-num">
                        <button onClick={() => navigateToPair(trade.symbol)} className="text-accent hover:underline">{trade.symbol}</button>
                      </td>
                      <td className={`font-bold ${directionColors[trade.direction]}`}>{trade.direction}</td>
                      <td className="whitespace-nowrap text-right font-mono-num">${formatPrice(trade.entryPrice)}</td>
                      <td className="whitespace-nowrap text-right font-mono-num">
                        {isOpen && currentPrice > 0 ? <span className="text-white">${formatPrice(currentPrice)}</span> : <span className="text-muted">-</span>}
                      </td>
                      <td className="whitespace-nowrap text-right font-mono-num">{trade.exitPrice != null ? `$${formatPrice(trade.exitPrice)}` : '-'}</td>
                      <td className="whitespace-nowrap text-center font-bold">
                        {isOpen ? (
                          <span className="inline-flex items-center gap-1 text-accent">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                            ABERTO
                          </span>
                        ) : (
                          <span className={trade.result ? resultColors[trade.result] : 'text-muted'}>{trade.result ?? '-'}</span>
                        )}
                      </td>
                      <td className={`whitespace-nowrap text-right font-mono-num font-bold ${displayPnl != null ? (displayPnl >= 0 ? 'text-bull' : 'text-bear') : 'text-muted'}`}>
                        {displayPnl != null ? `${displayPnl >= 0 ? '+' : ''}${displayPnl.toFixed(2)}%` : '-'}
                      </td>
                      <td className="whitespace-nowrap text-center text-[10px] text-muted">{trade.exitReason ? (exitReasonLabels[trade.exitReason] ?? trade.exitReason) : '-'}</td>
                      <td className="whitespace-nowrap text-right font-mono-num text-[10px] text-muted">{formatDateTime(trade.openedAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex flex-col gap-2 border-t border-card-border px-3 py-3 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
              <span className="font-mono-num">Pagina {page + 1} de {totalPages} ({total} trades)</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="rounded bg-card-border px-3 py-1.5 hover:bg-card-border/80 disabled:cursor-not-allowed disabled:opacity-30">Anterior</button>
                <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="rounded bg-card-border px-3 py-1.5 hover:bg-card-border/80 disabled:cursor-not-allowed disabled:opacity-30">Proximo</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
