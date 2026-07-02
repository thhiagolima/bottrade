import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../../.env') })

export const config = {
  exchange: {
    provider: (process.env.EXCHANGE_PROVIDER || 'binance').toLowerCase() as 'binance' | 'bybit',
  },
  db: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'bottrade',
  },
  port: parseInt(process.env.PORT || '3001', 10),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  binance: {
    wsBaseUrl: process.env.BINANCE_WS_URL || 'wss://fstream.binance.com/stream',
    restBaseUrl: process.env.BINANCE_REST_URL || 'https://fapi.binance.com',
    restTimeout: 10_000,
    restMaxRetries: 3,
    altRestUrls: [
      'https://fapi1.binance.com',
      'https://fapi2.binance.com',
      'https://fapi3.binance.com',
      'https://fapi4.binance.com',
    ] as readonly string[],
    altWsUrls: [
      'wss://fstream1.binance.com/stream',
      'wss://fstream2.binance.com/stream',
      'wss://fstream3.binance.com/stream',
      'wss://fstream4.binance.com/stream',
      'wss://stream.binancefuture.com/stream',
    ] as readonly string[],
  },
  bybit: {
    restBaseUrl: process.env.BYBIT_REST_URL || 'https://api.bybit.com',
    wsBaseUrl: process.env.BYBIT_WS_URL || 'wss://stream.bybit.com/v5/public/linear',
    category: process.env.BYBIT_CATEGORY || 'linear',
    restTimeout: 10_000,
    restMaxRetries: 3,
    tickersRefreshMs: 10_000,
  },
  ws: {
    reconnectBaseDelay: 1000,
    reconnectMaxDelay: 30_000,
    pingInterval: 30_000,
  },
  candles: {
    bufferSize: 250,
    minForSignals: 200,
    interval: '15m' as const,
    historyLimit: 200,
  },
  defaults: {
    baseCapital: 100,
    leverage: 5,
    fundingThreshold: 0.05,
    stochRsiHighThreshold: 90,
    stochRsiLowThreshold: 10,
    soundAlerts: true,
    desktopNotifications: false,
    pairs: ['ETHUSDT', 'BTCUSDT'],
    favorites: ['ETHUSDT', 'BTCUSDT'],
    telegramBotToken: '',
    telegramChatId: '',
  },
} as const
