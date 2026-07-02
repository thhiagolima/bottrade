import { useState, useEffect, useRef, useCallback } from 'react'
import { useStore } from '../store/useStore'
import { emitUpdateSettings, emitTestTelegram } from '../hooks/useSocket'
import type { UserSettings, AutoTradeConfig, IndicatorToggles, UserMode, RiskConfig, StrategyProfile } from '@bottrade/shared'
import toast from 'react-hot-toast'

const defaultToggles: IndicatorToggles = {
  ma: true, ema: true, macd: true, stochRsi: true, volume: true,
  rsi: true, bollingerBands: true, atr: true, adx: true, vwap: true,
  williamsR: true, cci: true, mfi: true, obv: true, parabolicSar: true,
  openInterest: true, longShortRatio: true, fearGreed: true,
}

interface ScoreConfig {
  longThreshold: number; shortThreshold: number; highConfLong: number; highConfShort: number
}
interface ScoreWeights {
  structure: number; macd: number; stochRsi: number; volume: number; funding: number; ema: number
}
interface IndicatorPeriods {
  rsiPeriod: number; stochRsiPeriod: number; macdFast: number; macdSlow: number; macdSignal: number; bollingerPeriod: number; bollingerStdDev: number; atrPeriod: number; adxPeriod: number
}

const defaultRiskConfig: RiskConfig = {
  slMode: 'auto', slFixedPercent: 1.5, atrMultiplier: 2.0,
  tpMode: 'rr', tpFixedPercent: 3.0, rrRatio: 2.0,
  useSmartMoneySR: true, minSlPercent: 0.5, maxSlPercent: 5.0,
}
const defaultScoreConfig: ScoreConfig = { longThreshold: 65, shortThreshold: 35, highConfLong: 85, highConfShort: 15 }
const defaultWeights: ScoreWeights = { structure: 25, macd: 20, stochRsi: 20, volume: 15, funding: 15, ema: 5 }
const defaultPeriods: IndicatorPeriods = { rsiPeriod: 14, stochRsiPeriod: 14, macdFast: 12, macdSlow: 26, macdSignal: 9, bollingerPeriod: 20, bollingerStdDev: 2, atrPeriod: 14, adxPeriod: 14 }

function toUiScoreConfigValue(config: UserSettings['scoreConfig']): ScoreConfig {
  return {
    longThreshold: config?.longThreshold ?? defaultScoreConfig.longThreshold,
    shortThreshold: config?.shortThreshold ?? defaultScoreConfig.shortThreshold,
    highConfLong: config?.highConfidenceLong ?? defaultScoreConfig.highConfLong,
    highConfShort: config?.highConfidenceShort ?? defaultScoreConfig.highConfShort,
  }
}

function toUiScoreConfig(settings: UserSettings): ScoreConfig {
  return toUiScoreConfigValue(settings.scoreConfig)
}

function toUiWeightsValue(scoreConfig: UserSettings['scoreConfig']): ScoreWeights {
  const weights = scoreConfig?.weights ?? {}
  return {
    structure: weights.structure ?? defaultWeights.structure,
    macd: weights.macd ?? defaultWeights.macd,
    stochRsi: weights.stochRsi ?? defaultWeights.stochRsi,
    volume: weights.volume ?? defaultWeights.volume,
    funding: weights.funding ?? defaultWeights.funding,
    ema: weights.emaAlignment ?? defaultWeights.ema,
  }
}

function toUiWeights(settings: UserSettings): ScoreWeights {
  return toUiWeightsValue(settings.scoreConfig)
}

function toUiPeriods(settings: UserSettings): IndicatorPeriods {
  const periods = settings.indicatorPeriods ?? {}
  return {
    rsiPeriod: periods.rsiPeriod ?? defaultPeriods.rsiPeriod,
    stochRsiPeriod: periods.stochRsiPeriod ?? defaultPeriods.stochRsiPeriod,
    macdFast: periods.macdFast ?? defaultPeriods.macdFast,
    macdSlow: periods.macdSlow ?? defaultPeriods.macdSlow,
    macdSignal: periods.macdSignal ?? defaultPeriods.macdSignal,
    bollingerPeriod: periods.bollingerPeriod ?? defaultPeriods.bollingerPeriod,
    bollingerStdDev: periods.bollingerStdDev ?? defaultPeriods.bollingerStdDev,
    atrPeriod: periods.atrPeriod ?? defaultPeriods.atrPeriod,
    adxPeriod: periods.adxPeriod ?? defaultPeriods.adxPeriod,
  }
}

function toSettingsScoreConfig(scoreConfig: ScoreConfig, weights: ScoreWeights): NonNullable<UserSettings['scoreConfig']> {
  return {
    longThreshold: scoreConfig.longThreshold,
    shortThreshold: scoreConfig.shortThreshold,
    highConfidenceLong: scoreConfig.highConfLong,
    highConfidenceShort: scoreConfig.highConfShort,
    weights: {
      structure: weights.structure,
      macd: weights.macd,
      stochRsi: weights.stochRsi,
      volume: weights.volume,
      funding: weights.funding,
      emaAlignment: weights.ema,
    },
  }
}

const MODE_CLASSES: Record<UserMode, { bgLight: string; bgSelected: string; text: string; border: string; borderSelected: string }> = {
  simple: { bgLight: 'bg-bull/10', bgSelected: 'bg-bull/15', text: 'text-bull', border: 'border-card-border', borderSelected: 'border-bull' },
  trader: { bgLight: 'bg-warn/10', bgSelected: 'bg-warn/15', text: 'text-warn', border: 'border-card-border', borderSelected: 'border-warn' },
  pro: { bgLight: 'bg-bear/10', bgSelected: 'bg-bear/15', text: 'text-bear', border: 'border-card-border', borderSelected: 'border-bear' },
}

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className={`w-10 h-5 rounded-full transition-colors ${enabled ? 'bg-bull' : 'bg-card-border'}`}>
      <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  )
}

