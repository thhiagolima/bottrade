import { useCallback, useEffect, useRef, useState } from 'react'

interface LandingPageProps {
  onSignup: () => void
  onLogin: () => void
  onTerms?: () => void
  onPrivacy?: () => void
}

/* ─── Intersection Observer Hook for Scroll Animations ─── */
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.15 }
    )
    el.querySelectorAll('.reveal-on-scroll').forEach((child) =>
      observer.observe(child)
    )
    return () => observer.disconnect()
  }, [])
  return ref
}

/* ─── SVG Icons ─── */
const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-bull)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

const IconX = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-bear)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

const IconWarn = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-warn)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)

const IconChevron = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
)

const IconBrain = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a5 5 0 0 1 4.546 2.914A4 4 0 0 1 18 11a4.002 4.002 0 0 1-1.382 3.025A5.002 5.002 0 0 1 12 18a5.002 5.002 0 0 1-4.618-3.975A4.002 4.002 0 0 1 6 11a4 4 0 0 1 1.454-6.086A5 5 0 0 1 12 2z"/>
    <path d="M12 2v16M8 6.5l8 5M8 11.5l8-5"/>
  </svg>
)

const IconShield = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <polyline points="9 12 11 14 15 10"/>
  </svg>
)

const IconTarget = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
  </svg>
)

const IconBarChart = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
)

const IconLock = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
)

const IconShieldAuth = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
)

const IconDatabase = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
  </svg>
)

const IconSearch = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)

const IconClose = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

const IconFire = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2c.5 3.5-1.5 6-1.5 6s2 1.5 2.5 4c.5 2.5-1.5 4.5-3 5-1.5.5-3-.5-3-2.5 0-1.5 1-3 1-3S6 13 6 10c0-4.5 6-8 6-8z"/>
  </svg>
)

const IconQuote = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="var(--color-accent)" opacity="0.3">
    <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983z"/>
  </svg>
)

const IconStar = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--color-warn)" stroke="var(--color-warn)" strokeWidth="1">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
)

/* ─── API types for demo feed ─── */
interface FeedSignal {
  symbol: string
  direction: 'LONG' | 'SHORT'
  score: number
  confidence: 'normal' | 'high'
  timestamp: number
}

interface FeedApiResponse {
  signals: FeedSignal[]
  stats: {
    totalUsers: number
    signalsToday: number
    activeNow: number
  }
}

