import { useState, useEffect, useCallback, useMemo } from 'react'
import type { PerformanceData, Trade, TradeStats } from '@bottrade/shared'
import { useStore } from '../store/useStore'
import { emitGetPerformance, emitGetTradeHistory, emitGetTradeStats, emitAnalyzePair } from '../hooks/useSocket'
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

const HISTORY_PAGE_SIZE = 20
const resultColors: Record<string, string> = { WIN: 'text-bull', LOSS: 'text-bear' }
const directionColors: Record<string, string> = { LONG: 'text-bull', SHORT: 'text-bear' }

export default function TradesPage() {
  const settings = useStore((s) => s.settings)
  const selectPair = useStore((s) => s.selectPair)
  const setTempAnalysis = useStore((s) => s.setTempAnalysis)
  const favorites = useStore((s) => s.favorites)
  const navigateTo = useStore((s) => s.navigateTo)

  const [activeTab, setActiveTab] = useState<'performance' | 'historico' | 'exportar'>('performance')

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

  // Performance tab state
  const [data, setData] = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterSymbol, setFilterSymbol] = useState('')

  const loadPerformance = useCallback(() => {
    setLoading(true)
    const symbol = filterSymbol || undefined
    emitGetPerformance({ symbol }, (result) => {
      setData(result)
      setLoading(false)
    })
  }, [filterSymbol])

  useEffect(() => { loadPerformance() }, [loadPerformance])

  // History tab state
  const [histTrades, setHistTrades] = useState<Trade[]>([])
  const [histTotal, setHistTotal] = useState(0)
  const [histStats, setHistStats] = useState<TradeStats | null>(null)
  const [histFilter, setHistFilter] = useState('')
  const [histPage, setHistPage] = useState(0)
  const [histLoading, setHistLoading] = useState(true)

  const loadHistory = useCallback(() => {
    setHistLoading(true)
    const symbol = histFilter || undefined
    const offset = histPage * HISTORY_PAGE_SIZE
    let pending = 2
    const done = () => { pending--; if (pending <= 0) setHistLoading(false) }
    emitGetTradeHistory({ symbol, limit: HISTORY_PAGE_SIZE, offset }, (d) => {
      setHistTrades(d.trades)
      setHistTotal(d.total)
      done()
    })
    emitGetTradeStats({ symbol }, (d) => { setHistStats(d); done() })
  }, [histFilter, histPage])

  useEffect(() => { if (activeTab === 'historico') loadHistory() }, [loadHistory, activeTab])

  // Export tab state
  const [exportTrades, setExportTrades] = useState<Trade[]>([])
  const [exportLoading, setExportLoading] = useState(false)

  const loadExportData = useCallback(() => {
    setExportLoading(true)
    emitGetTradeHistory({ limit: 200, offset: 0 }, (d) => {
      setExportTrades(d.trades)
      setExportLoading(false)
    })
  }, [])

  useEffect(() => { if (activeTab === 'exportar') loadExportData() }, [loadExportData, activeTab])

  const histTotalPages = Math.ceil(histTotal / HISTORY_PAGE_SIZE)

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Tab bar */}
      <div className="flex border-b border-card-border">
        {(['performance', 'historico', 'exportar'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer relative ${
              activeTab === tab ? 'text-white' : 'text-muted hover:text-white'
            }`}
          >
            {tab === 'performance' ? 'Performance' : tab === 'historico' ? 'Historico' : 'Exportar'}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
            )}
          </button>
        ))}
      </div>

      {/* Performance Tab */}
      {activeTab === 'performance' && (
        <>
          <div className="px-3 py-2 border-b border-card-border">
            <select value={filterSymbol} onChange={(e) => setFilterSymbol(e.target.value)} className="w-full max-w-xs px-2 py-1 bg-card border border-card-border rounded text-white text-xs">
              <option value="">Todos os pares</option>
              {settings.pairs.map((pair: string) => (<option key={pair} value={pair}>{pair}</option>))}
            </select>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted">Carregando dados de performance...</div>
          ) : !data ? (
            <div className="flex items-center justify-center py-20 text-muted">Sem dados disponiveis</div>
          ) : (
            <div className="px-3 py-2 space-y-3">
              <StatsSummary data={data} />
              {data.equityCurve.length > 1 && <EquityCurve data={data.equityCurve} />}
              {data.bySymbol.length > 0 && <BySymbolTable data={data.bySymbol} />}
              {data.byDirection.length > 0 && <ByDirectionCards data={data.byDirection} />}
              {data.recentTrades.length > 0 && <RecentTradesTable trades={data.recentTrades} onSelectPair={navigateToPair} />}
            </div>
          )}
        </>
      )}

      {/* Historico Tab */}
      {activeTab === 'historico' && (
        <>
          {/* Stats */}
          {histStats && (
            <div className="px-3 py-2 border-b border-card-border">
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                <HistStatBox label="Win Rate" value={`${histStats.winRate.toFixed(1)}%`} color={histStats.winRate >= 50 ? 'text-bull' : 'text-bear'} />
                <HistStatBox label="Total" value={String(histStats.totalTrades)} color="text-white" />
                <HistStatBox label="Wins" value={String(histStats.wins)} color="text-bull" />
                <HistStatBox label="Losses" value={String(histStats.losses)} color="text-bear" />
                <HistStatBox label="Avg Win" value={`${histStats.avgWinPnl.toFixed(2)}%`} color="text-bull" />
                <HistStatBox label="Avg Loss" value={`${histStats.avgLossPnl.toFixed(2)}%`} color="text-bear" />
              </div>
            </div>
          )}

          {/* Filter */}
          <div className="px-3 py-2 border-b border-card-border">
            <select value={histFilter} onChange={(e) => { setHistFilter(e.target.value); setHistPage(0) }} className="w-full max-w-xs px-2 py-1 bg-bg border border-card-border rounded text-white text-xs">
              <option value="">Todos</option>
              {settings.pairs.map((pair: string) => (<option key={pair} value={pair}>{pair}</option>))}
            </select>
          </div>

          {/* Table */}
          {histLoading && histTrades.length === 0 ? (
            <div className="text-center text-muted py-8">Carregando...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th className="text-left">Par</th>
                    <th className="text-left">Dir.</th>
                    <th className="text-right">Entry</th>
                    <th className="text-right">Exit</th>
                    <th className="text-center">Resultado</th>
                    <th className="text-right">P&L%</th>
                    <th className="text-right">Abriu</th>
                    <th className="text-right">Fechou</th>
                  </tr>
                </thead>
                <tbody>
                  {histTrades.length === 0 ? (
                    <tr><td colSpan={8} className="px-3 py-8 text-center text-muted">Nenhum trade encontrado</td></tr>
                  ) : histTrades.map((trade) => (
                    <tr key={trade.id}>
                      <td className="font-mono-num">
                        <button onClick={() => navigateToPair(trade.symbol)} className="text-accent hover:underline cursor-pointer">{trade.symbol.replace('USDT', '')}</button>
                      </td>
                      <td className={`font-bold ${directionColors[trade.direction]}`}>{trade.direction}</td>
                      <td className="text-right font-mono-num whitespace-nowrap">${formatPrice(trade.entryPrice)}</td>
                      <td className="text-right font-mono-num whitespace-nowrap">{trade.exitPrice != null ? `$${formatPrice(trade.exitPrice)}` : '-'}</td>
                      <td className={`text-center font-bold whitespace-nowrap ${trade.result ? resultColors[trade.result] : 'text-muted'}`}>{trade.result ?? 'OPEN'}</td>
                      <td className={`text-right font-mono-num font-bold whitespace-nowrap ${trade.pnlPercent != null ? (trade.pnlPercent >= 0 ? 'text-bull' : 'text-bear') : 'text-muted'}`}>
                        {trade.pnlPercent != null ? `${trade.pnlPercent >= 0 ? '+' : ''}${trade.pnlPercent.toFixed(2)}%` : '-'}
                      </td>
                      <td className="text-right text-muted text-[10px] font-mono-num whitespace-nowrap">{formatDateTime(trade.openedAt)}</td>
                      <td className="text-right text-muted text-[10px] font-mono-num whitespace-nowrap">{formatDateTime(trade.closedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {histTotalPages > 1 && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-card-border text-xs text-muted">
              <span className="font-mono-num">Pagina {histPage + 1} de {histTotalPages} ({histTotal} trades)</span>
              <div className="flex gap-2">
                <button onClick={() => setHistPage(Math.max(0, histPage - 1))} disabled={histPage === 0} className="px-2 py-1 rounded bg-card-border hover:bg-card-border/80 disabled:opacity-30 disabled:cursor-not-allowed">Anterior</button>
                <button onClick={() => setHistPage(Math.min(histTotalPages - 1, histPage + 1))} disabled={histPage >= histTotalPages - 1} className="px-2 py-1 rounded bg-card-border hover:bg-card-border/80 disabled:opacity-30 disabled:cursor-not-allowed">Proximo</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Exportar Tab */}
      {activeTab === 'exportar' && (
        <div className="px-3 py-2 space-y-3">
          <div className="text-xs text-muted">Exporte seus trades em CSV ou JSON para analise externa.</div>
          {exportLoading ? (
            <div className="text-center text-muted py-8">Carregando dados...</div>
          ) : (
            <>
              <div className="text-xs text-muted font-mono-num">{exportTrades.length} trades disponiveis para exportacao</div>
              <div className="flex gap-2">
                <button onClick={() => exportCSV(exportTrades)} disabled={exportTrades.length === 0} className="px-3 py-1.5 text-xs font-bold text-white bg-accent hover:bg-accent/80 rounded transition-colors disabled:opacity-30">Exportar CSV</button>
                <button onClick={() => exportJSON(exportTrades)} disabled={exportTrades.length === 0} className="px-3 py-1.5 text-xs font-bold text-white bg-card-border hover:bg-card-border/80 rounded transition-colors disabled:opacity-30">Exportar JSON</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function HistStatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-bg rounded px-3 py-2 text-center">
      <div className="text-[11px] text-muted uppercase tracking-wider">{label}</div>
      <div className={`font-bold font-mono-num text-lg ${color}`}>{value}</div>
    </div>
  )
}

function StatsSummary({ data }: { data: PerformanceData }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="P&L Total" value={`${data.totalPnl >= 0 ? '+' : ''}${data.totalPnl.toFixed(2)}%`} positive={data.totalPnl >= 0} large />
        <StatCard label="Win Rate" value={`${data.winRate.toFixed(1)}%`} positive={data.winRate >= 50} large />
        <StatCard label="Total Trades" value={String(data.totalTrades)} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Max Drawdown" value={`${data.maxDrawdown.toFixed(2)}%`} positive={false} />
        <StatCard label="Profit Factor" value={data.profitFactor === Infinity ? '---' : data.profitFactor.toFixed(2)} positive={data.profitFactor >= 1} />
        <StatCard label="Melhor Dia" value={data.bestDay.date !== '-' ? `${data.bestDay.pnl >= 0 ? '+' : ''}${data.bestDay.pnl.toFixed(2)}%` : '-'} positive={data.bestDay.pnl >= 0} subtitle={data.bestDay.date !== '-' ? data.bestDay.date : undefined} />
      </div>
    </div>
  )
}

function StatCard({ label, value, positive, large, subtitle }: { label: string; value: string; positive?: boolean; large?: boolean; subtitle?: string }) {
  const color = positive === undefined ? 'text-white' : positive ? 'text-bull' : 'text-bear'
  return (
    <div className="bg-card border border-card-border rounded px-3 py-2">
      <div className="text-[11px] text-muted uppercase tracking-wider mb-0.5">{label}</div>
      <div className={`${large ? 'text-lg' : 'text-sm'} font-bold font-mono-num ${color}`}>{value}</div>
      {subtitle && <div className="text-[10px] text-muted mt-0.5 font-mono-num">{subtitle}</div>}
    </div>
  )
}

function EquityCurve({ data }: { data: PerformanceData['equityCurve'] }) {
  const width = 650, height = 180
  const pad = { top: 20, right: 10, bottom: 25, left: 10 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom

  const path = useMemo(() => {
    const equities = data.map((d) => d.equity)
    const minE = Math.min(...equities), maxE = Math.max(...equities)
    const rangeE = maxE - minE || 1
    return data.map((d, i) => {
      const x = pad.left + (i / (data.length - 1)) * innerW
      const y = pad.top + innerH - ((d.equity - minE) / rangeE) * innerH
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
  }, [data, innerW, innerH, pad.left, pad.top])

  const fillPath = useMemo(() => {
    const equities = data.map((d) => d.equity)
    const minE = Math.min(...equities), maxE = Math.max(...equities)
    const rangeE = maxE - minE || 1
    const bottom = pad.top + innerH
    const points = data.map((d, i) => {
      const x = pad.left + (i / (data.length - 1)) * innerW
      const y = pad.top + innerH - ((d.equity - minE) / rangeE) * innerH
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    return `M${pad.left},${bottom} L${points.join(' L')} L${pad.left + innerW},${bottom} Z`
  }, [data, innerW, innerH, pad.left, pad.top])

  const startEquity = data[0].equity, endEquity = data[data.length - 1].equity
  const isPositive = endEquity >= startEquity

  return (
    <div>
      <div className="text-[11px] text-muted uppercase tracking-wider mb-1">Curva de Equity</div>
      <div className="bg-card border border-card-border rounded px-3 py-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isPositive ? '#00c896' : '#ef4444'} stopOpacity="0.3" />
              <stop offset="100%" stopColor={isPositive ? '#00c896' : '#ef4444'} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={fillPath} fill="url(#eqGrad)" />
          <path d={path} fill="none" stroke={isPositive ? '#00c896' : '#ef4444'} strokeWidth="2" />
        </svg>
        <div className="flex justify-between text-[10px] text-muted font-mono-num mt-1 px-1">
          <span>{startEquity.toFixed(2)}</span>
          <span className={isPositive ? 'text-bull' : 'text-bear'}>{endEquity.toFixed(2)} ({isPositive ? '+' : ''}{((endEquity - 100)).toFixed(2)}%)</span>
        </div>
      </div>
    </div>
  )
}

function BySymbolTable({ data }: { data: PerformanceData['bySymbol'] }) {
  return (
    <div>
      <div className="text-[11px] text-muted uppercase tracking-wider mb-1">Por Simbolo</div>
      <div className="bg-card border border-card-border rounded overflow-hidden">
        <table className="data-table w-full">
          <thead><tr>
            <th className="text-left">Simbolo</th><th className="text-right">Trades</th><th className="text-right">Win Rate</th><th className="text-right">P&L %</th>
          </tr></thead>
          <tbody>{data.map((s) => (
            <tr key={s.symbol}>
              <td className="font-bold">{s.symbol.replace('USDT', '')}</td>
              <td className="text-right font-mono-num">{s.trades}</td>
              <td className={`text-right font-mono-num ${s.winRate >= 50 ? 'text-bull' : 'text-bear'}`}>{s.winRate.toFixed(1)}%</td>
              <td className={`text-right font-mono-num font-bold ${s.pnl >= 0 ? 'text-bull' : 'text-bear'}`}>{s.pnl >= 0 ? '+' : ''}{s.pnl.toFixed(2)}%</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  )
}

function ByDirectionCards({ data }: { data: PerformanceData['byDirection'] }) {
  const longData = data.find((d) => d.direction === 'LONG')
  const shortData = data.find((d) => d.direction === 'SHORT')
  return (
    <div>
      <div className="text-[11px] text-muted uppercase tracking-wider mb-1">Por Direcao</div>
      <div className="grid grid-cols-2 gap-2">
        <DirectionCard direction="LONG" data={longData} />
        <DirectionCard direction="SHORT" data={shortData} />
      </div>
    </div>
  )
}

function DirectionCard({ direction, data }: { direction: string; data?: { trades: number; wins: number; losses: number; winRate: number; pnl: number } }) {
  const isLong = direction === 'LONG'
  return (
    <div className={`bg-card border ${isLong ? 'border-bull/40' : 'border-bear/40'} rounded px-3 py-2`}>
      <div className={`text-xs font-bold mb-1.5 ${isLong ? 'text-bull' : 'text-bear'}`}>{direction}</div>
      {data ? (
        <div className="space-y-1 text-xs">
          <div className="flex justify-between"><span className="text-muted">Trades</span><span className="font-mono-num">{data.trades}</span></div>
          <div className="flex justify-between"><span className="text-muted">Win Rate</span><span className={`font-mono-num ${data.winRate >= 50 ? 'text-bull' : 'text-bear'}`}>{data.winRate.toFixed(1)}%</span></div>
          <div className="flex justify-between"><span className="text-muted">P&L</span><span className={`font-mono-num font-bold ${data.pnl >= 0 ? 'text-bull' : 'text-bear'}`}>{data.pnl >= 0 ? '+' : ''}{data.pnl.toFixed(2)}%</span></div>
        </div>
      ) : <div className="text-muted text-xs">Sem trades</div>}
    </div>
  )
}

function RecentTradesTable({ trades, onSelectPair }: { trades: Trade[]; onSelectPair: (symbol: string) => void }) {
  return (
    <div>
      <div className="text-[11px] text-muted uppercase tracking-wider mb-1">Trades Recentes (<span className="font-mono-num">{trades.length}</span>)</div>
      <div className="bg-card border border-card-border rounded overflow-hidden max-h-[320px] overflow-y-auto">
        <table className="data-table w-full">
          <thead className="sticky top-0 bg-card"><tr>
            <th className="text-left">Data</th><th className="text-left">Simbolo</th><th className="text-center">Dir</th>
            <th className="text-right">Entrada</th><th className="text-right">Saida</th><th className="text-center">Resultado</th><th className="text-right">P&L%</th>
          </tr></thead>
          <tbody>{trades.map((t) => (
            <tr key={t.id}>
              <td className="font-mono-num text-muted">{formatDateTime(t.openedAt)}</td>
              <td className="font-bold">
                <button onClick={() => onSelectPair(t.symbol)} className="text-accent hover:underline cursor-pointer">{t.symbol.replace('USDT', '')}</button>
              </td>
              <td className={`text-center font-bold ${t.direction === 'LONG' ? 'text-bull' : 'text-bear'}`}>{t.direction === 'LONG' ? 'L' : 'S'}</td>
              <td className="text-right font-mono-num">{formatPrice(t.entryPrice)}</td>
              <td className="text-right font-mono-num">{t.exitPrice != null ? formatPrice(t.exitPrice) : '-'}</td>
              <td className={`text-center font-bold ${t.result === 'WIN' ? 'text-bull' : t.result === 'LOSS' ? 'text-bear' : 'text-muted'}`}>{t.result ?? 'OPEN'}</td>
              <td className={`text-right font-mono-num font-bold ${t.pnlPercent != null ? (t.pnlPercent >= 0 ? 'text-bull' : 'text-bear') : 'text-muted'}`}>{t.pnlPercent != null ? `${t.pnlPercent >= 0 ? '+' : ''}${t.pnlPercent.toFixed(2)}%` : '-'}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  )
}