function SliderInput({ label, value, min, max, step = 1, onChange, suffix }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; suffix?: string
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-[11px] text-muted">{label}</label>
        <span className="text-xs font-mono-num text-[var(--color-text)]">{value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full h-1.5 bg-card-border rounded-full appearance-none cursor-pointer accent-accent" />
    </div>
  )
}

function NumberInput({ label, value, min, max, step = 1, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] text-muted">{label}</label>
      <input type="number" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full px-2 py-1 bg-bg border border-card-border rounded text-white font-mono-num text-xs h-7" />
    </div>
  )
}

type TabKey = 'geral' | 'indicadores' | 'score' | 'perfis' | 'integracoes' | 'conta'

function getTabsForMode(mode: UserMode): { key: TabKey; label: string }[] {
  switch (mode) {
    case 'simple': return [
      { key: 'geral', label: 'Geral' },
      { key: 'integracoes', label: 'Integracoes' },
      { key: 'conta', label: 'Conta' },
    ]
    case 'trader': return [
      { key: 'geral', label: 'Geral' },
      { key: 'indicadores', label: 'Indicadores' },
      { key: 'integracoes', label: 'Integracoes' },
      { key: 'conta', label: 'Conta' },
    ]
    case 'pro': return [
      { key: 'geral', label: 'Geral' },
      { key: 'indicadores', label: 'Indicadores' },
      { key: 'score', label: 'Score' },
      { key: 'perfis', label: 'Perfis' },
      { key: 'integracoes', label: 'Integracoes' },
      { key: 'conta', label: 'Conta' },
    ]
  }
}