/* ─── Live Signal Feed Component ─── */
function LiveSignalFeed() {
  const [signals, setSignals] = useState<FeedSignal[]>([])
  const [loading, setLoading] = useState(true)

  const fetchFeed = useCallback(() => {
    fetch('/api/demo/feed')
      .then((res) => { if (!res.ok) throw new Error('feed error'); return res.json() })
      .then((json: FeedApiResponse) => {
        setSignals(json.signals.slice(0, 8))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchFeed()
    const interval = setInterval(fetchFeed, 30000)
    return () => clearInterval(interval)
  }, [fetchFeed])

  const relativeTime = (ts: number) => {
    const diff = Math.floor((Date.now() - ts) / 60000)
    if (diff < 1) return 'agora'
    return `há ${diff} min`
  }

  const dirColor = (dir: string) =>
    dir === 'LONG' ? 'var(--color-bull)' : 'var(--color-bear)'

  // Fallback mock data when API is unavailable
  const displaySignals: FeedSignal[] = signals.length > 0 ? signals : [
    { symbol: 'ETHUSDT', direction: 'LONG', score: 87, confidence: 'high', timestamp: Date.now() - 3 * 60000 },
    { symbol: 'SOLUSDT', direction: 'SHORT', score: 22, confidence: 'normal', timestamp: Date.now() - 8 * 60000 },
    { symbol: 'BNBUSDT', direction: 'LONG', score: 91, confidence: 'high', timestamp: Date.now() - 12 * 60000 },
    { symbol: 'BTCUSDT', direction: 'LONG', score: 68, confidence: 'normal', timestamp: Date.now() - 15 * 60000 },
    { symbol: 'XRPUSDT', direction: 'SHORT', score: 31, confidence: 'normal', timestamp: Date.now() - 20 * 60000 },
    { symbol: 'AVAXUSDT', direction: 'LONG', score: 78, confidence: 'high', timestamp: Date.now() - 25 * 60000 },
  ]

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        className="rounded-xl border border-[var(--color-card-border)] overflow-hidden"
        style={{ background: 'var(--color-card)' }}
      >
        <div className="px-4 py-3 border-b border-[var(--color-card-border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-bull status-dot-live" />
            <span className="font-display text-sm font-bold text-[var(--color-text)]">
              Leituras de mercado agora
            </span>
          </div>
          {loading && <span className="text-[10px] text-muted font-body">Carregando...</span>}
        </div>
        <div className="divide-y divide-[var(--color-card-border)]">
          {displaySignals.map((sig, i) => (
            <div
              key={`${sig.symbol}-${i}`}
              className={`px-4 py-2.5 flex items-center justify-between hover:bg-[var(--color-card-hover)] transition-colors duration-200 ${i === 0 ? 'signal-pulse-newest' : ''}`}
            >
              <div className="flex items-center gap-3">
                <span
                  className="text-[10px] font-display font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{
                    color: dirColor(sig.direction),
                    background: sig.direction === 'LONG' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  }}
                >
                  {sig.direction}
                </span>
                <span className="font-display text-sm font-bold text-[var(--color-text)]">{sig.symbol}</span>
                <span className="font-mono text-sm font-bold" style={{ color: dirColor(sig.direction) }}>{sig.score}</span>
                {sig.confidence === 'high' && (
                  <span className="text-[10px] font-display font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-accent bg-accent/10">
                    ALTA CONFLUENCIA
                  </span>
                )}
              </div>
              <span className="text-[11px] text-muted font-body whitespace-nowrap">{relativeTime(sig.timestamp)}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted font-body text-center mt-3">
        Leituras geradas a partir dos indicadores monitorados nas ultimas horas.
      </p>
    </div>
  )
}

/* ─── Live Counters Component ─── */
function LiveCounters() {
  const [stats, setStats] = useState({ traders: 0, signalsToday: 0, online: 0 })

  useEffect(() => {
    fetch('/api/demo/feed')
      .then((res) => { if (!res.ok) throw new Error('stats error'); return res.json() })
      .then((json: FeedApiResponse) => {
        if (json.stats) {
          setStats({
            traders: Number(json.stats.totalUsers) || 0,
            signalsToday: Number(json.stats.signalsToday) || 0,
            online: Number(json.stats.activeNow) || 0,
          })
        }
      })
      .catch(() => { /* keep defaults */ })
  }, [])

  const safeNum = (n: number) => Number.isFinite(n) ? n : 0
  const tradersUp = useCountUp(safeNum(stats.traders), 2000)
  const signalsUp = useCountUp(safeNum(stats.signalsToday), 2500)
  const onlineUp = useCountUp(safeNum(stats.online), 1500)

  return (
    <div className="grid grid-cols-3 gap-4 sm:gap-6 max-w-2xl mx-auto">
      <div className="rounded-xl border border-[var(--color-card-border)] p-4 sm:p-6 text-center" style={{ background: 'var(--color-card)' }}>
        <span ref={tradersUp.ref} className="font-mono text-2xl sm:text-3xl font-bold text-[var(--color-text)] block">
          {safeNum(tradersUp.count).toLocaleString()}+
        </span>
        <span className="text-xs sm:text-sm text-muted font-body mt-1 block">usuarios acompanhando</span>
      </div>
      <div className="rounded-xl border border-[var(--color-card-border)] p-4 sm:p-6 text-center" style={{ background: 'var(--color-card)' }}>
        <span ref={signalsUp.ref} className="font-mono text-2xl sm:text-3xl font-bold text-[var(--color-text)] block">
          {safeNum(signalsUp.count).toLocaleString()}
        </span>
        <span className="text-xs sm:text-sm text-muted font-body mt-1 block">leituras hoje</span>
      </div>
      <div className="rounded-xl border border-[var(--color-card-border)] p-4 sm:p-6 text-center" style={{ background: 'var(--color-card)' }}>
        <div className="flex items-center justify-center gap-1.5">
          <span ref={onlineUp.ref} className="font-mono text-2xl sm:text-3xl font-bold text-[var(--color-text)]">
            {safeNum(onlineUp.count)}
          </span>
          <div className="w-2 h-2 rounded-full bg-bull status-dot-live" />
        </div>
        <span className="text-xs sm:text-sm text-muted font-body mt-1 block">online agora</span>
      </div>
    </div>
  )
}

/* ─── Mini CTA Link ─── */
function MiniCta({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <div className="reveal-on-scroll text-center mt-6">
      <button
        onClick={onClick}
        className="text-sm font-body text-accent hover:text-accent/80 transition-colors duration-200 cursor-pointer group"
      >
        {text}{' '}
        <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">&rarr;</span>
      </button>
    </div>
  )
}

/* ─── Animated Counter Hook ─── */
function useCountUp(target: number, duration: number = 2000, startOnMount: boolean = false) {
  const safeTarget = Number.isFinite(target) ? target : 0
  const [count, setCount] = useState(startOnMount ? 0 : safeTarget)
  const [started, setStarted] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (startOnMount || started) return
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setStarted(true)
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.5 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [startOnMount, started])

  useEffect(() => {
    if (!started && !startOnMount) return
    let start = 0
    const startTime = performance.now()
    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      start = Math.floor(eased * safeTarget)
      setCount(Number.isFinite(start) ? start : 0)
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [started, startOnMount, safeTarget, duration])

  return { count, ref }
}

/* ─── Live Demo Component (fetches real data from API) ─── */
const DEMO_PAIRS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT'] as const

interface DemoApiResponse {
  symbol: string
  price: number
  change24h: number
  volume24h: number
  indicators: Record<string, unknown>
  signal: {
    direction: 'LONG' | 'SHORT' | 'NEUTRO'
    confluenceScore: number
    confidence: 'normal' | 'high'
    criticalDecision: string
    actionPoints: string[]
    riskManagement: {
      entry: number
      stopLoss: number
      takeProfit: number
      stopLossPercent: number
      takeProfitPercent: number
      positionSize: number
      margin: number
      riskRewardRatio: number
      leverage: number
    } | null
  }
}

const IconRefresh = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
)

function LiveDemo() {
  const [selectedPair, setSelectedPair] = useState('ETHUSDT')
  const [data, setData] = useState<DemoApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAnalysis = (symbol: string) => {
    setLoading(true)
    setError(null)
    fetch(`/api/demo/analyze/${symbol}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 429 ? 'Limite de requisições atingido. Aguarde 1 minuto.' : 'Falha ao analisar par')
        return res.json()
      })
      .then((json: DemoApiResponse) => {
        setData(json)
        setLoading(false)
      })
      .catch((err: Error) => {
        setError(err.message)
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchAnalysis(selectedPair)
  }, [selectedPair])

  const handleRefresh = () => fetchAnalysis(selectedPair)

  const formatPrice = (p: number) => {
    if (p >= 1000) return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    if (p >= 1) return '$' + p.toFixed(4)
    return '$' + p.toPrecision(4)
  }

  const dirColor = (dir: string) =>
    dir === 'LONG' ? 'var(--color-bull)' : dir === 'SHORT' ? 'var(--color-bear)' : 'var(--color-warn)'

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <div className="absolute -inset-4 rounded-2xl bg-accent/5 blur-2xl" />
      <div
        className="relative rounded-xl overflow-hidden border border-[var(--color-card-border)]"
        style={{ background: 'var(--color-card)' }}
      >
        {/* Window chrome */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--color-card-border)]">
          <div className="w-2.5 h-2.5 rounded-full bg-bear/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-warn/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-bull/60" />
          <span className="ml-2 text-xs text-muted font-body">Bottrade Dashboard — Live Demo</span>
          <button
            onClick={handleRefresh}
            className="ml-auto text-muted hover:text-accent transition-colors duration-200 cursor-pointer"
            title="Atualizar análise"
          >
            <IconRefresh />
          </button>
        </div>

        {/* Pair pills */}
        <div className="px-4 pt-3 pb-1 flex flex-wrap gap-1.5">
          {DEMO_PAIRS.map((pair) => (
            <button
              key={pair}
              onClick={() => setSelectedPair(pair)}
              className={`text-[11px] font-display font-semibold px-2.5 py-1 rounded-full transition-all duration-200 cursor-pointer ${
                selectedPair === pair
                  ? 'bg-accent text-white shadow-[0_0_12px_rgba(99,102,241,0.3)]'
                  : 'text-muted hover:text-[var(--color-text)] border border-[var(--color-card-border)] hover:border-accent/50'
              }`}
            >
              {pair.replace('USDT', '')}
            </button>
          ))}
        </div>

        {/* Content area */}
        <div className="p-4 space-y-3 min-h-[260px]">
          {loading && (
            <div className="space-y-3 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="h-5 w-20 rounded bg-[var(--color-card-border)]" />
                <div className="h-6 w-28 rounded bg-[var(--color-card-border)]" />
                <div className="h-4 w-14 rounded bg-[var(--color-card-border)]" />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <div className="h-3 w-32 rounded bg-[var(--color-card-border)]" />
                  <div className="h-5 w-12 rounded bg-[var(--color-card-border)]" />
                </div>
                <div className="h-2 w-full rounded-full bg-[var(--color-card-border)]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-[var(--color-card-border)] p-3 space-y-2" style={{ background: 'var(--color-bg)' }}>
                  <div className="h-3 w-20 rounded bg-[var(--color-card-border)]" />
                  <div className="h-3 w-full rounded bg-[var(--color-card-border)]" />
                  <div className="h-3 w-full rounded bg-[var(--color-card-border)]" />
                  <div className="h-3 w-3/4 rounded bg-[var(--color-card-border)]" />
                </div>
                <div className="rounded-lg border border-[var(--color-card-border)] p-3 space-y-2" style={{ background: 'var(--color-bg)' }}>
                  <div className="h-3 w-20 rounded bg-[var(--color-card-border)]" />
                  <div className="h-3 w-full rounded bg-[var(--color-card-border)]" />
                  <div className="h-3 w-full rounded bg-[var(--color-card-border)]" />
                  <div className="h-3 w-3/4 rounded bg-[var(--color-card-border)]" />
                </div>
              </div>
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <IconWarn />
              <p className="text-sm text-muted font-body text-center">{error}</p>
              <button
                onClick={handleRefresh}
                className="text-xs text-accent hover:underline cursor-pointer font-body"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {data && !loading && !error && (
            <>
              {/* Price header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-display text-base font-bold text-[var(--color-text)]">{data.symbol}</span>
                  <span className="font-mono text-lg font-semibold" style={{ color: data.change24h >= 0 ? 'var(--color-bull)' : 'var(--color-bear)' }}>
                    {formatPrice(data.price)}
                  </span>
                  <span className="text-xs font-mono" style={{ color: data.change24h >= 0 ? 'var(--color-bull)' : 'var(--color-bear)' }}>
                    {data.change24h >= 0 ? '+' : ''}{data.change24h.toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] font-display font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{
                      color: dirColor(data.signal.direction),
                      background: data.signal.direction === 'LONG' ? 'rgba(34,197,94,0.1)' : data.signal.direction === 'SHORT' ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.1)',
                    }}
                  >
                    {data.signal.direction}
                  </span>
                  {data.signal.confidence === 'high' && (
                    <span className="text-[10px] font-display font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-accent bg-accent/10">
                      Alta confiança
                    </span>
                  )}
                </div>
              </div>

              {/* Score bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted font-body uppercase tracking-wider">Score de Confluência</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold font-display" style={{ color: dirColor(data.signal.direction) }}>{data.signal.direction}</span>
                    <span className="font-mono text-lg font-bold text-[var(--color-text)]">{data.signal.confluenceScore}</span>
                  </div>
                </div>
                <div className="h-2 rounded-full overflow-hidden score-bar-gradient opacity-90">
                  <div className="relative h-full w-full">
                    <div
                      className="absolute top-0 h-full w-1 bg-white rounded-full shadow-[0_0_6px_rgba(255,255,255,0.8)]"
                      style={{ left: `${data.signal.confluenceScore}%`, transition: 'left 0.3s ease-out' }}
                    />
                  </div>
                </div>
                <div className="flex justify-between text-[9px] text-muted font-mono">
                  <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
                </div>
              </div>

              {/* Two-column: signals + risk */}
              <div className="grid grid-cols-2 gap-3">
                {/* Signal checklist */}
                <div
                  className={`rounded-lg border border-[var(--color-card-border)] p-3 ${data.signal.direction !== 'NEUTRO' ? (data.signal.direction === 'LONG' ? 'card-glow-bull' : 'card-glow-bear') : ''}`}
                  style={{ background: 'var(--color-bg)' }}
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    {data.signal.direction !== 'NEUTRO' && <div className={`w-1.5 h-1.5 rounded-full ${data.signal.direction === 'LONG' ? 'bg-bull' : 'bg-bear'} status-dot-live`} />}
                    <span className="text-[10px] font-body text-muted uppercase tracking-wider">
                      {data.signal.direction !== 'NEUTRO' ? 'Sinal Ativo' : 'Sem Sinal'}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {data.signal.actionPoints.length > 0 ? (
                      data.signal.actionPoints.slice(0, 5).map((point, i) => (
                        <div key={i} className="flex items-start gap-1.5">
                          <span className="mt-0.5 shrink-0"><IconCheck /></span>
                          <span className="text-xs font-body text-[var(--color-text)] leading-tight">{point}</span>
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-muted font-body">Aguardando confluência...</span>
                    )}
                  </div>
                </div>

                {/* Risk panel */}
                <div className="rounded-lg border border-[var(--color-card-border)] p-3" style={{ background: 'var(--color-bg)' }}>
                  <span className="text-[10px] font-body text-muted uppercase tracking-wider block mb-2">Risco / Reward</span>
                  {data.signal.riskManagement ? (
                    <div className="space-y-1.5">
                      {[
                        { label: 'Entry', value: formatPrice(data.signal.riskManagement.entry), cls: 'text-[var(--color-text)]' },
                        { label: 'Stop Loss', value: formatPrice(data.signal.riskManagement.stopLoss), cls: 'text-bear' },
                        { label: 'Take Profit', value: formatPrice(data.signal.riskManagement.takeProfit), cls: 'text-bull' },
                      ].map((r, i) => (
                        <div key={i} className="flex justify-between">
                          <span className="text-xs text-muted font-body">{r.label}</span>
                          <span className={`text-xs font-mono ${r.cls}`}>{r.value}</span>
                        </div>
                      ))}
                      <div className="flex justify-between pt-1 border-t border-[var(--color-card-border)]">
                        <span className="text-xs text-muted font-body">R:R</span>
                        <span className="text-xs font-mono font-bold text-[var(--color-bull)]">
                          1:{data.signal.riskManagement.riskRewardRatio.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-muted font-body">Sem posição sugerida</span>
                  )}
                </div>
              </div>

              {/* Critical decision */}
              {data.signal.criticalDecision && (
                <div className="rounded-lg border border-[var(--color-card-border)] px-3 py-2" style={{ background: 'var(--color-bg)' }}>
                  <span className="text-[10px] text-muted font-body uppercase tracking-wider block mb-1">Decisão Crítica</span>
                  <p className="text-xs font-body text-[var(--color-text)] leading-relaxed">{data.signal.criticalDecision}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <p className="text-xs text-muted font-body text-center mt-3">
        Dados reais — atualizado a cada 15 minutos
      </p>
    </div>
  )
}

/* ─── Comparison Table ─── */
function ComparisonTable() {
  const rows: { feature: string; binance: string; binanceIcon: 'x' | 'check' | 'warn'; bottrade: string }[] = [
    { feature: 'Acompanhar pares favoritos', binance: 'Manual, 1 par por vez', binanceIcon: 'check', bottrade: 'Watchlist com favoritos e todos os pares' },
    { feature: 'Score de confluencia', binance: 'Nao existe', binanceIcon: 'x', bottrade: '15+ indicadores resumidos para leitura rapida' },
    { feature: 'Multi-timeframe', binance: 'Troca manual entre 15m/1h/4h', binanceIcon: 'x', bottrade: '15m + 1h + 4h organizados no painel' },
    { feature: 'Contexto LONG/SHORT/NEUTRO', binance: 'Voce cruza os dados sozinho', binanceIcon: 'warn', bottrade: 'Direcao tecnica, score e motivos visiveis' },
    { feature: 'Planejamento de risco', binance: 'Calculo manual', binanceIcon: 'warn', bottrade: 'Estimativas de SL/TP para apoiar analise' },
    { feature: 'Alertas personalizados', binance: 'Basico (preco)', binanceIcon: 'warn', bottrade: 'Preco, score, funding e condicoes do par' },
    { feature: 'Paper tracking', binance: 'Nao existe', binanceIcon: 'x', bottrade: 'Simulacao para acompanhar cenarios sem dinheiro real' },
    { feature: 'Backtesting configuravel', binance: 'Nao existe', binanceIcon: 'x', bottrade: 'Periodos de 7d, 30d e 90d' },
    { feature: 'Historico e performance', binance: 'Nao existe', binanceIcon: 'x', bottrade: 'Registros, estatisticas e exportacao' },
    { feature: 'Integracoes avancadas', binance: 'Na exchange', binanceIcon: 'warn', bottrade: 'Telegram, webhooks e API keys opcionais' },
  ]

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            <th className="py-3 px-4 text-xs font-body text-muted uppercase tracking-wider font-semibold border-b border-[var(--color-card-border)]">
              Funcionalidade
            </th>
            <th className="py-3 px-4 text-xs font-body uppercase tracking-wider font-semibold border-b border-[var(--color-card-border)]" style={{ color: 'var(--color-bear)' }}>
              Binance (grátis)
            </th>
            <th className="py-3 px-4 text-xs font-body uppercase tracking-wider font-semibold border-b border-[var(--color-card-border)]" style={{ color: 'var(--color-bull)' }}>
              Bottrade
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-[var(--color-card-border)] hover:bg-[var(--color-card-hover)] transition-colors duration-200"
            >
              <td className="py-3 px-4 text-sm font-body text-[var(--color-text)] font-medium">{row.feature}</td>
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  {row.binanceIcon === 'x' && <IconX />}
                  {row.binanceIcon === 'check' && <IconCheck />}
                  {row.binanceIcon === 'warn' && <IconWarn />}
                  <span className="text-sm font-body text-muted">{row.binance}</span>
                </div>
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <IconCheck />
                  <span className="text-sm font-body text-[var(--color-text)]">{row.bottrade}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ─── FAQ Accordion Item ─── */
function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-[var(--color-card-border)]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left cursor-pointer group"
        aria-expanded={open}
      >
        <span className="font-body text-base font-semibold text-[var(--color-text)] pr-4 group-hover:text-accent transition-colors duration-200">
          {question}
        </span>
        <span className={`shrink-0 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          <IconChevron />
        </span>
      </button>
      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: open ? '300px' : '0', opacity: open ? 1 : 0 }}
      >
        <p className="pb-5 text-sm font-body text-muted leading-relaxed">{answer}</p>
      </div>
    </div>
  )
}

