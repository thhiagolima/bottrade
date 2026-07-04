import { useMemo, useState } from 'react'
import type { BacktestParams, BacktestResult, BacktestTrade } from '@bottrade/shared'
import { useStore } from '../store/useStore'
import { emitRunBacktest } from '../hooks/useSocket'
import { formatDate, formatPrice } from '../utils/format'

type Period = '7d' | '30d' | '90d'
type Scope = 'selected' | 'favorites'

export default function BacktestPage() {
  const settings = useStore((s) => s.settings)
  const selectedPair = useStore((s) => s.selectedPair)
  const favorites = useStore((s) => s.favorites)
  const backtestResult = useStore((s) => s.backtestResult)
  const backtestRunning = useStore((s) => s.backtestRunning)
  const setBacktestResult = useStore((s) => s.setBacktestResult)
  const setBacktestRunning = useStore((s) => s.setBacktestRunning)

  const [period, setPeriod] = useState<Period>('30d')
  const [scope, setScope] = useState<Scope>('selected')
  const [scoreThreshold, setScoreThreshold] = useState(85)
  const [leverage, setLeverage] = useState(settings.leverage)
  const [capital, setCapital] = useState(settings.baseCapital)
  const [error, setError] = useState<string | null>(null)

  const targetSymbols = scope === 'selected' && selectedPair
    ? [selectedPair]
    : favorites.length > 0
      ? favorites
      : selectedPair
        ? [selectedPair]
        : []

  function runBacktest() {
    if (targetSymbols.length === 0) return
    const params: BacktestParams = { symbols: targetSymbols, period, scoreThreshold, leverage, baseCapital: capital }
    setBacktestRunning(true)
    setBacktestResult(null)
    setError(null)
    emitRunBacktest(params, (result, backtestError) => {
      if (backtestError) {
        setError(backtestError)
        setBacktestResult(null)
        setBacktestRunning(false)
        return
      }
      setBacktestResult(result)
      setBacktestRunning(false)
    })
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(67,233,178,0.07),transparent_30%),var(--color-bg)] p-3 md:p-5">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="rounded-xl border border-card-border bg-card/90 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-black text-white">Backtest</h2>
              <p className="mt-1 text-sm text-muted">Teste uma configuracao nos candles historicos dos pares monitorados.</p>
            </div>
            <div className="font-mono-num text-xs text-muted">
              {targetSymbols.length > 0 ? `${targetSymbols.length} par(es) no escopo` : 'Nenhum par selecionado'}
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <BacktestConfig
            period={period}
            scope={scope}
            scoreThreshold={scoreThreshold}
            leverage={leverage}
            capital={capital}
            targetSymbols={targetSymbols}
            running={backtestRunning}
            onPeriodChange={setPeriod}
            onScopeChange={setScope}
            onScoreChange={setScoreThreshold}
            onLeverageChange={setLeverage}
            onCapitalChange={setCapital}
            onRun={runBacktest}
          />

          <div className="space-y-4">
            {error && (
              <div className="rounded-xl border border-bear/30 bg-bear/10 px-4 py-3 text-sm text-bear">
                {error}
              </div>
            )}
            {!backtestResult && !backtestRunning && (
              <EmptyState
                title="Configure e rode um backtest"
                text={error ? 'Ajuste os parametros ou seu plano e tente novamente.' : 'Os resultados aparecem aqui com estatisticas, curva de equity e lista de trades simulados.'}
              />
            )}
            {backtestRunning && <EmptyState title="Rodando backtest..." text="Buscando candles e simulando entradas com os parametros selecionados." />}
            {backtestResult && <BacktestResults result={backtestResult} />}
          </div>
        </div>
      </div>
    </div>
  )
}

