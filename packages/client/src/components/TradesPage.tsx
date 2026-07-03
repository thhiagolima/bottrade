import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PerformanceData, Trade, TradeStats } from '@bottrade/shared'
import { useStore } from '../store/useStore'
import { emitAnalyzePair, emitGetPerformance, emitGetTradeHistory, emitGetTradeStats } from '../hooks/useSocket'
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
const resultBadgeColors: Record<string, string> = {
  WIN: 'border-bull/25 bg-bull/10 text-bull',
  LOSS: 'border-bear/25 bg-bear/10 text-bear',
}
const directionColors: Record<string, string> = { LONG: 'text-bull', SHORT: 'text-bear' }

type TradeTab = 'performance' | 'historico' | 'exportar'

export default function TradesPage() {
  const settings = useStore((s) => s.settings)
  const selectPair = useStore((s) => s.selectPair)
  const setTempAnalysis = useStore((s) => s.setTempAnalysis)
  const favorites = useStore((s) => s.favorites)
  const navigateTo = useStore((s) => s.navigateTo)

  const [activeTab, setActiveTab] = useState<TradeTab>('performance')

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
    <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(192,193,255,0.07),transparent_30%),var(--color-bg)] p-3 md:p-5">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="rounded-xl border border-card-border bg-card/90 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-black text-white">Historico e performance</h2>
              <p className="mt-1 text-sm text-muted">Acompanhe trades reais, desempenho por par e exportacao dos registros.</p>
            </div>
            <div className="grid grid-cols-3 gap-1 rounded-lg border border-card-border bg-bg/30 p-1">
              {(['performance', 'historico', 'exportar'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-md px-3 py-2 text-xs font-bold transition-colors ${
                    activeTab === tab ? 'bg-accent text-white' : 'text-muted hover:bg-card-hover hover:text-white'
                  }`}
                >
                  {tab === 'performance' ? 'Performance' : tab === 'historico' ? 'Historico' : 'Exportar'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {activeTab === 'performance' && (
          <section className="space-y-4">
            <Toolbar title="Performance" subtitle="Resultados agregados dos trades registrados.">
              <PairSelect value={filterSymbol} onChange={setFilterSymbol} pairs={settings.pairs} allLabel="Todos os pares" />
            </Toolbar>

            {loading ? (
              <EmptyState text="Carregando dados de performance..." />
            ) : !data ? (
              <EmptyState text="Sem dados disponiveis" />
            ) : (
              <>
                <StatsSummary data={data} />
                {data.equityCurve.length > 1 && <EquityCurve data={data.equityCurve} />}
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                  {data.bySymbol.length > 0 && <BySymbolTable data={data.bySymbol} />}
                  {data.byDirection.length > 0 && <ByDirectionCards data={data.byDirection} />}
                </div>
                {data.recentTrades.length > 0 && <RecentTradesTable trades={data.recentTrades} onSelectPair={navigateToPair} />}
              </>
            )}
          </section>
        )}

        {activeTab === 'historico' && (
          <section className="space-y-4">
            <Toolbar title="Historico" subtitle={`${histTotal} trades encontrados`}>
              <PairSelect value={histFilter} onChange={(value) => { setHistFilter(value); setHistPage(0) }} pairs={settings.pairs} allLabel="Todos" />
            </Toolbar>

            {histStats && (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                <HistStatBox label="Win Rate" value={`${histStats.winRate.toFixed(1)}%`} color={histStats.winRate >= 50 ? 'text-bull' : 'text-bear'} />
                <HistStatBox label="Total" value={String(histStats.totalTrades)} color="text-white" />
                <HistStatBox label="Wins" value={String(histStats.wins)} color="text-bull" />
                <HistStatBox label="Losses" value={String(histStats.losses)} color="text-bear" />
                <HistStatBox label="Avg Win" value={`${histStats.avgWinPnl.toFixed(2)}%`} color="text-bull" />
                <HistStatBox label="Avg Loss" value={`${histStats.avgLossPnl.toFixed(2)}%`} color="text-bear" />
              </div>
            )}

            <HistoryTable
              trades={histTrades}
              loading={histLoading}
              onSelectPair={navigateToPair}
            />

            {histTotalPages > 1 && (
              <Pagination
                page={histPage}
                totalPages={histTotalPages}
                total={histTotal}
                onPrev={() => setHistPage(Math.max(0, histPage - 1))}
                onNext={() => setHistPage(Math.min(histTotalPages - 1, histPage + 1))}
              />
            )}
          </section>
        )}

        {activeTab === 'exportar' && (
          <section className="rounded-xl border border-card-border bg-card/90 p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Exportar trades</h3>
                <p className="mt-1 text-sm text-muted">Baixe os ultimos registros para analise externa ou backup.</p>
                <div className="mt-3 font-mono-num text-xs text-muted">
                  {exportLoading ? 'Carregando dados...' : `${exportTrades.length} trades disponiveis para exportacao`}
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <button onClick={() => exportCSV(exportTrades)} disabled={exportTrades.length === 0 || exportLoading} className="rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-accent/80 disabled:cursor-not-allowed disabled:opacity-30">
                  Exportar CSV
                </button>
                <button onClick={() => exportJSON(exportTrades)} disabled={exportTrades.length === 0 || exportLoading} className="rounded-lg border border-card-border bg-bg/40 px-4 py-2 text-xs font-bold text-muted transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-30">
                  Exportar JSON
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function Toolbar({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-card-border bg-card/90 p-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-muted">{title}</h3>
        <p className="mt-1 text-[11px] text-dim">{subtitle}</p>
      </div>
      {children}
    </div>
  )
}

function PairSelect({ value, onChange, pairs, allLabel }: { value: string; onChange: (value: string) => void; pairs: string[]; allLabel: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-card-border bg-bg px-3 py-2 text-xs text-white outline-none focus:border-accent md:max-w-xs">
      <option value="">{allLabel}</option>
      {pairs.map((pair) => (<option key={pair} value={pair}>{pair}</option>))}
    </select>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-card-border bg-card/90 px-4 py-12 text-center text-muted">{text}</div>
  )
}

function HistStatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-card-border/75 bg-card/90 px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-dim">{label}</div>
      <div className={`mt-1 font-mono-num text-lg font-black ${color}`}>{value}</div>
    </div>
  )
}

function StatsSummary({ data }: { data: PerformanceData }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
      <StatCard label="P&L Total" value={`${data.totalPnl >= 0 ? '+' : ''}${data.totalPnl.toFixed(2)}%`} positive={data.totalPnl >= 0} large />
      <StatCard label="Win Rate" value={`${data.winRate.toFixed(1)}%`} positive={data.winRate >= 50} large />
      <StatCard label="Total Trades" value={String(data.totalTrades)} />
      <StatCard label="Max Drawdown" value={`${data.maxDrawdown.toFixed(2)}%`} positive={false} />
      <StatCard label="Profit Factor" value={data.profitFactor === Infinity ? '---' : data.profitFactor.toFixed(2)} positive={data.profitFactor >= 1} />
      <StatCard label="Melhor Dia" value={data.bestDay.date !== '-' ? `${data.bestDay.pnl >= 0 ? '+' : ''}${data.bestDay.pnl.toFixed(2)}%` : '-'} positive={data.bestDay.pnl >= 0} subtitle={data.bestDay.date !== '-' ? data.bestDay.date : undefined} />
    </div>
  )
}

function StatCard({ label, value, positive, large, subtitle }: { label: string; value: string; positive?: boolean; large?: boolean; subtitle?: string }) {
  const color = positive === undefined ? 'text-white' : positive ? 'text-bull' : 'text-bear'
  return (
    <div className="rounded-lg border border-card-border/75 bg-card/90 px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-dim">{label}</div>
      <div className={`${large ? 'text-xl' : 'text-lg'} mt-1 font-mono-num font-black ${color}`}>{value}</div>
      {subtitle && <div className="mt-1 font-mono-num text-[10px] text-muted">{subtitle}</div>}
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
    <div className="rounded-xl border border-card-border bg-card/90 p-3">
      <div className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-muted">Curva de equity</div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-48 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isPositive ? '#00c896' : '#ef4444'} stopOpacity="0.3" />
            <stop offset="100%" stopColor={isPositive ? '#00c896' : '#ef4444'} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={fillPath} fill="url(#eqGrad)" />
        <path d={path} fill="none" stroke={isPositive ? '#00c896' : '#ef4444'} strokeWidth="2.5" />
      </svg>
      <div className="mt-1 flex justify-between px-1 font-mono-num text-[10px] text-muted">
        <span>{startEquity.toFixed(2)}</span>
        <span className={isPositive ? 'text-bull' : 'text-bear'}>{endEquity.toFixed(2)} ({isPositive ? '+' : ''}{(endEquity - 100).toFixed(2)}%)</span>
      </div>
    </div>
  )
}

function BySymbolTable({ data }: { data: PerformanceData['bySymbol'] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-card-border bg-card/90">
      <div className="border-b border-card-border px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-muted">Por simbolo</div>
      <div className="overflow-x-auto">
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
    <div className="rounded-xl border border-card-border bg-card/90 p-3">
      <div className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-muted">Por direcao</div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        <DirectionCard direction="LONG" data={longData} />
        <DirectionCard direction="SHORT" data={shortData} />
      </div>
    </div>
  )
}

function DirectionCard({ direction, data }: { direction: string; data?: { trades: number; wins: number; losses: number; winRate: number; pnl: number } }) {
  const isLong = direction === 'LONG'
  return (
    <div className={`rounded-lg border ${isLong ? 'border-bull/30 bg-bull/5' : 'border-bear/30 bg-bear/5'} px-3 py-2`}>
      <div className={`text-sm font-black ${isLong ? 'text-bull' : 'text-bear'}`}>{direction}</div>
      {data ? (
        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
          <Metric label="Trades" value={String(data.trades)} />
          <Metric label="Win Rate" value={`${data.winRate.toFixed(1)}%`} tone={data.winRate >= 50 ? 'bull' : 'bear'} />
          <Metric label="P&L" value={`${data.pnl >= 0 ? '+' : ''}${data.pnl.toFixed(2)}%`} tone={data.pnl >= 0 ? 'bull' : 'bear'} />
        </div>
      ) : <div className="mt-2 text-xs text-muted">Sem trades</div>}
    </div>
  )
}

function Metric({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'bull' | 'bear' | 'neutral' }) {
  const toneClass = tone === 'bull' ? 'text-bull' : tone === 'bear' ? 'text-bear' : 'text-white'
  return (
    <div>
      <div className="text-[10px] text-dim">{label}</div>
      <div className={`font-mono-num font-bold ${toneClass}`}>{value}</div>
    </div>
  )
}

function RecentTradesTable({ trades, onSelectPair }: { trades: Trade[]; onSelectPair: (symbol: string) => void }) {
  return (
    <div className="overflow-hidden rounded-xl border border-card-border bg-card/90">
      <div className="border-b border-card-border px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-muted">
        Trades recentes (<span className="font-mono-num">{trades.length}</span>)
      </div>
      <div className="overflow-x-auto">
        <table className="data-table w-full">
          <thead><tr>
            <th className="text-left">Data</th><th className="text-left">Simbolo</th><th className="text-center">Dir</th>
            <th className="text-right">Entrada</th><th className="text-right">Saida</th><th className="text-center">Resultado</th><th className="text-right">P&L%</th>
          </tr></thead>
          <tbody>{trades.map((t) => (
            <tr key={t.id}>
              <td className="font-mono-num text-muted">{formatDateTime(t.openedAt)}</td>
              <td className="font-bold">
                <button onClick={() => onSelectPair(t.symbol)} className="cursor-pointer text-accent hover:underline">{t.symbol.replace('USDT', '')}</button>
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

function HistoryTable({ trades, loading, onSelectPair }: { trades: Trade[]; loading: boolean; onSelectPair: (symbol: string) => void }) {
  if (loading && trades.length === 0) return <EmptyState text="Carregando..." />

  return (
    <div className="overflow-hidden rounded-xl border border-card-border bg-card/90">
      <div className="space-y-2 p-3 md:hidden">
        {trades.length === 0 ? (
          <div className="py-8 text-center text-muted">Nenhum trade encontrado</div>
        ) : trades.map((trade) => <TradeMobileCard key={trade.id} trade={trade} onSelectPair={onSelectPair} />)}
      </div>

      <div className="hidden overflow-x-auto md:block">
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
            {trades.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-muted">Nenhum trade encontrado</td></tr>
            ) : trades.map((trade) => (
              <tr key={trade.id}>
                <td className="font-mono-num">
                  <button onClick={() => onSelectPair(trade.symbol)} className="cursor-pointer text-accent hover:underline">{trade.symbol.replace('USDT', '')}</button>
                </td>
                <td className={`font-bold ${directionColors[trade.direction]}`}>{trade.direction}</td>
                <td className="whitespace-nowrap text-right font-mono-num">${formatPrice(trade.entryPrice)}</td>
                <td className="whitespace-nowrap text-right font-mono-num">{trade.exitPrice != null ? `$${formatPrice(trade.exitPrice)}` : '-'}</td>
                <td className={`whitespace-nowrap text-center font-bold ${trade.result ? resultColors[trade.result] : 'text-muted'}`}>{trade.result ?? 'OPEN'}</td>
                <td className={`whitespace-nowrap text-right font-mono-num font-bold ${trade.pnlPercent != null ? (trade.pnlPercent >= 0 ? 'text-bull' : 'text-bear') : 'text-muted'}`}>
                  {trade.pnlPercent != null ? `${trade.pnlPercent >= 0 ? '+' : ''}${trade.pnlPercent.toFixed(2)}%` : '-'}
                </td>
                <td className="whitespace-nowrap text-right font-mono-num text-[10px] text-muted">{formatDateTime(trade.openedAt)}</td>
                <td className="whitespace-nowrap text-right font-mono-num text-[10px] text-muted">{formatDateTime(trade.closedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TradeMobileCard({ trade, onSelectPair }: { trade: Trade; onSelectPair: (symbol: string) => void }) {
  const pnlClass = trade.pnlPercent != null ? (trade.pnlPercent >= 0 ? 'text-bull' : 'text-bear') : 'text-muted'
  const badgeClass = trade.result ? resultBadgeColors[trade.result] : 'border-card-border bg-bg/30 text-muted'

  return (
    <div className="rounded-xl border border-card-border/75 bg-bg/25 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <button onClick={() => onSelectPair(trade.symbol)} className="truncate font-mono-num text-sm font-black text-accent hover:underline">
            {trade.symbol}
          </button>
          <div className={`mt-1 text-xs font-bold ${directionColors[trade.direction]}`}>{trade.direction}</div>
        </div>
        <span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${badgeClass}`}>{trade.result ?? 'OPEN'}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <Metric label="Entry" value={`$${formatPrice(trade.entryPrice)}`} />
        <Metric label="Exit" value={trade.exitPrice != null ? `$${formatPrice(trade.exitPrice)}` : '-'} />
        <Metric label="P&L" value={trade.pnlPercent != null ? `${trade.pnlPercent >= 0 ? '+' : ''}${trade.pnlPercent.toFixed(2)}%` : '-'} tone={trade.pnlPercent != null && trade.pnlPercent >= 0 ? 'bull' : trade.pnlPercent != null ? 'bear' : 'neutral'} />
        <div>
          <div className="text-[10px] text-dim">Abriu</div>
          <div className="font-mono-num text-[10px] text-muted">{formatDateTime(trade.openedAt)}</div>
        </div>
      </div>
      <div className={`mt-2 text-right font-mono-num text-xs font-bold ${pnlClass}`}>
        {trade.pnlPercent != null ? `${trade.pnlPercent >= 0 ? '+' : ''}${trade.pnlPercent.toFixed(2)}%` : '-'}
      </div>
    </div>
  )
}

function Pagination({ page, totalPages, total, onPrev, onNext }: { page: number; totalPages: number; total: number; onPrev: () => void; onNext: () => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-card-border bg-card/90 px-3 py-3 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
      <span className="font-mono-num">Pagina {page + 1} de {totalPages} ({total} trades)</span>
      <div className="flex gap-2">
        <button onClick={onPrev} disabled={page === 0} className="rounded bg-card-border px-3 py-1.5 hover:bg-card-border/80 disabled:cursor-not-allowed disabled:opacity-30">Anterior</button>
        <button onClick={onNext} disabled={page >= totalPages - 1} className="rounded bg-card-border px-3 py-1.5 hover:bg-card-border/80 disabled:cursor-not-allowed disabled:opacity-30">Proximo</button>
      </div>
    </div>
  )
}
