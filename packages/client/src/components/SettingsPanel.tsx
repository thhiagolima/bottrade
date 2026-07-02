import { useState, useEffect, useRef, useCallback } from 'react'
import { useStore } from '../store/useStore'
import { emitUpdateSettings, emitTestTelegram } from '../hooks/useSocket'
import type { UserSettings, AutoTradeConfig, IndicatorToggles } from '@bottrade/shared'
import toast from 'react-hot-toast'

const defaultToggles: IndicatorToggles = {
  ma: true, ema: true, macd: true, stochRsi: true, volume: true,
  rsi: true, bollingerBands: true, atr: true, adx: true, vwap: true,
  williamsR: true, cci: true, mfi: true, obv: true, parabolicSar: true,
  openInterest: true, longShortRatio: true, fearGreed: true,
}

// ── Advanced defaults ───────────────────────────────────────
interface ScoreConfig {
  longThreshold: number
  shortThreshold: number
  highConfLong: number
  highConfShort: number
}

interface ScoreWeights {
  structure: number
  macd: number
  stochRsi: number
  volume: number
  funding: number
  ema: number
}

interface IndicatorPeriods {
  rsiPeriod: number
  stochRsiPeriod: number
  macdFast: number
  macdSlow: number
  macdSignal: number
  bollingerPeriod: number
  bollingerStdDev: number
  atrPeriod: number
  adxPeriod: number
}

const defaultScoreConfig: ScoreConfig = {
  longThreshold: 65,
  shortThreshold: 35,
  highConfLong: 85,
  highConfShort: 15,
}

const defaultWeights: ScoreWeights = {
  structure: 25,
  macd: 20,
  stochRsi: 20,
  volume: 15,
  funding: 15,
  ema: 5,
}

const defaultPeriods: IndicatorPeriods = {
  rsiPeriod: 14,
  stochRsiPeriod: 14,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  bollingerPeriod: 20,
  bollingerStdDev: 2,
  atrPeriod: 14,
  adxPeriod: 14,
}