function BacktestConfig({
  period,
  scope,
  scoreThreshold,
  leverage,
  capital,
  targetSymbols,
  running,
  onPeriodChange,
  onScopeChange,
  onScoreChange,
  onLeverageChange,
  onCapitalChange,
  onRun,
}: {
  period: Period
  scope: Scope
  scoreThreshold: number
  leverage: number
  capital: number
  targetSymbols: string[]
  running: boolean
  onPeriodChange: (period: Period) => void
  onScopeChange: (scope: Scope) => void
  onScoreChange: (value: number) => void
  onLeverageChange: (value: number) => void
  onCapitalChange: (value: number) => void
  onRun: () => void
}) {
  return (
    <div className="rounded-xl border border-card-border bg-card/90 p-4 xl:sticky xl:top-4 xl:self-start">
      <div className="mb-4">
        <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Parametros</h3>
        <p className="mt-1 text-[11px] text-dim">Ajuste o periodo, escopo e risco antes de simular.</p>
      </div>

      <div className="space-y-4">
        <SegmentedControl
          label="Periodo"
          options={[
            { value: '7d', label: '7d' },
            { value: '30d', label: '30d' },
            { value: '90d', label: '90d' },
          ]}
          value={period}
          onChange={(value) => onPeriodChange(value as Period)}
        />

        <SegmentedControl
          label="Escopo"
          options={[
            { value: 'selected', label: 'Par selecionado' },
            { value: 'favorites', label: 'Favoritos' },
          ]}
          value={scope}
          onChange={(value) => onScopeChange(value as Scope)}
        />

        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          <NumberField label="Score minimo" value={scoreThreshold} min={50} max={100} onChange={onScoreChange} suffix="%" />
          <NumberField label="Alavancagem" value={leverage} min={1} max={125} onChange={onLeverageChange} suffix="x" />
          <NumberField label="Capital" value={capital} min={1} onChange={onCapitalChange} suffix="USDT" />
        </div>

        <div className="rounded-lg border border-card-border/75 bg-bg/25 p-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-dim">Pares simulados</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {targetSymbols.length === 0 ? (
              <span className="text-xs text-muted">Nenhum par disponivel</span>
            ) : targetSymbols.map((symbol) => (
              <span key={symbol} className="rounded-full bg-card-border/70 px-2 py-1 font-mono-num text-[10px] font-bold text-white">
                {symbol}
              </span>
            ))}
          </div>
        </div>

        <button
          onClick={onRun}
          disabled={running || targetSymbols.length === 0}
          className="w-full rounded-lg border border-bull/35 bg-bull/15 px-4 py-3 text-sm font-black text-bull transition-colors hover:bg-bull/25 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {running ? 'Rodando...' : 'Rodar backtest'}
        </button>
      </div>
    </div>
  )
}

