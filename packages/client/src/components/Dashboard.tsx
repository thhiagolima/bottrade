import { useStore } from '../store/useStore'
import TopBar from './TopBar'
import AppSidebar from './AppSidebar'
import PairDetail from './PairDetail'
import CompareView from './CompareView'
import SettingsPage from './SettingsPage'
import TradesPage from './TradesPage'
import PaperPage from './PaperPage'
import BacktestPage from './BacktestPage'
import AlertsPage from './AlertsPage'
import AdminPage from './AdminPage'
import { formatPrice, formatVolume } from '../utils/format'
import type { PairAnalysis, BasicPairData } from '@bottrade/shared'

export default function Dashboard() {
  const currentPage = useStore((s) => s.currentPage)

  return (
    <div className="h-screen flex flex-col bg-bg">
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        {currentPage === 'dashboard' && <DashboardOverview />}
        {currentPage === 'trade' && <DashboardPage />}
        {(currentPage === 'signals' || currentPage === 'trades') && <TradesPage />}
        {currentPage === 'paper' && <PaperPage />}
        {currentPage === 'backtest' && <BacktestPage />}
        {currentPage === 'settings' && <SettingsPage />}
        {currentPage === 'alerts' && <AlertsPage />}
        {currentPage === 'admin' && <AdminPage />}
      </div>
    </div>
  )
}

function getSignalTone(direction?: string) {
  if (direction === 'LONG') return { text: 'text-bull', bg: 'bg-bull/15', border: 'border-bull/40', bar: 'bg-bull' }
  if (direction === 'SHORT') return { text: 'text-bear', bg: 'bg-bear/15', border: 'border-bear/40', bar: 'bg-bear' }
  return { text: 'text-warn', bg: 'bg-warn/15', border: 'border-warn/30', bar: 'bg-warn' }
}

function shortAsset(symbol: string) {
  return symbol.replace(/USDT$/, '').replace(/USDC$/, '')
}

