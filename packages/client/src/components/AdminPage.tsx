import { useState, useEffect, useCallback } from 'react'
import { useStore } from '../store/useStore'

interface PlatformStats {
  users: { total: number; pro: number; trader: number }
  trades: { total: number; wins: number }
  signals: { total: number }
  activeUsers: number
}

interface AdminUser {
  id: number; email: string; name: string; role: string; plan: string
  plan_expires_at: string | null; is_active: boolean | number
  last_login: string | null; created_at: string; trade_count: number; win_count: number
}

interface AuditEntry {
  id: number; user_id: number | null; user_email: string | null
  action: string; details: string | Record<string, unknown>
  ip_address: string | null; created_at: string
}

interface PlanFeatures {
  paresIlimitados: boolean
  todosIndicadores: boolean
  multiTimeframe: boolean
  paperTrading: boolean
  backtest: boolean
  telegram: boolean
  autoTrade: boolean
  execucaoOrdens: boolean
}

interface PlanConfig {
  name: string
  price: string
  features: PlanFeatures
  maxFavorites: number
}

type AdminTab = 'stats' | 'users' | 'plans' | 'audit'

const FEATURE_LABELS: Record<keyof PlanFeatures, string> = {
  paresIlimitados: 'Pares ilimitados',
  todosIndicadores: 'Todos indicadores',
  multiTimeframe: 'Multi-timeframe',
  paperTrading: 'Paper trading',
  backtest: 'Backtest',
  telegram: 'Telegram',
  autoTrade: 'Auto-trade',
  execucaoOrdens: 'Execucao de ordens',
}

const DEFAULT_PLANS: PlanConfig[] = [
  {
    name: 'Free',
    price: 'R$0',
    features: { paresIlimitados: false, todosIndicadores: false, multiTimeframe: false, paperTrading: false, backtest: false, telegram: false, autoTrade: false, execucaoOrdens: false },
    maxFavorites: 3,
  },
  {
    name: 'Pro',
    price: 'R$49/mes',
    features: { paresIlimitados: true, todosIndicadores: true, multiTimeframe: true, paperTrading: true, backtest: true, telegram: true, autoTrade: false, execucaoOrdens: false },
    maxFavorites: 999,
  },
  {
    name: 'Trader',
    price: 'R$99/mes',
    features: { paresIlimitados: true, todosIndicadores: true, multiTimeframe: true, paperTrading: true, backtest: true, telegram: true, autoTrade: true, execucaoOrdens: true },
    maxFavorites: 999,
  },
]

function apiFetch(path: string, options?: RequestInit) {
  const token = useStore.getState().authToken
  return fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options?.headers || {}) },
  })
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-4 flex flex-col gap-1">
      <span className="text-xs text-muted uppercase tracking-wider">{label}</span>
      <span className="text-2xl font-mono-num font-bold text-white">{value}</span>
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </div>
  )
}

const TAB_ITEMS: { key: AdminTab; label: string }[] = [
  { key: 'stats', label: 'Metricas' },
  { key: 'users', label: 'Usuarios' },
  { key: 'plans', label: 'Planos' },
  { key: 'audit', label: 'Audit Log' },
]