function SegmentedControl({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">{label}</div>
      <div className="grid gap-1 rounded-lg border border-card-border bg-bg/30 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`rounded-md px-2 py-2 text-xs font-bold transition-colors ${
              value === option.value ? 'bg-bull text-white' : 'text-muted hover:bg-card-hover hover:text-white'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function NumberField({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string
  value: number
  min: number
  max?: number
  suffix: string
  onChange: (value: number) => void
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-muted">{label}</span>
      <div className="flex items-center rounded-lg border border-card-border bg-bg focus-within:border-bull/50">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="min-w-0 flex-1 bg-transparent px-3 py-2 font-mono-num text-sm text-white outline-none"
        />
        <span className="px-3 text-[10px] font-bold text-muted">{suffix}</span>
      </div>
    </label>
  )
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-card-border bg-card/90 px-4 py-16 text-center">
      <div className="text-sm font-bold text-white">{title}</div>
      <div className="mx-auto mt-2 max-w-md text-sm text-muted">{text}</div>
    </div>
  )
}

function BacktestResults({ result }: { result: BacktestResult }) {
  const { stats, trades, equityCurve, perSymbol } = result
  const multiSymbol = Object.keys(perSymbol).length > 1
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Trades" value={String(stats.totalTrades)} />
        <StatCard label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} positive={stats.winRate >= 50} />
        <StatCard label="P&L Total" value={`${stats.totalPnlPercent >= 0 ? '+' : ''}${stats.totalPnlPercent.toFixed(2)}%`} positive={stats.totalPnlPercent >= 0} />
        <StatCard label="P&L Valor" value={`R$ ${stats.totalPnlValue.toFixed(2)}`} positive={stats.totalPnlValue >= 0} />
        <StatCard label="Profit Factor" value={stats.profitFactor.toFixed(2)} positive={stats.profitFactor >= 1} />
        <StatCard label="Sharpe" value={stats.sharpeRatio.toFixed(2)} positive={stats.sharpeRatio >= 0} />
        <StatCard label="Max Drawdown" value={`${stats.maxDrawdown.toFixed(2)}%`} positive={false} />
        <StatCard label="Best / Worst" value={`${stats.bestTrade >= 0 ? '+' : ''}${stats.bestTrade.toFixed(2)}% / ${stats.worstTrade.toFixed(2)}%`} />
      </div>
      {equityCurve.length > 1 && <EquityCurve data={equityCurve} />}
      {multiSymbol && <PerSymbolTable data={perSymbol} />}
      <TradeList trades={trades} />
    </div>
  )
}