function DashboardOverview() {
  const pairs = useStore((s) => s.pairs)
  const allPairs = useStore((s) => s.allPairs)
  const favorites = useStore((s) => s.favorites)
  const selectedPair = useStore((s) => s.selectedPair)
  const selectPair = useStore((s) => s.selectPair)
  const navigateTo = useStore((s) => s.navigateTo)
  const openTrades = useStore((s) => s.openTrades)
  const globalStats = useStore((s) => s.globalStats)
  const tradeStats = useStore((s) => s.tradeStats)

  const favoriteRows = favorites
    .map((symbol) => pairs[symbol])
    .filter(Boolean) as PairAnalysis[]

  const marketCards = Object.values(allPairs)
    .filter((pair) => pair.symbol.endsWith('USDT') && pair.price > 0)
    .sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h))
    .slice(0, 4)

  const activeTrades = Object.values(openTrades)
  const activeLongs = activeTrades.filter((trade) => trade.direction === 'LONG').length
  const activeShorts = activeTrades.filter((trade) => trade.direction === 'SHORT').length
  const wins = Object.values(tradeStats).reduce((sum, stat) => sum + (stat.wins ?? 0), 0)
  const losses = Object.values(tradeStats).reduce((sum, stat) => sum + (stat.losses ?? 0), 0)
  const winRate = wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0

  const openAnalysis = (symbol: string) => {
    selectPair(symbol)
    navigateTo('trade')
  }

  return (
    <main className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(88,166,255,0.10),transparent_34%),var(--color-bg)]">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 md:px-8 md:py-8 space-y-6">
        <section className="flex flex-col gap-1">
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-accent">Mission Control</div>
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">Dashboard Central</h1>
              <p className="text-sm text-muted mt-1">Acompanhe sua watchlist, sinais e paper trades em tempo real.</p>
            </div>
            <button
              onClick={() => navigateTo('trade')}
              className="w-full md:w-auto rounded-lg border border-accent/40 bg-accent/15 px-4 py-2 text-xs font-bold text-white hover:bg-accent/25 transition-colors"
            >
              Abrir analise do par
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <OverviewMetric
            label="Pares monitorados"
            value={String(favorites.length)}
            detail={`${Object.keys(allPairs).length} pares em Todos`}
          />
          <OverviewMetric
            label="Trades ativos"
            value={String(activeTrades.length)}
            detail={`${activeLongs} Long / ${activeShorts} Short`}
          />
          <OverviewMetric
            label="Win rate"
            value={winRate > 0 ? `${winRate.toFixed(1)}%` : '--'}
            detail={globalStats ? `${globalStats.totalTrades} trades no total` : 'Aguardando historico'}
            positive={winRate >= 50 && winRate > 0}
          />
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-white tracking-tight">Market Overview</h2>
            <button onClick={() => navigateTo('trade')} className="text-xs font-bold text-accent hover:text-white">Ver watchlist</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {marketCards.map((pair) => (
              <MarketCard key={pair.symbol} pair={pair} onClick={() => openAnalysis(pair.symbol)} />
            ))}
            {marketCards.length === 0 && (
              <div className="col-span-full rounded-xl border border-card-border bg-card/70 p-5 text-sm text-muted">
                Carregando snapshot de mercado...
              </div>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-card-border bg-card/80 overflow-hidden">
          <div className="flex items-center justify-between border-b border-card-border px-4 py-3">
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">Watchlist Signals</h2>
              <p className="text-xs text-muted">Sinais calculados para os pares escolhidos no onboarding/favoritos.</p>
            </div>
            <button onClick={() => navigateTo('trade')} className="hidden sm:block rounded-lg border border-card-border px-3 py-1.5 text-xs font-bold text-muted hover:text-white">
              Analisar
            </button>
          </div>

          <div className="hidden md:grid grid-cols-[1.2fr_1fr_1fr_1fr_1fr] px-4 py-2 text-[11px] uppercase tracking-wider text-muted font-bold">
            <span>Par</span>
            <span>Preco</span>
            <span>Volume 24h</span>
            <span>Sinal</span>
            <span>Confianca</span>
          </div>

          <div className="divide-y divide-card-border/70">
            {favoriteRows.map((analysis) => (
              <SignalRow
                key={analysis.symbol}
                analysis={analysis}
                selected={selectedPair === analysis.symbol}
                onClick={() => openAnalysis(analysis.symbol)}
              />
            ))}
            {favoriteRows.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-muted">
                Nenhum favorito com analise carregada ainda.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

function OverviewMetric({ label, value, detail, positive }: { label: string; value: string; detail: string; positive?: boolean }) {
  return (
    <div className="rounded-xl border border-card-border bg-card/80 p-5 relative overflow-hidden">
      <div className="absolute right-4 top-4 h-16 w-16 rounded-2xl bg-accent/10" />
      <div className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</div>
      <div className={`mt-3 text-3xl font-black font-mono-num ${positive ? 'text-bull' : 'text-white'}`}>{value}</div>
      <div className="mt-2 text-xs text-muted">{detail}</div>
    </div>
  )
}

function MarketCard({ pair, onClick }: { pair: BasicPairData; onClick: () => void }) {
  const positive = pair.change24h >= 0
  const tone = positive ? 'border-l-bull' : 'border-l-bear'
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border border-card-border border-l-4 ${tone} bg-card/80 p-4 text-left hover:border-card-border-hover transition-colors min-w-0`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-xs font-black text-accent">
              {shortAsset(pair.symbol).slice(0, 1)}
            </span>
            <div className="min-w-0">
              <div className="truncate text-lg font-black text-white">{shortAsset(pair.symbol)}</div>
              <div className="text-xs text-muted">USDT Perp</div>
            </div>
          </div>
          <div className="mt-4 text-xl font-black font-mono-num text-white">{formatPrice(pair.price)}</div>
        </div>
        <span className={`font-mono-num text-sm font-bold ${positive ? 'text-bull' : 'text-bear'}`}>
          {positive ? '+' : ''}{pair.change24h.toFixed(2)}%
        </span>
      </div>
      <div className="mt-4 flex h-10 items-end gap-1 opacity-80">
        {[28, 38, 32, 44, 52, 48, 60, 72].map((height, i) => (
          <span key={i} className={`flex-1 rounded-sm ${positive ? 'bg-bull/70' : 'bg-bear/70'}`} style={{ height: `${height}%` }} />
        ))}
      </div>
    </button>
  )
}

function SignalRow({ analysis, selected, onClick }: { analysis: PairAnalysis; selected: boolean; onClick: () => void }) {
  const direction = analysis.signal.direction
  const tone = getSignalTone(direction)
  const score = analysis.signal.confluenceScore
  return (
    <button
      onClick={onClick}
      className={`w-full grid grid-cols-1 md:grid-cols-[1.2fr_1fr_1fr_1fr_1fr] gap-2 md:gap-4 px-4 py-4 text-left hover:bg-card-hover transition-colors ${selected ? 'bg-accent/5' : ''}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg text-sm font-black text-white">
          {shortAsset(analysis.symbol).slice(0, 1)}
        </span>
        <div className="min-w-0">
          <div className="text-base font-black text-white truncate">{shortAsset(analysis.symbol)} <span className="text-muted font-bold">/USDT</span></div>
          <div className="md:hidden text-xs text-muted mt-1">Vol: {formatVolume(analysis.price.volume24h)}</div>
        </div>
      </div>
      <div className="font-mono-num text-sm text-white md:self-center">{formatPrice(analysis.price.price)}</div>
      <div className="hidden md:block font-mono-num text-sm text-muted self-center">{formatVolume(analysis.price.volume24h)}</div>
      <div className="self-center">
        <span className={`inline-flex rounded-md border px-2 py-1 text-[11px] font-black ${tone.bg} ${tone.border} ${tone.text}`}>
          {direction}
        </span>
      </div>
      <div className="flex items-center gap-2 self-center">
        <span className={`w-10 text-sm font-black font-mono-num ${tone.text}`}>{score.toFixed(0)}%</span>
        <span className="h-1.5 flex-1 rounded-full bg-card-border overflow-hidden">
          <span className={`block h-full ${tone.bar}`} style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
        </span>
      </div>
    </button>
  )
}

/* -- DashboardPage: the existing sidebar + pair detail layout ------ */

function DashboardPage() {
  const pairs = useStore((s) => s.pairs)
  const selectedPair = useStore((s) => s.selectedPair)
  const compareMode = useStore((s) => s.compareMode)
  const comparePairs = useStore((s) => s.comparePairs)
  const mobileSidebarOpen = useStore((s) => s.mobileSidebarOpen)
  const closeMobileSidebar = useStore((s) => s.closeMobileSidebar)
  const tempAnalysis = useStore((s) => s.tempAnalysis)

  const analysis = selectedPair
    ? (pairs[selectedPair] ?? (tempAnalysis?.symbol === selectedPair ? tempAnalysis : null))
    : null

  return (
    <div className="flex flex-1 overflow-hidden h-full">
      {/* Mobile sidebar backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden cursor-pointer"
          onClick={closeMobileSidebar}
        />
      )}

      {/* Sidebar */}
      <div className={`
        ${mobileSidebarOpen ? 'fixed inset-y-0 left-0 z-50 flex' : 'hidden'}
        md:relative md:flex md:z-auto
      `}>
        <AppSidebar />
      </div>

      {/* Main content */}
      {compareMode && comparePairs.length > 0 ? (
        <CompareView />
      ) : analysis ? (
        <PairDetail analysis={analysis} />
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted text-sm md:text-base px-4 text-center">
          {compareMode ? 'Selecione pares na sidebar para comparar' : 'Selecione um par na sidebar'}
        </div>
      )}
    </div>
  )
}