export default function SettingsPage() {
  const settings = useStore((s) => s.settings)
  const authUser = useStore((s) => s.authUser)
  const theme = useStore((s) => s.theme)
  const toggleTheme = useStore((s) => s.toggleTheme)
  const favorites = useStore((s) => s.favorites)
  const userMode = (settings.userMode || 'trader') as UserMode

  const navigateTo = useStore((s) => s.navigateTo)

  const [local, setLocal] = useState<UserSettings>({ ...settings })
  const [activeTab, setActiveTab] = useState<TabKey>('geral')
  const [scoreConfig, setScoreConfig] = useState<ScoreConfig>(() => toUiScoreConfig(settings))
  const [weights, setWeights] = useState<ScoreWeights>(() => toUiWeights(settings))
  const [periods, setPeriods] = useState<IndicatorPeriods>(() => toUiPeriods(settings))
  const [telegramTesting, setTelegramTesting] = useState(false)
  const [riskConfig, setRiskConfig] = useState<RiskConfig>({ ...defaultRiskConfig, ...(settings.riskConfig ?? {}) })
  const [selectedProfileId, setSelectedProfileId] = useState<string>('')
  const [profileDraft, setProfileDraft] = useState<StrategyProfile | null>(null)
  const [profileDirty, setProfileDirty] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setLocal({ ...settings })
    setRiskConfig({ ...defaultRiskConfig, ...(settings.riskConfig ?? {}) })
    setScoreConfig(toUiScoreConfig(settings))
    setWeights(toUiWeights(settings))
    setPeriods(toUiPeriods(settings))
    const profiles = settings.strategyProfiles ?? []
    setSelectedProfileId((current) => current && profiles.some((p) => p.id === current) ? current : (profiles[0]?.id ?? ''))
  }, [settings])
  useEffect(() => { return () => { if (debounceRef.current) clearTimeout(debounceRef.current) } }, [])

  // Escape key to go back to dashboard
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigateTo('dashboard')
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [navigateTo])

  const emitDebounced = useCallback((updated: Partial<UserSettings>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void emitUpdateSettings(updated).catch(() => {})
    }, 500)
  }, [])

  const updateField = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    const updated = { ...local, [key]: value }
    setLocal(updated)
    // Optimistically update the store for userMode so all components react immediately
    if (key === 'userMode') {
      useStore.setState({ settings: { ...useStore.getState().settings, userMode: value as UserSettings['userMode'] } })
    }
    emitDebounced({ [key]: value })
  }

  const handleDesktopNotifToggle = (enabled: boolean) => {
    if (enabled && 'Notification' in window && Notification.permission !== 'granted') Notification.requestPermission()
    updateField('desktopNotifications', enabled)
  }

  const handleTestTelegram = () => {
    setTelegramTesting(true)
    emitTestTelegram((result) => {
      setTelegramTesting(false)
      if (result.success) toast.success('Telegram conectado com sucesso!')
      else toast.error(result.error || 'Erro ao conectar com Telegram')
    })
    setTimeout(() => setTelegramTesting(false), 10000)
  }

  const handleRestoreDefaults = () => {
    const nextScoreConfig = { ...defaultScoreConfig }
    const nextWeights = { ...defaultWeights }
    const nextPeriods = { ...defaultPeriods }
    setScoreConfig(nextScoreConfig)
    setWeights(nextWeights)
    setPeriods(nextPeriods)
    emitDebounced({
      scoreConfig: toSettingsScoreConfig(nextScoreConfig, nextWeights),
      indicatorPeriods: nextPeriods,
    })
    toast.success('Valores padrao restaurados')
  }

  const updateScoreConfig = (next: ScoreConfig) => {
    setScoreConfig(next)
    emitDebounced({ scoreConfig: toSettingsScoreConfig(next, weights) })
  }

  const updateWeights = (next: ScoreWeights) => {
    setWeights(next)
    emitDebounced({ scoreConfig: toSettingsScoreConfig(scoreConfig, next) })
  }

  const updatePeriods = (next: IndicatorPeriods) => {
    setPeriods(next)
    emitDebounced({ indicatorPeriods: next })
  }

  const updateRiskConfig = <K extends keyof RiskConfig>(key: K, value: RiskConfig[K]) => {
    const updated = { ...riskConfig, [key]: value }
    setRiskConfig(updated)
    emitDebounced({ riskConfig: updated })
  }

  const tabs = getTabsForMode(userMode)
  const weightSum = weights.structure + weights.macd + weights.stochRsi + weights.volume + weights.funding + weights.ema
  const profiles = local.strategyProfiles ?? []
  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) ?? null
  const editableProfile = profileDraft?.id === selectedProfileId ? profileDraft : selectedProfile
  const assignablePairs = favorites.length > 0 ? favorites : (local.favorites?.length ? local.favorites : local.pairs)

  useEffect(() => {
    if (!selectedProfile) {
      setProfileDraft(null)
      setProfileDirty(false)
      setProfileSaved(false)
      return
    }
    setProfileDraft(selectedProfile)
    setProfileDirty(false)
    setProfileSaved(false)
  }, [selectedProfileId, selectedProfile?.id])

  const updateSettingsPatch = (patch: Partial<UserSettings>) => {
    setLocal((prev) => ({ ...prev, ...patch }))
    emitDebounced(patch)
  }

  const createProfile = () => {
    const id = `profile_${Date.now().toString(36)}`
    const nextProfile: StrategyProfile = {
      id,
      name: `Perfil ${profiles.length + 1}`,
      scoreConfig: toSettingsScoreConfig(scoreConfig, weights),
      riskConfig,
      indicatorToggles: local.indicatorToggles ?? defaultToggles,
      indicatorPeriods: periods,
    }
    const nextProfiles = [...profiles, nextProfile]
    setSelectedProfileId(id)
    updateSettingsPatch({ strategyProfiles: nextProfiles })
    toast.success('Perfil criado')
  }

  const updateProfile = (profileId: string, updater: (profile: StrategyProfile) => StrategyProfile) => {
    const nextProfiles = profiles.map((profile) => profile.id === profileId ? updater(profile) : profile)
    updateSettingsPatch({ strategyProfiles: nextProfiles })
  }

  const editProfileDraft = (updater: (profile: StrategyProfile) => StrategyProfile) => {
    setProfileDraft((current) => {
      if (!current) return current
      return updater(current)
    })
    setProfileDirty(true)
    setProfileSaved(false)
  }

  const saveProfileDraft = () => {
    if (!profileDraft) return
    const savedProfile = { ...profileDraft, name: profileDraft.name.trim() }
    if (!savedProfile.name) {
      toast.error('Informe um nome para o perfil')
      return
    }
    const nextProfiles = profiles.map((profile) => profile.id === savedProfile.id ? savedProfile : profile)
    setLocal((prev) => ({ ...prev, strategyProfiles: nextProfiles }))
    setProfileDraft(savedProfile)
    setProfileDirty(false)
    setProfileSaved(true)
    void emitUpdateSettings({ strategyProfiles: nextProfiles })
      .then(() => toast.success('Perfil salvo'))
      .catch(() => toast.error('Erro ao salvar perfil'))
  }

  const deleteProfile = (profileId: string) => {
    const nextProfiles = profiles.filter((profile) => profile.id !== profileId)
    const nextPairAssignments = { ...(local.pairProfileAssignments ?? {}) }
    const nextPaperAssignments = { ...(local.paperProfileAssignments ?? {}) }
    for (const symbol of Object.keys(nextPairAssignments)) {
      if (nextPairAssignments[symbol] === profileId) delete nextPairAssignments[symbol]
    }
    for (const symbol of Object.keys(nextPaperAssignments)) {
      if (nextPaperAssignments[symbol] === profileId) delete nextPaperAssignments[symbol]
    }
    setSelectedProfileId(nextProfiles[0]?.id ?? '')
    setProfileDraft(null)
    setProfileDirty(false)
    setProfileSaved(false)
    updateSettingsPatch({
      strategyProfiles: nextProfiles,
      pairProfileAssignments: nextPairAssignments,
      paperProfileAssignments: nextPaperAssignments,
    })
    toast.success('Perfil excluido')
  }

  const assignProfile = (symbol: string, profileId: string, scope: 'live' | 'paper') => {
    const key = scope === 'live' ? 'pairProfileAssignments' : 'paperProfileAssignments'
    const next = { ...(local[key] ?? {}) }
    if (profileId) next[symbol] = profileId
    else delete next[symbol]
    updateSettingsPatch({ [key]: next } as Partial<UserSettings>)
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Tab bar */}
      <div className="flex border-b border-card-border px-3 flex-shrink-0 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 text-xs font-bold transition-all relative whitespace-nowrap ${
              activeTab === tab.key ? 'text-white' : 'text-muted hover:text-white'
            }`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-3 py-2 md:px-4 md:py-3">
        <div className="max-w-2xl mx-auto space-y-3">
          {activeTab === 'geral' && (
            <>
              {/* Capital & Leverage */}
              <Section title="Capital & Alavancagem">
                <div className="space-y-1">
                  <label htmlFor="page-capital" className="text-[11px] text-muted">Capital Base (R$)</label>
                  <input id="page-capital" type="number" value={local.baseCapital} onChange={(e) => updateField('baseCapital', Number(e.target.value))} className="w-full px-2 py-1 bg-bg border border-card-border rounded text-white font-mono-num text-xs h-7" />
                </div>
                <div className="space-y-1">
                  <label htmlFor="page-leverage" className="text-[11px] text-muted">Alavancagem</label>
                  <select id="page-leverage" value={local.leverage} onChange={(e) => updateField('leverage', Number(e.target.value))} className="w-full px-2 py-1 bg-bg border border-card-border rounded text-white text-xs h-7">
                    {[2, 3, 5, 10, 20].map((v) => <option key={v} value={v}>{v}x</option>)}
                  </select>
                </div>
              </Section>

              {/* Risk Management */}
              <Section title="Gestao de Risco">
                {/* Stop Loss Mode */}
                <div className="space-y-1">
                  <label className="text-[11px] text-muted">Modo Stop Loss</label>
                  <select value={riskConfig.slMode} onChange={(e) => updateRiskConfig('slMode', e.target.value as RiskConfig['slMode'])} className="w-full px-2 py-1 bg-bg border border-card-border rounded text-white text-xs h-7">
                    <option value="auto">Auto (ATR + MAs + S/R)</option>
                    <option value="atr">ATR</option>
                    <option value="fixed">Fixo (%)</option>
                  </select>
                </div>

                {(riskConfig.slMode === 'auto' || riskConfig.slMode === 'atr') && (
                  <SliderInput label="Multiplicador ATR" value={riskConfig.atrMultiplier} min={0.5} max={5} step={0.1} onChange={(v) => updateRiskConfig('atrMultiplier', v)} suffix="x" />
                )}

                {riskConfig.slMode === 'fixed' && (
                  <NumberInput label="SL Fixo (%)" value={riskConfig.slFixedPercent} min={0.1} max={20} step={0.1} onChange={(v) => updateRiskConfig('slFixedPercent', v)} />
                )}

                <div className="grid grid-cols-2 gap-2">
                  <NumberInput label="Distancia min (%)" value={riskConfig.minSlPercent} min={0.1} max={10} step={0.1} onChange={(v) => updateRiskConfig('minSlPercent', v)} />
                  <NumberInput label="Distancia max (%)" value={riskConfig.maxSlPercent} min={0.5} max={20} step={0.1} onChange={(v) => updateRiskConfig('maxSlPercent', v)} />
                </div>

                {/* Take Profit Mode */}
                <div className="space-y-1 mt-2">
                  <label className="text-[11px] text-muted">Modo Take Profit</label>
                  <select value={riskConfig.tpMode} onChange={(e) => updateRiskConfig('tpMode', e.target.value as RiskConfig['tpMode'])} className="w-full px-2 py-1 bg-bg border border-card-border rounded text-white text-xs h-7">
                    <option value="rr">Risco/Retorno</option>
                    <option value="fixed">Fixo (%)</option>
                  </select>
                </div>

                {riskConfig.tpMode === 'rr' && (
                  <SliderInput label="Ratio R:R" value={riskConfig.rrRatio} min={0.5} max={10} step={0.1} onChange={(v) => updateRiskConfig('rrRatio', v)} suffix=":1" />
                )}

                {riskConfig.tpMode === 'fixed' && (
                  <NumberInput label="TP Fixo (%)" value={riskConfig.tpFixedPercent} min={0.1} max={50} step={0.1} onChange={(v) => updateRiskConfig('tpFixedPercent', v)} />
                )}

                {/* Smart Money S/R */}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] text-muted">Usar S/R Zones para ajustar SL/TP</span>
                  <Toggle enabled={riskConfig.useSmartMoneySR} onToggle={() => updateRiskConfig('useSmartMoneySR', !riskConfig.useSmartMoneySR)} />
                </div>
              </Section>

              {/* Theme & Notifications */}
              <Section title="Aparencia & Notificacoes">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted">Tema claro</span>
                  <button onClick={toggleTheme} className={`w-10 h-5 rounded-full transition-colors ${theme === 'light' ? 'bg-bull' : 'bg-card-border'}`}>
                    <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${theme === 'light' ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted">Sons de alerta</span>
                  <Toggle enabled={local.soundAlerts} onToggle={() => updateField('soundAlerts', !local.soundAlerts)} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted">Notificacoes desktop</span>
                  <Toggle enabled={local.desktopNotifications} onToggle={() => handleDesktopNotifToggle(!local.desktopNotifications)} />
                </div>
              </Section>

              {/* User Mode */}
              <Section title="Modo de Experiencia">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {([
                    {
                      mode: 'simple' as UserMode,
                      title: 'Simple',
                      subtitle: 'Para quem esta comecando',
                      features: [
                        'Score e direcao tecnica',
                        'Estimativas de Stop Loss e Take Profit',
                        'Alertas de acompanhamento',
                        'Linguagem simplificada',
                      ],
                    },
                    {
                      mode: 'trader' as UserMode,
                      title: 'Trader',
                      subtitle: 'Para quem ja opera',
                      features: [
                        'Todos os indicadores tecnicos',
                        'Multi-timeframe (15m/1h/4h)',
                        'Paper trading para validar',
                        'Gestao de risco detalhada',
                      ],
                    },
                    {
                      mode: 'pro' as UserMode,
                      title: 'Pro',
                      subtitle: 'Controle total',
                      features: [
                        'Ajustar pesos do score',
                        'Configurar periodos dos indicadores',
                        'Backtest com parametros custom',
                        'Alertas avancados + webhooks',
                      ],
                    },
                  ]).map(({ mode, title, subtitle, features }) => {
                    const selected = (local.userMode || 'trader') === mode
                    const mc = MODE_CLASSES[mode]
                    return (
                      <button
                        key={mode}
                        onClick={() => updateField('userMode', mode)}
                        className={`px-3 py-2 rounded border text-left transition-all ${
                          selected ? `${mc.bgSelected} ${mc.borderSelected} shadow-lg` : `bg-bg ${mc.border} hover:${mc.borderSelected}`
                        }`}
                      >
                        <div className={`text-xs font-bold ${selected ? mc.text : 'text-[var(--color-text)]'}`}>{title}</div>
                        <div className="text-[10px] text-muted mt-0.5">{subtitle}</div>
                        <ul className="mt-1.5 space-y-0.5">
                          {features.map((f, i) => (
                            <li key={i} className="text-[10px] text-muted flex items-start gap-1">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`mt-0.5 flex-shrink-0 ${selected ? mc.text : 'text-muted'}`}><polyline points="20 6 9 17 4 12"/></svg>
                              {f}
                            </li>
                          ))}
                        </ul>
                      </button>
                    )
                  })}
                </div>
              </Section>
            </>
          )}

          {activeTab === 'indicadores' && (
            <>
              <Section title="Indicadores Tecnicos">
                {([
                  ['ma', 'MAs (MA20/50/100/200)'], ['ema', 'EMAs (EMA20/50)'], ['macd', 'MACD'], ['stochRsi', 'StochRSI'], ['rsi', 'RSI'],
                  ['bollingerBands', 'Bollinger Bands'], ['atr', 'ATR'], ['adx', 'ADX'], ['vwap', 'VWAP'],
                  ['williamsR', 'Williams %R'], ['cci', 'CCI'], ['mfi', 'MFI'], ['obv', 'OBV'], ['parabolicSar', 'Parabolic SAR'], ['volume', 'Volume'],
                ] as [keyof IndicatorToggles, string][]).map(([key, label]) => {
                  const currentToggles = local.indicatorToggles ?? defaultToggles
                  const enabled = currentToggles[key]
                  return (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-[11px] text-muted">{label}</span>
                      <Toggle enabled={!!enabled} onToggle={() => { const updated: IndicatorToggles = { ...currentToggles, [key]: !enabled }; updateField('indicatorToggles', updated) }} />
                    </div>
                  )
                })}
              </Section>

              <Section title="Indicadores Externos">
                {([
                  ['openInterest', 'Open Interest'], ['longShortRatio', 'Long/Short Ratio'], ['fearGreed', 'Fear & Greed'],
                ] as [keyof IndicatorToggles, string][]).map(([key, label]) => {
                  const currentToggles = local.indicatorToggles ?? defaultToggles
                  const enabled = currentToggles[key]
                  return (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-[11px] text-muted">{label}</span>
                      <Toggle enabled={!!enabled} onToggle={() => { const updated: IndicatorToggles = { ...currentToggles, [key]: !enabled }; updateField('indicatorToggles', updated) }} />
                    </div>
                  )
                })}
              </Section>

              {/* Periods (pro only) */}
              {userMode === 'pro' && (
                <Section title="Periodos dos Indicadores">
                  <div className="grid grid-cols-2 gap-2">
                    <NumberInput label="RSI" value={periods.rsiPeriod} min={2} max={100} onChange={(v) => updatePeriods({ ...periods, rsiPeriod: v })} />
                    <NumberInput label="StochRSI" value={periods.stochRsiPeriod} min={2} max={100} onChange={(v) => updatePeriods({ ...periods, stochRsiPeriod: v })} />
                    <NumberInput label="MACD Fast" value={periods.macdFast} min={2} max={100} onChange={(v) => updatePeriods({ ...periods, macdFast: v })} />
                    <NumberInput label="MACD Slow" value={periods.macdSlow} min={2} max={100} onChange={(v) => updatePeriods({ ...periods, macdSlow: v })} />
                    <NumberInput label="MACD Signal" value={periods.macdSignal} min={2} max={100} onChange={(v) => updatePeriods({ ...periods, macdSignal: v })} />
                    <NumberInput label="Bollinger" value={periods.bollingerPeriod} min={2} max={100} onChange={(v) => updatePeriods({ ...periods, bollingerPeriod: v })} />
                    <NumberInput label="Bollinger StdDev" value={periods.bollingerStdDev} min={1} max={5} step={0.5} onChange={(v) => updatePeriods({ ...periods, bollingerStdDev: v })} />
                    <NumberInput label="ATR" value={periods.atrPeriod} min={2} max={100} onChange={(v) => updatePeriods({ ...periods, atrPeriod: v })} />
                    <NumberInput label="ADX" value={periods.adxPeriod} min={2} max={100} onChange={(v) => updatePeriods({ ...periods, adxPeriod: v })} />
                  </div>
                </Section>
              )}
            </>
          )}

          {activeTab === 'score' && (
            <>
              <Section title="Configuracao de Score">
                <SliderInput label="LONG threshold" value={scoreConfig.longThreshold} min={50} max={95} onChange={(v) => updateScoreConfig({ ...scoreConfig, longThreshold: v })} />
                <SliderInput label="SHORT threshold" value={scoreConfig.shortThreshold} min={5} max={50} onChange={(v) => updateScoreConfig({ ...scoreConfig, shortThreshold: v })} />
                <SliderInput label="High confidence LONG" value={scoreConfig.highConfLong} min={70} max={100} onChange={(v) => updateScoreConfig({ ...scoreConfig, highConfLong: v })} />
                <SliderInput label="High confidence SHORT" value={scoreConfig.highConfShort} min={0} max={30} onChange={(v) => updateScoreConfig({ ...scoreConfig, highConfShort: v })} />
              </Section>

              <Section title="Pesos do Score">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-muted font-bold uppercase tracking-wider">Total</span>
                  <span className={`text-xs font-mono-num font-bold ${weightSum === 100 ? 'text-bull' : 'text-bear'}`}>{weightSum}/100</span>
                </div>
                {weightSum !== 100 && (
                  <div className="bg-warn/10 border border-warn/30 rounded px-2 py-1 text-warn text-[10px] leading-tight mb-1.5">
                    A soma dos pesos deve ser 100. Atual: {weightSum}
                  </div>
                )}
                <SliderInput label="Structure" value={weights.structure} min={0} max={50} onChange={(v) => updateWeights({ ...weights, structure: v })} suffix="%" />
                <SliderInput label="MACD" value={weights.macd} min={0} max={50} onChange={(v) => updateWeights({ ...weights, macd: v })} suffix="%" />
                <SliderInput label="StochRSI" value={weights.stochRsi} min={0} max={50} onChange={(v) => updateWeights({ ...weights, stochRsi: v })} suffix="%" />
                <SliderInput label="Volume" value={weights.volume} min={0} max={50} onChange={(v) => updateWeights({ ...weights, volume: v })} suffix="%" />
                <SliderInput label="Funding" value={weights.funding} min={0} max={50} onChange={(v) => updateWeights({ ...weights, funding: v })} suffix="%" />
                <SliderInput label="EMA" value={weights.ema} min={0} max={50} onChange={(v) => updateWeights({ ...weights, ema: v })} suffix="%" />
                <button onClick={handleRestoreDefaults} className="w-full px-2 py-1.5 bg-card-border/50 border border-card-border rounded text-muted text-xs font-bold hover:bg-card-border transition-colors mt-1">
                  Restaurar padroes
                </button>
              </Section>
            </>
          )}

          {activeTab === 'perfis' && (
            <>
              <Section title="Perfis de Estrategia">
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                  <div>
                    <div className="text-xs font-bold text-white">Configuracoes reutilizaveis por par</div>
                    <div className="text-[10px] text-muted mt-0.5">Cada perfil pode ter thresholds e pesos proprios para monitoramento e paper trade.</div>
                  </div>
                  <button
                    onClick={createProfile}
                    className="px-3 py-1.5 bg-accent/20 border border-accent/30 rounded text-accent text-xs font-bold hover:bg-accent/30 transition-colors"
                  >
                    Criar perfil
                  </button>
                </div>

                {profiles.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {profiles.map((profile) => {
                      const selected = profile.id === selectedProfileId
                      return (
                        <button
                          key={profile.id}
                          onClick={() => setSelectedProfileId(profile.id)}
                          className={`min-w-0 px-3 py-2 rounded border text-left transition-colors ${
                            selected ? 'bg-accent/15 border-accent/60' : 'bg-bg border-card-border hover:border-accent/40'
                          }`}
                        >
                          <div className="text-xs font-bold text-white truncate">{profile.name}</div>
                          <div className="text-[10px] text-muted mt-0.5">
                            Long {profile.scoreConfig?.longThreshold ?? defaultScoreConfig.longThreshold}% / Short {profile.scoreConfig?.shortThreshold ?? defaultScoreConfig.shortThreshold}%
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="bg-bg border border-card-border rounded px-3 py-2 text-[11px] text-muted">
                    Nenhum perfil criado. Crie um perfil a partir da configuracao global atual.
                  </div>
                )}
              </Section>

              {editableProfile && (() => {
                const profileScore = toUiScoreConfigValue(editableProfile.scoreConfig)
                const profileWeights = toUiWeightsValue(editableProfile.scoreConfig)
                const profileWeightSum = profileWeights.structure + profileWeights.macd + profileWeights.stochRsi + profileWeights.volume + profileWeights.funding + profileWeights.ema
                const updateProfileScore = (nextScore: ScoreConfig, nextWeights = profileWeights) => {
                  editProfileDraft((profile) => ({
                    ...profile,
                    scoreConfig: toSettingsScoreConfig(nextScore, nextWeights),
                  }))
                }
                const updateProfileWeights = (nextWeights: ScoreWeights) => {
                  editProfileDraft((profile) => ({
                    ...profile,
                    scoreConfig: toSettingsScoreConfig(profileScore, nextWeights),
                  }))
                }

                return (
                  <>
                    <Section title="Editar Perfil">
                      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                        <div>
                          <div className="text-xs font-bold text-white">Ajustes do perfil selecionado</div>
                          <div className={`text-[10px] mt-0.5 ${profileDirty ? 'text-warn' : profileSaved ? 'text-bull' : 'text-muted'}`}>
                            {profileDirty ? 'Alteracoes pendentes' : profileSaved ? 'Perfil salvo com sucesso' : 'Sem alteracoes pendentes'}
                          </div>
                        </div>
                        <button
                          onClick={saveProfileDraft}
                          disabled={!profileDirty}
                          className="px-3 py-1.5 bg-bull/15 border border-bull/40 rounded text-bull text-xs font-bold hover:bg-bull/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Salvar perfil
                        </button>
                      </div>

                      <div className="space-y-1 min-w-0">
                        <label htmlFor="profile-name" className="text-[11px] text-muted">Nome do perfil</label>
                        <input
                          id="profile-name"
                          type="text"
                          value={editableProfile.name}
                          onChange={(e) => editProfileDraft((profile) => ({ ...profile, name: e.target.value }))}
                          className="w-full px-2 py-1 bg-bg border border-card-border rounded text-white text-xs h-7"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <SliderInput label="LONG threshold" value={profileScore.longThreshold} min={50} max={95} onChange={(v) => updateProfileScore({ ...profileScore, longThreshold: v })} suffix="%" />
                        <SliderInput label="SHORT threshold" value={profileScore.shortThreshold} min={5} max={50} onChange={(v) => updateProfileScore({ ...profileScore, shortThreshold: v })} suffix="%" />
                        <SliderInput label="High confidence LONG" value={profileScore.highConfLong} min={70} max={100} onChange={(v) => updateProfileScore({ ...profileScore, highConfLong: v })} suffix="%" />
                        <SliderInput label="High confidence SHORT" value={profileScore.highConfShort} min={0} max={30} onChange={(v) => updateProfileScore({ ...profileScore, highConfShort: v })} suffix="%" />
                      </div>

                      <div className="flex justify-end pt-2 border-t border-card-border">
                        <button
                          onClick={() => deleteProfile(editableProfile.id)}
                          className="px-3 py-1.5 bg-bear/10 border border-bear/30 rounded text-bear text-xs font-bold hover:bg-bear/20 transition-colors"
                        >
                          Excluir perfil
                        </button>
                      </div>
                    </Section>

                    <Section title="Pesos do Perfil">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] text-muted font-bold uppercase tracking-wider">Total</span>
                        <span className={`text-xs font-mono-num font-bold ${profileWeightSum === 100 ? 'text-bull' : 'text-bear'}`}>{profileWeightSum}/100</span>
                      </div>
                      {profileWeightSum !== 100 && (
                        <div className="bg-warn/10 border border-warn/30 rounded px-2 py-1 text-warn text-[10px] leading-tight mb-1.5">
                          A soma dos pesos deve ser 100. Atual: {profileWeightSum}
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <SliderInput label="Structure" value={profileWeights.structure} min={0} max={100} onChange={(v) => updateProfileWeights({ ...profileWeights, structure: v })} suffix="%" />
                        <SliderInput label="MACD" value={profileWeights.macd} min={0} max={100} onChange={(v) => updateProfileWeights({ ...profileWeights, macd: v })} suffix="%" />
                        <SliderInput label="StochRSI" value={profileWeights.stochRsi} min={0} max={100} onChange={(v) => updateProfileWeights({ ...profileWeights, stochRsi: v })} suffix="%" />
                        <SliderInput label="Volume" value={profileWeights.volume} min={0} max={100} onChange={(v) => updateProfileWeights({ ...profileWeights, volume: v })} suffix="%" />
                        <SliderInput label="Funding" value={profileWeights.funding} min={0} max={100} onChange={(v) => updateProfileWeights({ ...profileWeights, funding: v })} suffix="%" />
                        <SliderInput label="EMA" value={profileWeights.ema} min={0} max={100} onChange={(v) => updateProfileWeights({ ...profileWeights, ema: v })} suffix="%" />
                      </div>
                    </Section>
                  </>
                )
              })()}

              <div className="pt-3 mt-2 border-t-2 border-card-border">
                <Section title="Aplicar Perfis aos Pares">
                  <div className="text-[10px] text-muted -mt-1 mb-2">
                    Esta area apenas escolhe qual perfil sera usado em cada par. Ela nao altera os parametros do perfil.
                  </div>
                  {assignablePairs.length > 0 ? (
                    <div className="space-y-2">
                      <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_150px_150px] gap-2 px-2 text-[10px] text-muted font-bold uppercase tracking-wider">
                        <span>Par</span>
                        <span>Monitoramento</span>
                        <span>Paper trade</span>
                      </div>
                      {assignablePairs.map((symbol) => (
                        <div key={symbol} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_150px_150px] gap-2 sm:items-center bg-bg border border-card-border rounded px-2 py-2">
                          <div className="text-xs font-mono-num font-bold text-white truncate">{symbol}</div>
                          <label className="space-y-1 sm:space-y-0">
                            <span className="sm:hidden block text-[10px] text-muted">Monitoramento</span>
                            <select
                              value={local.pairProfileAssignments?.[symbol] ?? ''}
                              onChange={(e) => assignProfile(symbol, e.target.value, 'live')}
                              className="w-full px-2 py-1 bg-card border border-card-border rounded text-white text-xs h-7"
                            >
                              <option value="">Global</option>
                              {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
                            </select>
                          </label>
                          <label className="space-y-1 sm:space-y-0">
                            <span className="sm:hidden block text-[10px] text-muted">Paper trade</span>
                            <select
                              value={local.paperProfileAssignments?.[symbol] ?? ''}
                              onChange={(e) => assignProfile(symbol, e.target.value, 'paper')}
                              className="w-full px-2 py-1 bg-card border border-card-border rounded text-white text-xs h-7"
                            >
                              <option value="">Global</option>
                              {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
                            </select>
                          </label>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-bg border border-card-border rounded px-3 py-2 text-[11px] text-muted">
                      Escolha pares no onboarding ou na lista de favoritos para aplicar perfis individualmente.
                    </div>
                  )}
                </Section>
              </div>
            </>
          )}

          {activeTab === 'integracoes' && (
            <>
              {/* Telegram */}
              <Section title="Telegram">
                <div className="space-y-1">
                  <label htmlFor="page-telegram-token" className="text-[11px] text-muted">Bot Token</label>
                  <input id="page-telegram-token" type="password" value={local.telegramBotToken || ''} onChange={(e) => updateField('telegramBotToken', e.target.value)} placeholder="123456:ABC..." className="w-full px-2 py-1 bg-bg border border-card-border rounded text-white font-mono-num text-xs h-7" />
                </div>
                <div className="space-y-1">
                  <label htmlFor="page-telegram-chat" className="text-[11px] text-muted">Chat ID</label>
                  <input id="page-telegram-chat" type="text" value={local.telegramChatId || ''} onChange={(e) => updateField('telegramChatId', e.target.value)} placeholder="-100..." className="w-full px-2 py-1 bg-bg border border-card-border rounded text-white font-mono-num text-xs h-7" />
                </div>
                <button onClick={handleTestTelegram} disabled={telegramTesting || !local.telegramBotToken || !local.telegramChatId} className="w-full px-2 py-1.5 bg-accent/20 border border-accent/30 rounded text-accent text-xs font-bold hover:bg-accent/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  {telegramTesting ? 'Testando...' : 'Testar conexao'}
                </button>
              </Section>

              {/* Binance API */}
              <Section title="Binance API">
                <div className="space-y-1">
                  <label htmlFor="page-binance-key" className="text-[11px] text-muted">API Key</label>
                  <input id="page-binance-key" type="password" value={local.binanceApiKey || ''} onChange={(e) => updateField('binanceApiKey', e.target.value)} placeholder="Sua API Key..." className="w-full px-2 py-1 bg-bg border border-card-border rounded text-white font-mono-num text-xs h-7" />
                </div>
                <div className="space-y-1">
                  <label htmlFor="page-binance-secret" className="text-[11px] text-muted">API Secret</label>
                  <input id="page-binance-secret" type="password" value={local.binanceApiSecret || ''} onChange={(e) => updateField('binanceApiSecret', e.target.value)} placeholder="Sua API Secret..." className="w-full px-2 py-1 bg-bg border border-card-border rounded text-white font-mono-num text-xs h-7" />
                </div>
                <div className="bg-warn/10 border border-warn/30 rounded px-2 py-1.5 text-warn text-[10px] leading-tight">
                  USE TESTNET PARA TESTES. Dinheiro real em risco.
                </div>
              </Section>

              {/* Exchange execution */}
              <Section title="Execucao por API (opcional)">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted">Permitir execucao por API</span>
                  <Toggle
                    enabled={!!local.autoTrade?.enabled}
                    onToggle={() => {
                      const current = local.autoTrade ?? { enabled: false, mode: 'semi' as const, maxOpenTrades: 3, maxDailyTrades: 10, allowedPairs: [] }
                      const updated: AutoTradeConfig = { ...current, enabled: !current.enabled }
                      updateField('autoTrade', updated)
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="page-autotrade-mode" className="text-[11px] text-muted">Modo</label>
                  <select
                    id="page-autotrade-mode"
                    value={local.autoTrade?.mode ?? 'semi'}
                    onChange={(e) => {
                      const current = local.autoTrade ?? { enabled: false, mode: 'semi' as const, maxOpenTrades: 3, maxDailyTrades: 10, allowedPairs: [] }
                      const updated: AutoTradeConfig = { ...current, mode: e.target.value as 'semi' | 'auto' }
                      updateField('autoTrade', updated)
                    }}
                    className="w-full px-2 py-1 bg-bg border border-card-border rounded text-white text-xs h-7"
                  >
                    <option value="semi">Semi-automatico (confirmacao manual)</option>
                    <option value="auto">Automatico avancado</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label htmlFor="page-max-open" className="text-[11px] text-muted">Max Trades Abertos</label>
                    <input id="page-max-open" type="number" min={1} max={20} value={local.autoTrade?.maxOpenTrades ?? 3} onChange={(e) => {
                      const current = local.autoTrade ?? { enabled: false, mode: 'semi' as const, maxOpenTrades: 3, maxDailyTrades: 10, allowedPairs: [] }
                      updateField('autoTrade', { ...current, maxOpenTrades: Number(e.target.value) })
                    }} className="w-full px-2 py-1 bg-bg border border-card-border rounded text-white font-mono-num text-xs h-7" />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="page-max-daily" className="text-[11px] text-muted">Max Trades/Dia</label>
                    <input id="page-max-daily" type="number" min={1} max={100} value={local.autoTrade?.maxDailyTrades ?? 10} onChange={(e) => {
                      const current = local.autoTrade ?? { enabled: false, mode: 'semi' as const, maxOpenTrades: 3, maxDailyTrades: 10, allowedPairs: [] }
                      updateField('autoTrade', { ...current, maxDailyTrades: Number(e.target.value) })
                    }} className="w-full px-2 py-1 bg-bg border border-card-border rounded text-white font-mono-num text-xs h-7" />
                  </div>
                </div>
              </Section>
            </>
          )}

          {activeTab === 'conta' && (
            <>
              <Section title="Perfil">
                <div className="space-y-1">
                  <label htmlFor="page-name" className="text-[11px] text-muted">Nome</label>
                  <input id="page-name" type="text" value={authUser?.name || ''} readOnly className="w-full px-2 py-1 bg-bg border border-card-border rounded text-muted font-mono-num text-xs h-7 cursor-not-allowed" />
                </div>
                <div className="space-y-1">
                  <label htmlFor="page-email" className="text-[11px] text-muted">Email</label>
                  <input id="page-email" type="text" value={authUser?.email || ''} readOnly className="w-full px-2 py-1 bg-bg border border-card-border rounded text-muted font-mono-num text-xs h-7 cursor-not-allowed" />
                </div>
              </Section>

              <Section title="Plano Atual">
                <div className="flex items-center justify-between px-3 py-2 bg-bg rounded border border-card-border">
                  <div>
                    <div className="text-xs font-bold text-white capitalize">{authUser?.plan || (authUser?.role === 'admin' ? 'Admin' : 'Free')}</div>
                    <div className="text-[10px] text-muted mt-0.5">Plano atual</div>
                  </div>
                  <button
                    onClick={async () => {
                      const token = useStore.getState().authToken
                      if (!token) return
                      try {
                        const res = await fetch('/api/stripe/checkout', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ plan: 'pro' })
                        })
                        const data = await res.json()
                        if (data.url) window.location.href = data.url
                      } catch {}
                    }}
                    className="px-2 py-1 bg-accent/20 border border-accent/30 rounded text-accent text-xs font-bold hover:bg-accent/30 transition-colors"
                  >
                    Upgrade
                  </button>
                </div>
              </Section>

              <Section title="Dados">
                <button
                  onClick={() => useStore.getState().exportData()}
                  className="w-full px-2 py-1.5 bg-card-border/50 border border-card-border rounded text-muted text-xs font-bold hover:bg-card-border transition-colors"
                >
                  Exportar dados (JSON)
                </button>
              </Section>

              <Section title="Zona de Perigo">
                <button
                  onClick={async () => {
                    if (!confirm('Tem certeza? Esta acao e irreversivel. Todos os seus dados serao permanentemente deletados.')) return
                    if (!confirm('Ultima confirmacao: deseja realmente deletar sua conta e todos os dados?')) return
                    const ok = await useStore.getState().deleteAccount()
                    if (!ok) alert('Erro ao deletar conta. Tente novamente.')
                  }}
                  className="w-full px-2 py-1.5 bg-bear/10 border border-bear/30 rounded text-bear text-xs font-bold hover:bg-bear/20 transition-colors"
                >
                  Deletar conta
                </button>
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 pb-3 border-b border-card-border last:border-0">
      <h3 className="text-[11px] font-bold text-muted uppercase tracking-wider">{title}</h3>
      {children}
    </div>
  )
}
