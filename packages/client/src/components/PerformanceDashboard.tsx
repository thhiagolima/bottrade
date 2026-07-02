import { useState, useEffect, useCallback, useMemo } from 'react'
import type { PerformanceData, Trade } from '@bottrade/shared'
import { useStore } from '../store/useStore'
import { emitGetPerformance } from '../hooks/useSocket'
import { formatPrice } from '../utils/format'

export default function PerformanceDashboard() {
  const togglePerformance = useStore((s) => s.togglePerformance)
  const settings = useStore((s) => s.settings)

  const [data, setData] = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterSymbol, setFilterSymbol] = useState('')

  const loadData = useCallback(() => {
    setLoading(true)
    const symbol = filterSymbol || undefined
    emitGetPerformance({ symbol }, (result) => {
      setData(result)
      setLoading(false)
    })
  }, [filterSymbol])

  useEffect(() => {
    loadData()
  }, [loadData])

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={togglePerformance} />

      {/* Drawer */}
      <div className="relative w-full md:w-[700px] max-w-full h-full bg-bg border-l border-card-border overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b border-card-border bg-card">
          <h2 className="text-base font-bold">Performance</h2>
          <button
            onClick={togglePerformance}
            className="p-1.5 rounded-lg hover:bg-card-border transition-colors text-muted"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filter */}
        <div className="px-5 py-3 border-b border-card-border">
          <select
            value={filterSymbol}
            onChange={(e) => setFilterSymbol(e.target.value)}
            className="w-full px-3 py-2 bg-card border border-card-border rounded text-white text-sm"
          >
            <option value="">Todos os pares</option>
            {settings.pairs.map((pair: string) => (
              <option key={pair} value={pair}>{pair}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted">
            Carregando dados de performance...
          </div>
        ) : !data ? (
          <div className="flex items-center justify-center py-20 text-muted">
            Sem dados disponíveis
          </div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Stats Summary */}
            <StatsSummary data={data} />

            {/* Equity Curve */}
            {data.equityCurve.length > 1 && <EquityCurve data={data.equityCurve} />}

            {/* By Symbol Table */}
            {data.bySymbol.length > 0 && <BySymbolTable data={data.bySymbol} />}

            {/* By Direction */}
            {data.byDirection.length > 0 && <ByDirectionCards data={data.byDirection} />}

            {/* Recent Trades */}
            {data.recentTrades.length > 0 && <RecentTradesTable trades={data.recentTrades} />}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Stats Summary ────────────────────────── */

function StatsSummary({ data }: { data: PerformanceData }) {
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-3 gap-2.5">
        <StatCard
          label="P&L Total"
          value={`${data.totalPnl >= 0 ? '+' : ''}${data.totalPnl.toFixed(2)}%`}
          positive={data.totalPnl >= 0}
          large
        />
        <StatCard
          label="Win Rate"
          value={`${data.winRate.toFixed(1)}%`}
          positive={data.winRate >= 50}
          large
        />
        <StatCard
          label="Total Trades"
          value={String(data.totalTrades)}
        />
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        <StatCard
          label="Max Drawdown"
          value={`${data.maxDrawdown.toFixed(2)}%`}
          positive={false}
        />
        <StatCard
          label="Profit Factor"
          value={data.profitFactor === Infinity ? '---' : data.profitFactor.toFixed(2)}
          positive={data.profitFactor >= 1}
        />
        <StatCard
          label="Melhor Dia"
          value={data.bestDay.date !== '-' ? `${data.bestDay.pnl >= 0 ? '+' : ''}${data.bestDay.pnl.toFixed(2)}%` : '-'}
          positive={data.bestDay.pnl >= 0}
          subtitle={data.bestDay.date !== '-' ? data.bestDay.date : undefined}
        />
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        <StatCard
          label="Pior Dia"
          value={data.worstDay.date !== '-' ? `${data.worstDay.pnl.toFixed(2)}%` : '-'}
          positive={false}
          subtitle={data.worstDay.date !== '-' ? data.worstDay.date : undefined}
        />
      </div>
    </div>
  )
}

function StatCard({ label, value, positive, large, subtitle }: {
  label: string
  value: string
  positive?: boolean
  large?: boolean
  subtitle?: string
}) {
  const color =
    positive === undefined ? 'text-white' : positive ? 'text-bull' : 'text-bear'

  return (
    <div className="bg-card border border-card-border rounded-lg p-2.5">
      <div className="text-[10px] text-muted mb-0.5">{label}</div>
      <div className={`${large ? 'text-base' : 'text-sm'} font-bold font-mono-num ${color}`}>{value}</div>
      {subtitle && <div className="text-[10px] text-muted mt-0.5">{subtitle}</div>}
    </div>
  )
}

/* ── Equity Curve (SVG) ────────────────────────── */

function EquityCurve({ data }: { data: PerformanceData['equityCurve'] }) {
  const width = 650
  const height = 180
  const pad = { top: 20, right: 10, bottom: 25, left: 10 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom

  const path = useMemo(() => {
    const equities = data.map((d) => d.equity)
    const minE = Math.min(...equities)
    const maxE = Math.max(...equities)
    const rangeE = maxE - minE || 1

    return data
      .map((d, i) => {
        const x = pad.left + (i / (data.length - 1)) * innerW
        const y = pad.top + innerH - ((d.equity - minE) / rangeE) * innerH
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
  }, [data, innerW, innerH, pad.left, pad.top])

  // Gradient fill path
  const fillPath = useMemo(() => {
    const equities = data.map((d) => d.equity)
    const minE = Math.min(...equities)
    const maxE = Math.max(...equities)
    const rangeE = maxE - minE || 1
    const bottom = pad.top + innerH

    const points = data
      .map((d, i) => {
        const x = pad.left + (i / (data.length - 1)) * innerW
        const y = pad.top + innerH - ((d.equity - minE) / rangeE) * innerH
        return `${x.toFixed(1)},${y.toFixed(1)}`
      })

    const lastX = pad.left + innerW
    const firstX = pad.left
    return `M${firstX},${bottom} L${points.join(' L')} L${lastX},${bottom} Z`
  }, [data, innerW, innerH, pad.left, pad.top])

  const startEquity = data[0].equity
  const endEquity = data[data.length - 1].equity
  const isPositive = endEquity >= startEquity

  return (
    <div>
      <div className="text-xs text-muted mb-1.5">Curva de Equity</div>
      <div className="bg-card border border-card-border rounded-lg p-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isPositive ? '#00c896' : '#ef4444'} stopOpacity="0.3" />
              <stop offset="100%" stopColor={isPositive ? '#00c896' : '#ef4444'} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {/* Base line at 100 */}
          <path d={fillPath} fill="url(#equityGradient)" />
          <path d={path} fill="none" stroke={isPositive ? '#00c896' : '#ef4444'} strokeWidth="2" />
        </svg>
        <div className="flex justify-between text-[10px] text-muted font-mono-num mt-1 px-1">
          <span>{startEquity.toFixed(2)}</span>
          <span className={isPositive ? 'text-bull' : 'text-bear'}>
            {endEquity.toFixed(2)} ({isPositive ? '+' : ''}{((endEquity - 100)).toFixed(2)}%)
          </span>
        </div>
      </div>
    </div>
  )
}

/* ── By Symbol Table ────────────────────────── */

function BySymbolTable({ data }: { data: PerformanceData['bySymbol'] }) {
  return (
    <div>
      <div className="text-xs text-muted mb-1.5">Por Simbolo</div>
      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-card-border text-muted">
              <th className="text-left px-3 py-1.5 font-medium">Simbolo</th>
              <th className="text-right px-3 py-1.5 font-medium">Trades</th>
              <th className="text-right px-3 py-1.5 font-medium">Wins</th>
              <th className="text-right px-3 py-1.5 font-medium">Losses</th>
              <th className="text-right px-3 py-1.5 font-medium">Win Rate</th>
              <th className="text-right px-3 py-1.5 font-medium">P&L %</th>
            </tr>
          </thead>
          <tbody>
            {data.map((s) => (
              <tr key={s.symbol} className="border-b border-card-border last:border-0">
                <td className="px-3 py-1.5 font-bold">{s.symbol.replace('USDT', '')}</td>
                <td className="text-right px-3 py-1.5 font-mono-num">{s.trades}</td>
                <td className="text-right px-3 py-1.5 font-mono-num text-bull">{s.wins}</td>
                <td className="text-right px-3 py-1.5 font-mono-num text-bear">{s.losses}</td>
                <td className={`text-right px-3 py-1.5 font-mono-num ${s.winRate >= 50 ? 'text-bull' : 'text-bear'}`}>
                  {s.winRate.toFixed(1)}%
                </td>
                <td className={`text-right px-3 py-1.5 font-mono-num font-bold ${s.pnl >= 0 ? 'text-bull' : 'text-bear'}`}>
                  {s.pnl >= 0 ? '+' : ''}{s.pnl.toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── By Direction Cards ────────────────────────── */

function ByDirectionCards({ data }: { data: PerformanceData['byDirection'] }) {
  const longData = data.find((d) => d.direction === 'LONG')
  const shortData = data.find((d) => d.direction === 'SHORT')

  return (
    <div>
      <div className="text-xs text-muted mb-1.5">Por Direcao</div>
      <div className="grid grid-cols-2 gap-2.5">
        <DirectionCard direction="LONG" data={longData} />
        <DirectionCard direction="SHORT" data={shortData} />
      </div>
    </div>
  )
}

function DirectionCard({ direction, data }: {
  direction: string
  data?: { trades: number; wins: number; losses: number; winRate: number; pnl: number }
}) {
  const isLong = direction === 'LONG'
  const borderColor = isLong ? 'border-bull/40' : 'border-bear/40'
  const headerColor = isLong ? 'text-bull' : 'text-bear'

  return (
    <div className={`bg-card border ${borderColor} rounded-lg p-3`}>
      <div className={`text-sm font-bold mb-2 ${headerColor}`}>{direction}</div>
      {data ? (
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-muted">Trades</span>
            <span className="font-mono-num">{data.trades}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Win Rate</span>
            <span className={`font-mono-num ${data.winRate >= 50 ? 'text-bull' : 'text-bear'}`}>
              {data.winRate.toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Wins / Losses</span>
            <span className="font-mono-num">
              <span className="text-bull">{data.wins}</span>
              {' / '}
              <span className="text-bear">{data.losses}</span>
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">P&L</span>
            <span className={`font-mono-num font-bold ${data.pnl >= 0 ? 'text-bull' : 'text-bear'}`}>
              {data.pnl >= 0 ? '+' : ''}{data.pnl.toFixed(2)}%
            </span>
          </div>
        </div>
      ) : (
        <div className="text-muted text-xs">Sem trades</div>
      )}
    </div>
  )
}

/* ── Recent Trades Table ────────────────────────── */

function RecentTradesTable({ trades }: { trades: Trade[] }) {
  return (
    <div>
      <div className="text-xs text-muted mb-1.5">Trades Recentes ({trades.length})</div>
      <div className="bg-card border border-card-border rounded-lg overflow-hidden max-h-[320px] overflow-y-auto">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 bg-card">
            <tr className="border-b border-card-border text-muted">
              <th className="text-left px-2 py-1.5 font-medium">Data</th>
              <th className="text-left px-2 py-1.5 font-medium">Simbolo</th>
              <th className="text-center px-2 py-1.5 font-medium">Dir</th>
              <th className="text-right px-2 py-1.5 font-medium">Entrada</th>
              <th className="text-right px-2 py-1.5 font-medium">Saida</th>
              <th className="text-center px-2 py-1.5 font-medium">Resultado</th>
              <th className="text-right px-2 py-1.5 font-medium">P&L%</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t) => (
              <tr key={t.id} className="border-b border-card-border last:border-0 hover:bg-card-border/30">
                <td className="px-2 py-1 font-mono-num text-muted">
                  {new Date(t.openedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                </td>
                <td className="px-2 py-1 font-bold">{t.symbol.replace('USDT', '')}</td>
                <td className={`text-center px-2 py-1 font-bold ${t.direction === 'LONG' ? 'text-bull' : 'text-bear'}`}>
                  {t.direction === 'LONG' ? 'L' : 'S'}
                </td>
                <td className="text-right px-2 py-1 font-mono-num">{formatPrice(t.entryPrice)}</td>
                <td className="text-right px-2 py-1 font-mono-num">
                  {t.exitPrice != null ? formatPrice(t.exitPrice) : '-'}
                </td>
                <td className={`text-center px-2 py-1 font-bold ${
                  t.result === 'WIN' ? 'text-bull' : t.result === 'LOSS' ? 'text-bear' : 'text-muted'
                }`}>
                  {t.result ?? 'OPEN'}
                </td>
                <td className={`text-right px-2 py-1 font-mono-num font-bold ${
                  t.pnlPercent != null ? (t.pnlPercent >= 0 ? 'text-bull' : 'text-bear') : 'text-muted'
                }`}>
                  {t.pnlPercent != null ? `${t.pnlPercent >= 0 ? '+' : ''}${t.pnlPercent.toFixed(2)}%` : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
