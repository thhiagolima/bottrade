import { useState, useMemo } from 'react'
import type { BacktestParams, BacktestResult, BacktestTrade } from '@bottrade/shared'
import { useStore } from '../store/useStore'
import { emitRunBacktest } from '../hooks/useSocket'
import { formatPrice, formatDate } from '../utils/format'

type Period = '7d' | '30d' | '90d'
type Scope = 'selected' | 'favorites'

export default function BacktestPanel() {
  const settings = useStore((s) => s.settings)
  const selectedPair = useStore((s) => s.selectedPair)
  const favorites = useStore((s) => s.favorites)
  const toggleBacktest = useStore((s) => s.toggleBacktest)
  const backtestResult = useStore((s) => s.backtestResult)
  const backtestRunning = useStore((s) => s.backtestRunning)
  const setBacktestResult = useStore((s) => s.setBacktestResult)
  const setBacktestRunning = useStore((s) => s.setBacktestRunning)

  const [period, setPeriod] = useState<Period>('30d')
  const [scope, setScope] = useState<Scope>('selected')
  const [scoreThreshold, setScoreThreshold] = useState(85)
  const [leverage, setLeverage] = useState(settings.leverage)
  const [capital, setCapital] = useState(settings.baseCapital)

  function runBacktest() {
    const symbols =
      scope === 'selected' && selectedPair
        ? [selectedPair]
        : favorites.length > 0
          ? favorites
          : selectedPair
            ? [selectedPair]
            : []

    if (symbols.length === 0) return

    const params: BacktestParams = {
      symbols,
      period,
      scoreThreshold,
      leverage,
      baseCapital: capital,
    }

    setBacktestRunning(true)
    setBacktestResult(null)
    emitRunBacktest(params, (result) => {
      setBacktestResult(result)
      setBacktestRunning(false)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={toggleBacktest} />

      {/* Drawer */}
      <div className="relative w-full md:w-[700px] max-w-full h-full bg-bg border-l border-card-border overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b border-card-border bg-card">
          <h2 className="text-base font-bold">Backtest</h2>
          <button
            onClick={toggleBacktest}
            className="p-1.5 rounded-lg hover:bg-card-border transition-colors text-muted"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Config Section */}
        <div className="p-5 space-y-4 border-b border-card-border">
          {/* Period */}
          <div>
            <label className="block text-xs text-muted mb-1.5">Periodo</label>
            <div className="flex gap-2">
              {(['7d', '30d', '90d'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    period === p
                      ? 'bg-bull/20 text-bull border border-bull/40'
                      : 'bg-card border border-card-border text-muted hover:border-bull/30'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Scope */}
          <div>
            <label className="block text-xs text-muted mb-1.5">Escopo</label>
            <div className="flex gap-2">
              <button
                onClick={() => setScope('selected')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  scope === 'selected'
                    ? 'bg-bull/20 text-bull border border-bull/40'
                    : 'bg-card border border-card-border text-muted hover:border-bull/30'
                }`}
              >
                Par selecionado
              </button>
              <button
                onClick={() => setScope('favorites')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  scope === 'favorites'
                    ? 'bg-bull/20 text-bull border border-bull/40'
                    : 'bg-card border border-card-border text-muted hover:border-bull/30'
                }`}
              >
                Todos os favoritos
              </button>
            </div>
          </div>

          {/* Number inputs row */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1.5">Score minimo</label>
              <input
                type="number"
                min={50}
                max={100}
                value={scoreThreshold}
                onChange={(e) => setScoreThreshold(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-lg bg-card border border-card-border text-sm font-mono-num focus:outline-none focus:border-bull/50"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1.5">Alavancagem</label>
              <input
                type="number"
                min={1}
                max={125}
                value={leverage}
                onChange={(e) => setLeverage(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-lg bg-card border border-card-border text-sm font-mono-num focus:outline-none focus:border-bull/50"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1.5">Capital (USDT)</label>
              <input
                type="number"
                min={1}
                value={capital}
                onChange={(e) => setCapital(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-lg bg-card border border-card-border text-sm font-mono-num focus:outline-none focus:border-bull/50"
              />
            </div>
          </div>

          {/* Run button */}
          <button
            onClick={runBacktest}
            disabled={backtestRunning}
            className={`w-full py-2.5 rounded-lg text-sm font-bold transition-colors ${
              backtestRunning
                ? 'bg-card border border-card-border text-muted cursor-not-allowed'
                : 'bg-bull/20 text-bull border border-bull/40 hover:bg-bull/30'
            }`}
          >
            {backtestRunning ? 'Rodando...' : 'Rodar Backtest'}
          </button>
        </div>

        {/* Results Section */}
        {backtestResult && <BacktestResults result={backtestResult} />}
      </div>
    </div>
  )
}

/* ── Results Sub-component ────────────────────────── */

function BacktestResults({ result }: { result: BacktestResult }) {
  const { stats, trades, equityCurve, perSymbol } = result
  const multiSymbol = Object.keys(perSymbol).length > 1

  return (
    <div className="p-5 space-y-5">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <StatCard label="Trades" value={String(stats.totalTrades)} />
        <StatCard label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} positive={stats.winRate >= 50} />
        <StatCard label="P&L Total" value={`${stats.totalPnlPercent >= 0 ? '+' : ''}${stats.totalPnlPercent.toFixed(2)}%`} positive={stats.totalPnlPercent >= 0} />
        <StatCard label="P&L Valor" value={`R$ ${stats.totalPnlValue.toFixed(2)}`} positive={stats.totalPnlValue >= 0} />
        <StatCard label="Profit Factor" value={stats.profitFactor.toFixed(2)} positive={stats.profitFactor >= 1} />
        <StatCard label="Sharpe" value={stats.sharpeRatio.toFixed(2)} positive={stats.sharpeRatio >= 0} />
        <StatCard label="Max Drawdown" value={`${stats.maxDrawdown.toFixed(2)}%`} positive={false} />
        <StatCard label="Best / Worst" value={`${stats.bestTrade >= 0 ? '+' : ''}${stats.bestTrade.toFixed(2)}% / ${stats.worstTrade.toFixed(2)}%`} />
      </div>

      {/* Equity Curve */}
      {equityCurve.length > 1 && <EquityCurve data={equityCurve} />}

      {/* Per Symbol Breakdown */}
      {multiSymbol && <PerSymbolTable data={perSymbol} />}

      {/* Trade List */}
      <TradeList trades={trades} />
    </div>
  )
}

/* ── Stat Card ────────────────────────── */

function StatCard({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  const color =
    positive === undefined ? 'text-white' : positive ? 'text-bull' : 'text-bear'

  return (
    <div className="bg-card border border-card-border rounded-lg p-2.5">
      <div className="text-[10px] text-muted mb-0.5">{label}</div>
      <div className={`text-sm font-bold font-mono-num ${color}`}>{value}</div>
    </div>
  )
}

/* ── Equity Curve (SVG) ────────────────────────── */

function EquityCurve({ data }: { data: { timestamp: number; equity: number }[] }) {
  const width = 650
  const height = 160
  const pad = { top: 20, right: 10, bottom: 20, left: 10 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom

  const path = useMemo(() => {
    const minE = Math.min(...data.map((d) => d.equity))
    const maxE = Math.max(...data.map((d) => d.equity))
    const rangeE = maxE - minE || 1

    return data
      .map((d, i) => {
        const x = pad.left + (i / (data.length - 1)) * innerW
        const y = pad.top + innerH - ((d.equity - minE) / rangeE) * innerH
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
  }, [data, innerW, innerH, pad.left, pad.top])

  const startEquity = data[0].equity
  const endEquity = data[data.length - 1].equity

  return (
    <div>
      <div className="text-xs text-muted mb-1.5">Curva de Equity</div>
      <div className="bg-card border border-card-border rounded-lg p-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none">
          <path d={path} fill="none" stroke="#00c896" strokeWidth="2" />
        </svg>
        <div className="flex justify-between text-[10px] text-muted font-mono-num mt-1 px-1">
          <span>{startEquity.toFixed(2)} USDT</span>
          <span className={endEquity >= startEquity ? 'text-bull' : 'text-bear'}>
            {endEquity.toFixed(2)} USDT
          </span>
        </div>
      </div>
    </div>
  )
}

/* ── Per Symbol Table ────────────────────────── */

function PerSymbolTable({ data }: { data: Record<string, { trades: number; winRate: number; pnl: number }> }) {
  const entries = Object.entries(data)

  return (
    <div>
      <div className="text-xs text-muted mb-1.5">Por Simbolo</div>
      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-card-border text-muted">
              <th className="text-left px-3 py-1.5 font-medium">Simbolo</th>
              <th className="text-right px-3 py-1.5 font-medium">Trades</th>
              <th className="text-right px-3 py-1.5 font-medium">Win Rate</th>
              <th className="text-right px-3 py-1.5 font-medium">P&L %</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([symbol, s]) => (
              <tr key={symbol} className="border-b border-card-border last:border-0">
                <td className="px-3 py-1.5 font-bold">{symbol.replace('USDT', '')}</td>
                <td className="text-right px-3 py-1.5 font-mono-num">{s.trades}</td>
                <td className={`text-right px-3 py-1.5 font-mono-num ${s.winRate >= 50 ? 'text-bull' : 'text-bear'}`}>
                  {s.winRate.toFixed(1)}%
                </td>
                <td className={`text-right px-3 py-1.5 font-mono-num ${s.pnl >= 0 ? 'text-bull' : 'text-bear'}`}>
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

/* ── Trade List ────────────────────────── */

function TradeList({ trades }: { trades: BacktestTrade[] }) {
  return (
    <div>
      <div className="text-xs text-muted mb-1.5">Trades ({trades.length})</div>
      <div className="bg-card border border-card-border rounded-lg overflow-hidden max-h-[320px] overflow-y-auto">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 bg-card">
            <tr className="border-b border-card-border text-muted">
              <th className="text-left px-2 py-1.5 font-medium">Simbolo</th>
              <th className="text-center px-2 py-1.5 font-medium">Dir</th>
              <th className="text-right px-2 py-1.5 font-medium">Entrada</th>
              <th className="text-right px-2 py-1.5 font-medium">Saida</th>
              <th className="text-center px-2 py-1.5 font-medium">Resultado</th>
              <th className="text-right px-2 py-1.5 font-medium">P&L%</th>
              <th className="text-right px-2 py-1.5 font-medium">Score</th>
              <th className="text-right px-2 py-1.5 font-medium">Data</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t, i) => (
              <tr key={i} className="border-b border-card-border last:border-0 hover:bg-card-border/30">
                <td className="px-2 py-1 font-bold">{t.symbol.replace('USDT', '')}</td>
                <td className={`text-center px-2 py-1 font-bold ${t.direction === 'LONG' ? 'text-bull' : 'text-bear'}`}>
                  {t.direction === 'LONG' ? 'L' : 'S'}
                </td>
                <td className="text-right px-2 py-1 font-mono-num">{formatPrice(t.entryPrice)}</td>
                <td className="text-right px-2 py-1 font-mono-num">{formatPrice(t.exitPrice)}</td>
                <td className={`text-center px-2 py-1 font-bold ${t.result === 'WIN' ? 'text-bull' : 'text-bear'}`}>
                  {t.result}
                </td>
                <td className={`text-right px-2 py-1 font-mono-num ${t.pnlPercent >= 0 ? 'text-bull' : 'text-bear'}`}>
                  {t.pnlPercent >= 0 ? '+' : ''}{t.pnlPercent.toFixed(2)}%
                </td>
                <td className="text-right px-2 py-1 font-mono-num text-warn">{t.score.toFixed(0)}</td>
                <td className="text-right px-2 py-1 font-mono-num text-muted">{formatDate(t.entryTime)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
