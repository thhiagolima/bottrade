import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import type { PairAnalysis, PriceData, Alert, UserSettings, SignalRecord, Trade, TradeStats, TradeRecommendation, CandleData, BasicPairData, BacktestParams, BacktestResult, PerformanceData, CustomAlert, OrderRequest, OrderResult } from '@bottrade/shared'
import { useStore } from '../store/useStore'
import { showAlert } from '../components/AlertToast'

let socket: Socket | null = null

export function useSocket(): void {
  const lastPriceTimestamps = useRef<Record<string, number>>({})

  const updatePrice = useStore((state) => state.updatePrice)
  const updateAnalysis = useStore((state) => state.updateAnalysis)
  const setAllPairs = useStore((state) => state.setAllPairs)
  const setFavorites = useStore((state) => state.setFavorites)
  const setConnectionStatus = useStore((state) => state.setConnectionStatus)
  const setServerConnected = useStore((state) => state.setServerConnected)
  const setSettings = useStore((state) => state.setSettings)
  const setSnapshot = useStore((state) => state.setSnapshot)
  const setOpenTrade = useStore((state) => state.setOpenTrade)
  const removeOpenTrade = useStore((state) => state.removeOpenTrade)
  const setTradeRecommendation = useStore((state) => state.setTradeRecommendation)

  const authToken = useStore((state) => state.authToken)

  useEffect(() => {
    const token = useStore.getState().authToken
    if (!token) return // Don't connect without auth

    socket = io({
      auth: { token }
    })

    socket.on('connect', () => {
      setServerConnected(true)
    })

    socket.on('disconnect', () => {
      setServerConnected(false)
    })

    socket.on('connect_error', (err) => {
      console.warn('[Socket.io] Connection error:', err.message)
      setServerConnected(false)
    })

    socket.on('price-update', (data: { symbol: string; priceData: PriceData }) => {
      const now = Date.now()
      const last = lastPriceTimestamps.current[data.symbol] ?? 0
      if (now - last < 1000) return
      lastPriceTimestamps.current = { ...lastPriceTimestamps.current, [data.symbol]: now }
      updatePrice(data.symbol, data.priceData)
    })

    socket.on('analysis-update', (data: PairAnalysis) => {
      updateAnalysis(data)
    })

    socket.on('entry-check', (data: { symbol: string; check: import('@bottrade/shared').EntryCheckResult }) => {
      const pairs = useStore.getState().pairs
      const existing = pairs[data.symbol]
      if (existing) {
        updateAnalysis({ ...existing, entryCheck: data.check })
      }
    })

    socket.on('alert', (alert: Alert) => {
      showAlert(alert)
    })

    socket.on('alerts', (data: { symbol: string; alerts: Alert[] }) => {
      for (const alert of data.alerts) {
        showAlert(alert)
      }
    })

    socket.on('batch-scores', (data: { symbol: string; score: number; direction: string }[]) => {
      // Merge scores into allPairs
      const current = useStore.getState().allPairs
      const updated = { ...current }
      for (const r of data) {
        if (updated[r.symbol]) {
          updated[r.symbol] = { ...updated[r.symbol], confluenceScore: r.score, signalDirection: r.direction as 'LONG' | 'SHORT' | 'NEUTRO' }
        }
      }
      useStore.setState({ allPairs: updated })
    })

    socket.on('all-pairs-update', (data: BasicPairData[]) => {
      setAllPairs(data)
    })

    socket.on('high-confidence-signal', (data: {
      symbol: string
      direction: 'LONG' | 'SHORT'
      score: number
      price: number
      criticalDecision: string
      timestamp: number
    }) => {
      // Desktop notification
      const settings = useStore.getState().settings
      if (settings.desktopNotifications && 'Notification' in window && Notification.permission === 'granted') {
        const icon = data.direction === 'LONG' ? '🟢' : '🔴'
        new Notification(`${icon} ${data.symbol} - ${data.direction} (${data.score.toFixed(0)}%)`, {
          body: data.criticalDecision,
          tag: `high-conf-${data.symbol}`,
        })
      }

      // Sound alert
      if (settings.soundAlerts) {
        try {
          const ctx = new AudioContext()
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.frequency.value = data.direction === 'LONG' ? 800 : 400
          gain.gain.value = 0.3
          osc.start()
          osc.stop(ctx.currentTime + 0.3)
          setTimeout(() => {
            const osc2 = ctx.createOscillator()
            const gain2 = ctx.createGain()
            osc2.connect(gain2)
            gain2.connect(ctx.destination)
            osc2.frequency.value = data.direction === 'LONG' ? 1000 : 300
            gain2.gain.value = 0.3
            osc2.start()
            osc2.stop(ctx.currentTime + 0.3)
            setTimeout(() => ctx.close().catch(() => {}), 1000)
          }, 300)
        } catch {
          // audio not available
        }
      }

      // Toast notification
      showAlert({
        type: 'full-alignment',
        symbol: data.symbol,
        message: `ALTA CONFIANÇA: ${data.symbol} ${data.direction} — Score ${data.score.toFixed(0)}%`,
        severity: 'critical',
        timestamp: data.timestamp,
      })
    })

    socket.on('custom-alert-triggered', (alert: CustomAlert) => {
      // Toast notification
      showAlert({
        type: 'full-alignment',
        symbol: alert.symbol,
        message: alert.message,
        severity: 'critical',
        timestamp: Date.now(),
      })

      // Desktop notification
      const currentSettings = useStore.getState().settings
      if (currentSettings.desktopNotifications && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(`ALERTA: ${alert.symbol}`, {
            body: alert.message,
            icon: '/favicon.ico',
            tag: `custom-alert-${alert.id}`,
          })
        } catch {
          // Gracefully handle
        }
      }
    })

    socket.on('connection-status', (data: { symbol: string; connected: boolean }) => {
      setConnectionStatus(data.symbol, data.connected)
    })

    socket.on('settings-updated', (data: UserSettings) => {
      setSettings(data)
    })

    socket.on('favorites-updated', (favorites: string[]) => {
      setFavorites(favorites)
    })

    socket.on('plan-limit', (data: { feature: string; message: string }) => {
      showAlert({
        type: 'direction-change',
        symbol: 'PLANO',
        message: data.message,
        severity: 'warning',
        timestamp: Date.now(),
      })
    })

    socket.on('state-snapshot', (data: PairAnalysis[] | {
      analyses: PairAnalysis[]
      openTrades: Trade[]
      globalStats: TradeStats | null
      allPairs?: BasicPairData[]
      favorites?: string[]
      settings?: UserSettings
    }) => {
      if (Array.isArray(data)) {
        setSnapshot(data)
      } else {
        setSnapshot(data.analyses, data.openTrades, data.globalStats, data.allPairs, data.favorites)
        if (data.settings) {
          setSettings(data.settings)
        }
      }
    })

    socket.on('trade-opened', (trade: Trade) => {
      setOpenTrade(trade)
    })

    socket.on('trade-closed', (trade: Trade) => {
      removeOpenTrade(trade.symbol)
    })

    socket.on('trade-recommendation', (data: { symbol: string; recommendation: TradeRecommendation }) => {
      setTradeRecommendation(data.symbol, data.recommendation)
    })

    socket.on('paper-trade-opened', (trade: Trade) => {
      showAlert({
        type: 'full-alignment',
        symbol: trade.symbol,
        message: `Paper Trade: ${trade.direction} ${trade.symbol} @ ${trade.entryPrice}`,
        severity: 'info',
        timestamp: Date.now(),
      })
    })

    socket.on('paper-trade-closed', (trade: Trade) => {
      showAlert({
        type: 'full-alignment',
        symbol: trade.symbol,
        message: `Paper Trade fechado: ${trade.symbol} ${trade.result} ${trade.pnlPercent?.toFixed(2)}%`,
        severity: trade.result === 'WIN' ? 'info' : 'warning',
        timestamp: Date.now(),
      })
    })

    socket.on('order-executed', (result: OrderResult) => {
      showAlert({
        type: 'full-alignment',
        symbol: result.symbol,
        message: result.success
          ? `Ordem executada: ${result.side} ${result.symbol} @ ${result.price}`
          : `Ordem falhou: ${result.symbol} - ${result.error}`,
        severity: result.success ? 'info' : 'critical',
        timestamp: result.timestamp,
      })
    })

    return () => {
      socket?.disconnect()
      socket = null
    }
  }, [authToken, updatePrice, updateAnalysis, setAllPairs, setFavorites, setConnectionStatus, setServerConnected, setSettings, setSnapshot, setOpenTrade, removeOpenTrade, setTradeRecommendation])
}