function StatCard({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  const color = positive === undefined ? 'text-white' : positive ? 'text-bull' : 'text-bear'
  return (
    <div className="rounded-lg border border-card-border/75 bg-card/90 px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-dim">{label}</div>
      <div className={`mt-1 break-words font-mono-num text-lg font-black ${color}`}>{value}</div>
    </div>
  )
}

function EquityCurve({ data }: { data: { timestamp: number; equity: number }[] }) {
  const width = 650, height = 180
  const pad = { top: 20, right: 10, bottom: 20, left: 10 }
  const innerW = width - pad.left - pad.right, innerH = height - pad.top - pad.bottom
  const path = useMemo(() => {
    const minE = Math.min(...data.map(d => d.equity)), maxE = Math.max(...data.map(d => d.equity))
    const rangeE = maxE - minE || 1
    return data.map((d, i) => {
      const x = pad.left + (i / (data.length - 1)) * innerW
      const y = pad.top + innerH - ((d.equity - minE) / rangeE) * innerH
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
  }, [data, innerW, innerH, pad.left, pad.top])
  const fillPath = useMemo(() => {
    const minE = Math.min(...data.map(d => d.equity)), maxE = Math.max(...data.map(d => d.equity))
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
          <linearGradient id="backtestEqGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isPositive ? '#00c896' : '#ef4444'} stopOpacity="0.3" />
            <stop offset="100%" stopColor={isPositive ? '#00c896' : '#ef4444'} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={fillPath} fill="url(#backtestEqGrad)" />
        <path d={path} fill="none" stroke={isPositive ? '#00c896' : '#ef4444'} strokeWidth="2.5" />
      </svg>
      <div className="mt-1 flex justify-between px-1 font-mono-num text-[10px] text-muted">
        <span>{startEquity.toFixed(2)} USDT</span>
        <span className={isPositive ? 'text-bull' : 'text-bear'}>{endEquity.toFixed(2)} USDT</span>
      </div>
    </div>
  )
}

function PerSymbolTable({ data }: { data: Record<string, { trades: number; winRate: number; pnl: number }> }) {
  return (
    <div className="overflow-hidden rounded-xl border border-card-border bg-card/90">
      <div className="border-b border-card-border px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-muted">Por simbolo</div>
      <div className="overflow-x-auto">
        <table className="data-table w-full">
          <thead><tr>
            <th className="text-left">Simbolo</th><th className="text-right">Trades</th><th className="text-right">Win Rate</th><th className="text-right">P&L %</th>
          </tr></thead>
          <tbody>{Object.entries(data).map(([symbol, s]) => (
            <tr key={symbol}>
              <td className="font-bold">{symbol.replace('USDT', '')}</td>
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

function TradeList({ trades }: { trades: BacktestTrade[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-card-border bg-card/90">
      <div className="border-b border-card-border px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-muted">
        Trades (<span className="font-mono-num">{trades.length}</span>)
      </div>
      <div className="space-y-2 p-3 md:hidden">
        {trades.length === 0 ? (
          <div className="py-8 text-center text-muted">Nenhum trade encontrado</div>
        ) : trades.map((trade, i) => <BacktestTradeCard key={i} trade={trade} />)}
      </div>
      <div className="hidden max-h-[420px] overflow-x-auto overflow-y-auto md:block">
        <table className="data-table w-full">
          <thead className="sticky top-0 bg-card"><tr>
            <th className="text-left">Simbolo</th><th className="text-center">Dir</th><th className="text-right">Entrada</th>
            <th className="text-right">Saida</th><th className="text-center">Resultado</th><th className="text-right">P&L%</th>
            <th className="text-right">Score</th><th className="text-right">Data</th>
          </tr></thead>
          <tbody>{trades.map((t, i) => (
            <tr key={i}>
              <td className="font-bold">{t.symbol.replace('USDT', '')}</td>
              <td className={`text-center font-bold ${t.direction === 'LONG' ? 'text-bull' : 'text-bear'}`}>{t.direction === 'LONG' ? 'L' : 'S'}</td>
              <td className="text-right font-mono-num">{formatPrice(t.entryPrice)}</td>
              <td className="text-right font-mono-num">{formatPrice(t.exitPrice)}</td>
              <td className={`text-center font-bold ${t.result === 'WIN' ? 'text-bull' : 'text-bear'}`}>{t.result}</td>
              <td className={`text-right font-mono-num font-bold ${t.pnlPercent >= 0 ? 'text-bull' : 'text-bear'}`}>{t.pnlPercent >= 0 ? '+' : ''}{t.pnlPercent.toFixed(2)}%</td>
              <td className="text-right font-mono-num text-warn">{t.score.toFixed(0)}</td>
              <td className="text-right font-mono-num text-muted">{formatDate(t.entryTime)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  )
}

function BacktestTradeCard({ trade }: { trade: BacktestTrade }) {
  return (
    <div className="rounded-lg border border-card-border/75 bg-bg/25 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono-num text-sm font-black text-white">{trade.symbol}</div>
          <div className={`mt-1 text-xs font-bold ${trade.direction === 'LONG' ? 'text-bull' : 'text-bear'}`}>{trade.direction}</div>
        </div>
        <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${trade.result === 'WIN' ? 'bg-bull/15 text-bull' : 'bg-bear/15 text-bear'}`}>
          {trade.result}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <MiniMetric label="Entrada" value={formatPrice(trade.entryPrice)} />
        <MiniMetric label="Saida" value={formatPrice(trade.exitPrice)} />
        <MiniMetric label="P&L" value={`${trade.pnlPercent >= 0 ? '+' : ''}${trade.pnlPercent.toFixed(2)}%`} tone={trade.pnlPercent >= 0 ? 'bull' : 'bear'} />
        <MiniMetric label="Score" value={trade.score.toFixed(0)} tone="warn" />
      </div>
      <div className="mt-2 font-mono-num text-[10px] text-muted">{formatDate(trade.entryTime)}</div>
    </div>
  )
}

function MiniMetric({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'bull' | 'bear' | 'warn' | 'neutral' }) {
  const toneClass = tone === 'bull' ? 'text-bull' : tone === 'bear' ? 'text-bear' : tone === 'warn' ? 'text-warn' : 'text-white'
  return (
    <div>
      <div className="text-[10px] text-dim">{label}</div>
      <div className={`font-mono-num font-bold ${toneClass}`}>{value}</div>
    </div>
  )
}
