import { useState } from 'react'
import { useStore } from '../store/useStore'
import { emitCreateCustomAlert, emitDeleteCustomAlert } from '../hooks/useSocket'
import type { CustomAlert } from '@bottrade/shared'

const conditionLabels: Record<CustomAlert['condition'], string> = {
  price_above: 'Preco acima de',
  price_below: 'Preco abaixo de',
  score_above: 'Score acima de',
  score_below: 'Score abaixo de',
  funding_above: 'Funding acima de',
  funding_below: 'Funding abaixo de',
}

const conditionUnits: Record<CustomAlert['condition'], string> = {
  price_above: '$',
  price_below: '$',
  score_above: '',
  score_below: '',
  funding_above: '%',
  funding_below: '%',
}

export default function CustomAlertsPanel() {
  const toggleCustomAlerts = useStore((s) => s.toggleCustomAlerts)
  const settings = useStore((s) => s.settings)
  const favorites = useStore((s) => s.favorites)

  const customAlerts = settings.customAlerts ?? []
  const activeAlerts = customAlerts.filter((a) => !a.triggered)
  const triggeredAlerts = customAlerts.filter((a) => a.triggered)

  const [symbol, setSymbol] = useState(favorites[0] ?? 'BTCUSDT')
  const [condition, setCondition] = useState<CustomAlert['condition']>('price_above')
  const [value, setValue] = useState('')
  const [message, setMessage] = useState('')
  const [creating, setCreating] = useState(false)

  const handleCreate = () => {
    const numValue = parseFloat(value)
    if (isNaN(numValue) || numValue <= 0) return
    setCreating(true)
    emitCreateCustomAlert(
      {
        symbol,
        condition,
        value: numValue,
        message: message || `${symbol} ${conditionLabels[condition]} ${numValue}${conditionUnits[condition]}`,
      },
      (result) => {
        setCreating(false)
        if (result) {
          setValue('')
          setMessage('')
        }
      }
    )
  }

  const handleDelete = (id: string) => {
    emitDeleteCustomAlert(id)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={toggleCustomAlerts}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 z-50 h-full w-full md:w-96 max-w-full bg-card border-l border-card-border overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-card-border">
          <h2 className="text-lg font-bold">Alertas Personalizados</h2>
          <button
            onClick={toggleCustomAlerts}
            className="p-1 rounded hover:bg-card-border transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Create form */}
        <div className="p-4 border-b border-card-border space-y-3">
          <h3 className="text-sm font-bold text-muted uppercase tracking-wide">Novo Alerta</h3>

          {/* Symbol */}
          <div>
            <label className="block text-xs text-muted mb-1">Par</label>
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="w-full bg-bg border border-card-border rounded px-2 py-1.5 text-sm font-mono-num"
            >
              {favorites.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Condition */}
          <div>
            <label className="block text-xs text-muted mb-1">Condicao</label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value as CustomAlert['condition'])}
              className="w-full bg-bg border border-card-border rounded px-2 py-1.5 text-sm"
            >
              {(Object.keys(conditionLabels) as CustomAlert['condition'][]).map((c) => (
                <option key={c} value={c}>{conditionLabels[c]}</option>
              ))}
            </select>
          </div>

          {/* Value */}
          <div>
            <label className="block text-xs text-muted mb-1">
              Valor {conditionUnits[condition] && `(${conditionUnits[condition]})`}
            </label>
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={condition.startsWith('score') ? 'ex: 80' : condition.startsWith('funding') ? 'ex: 0.05' : 'ex: 2000'}
              className="w-full bg-bg border border-card-border rounded px-2 py-1.5 text-sm font-mono-num"
              step="any"
            />
          </div>

          {/* Message (optional) */}
          <div>
            <label className="block text-xs text-muted mb-1">Mensagem (opcional)</label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Me avise quando..."
              className="w-full bg-bg border border-card-border rounded px-2 py-1.5 text-sm"
            />
          </div>

          <button
            onClick={handleCreate}
            disabled={creating || !value || isNaN(parseFloat(value))}
            className="w-full py-2 rounded bg-bull/20 text-bull font-bold text-sm hover:bg-bull/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {creating ? 'Criando...' : 'Criar Alerta'}
          </button>
        </div>

        {/* Active alerts */}
        <div className="p-4 border-b border-card-border">
          <h3 className="text-sm font-bold text-muted uppercase tracking-wide mb-2">
            Ativos ({activeAlerts.length})
          </h3>
          {activeAlerts.length === 0 ? (
            <p className="text-xs text-muted">Nenhum alerta ativo</p>
          ) : (
            <div className="space-y-2">
              {activeAlerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>

        {/* Triggered alerts */}
        <div className="p-4">
          <h3 className="text-sm font-bold text-muted uppercase tracking-wide mb-2">
            Disparados ({triggeredAlerts.length})
          </h3>
          {triggeredAlerts.length === 0 ? (
            <p className="text-xs text-muted">Nenhum alerta disparado</p>
          ) : (
            <div className="space-y-2">
              {triggeredAlerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} onDelete={handleDelete} triggered />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function AlertCard({ alert, onDelete, triggered }: { alert: CustomAlert; onDelete: (id: string) => void; triggered?: boolean }) {
  return (
    <div className={`flex items-start justify-between p-2 rounded border ${triggered ? 'border-card-border opacity-50' : 'border-bull/30 bg-bull/5'}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono-num text-xs font-bold">{alert.symbol}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${triggered ? 'bg-card-border text-muted' : 'bg-bull/20 text-bull'}`}>
            {triggered ? 'DISPARADO' : 'ATIVO'}
          </span>
        </div>
        <div className="text-xs text-muted mt-0.5">
          {conditionLabels[alert.condition]} <span className="font-mono-num">{alert.value}{conditionUnits[alert.condition]}</span>
        </div>
        {alert.message && (
          <div className="text-xs mt-0.5 truncate">{alert.message}</div>
        )}
      </div>
      <button
        onClick={() => onDelete(alert.id)}
        className="p-1 rounded hover:bg-card-border transition-colors text-muted hover:text-bear flex-shrink-0"
        title="Excluir alerta"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
