import { useState } from 'react'
import { useStore } from '../store/useStore'
import type { UserMode } from '@bottrade/shared'

interface NavItem {
  key: string
  label: string
  icon: string
}

const NAV_ITEMS: Record<UserMode, NavItem[]> = {
  simple: [
    { key: 'dashboard', label: 'Dashboard', icon: 'chart' },
    { key: 'trades', label: 'Trades', icon: 'briefcase' },
    { key: 'settings', label: 'Configuracoes', icon: 'settings' },
  ],
  trader: [
    { key: 'dashboard', label: 'Dashboard', icon: 'chart' },
    { key: 'trades', label: 'Trades', icon: 'briefcase' },
    { key: 'paper', label: 'Paper', icon: 'clipboard' },
    { key: 'settings', label: 'Configuracoes', icon: 'settings' },
  ],
  pro: [
    { key: 'dashboard', label: 'Dashboard', icon: 'chart' },
    { key: 'trades', label: 'Trades', icon: 'briefcase' },
    { key: 'paper', label: 'Paper', icon: 'clipboard' },
    { key: 'backtest', label: 'Backtest', icon: 'flask' },
    { key: 'alerts', label: 'Alertas', icon: 'bell' },
    { key: 'settings', label: 'Configuracoes', icon: 'settings' },
  ],
}

function NavIcon({ icon, className }: { icon: string; className?: string }) {
  const cn = className || 'w-4 h-4'
  switch (icon) {
    case 'chart':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      )
    case 'signal':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.651a3.75 3.75 0 010-5.302m5.302 0a3.75 3.75 0 010 5.302m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.808-3.808-9.98 0-13.789m13.789 0c3.808 3.808 3.808 9.981 0 13.789M12 12h.008v.007H12V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
      )
    case 'briefcase':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" />
        </svg>
      )
    case 'clipboard':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
        </svg>
      )
    case 'flask':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
        </svg>
      )
    case 'bell':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
      )
    case 'settings':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    case 'admin':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      )
    default:
      return null
  }
}

export default function AppNav() {
  const currentPage = useStore((s) => s.currentPage)
  const navigateTo = useStore((s) => s.navigateTo)
  const authUser = useStore((s) => s.authUser)
  const userMode = useStore((s) => s.settings.userMode) || 'trader'
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)

  const items = NAV_ITEMS[userMode] || NAV_ITEMS.trader

  const allItems = authUser?.role === 'admin'
    ? [...items.filter(i => i.key !== 'settings'), { key: 'admin', label: 'Admin', icon: 'admin' }, ...items.filter(i => i.key === 'settings')]
    : items

  return (
    <>
      {/* Desktop: vertical sidebar - ultra-compact terminal style */}
      <nav className="hidden md:flex flex-col items-center bg-bg border-r border-card-border" style={{ width: 44, minWidth: 44 }}>
        {/* Logo */}
        <div className="py-2 w-full flex justify-center border-b border-card-border">
          <span className="font-display font-bold text-xs">B<span className="text-accent">.</span></span>
        </div>

        {/* Nav items */}
        <div className="flex-1 flex flex-col items-center py-1 gap-0.5 w-full">
          {allItems.map((item) => {
            const active = currentPage === item.key
            return (
              <div
                key={item.key}
                className="relative w-full"
                onMouseEnter={() => setHoveredItem(item.key)}
                onMouseLeave={() => setHoveredItem(null)}
                {...(item.key === 'trades' ? { 'data-tour': 'nav-trades' } :
                     item.key === 'paper' ? { 'data-tour': 'nav-paper' } :
                     item.key === 'settings' ? { 'data-tour': 'nav-settings' } : {})}
              >
                <button
                  onClick={() => navigateTo(item.key)}
                  className={`w-full flex items-center justify-center py-2 transition-all duration-150 relative ${
                    active ? 'text-accent border-l-2 border-accent' : 'text-muted hover:text-white hover:bg-card'
                  }`}
                >
                  <NavIcon icon={item.icon} />
                </button>
                {/* Tooltip */}
                {hoveredItem === item.key && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-card border border-card-border rounded text-[11px] text-white whitespace-nowrap z-50 shadow-lg pointer-events-none animate-fade-in">
                    {item.label}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </nav>

      {/* Mobile: bottom nav bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-bg border-t border-card-border flex items-center justify-around px-1 py-1 safe-area-pb">
        {allItems.slice(0, 5).map((item) => {
          const active = currentPage === item.key
          return (
            <button
              key={item.key}
              onClick={() => navigateTo(item.key)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded transition-all ${
                active ? 'text-accent' : 'text-muted'
              }`}
            >
              <NavIcon icon={item.icon} className="w-4 h-4" />
              <span className="text-[9px] font-bold">{item.label}</span>
            </button>
          )
        })}
      </nav>
    </>
  )
}
