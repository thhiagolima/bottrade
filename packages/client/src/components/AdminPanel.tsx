import { useState, useEffect, useCallback } from 'react'
import { useStore } from '../store/useStore'

interface AdminPanelProps {
  open: boolean
  onClose: () => void
}

interface PlatformStats {
  users: { total: number; pro: number; trader: number }
  trades: { total: number; wins: number }
  signals: { total: number }
  activeUsers: number
}

interface AdminUser {
  id: number
  email: string
  name: string
  role: string
  plan: string
  plan_expires_at: string | null
  is_active: boolean | number
  last_login: string | null
  created_at: string
  trade_count: number
  win_count: number
}

interface AuditEntry {
  id: number
  user_id: number | null
  user_email: string | null
  action: string
  details: string | Record<string, unknown>
  ip_address: string | null
  created_at: string
}

function apiFetch(path: string, options?: RequestInit) {
  const token = useStore.getState().authToken
  return fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options?.headers || {}),
    },
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

export default function AdminPanel({ open, onClose }: AdminPanelProps) {
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [auditOpen, setAuditOpen] = useState(false)
  const [auditOffset, setAuditOffset] = useState(0)
  const [auditHasMore, setAuditHasMore] = useState(true)
  const [updatingUser, setUpdatingUser] = useState<number | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      const res = await apiFetch('/api/admin/stats')
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (err) {
      console.error('[Admin] Failed to fetch stats:', err)
    }
  }, [])

  const fetchUsers = useCallback(async () => {
    try {
      const res = await apiFetch('/api/admin/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users)
      }
    } catch (err) {
      console.error('[Admin] Failed to fetch users:', err)
    }
  }, [])

  const fetchAudit = useCallback(async (offset = 0, append = false) => {
    try {
      const res = await apiFetch(`/api/admin/audit?limit=50&offset=${offset}`)
      if (res.ok) {
        const data = await res.json()
        setAudit((prev) => append ? [...prev, ...data.logs] : data.logs)
        setAuditHasMore(data.logs.length === 50)
        setAuditOffset(offset + data.logs.length)
      }
    } catch (err) {
      console.error('[Admin] Failed to fetch audit:', err)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    Promise.all([fetchStats(), fetchUsers()]).finally(() => setLoading(false))
  }, [open, fetchStats, fetchUsers])

  useEffect(() => {
    if (auditOpen && audit.length === 0) {
      fetchAudit(0)
    }
  }, [auditOpen, audit.length, fetchAudit])

  const updateUser = async (userId: number, changes: Record<string, unknown>) => {
    setUpdatingUser(userId)
    try {
      const res = await apiFetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(changes),
      })
      if (res.ok) {
        // Refresh users list
        await fetchUsers()
        await fetchStats()
      }
    } catch (err) {
      console.error('[Admin] Failed to update user:', err)
    } finally {
      setUpdatingUser(null)
    }
  }

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.name.toLowerCase().includes(search.toLowerCase())
  )

  const winRate = stats?.trades?.total
    ? ((Number(stats.trades.wins || 0) / Number(stats.trades.total)) * 100).toFixed(1)
    : '0.0'

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full md:w-[800px] h-full bg-bg border-l border-card-border overflow-y-auto animate-slide-in-right">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-bg/95 backdrop-blur-sm border-b border-card-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-display font-bold text-white">Painel Admin</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted hover:text-white hover:bg-card-border/50 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64 text-muted">
            <svg className="animate-spin w-6 h-6 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Carregando...
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Platform Stats */}
            <section>
              <h3 className="text-sm font-display font-semibold text-muted uppercase tracking-wider mb-3">Metricas da Plataforma</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                  label="Total Usuarios"
                  value={stats?.users?.total ?? 0}
                  sub={`${stats?.users?.pro ?? 0} Pro / ${stats?.users?.trader ?? 0} Trader`}
                />
                <StatCard label="Usuarios Ativos" value={stats?.activeUsers ?? 0} sub="Conectados agora" />
                <StatCard
                  label="Total Trades"
                  value={stats?.trades?.total ?? 0}
                  sub={`Win rate: ${winRate}%`}
                />
                <StatCard label="Sinais (24h)" value={stats?.signals?.total ?? 0} sub="Ultimas 24 horas" />
              </div>
            </section>

            {/* Users Table */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-display font-semibold text-muted uppercase tracking-wider">Usuarios</h3>
                <span className="text-xs text-muted font-mono-num">{filteredUsers.length} resultado(s)</span>
              </div>

              {/* Search */}
              <div className="mb-3">
                <input
                  type="text"
                  placeholder="Buscar por email ou nome..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-card border border-card-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent/50 transition-colors"
                />
              </div>

              {/* Table */}
              <div className="bg-card border border-card-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-card-border text-left">
                        <th className="px-3 py-2 text-xs text-muted font-medium uppercase tracking-wider">Email</th>
                        <th className="px-3 py-2 text-xs text-muted font-medium uppercase tracking-wider">Nome</th>
                        <th className="px-3 py-2 text-xs text-muted font-medium uppercase tracking-wider">Role</th>
                        <th className="px-3 py-2 text-xs text-muted font-medium uppercase tracking-wider">Plano</th>
                        <th className="px-3 py-2 text-xs text-muted font-medium uppercase tracking-wider">Trades</th>
                        <th className="px-3 py-2 text-xs text-muted font-medium uppercase tracking-wider">Win%</th>
                        <th className="px-3 py-2 text-xs text-muted font-medium uppercase tracking-wider">Ultimo Login</th>
                        <th className="px-3 py-2 text-xs text-muted font-medium uppercase tracking-wider">Ativo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user) => {
                        const userWinRate = user.trade_count > 0
                          ? ((Number(user.win_count) / Number(user.trade_count)) * 100).toFixed(1)
                          : '-'
                        const isUpdating = updatingUser === user.id
                        return (
                          <tr key={user.id} className={`border-b border-card-border/50 hover:bg-card-border/20 transition-colors ${isUpdating ? 'opacity-50' : ''}`}>
                            <td className="px-3 py-2.5 text-white font-mono-num text-xs">{user.email}</td>
                            <td className="px-3 py-2.5 text-white text-xs">{user.name}</td>
                            <td className="px-3 py-2.5">
                              <select
                                value={user.role}
                                onChange={(e) => updateUser(user.id, { role: e.target.value })}
                                disabled={isUpdating}
                                className="bg-bg border border-card-border rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-accent/50 cursor-pointer"
                              >
                                <option value="user">user</option>
                                <option value="admin">admin</option>
                              </select>
                            </td>
                            <td className="px-3 py-2.5">
                              <select
                                value={user.plan}
                                onChange={(e) => updateUser(user.id, { plan: e.target.value })}
                                disabled={isUpdating}
                                className="bg-bg border border-card-border rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-accent/50 cursor-pointer"
                              >
                                <option value="free">free</option>
                                <option value="pro">pro</option>
                                <option value="trader">trader</option>
                              </select>
                            </td>
                            <td className="px-3 py-2.5 font-mono-num text-xs text-white">{user.trade_count}</td>
                            <td className="px-3 py-2.5 font-mono-num text-xs">
                              <span className={userWinRate !== '-' && parseFloat(userWinRate) >= 50 ? 'text-bull' : userWinRate !== '-' ? 'text-bear' : 'text-muted'}>
                                {userWinRate}{userWinRate !== '-' ? '%' : ''}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-xs text-muted">
                              {user.last_login ? new Date(user.last_login).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Nunca'}
                            </td>
                            <td className="px-3 py-2.5">
                              <button
                                onClick={() => updateUser(user.id, { is_active: !user.is_active })}
                                disabled={isUpdating}
                                className={`w-9 h-5 rounded-full transition-colors ${user.is_active ? 'bg-bull' : 'bg-card-border'}`}
                              >
                                <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${user.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                      {filteredUsers.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-3 py-8 text-center text-muted text-sm">
                            Nenhum usuario encontrado
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* Audit Log */}
            <section>
              <button
                onClick={() => setAuditOpen(!auditOpen)}
                className="flex items-center gap-2 text-sm font-display font-semibold text-muted uppercase tracking-wider hover:text-white transition-colors w-full"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`w-4 h-4 transition-transform ${auditOpen ? 'rotate-90' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                Log de Auditoria
                {audit.length > 0 && (
                  <span className="text-xs font-mono text-muted">({audit.length})</span>
                )}
              </button>

              {auditOpen && (
                <div className="mt-3 bg-card border border-card-border rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-card-border text-left">
                          <th className="px-3 py-2 text-xs text-muted font-medium uppercase tracking-wider">Data</th>
                          <th className="px-3 py-2 text-xs text-muted font-medium uppercase tracking-wider">Usuario</th>
                          <th className="px-3 py-2 text-xs text-muted font-medium uppercase tracking-wider">Acao</th>
                          <th className="px-3 py-2 text-xs text-muted font-medium uppercase tracking-wider">Detalhes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {audit.map((entry) => {
                          let details = ''
                          try {
                            const parsed = typeof entry.details === 'string' ? JSON.parse(entry.details) : entry.details
                            details = JSON.stringify(parsed, null, 0)
                          } catch {
                            details = String(entry.details)
                          }
                          return (
                            <tr key={entry.id} className="border-b border-card-border/50 hover:bg-card-border/20 transition-colors">
                              <td className="px-3 py-2 text-xs text-muted font-mono whitespace-nowrap">
                                {new Date(entry.created_at).toLocaleDateString('pt-BR', {
                                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
                                })}
                              </td>
                              <td className="px-3 py-2 text-xs text-white">{entry.user_email || '-'}</td>
                              <td className="px-3 py-2">
                                <span className="inline-block px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded-full bg-accent/10 text-accent">
                                  {entry.action}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-xs text-muted font-mono max-w-[250px] truncate" title={details}>
                                {details}
                              </td>
                            </tr>
                          )
                        })}
                        {audit.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-3 py-8 text-center text-muted text-sm">
                              Nenhum registro encontrado
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {auditHasMore && audit.length > 0 && (
                    <div className="p-3 border-t border-card-border">
                      <button
                        onClick={() => fetchAudit(auditOffset, true)}
                        className="w-full py-2 text-xs font-bold text-accent hover:text-white bg-accent/10 hover:bg-accent/20 rounded-lg transition-all"
                      >
                        Carregar mais
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