// ── Collapsible section ─────────────────────────────────────
function Collapsible({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="pt-3 border-t border-card-border">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-1"
      >
        <h3 className="text-xs font-bold text-muted uppercase tracking-wider">{title}</h3>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`w-4 h-4 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="mt-3 space-y-3">{children}</div>}
    </div>
  )
}

function ThemeToggle() {
  const theme = useStore((state) => state.theme)
  const toggleTheme = useStore((state) => state.toggleTheme)
  const isLight = theme === 'light'
  return (
    <button
      onClick={toggleTheme}
      className={`w-10 h-5 rounded-full transition-colors ${isLight ? 'bg-bull' : 'bg-card-border'}`}
    >
      <span
        className={`block w-4 h-4 rounded-full bg-white transition-transform ${isLight ? 'translate-x-5' : 'translate-x-0.5'}`}
      />
    </button>
  )
}

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`w-10 h-5 rounded-full transition-colors ${enabled ? 'bg-bull' : 'bg-card-border'}`}
    >
      <span
        className={`block w-4 h-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`}
      />
    </button>
  )
}

function SliderInput({ label, value, min, max, step = 1, onChange, suffix }: {
  label: string; value: number; min: number; max: number; step?: number
  onChange: (v: number) => void; suffix?: string
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-muted text-xs font-bold">{label}</label>
        <span className="text-xs font-mono-num text-[var(--color-text)]">{value}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-card-border rounded-full appearance-none cursor-pointer accent-accent"
      />
    </div>
  )
}

function NumberInput({ label, value, min, max, step = 1, onChange }: {
  label: string; value: number; min: number; max: number; step?: number
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1">
      <label className="text-muted text-xs font-bold">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full px-3 py-2 bg-bg border border-card-border rounded text-white font-mono-num text-xs"
      />
    </div>
  )
}

export default function SettingsPanel() {
  const settings = useStore((state) => state.settings)
  const toggleSettings = useStore((state) => state.toggleSettings)

  const [local, setLocal] = useState<UserSettings>({ ...settings })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Advanced state (stored locally, emitted via generic settings)
  const [scoreConfig, setScoreConfig] = useState<ScoreConfig>({ ...defaultScoreConfig })
  const [weights, setWeights] = useState<ScoreWeights>({ ...defaultWeights })
  const [periods, setPeriods] = useState<IndicatorPeriods>({ ...defaultPeriods })
  const [telegramTesting, setTelegramTesting] = useState(false)

  // Escape key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') toggleSettings()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [toggleSettings])

  // Sync from store when settings change externally
  useEffect(() => {
    setLocal({ ...settings })
  }, [settings])

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

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
    if (enabled && 'Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission()
    }
    updateField('desktopNotifications', enabled)
  }

  const handleTestTelegram = () => {
    setTelegramTesting(true)
    emitTestTelegram((result) => {
      setTelegramTesting(false)
      if (result.success) {
        toast.success('Telegram conectado com sucesso!')
      } else {
        toast.error(result.error || 'Erro ao conectar com Telegram')
      }
    })
    // Timeout fallback
    setTimeout(() => setTelegramTesting(false), 10000)
  }

  const handleRestoreDefaults = () => {
    setScoreConfig({ ...defaultScoreConfig })
    setWeights({ ...defaultWeights })
    setPeriods({ ...defaultPeriods })
    toast.success('Valores padrao restaurados')
  }

  const weightSum = weights.structure + weights.macd + weights.stochRsi + weights.volume + weights.funding + weights.ema

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={toggleSettings}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 z-50 h-full w-full md:w-80 max-w-full bg-card border-l border-card-border overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-card-border">
          <h2 className="text-lg font-bold">Configuracoes</h2>
          <button
            onClick={toggleSettings}
            className="p-1 rounded hover:bg-card-border transition-colors"
            aria-label="Fechar configurações"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-5 text-sm">
          {/* Capital Base */}
          <div className="space-y-1">
            <label htmlFor="setting-capital" className="text-muted text-xs font-bold">Capital Base (R$)</label>
            <input
              id="setting-capital"
              type="number"
              value={local.baseCapital}
              onChange={(e) => updateField('baseCapital', Number(e.target.value))}
              className="w-full px-3 py-2 bg-bg border border-card-border rounded text-white font-mono-num"
            />
          </div>

          {/* Leverage */}
          <div className="space-y-1">
            <label htmlFor="setting-leverage" className="text-muted text-xs font-bold">Alavancagem</label>
            <select
              id="setting-leverage"
              value={local.leverage}
              onChange={(e) => updateField('leverage', Number(e.target.value))}
              className="w-full px-3 py-2 bg-bg border border-card-border rounded text-white"
            >
              {[2, 3, 5, 10, 20].map((v) => (
                <option key={v} value={v}>{v}x</option>
              ))}
            </select>
          </div>

          {/* Funding Threshold */}
          <div className="space-y-1">
            <label htmlFor="setting-funding" className="text-muted text-xs font-bold">Funding Threshold</label>
            <input
              id="setting-funding"
              type="number"
              step="0.01"
              value={local.fundingThreshold}
              onChange={(e) => updateField('fundingThreshold', Number(e.target.value))}
              className="w-full px-3 py-2 bg-bg border border-card-border rounded text-white font-mono-num"
            />
          </div>

          {/* StochRSI Thresholds */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="setting-stochrsi-high" className="text-muted text-xs font-bold">StochRSI Alto</label>
              <input
                id="setting-stochrsi-high"
                type="number"
                value={local.stochRsiHighThreshold}
                onChange={(e) => updateField('stochRsiHighThreshold', Number(e.target.value))}
                className="w-full px-3 py-2 bg-bg border border-card-border rounded text-white font-mono-num"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="setting-stochrsi-low" className="text-muted text-xs font-bold">StochRSI Baixo</label>
              <input
                id="setting-stochrsi-low"
                type="number"
                value={local.stochRsiLowThreshold}
                onChange={(e) => updateField('stochRsiLowThreshold', Number(e.target.value))}
                className="w-full px-3 py-2 bg-bg border border-card-border rounded text-white font-mono-num"
              />
            </div>
          </div>

          {/* Sound Alerts Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted">Sons de alerta</span>
            <Toggle enabled={local.soundAlerts} onToggle={() => updateField('soundAlerts', !local.soundAlerts)} />
          </div>

          {/* Desktop Notifications Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted">Notificacoes desktop</span>
            <Toggle enabled={local.desktopNotifications} onToggle={() => handleDesktopNotifToggle(!local.desktopNotifications)} />
          </div>

          {/* Theme Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted">Tema claro</span>
            <ThemeToggle />
          </div>

          {/* Indicator Toggles */}
          <div className="pt-3 border-t border-card-border space-y-3">
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider">Indicadores</h3>

            <p className="text-[10px] text-muted font-bold uppercase tracking-wider">Tecnicos</p>
            {([
              ['ma', 'MAs (MA20/50/100/200)'],
              ['ema', 'EMAs (EMA20/50)'],
              ['macd', 'MACD'],
              ['stochRsi', 'StochRSI'],
              ['rsi', 'RSI'],
              ['bollingerBands', 'Bollinger Bands'],
              ['atr', 'ATR'],
              ['adx', 'ADX'],
              ['vwap', 'VWAP'],
              ['williamsR', 'Williams %R'],
              ['cci', 'CCI'],
              ['mfi', 'MFI'],
              ['obv', 'OBV'],
              ['parabolicSar', 'Parabolic SAR'],
              ['volume', 'Volume'],
            ] as [keyof IndicatorToggles, string][]).map(([key, label]) => {
              const currentToggles = local.indicatorToggles ?? defaultToggles
              const enabled = currentToggles[key]
              return (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-xs text-muted">{label}</span>
                  <Toggle
                    enabled={!!enabled}
                    onToggle={() => {
                      const updated: IndicatorToggles = { ...currentToggles, [key]: !enabled }
                      updateField('indicatorToggles', updated)
                    }}
                  />
                </div>
              )
            })}

            <p className="text-[10px] text-muted font-bold uppercase tracking-wider pt-2">Externos</p>
            {([
              ['openInterest', 'Open Interest'],
              ['longShortRatio', 'Long/Short Ratio'],
              ['fearGreed', 'Fear & Greed'],
            ] as [keyof IndicatorToggles, string][]).map(([key, label]) => {
              const currentToggles = local.indicatorToggles ?? defaultToggles
              const enabled = currentToggles[key]
              return (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-xs text-muted">{label}</span>
                  <Toggle
                    enabled={!!enabled}
                    onToggle={() => {
                      const updated: IndicatorToggles = { ...currentToggles, [key]: !enabled }
                      updateField('indicatorToggles', updated)
                    }}
                  />
                </div>
              )
            })}
          </div>

          {/* Telegram */}
          <div className="pt-3 border-t border-card-border space-y-3">
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider">Telegram</h3>
            <div className="space-y-1">
              <label htmlFor="setting-telegram-token" className="text-muted text-xs font-bold">Bot Token</label>
              <input
                id="setting-telegram-token"
                type="password"
                value={local.telegramBotToken || ''}
                onChange={(e) => updateField('telegramBotToken', e.target.value)}
                placeholder="123456:ABC..."
                className="w-full px-3 py-2 bg-bg border border-card-border rounded text-white font-mono-num text-xs"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="setting-telegram-chat" className="text-muted text-xs font-bold">Chat ID</label>
              <input
                id="setting-telegram-chat"
                type="text"
                value={local.telegramChatId || ''}
                onChange={(e) => updateField('telegramChatId', e.target.value)}
                placeholder="-100..."
                className="w-full px-3 py-2 bg-bg border border-card-border rounded text-white font-mono-num text-xs"
              />
            </div>
            <button
              onClick={handleTestTelegram}
              disabled={telegramTesting || !local.telegramBotToken || !local.telegramChatId}
              className="w-full px-3 py-2 bg-accent/20 border border-accent/30 rounded text-accent text-xs font-bold hover:bg-accent/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {telegramTesting ? 'Testando...' : 'Testar conexao'}
            </button>
          </div>

          {/* Optional API execution section */}
          <div className="pt-3 border-t border-card-border space-y-3">
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider">Execucao por API</h3>

            {/* Enable Toggle */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted">Permitir execucao por API</span>
              <Toggle
                enabled={!!local.autoTrade?.enabled}
                onToggle={() => {
                  const current = local.autoTrade ?? { enabled: false, mode: 'semi' as const, maxOpenTrades: 3, maxDailyTrades: 10, allowedPairs: [] }
                  const updated: AutoTradeConfig = { ...current, enabled: !current.enabled }
                  updateField('autoTrade', updated)
                }}
              />
            </div>

            {/* Mode Select */}
            <div className="space-y-1">
              <label htmlFor="setting-autotrade-mode" className="text-muted text-xs font-bold">Modo</label>
              <select
                id="setting-autotrade-mode"
                value={local.autoTrade?.mode ?? 'semi'}
                onChange={(e) => {
                  const current = local.autoTrade ?? { enabled: false, mode: 'semi' as const, maxOpenTrades: 3, maxDailyTrades: 10, allowedPairs: [] }
                  const updated: AutoTradeConfig = { ...current, mode: e.target.value as 'semi' | 'auto' }
                  updateField('autoTrade', updated)
                }}
                className="w-full px-3 py-2 bg-bg border border-card-border rounded text-white text-xs"
              >
                <option value="semi">Confirmacao manual</option>
                <option value="auto">Modo avancado por API</option>
              </select>
            </div>

            {/* Max Open Trades */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="setting-max-open" className="text-muted text-xs font-bold">Max Trades Abertos</label>
                <input
                  id="setting-max-open"
                  type="number"
                  min={1}
                  max={20}
                  value={local.autoTrade?.maxOpenTrades ?? 3}
                  onChange={(e) => {
                    const current = local.autoTrade ?? { enabled: false, mode: 'semi' as const, maxOpenTrades: 3, maxDailyTrades: 10, allowedPairs: [] }
                    const updated: AutoTradeConfig = { ...current, maxOpenTrades: Number(e.target.value) }
                    updateField('autoTrade', updated)
                  }}
                  className="w-full px-3 py-2 bg-bg border border-card-border rounded text-white font-mono-num text-xs"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="setting-max-daily" className="text-muted text-xs font-bold">Max Trades/Dia</label>
                <input
                  id="setting-max-daily"
                  type="number"
                  min={1}
                  max={100}
                  value={local.autoTrade?.maxDailyTrades ?? 10}
                  onChange={(e) => {
                    const current = local.autoTrade ?? { enabled: false, mode: 'semi' as const, maxOpenTrades: 3, maxDailyTrades: 10, allowedPairs: [] }
                    const updated: AutoTradeConfig = { ...current, maxDailyTrades: Number(e.target.value) }
                    updateField('autoTrade', updated)
                  }}
                  className="w-full px-3 py-2 bg-bg border border-card-border rounded text-white font-mono-num text-xs"
                />
              </div>
            </div>

            {/* Allowed Pairs */}
            <div className="space-y-1">
              <label className="text-muted text-xs font-bold" id="setting-allowed-pairs-label">Pares Permitidos</label>
              <div className="max-h-24 overflow-y-auto bg-bg border border-card-border rounded p-2 space-y-1">
                {(local.favorites ?? local.pairs ?? []).map((pair) => {
                  const allowedPairs = local.autoTrade?.allowedPairs ?? []
                  const isSelected = allowedPairs.includes(pair)
                  return (
                    <label key={pair} className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          const current = local.autoTrade ?? { enabled: false, mode: 'semi' as const, maxOpenTrades: 3, maxDailyTrades: 10, allowedPairs: [] }
                          const newAllowed = isSelected
                            ? current.allowedPairs.filter(p => p !== pair)
                            : [...current.allowedPairs, pair]
                          const updated: AutoTradeConfig = { ...current, allowedPairs: newAllowed }
                          updateField('autoTrade', updated)
                        }}
                        className="accent-bull"
                      />
                      <span className="text-white">{pair}</span>
                    </label>
                  )
                })}
              </div>
              <p className="text-muted text-[10px]">Vazio = todos os favoritos</p>
            </div>

            {/* Binance API Keys */}
            <div className="space-y-1">
              <label htmlFor="setting-binance-key" className="text-muted text-xs font-bold">Binance API Key</label>
              <input
                id="setting-binance-key"
                type="password"
                value={local.binanceApiKey || ''}
                onChange={(e) => updateField('binanceApiKey', e.target.value)}
                placeholder="Sua API Key..."
                className="w-full px-3 py-2 bg-bg border border-card-border rounded text-white font-mono-num text-xs"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="setting-binance-secret" className="text-muted text-xs font-bold">Binance API Secret</label>
              <input
                id="setting-binance-secret"
                type="password"
                value={local.binanceApiSecret || ''}
                onChange={(e) => updateField('binanceApiSecret', e.target.value)}
                placeholder="Sua API Secret..."
                className="w-full px-3 py-2 bg-bg border border-card-border rounded text-white font-mono-num text-xs"
              />
            </div>

            {/* Warning */}
            <div className="bg-warn/10 border border-warn/30 rounded px-3 py-2 text-warn text-[10px] leading-tight">
              USE TESTNET PARA TESTES. Dinheiro real em risco.
            </div>
          </div>

          {/* ═══════ ADVANCED SECTION ═══════ */}
          <Collapsible title="Avancado">

            {/* Score Configuration */}
            <div className="space-y-3">
              <p className="text-[10px] text-muted font-bold uppercase tracking-wider">Configuracao de Score</p>
              <SliderInput label="LONG threshold" value={scoreConfig.longThreshold} min={50} max={95} onChange={(v) => setScoreConfig({ ...scoreConfig, longThreshold: v })} />
              <SliderInput label="SHORT threshold" value={scoreConfig.shortThreshold} min={5} max={50} onChange={(v) => setScoreConfig({ ...scoreConfig, shortThreshold: v })} />
              <SliderInput label="High confidence LONG" value={scoreConfig.highConfLong} min={70} max={100} onChange={(v) => setScoreConfig({ ...scoreConfig, highConfLong: v })} />
              <SliderInput label="High confidence SHORT" value={scoreConfig.highConfShort} min={0} max={30} onChange={(v) => setScoreConfig({ ...scoreConfig, highConfShort: v })} />
            </div>

            {/* Score Weights */}
            <div className="space-y-3 pt-3 border-t border-card-border">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-muted font-bold uppercase tracking-wider">Pesos do Score</p>
                <span className={`text-xs font-mono-num font-bold ${weightSum === 100 ? 'text-bull' : 'text-bear'}`}>
                  {weightSum}/100
                </span>
              </div>
              {weightSum !== 100 && (
                <div className="bg-warn/10 border border-warn/30 rounded px-3 py-1.5 text-warn text-[10px] leading-tight">
                  A soma dos pesos deve ser 100. Atual: {weightSum}
                </div>
              )}
              <SliderInput label="Structure" value={weights.structure} min={0} max={50} onChange={(v) => setWeights({ ...weights, structure: v })} suffix="%" />
              <SliderInput label="MACD" value={weights.macd} min={0} max={50} onChange={(v) => setWeights({ ...weights, macd: v })} suffix="%" />
              <SliderInput label="StochRSI" value={weights.stochRsi} min={0} max={50} onChange={(v) => setWeights({ ...weights, stochRsi: v })} suffix="%" />
              <SliderInput label="Volume" value={weights.volume} min={0} max={50} onChange={(v) => setWeights({ ...weights, volume: v })} suffix="%" />
              <SliderInput label="Funding" value={weights.funding} min={0} max={50} onChange={(v) => setWeights({ ...weights, funding: v })} suffix="%" />
              <SliderInput label="EMA" value={weights.ema} min={0} max={50} onChange={(v) => setWeights({ ...weights, ema: v })} suffix="%" />
            </div>

            {/* Indicator Periods */}
            <Collapsible title="Periodos dos Indicadores">
              <div className="grid grid-cols-2 gap-3">
                <NumberInput label="RSI" value={periods.rsiPeriod} min={2} max={100} onChange={(v) => setPeriods({ ...periods, rsiPeriod: v })} />
                <NumberInput label="StochRSI" value={periods.stochRsiPeriod} min={2} max={100} onChange={(v) => setPeriods({ ...periods, stochRsiPeriod: v })} />
                <NumberInput label="MACD Fast" value={periods.macdFast} min={2} max={100} onChange={(v) => setPeriods({ ...periods, macdFast: v })} />
                <NumberInput label="MACD Slow" value={periods.macdSlow} min={2} max={100} onChange={(v) => setPeriods({ ...periods, macdSlow: v })} />
                <NumberInput label="MACD Signal" value={periods.macdSignal} min={2} max={100} onChange={(v) => setPeriods({ ...periods, macdSignal: v })} />
                <NumberInput label="Bollinger" value={periods.bollingerPeriod} min={2} max={100} onChange={(v) => setPeriods({ ...periods, bollingerPeriod: v })} />
                <NumberInput label="Bollinger StdDev" value={periods.bollingerStdDev} min={1} max={5} step={0.5} onChange={(v) => setPeriods({ ...periods, bollingerStdDev: v })} />
                <NumberInput label="ATR" value={periods.atrPeriod} min={2} max={100} onChange={(v) => setPeriods({ ...periods, atrPeriod: v })} />
                <NumberInput label="ADX" value={periods.adxPeriod} min={2} max={100} onChange={(v) => setPeriods({ ...periods, adxPeriod: v })} />
              </div>
            </Collapsible>

            {/* Restore Defaults */}
            <button
              onClick={handleRestoreDefaults}
              className="w-full px-3 py-2 bg-card-border/50 border border-card-border rounded text-muted text-xs font-bold hover:bg-card-border transition-colors"
            >
              Restaurar padroes
            </button>
          </Collapsible>

        </div>
      </div>
    </>
  )
}
