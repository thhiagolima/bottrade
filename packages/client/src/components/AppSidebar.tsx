import { useEffect, useMemo, useRef, useCallback } from 'react'
import { useStore } from '../store/useStore'
import { emitToggleFavorite, emitAnalyzePair } from '../hooks/useSocket'
import SidebarPairCard from './SidebarPairCard'
import { formatPrice } from '../utils/format'
import type { BasicPairData } from '@bottrade/shared'

const directionDotColor: Record<string, string> = {
  LONG: 'bg-bull',
  SHORT: 'bg-bear',
  NEUTRO: 'bg-warn',
}

export default function AppSidebar() {
  const pairs = useStore((s) => s.pairs)
  const allPairs = useStore((s) => s.allPairs)
  const favorites = useStore((s) => s.favorites)
  const selectedPair = useStore((s) => s.selectedPair)
  const sidebarCollapsed = useStore((s) => s.sidebarCollapsed)
  const selectPair = useStore((s) => s.selectPair)
  const toggleSidebar = useStore((s) => s.toggleSidebar)
  const serverConnected = useStore((s) => s.serverConnected)
  const sidebarTab = useStore((s) => s.sidebarTab)
  const setSidebarTab = useStore((s) => s.setSidebarTab)
  const sidebarSearch = useStore((s) => s.sidebarSearch)
  const setSidebarSearch = useStore((s) => s.setSidebarSearch)
  const compareMode = useStore((s) => s.compareMode)
  const comparePairs = useStore((s) => s.comparePairs)
  const addComparePair = useStore((s) => s.addComparePair)
  const removeComparePair = useStore((s) => s.removeComparePair)
  const closeMobileSidebar = useStore((s) => s.closeMobileSidebar)
  const listRef = useRef<HTMLDivElement>(null)
  const requestedPairsFallback = useRef(false)

  useEffect(() => {
    if (sidebarTab !== 'all' || Object.keys(allPairs).length >= 20 || requestedPairsFallback.current) return
    let cancelled = false
    requestedPairsFallback.current = true
    fetch('/api/pairs')
      .then(res => res.ok ? res.json() : [])
      .then((symbols: string[]) => {
        if (cancelled || !Array.isArray(symbols)) return
        useStore.getState().setAllPairs(symbols.map((symbol) => ({
          symbol,
          price: 0,
          markPrice: 0,
          change24h: 0,
          volume24h: 0,
          fundingRate: 0,
        })))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [allPairs, sidebarTab])

  const favoriteEntries = useMemo(() => {
    return favorites
      .map((symbol) => ({ symbol, analysis: pairs[symbol] }))
      .filter((entry) => entry.analysis)
  }, [favorites, pairs])

  const allPairsSorted = useMemo(() => {
    const arr = Object.values(allPairs).filter(
      (p) => p.symbol.endsWith('USDT')
    ).map(p => {
      // If this pair is a favorite, use real-time score from pairs store
      const favAnalysis = pairs[p.symbol]
      if (favAnalysis && favAnalysis.lastUpdate > 0) {
        return {
          ...p,
          confluenceScore: favAnalysis.signal.confluenceScore,
          signalDirection: favAnalysis.signal.direction,
        }
      }
      return p
    })
    // Sort: pairs with signal (LONG/SHORT) first by score extremity, then by heat score
    const sortFn = (a: typeof arr[0], b: typeof arr[0]) => {
      // Prioritize pairs with LONG/SHORT signal
      const aHasSignal = a.signalDirection && a.signalDirection !== 'NEUTRO' ? 1 : 0
      const bHasSignal = b.signalDirection && b.signalDirection !== 'NEUTRO' ? 1 : 0
      if (aHasSignal !== bHasSignal) return bHasSignal - aHasSignal
      // Then by score extremity (distance from 50)
      const aExtreme = a.confluenceScore != null ? Math.abs(a.confluenceScore - 50) : 0
      const bExtreme = b.confluenceScore != null ? Math.abs(b.confluenceScore - 50) : 0
      if (aExtreme !== bExtreme) return bExtreme - aExtreme
      // Fallback to heat score
      return (b.heatScore?.score ?? 0) - (a.heatScore?.score ?? 0)
    }
    if (sidebarSearch) {
      const q = sidebarSearch.toUpperCase()
      return arr.filter((p) => p.symbol.includes(q)).sort(sortFn).slice(0, 100)
    }
    return arr.sort(sortFn).slice(0, 100)
  }, [allPairs, pairs, sidebarSearch])

  const handleToggleFavorite = useCallback((symbol: string, e: React.MouseEvent) => {
    e.stopPropagation()
    emitToggleFavorite(symbol)
  }, [])

  const handleSelectPair = useCallback((symbol: string) => {
    if (!favorites.includes(symbol)) {
      return
    }
    selectPair(symbol)
    closeMobileSidebar()
  }, [favorites, selectPair, closeMobileSidebar])

  const extractShortSymbol = (symbol: string) => {
    return symbol.replace(/USDT$/, '').slice(0, 3)
  }

  // ── Collapsed sidebar ──
  if (sidebarCollapsed) {
    return (
      <div
        className="hidden md:flex flex-col items-center border-r border-card-border bg-card transition-all duration-200"
        style={{ width: 44, minWidth: 44 }}
      >
        <button
          onClick={toggleSidebar}
          className="p-1.5 mt-1.5 mb-1 rounded hover:bg-card-border text-muted hover:text-white transition-all duration-150"
          title="Expandir sidebar"
          aria-label="Expandir sidebar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <div className="flex-1 overflow-y-auto w-full">
          {favoriteEntries.map(({ symbol, analysis }) => {
            const direction = analysis.signal?.direction ?? 'NEUTRO'
            const dotColor = directionDotColor[direction] ?? 'bg-warn'
            const isSelected = selectedPair === symbol

            const isInCompare = comparePairs.includes(symbol)

            return (
              <button
                key={symbol}
                onClick={() => {
                  if (compareMode) {
                    isInCompare ? removeComparePair(symbol) : addComparePair(symbol)
                  } else {
                    selectPair(symbol)
                  }
                }}
                className={`w-full flex flex-col items-center py-1.5 transition-colors ${
                  compareMode && isInCompare ? 'bg-bull/20' : isSelected ? 'bg-card-border/50' : 'hover:bg-card-border/30'
                }`}
                title={`${symbol} - $${formatPrice(analysis.price.price)} - Score: ${analysis.signal.confluenceScore.toFixed(0)}%`}
              >
                <span className="text-[9px] font-bold font-mono-num">{extractShortSymbol(symbol)}</span>
                <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${dotColor}`} />
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Expanded sidebar ──
  return (
    <div
      className="flex flex-col border-r border-card-border bg-card transition-all duration-200 w-[85vw] max-w-[300px] md:w-[200px] md:max-w-none h-full"
      style={{ minWidth: 200 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-card-border">
        <div className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${serverConnected ? 'bg-bull' : 'bg-bear'}`}
            title={serverConnected ? 'Conectado' : 'Desconectado'}
          />
          <span className="text-[11px] text-muted font-mono-num">{favorites.length} pares</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Mobile close button */}
          <button
            onClick={closeMobileSidebar}
            className="md:hidden p-1.5 rounded hover:bg-card-border transition-all duration-150 text-muted hover:text-white"
            title="Fechar sidebar"
            aria-label="Fechar sidebar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {/* Desktop collapse button */}
          <button
            onClick={toggleSidebar}
            className="hidden md:block p-1 rounded hover:bg-card-border transition-all duration-150 text-muted hover:text-white"
            title="Colapsar sidebar"
            aria-label="Recolher sidebar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-card-border relative" data-tour="sidebar-tabs">
        <button
          onClick={() => setSidebarTab('favorites')}
          className={`flex-1 py-1 text-xs font-bold text-center transition-all duration-150 relative ${
            sidebarTab === 'favorites'
              ? 'text-white'
              : 'text-muted hover:text-white'
          }`}
        >
          {sidebarTab === 'favorites' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
          )}
          Favoritos ({favorites.length})
        </button>
        <button
          onClick={() => setSidebarTab('all')}
          className={`flex-1 py-1 text-xs font-bold text-center transition-all duration-150 relative ${
            sidebarTab === 'all'
              ? 'text-white'
              : 'text-muted hover:text-white'
          }`}
        >
          {sidebarTab === 'all' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
          )}
          Todos ({Object.keys(allPairs).length})
        </button>
      </div>

      {/* Search (only in "all" tab) */}
      {sidebarTab === 'all' && (
        <div className="px-2 py-1 border-b border-card-border">
          <input
            type="text"
            value={sidebarSearch}
            onChange={(e) => setSidebarSearch(e.target.value)}
            placeholder="Buscar par..."
            className="w-full px-2 py-1 bg-bg border border-card-border rounded text-white font-mono-num text-xs"
          />
        </div>
      )}

      {/* Pair list */}
      <div className="flex-1 overflow-y-auto" ref={listRef} data-tour="sidebar-pairs">
        {sidebarTab === 'favorites' ? (
          // ── Favorites tab ──
          favoriteEntries.length > 0 ? (
            favoriteEntries.map(({ symbol, analysis }) => {
              const isInCompare = comparePairs.includes(symbol)
              return (
              <div key={symbol} className="relative group">
                {compareMode && (
                  <div className="absolute left-1 top-1/2 -translate-y-1/2 z-10">
                    <span className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded border text-[9px] ${
                      isInCompare ? 'bg-bull border-bull text-white' : 'border-card-border text-transparent'
                    }`}>
                      {isInCompare ? '\u2713' : ''}
                    </span>
                  </div>
                )}
                <SidebarPairCard
                  analysis={analysis}
                  selected={compareMode ? isInCompare : selectedPair === symbol}
                  onClick={() => {
                    if (compareMode) {
                      isInCompare ? removeComparePair(symbol) : addComparePair(symbol)
                    } else {
                      selectPair(symbol)
                      closeMobileSidebar()
                    }
                  }}
                />
                {/* Unfavorite button */}
                <button
                  onClick={(e) => handleToggleFavorite(symbol, e)}
                  className="absolute top-0.5 right-0.5 p-1 rounded text-warn hover:text-bear cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                  title={`Remover ${symbol} dos favoritos`}
                  aria-label="Remover favorito"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </button>
              </div>
              )
            })
          ) : (
            <div className="px-3 py-2 text-center text-muted text-xs">
              Nenhum favorito. Va em "Todos" e clique na estrela para adicionar.
            </div>
          )
        ) : (
          // ── All pairs tab ──
          allPairsSorted.length > 0 ? (
            allPairsSorted.map((pair) => (
              <AllPairRow
                key={pair.symbol}
                pair={pair}
                isFavorite={favorites.includes(pair.symbol)}
                isSelected={selectedPair === pair.symbol}
                onSelect={handleSelectPair}
              />
            ))
          ) : (
            <div className="px-3 py-2 text-center text-muted text-xs">
              {sidebarSearch ? 'Nenhum par encontrado' : 'Carregando pares...'}
            </div>
          )
        )}
      </div>
    </div>
  )
}

// ── All Pair Row (lightweight, with heat score) ──

function AllPairRow({
  pair,
  isFavorite,
  isSelected,
  onSelect,
}: {
  pair: BasicPairData
  isFavorite: boolean
  isSelected: boolean
  onSelect: (symbol: string) => void
}) {
  const changePositive = pair.change24h >= 0
  const heat = pair.heatScore
  const setTempAnalysis = useStore((s) => s.setTempAnalysis)
  const setAnalyzingPair = useStore((s) => s.setAnalyzingPair)
  const analyzingPair = useStore((s) => s.analyzingPair)
  const isAnalyzing = analyzingPair === pair.symbol

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isFavorite) return
    onSelect(pair.symbol)
    setAnalyzingPair(pair.symbol)
    emitAnalyzePair(pair.symbol, (analysis) => {
      setAnalyzingPair(null)
      if (analysis) {
        setTempAnalysis(analysis)
      }
    })
  }

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    emitToggleFavorite(pair.symbol)
  }

  const handleMonitorClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    emitToggleFavorite(pair.symbol)
  }

  const heatBg = heat?.label === 'QUENTE' ? 'bg-bear/10' : heat?.label === 'MORNO' ? 'bg-warn/10' : ''

  return (
    <div
      className={`px-2 py-1.5 text-xs border-b border-card-border/30 transition-colors ${isFavorite ? 'cursor-pointer' : 'cursor-default'} ${heatBg} ${
        isSelected ? 'bg-card-border/50' : 'hover:bg-card-border/20'
      }`}
      onClick={isFavorite ? handleOpen : undefined}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-1.5 gap-y-0.5">
        <button
          onClick={handleFavoriteClick}
          className={`flex-shrink-0 p-1 -m-1 cursor-pointer ${isFavorite ? 'text-warn' : 'text-muted/30 hover:text-warn/60'}`}
          title={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          aria-label={isFavorite ? 'Remover favorito' : 'Favoritar'}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill={isFavorite ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </button>

        <div className="min-w-0 flex items-center gap-1">
          <span className="min-w-0 truncate font-bold text-[11px]" title={pair.symbol}>
            {pair.symbol.replace('USDT', '')}
          </span>
          {pair.signalDirection && pair.signalDirection !== 'NEUTRO' && (
            <span className={`flex-shrink-0 px-0.5 py-0 text-[9px] font-bold rounded ${
              pair.signalDirection === 'LONG' ? 'bg-bull/20 text-bull' : 'bg-bear/20 text-bear'
            }`}>
              {pair.signalDirection}
            </span>
          )}
        </div>

        <span className="font-mono-num text-right text-[10px] tabular-nums">
          {pair.price > 0 ? formatPrice(pair.price) : 'carregando'}
        </span>

        <span className={`col-start-3 font-mono-num text-right text-[10px] tabular-nums ${changePositive ? 'text-bull' : 'text-bear'}`}>
          {changePositive ? '+' : ''}{pair.change24h.toFixed(1)}%
        </span>
      </div>
      {/* Score bar (if confluence score available) */}
      {pair.confluenceScore != null && (
        <div className="flex items-center gap-1 mt-0.5">
          <div className="flex-1 h-0.5 rounded-full overflow-hidden" style={{ background: 'linear-gradient(to right, #ff4444, #ffaa00, #00c896)' }}>
            <div className="h-full bg-white/30 rounded-full" style={{ width: `${Math.min(100, Math.max(0, pair.confluenceScore))}%` }} />
          </div>
          <span className="font-mono-num text-[9px] text-muted w-6 text-right">{pair.confluenceScore.toFixed(0)}%</span>
        </div>
      )}

      {/* Row 2: heat score + reasons + action buttons */}
      <div className="mt-0.5 flex items-center gap-1 min-w-0">
        {heat && heat.label !== 'FRIO' && (
          <>
            <span className={`px-0.5 py-0 text-[9px] font-bold rounded ${
              heat.label === 'QUENTE' ? 'bg-bear/20 text-bear' : 'bg-warn/20 text-warn'
            }`}>
              {heat.score}
            </span>
            <span className="text-[9px] text-muted truncate flex-1" title={heat.reasons.join(' | ')}>
              {heat.reasons[0] ?? ''}
            </span>
          </>
        )}
        {(!heat || heat.label === 'FRIO') && (
          <span className="text-[9px] text-muted truncate flex-1">
            {isFavorite ? 'Clique para abrir' : 'Adicione para monitorar'}
          </span>
        )}
        <button
          onClick={isFavorite ? handleOpen : handleMonitorClick}
          disabled={isFavorite && isAnalyzing}
          className="flex-shrink-0 px-1 py-0 text-[9px] font-bold bg-accent/20 text-accent rounded hover:bg-accent/30 transition-colors disabled:opacity-50"
        >
          {isFavorite ? (isAnalyzing ? '...' : 'Abrir') : 'Monitorar'}
        </button>
      </div>
    </div>
  )
}