export function emitToggleFavorite(
  symbol: string,
  callback?: (result: { success: boolean; favorites?: string[]; error?: string }) => void
): void {
  socket?.emit('toggle-favorite', { symbol }, callback)
}

export function emitReplaceFavorite(
  removeSymbol: string,
  addSymbol: string,
  callback?: (result: { success: boolean; favorites?: string[]; error?: string }) => void
): void {
  if (!socket?.connected) {
    callback?.({ success: false, error: 'Conexao em tempo real indisponivel. Recarregue ou faca login novamente.' })
    return
  }

  socket.timeout(12_000).emit(
    'replace-favorite',
    { removeSymbol, addSymbol },
    (err: Error | null, result?: { success: boolean; favorites?: string[]; error?: string }) => {
      if (err) {
        callback?.({ success: false, error: 'Tempo esgotado ao substituir o par. Tente novamente.' })
        return
      }
      callback?.(result ?? { success: false, error: 'Resposta invalida do servidor.' })
    }
  )
}

export function emitAddPair(symbol: string): void {
  socket?.emit('add-pair', { symbol })
}

export function emitRemovePair(symbol: string): void {
  socket?.emit('remove-pair', { symbol })
}

export function emitUpdateSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) {
      reject(new Error('Socket disconnected'))
      return
    }

    socket.emit('update-settings', settings, (response?: { success: boolean; settings?: UserSettings; error?: string }) => {
      if (response?.success && response.settings) {
        resolve(response.settings)
        return
      }
      reject(new Error(response?.error || 'Failed to update settings'))
    })
  })
}