/* ─── Pricing Card ─── */
function PricingCard({
  name,
  price,
  features,
  cta,
  highlighted,
  badge,
  onAction,
}: {
  name: string
  price: string
  features: string[]
  cta: string
  highlighted?: boolean
  badge?: string
  onAction: () => void
}) {
  return (
    <div
      className={`relative rounded-xl border p-6 flex flex-col ${
        highlighted
          ? 'border-accent shadow-[0_0_30px_rgba(99,102,241,0.12)]'
          : 'border-[var(--color-card-border)]'
      }`}
      style={{ background: highlighted ? 'var(--color-bg-elevated)' : 'var(--color-card)' }}
    >
      {badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white text-[10px] uppercase tracking-widest font-bold px-3 py-1 rounded-full">
          {badge}
        </span>
      )}
      <h3 className="font-display text-lg font-bold text-[var(--color-text)]">{name}</h3>
      <div className="mt-2 mb-4">
        <span className="font-mono text-3xl font-bold text-[var(--color-text)]">{price}</span>
        <span className="text-sm text-muted font-body">/mês</span>
      </div>
      <ul className="space-y-2.5 mb-6 flex-1">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0"><IconCheck /></span>
            <span className="text-sm font-body text-[var(--color-text)]">{f}</span>
          </li>
        ))}
      </ul>
      <button
        onClick={onAction}
        className={`w-full py-2.5 rounded-lg font-body font-semibold text-sm transition-all duration-200 cursor-pointer ${
          highlighted
            ? 'bg-accent text-white hover:bg-accent/90 shadow-[0_0_20px_rgba(99,102,241,0.2)]'
            : 'border border-[var(--color-card-border)] text-[var(--color-text)] hover:border-accent hover:text-accent'
        }`}
      >
        {cta}
      </button>
    </div>
  )
}

