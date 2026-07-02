import { useEffect, useRef } from 'react'

interface PublicResultsProps {
  onBack: () => void
  onSignup: () => void
}

/* ─── Scroll Reveal Hook ─── */
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

/* ─── Icons ─── */
const IconArrowLeft = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
)

const IconTrendUp = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
)

const IconTrendDown = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
    <polyline points="17 18 23 18 23 12" />
  </svg>
)

const IconShield = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
)

const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-bull)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

/* ─── Mock Data ─── */
const KEY_METRICS = [
  { label: 'Indicadores', value: '15+', color: 'bull' as const, sub: 'organizados por par' },
  { label: 'Timeframes', value: '3', color: 'accent' as const, sub: '15m, 1h e 4h' },
  { label: 'Monitoramento', value: '24/7', color: 'bull' as const, sub: 'mercado em tempo real' },
  { label: 'Exportacao', value: 'JSON', color: 'bear' as const, sub: 'dados portaveis' },
]

const DIRECTION_DATA = [
  { direction: 'LONG', winRate: 'Score alto', trades: 523, avgPnl: 'Volume OK', icon: IconTrendUp, color: 'bull' as const },
  { direction: 'SHORT', winRate: 'Score baixo', trades: 324, avgPnl: 'Momentum fraco', icon: IconTrendDown, color: 'bear' as const },
]

const TOP_PAIRS = [
  { pair: 'ETHUSDT', trades: 142, winRate: '82', pnl: 'Alta confluencia' },
  { pair: 'BTCUSDT', trades: 138, winRate: '67', pnl: 'Tendencia moderada' },
  { pair: 'SOLUSDT', trades: 89, winRate: '34', pnl: 'Pressao vendedora' },
  { pair: 'BNBUSDT', trades: 67, winRate: '51', pnl: 'Neutro' },
  { pair: 'XRPUSDT', trades: 54, winRate: '72', pnl: 'Volume em alta' },
]

const MONTHLY_PERFORMANCE = [
  { month: 'ETHUSDT', pnl: 82 },
  { month: 'BTCUSDT', pnl: 67 },
  { month: 'SOLUSDT', pnl: 34 },
  { month: 'BNBUSDT', pnl: 51 },
  { month: 'XRPUSDT', pnl: 72 },
  { month: 'ADAUSDT', pnl: 58 },
]

const METHODOLOGY_ITEMS = [
  'Score calculado a partir de indicadores tecnicos',
  'Filtros de contexto exibidos de forma transparente',
  'Estimativas de risco baseadas em volatilidade',
  'Paper tracking sem dinheiro real',
]