export function emitGetHistory(
  params: { symbol?: string; limit?: number; offset?: number },
  callback: (data: { signals: SignalRecord[]; total: number }) => void
): void {
  socket?.emit('get-history', params, callback)
}

export function emitGetTradeHistory(
  params: { symbol?: string; limit?: number; offset?: number },
  callback: (data: { trades: Trade[]; total: number }) => void
): void {
  socket?.emit('get-trade-history', params, callback)
}

export function emitGetTradeStats(
  params: { symbol?: string },
  callback: (data: TradeStats) => void
): void {
  socket?.emit('get-trade-stats', params, callback)
}

export function emitGetCandles(
  symbol: string,
  callback: (candles: CandleData[]) => void
): void {
  socket?.emit('get-candles', { symbol }, callback)
}

export function emitAnalyzePair(
  symbol: string,
  callback: (analysis: PairAnalysis | null, error?: string) => void
): void {
  socket?.emit('analyze-pair', { symbol }, (response: PairAnalysis | { success: false; error?: string } | null) => {
    if (response && 'success' in response && response.success === false) {
      callback(null, response.error || 'Nao foi possivel analisar o par')
      return
    }
    callback(response as PairAnalysis | null)
  })
}

export function emitRunBacktest(
  params: BacktestParams,
  callback: (result: BacktestResult | null) => void
): void {
  socket?.emit('run-backtest', params, callback)
}

export function emitGetPerformance(
  params: { symbol?: string },
  callback: (data: PerformanceData | null) => void
): void {
  socket?.emit('get-performance', params, callback)
}

export function emitCreateCustomAlert(
  alert: Omit<CustomAlert, 'id' | 'triggered' | 'createdAt'>,
  callback: (alert: CustomAlert | null) => void
): void {
  socket?.emit('create-custom-alert', alert, callback)
}

export function emitDeleteCustomAlert(id: string): void {
  socket?.emit('delete-custom-alert', { id })
}

export function emitExecuteOrder(
  order: OrderRequest,
  callback: (result: OrderResult) => void
): void {
  socket?.emit('execute-order', order, callback)
}

export function emitGetPaperTrades(
  params: { symbol?: string; limit?: number; offset?: number },
  callback: (data: { trades: Trade[]; total: number }) => void
): void {
  socket?.emit('get-paper-trades', params, callback)
}

export function emitGetPaperStats(
  params: { symbol?: string },
  callback: (data: TradeStats) => void
): void {
  socket?.emit('get-paper-stats', params, callback)
}

export function emitTestTelegram(
  callback: (result: { success: boolean; error?: string }) => void
): void {
  socket?.emit('test-telegram', {}, callback)
}