/* ─── Metric Card (for results section) ─── */
function MetricCard({ value, label }: { value: string; label: string }) {
  return (
    <div
      className="rounded-xl border border-[var(--color-card-border)] p-6 text-center hover:border-[var(--color-card-border-hover)] transition-all duration-200"
      style={{ background: 'var(--color-card)' }}
    >
      <span className="font-mono text-3xl sm:text-4xl font-bold text-[var(--color-text)] block">{value}</span>
      <span className="text-sm text-muted font-body mt-2 block">{label}</span>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════ */
/*  LANDING PAGE                                              */
/* ═══════════════════════════════════════════════════════════ */

export default function LandingPage({ onSignup, onLogin, onTerms, onPrivacy }: LandingPageProps) {
  const containerRef = useScrollReveal()
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [showMobileCta, setShowMobileCta] = useState(false)
  const heroRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = heroRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setShowMobileCta(!entry.isIntersecting)
        })
      },
      { threshold: 0 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="min-h-screen font-body text-[var(--color-text)]" style={{ background: 'var(--color-bg)' }}>
      {/* ── Inline Styles for scroll-reveal & gradient mesh ── */}
      <style>{`
        .reveal-on-scroll {
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .reveal-on-scroll.revealed {
          opacity: 1;
          transform: translateY(0);
        }
        .reveal-on-scroll.delay-1 { transition-delay: 0.1s; }
        .reveal-on-scroll.delay-2 { transition-delay: 0.2s; }
        .reveal-on-scroll.delay-3 { transition-delay: 0.3s; }
        .reveal-on-scroll.delay-4 { transition-delay: 0.4s; }

        .gradient-mesh {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
        }
        .gradient-mesh::before {
          content: '';
          position: absolute;
          top: -40%;
          left: -20%;
          width: 80%;
          height: 80%;
          background: radial-gradient(ellipse, rgba(99,102,241,0.08) 0%, transparent 70%);
          animation: mesh-float 12s ease-in-out infinite;
        }
        .gradient-mesh::after {
          content: '';
          position: absolute;
          bottom: -30%;
          right: -10%;
          width: 70%;
          height: 70%;
          background: radial-gradient(ellipse, rgba(34,197,94,0.05) 0%, transparent 70%);
          animation: mesh-float 15s ease-in-out infinite reverse;
        }
        @keyframes mesh-float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(5%, 3%) scale(1.05); }
          66% { transform: translate(-3%, -2%) scale(0.97); }
        }

        html { scroll-behavior: smooth; }

        .comparison-glow-green {
          background: linear-gradient(90deg, transparent 0%, rgba(34,197,94,0.04) 100%);
        }
        .comparison-glow-red {
          background: linear-gradient(90deg, transparent 0%, rgba(239,68,68,0.03) 100%);
        }

        .step-badge {
          width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 16px;
          font-family: var(--font-mono);
          font-weight: 700;
          font-size: 20px;
          color: var(--color-accent);
          background: rgba(99,102,241,0.1);
          border: 1px solid rgba(99,102,241,0.2);
          flex-shrink: 0;
        }

        @keyframes signal-pulse {
          0%, 100% { background: transparent; }
          50% { background: rgba(34,197,94,0.04); }
        }
        .signal-pulse-newest {
          animation: signal-pulse 2s ease-in-out infinite;
        }

        @keyframes urgency-shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }

        .security-card-glow {
          transition: border-color 0.3s ease, box-shadow 0.3s ease;
        }
        .security-card-glow:hover {
          border-color: rgba(99,102,241,0.3);
          box-shadow: 0 0 20px rgba(99,102,241,0.08);
        }

        .testimonial-card {
          transition: border-color 0.3s ease, transform 0.3s ease;
        }
        .testimonial-card:hover {
          border-color: var(--color-card-border-hover);
          transform: translateY(-2px);
        }

        .sticky-mobile-cta {
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          background: rgba(9,9,11,0.85);
        }
      `}</style>

      {/* ══════════ URGENCY BANNER ══════════ */}
      {!bannerDismissed && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-accent text-white text-center py-2 px-4 flex items-center justify-center gap-2">
          <IconFire />
          <span className="text-xs sm:text-sm font-body font-medium">
            Beta aberto: primeiros 200 usuários ganham 30 dias de Pro grátis — <span className="font-bold">Vagas limitadas</span>
          </span>
          <button
            onClick={() => setBannerDismissed(true)}
            className="ml-2 text-white/80 hover:text-white transition-colors duration-200 cursor-pointer shrink-0"
            aria-label="Fechar banner"
          >
            <IconClose />
          </button>
        </div>
      )}

      {/* ══════════ NAV ══════════ */}
      <nav className={`fixed left-0 right-0 z-50 glass border-b border-[var(--color-card-border)] transition-all duration-300 ${bannerDismissed ? 'top-0' : 'top-[36px]'}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <a href="#hero" className="font-display text-lg font-bold text-[var(--color-text)]">
            Bottrade<span className="text-accent">.</span>
          </a>
          <div className="hidden sm:flex items-center gap-6 text-sm text-muted font-body">
            <a href="#comparison" className="hover:text-[var(--color-text)] transition-colors duration-200">Comparativo</a>
            <a href="#features" className="hover:text-[var(--color-text)] transition-colors duration-200">Features</a>
            <a href="#results" className="hover:text-[var(--color-text)] transition-colors duration-200">Resultados</a>
            <a href="#pricing" className="hover:text-[var(--color-text)] transition-colors duration-200">Preços</a>
            <a href="#faq" className="hover:text-[var(--color-text)] transition-colors duration-200">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onLogin}
              className="text-sm text-muted hover:text-[var(--color-text)] font-body transition-colors duration-200 cursor-pointer"
            >
              Entrar
            </button>
            <button
              onClick={onSignup}
              className="text-sm bg-accent text-white px-4 py-1.5 rounded-lg font-body font-semibold hover:bg-accent/90 transition-all duration-200 cursor-pointer"
            >
              Começar grátis
            </button>
          </div>
        </div>
      </nav>

      {/* ══════════ STORYTELLING ══════════ */}
      <section className={`relative px-4 sm:px-6 ${bannerDismissed ? 'pt-20' : 'pt-28'}`}>
        <div className="max-w-3xl mx-auto text-center reveal-on-scroll py-12 sm:py-16">
          <p className="text-base sm:text-lg text-muted font-body leading-relaxed italic">
            Sao 3 da manha. Voce esta olhando varios graficos ao mesmo tempo.
            ETHUSDT caiu 2%, mas o MACD cruzou. O RSI diz sobrevenda,
            o funding mudou e sua watchlist ja nao esta organizada.
          </p>
          <p className="mt-6 text-base sm:text-lg text-muted font-body leading-relaxed">
            Nao porque falta vontade de analisar.{' '}
            <br className="hidden sm:block" />
            Mas porque acompanhar indicadores, timeframes e alertas de muitos pares
            manualmente fica lento, cansativo e sujeito a erro.
          </p>
          <p className="mt-6 text-base sm:text-lg font-body leading-relaxed text-[var(--color-text)]">
            O Bottrade organiza isso em{' '}
            <span className="text-accent font-bold">um painel unico</span>.
          </p>
        </div>
      </section>

      {/* ══════════ SECTION 1: HERO ══════════ */}
      <section ref={heroRef} id="hero" className="relative pt-8 pb-16 sm:pt-12 sm:pb-24 px-4 sm:px-6 overflow-hidden">
        <div className="gradient-mesh" />

        <div className="relative max-w-6xl mx-auto text-center">
          <div className="reveal-on-scroll">
            <span className="inline-block text-xs font-body text-accent bg-accent/10 px-3 py-1 rounded-full uppercase tracking-widest font-semibold mb-6">
              Crypto Pair Monitoring
            </span>
          </div>

          <h1 className="reveal-on-scroll delay-1 font-display text-3xl sm:text-5xl lg:text-6xl font-bold leading-tight max-w-5xl mx-auto">
            Monitore seus pares cripto com{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-bull">
              indicadores, alertas e contexto em tempo real.
            </span>
          </h1>

          <p className="reveal-on-scroll delay-2 mt-6 text-base sm:text-lg text-muted max-w-2xl mx-auto font-body leading-relaxed">
            Configure sua watchlist, acompanhe score de confluencia, indicadores tecnicos, alertas e cenarios de paper tracking em um dashboard feito para apoiar sua analise.
          </p>

          <div className="reveal-on-scroll delay-3 mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onSignup}
              className="w-full sm:w-auto px-8 py-3 bg-accent text-white rounded-lg font-body font-semibold text-base hover:bg-accent/90 transition-all duration-200 shadow-[0_0_20px_rgba(99,102,241,0.25)] hover:shadow-[0_0_30px_rgba(99,102,241,0.35)] cursor-pointer"
            >
              Comecar gratis
            </button>
            <a
              href="#results"
              className="w-full sm:w-auto px-8 py-3 border border-[var(--color-card-border)] text-[var(--color-text)] rounded-lg font-body font-semibold text-base hover:border-accent hover:text-accent transition-all duration-200 text-center cursor-pointer"
            >
              Ver como funciona
            </a>
          </div>

          {/* Live Demo Dashboard */}
          <div className="reveal-on-scroll delay-4 mt-14 sm:mt-20">
            <LiveDemo />
          </div>

          {/* Live Signal Feed */}
          <div className="reveal-on-scroll delay-4 mt-10 sm:mt-14">
            <LiveSignalFeed />
          </div>

          {/* Scroll hint */}
          <div className="reveal-on-scroll delay-4 mt-10 flex justify-center text-muted animate-bounce">
            <IconChevron />
          </div>
        </div>
      </section>

      {/* ══════════ LIVE COUNTERS ══════════ */}
      <section className="py-10 sm:py-14 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto reveal-on-scroll">
          <LiveCounters />
        </div>
      </section>

      {/* ══════════ SECTION 2: BINANCE VS BOTTRADE ══════════ */}
      <section id="comparison" className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="reveal-on-scroll font-display text-2xl sm:text-4xl font-bold">
              O que falta quando voce acompanha pares so pela exchange
            </h2>
            <p className="reveal-on-scroll delay-1 mt-4 text-muted font-body text-base sm:text-lg max-w-2xl mx-auto">
              A exchange e otima para executar ordens. Para monitorar pares, cruzar indicadores, receber alertas e organizar cenarios, voce precisa de uma camada de analise.
            </p>
          </div>

          <div className="reveal-on-scroll delay-2 rounded-xl border border-[var(--color-card-border)] overflow-hidden" style={{ background: 'var(--color-card)' }}>
            <ComparisonTable />
          </div>

          <MiniCta text="Convencido? Comecar gratis" onClick={onSignup} />
        </div>
      </section>

      {/* ══════════ SECTION 3: HOW IT WORKS ══════════ */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 border-y border-[var(--color-card-border)]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="reveal-on-scroll font-display text-2xl sm:text-4xl font-bold">
              3 passos para acompanhar o mercado com mais clareza
            </h2>
            <p className="reveal-on-scroll delay-1 mt-4 text-muted font-body text-base sm:text-lg max-w-xl mx-auto">
              Simples, configuravel e sem caixa preta.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                num: '01',
                title: 'Escolha seus pares',
                desc: 'O sistema acompanha os pares disponiveis e permite salvar favoritos. Voce foca na sua watchlist, sem perder o contexto do mercado.',
                visual: (
                  <div className="mt-4 rounded-lg border border-[var(--color-card-border)] p-3 space-y-2" style={{ background: 'var(--color-bg)' }}>
                    {[
                      { symbol: 'ETHUSDT', heat: 92, color: 'var(--color-bull)' },
                      { symbol: 'BTCUSDT', heat: 78, color: 'var(--color-bull)' },
                      { symbol: 'SOLUSDT', heat: 34, color: 'var(--color-bear)' },
                    ].map((p, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5">
                        <span className="font-display text-xs font-bold text-[var(--color-text)]">{p.symbol}</span>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 rounded-full" style={{ width: `${p.heat * 0.4}px`, background: p.color }} />
                          <span className="font-mono text-xs text-muted">{p.heat}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ),
              },
              {
                num: '02',
                title: 'Acompanhe leituras transparentes',
                desc: 'Score de confluencia mostra o contexto tecnico do par. Cada indicador fica visivel para voce interpretar antes de decidir.',
                visual: (
                  <div className="mt-4 rounded-lg border border-[var(--color-card-border)] p-3" style={{ background: 'var(--color-bg)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold font-display text-[var(--color-bull)]">LONG</span>
                      <span className="font-mono text-lg font-bold text-[var(--color-text)]">87</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden score-bar-gradient opacity-90">
                      <div className="relative h-full w-full">
                        <div className="absolute top-0 h-full w-1 bg-white rounded-full shadow-[0_0_6px_rgba(255,255,255,0.8)]" style={{ left: '87%' }} />
                      </div>
                    </div>
                    <div className="mt-2 space-y-1">
                      {['ADX > 25', 'Volume OK', '7/7 filtros'].map((f, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <IconCheck /><span className="text-[11px] font-body text-muted">{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ),
              },
              {
                num: '03',
                title: 'Planeje cenarios de risco',
                desc: 'Use estimativas de SL/TP, alertas e registros para planejar cenarios. Recursos de execucao por API sao avancados e opcionais.',
                visual: (
                  <div className="mt-4 rounded-lg border border-[var(--color-card-border)] p-3" style={{ background: 'var(--color-bg)' }}>
                    <div className="space-y-2">
                      {[
                        { label: 'Trailing Stop', status: 'Ativo', color: 'var(--color-bull)' },
                        { label: 'Partial TP 50%', status: 'Ativo', color: 'var(--color-bull)' },
                        { label: 'Circuit Breaker', status: 'Pronto', color: 'var(--color-warn)' },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-xs font-body text-[var(--color-text)]">{item.label}</span>
                          <span className="text-[10px] font-mono font-semibold" style={{ color: item.color }}>{item.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ),
              },
            ].map((step, i) => (
              <div
                key={i}
                className={`reveal-on-scroll delay-${i + 1} rounded-xl border border-[var(--color-card-border)] p-6 hover:border-[var(--color-card-border-hover)] transition-all duration-200`}
                style={{ background: 'var(--color-card)' }}
              >
                <div className="step-badge">{step.num}</div>
                <h3 className="font-display text-lg font-bold mt-4 mb-2 text-[var(--color-text)]">{step.title}</h3>
                <p className="text-sm text-muted font-body leading-relaxed">{step.desc}</p>
                {step.visual}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ SECTION 4: FEATURES DEEP DIVE ══════════ */}
      <section id="features" className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="reveal-on-scroll font-display text-2xl sm:text-4xl font-bold">
              Por que usar o Bottrade para monitorar pares cripto
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                icon: <IconBrain />,
                title: '15+ indicadores + score',
                desc: 'MA, EMA, MACD, StochRSI, RSI, Bollinger, ATR, ADX, VWAP, Volume, OI, L/S Ratio, Fear&Greed - organizados em uma leitura de 0-100.',
                highlight: 'Score de confluência proprietário',
              },
              {
                icon: <IconTarget />,
                title: 'Filtros de contexto tecnico',
                items: ['ADX > threshold', 'Multi-timeframe alinhado', 'Volume acima da média', 'Funding rate neutro', 'L/S Ratio favorável', 'Cooldown respeitado', 'Threshold dinâmico atingido'],
              },
              {
                icon: <IconShield />,
                title: 'Planejamento de risco',
                desc: 'Calculos de SL/TP, distancia por ATR, score e historico ajudam a avaliar cenarios antes de agir. Execucao automatizada e um recurso avancado, opt-in e sob responsabilidade do usuario.',
                highlight: 'Apoio para planejar risco com mais disciplina',
              },
              {
                icon: <IconBarChart />,
                title: 'Validacao antes de operar',
                desc: 'Backtest com periodos de 7, 30 e 90 dias e paper tracking para acompanhar cenarios sem dinheiro real antes de tomar decisoes.',
                highlight: 'Teste ideias sem expor capital real',
              },
            ].map((card, i) => (
              <div
                key={i}
                className={`reveal-on-scroll delay-${(i % 2) + 1} rounded-xl border border-[var(--color-card-border)] p-6 hover:border-[var(--color-card-border-hover)] transition-all duration-200 group`}
                style={{ background: 'var(--color-card)' }}
              >
                <div className="text-accent mb-4 group-hover:scale-110 transition-transform duration-200 inline-block">
                  {card.icon}
                </div>
                <h3 className="font-display text-lg font-bold mb-3 text-[var(--color-text)]">{card.title}</h3>
                {card.desc && (
                  <p className="text-sm text-muted font-body leading-relaxed mb-3">{card.desc}</p>
                )}
                {card.items && (
                  <div className="space-y-2 mb-3">
                    {card.items.map((item, j) => (
                      <div key={j} className="flex items-center gap-2">
                        <IconCheck />
                        <span className="text-sm font-body text-[var(--color-text)]">{item}</span>
                      </div>
                    ))}
                  </div>
                )}
                {card.highlight && (
                  <span className="inline-block text-xs font-body text-accent bg-accent/10 px-3 py-1 rounded-full font-semibold">
                    {card.highlight}
                  </span>
                )}
              </div>
            ))}
          </div>

          <MiniCta text="Pronto para monitorar com mais clareza?" onClick={onSignup} />
        </div>
      </section>
      {/* ══════════ SECTION 5: MONITORING SNAPSHOT ══════════ */}
      <section id="results" className="py-16 sm:py-24 px-4 sm:px-6 border-y border-[var(--color-card-border)]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="reveal-on-scroll font-display text-2xl sm:text-4xl font-bold">
              Um painel para acompanhar o que importa
            </h2>
            <p className="reveal-on-scroll delay-1 mt-4 text-muted font-body text-base sm:text-lg max-w-xl mx-auto">
              Veja seus pares favoritos, leituras tecnicas, alertas e historico em um fluxo unico.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {[
              { value: '15+', label: 'Indicadores tecnicos' },
              { value: '3', label: 'Timeframes acompanhados' },
              { value: '24/7', label: 'Monitoramento de mercado' },
              { value: 'JSON', label: 'Exportacao de dados' },
            ].map((metric, i) => (
              <div key={i} className={`reveal-on-scroll delay-${i + 1}`}>
                <MetricCard value={metric.value} label={metric.label} />
              </div>
            ))}
          </div>

          <p className="reveal-on-scroll mt-6 text-xs text-muted font-body text-center max-w-2xl mx-auto leading-relaxed">
            O Bottrade organiza informacoes tecnicas para apoiar sua propria analise. Nao ha garantia de resultado, recomendacao de investimento ou promessa de lucro.
          </p>

          <div className="reveal-on-scroll mt-8 text-center">
            <button
              onClick={onSignup}
              className="px-8 py-3 border border-[var(--color-card-border)] text-[var(--color-text)] rounded-lg font-body font-semibold text-sm hover:border-accent hover:text-accent transition-all duration-200 cursor-pointer"
            >
              Criar minha watchlist
            </button>
          </div>

          <MiniCta text="Comece acompanhando seus pares favoritos" onClick={onSignup} />
        </div>
      </section>

      {/* ══════════ RECENT MARKET READINGS ══════════ */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="reveal-on-scroll font-display text-2xl sm:text-4xl font-bold">
              Exemplo de leituras recentes
            </h2>
          </div>

          <div className="reveal-on-scroll delay-1 space-y-3">
            {[
              { symbol: 'ETHUSDT', direction: 'LONG', score: '82', context: 'Score alto, volume acima da media', time: 'ha 2h' },
              { symbol: 'SOLUSDT', direction: 'SHORT', score: '28', context: 'Pressao vendedora no timeframe curto', time: 'ha 4h' },
              { symbol: 'BTCUSDT', direction: 'NEUTRO', score: '51', context: 'Indicadores mistos, sem alinhamento claro', time: 'ha 6h' },
              { symbol: 'ADAUSDT', direction: 'LONG', score: '74', context: 'Preco acima das medias principais', time: 'ha 9h' },
              { symbol: 'BNBUSDT', direction: 'SHORT', score: '33', context: 'Momentum fraco e funding em observacao', time: 'ha 11h' },
            ].map((reading, i) => (
              <div
                key={i}
                className="rounded-lg border border-[var(--color-card-border)] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0"
                style={{ background: 'var(--color-card)', borderLeft: '3px solid var(--color-accent)' }}
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-display text-sm font-bold text-[var(--color-text)]">{reading.symbol}</span>
                  <span
                    className="text-[10px] font-display font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{
                      color: reading.direction === 'LONG' ? 'var(--color-bull)' : reading.direction === 'SHORT' ? 'var(--color-bear)' : 'var(--color-warn)',
                      background: reading.direction === 'LONG' ? 'rgba(34,197,94,0.1)' : reading.direction === 'SHORT' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                    }}
                  >
                    {reading.direction}
                  </span>
                  <span className="text-xs font-body text-muted">
                    Score: <span className="font-mono text-[var(--color-text)]">{reading.score}</span>
                  </span>
                  <span className="text-xs font-body text-muted">{reading.context}</span>
                </div>
                <span className="text-[11px] text-muted font-body">{reading.time}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ TESTIMONIALS ══════════ */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 border-y border-[var(--color-card-border)]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="reveal-on-scroll font-display text-2xl sm:text-4xl font-bold">
              Como o Bottrade ajuda na rotina
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { quote: 'Uso o Bottrade para abrir o dia com meus pares favoritos ja organizados. Fica muito mais facil ver onde vale aprofundar a analise.', name: 'Rafael M.', role: 'trader desde 2021' },
              { quote: 'O score e os indicadores no mesmo painel reduzem o tempo que eu gastava pulando entre graficos e abas.', name: 'Ana C.', role: 'swing trader' },
              { quote: 'O paper tracking me ajuda a registrar cenarios antes de operar com dinheiro real. Para mim virou um diario tecnico.', name: 'Pedro L.', role: 'day trader' },
            ].map((t, i) => (
              <div
                key={i}
                className={`reveal-on-scroll delay-${i + 1} testimonial-card rounded-xl border border-[var(--color-card-border)] p-6`}
                style={{ background: 'var(--color-card)' }}
              >
                <div className="mb-3"><IconQuote /></div>
                <p className="text-sm font-body text-[var(--color-text)] leading-relaxed mb-4">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map((s) => (<IconStar key={s} />))}
                </div>
                <p className="text-xs font-body text-muted">- {t.name}, <span className="italic">{t.role}</span></p>
              </div>
            ))}
          </div>

          <p className="reveal-on-scroll text-[10px] text-muted font-body text-center mt-6">
            Depoimentos ilustram formas de uso do painel e nao representam promessa de resultado financeiro.
          </p>
        </div>
      </section>

      {/* ══════════ SECTION 6: PRICING ══════════ */}
      <section id="pricing" className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="reveal-on-scroll font-display text-2xl sm:text-4xl font-bold">Escolha o nivel de acompanhamento</h2>
            <p className="reveal-on-scroll delay-1 mt-4 text-muted font-body text-base sm:text-lg max-w-2xl mx-auto">
              Comece com uma watchlist simples e avance para indicadores, alertas, backtest e integracoes quando fizer sentido para sua rotina.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="reveal-on-scroll delay-1">
              <PricingCard name="Free" price="R$0" features={['3 pares favoritos', 'Score basico', 'Alertas limitados', 'Dashboard simplificado']} cta="Comecar gratis" onAction={onSignup} />
            </div>
            <div className="reveal-on-scroll delay-2">
              <PricingCard name="Pro" price="R$49" features={['Pares ilimitados', 'Todos os 15+ indicadores', 'Multi-timeframe (15m, 1h, 4h)', 'Paper tracking ilimitado', 'Backtest 7d/30d/90d', 'Alertas Telegram em tempo real', 'Webhooks (Discord, Slack)', 'Relatorio de acompanhamento', 'Exportacao de dados (LGPD)']} cta="Comecar gratis" highlighted badge="POPULAR" onAction={onSignup} />
            </div>
            <div className="reveal-on-scroll delay-3">
              <PricingCard name="Trader" price="R$99" features={['Tudo do Pro', 'Execucao por API opcional', 'Modo semi-automatico com confirmacao', 'Controles de limite diario', 'Ordens SL/TP quando configuradas', 'Notificacoes de falha em tempo real', 'Suporte prioritario']} cta="Comecar gratis" onAction={onSignup} />
            </div>
          </div>

          <div className="reveal-on-scroll mt-8 text-center space-y-2">
            <p className="text-sm text-muted font-body">O foco do Bottrade e centralizar monitoramento, indicadores, alertas e registros em um so painel.</p>
            <p className="text-sm font-body text-[var(--color-text)]">Recursos de execucao por API sao avancados, opcionais e exigem configuracao manual do usuario.</p>
            <p className="text-xs text-muted font-body">Cancele a qualquer momento. Trading de criptomoedas envolve risco e depende da sua propria decisao.</p>
          </div>
        </div>
      </section>
      {/* ══════════ SECURITY & AUTHORITY ══════════ */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 border-b border-[var(--color-card-border)]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="reveal-on-scroll font-display text-2xl sm:text-4xl font-bold">
              Segurança e Tecnologia
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {[
              {
                icon: <IconLock />,
                title: 'Criptografia AES-256',
                desc: 'API keys e dados sensíveis criptografados em repouso',
              },
              {
                icon: <IconShieldAuth />,
                title: 'Autenticacao Clerk',
                desc: 'Sessoes seguras com Clerk, rate limiting e recuperacao de senha segura',
              },
              {
                icon: <IconDatabase />,
                title: 'Conformidade LGPD',
                desc: 'Exportacao e exclusao de dados pessoais. Integracoes opcionais sem intermediarios',
              },
              {
                icon: <IconSearch />,
                title: 'Código auditado',
                desc: 'Validação de input em todos os endpoints, audit logging completo',
              },
            ].map((card, i) => (
              <div
                key={i}
                className={`reveal-on-scroll delay-${i + 1} security-card-glow rounded-xl border border-[var(--color-card-border)] p-5 text-center`}
                style={{ background: 'var(--color-card)' }}
              >
                <div className="text-accent mb-3 inline-block">{card.icon}</div>
                <h3 className="font-display text-sm font-bold text-[var(--color-text)] mb-2">{card.title}</h3>
                <p className="text-xs text-muted font-body leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ SECTION 7: FAQ ══════════ */}
      <section id="faq" className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="reveal-on-scroll font-display text-2xl sm:text-4xl font-bold">
              Perguntas frequentes
            </h2>
          </div>

          <div className="reveal-on-scroll delay-1">
            <FaqItem
              question="O Bottrade opera sozinho?"
              answer="Nao. O produto principal e um dashboard de monitoramento e analise. Recursos de execucao por API existem apenas como funcao avancada, opcional e configurada pelo usuario."
            />
            <FaqItem
              question="Preciso conectar uma exchange para usar?"
              answer="Nao. Voce pode acompanhar pares, indicadores, alertas e paper tracking sem fornecer API keys. A integracao com exchange e opcional."
            />
            <FaqItem
              question="Meus dados e API keys estao seguros?"
              answer="API keys, quando configuradas voluntariamente, sao criptografadas com AES-256. Usamos Clerk Auth, rate limiting e audit logging."
            />
            <FaqItem
              question="Preciso ser trader experiente?"
              answer="Nao. O dashboard tem modos Simple, Trader e Pro para ajustar a quantidade de informacao exibida. O usuario continua responsavel por interpretar os dados."
            />
            <FaqItem
              question="Posso cancelar a qualquer momento?"
              answer="Sim. Sem fidelidade. Cancele pelo painel e seu plano continua até o fim do período pago."
            />
            <FaqItem
              question="O Bottrade recomenda investimentos?"
              answer="Nao. O Bottrade organiza dados tecnicos e alertas para apoiar sua propria analise. Trading envolve risco e nenhuma leitura do painel garante resultado."
            />
          </div>
        </div>
      </section>

      {/* ══════════ SECTION 8: FINAL CTA ══════════ */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="reveal-on-scroll relative rounded-2xl border border-[var(--color-card-border)] p-8 sm:p-14 overflow-hidden" style={{ background: 'var(--color-card)' }}>
            <div className="absolute inset-0 opacity-30">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-1/2 bg-accent/10 blur-3xl rounded-full" />
            </div>

            <div className="relative">
              <h2 className="font-display text-2xl sm:text-3xl font-bold">
                Pronto para acompanhar seus pares com mais clareza?
              </h2>
              <p className="mt-4 text-muted font-body text-base sm:text-lg">
                Comece gratis. Sem cartao de credito.
              </p>
              <button
                onClick={onSignup}
                className="mt-8 px-10 py-3.5 bg-accent text-white rounded-lg font-body font-semibold text-base hover:bg-accent/90 transition-all duration-200 shadow-[0_0_30px_rgba(99,102,241,0.25)] hover:shadow-[0_0_40px_rgba(99,102,241,0.4)] cursor-pointer"
              >
                Criar minha watchlist
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ STICKY MOBILE CTA ══════════ */}
      {showMobileCta && (
        <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden sticky-mobile-cta border-t border-[var(--color-card-border)]" style={{ height: '48px' }}>
          <div className="h-full flex items-center justify-between px-4 gap-3">
            <span className="text-xs font-body text-muted">Comece gratis</span>
            <button
              onClick={onSignup}
              className="px-5 py-1.5 bg-accent text-white text-xs font-body font-semibold rounded-lg hover:bg-accent/90 transition-all duration-200 cursor-pointer whitespace-nowrap"
            >
              Comecar
            </button>
          </div>
        </div>
      )}

      {/* ══════════ SECTION 9: FOOTER ══════════ */}
      <footer className="border-t border-[var(--color-card-border)] py-10 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <span className="font-display text-lg font-bold text-[var(--color-text)]">
              Bottrade<span className="text-accent">.</span>
            </span>
            <div className="flex items-center gap-4 text-sm text-muted font-body">
              <button onClick={onTerms} className="hover:text-[var(--color-text)] transition-colors duration-200">Termos de Uso</button>
              <span className="text-muted">|</span>
              <button onClick={onPrivacy} className="hover:text-[var(--color-text)] transition-colors duration-200">Política de Privacidade</button>
              <span className="text-muted">|</span>
              <a href="#" className="hover:text-[var(--color-text)] transition-colors duration-200">Contato</a>
            </div>
          </div>
          <p className="mt-6 text-xs text-muted font-body text-center leading-relaxed max-w-3xl mx-auto">
            Aviso legal: Trading de criptomoedas envolve risco significativo de perda. O Bottrade é uma ferramenta de análise e não constitui recomendação de investimento. Resultados passados não garantem resultados futuros. Use por sua conta e risco.
          </p>
          <p className="mt-4 text-xs text-muted font-body text-center">
            &copy; 2026 Bottrade. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  )
}




