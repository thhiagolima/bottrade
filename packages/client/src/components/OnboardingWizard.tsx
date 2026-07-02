import { useEffect, useState } from 'react'
import type { UserMode } from '@bottrade/shared'

interface OnboardingWizardProps {
  userName: string
  onComplete: (config: {
    userMode: UserMode
    baseCapital: number
    leverage: number
    favorites: string[]
  }) => void | Promise<void>
}

const LEVERAGE_OPTIONS = [2, 3, 5, 10, 20] as const
const POPULAR_PAIRS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT',
  'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT',
] as const

export default function OnboardingWizard({ userName, onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0)
  const [userMode, setUserMode] = useState<UserMode>('trader')
  const [baseCapital, setBaseCapital] = useState(100)
  const [leverage, setLeverage] = useState(5)
  const [favorites, setFavorites] = useState<string[]>(['BTCUSDT', 'ETHUSDT'])
  const [maxFavorites, setMaxFavorites] = useState(3)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/plans')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        const freePlan = data?.plans?.find((plan: { name?: string }) => plan.name?.toLowerCase() === 'free')
        const limit = Number(freePlan?.maxFavorites)
        if (Number.isFinite(limit) && limit > 0) {
          setMaxFavorites(limit)
          setFavorites(prev => prev.slice(0, limit))
        }
      })
      .catch(() => {})
  }, [])

  const toggleFavorite = (pair: string) => {
    setFavorites(prev =>
      prev.includes(pair) ? prev.filter(p => p !== pair) : prev.length < maxFavorites ? [...prev, pair] : prev
    )
  }

  const next = () => setStep(s => s + 1)

  const finish = async () => {
    if (saving) return
    setSaving(true)
    setSaveError(null)
    try {
      await onComplete({ userMode, baseCapital, leverage, favorites })
    } catch {
      setSaveError('Nao foi possivel salvar seus pares. Tente novamente.')
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div
        className="w-full max-w-lg rounded-xl border border-card-border bg-card p-8 shadow-xl"
        style={{ boxShadow: 'var(--glow-accent)' }}
      >
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[0, 1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="h-2 rounded-full transition-all duration-300"
              style={{
                width: i === step ? 24 : 8,
                backgroundColor: i <= step ? 'var(--color-accent)' : 'var(--color-card-border)',
              }}
            />
          ))}
        </div>

        {/* Step content with fade animation */}
        <div key={step} className="animate-fade-in">
          {step === 0 && (
            <StepWelcome name={userName} onNext={next} />
          )}
          {step === 1 && (
            <StepExperience
              userMode={userMode}
              setUserMode={setUserMode}
              onNext={next}
            />
          )}
          {step === 2 && (
            <StepCapital
              capital={baseCapital}
              setCapital={setBaseCapital}
              leverage={leverage}
              setLeverage={setLeverage}
              onNext={next}
            />
          )}
          {step === 3 && (
            <StepFavorites
              favorites={favorites}
              maxFavorites={maxFavorites}
              onToggle={toggleFavorite}
              onNext={next}
            />
          )}
          {step === 4 && (
            <StepDone
              userMode={userMode}
              capital={baseCapital}
              leverage={leverage}
              favorites={favorites}
              onFinish={finish}
              saving={saving}
              error={saveError}
            />
          )}
        </div>
      </div>
    </div>
  )
}

/* -- Step 0: Welcome ------------------------------------------------ */

function StepWelcome({ name, onNext }: { name: string; onNext: () => void }) {
  return (
    <div className="text-center">
      <div className="font-display text-3xl font-bold mb-2">
        Bottrade<span style={{ color: 'var(--color-accent)' }}>.</span>
      </div>
      <h1 className="font-display text-xl mt-6 mb-2" style={{ color: 'var(--color-text)' }}>
        Bem-vindo ao Bottrade, {name}!
      </h1>
      <p className="text-sm mb-8" style={{ color: 'var(--color-text-muted)' }}>
        Vamos configurar seu dashboard em 30 segundos
      </p>
      <button onClick={onNext} className="w-full py-3 rounded-lg font-display text-sm font-semibold text-white transition-opacity hover:opacity-90" style={{ backgroundColor: 'var(--color-accent)' }}>
        Comecar
      </button>
    </div>
  )
}

/* -- Step 1: Experience Level --------------------------------------- */

