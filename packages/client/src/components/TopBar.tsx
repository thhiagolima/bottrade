import { useState, useRef, useEffect } from 'react'
import { useClerk } from '@clerk/react'
import { useStore } from '../store/useStore'
import type { UserMode } from '@bottrade/shared'

interface NavItem {
  key: string
  label: string
}

function getNavItems(userMode: UserMode, role?: string): NavItem[] {
  const items: NavItem[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'trade', label: 'Analise' },
    { key: 'trades', label: 'Historico' },
  ]

  if (userMode === 'trader' || userMode === 'pro') {
    items.push({ key: 'paper', label: 'Paper' })
  }

  if (userMode === 'pro') {
    items.push({ key: 'backtest', label: 'Backtest' })
    items.push({ key: 'alerts', label: 'Alertas' })
  }

  items.push({ key: 'settings', label: 'Config' })

  if (role === 'admin') {
    items.push({ key: 'admin', label: 'Admin' })
  }

  return items
}

const MODE_LABELS: Record<UserMode, string> = {
  simple: 'Simple',
  trader: 'Trader',
  pro: 'Pro',
}

const MODE_CLASSES: Record<UserMode, { bgLight: string; text: string }> = {
  simple: { bgLight: 'bg-bull/20', text: 'text-bull' },
  trader: { bgLight: 'bg-warn/20', text: 'text-warn' },
  pro: { bgLight: 'bg-bear/20', text: 'text-bear' },
}

export default function TopBar() {
  const currentPage = useStore((s) => s.currentPage)
  const navigateTo = useStore((s) => s.navigateTo)
  const authUser = useStore((s) => s.authUser)
  const logout = useStore((s) => s.logout)
  const { signOut } = useClerk()
  const serverConnected = useStore((s) => s.serverConnected)
  const userMode = (useStore((s) => s.settings.userMode) || 'trader') as UserMode
  const customAlerts = useStore((s) => s.settings.customAlerts)
  const activeAlertsCount = (customAlerts ?? []).filter((a) => !a.triggered).length
  const toggleMobileSidebar = useStore((s) => s.toggleMobileSidebar)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  const navItems = getNavItems(userMode, authUser?.role)
  const modeClasses = MODE_CLASSES[userMode]

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    if (userMenuOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [userMenuOpen])

  // Close mobile menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (mobileMenuOpen && !target.closest('[data-topbar]')) {
        setMobileMenuOpen(false)
      }
    }
    if (mobileMenuOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [mobileMenuOpen])

  return (
    <header className="bg-card/80 backdrop-blur-xl border-b border-card-border flex-shrink-0" data-topbar>
      {/* Main nav row */}
      <div className="flex items-center h-14 px-4">
        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden mr-2 p-1 text-muted hover:text-white transition-colors"
          aria-label="Menu"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>

        {/* Logo */}
        <button
          onClick={() => navigateTo('dashboard')}
          className="flex items-center gap-2 mr-6 cursor-pointer hover:opacity-80 transition-opacity"
        >
          <span className="font-display text-base font-black text-white">B<span className="text-bull">.</span></span>
          <span className="hidden sm:inline text-sm font-bold tracking-tight text-white/90">Bottrade</span>
          <span
            className={`w-1.5 h-1.5 rounded-full ${serverConnected ? 'bg-bull' : 'bg-bear'} animate-pulse-dot`}
            title={serverConnected ? 'Conectado' : 'Desconectado'}
          />
        </button>

        {/* Desktop nav links */}
        <nav className="hidden md:flex items-center gap-1.5">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => navigateTo(item.key)}
              className={`px-3 py-1.5 text-xs rounded-lg cursor-pointer transition-colors font-bold ${
                currentPage === item.key
                  ? 'bg-accent/15 text-white border border-accent/30'
                  : 'text-muted hover:text-white hover:bg-card-hover border border-transparent'
              }`}
              {...(item.key === 'trades' ? { 'data-tour': 'nav-trades' } :
                   item.key === 'paper' ? { 'data-tour': 'nav-paper' } :
                   item.key === 'settings' ? { 'data-tour': 'nav-settings' } : {})}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right side: mobile pair sidebar toggle */}
        <button
          onClick={toggleMobileSidebar}
          className="md:hidden p-1.5 text-muted hover:text-white mr-1 transition-colors"
          aria-label="Pares"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M3 8h18M3 12h18M3 16h6" />
          </svg>
        </button>

        {/* Notification bell */}
        {userMode !== 'simple' && (
          <button
            onClick={() => navigateTo('alerts')}
            className="p-1.5 text-muted hover:text-white relative transition-colors"
            title="Alertas"
            aria-label="Notificacoes"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {activeAlertsCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-accent text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {activeAlertsCount}
              </span>
            )}
          </button>
        )}

        {/* User menu */}
        <div className="relative ml-2" ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-card-hover cursor-pointer transition-colors"
          >
            <span className="text-xs text-muted hidden sm:inline">{authUser?.name}</span>
            <span
              className={`text-[10px] font-bold uppercase px-1 py-0.5 rounded ${modeClasses.bgLight} ${modeClasses.text}`}
            >
              {MODE_LABELS[userMode]}
            </span>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-card-border rounded shadow-lg z-50 py-1 animate-fade-in">
              <div className="px-3 py-2 border-b border-card-border">
                <div className="text-xs font-bold text-white">{authUser?.name}</div>
                <div className="text-[10px] text-muted">{authUser?.email}</div>
              </div>
              <button
                onClick={() => { navigateTo('settings'); setUserMenuOpen(false) }}
                className="w-full text-left px-3 py-1.5 text-xs text-muted hover:text-white hover:bg-card-border/30 transition-colors"
              >
                Configuracoes
              </button>
              {authUser?.role === 'admin' && (
                <button
                  onClick={() => { navigateTo('admin'); setUserMenuOpen(false) }}
                  className="w-full text-left px-3 py-1.5 text-xs text-muted hover:text-white hover:bg-card-border/30 transition-colors"
                >
                  Admin
                </button>
              )}
              <button
                onClick={() => { signOut().finally(() => logout()); setUserMenuOpen(false) }}
                className="w-full text-left px-3 py-1.5 text-xs text-bear hover:bg-bear/10 transition-colors"
              >
                Sair
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-card-border bg-card-hover animate-fade-in">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => { navigateTo(item.key); setMobileMenuOpen(false) }}
              className={`w-full text-left px-4 py-2.5 text-xs transition-colors ${
                currentPage === item.key
                  ? 'text-white bg-card-border font-medium'
                  : 'text-muted hover:text-white hover:bg-card-border/30'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </header>
  )
}