export default function AdminPage() {
  const [adminTab, setAdminTab] = useState<AdminTab>('stats')
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [auditOffset, setAuditOffset] = useState(0)
  const [auditHasMore, setAuditHasMore] = useState(true)
  const [updatingUser, setUpdatingUser] = useState<number | null>(null)
  const [plans, setPlans] = useState<PlanConfig[]>(DEFAULT_PLANS)
  const [savingPlan, setSavingPlan] = useState<string | null>(null)
  const [planSaved, setPlanSaved] = useState<string | null>(null)
  const [usersError, setUsersError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    try { const res = await apiFetch('/api/admin/stats'); if (res.ok) setStats(await res.json()) } catch (err) { console.error('[Admin] stats:', err) }
  }, [])

  const fetchUsers = useCallback(async () => {
    try {
      setUsersError(null)
      const res = await apiFetch('/api/admin/users')
      const d = await res.json().catch(() => null)
      if (res.ok) {
        setUsers(d.users)
      } else {
        setUsersError(d?.error || `Erro ${res.status} ao carregar usuarios`)
      }
    } catch (err) {
      console.error('[Admin] users:', err)
      setUsersError('Falha ao conectar com a API de usuarios')
    }
  }, [])

  const fetchAudit = useCallback(async (offset = 0, append = false) => {
    try {
      const res = await apiFetch(`/api/admin/audit?limit=50&offset=${offset}`)
      if (res.ok) { const d = await res.json(); setAudit(prev => append ? [...prev, ...d.logs] : d.logs); setAuditHasMore(d.logs.length === 50); setAuditOffset(offset + d.logs.length) }
    } catch (err) { console.error('[Admin] audit:', err) }
  }, [])

  const fetchPlans = useCallback(async () => {
    try {
      const res = await apiFetch('/api/admin/plans')
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.plans)) setPlans(data.plans)
      }
    } catch (err) { console.error('[Admin] plans:', err) }
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchStats(), fetchUsers(), fetchPlans()]).finally(() => setLoading(false))
  }, [fetchStats, fetchUsers, fetchPlans])

  useEffect(() => { if (adminTab === 'audit' && audit.length === 0) fetchAudit(0) }, [adminTab, audit.length, fetchAudit])

  const updateUser = async (userId: number, changes: Record<string, unknown>) => {
    setUpdatingUser(userId)
    try {
      const res = await apiFetch(`/api/admin/users/${userId}`, { method: 'PATCH', body: JSON.stringify(changes) })
      if (res.ok) { await fetchUsers(); await fetchStats() }
    } catch (err) { console.error('[Admin] update user:', err) } finally { setUpdatingUser(null) }
  }

  const savePlan = async (planIndex: number) => {
    const plan = plans[planIndex]
    setSavingPlan(plan.name)
    try {
      const res = await apiFetch('/api/admin/plans', { method: 'POST', body: JSON.stringify({ plan }) })
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.plans)) setPlans(data.plans)
      }
      setPlanSaved(plan.name)
      setTimeout(() => setPlanSaved(null), 2000)
    } catch (err) {
      console.error('[Admin] save plan:', err)
    } finally {
      setSavingPlan(null)
    }
  }

  const updatePlanField = (planIndex: number, field: string, value: string | number) => {
    setPlans(prev => {
      const next = [...prev]
      next[planIndex] = { ...next[planIndex], [field]: value }
      return next
    })
  }

  const togglePlanFeature = (planIndex: number, feature: keyof PlanFeatures) => {
    setPlans(prev => {
      const next = [...prev]
      next[planIndex] = {
        ...next[planIndex],
        features: { ...next[planIndex].features, [feature]: !next[planIndex].features[feature] },
      }
      return next
    })
  }

  const filteredUsers = users.filter(u => u.email.toLowerCase().includes(search.toLowerCase()) || u.name.toLowerCase().includes(search.toLowerCase()))
  const winRate = stats?.trades?.total ? ((Number(stats.trades.wins || 0) / Number(stats.trades.total)) * 100).toFixed(1) : '0.0'

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted">
        <svg className="animate-spin w-6 h-6 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
        Carregando...
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center gap-0.5 px-4 pt-3 pb-0 flex-shrink-0">
        {TAB_ITEMS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setAdminTab(tab.key)}
            className={`px-3 py-1.5 text-xs rounded-t font-medium transition-colors border-b-2 ${
              adminTab === tab.key
                ? 'border-accent text-white bg-card'
                : 'border-transparent text-muted hover:text-white hover:bg-card-hover'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="border-b border-card-border" />

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* Stats tab */}
        {adminTab === 'stats' && (
          <section className="space-y-6">
            <h3 className="text-sm font-display font-semibold text-muted uppercase tracking-wider mb-3">Metricas da Plataforma</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Total Usuarios" value={stats?.users?.total ?? 0} sub={`${stats?.users?.pro ?? 0} Pro / ${stats?.users?.trader ?? 0} Trader`} />
              <StatCard label="Usuarios Ativos" value={stats?.activeUsers ?? 0} sub="Conectados agora" />
              <StatCard label="Total Trades" value={stats?.trades?.total ?? 0} sub={`Win rate: ${winRate}%`} />
              <StatCard label="Sinais (24h)" value={stats?.signals?.total ?? 0} sub="Ultimas 24 horas" />
            </div>
          </section>
        )}

        {/* Users tab */}
        {adminTab === 'users' && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-display font-semibold text-muted uppercase tracking-wider">Usuarios</h3>
              <span className="text-xs text-muted font-mono-num">{filteredUsers.length} resultado(s)</span>
            </div>
            <div>
              <input type="text" placeholder="Buscar por email ou nome..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-card border border-card-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent/50 transition-colors" />
            </div>
            <div className="bg-card border border-card-border rounded-xl overflow-hidden">
              {usersError && (
                <div className="px-3 py-2 text-xs text-bear border-b border-card-border bg-bear/10">
                  {usersError}
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-card-border text-left">
                    <th className="px-3 py-2 text-xs text-muted font-medium uppercase tracking-wider">Email</th>
                    <th className="px-3 py-2 text-xs text-muted font-medium uppercase tracking-wider">Nome</th>
                    <th className="px-3 py-2 text-xs text-muted font-medium uppercase tracking-wider">Role</th>
                    <th className="px-3 py-2 text-xs text-muted font-medium uppercase tracking-wider">Plano</th>
                    <th className="px-3 py-2 text-xs text-muted font-medium uppercase tracking-wider">Trades</th>
                    <th className="px-3 py-2 text-xs text-muted font-medium uppercase tracking-wider">Win%</th>
                    <th className="px-3 py-2 text-xs text-muted font-medium uppercase tracking-wider">Ativo</th>
                  </tr></thead>
                  <tbody>
                    {filteredUsers.map((user) => {
                      const uwr = user.trade_count > 0 ? ((Number(user.win_count) / Number(user.trade_count)) * 100).toFixed(1) : '-'
                      const isUpdating = updatingUser === user.id
                      return (
                        <tr key={user.id} className={`border-b border-card-border/50 hover:bg-card-border/20 transition-colors ${isUpdating ? 'opacity-50' : ''}`}>
                          <td className="px-3 py-2.5 text-white font-mono-num text-xs">{user.email}</td>
                          <td className="px-3 py-2.5 text-white text-xs">{user.name}</td>
                          <td className="px-3 py-2.5">
                            <select value={user.role} onChange={(e) => updateUser(user.id, { role: e.target.value })} disabled={isUpdating} className="bg-bg border border-card-border rounded px-1.5 py-0.5 text-xs text-white cursor-pointer">
                              <option value="user">user</option><option value="admin">admin</option>
                            </select>
                          </td>
                          <td className="px-3 py-2.5">
                            <select value={user.plan} onChange={(e) => updateUser(user.id, { plan: e.target.value })} disabled={isUpdating} className="bg-bg border border-card-border rounded px-1.5 py-0.5 text-xs text-white cursor-pointer">
                              <option value="free">free</option><option value="pro">pro</option><option value="trader">trader</option>
                            </select>
                          </td>
                          <td className="px-3 py-2.5 font-mono-num text-xs text-white">{user.trade_count}</td>
                          <td className="px-3 py-2.5 font-mono-num text-xs">
                            <span className={uwr !== '-' && parseFloat(uwr) >= 50 ? 'text-bull' : uwr !== '-' ? 'text-bear' : 'text-muted'}>{uwr}{uwr !== '-' ? '%' : ''}</span>
                          </td>
                          <td className="px-3 py-2.5">
                            <button onClick={() => updateUser(user.id, { is_active: !user.is_active })} disabled={isUpdating} className={`w-9 h-5 rounded-full transition-colors ${user.is_active ? 'bg-bull' : 'bg-card-border'}`}>
                              <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${user.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                    {filteredUsers.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted text-sm">Nenhum usuario encontrado</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* Plans tab */}
        {adminTab === 'plans' && (
          <section className="space-y-4">
            <h3 className="text-sm font-display font-semibold text-muted uppercase tracking-wider">Editor de Planos</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.map((plan, idx) => (
                <div key={plan.name} className="bg-card border border-card-border rounded-xl p-5 flex flex-col gap-4">
                  {/* Plan header */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] text-muted uppercase tracking-wider">Nome do Plano</label>
                    <input
                      type="text"
                      value={plan.name}
                      onChange={(e) => updatePlanField(idx, 'name', e.target.value)}
                      className="bg-bg border border-card-border rounded px-2 py-1.5 text-sm text-white font-bold focus:outline-none focus:border-accent/50 transition-colors"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] text-muted uppercase tracking-wider">Preco</label>
                    <input
                      type="text"
                      value={plan.price}
                      onChange={(e) => updatePlanField(idx, 'price', e.target.value)}
                      className="bg-bg border border-card-border rounded px-2 py-1.5 text-sm text-accent font-mono-num focus:outline-none focus:border-accent/50 transition-colors"
                    />
                  </div>

                  {/* Feature toggles */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] text-muted uppercase tracking-wider">Features</span>
                    {(Object.keys(plan.features) as Array<keyof PlanFeatures>).map((feature) => (
                      <label key={feature} className="flex items-center gap-2 cursor-pointer group">
                        <button
                          type="button"
                          onClick={() => togglePlanFeature(idx, feature)}
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${
                            plan.features[feature]
                              ? 'bg-accent border-accent'
                              : 'border-card-border bg-bg hover:border-muted'
                          }`}
                        >
                          {plan.features[feature] && (
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <span className={`text-xs transition-colors ${plan.features[feature] ? 'text-white' : 'text-muted group-hover:text-white/70'}`}>
                          {FEATURE_LABELS[feature]}
                        </span>
                      </label>
                    ))}
                  </div>

                  {/* Limits */}
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] text-muted uppercase tracking-wider">Limites</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted flex-1">Max favoritos</span>
                      <input
                        type="number"
                        value={plan.maxFavorites}
                        onChange={(e) => updatePlanField(idx, 'maxFavorites', parseInt(e.target.value) || 0)}
                        className="w-20 bg-bg border border-card-border rounded px-2 py-1 text-xs text-white font-mono-num text-right focus:outline-none focus:border-accent/50 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Save button */}
                  <div className="mt-auto pt-3 border-t border-card-border/50">
                    <button
                      onClick={() => savePlan(idx)}
                      disabled={savingPlan === plan.name}
                      className={`w-full py-2 text-xs font-bold rounded-lg transition-all ${
                        planSaved === plan.name
                          ? 'bg-bull/20 text-bull'
                          : 'bg-accent/10 text-accent hover:bg-accent/20 hover:text-white'
                      } disabled:opacity-50`}
                    >
                      {savingPlan === plan.name ? 'Salvando...' : planSaved === plan.name ? 'Salvo!' : 'Salvar Plano'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted">Nota: Em producao, alteracoes de preco devem ser sincronizadas com o Stripe Dashboard.</p>
          </section>
        )}

        {/* Audit Log tab */}
        {adminTab === 'audit' && (
          <section className="space-y-3">
            <h3 className="text-sm font-display font-semibold text-muted uppercase tracking-wider">
              Log de Auditoria {audit.length > 0 && <span className="text-xs font-mono text-muted">({audit.length})</span>}
            </h3>
            <div className="bg-card border border-card-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-card-border text-left">
                    <th className="px-3 py-2 text-xs text-muted font-medium uppercase tracking-wider">Data</th>
                    <th className="px-3 py-2 text-xs text-muted font-medium uppercase tracking-wider">Usuario</th>
                    <th className="px-3 py-2 text-xs text-muted font-medium uppercase tracking-wider">Acao</th>
                    <th className="px-3 py-2 text-xs text-muted font-medium uppercase tracking-wider">Detalhes</th>
                  </tr></thead>
                  <tbody>
                    {audit.map((entry) => {
                      let details = ''
                      try { const parsed = typeof entry.details === 'string' ? JSON.parse(entry.details) : entry.details; details = JSON.stringify(parsed, null, 0) } catch { details = String(entry.details) }
                      return (
                        <tr key={entry.id} className="border-b border-card-border/50 hover:bg-card-border/20 transition-colors">
                          <td className="px-3 py-2 text-xs text-muted font-mono whitespace-nowrap">{new Date(entry.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                          <td className="px-3 py-2 text-xs text-white">{entry.user_email || '-'}</td>
                          <td className="px-3 py-2"><span className="inline-block px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded-full bg-accent/10 text-accent">{entry.action}</span></td>
                          <td className="px-3 py-2 text-xs text-muted font-mono max-w-[250px] truncate" title={details}>{details}</td>
                        </tr>
                      )
                    })}
                    {audit.length === 0 && <tr><td colSpan={4} className="px-3 py-8 text-center text-muted text-sm">Nenhum registro encontrado</td></tr>}
                  </tbody>
                </table>
              </div>
              {auditHasMore && audit.length > 0 && (
                <div className="p-3 border-t border-card-border">
                  <button onClick={() => fetchAudit(auditOffset, true)} className="w-full py-2 text-xs font-bold text-accent hover:text-white bg-accent/10 hover:bg-accent/20 rounded-lg transition-all">Carregar mais</button>
                </div>
              )}
            </div>
          </section>
        )}

      </div>
    </div>
  )
}