const MODE_CARDS: { mode: UserMode; label: string; desc: string; features: string[]; color: string; icon: React.ReactNode }[] = [
  {
    mode: 'simple',
    label: 'Simple',
    desc: 'Ideal para quem esta comecando a acompanhar pares cripto.',
    features: ['Leituras simples de contexto', 'Estimativas de risco visiveis', 'Linguagem simplificada sem termos tecnicos', 'Alertas para acompanhar o mercado'],
    color: '#00c896',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
      </svg>
    ),
  },
  {
    mode: 'trader',
    label: 'Trader',
    desc: 'Para quem ja acompanha o mercado e quer mais contexto.',
    features: ['15 indicadores tecnicos detalhados', 'Analise multi-timeframe (15m/1h/4h)', 'Paper tracking para registrar cenarios', 'Planejamento de risco com SL/TP estimado'],
    color: '#f59e0b',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    mode: 'pro',
    label: 'Pro',
    desc: 'Controle total para usuarios avancados.',
    features: ['Ajustar pesos do score de confluencia', 'Configurar periodos de cada indicador', 'Backtest com parametros customizados', 'Webhooks e API access opcional'],
    color: '#ef4444',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

function StepExperience({
  userMode, setUserMode, onNext,
}: {
  userMode: UserMode
  setUserMode: (m: UserMode) => void
  onNext: () => void
}) {
  return (
    <div>
      <h2 className="font-display text-lg font-bold mb-2 text-center">
        Qual seu nivel de experiencia?
      </h2>
      <p className="text-xs text-center mb-6" style={{ color: 'var(--color-text-muted)' }}>
        Isso define quais ferramentas aparecem no seu dashboard
      </p>

      <div className="space-y-3 mb-6">
        {MODE_CARDS.map(({ mode, label, desc, features, color, icon }) => {
          const selected = userMode === mode
          return (
            <button
              key={mode}
              onClick={() => setUserMode(mode)}
              className="w-full flex items-start gap-4 p-4 rounded-lg border transition-all text-left"
              style={{
                backgroundColor: selected ? `${color}10` : 'var(--color-bg-elevated)',
                borderColor: selected ? color : 'var(--color-card-border)',
                boxShadow: selected ? `0 0 20px ${color}20` : 'none',
              }}
            >
              <div className="mt-1" style={{ color: selected ? color : 'var(--color-text-muted)' }}>
                {icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="font-display font-bold text-sm" style={{ color: selected ? color : 'var(--color-text)' }}>
                    {label}
                  </div>
                  {selected && (
                    <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color }}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  {desc}
                </div>
                {selected && (
                  <ul className="mt-2 space-y-1">
                    {features.map((f, i) => (
                      <li key={i} className="text-[11px] flex items-start gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" className="mt-0.5 flex-shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </button>
          )
        })}
      </div>

      <button onClick={onNext} className="w-full py-3 rounded-lg font-display text-sm font-semibold text-white transition-opacity hover:opacity-90" style={{ backgroundColor: 'var(--color-accent)' }}>
        Proximo
      </button>
    </div>
  )
}

/* -- Step 2: Capital & Leverage ------------------------------------- */

function StepCapital({
  capital, setCapital, leverage, setLeverage, onNext,
}: {
  capital: number
  setCapital: (v: number) => void
  leverage: number
  setLeverage: (v: number) => void
  onNext: () => void
}) {
  return (
    <div>
      <h2 className="font-display text-lg font-bold mb-6 text-center">
        Capital &amp; Alavancagem
      </h2>

      <label className="block text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>
        Qual seu capital base?
      </label>
      <div className="relative mb-5">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--color-text-muted)' }}>R$</span>
        <input
          type="number"
          min={1}
          value={capital}
          onChange={e => setCapital(Number(e.target.value) || 0)}
          className="w-full rounded-lg border py-2.5 pl-10 pr-3 text-sm outline-none transition-colors focus:border-accent"
          style={{
            backgroundColor: 'var(--color-bg-elevated)',
            borderColor: 'var(--color-card-border)',
            color: 'var(--color-text)',
          }}
        />
      </div>

      <label className="block text-sm mb-2" style={{ color: 'var(--color-text-muted)' }}>
        Qual alavancagem padrao?
      </label>
      <div className="flex gap-2 mb-4">
        {LEVERAGE_OPTIONS.map(lev => (
          <button
            key={lev}
            onClick={() => setLeverage(lev)}
            className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all border"
            style={{
              backgroundColor: leverage === lev ? 'var(--color-accent)' : 'var(--color-bg-elevated)',
              borderColor: leverage === lev ? 'var(--color-accent)' : 'var(--color-card-border)',
              color: leverage === lev ? '#fff' : 'var(--color-text-muted)',
            }}
          >
            {lev}x
          </button>
        ))}
      </div>

      <p className="text-xs mb-6" style={{ color: 'var(--color-text-dim)' }}>
        Usamos esses valores para calcular tamanho de posicao e risco
      </p>

      <button onClick={onNext} className="w-full py-3 rounded-lg font-display text-sm font-semibold text-white transition-opacity hover:opacity-90" style={{ backgroundColor: 'var(--color-accent)' }}>
        Proximo
      </button>
    </div>
  )
}

/* -- Step 3: Pick Favorites ----------------------------------------- */

function StepFavorites({
  favorites, maxFavorites, onToggle, onNext,
}: {
  favorites: string[]
  maxFavorites: number
  onToggle: (pair: string) => void
  onNext: () => void
}) {
  return (
    <div>
      <h2 className="font-display text-lg font-bold mb-2 text-center">
        Escolha seus pares favoritos
      </h2>
      <p className="text-xs text-center mb-6" style={{ color: 'var(--color-text-muted)' }}>
        Seu plano inicial permite ate {maxFavorites} pares
      </p>

      <div className="grid grid-cols-2 gap-2 mb-6">
        {POPULAR_PAIRS.map(pair => {
          const selected = favorites.includes(pair)
          const disabled = !selected && favorites.length >= maxFavorites
          return (
            <button
              key={pair}
              onClick={() => onToggle(pair)}
              disabled={disabled}
              className="py-2.5 px-3 rounded-lg text-sm font-semibold transition-all border disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                backgroundColor: selected ? 'var(--color-accent-dim)' : 'var(--color-bg-elevated)',
                borderColor: selected ? 'var(--color-accent)' : 'var(--color-card-border)',
                color: selected ? 'var(--color-accent)' : 'var(--color-text-muted)',
              }}
            >
              {pair.replace('USDT', '')}
              <span style={{ color: 'var(--color-text-dim)' }}>/USDT</span>
            </button>
          )
        })}
      </div>

      <button disabled={favorites.length === 0} onClick={onNext} className="w-full py-3 rounded-lg font-display text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed" style={{ backgroundColor: 'var(--color-accent)' }}>
        Proximo
      </button>
    </div>
  )
}

/* -- Step 4: Done --------------------------------------------------- */

const MODE_LABELS: Record<UserMode, string> = {
  simple: 'Simple',
  trader: 'Trader',
  pro: 'Pro',
}

function StepDone({
  userMode, capital, leverage, favorites, onFinish, saving, error,
}: {
  userMode: UserMode
  capital: number
  leverage: number
  favorites: string[]
  onFinish: () => void
  saving: boolean
  error: string | null
}) {
  return (
    <div className="text-center">
      <div className="text-4xl mb-3">&#x2705;</div>
      <h2 className="font-display text-xl font-bold mb-4">Tudo pronto!</h2>

      <div
        className="rounded-lg p-4 mb-4 text-left text-sm space-y-2"
        style={{ backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-card-border)' }}
      >
        <div className="flex justify-between">
          <span style={{ color: 'var(--color-text-muted)' }}>Modo</span>
          <span className="font-semibold" style={{ color: 'var(--color-accent)' }}>{MODE_LABELS[userMode]}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'var(--color-text-muted)' }}>Capital</span>
          <span className="font-mono-num font-semibold">R$ {capital}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'var(--color-text-muted)' }}>Alavancagem</span>
          <span className="font-mono-num font-semibold">{leverage}x</span>
        </div>
        <div className="flex justify-between items-start">
          <span style={{ color: 'var(--color-text-muted)' }}>Pares</span>
          <span className="font-mono-num font-semibold text-right">
            {favorites.join(', ')}
          </span>
        </div>
      </div>

      <p className="text-xs mb-6" style={{ color: 'var(--color-text-muted)' }}>
        Voce pode mudar o modo a qualquer momento em Configuracoes
      </p>

      {error && (
        <p className="text-xs mb-3 text-bear">
          {error}
        </p>
      )}

      <button disabled={saving} onClick={onFinish} className="w-full py-3 rounded-lg font-display text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed" style={{ backgroundColor: 'var(--color-accent)' }}>
        {saving ? 'Salvando...' : 'Ir para o Dashboard'}
      </button>
    </div>
  )
}
