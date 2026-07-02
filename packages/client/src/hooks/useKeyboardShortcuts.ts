import { useEffect } from 'react'
import { useStore } from '../store/useStore'

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return

      const state = useStore.getState()

      // Navigation: number keys select favorite pairs
      if (e.key === '1' && !e.ctrlKey && !e.metaKey) {
        const favorites = state.favorites || Object.keys(state.pairs)
        if (favorites.length > 0) { state.selectPair(favorites[0]); state.navigateTo('dashboard') }
      }
      if (e.key === '2' && !e.ctrlKey && !e.metaKey) {
        const favorites = state.favorites || Object.keys(state.pairs)
        if (favorites.length > 1) { state.selectPair(favorites[1]); state.navigateTo('dashboard') }
      }
      if (e.key === '3' && !e.ctrlKey && !e.metaKey) {
        const favorites = state.favorites || Object.keys(state.pairs)
        if (favorites.length > 2) { state.selectPair(favorites[2]); state.navigateTo('dashboard') }
      }

      // Arrow keys to navigate pairs (only on dashboard)
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && state.currentPage === 'dashboard') {
        e.preventDefault()
        const favorites = state.favorites || Object.keys(state.pairs)
        if (favorites.length === 0) return
        const currentIdx = favorites.indexOf(state.selectedPair || '')
        if (e.key === 'ArrowUp') {
          const newIdx = currentIdx <= 0 ? favorites.length - 1 : currentIdx - 1
          state.selectPair(favorites[newIdx])
        } else {
          const newIdx = currentIdx >= favorites.length - 1 ? 0 : currentIdx + 1
          state.selectPair(favorites[newIdx])
        }
      }

      // Page navigation shortcuts
      if (e.key === 's' && !e.ctrlKey && !e.metaKey) {
        state.navigateTo('settings')
      }
      if (e.key === 'h' && !e.ctrlKey && !e.metaKey) {
        state.navigateTo('signals')
      }
      if (e.key === 'b' && !e.ctrlKey && !e.metaKey) {
        state.navigateTo('backtest')
      }
      if (e.key === 'p' && !e.ctrlKey && !e.metaKey) {
        state.navigateTo('trades')
      }
      if (e.key === 'c' && !e.ctrlKey && !e.metaKey) {
        state.toggleCompareMode()
      }
      if (e.key === 'd' && !e.ctrlKey && !e.metaKey) {
        state.navigateTo('dashboard')
      }

      // Escape to go back to dashboard
      if (e.key === 'Escape') {
        if (state.currentPage !== 'dashboard') {
          state.navigateTo('dashboard')
        } else if (state.compareMode) {
          state.toggleCompareMode()
        } else if (state.mobileSidebarOpen) {
          state.closeMobileSidebar()
        }
      }

      // ? to show shortcuts help
      if (e.key === '?' && !e.ctrlKey) {
        const el = document.getElementById('shortcuts-help')
        if (el) el.style.display = el.style.display === 'none' ? 'flex' : 'none'
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
