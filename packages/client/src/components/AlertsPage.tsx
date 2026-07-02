import { useState } from 'react'
import { useStore } from '../store/useStore'
import { emitCreateCustomAlert, emitDeleteCustomAlert } from '../hooks/useSocket'
import type { CustomAlert } from '@bottrade/shared'

const conditionLabels: Record<CustomAlert['condition'], string> = {
  price_above: 'Preco acima de', price_below: 'Preco abaixo de',
  score_above: 'Score acima de', score_below: 'Score abaixo de',
  funding_above: 'Funding acima de', funding_below: 'Funding abaixo de',
}

const conditionUnits: Record<CustomAlert['condition'], string> = {
  price_above: '$', price_below: '$', score_above: '', score_below: '', funding_above: '%', funding_below: '%',
}

export default function AlertsPage() {
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
      { symbol, condition, value: numValue, message: message || `${symbol} ${conditionLabels[condition]} ${numValue}${conditionUnits[condition]}` },
      (result) => { setCreating(false); if (result) { setValue(''); setMessage('') } }
    )
  }

  const handleDelete = (id: string) => { emitDeleteCustomAlert(id) }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-3 py-2 md:px-4 md:py-3 space-y-3">
        {/* Create form */}
        <div className="bg-card border border-card-border rounded px-3 py-2 space-y-2">
          <h3 className="text-[11px] font-bold text-muted uppercase tracking-wider">Novo Alerta</h3>
          <div>
            <label className="block text-[11px] text-muted mb-0.5">Par</label>
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="w-full bg-bg border border-card-border rounded px-2 py-1 text-xs font-mono-num h-7">
              {favorites.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-muted mb-0.5">Condicao</label>
            <select value={condition} onChange={(e) => setCondition(e.target.value as CustomAlert['condition'])} className="w-full bg-bg border border-card-border rounded px-2 py-1 text-xs h-7">
              {(Object.keys(conditionLabels) as CustomAlert['condition'][]).map((c) => <option key={c} value={c}>{conditionLabels[c]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-muted mb-0.5">Valor {conditionUnits[condition] && `(${conditionUnits[condition]})`}</label>
            <input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder={condition.startsWith('score') ? 'ex: 80' : condition.startsWith('funding') ? 'ex: 0.05' : 'ex: 2000'} className="w-full bg-bg border border-card-border rounded px-2 py-1 text-xs font-mono-num h-7" step="any" />
          </div>
          <div>
            <label className="block text-[11px] text-muted mb-0.5">Mensagem (opcional)</label>
            <input type="text" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Me avise quando..." className="w-full bg-bg border border-card-border rounded px-2 py-1 text-xs h-7" />
          </div>
          <button onClick={handleCreate} disabled={creating || !value || isNaN(parseFloat(value))} className="w-full py-1.5 rounded bg-bull/20 text-bull font-bold text-xs hover:bg-bull/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {creating ? 'Criando...' : 'Criar Alerta'}
          </button>
        </div>

        {/* Active */}
        <div>
          <h3 className="text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">Ativos (<span className="font-mono-num">{activeAlerts.length}</span>)</h3>
          {activeAlerts.length === 0 ? <p className="text-xs text-muted">Nenhum alerta ativo</p> : (
            <div className="space-y-1.5">{activeAlerts.map((alert) => <AlertCard key={alert.id} alert={alert} onDelete={handleDelete} />)}</div>
          )}
        </div>

        {/* Triggered */}
        <div>
          <h3 className="text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">Disparados (<span className="font-mono-num">{triggeredAlerts.length}</span>)</h3>
          {triggeredAlerts.length === 0 ? <p className="text-xs text-muted">Nenhum alerta disparado</p> : (
            <div className="space-y-1.5">{triggeredAlerts.map((alert) => <AlertCard key={alert.id} alert={alert} onDelete={handleDelete} triggered />)}</div>
          )}
        </div>
      </div>
    </div>
  )
}

function AlertCard({ alert, onDelete, triggered }: { alert: CustomAlert; onDelete: (id: string) => void; triggered?: boolean }) {
  return (
    <div className={`flex items-start justify-between px-3 py-2 rounded border ${triggered ? 'border-card-border opacity-50' : 'border-bull/30 bg-bull/5'}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-mono-num text-xs font-bold">{alert.symbol}</span>
          <span className={`text-[9px] px-1 py-0 rounded ${triggered ? 'bg-card-border text-muted' : 'bg-bull/20 text-bull'}`}>{triggered ? 'DISPARADO' : 'ATIVO'}</span>
        </div>
        <div className="text-[11px] text-muted mt-0.5">{conditionLabels[alert.condition]} <span className="font-mono-num">{alert.value}{conditionUnits[alert.condition]}</span></div>
        {alert.message && <div className="text-[11px] mt-0.5 truncate">{alert.message}</div>}
      </div>
      <button onClick={() => onDelete(alert.id)} className="p-1.5 -m-0.5 rounded hover:bg-card-border transition-colors text-muted hover:text-bear cursor-pointer flex-shrink-0" title="Excluir alerta">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  )
}