/* ─── Component ─── */
export default function PublicResults({ onBack, onSignup }: PublicResultsProps) {
  const containerRef = useScrollReveal()

  const maxPnl = Math.max(...MONTHLY_PERFORMANCE.map((m) => Math.abs(m.pnl)))

  return (
    <div ref={containerRef} className="min-h-screen bg-bg noise-bg">
      {/* ─── CSS for scroll reveal ─── */}
      <style>{`
        .reveal-on-scroll {
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.6s ease-out, transform 0.6s ease-out;
        }
        .reveal-on-scroll.revealed {
          opacity: 1;
          transform: translateY(0);
        }
        .metric-card {
          position: relative;
          overflow: hidden;
        }
        .metric-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          opacity: 0.4;
        }
        .metric-card-bull::before {
          background: linear-gradient(90deg, transparent, var(--color-bull), transparent);
        }
        .metric-card-accent::before {
          background: linear-gradient(90deg, transparent, var(--color-accent), transparent);
        }
        .metric-card-bear::before {
          background: linear-gradient(90deg, transparent, var(--color-bear), transparent);
        }
        .bar-animate {
          transition: width 1s ease-out 0.3s;
        }
        .revealed .bar-animate {
          width: var(--bar-w) !important;
        }
      `}</style>

      {/* ─── Header ─── */}
      <header className="sticky top-0 z-50 glass border-b border-[var(--color-card-border)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-lg hover:bg-[var(--color-card-hover)] text-muted hover:text-[var(--color-text)] transition-colors"
              aria-label="Voltar"
            >
              <IconArrowLeft />
            </button>
            <div className="flex items-center gap-2">
              <span className="font-display text-lg font-bold tracking-tight text-[var(--color-text)]">
                Bottrade
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            </div>
          </div>
          <button
            onClick={onSignup}
            className="px-4 py-2 rounded-lg text-sm font-semibold font-body transition-all
              bg-accent hover:bg-accent/90 text-white
              shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:shadow-[0_0_30px_rgba(99,102,241,0.35)]"
          >
            Criar conta grátis
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-16 sm:space-y-24">
        {/* ─── Section 1: Hero ─── */}
        <section className="text-center reveal-on-scroll">
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-[var(--color-text)] tracking-tight">
            Exemplo de Painel de Monitoramento
          </h1>
          <p className="mt-3 text-muted font-body text-base sm:text-lg max-w-xl mx-auto">
            Dados reais dos últimos 30 dias
          </p>
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--color-card-border)] bg-[var(--color-card)]">
            <span className="w-2 h-2 rounded-full bg-bull status-dot-live" />
            <span className="text-xs font-mono text-muted">Atualizado em tempo real</span>
          </div>
        </section>

        {/* ─── Section 2: Key Metrics ─── */}
        <section className="reveal-on-scroll">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {KEY_METRICS.map((m) => (
              <div
                key={m.label}
                className={`metric-card metric-card-${m.color} rounded-xl p-4 sm:p-6 border border-[var(--color-card-border)] bg-[var(--color-card)] hover:bg-[var(--color-card-hover)] transition-colors`}
              >
                <p className="text-xs sm:text-sm text-muted font-body uppercase tracking-wider mb-2">
                  {m.label}
                </p>
                <p
                  className="font-mono text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight"
                  style={{ color: `var(--color-${m.color})` }}
                >
                  {m.value}
                </p>
                <p className="text-xs text-dim font-body mt-1">{m.sub}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Section 3: Context by Direction ─── */}
        <section className="reveal-on-scroll">
          <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--color-text)] mb-6">
            Contexto por direcao tecnica
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {DIRECTION_DATA.map((d) => {
              const DirIcon = d.icon
              return (
                <div
                  key={d.direction}
                  className={`card-glow-${d.color === 'bull' ? 'bull' : 'bear'} rounded-xl p-5 sm:p-6 border border-[var(--color-card-border)] bg-[var(--color-card)]`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ background: `var(--color-${d.color === 'bull' ? 'bull-dim' : 'bear-dim'})` }}
                    >
                      <span style={{ color: `var(--color-${d.color})` }}>
                        <DirIcon />
                      </span>
                    </div>
                    <span className="font-display text-lg font-bold text-[var(--color-text)]">
                      {d.direction}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs text-muted font-body mb-1">Leitura</p>
                      <p className="font-mono text-xl font-bold" style={{ color: `var(--color-${d.color})` }}>
                        {d.winRate}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted font-body mb-1">Amostras</p>
                      <p className="font-mono text-xl font-bold text-[var(--color-text)]">
                        {d.trades}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted font-body mb-1">Contexto</p>
                      <p className="font-mono text-xl font-bold" style={{ color: `var(--color-${d.color})` }}>
                        {d.avgPnl}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ─── Section 4: Watched Pairs ─── */}
        <section className="reveal-on-scroll">
          <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--color-text)] mb-6">
            Pares em acompanhamento
          </h2>
          <div className="rounded-xl border border-[var(--color-card-border)] bg-[var(--color-card)] overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-4 gap-2 px-4 sm:px-6 py-3 border-b border-[var(--color-card-border)] bg-[var(--color-bg-elevated)]">
              <span className="text-xs text-muted font-body uppercase tracking-wider">Par</span>
              <span className="text-xs text-muted font-body uppercase tracking-wider text-right">Amostras</span>
              <span className="text-xs text-muted font-body uppercase tracking-wider text-right">Leitura</span>
              <span className="text-xs text-muted font-body uppercase tracking-wider text-right">Contexto</span>
            </div>
            {/* Table Body */}
            {TOP_PAIRS.map((p, i) => (
              <div
                key={p.pair}
                className={`grid grid-cols-4 gap-2 px-4 sm:px-6 py-3.5 hover:bg-[var(--color-card-hover)] transition-colors ${
                  i < TOP_PAIRS.length - 1 ? 'border-b border-[var(--color-card-border)]' : ''
                }`}
              >
                <span className="font-display text-sm font-semibold text-[var(--color-text)]">
                  {p.pair}
                </span>
                <span className="font-mono text-sm text-[var(--color-text)] text-right">
                  {p.trades}
                </span>
                <span className="font-mono text-sm text-bull text-right">
                  {p.winRate}
                </span>
                <span className="font-mono text-sm text-bull text-right font-semibold">
                  {p.pnl}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Section 5: Score by Pair ─── */}
        <section className="reveal-on-scroll">
          <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--color-text)] mb-6">
            Score por par
          </h2>
          <div className="rounded-xl border border-[var(--color-card-border)] bg-[var(--color-card)] p-4 sm:p-6 space-y-3">
            {MONTHLY_PERFORMANCE.map((m) => {
              const barWidth = (Math.abs(m.pnl) / maxPnl) * 100
              return (
                <div key={m.month} className="flex items-center gap-3 sm:gap-4">
                  <span className="text-xs sm:text-sm text-muted font-body w-20 sm:w-24 shrink-0">
                    {m.month}
                  </span>
                  <div className="flex-1 h-7 sm:h-8 rounded bg-[var(--color-bg-elevated)] overflow-hidden relative">
                    <div
                      className="bar-animate h-full rounded transition-all"
                      style={{
                        '--bar-w': `${barWidth}%`,
                        width: '0%',
                        background: m.pnl >= 65
                          ? 'linear-gradient(90deg, var(--color-bull-dim), var(--color-bull))'
                          : m.pnl <= 35
                            ? 'linear-gradient(90deg, var(--color-bear-dim), var(--color-bear))'
                            : 'linear-gradient(90deg, var(--color-warn-dim), var(--color-warn))',
                      } as React.CSSProperties}
                    />
                  </div>
                  <span
                    className="font-mono text-sm sm:text-base font-bold w-16 sm:w-20 text-right shrink-0"
                    style={{ color: m.pnl >= 65 ? 'var(--color-bull)' : m.pnl <= 35 ? 'var(--color-bear)' : 'var(--color-warn)' }}
                  >
                    {m.pnl}
                  </span>
                </div>
              )
            })}
          </div>
        </section>

        {/* ─── Section 6: Methodology ─── */}
        <section className="reveal-on-scroll">
          <div className="rounded-xl border border-[var(--color-card-border)] bg-[var(--color-card)] p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--color-accent-dim)]">
                <span className="text-accent">
                  <IconShield />
                </span>
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--color-text)]">
                Como calculamos
              </h2>
            </div>
            <ul className="space-y-3 mb-6">
              {METHODOLOGY_ITEMS.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 shrink-0">
                    <IconCheck />
                  </span>
                  <span className="text-sm sm:text-base text-[var(--color-text)] font-body">{item}</span>
                </li>
              ))}
            </ul>
            <div className="rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-card-border)] p-4">
              <p className="text-xs sm:text-sm text-muted font-body leading-relaxed">
                <span className="text-warn font-semibold">Aviso:</span>{' '}
                As leituras exibidas servem para apoiar sua propria analise. Nao constituem recomendacao de investimento nem promessa de resultado.
              </p>
            </div>
          </div>
        </section>

        {/* ─── Section 7: CTA ─── */}
        <section className="reveal-on-scroll">
          <div className="relative rounded-2xl overflow-hidden p-8 sm:p-12 text-center">
            {/* Gradient background */}
            <div
              className="absolute inset-0 opacity-20"
              style={{
                background: 'linear-gradient(135deg, var(--color-accent-dim), var(--color-bull-dim), var(--color-accent-dim))',
                backgroundSize: '200% 200%',
                animation: 'gradient-shift 6s ease infinite',
              }}
            />
            <div className="absolute inset-0 border border-[var(--color-card-border)] rounded-2xl" />

            <div className="relative z-10">
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[var(--color-text)] mb-3">
                Quer acompanhar seus pares em tempo real?
              </h2>
              <p className="text-muted font-body text-sm sm:text-base max-w-md mx-auto mb-6">
                Crie sua conta gratuita e monte sua watchlist
              </p>
              <button
                onClick={onSignup}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-base font-semibold font-body transition-all
                  bg-accent hover:bg-accent/90 text-white
                  shadow-[0_0_30px_rgba(99,102,241,0.25)] hover:shadow-[0_0_40px_rgba(99,102,241,0.4)]
                  hover:scale-[1.02] active:scale-[0.98]"
              >
                Criar conta grátis
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* ─── Footer ─── */}
      <footer className="border-t border-[var(--color-card-border)] py-8 text-center">
        <p className="text-xs text-dim font-body">
          Bottrade &copy; {new Date().getFullYear()} &mdash; Painel de monitoramento cripto
        </p>
      </footer>
    </div>
  )
}


