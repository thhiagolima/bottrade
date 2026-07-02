import logger from './logger.js'
import express from 'express'
import helmet from 'helmet'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { clerkClient, clerkMiddleware, getAuth, verifyToken as verifyClerkToken } from '@clerk/express'
import { config } from './config.js'
import { initAuthTables, registerUser, loginUser, getUserById, generateResetToken, resetPassword, getOrCreateUserFromClerk } from './auth.js'
import { encrypt, tryDecrypt, maskSecret } from './crypto.js'
import { initAuditTable, logAudit } from './auditLog.js'
import { validate, updateSettingsSchema, executeOrderSchema, backtestParamsSchema, createAlertSchema, paginationSchema, registerSchema, loginSchema, analyzePairSchema, toggleFavoriteSchema, symbolOnlySchema, deleteAlertSchema } from './validation.js'
import { pool, initDatabase, initUserSettingsTable, defaultSettings, saveSignal, updateSettings, getUserSettings, updateUserSettings, getHistory, flushBuffer, getPerformanceData, cleanupExpiredTokens } from './database.js'
import { calculateIndicators } from './calculator.js'
import { generateSignal, detectAlerts } from './signals.js'
import { BinanceWSManager } from './wsManager.js'
import { TradeTracker } from './tradeTracker.js'
import { calculateAllHeatScores } from './heatScore.js'
import { runBacktest } from './backtester.js'
import { getMultiTimeframeData } from './multiTimeframe.js'
import { sendTelegramMessage, sendTestMessage, formatSignalMessage, formatTradeClosedMessage } from './telegram.js'
import { placeMarketOrder } from './binanceOrders.js'
import { fetchExternalData } from './externalData.js'
import { runBatchScoring } from './batchScorer.js'
import { fetchExchangeSymbols, fetchMarketCandles, fetchTickerSnapshot, getExchangeName } from './exchangeMarket.js'
import { checkFeature, getAdminPlanConfigs, getPlanLimits, saveAdminPlanConfig } from './planGating.js'
import { PaperTradeTracker } from './paperTradeTracker.js'
import { initStripe, isStripeConfigured, createCheckoutSession, createPortalSession, handleWebhook } from './stripe.js'
import { initEmail, isEmailConfigured, sendWelcomeEmail, sendTradeNotification, sendPasswordResetEmail } from './email.js'
import { sendWebhook } from './webhooks.js'
import { resolveStrategySettings } from './strategyProfiles.js'
import type { WebhookConfig } from './webhooks.js'
import type { PairAnalysis, IndicatorValues, SignalData, PriceData, UserSettings, Trade, BasicPairData, HeatScore, BacktestParams, CandleData, TimeframeAnalysis, CustomAlert, OrderRequest, OrderResult } from '@bottrade/shared'
import type { AuthUser } from './auth.js'

async function syncClerkUser(clerkUserId: string): Promise<AuthUser> {
  const clerkUser = await clerkClient.users.getUser(clerkUserId)
  const email = clerkUser.primaryEmailAddress?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress
  if (!email) {
    throw new Error('Clerk user does not have an email address')
  }

  const name = clerkUser.fullName || [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || email.split('@')[0]
  return getOrCreateUserFromClerk({ clerkUserId, email, name })
}

async function requireLocalUser(req: express.Request, res: express.Response): Promise<AuthUser | null> {
  const auth = getAuth(req)
  let clerkUserId = auth.userId

  if (!auth.isAuthenticated || !clerkUserId) {
    const authHeader = req.headers.authorization
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null
    if (token) {
      try {
        const payload = await verifyClerkToken(token, {
          secretKey: process.env.CLERK_SECRET_KEY,
        })
        clerkUserId = payload.sub
      } catch (err) {
        console.error('[Clerk] HTTP auth failed:', (err as Error).message)
      }
    }
  }

  if (!clerkUserId) {
    res.status(401).json({ error: 'User not authenticated' })
    return null
  }

  try {
    return await syncClerkUser(clerkUserId)
  } catch (err) {
    console.error('[Clerk] Failed to sync user:', (err as Error).message)
    res.status(401).json({ error: 'Unable to load authenticated user' })
    return null
  }
}

async function requireSocketUser(token: string): Promise<AuthUser | null> {
  try {
    const payload = await verifyClerkToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    })
    const clerkUserId = payload.sub
    if (!clerkUserId) return null
    return syncClerkUser(clerkUserId)
  } catch (err) {
    console.error('[Clerk] Socket auth failed:', (err as Error).message)
    return null
  }
}

// ── Decrypt helpers (on-demand, never store plaintext in memory) ─────────────
function decryptApiKeys(settings: UserSettings): { apiKey: string; apiSecret: string } {
  return {
    apiKey: settings.binanceApiKey ? tryDecrypt(settings.binanceApiKey) : '',
    apiSecret: settings.binanceApiSecret ? tryDecrypt(settings.binanceApiSecret) : '',
  }
}

function decryptTelegramKeys(settings: UserSettings): { botToken: string; chatId: string } {
  return {
    botToken: settings.telegramBotToken ? tryDecrypt(settings.telegramBotToken) : '',
    chatId: settings.telegramChatId ? tryDecrypt(settings.telegramChatId) : '',
  }
}

// ── State ────────────────────────────────────────────────────────────────────
const state = new Map<string, PairAnalysis>()
const prevIndicators = new Map<string, IndicatorValues>()
const prevSignals = new Map<string, SignalData>()
const lastEmitTimestamp = new Map<string, number>()

const PRICE_UPDATE_THROTTLE_MS = 1000
const ALL_PAIRS_THROTTLE_MS = 2000
let lastAllPairsEmit = 0

const FALLBACK_USDT_PAIRS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT',
  'LINKUSDT', 'DOTUSDT', 'LTCUSDT', 'BCHUSDT', 'UNIUSDT', 'AAVEUSDT', 'ATOMUSDT', 'NEARUSDT',
  'ARBUSDT', 'OPUSDT', 'INJUSDT', 'APTUSDT', 'SUIUSDT', 'FILUSDT', 'ETCUSDT', 'TRXUSDT',
]

// Circuit breaker constants for auto-trade
const MAX_DAILY_LOSSES = 5
const MAX_DAILY_TRADES = 20
const DAY_MS = 24 * 60 * 60 * 1000

// ── Per-User Session State ──────────────────────────────────────────────────
interface UserSession {
  userId: number
  settings: UserSettings
  favorites: string[]
  tradeTracker: TradeTracker
  paperTracker: PaperTradeTracker
  sockets: Set<string>
  dailyLossCount: number
  dailyTradeCount: number
  lastDailyReset: number
}

const userSessions = new Map<number, UserSession>()

async function getOrCreateSession(userId: number, io: Server): Promise<UserSession> {
  let session = userSessions.get(userId)
  if (session) return session

  // Load user-specific data from DB
  const settings = await getUserSettings(userId)

  // API keys stay encrypted in memory — decrypt only at moment of use

  const favorites = settings.favorites && settings.favorites.length > 0
    ? settings.favorites
    : [...config.defaults.favorites]

  // Create per-user trade trackers
  const tradeTracker = new TradeTracker()
  tradeTracker.userId = userId
  await tradeTracker.init()

  const paperTracker = new PaperTradeTracker()
  paperTracker.userId = userId
  await paperTracker.init()

  // Load circuit breaker state from settings JSON (if persisted)
  const cbState = (settings as any).circuitBreaker ?? {}
  const cbLastReset = typeof cbState.lastDailyReset === 'number' ? cbState.lastDailyReset : Date.now()
  const cbExpired = Date.now() - cbLastReset > DAY_MS
  session = {
    userId,
    settings,
    favorites,
    tradeTracker,
    paperTracker,
    sockets: new Set(),
    dailyLossCount: cbExpired ? 0 : (cbState.dailyLossCount ?? 0),
    dailyTradeCount: cbExpired ? 0 : (cbState.dailyTradeCount ?? 0),
    lastDailyReset: cbExpired ? Date.now() : cbLastReset,
  }

  // Wire trade tracker events to user's room
  tradeTracker.on('trade-opened', (trade: Trade) => {
    io.to(`user:${userId}`).emit('trade-opened', trade)
    if (session.settings.webhooks) {
      for (const wh of session.settings.webhooks) {
        sendWebhook(wh, 'trade_opened', {
          symbol: trade.symbol, direction: trade.direction,
          entryPrice: trade.entryPrice, stopLoss: trade.stopLoss, takeProfit: trade.takeProfit,
        }).catch(() => {})
      }
    }
  })
  tradeTracker.on('trade-closed', (trade: Trade) => {
    io.to(`user:${userId}`).emit('trade-closed', trade)
    if (trade.result === 'LOSS') {
      session.dailyLossCount++
    }
    // Persist circuit breaker state
    updateUserSettings(userId, {
      circuitBreaker: {
        dailyLossCount: session.dailyLossCount,
        dailyTradeCount: session.dailyTradeCount,
        lastDailyReset: session.lastDailyReset,
      }
    } as any).catch(() => {})
    if (trade.result) {
      const { botToken, chatId } = decryptTelegramKeys(session.settings)
      if (botToken && chatId) {
        sendTelegramMessage(formatTradeClosedMessage({
          symbol: trade.symbol,
          direction: trade.direction,
          result: trade.result,
          pnlPercent: trade.pnlPercent ?? 0,
          entryPrice: trade.entryPrice,
          exitPrice: trade.exitPrice ?? 0,
        }), botToken, chatId).catch(() => {})
      }
    }
    if (session.settings.webhooks) {
      for (const wh of session.settings.webhooks) {
        sendWebhook(wh, 'trade_closed', {
          symbol: trade.symbol, direction: trade.direction,
          result: trade.result, pnl: trade.pnlPercent,
          entryPrice: trade.entryPrice, exitPrice: trade.exitPrice,
        }).catch(() => {})
      }
    }
  })
  tradeTracker.on('trade-recommendation', (data: { symbol: string; recommendation: unknown }) => {
    io.to(`user:${userId}`).emit('trade-recommendation', data)
  })
  tradeTracker.on('entry-check', (data: { symbol: string; check: import('@bottrade/shared').EntryCheckResult }) => {
    const analysis = state.get(data.symbol)
    if (analysis) {
      analysis.entryCheck = data.check
    }
    io.to(`user:${userId}`).emit('entry-check', data)
  })
  tradeTracker.on('trade-partial', (data: { symbol: string; trade: unknown; message: string }) => {
    io.to(`user:${userId}`).emit('trade-partial', data)
  })

  // Wire paper trade events to user's room
  paperTracker.on('paper-trade-opened', (trade: Trade) => { io.to(`user:${userId}`).emit('paper-trade-opened', trade) })
  paperTracker.on('paper-trade-closed', (trade: Trade) => { io.to(`user:${userId}`).emit('paper-trade-closed', trade) })
  paperTracker.on('paper-trade-partial', (data: unknown) => { io.to(`user:${userId}`).emit('paper-trade-partial', data) })

  userSessions.set(userId, session)
  logger.info({ userId, favoritesCount: favorites.length }, 'Session created')
  return session
}

function removeSession(userId: number): void {
  const session = userSessions.get(userId)
  if (session) {
    session.tradeTracker.removeAllListeners()
    session.paperTracker.removeAllListeners()
  }
  userSessions.delete(userId)
  console.log(`[Session] Removed session for user ${userId}`)
}

// Sanitize settings before sending to clients (mask secrets)
function sanitizeSettings(settings: any): any {
  if (!settings) return settings
  return {
    ...settings,
    binanceApiKey: maskSecret(settings.binanceApiKey),
    binanceApiSecret: maskSecret(settings.binanceApiSecret),
    telegramBotToken: maskSecret(settings.telegramBotToken),
    telegramChatId: settings.telegramChatId ? maskSecret(settings.telegramChatId) : '',
  }
}

// ── Bootstrap ────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // 1. Init database
  await initDatabase()
  await initAuthTables()
  await initUserSettingsTable()
  await initAuditTable()
  initStripe()
  initEmail()

  // 2. Use default settings for initial wsManager bootstrap (no user context at boot)
  const settings: UserSettings = { ...defaultSettings, pairs: [...defaultSettings.pairs], favorites: [...defaultSettings.favorites] }

  // 3. Create Express + HTTP + Socket.io
  const app = express()

  app.use(clerkMiddleware())

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        connectSrc: ["'self'", "ws:", "wss:", "https://api.clerk.com", "https://*.clerk.accounts.dev", "https://*.clerk.com", "https://fapi.binance.com", "https://fapi1.binance.com", "https://fapi2.binance.com", "https://api.bybit.com", "https://api-testnet.bybit.com", "https://api.alternative.me"],
        frameSrc: ["'self'", "https://*.clerk.accounts.dev", "https://*.clerk.com"],
        imgSrc: ["'self'", "data:", "blob:", "https://img.clerk.com"],
      }
    }
  }))

  // Rate limiting for REST endpoints
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { error: 'Too many requests' }
  })
  app.use('/api/', apiLimiter)

  // Stripe webhook (must be before json parser — needs raw body)
  app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'] as string
    const result = await handleWebhook(req.body, sig)
    res.status(result.success ? 200 : 400).json(result)
  })

  // JSON body parser for REST
  app.use(express.json())

  const httpServer = createServer(app)
  const io = new Server(httpServer, {
    cors: { origin: config.clientOrigin },
    maxHttpBufferSize: 64 * 1024, // 64KB max message size
  })

  // 4. Create WS manager with favorite pairs
  const favoritePairs = settings.favorites ?? settings.pairs
  const wsManager = new BinanceWSManager(favoritePairs)

  // Global fallback settings (used for wsManager init and when no user session exists)
  let cachedSettings: UserSettings = settings

  // ── REST endpoints ──────────────────────────────────────────────────────

  // Health check (no auth required)
  app.get('/health', async (_req, res) => {
    try {
      await pool.execute('SELECT 1')
      res.json({ status: 'ok', timestamp: new Date().toISOString() })
    } catch {
      res.status(503).json({ status: 'unhealthy', timestamp: new Date().toISOString() })
    }
  })

  // Auth routes
  app.post('/api/auth/register', async (req, res) => {
    const v = validate(registerSchema, req.body)
    if (!v.success) return res.status(400).json({ error: v.error })
    const result = await registerUser(v.data.email, v.data.name, v.data.password)
    if (!result.success) return res.status(400).json({ error: result.error })
    await logAudit({ userId: result.user!.id, action: 'USER_REGISTER', details: { email: v.data.email }, ip: req.ip })
    sendWelcomeEmail(v.data.email, v.data.name).catch(() => {})
    res.json({ user: result.user, token: result.token })
  })

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyGenerator: (req) => {
      const email = ((req.body as any)?.email || '').toLowerCase().trim()
      const ipKey = req.ip ? ipKeyGenerator(req.ip) : 'unknown'
      return `${email}:${ipKey}`
    },
    message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
  })

  app.post('/api/auth/login', loginLimiter, async (req, res) => {
    const v = validate(loginSchema, req.body)
    if (!v.success) return res.status(400).json({ error: v.error })
    const result = await loginUser(v.data.email, v.data.password)
    if (!result.success) {
      await logAudit({ userId: null, action: 'USER_LOGIN_FAILED', details: { email: v.data.email }, ip: req.ip })
      return res.status(401).json({ error: result.error })
    }
    await logAudit({ userId: result.user!.id, action: 'USER_LOGIN', details: { email: v.data.email }, ip: req.ip })
    res.json({ user: result.user, token: result.token })
  })

  app.get('/api/auth/me', async (req, res) => {
    const user = await requireLocalUser(req, res)
    if (!user) return
    res.json({ user })
  })

  app.post('/api/auth/logout', async (_req, res) => {
    res.json({ success: true })
  })

  // POST /api/auth/forgot-password
  const forgotPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 3,
    keyGenerator: (req) => req.body?.email || (req.ip ? ipKeyGenerator(req.ip) : 'unknown'),
    message: { error: 'Muitas tentativas. Aguarde 15 minutos.' },
  })

  app.post('/api/auth/forgot-password', forgotPasswordLimiter, async (req, res) => {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'Email obrigatório' })

    const token = await generateResetToken(email)
    if (token) {
      sendPasswordResetEmail(email, token).catch(() => {})
    }
    // Always return success to prevent email enumeration
    res.json({ message: 'Se o email existir, enviaremos as instruções de redefinição.' })
  })

  app.post('/api/auth/reset-password', async (req, res) => {
    const { token, password } = req.body
    if (!token || !password) return res.status(400).json({ error: 'Token e senha obrigatórios' })

    const result = await resetPassword(token, password)
    if (!result.success) return res.status(400).json({ error: result.error })

    await logAudit({ userId: result.user!.id, action: 'PASSWORD_RESET', details: {}, ip: req.ip })
    res.json({ user: result.user, token: result.token })
  })

  // ── GDPR Endpoints ─────────────────────────────────────────────────────

  // GET /api/account/export — export all user data (GDPR)
  app.get('/api/account/export', async (req, res) => {
    const authUser = await requireLocalUser(req, res)
    if (!authUser) return
    const userId = authUser.id
    const [user] = await pool.execute('SELECT id, email, name, role, plan, created_at FROM users WHERE id = ?', [userId]) as any
    const [trades] = await pool.execute('SELECT * FROM trades WHERE user_id = ?', [userId]) as any
    const [paperTrades] = await pool.execute('SELECT * FROM paper_trades WHERE user_id = ?', [userId]) as any
    const [signals] = await pool.execute('SELECT * FROM signals WHERE user_id = ? ORDER BY created_at DESC LIMIT 1000', [userId]) as any
    const [settings] = await pool.execute('SELECT settings FROM user_settings WHERE user_id = ?', [userId]) as any
    const [auditLog] = await pool.execute('SELECT * FROM audit_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 500', [userId]) as any

    res.json({
      exportDate: new Date().toISOString(),
      user: user[0] || null,
      settings: settings[0]?.settings ? JSON.parse(settings[0].settings) : null,
      trades,
      paperTrades,
      signals,
      auditLog
    })
  })

  // DELETE /api/account — delete account (GDPR right to deletion)
  app.delete('/api/account', async (req, res) => {
    const authUser = await requireLocalUser(req, res)
    if (!authUser) return
    const userId = authUser.id
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      await conn.execute('DELETE FROM audit_log WHERE user_id = ?', [userId])
      await conn.execute('DELETE FROM paper_trades WHERE user_id = ?', [userId])
      await conn.execute('DELETE FROM trades WHERE user_id = ?', [userId])
      await conn.execute('DELETE FROM signals WHERE user_id = ?', [userId])
      await conn.execute('DELETE FROM user_settings WHERE user_id = ?', [userId])
      await conn.execute('DELETE FROM users WHERE id = ?', [userId])
      await conn.commit()

      if (authUser.clerkUserId) {
        await clerkClient.users.deleteUser(authUser.clerkUserId).catch((err: Error) => {
          console.error('[Clerk] Failed to delete user:', err.message)
        })
      }

      // Disconnect all WebSocket sessions for this user
      const session = userSessions.get(userId)
      if (session) {
        for (const socketId of session.sockets) {
          const sock = io.sockets.sockets.get(socketId)
          if (sock) sock.disconnect(true)
        }
        userSessions.delete(userId)
      }

      await logAudit({ userId: null, action: 'ACCOUNT_DELETED', details: { deletedUserId: userId } })
      res.json({ success: true, message: 'Conta e todos os dados deletados' })
    } catch (err) {
      await conn.rollback()
      console.error('[Account] Delete failed:', (err as Error).message)
      res.status(500).json({ error: 'Erro ao deletar conta' })
    } finally {
      conn.release()
    }
  })

  // Stripe checkout
  app.post('/api/stripe/checkout', async (req, res) => {
    const authUser = await requireLocalUser(req, res)
    if (!authUser) return

    if (!isStripeConfigured()) return res.status(503).json({ error: 'Pagamentos não configurados' })

    const { plan, billing, coupon } = req.body
    if (!plan || !['pro', 'trader'].includes(plan)) return res.status(400).json({ error: 'Plano inválido' })

    const result = await createCheckoutSession({
      userId: authUser.id,
      email: authUser.email,
      plan,
      billing: billing === 'annual' ? 'annual' : 'monthly',
      successUrl: `${config.clientOrigin}?payment=success`,
      cancelUrl: `${config.clientOrigin}?payment=cancelled`,
      coupon: typeof coupon === 'string' ? coupon : undefined,
    })

    if (!result.url) return res.status(500).json({ error: result.error })
    res.json({ url: result.url })
  })

  // Stripe customer portal
  app.post('/api/stripe/portal', async (req, res) => {
    const authUser = await requireLocalUser(req, res)
    if (!authUser) return

    if (!isStripeConfigured()) return res.status(503).json({ error: 'Pagamentos não configurados' })

    const user = await getUserById(authUser.id)
    if (!user?.stripe_customer_id) return res.status(400).json({ error: 'Nenhuma assinatura ativa' })

    const result = await createPortalSession(user.stripe_customer_id, config.clientOrigin)
    if (!result.url) return res.status(500).json({ error: result.error })
    res.json({ url: result.url })
  })

  // ── Admin middleware ───────────────────────────────────────────────────
  async function requireAdmin(req: any, res: any, next: any) {
    const user = await requireLocalUser(req, res)
    if (!user) return
    if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
    req.userId = user.id
    next()
  }

  // GET /api/admin/users — list all users with stats
  app.get('/api/admin/users', requireAdmin, async (req: any, res: any) => {
    try {
      try {
        const clerkResponse = await clerkClient.users.getUserList({ limit: 100 })
        const clerkUsers = Array.isArray(clerkResponse) ? clerkResponse : clerkResponse.data
        for (const clerkUser of clerkUsers) {
          const email = clerkUser.primaryEmailAddress?.emailAddress || clerkUser.emailAddresses?.[0]?.emailAddress
          if (!email) continue
          const name = clerkUser.fullName || [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || email.split('@')[0]
          await getOrCreateUserFromClerk({ clerkUserId: clerkUser.id, email, name })
        }
      } catch (err) {
        console.error('[Admin] Error syncing Clerk users:', (err as Error).message)
      }

      const [rows] = await pool.execute(`
        SELECT u.id, u.email, u.name, u.role, u.plan, u.plan_expires_at, u.is_active, u.last_login, u.created_at,
          (SELECT COUNT(*) FROM trades WHERE user_id = u.id) as trade_count,
          (SELECT COUNT(*) FROM trades WHERE user_id = u.id AND result = 'WIN') as win_count
        FROM users u ORDER BY u.created_at DESC
      `)
      res.json({ users: rows })
    } catch (err) {
      console.error('[Admin] Error fetching users:', (err as Error).message)
      res.status(500).json({ error: 'Failed to fetch users' })
    }
  })

  // GET /api/admin/stats — platform metrics
  app.get('/api/admin/stats', requireAdmin, async (req: any, res: any) => {
    try {
      const [[userStats]] = await pool.execute('SELECT COUNT(*) as total, SUM(plan = "pro") as pro, SUM(plan = "trader") as trader FROM users') as any
      const [[tradeStats]] = await pool.execute('SELECT COUNT(*) as total, SUM(result = "WIN") as wins FROM trades') as any
      const [[signalStats]] = await pool.execute('SELECT COUNT(*) as total FROM signals WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)') as any
      const activeUsers = userSessions.size
      res.json({ users: userStats, trades: tradeStats, signals: signalStats, activeUsers })
    } catch (err) {
      console.error('[Admin] Error fetching stats:', (err as Error).message)
      res.status(500).json({ error: 'Failed to fetch stats' })
    }
  })

  app.get('/api/plans', async (_req, res) => {
    const plans = await getAdminPlanConfigs()
    res.json({ plans: [plans.free, plans.pro, plans.trader] })
  })

  app.get('/api/admin/plans', requireAdmin, async (_req: any, res: any) => {
    const plans = await getAdminPlanConfigs()
    res.json({ plans: [plans.free, plans.pro, plans.trader] })
  })

  app.post('/api/admin/plans', requireAdmin, async (req: any, res: any) => {
    try {
      const plans = await saveAdminPlanConfig(req.body.plan)
      await logAudit({ userId: req.userId, action: 'SETTINGS_UPDATE', details: { type: 'plan_config', plan: req.body.plan?.name } })
      res.json({ success: true, plans: [plans.free, plans.pro, plans.trader] })
    } catch (err) {
      console.error('[Admin] Error saving plan:', (err as Error).message)
      res.status(400).json({ error: 'Failed to save plan' })
    }
  })

  // PATCH /api/admin/users/:id — update user (plan, role, active)
  app.patch('/api/admin/users/:id', requireAdmin, async (req: any, res: any) => {
    try {
      const { plan, role, is_active } = req.body
      const userId = parseInt(req.params.id)
      if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' })

      const updates: string[] = []
      const values: any[] = []
      if (plan && ['free', 'pro', 'trader'].includes(plan)) { updates.push('plan = ?'); values.push(plan) }
      if (role && ['user', 'admin'].includes(role)) { updates.push('role = ?'); values.push(role) }
      if (typeof is_active === 'boolean') { updates.push('is_active = ?'); values.push(is_active) }
      if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' })

      values.push(userId)
      await pool.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values)
      await logAudit({ userId: req.userId, action: 'SETTINGS_UPDATE', details: { target: userId, changes: req.body } })
      res.json({ success: true })
    } catch (err) {
      console.error('[Admin] Error updating user:', (err as Error).message)
      res.status(500).json({ error: 'Failed to update user' })
    }
  })

  // GET /api/admin/audit — audit log
  app.get('/api/admin/audit', requireAdmin, async (req: any, res: any) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200)
      const offset = parseInt(req.query.offset as string) || 0
      const [rows] = await pool.execute(
        'SELECT a.*, u.email as user_email FROM audit_log a LEFT JOIN users u ON a.user_id = u.id ORDER BY a.created_at DESC LIMIT ? OFFSET ?',
        [limit, offset]
      )
      res.json({ logs: rows })
    } catch (err) {
      console.error('[Admin] Error fetching audit log:', (err as Error).message)
      res.status(500).json({ error: 'Failed to fetch audit log' })
    }
  })

  app.get('/api/admin/health', requireAdmin, async (_req: any, res: any) => {
    try {
      await pool.execute('SELECT 1')
      const wsStatus = wsManager.getConnectionStatus()
      res.json({
        status: 'ok',
        uptime: process.uptime(),
        memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        db: 'connected',
        ws: wsStatus,
        users: userSessions.size,
        timestamp: new Date().toISOString(),
      })
    } catch (err) {
      res.status(503).json({ status: 'unhealthy', error: (err as Error).message })
    }
  })

  app.get('/api/pairs', async (_req, res) => {
    const symbols = await fetchExchangeSymbols()
    if (symbols.length > 0) {
      res.json(symbols)
      return
    }
    res.json(FALLBACK_USDT_PAIRS)
  })

  // ── Public demo endpoint (no auth, rate limited) ───────────────────────
  const demoLimiter = rateLimit({ windowMs: 60000, max: 30, message: { error: 'Too many demo requests' } })

  app.get('/api/demo/analyze/:symbol', demoLimiter, async (req, res) => {
    const symbol = (req.params.symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!symbol || symbol.length > 20) return res.status(400).json({ error: 'Invalid symbol' })

    try {
      const candles = await fetchMarketCandles(symbol, '15m', 200)

      if (candles.length < 50) return res.status(404).json({ error: 'Pair not found or insufficient data' })

      const indicators = calculateIndicators(candles, null)
      const lastCandle = candles[candles.length - 1]
      const price: import('@bottrade/shared').PriceData = {
        symbol, price: lastCandle.close, markPrice: lastCandle.close,
        change24h: ((lastCandle.close - candles[Math.max(0, candles.length - 96)].close) / candles[Math.max(0, candles.length - 96)].close) * 100,
        volume24h: candles.slice(-96).reduce((s, c) => s + c.volume, 0),
        fundingRate: 0, fundingCountdown: '',
      }
      const signal = generateSignal(indicators, price, defaultSettings, undefined)

      res.json({
        symbol,
        price: lastCandle.close,
        change24h: price.change24h,
        volume24h: price.volume24h,
        indicators: {
          ma20: indicators.ma20, ma50: indicators.ma50, ma100: indicators.ma100, ma200: indicators.ma200,
          ema20: indicators.ema20, ema50: indicators.ema50,
          macd: indicators.macd, stochRsi: indicators.stochRsi, rsi: indicators.rsi,
          bollingerBands: indicators.bollingerBands, atr: indicators.atr, adx: indicators.adx, vwap: indicators.vwap,
        },
        signal: {
          direction: signal.direction, confluenceScore: signal.confluenceScore,
          confidence: signal.confidence, criticalDecision: signal.criticalDecision,
          actionPoints: signal.actionPoints,
          riskManagement: signal.riskManagement,
        },
      })
    } catch (err) {
      res.status(500).json({ error: 'Analysis failed' })
    }
  })

  // ── Public feed: recent signals (for landing page) ──────────────────────
  const recentPublicSignals: Array<{ symbol: string; direction: string; score: number; confidence: string; timestamp: number }> = []
  const MAX_PUBLIC_SIGNALS = 20

  function addPublicSignal(symbol: string, direction: string, score: number, confidence: string) {
    recentPublicSignals.unshift({ symbol, direction, score, confidence, timestamp: Date.now() })
    if (recentPublicSignals.length > MAX_PUBLIC_SIGNALS) recentPublicSignals.length = MAX_PUBLIC_SIGNALS
  }

  app.get('/api/demo/feed', demoLimiter, async (_req, res) => {
    let totalUsers = 0
    try {
      const [[row]] = await pool.execute('SELECT COUNT(*) as cnt FROM users') as any
      totalUsers = row?.cnt || 0
    } catch { /* keep 0 */ }

    res.json({
      signals: recentPublicSignals,
      stats: {
        totalUsers,
        signalsToday: recentPublicSignals.filter(s => Date.now() - s.timestamp < 86400000).length,
        activeNow: userSessions.size,
      }
    })
  })

  // ── wsManager events ─────────────────────────────────────────────────────

  wsManager.on('candle-closed', async ({ symbol, candles }: { symbol: string; candles: unknown[] }) => {
    try {
      const prev = prevIndicators.get(symbol)
      const currentSettings = cachedSettings
      const indicators = calculateIndicators(candles as import('@bottrade/shared').CandleData[], prev, currentSettings.indicatorPeriods)
      const prevSignal = prevSignals.get(symbol)
      const priceData = wsManager.getPriceData(symbol)
      if (!priceData) return

      const signal = generateSignal(indicators, priceData, currentSettings, prevSignal)
      const alerts = detectAlerts(signal, prevSignal, indicators, priceData, currentSettings)
      signal.alerts = alerts

      const analysis: PairAnalysis = {
        symbol,
        candles: wsManager.getCandles(symbol).slice(-100),
        indicators,
        price: priceData,
        signal,
        lastUpdate: Date.now(),
      }

      // Multi-timeframe analysis
      try {
        const tf15m: TimeframeAnalysis = {
          interval: '15m',
          direction: signal.direction,
          score: signal.confluenceScore,
          trend: signal.direction === 'LONG' ? 'Bullish' : signal.direction === 'SHORT' ? 'Bearish' : 'Lateral',
          keyLevels: { ma20: indicators.ma20, ma50: indicators.ma50, ma200: indicators.ma200 },
        }
        const mtfData = await getMultiTimeframeData(symbol, tf15m, currentSettings)
        analysis.multiTimeframe = mtfData
      } catch (err) {
        console.error(`[Server] Multi-timeframe error for ${symbol}:`, (err as Error).message)
      }

      // External data (OI, Long/Short, Fear&Greed)
      try {
        const extData = await fetchExternalData(symbol)
        analysis.externalData = extData
      } catch (err) {
        console.error(`[Server] External data error for ${symbol}:`, (err as Error).message)
      }

      // BTC correlation for altcoins
      if (symbol !== 'BTCUSDT') {
        const btcAnalysis = state.get('BTCUSDT')
        const btcSignal = btcAnalysis?.signal ?? prevSignals.get('BTCUSDT')
        if (btcSignal) {
          const btcDir = btcSignal.direction
          const altDir = signal.direction
          const isConflict = (btcDir === 'LONG' && altDir === 'SHORT') || (btcDir === 'SHORT' && altDir === 'LONG')
          analysis.btcCorrelation = {
            btcDirection: btcDir,
            btcScore: btcSignal.confluenceScore,
            aligned: !isConflict,
            warning: isConflict ? `Contra BTC — BTC está ${btcDir} (score: ${btcSignal.confluenceScore.toFixed(0)})` : null,
          }
        }
      }

      state.set(symbol, analysis)

      prevIndicators.set(symbol, indicators)
      prevSignals.set(symbol, signal)

      // Per-user: generate signal with user's settings, check trades, emit to user rooms
      for (const [uid, session] of userSessions) {
        if (!session.favorites.includes(symbol)) continue

        // Generate signal with this user's effective pair settings
        const effectiveSettings = resolveStrategySettings(session.settings, symbol, 'live')
        const userSignal = generateSignal(indicators, priceData, effectiveSettings, prevSignal)
        const userAlerts = detectAlerts(userSignal, prevSignal, indicators, priceData, effectiveSettings)
        userSignal.alerts = userAlerts

        // Build user-specific analysis (shares base data, user-specific signal)
        const userAnalysis: PairAnalysis = { ...analysis, signal: userSignal }

        await saveSignal(uid, symbol, userSignal, indicators)

        // Check trade tracking for this user
        try {
          await session.tradeTracker.checkSignalForTrade(symbol, userSignal, priceData.price, indicators, priceData, effectiveSettings, analysis.multiTimeframe, analysis.externalData)
        } catch (err) {
          logger.error({ err, userId: uid, symbol }, 'TradeTracker error')
        }

        logger.info({ symbol, userId: uid, direction: userSignal.direction, score: userSignal.confluenceScore, confidence: userSignal.confidence }, 'Signal generated')

        io.to(`user:${uid}`).emit('analysis-update', userAnalysis)

        if (userAlerts.length > 0) {
          io.to(`user:${uid}`).emit('alerts', { symbol, alerts: userAlerts })
        }

        // Public feed + High confidence notification (per-user)
        if (userSignal.direction !== 'NEUTRO') {
          addPublicSignal(symbol, userSignal.direction, userSignal.confluenceScore, userSignal.confidence || 'normal')
        }
        if (userSignal.confidence === 'high' && userSignal.direction !== 'NEUTRO') {
          io.to(`user:${uid}`).emit('high-confidence-signal', {
            symbol,
            direction: userSignal.direction,
            score: userSignal.confluenceScore,
            price: priceData.price,
            criticalDecision: userSignal.criticalDecision,
            timestamp: Date.now(),
          })

          {
            const { botToken, chatId } = decryptTelegramKeys(session.settings)
            if (botToken && chatId) {
              sendTelegramMessage(formatSignalMessage({
                symbol,
                direction: userSignal.direction as 'LONG' | 'SHORT',
                score: userSignal.confluenceScore,
                price: priceData.price,
                stopLoss: userSignal.riskManagement?.stopLoss,
                takeProfit: userSignal.riskManagement?.takeProfit,
                criticalDecision: userSignal.criticalDecision,
              }), botToken, chatId).catch(() => {})
            }
          }

          // Auto-trade execution (per-user, plan gating)
          const autoTrade = effectiveSettings.autoTrade
          if (autoTrade?.enabled && autoTrade.mode === 'auto' && userSignal.riskManagement) {
            const { allowed: atAllowed } = await checkFeature(uid, 'autoTrade')
            if (atAllowed) {
              const allowedPairs = autoTrade.allowedPairs ?? []
              const allowed = allowedPairs.length === 0 || allowedPairs.includes(symbol)
              if (allowed) {
                const cbNow = Date.now()
                if (cbNow - session.lastDailyReset > DAY_MS) {
                  session.dailyLossCount = 0
                  session.dailyTradeCount = 0
                  session.lastDailyReset = cbNow
                }

                if (session.dailyTradeCount >= MAX_DAILY_TRADES) {
                  logger.warn({ userId: uid, dailyTradeCount: session.dailyTradeCount }, 'Circuit breaker: max daily trades reached')
                } else if (session.dailyLossCount >= MAX_DAILY_LOSSES) {
                  logger.warn({ userId: uid, dailyLossCount: session.dailyLossCount }, 'Circuit breaker: max daily losses reached')
                } else {
                  session.dailyTradeCount++
                  const positionSize = effectiveSettings.baseCapital * effectiveSettings.leverage
                  const quantity = positionSize / priceData.price
                  const order: OrderRequest = {
                    symbol,
                    side: userSignal.direction === 'LONG' ? 'BUY' : 'SELL',
                    type: 'MARKET',
                    quantity: parseFloat(quantity.toFixed(3)),
                    stopLoss: userSignal.riskManagement.stopLoss,
                    takeProfit: userSignal.riskManagement.takeProfit,
                  }
                  const { apiKey, apiSecret } = decryptApiKeys(session.settings)
                  const testnet = process.env.BINANCE_TESTNET !== 'false'
                  const result = await placeMarketOrder(order, apiKey, apiSecret, testnet)
                  io.to(`user:${uid}`).emit('order-executed', result)
                  if (result.success && result.error) {
                    // SL/TP failed — warn user urgently
                    io.to(`user:${uid}`).emit('alert', {
                      type: 'warning',
                      title: 'Ordens de proteção falharam',
                      message: `${result.error}. Coloque SL/TP manualmente!`,
                    })
                  }
                  logger.info({ symbol, side: order.side, userId: uid, success: result.success, error: result.error || undefined }, 'AutoTrade order executed')
                  await logAudit({ userId: uid, action: result.success ? 'ORDER_EXECUTE' : 'ORDER_FAILED', details: { symbol, side: order.side, quantity: order.quantity, auto: true, error: result.error }, ip: undefined })
                }
              }
            }
          }
        }

        // Check score-based custom alerts (per-user)
        if (session.settings.customAlerts) {
          for (const alert of session.settings.customAlerts) {
            if (alert.triggered || alert.symbol !== symbol) continue
            let triggered = false
            if (alert.condition === 'score_above' && userSignal.confluenceScore >= alert.value) triggered = true
            if (alert.condition === 'score_below' && userSignal.confluenceScore <= alert.value) triggered = true
            if (triggered) {
              alert.triggered = true
              io.to(`user:${uid}`).emit('custom-alert-triggered', alert)
              updateUserSettings(uid, { customAlerts: session.settings.customAlerts }).then(updated => {
                session.settings = { ...session.settings, ...updated }
              }).catch(() => {})
            }
          }
        }
      }

      try { await flushBuffer() } catch { /* non-critical */ }
    } catch (err) {
      console.error(`[Server] Error processing candle-closed for ${symbol}:`, (err as Error).message)
    }
  })

  wsManager.on('price-update', ({ symbol, priceData }: { symbol: string; priceData: PriceData }) => {
    const now = Date.now()
    const lastEmit = lastEmitTimestamp.get(symbol) ?? 0
    if (now - lastEmit < PRICE_UPDATE_THROTTLE_MS) return

    const current = state.get(symbol)
    if (current) {
      current.price = priceData
      current.lastUpdate = now
    } else {
      const placeholder: PairAnalysis = {
        symbol,
        candles: [],
        indicators: {
          ma20: 0, ma50: 0, ma100: 0, ma200: 0,
          ema20: 0, ema50: 0,
          macd: { macd: 0, signal: 0, histogram: 0, trend: 'neutral', divergence: null },
          stochRsi: { k: 50, d: 50, zone: 'neutral', persistentOverbought: false, persistentOversold: false },
          volume: { current: 0, average: 0, isSpike: false, candleDirection: 'green' },
        },
        price: priceData,
        signal: {
          direction: 'NEUTRO',
          confluenceScore: 50,
          confidence: 'normal',
          alerts: [],
          riskManagement: null,
          criticalDecision: 'Aguardando dados...',
          actionPoints: ['Carregando indicadores — aguardando primeiro candle de 15min fechar'],
          overrides: [],
        },
        lastUpdate: 0,
      }
      state.set(symbol, placeholder)
    }

    // Price updates are broadcast to all (market data is shared)
    io.emit('price-update', { symbol, priceData })

    // Per-user: check price exits and custom alerts
    for (const [uid, session] of userSessions) {
      if (!session.favorites.includes(symbol)) continue

      session.tradeTracker.checkPriceForExits(symbol, priceData.price).catch(err =>
        console.error(`[Server] checkPriceForExits error for ${symbol}:`, (err as Error).message)
      )

      // Check custom alerts (price & funding) per-user
      if (session.settings.customAlerts) {
        for (const alert of session.settings.customAlerts) {
          if (alert.triggered || alert.symbol !== symbol) continue
          let triggered = false
          if (alert.condition === 'price_above' && priceData.price >= alert.value) triggered = true
          if (alert.condition === 'price_below' && priceData.price <= alert.value) triggered = true
          if (alert.condition === 'funding_above' && priceData.fundingRate * 100 >= alert.value) triggered = true
          if (alert.condition === 'funding_below' && priceData.fundingRate * 100 <= alert.value) triggered = true

          if (triggered) {
            alert.triggered = true
            io.to(`user:${uid}`).emit('custom-alert-triggered', alert)
            updateUserSettings(uid, { customAlerts: session.settings.customAlerts }).then(updated => {
              session.settings = { ...session.settings, ...updated }
            }).catch(() => {})
          }
        }
      }
    }

    lastEmitTimestamp.set(symbol, now)
  })

  // Heat scores cache
  let cachedHeatScores = new Map<string, HeatScore>()
  let lastHeatScoreCalc = 0
  const HEAT_SCORE_CALC_INTERVAL = 10_000 // Recalculate every 10s

  // All-pairs bulk update (throttled)
  wsManager.on('all-pairs-update', (allPairs: Map<string, BasicPairData>) => {
    const now = Date.now()
    if (now - lastAllPairsEmit < ALL_PAIRS_THROTTLE_MS) return
    lastAllPairsEmit = now

    // Recalculate heat scores periodically
    if (now - lastHeatScoreCalc > HEAT_SCORE_CALC_INTERVAL) {
      cachedHeatScores = calculateAllHeatScores(allPairs)
      lastHeatScoreCalc = now
    }

    // Attach heat scores to pairs
    const arr = Array.from(allPairs.values())
      .filter(p => p.price > 0)
      .map(p => ({
        ...p,
        heatScore: cachedHeatScores.get(p.symbol) ?? undefined,
      }))
    io.emit('all-pairs-update', arr)
  })

  wsManager.on('connection-status', ({ symbol, connected }: { symbol: string; connected: boolean }) => {
    io.emit('connection-status', { symbol, connected })
  })

  wsManager.on('error', ({ symbol, error }: { symbol: string; error: Error }) => {
    console.error(`[WS] Error for ${symbol}:`, error.message)
  })

  // ── TradeTracker & PaperTracker events are now wired per-user in getOrCreateSession() ──

  // ── Socket.io authentication middleware ──────────────────────────────────
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string
    if (!token) {
      return next(new Error('Authentication required'))
    }
    const user = await requireSocketUser(token)
    if (!user) {
      return next(new Error('Invalid or expired token'))
    }
    // Attach user to socket data
    ;(socket as any).userId = user.id
    ;(socket as any).userEmail = user.email
    ;(socket as any).userRole = user.role
    next()
  })

  // ── Socket.io connection handlers ────────────────────────────────────────

  io.on('connection', async (socket) => {
    const userId = (socket as any).userId as number
    logger.info({ socketId: socket.id, userId, email: (socket as any).userEmail }, 'Client connected')

    // Create or get user session
    const session = await getOrCreateSession(userId, io)
    session.sockets.add(socket.id)

    // Join user-specific room
    socket.join(`user:${userId}`)

    // Ensure user's favorites are being monitored by wsManager
    for (const symbol of session.favorites) {
      if (!wsManager.isFavorite(symbol)) {
        await wsManager.addFavorite(symbol)
      }
    }

    // Calculate initial indicators for favorites that have candles but no state yet
    for (const symbol of session.favorites) {
      if (!state.has(symbol)) {
        const candles = wsManager.getCandles(symbol)
        if (candles.length >= config.candles.minForSignals) {
          try {
            const effectiveSettings = resolveStrategySettings(session.settings, symbol, 'live')
            const indicators = calculateIndicators(candles, null, effectiveSettings.indicatorPeriods)
            const priceData = wsManager.getPriceData(symbol)
            if (priceData) {
              const signal = generateSignal(indicators, priceData, effectiveSettings, undefined)
              const analysis: PairAnalysis = {
                symbol,
                candles: candles.slice(-100),
                indicators,
                price: priceData,
                signal,
                lastUpdate: Date.now(),
              }
              state.set(symbol, analysis)
              prevIndicators.set(symbol, indicators)
              prevSignals.set(symbol, signal)
            }
          } catch (err) {
            console.error(`[Server] Initial indicator calc error for ${symbol}:`, (err as Error).message)
          }
        }
      }
    }

    // Per-socket rate limiting
    const socketRateLimits = new Map<string, number[]>()
    const SOCKET_RATE_LIMIT = 30 // max events per second
    const SOCKET_READ_RATE_LIMIT = 60 // max read events per second
    const SOCKET_RATE_WINDOW = 1000 // 1 second

    function checkSocketRate(socketId: string): boolean {
      const now = Date.now()
      const key = `write:${socketId}`
      const timestamps = socketRateLimits.get(key) || []
      const recent = timestamps.filter(t => now - t < SOCKET_RATE_WINDOW)
      if (recent.length >= SOCKET_RATE_LIMIT) return false
      recent.push(now)
      socketRateLimits.set(key, recent)
      return true
    }

    function checkSocketReadRate(socketId: string): boolean {
      const now = Date.now()
      const key = `read:${socketId}`
      const timestamps = socketRateLimits.get(key) || []
      const recent = timestamps.filter(t => now - t < SOCKET_RATE_WINDOW)
      if (recent.length >= SOCKET_READ_RATE_LIMIT) return false
      recent.push(now)
      socketRateLimits.set(key, recent)
      return true
    }

    // Build user-specific state snapshot
    const userAnalyses: PairAnalysis[] = []
    for (const symbol of session.favorites) {
      const analysis = state.get(symbol)
      if (analysis) userAnalyses.push(analysis)
    }

    const openTradesArray = Array.from(session.tradeTracker.getOpenTradesMap().values())
    const allPairsArr = Array.from(wsManager.getAllPairsData().values()).filter(p => p.price > 0)
    session.tradeTracker.getStats().then(globalStats => {
      socket.emit('state-snapshot', {
        analyses: userAnalyses,
        openTrades: openTradesArray,
        globalStats,
        settings: sanitizeSettings(session.settings),
        allPairs: allPairsArr,
        favorites: session.favorites,
      })
    }).catch(() => {
      socket.emit('state-snapshot', {
        analyses: userAnalyses,
        openTrades: openTradesArray,
        globalStats: null,
        settings: sanitizeSettings(session.settings),
        allPairs: allPairsArr,
        favorites: session.favorites,
      })
    })

    // Toggle favorite (per-user)
    socket.on('toggle-favorite', async (data: unknown, callback?: unknown) => {
      if (!checkSocketRate(socket.id)) return
      try {
        const v = validate(toggleFavoriteSchema, data)
        if (!v.success) return
        const symbol = v.data.symbol

        const isFav = session.favorites.includes(symbol)

        // Plan gating: check maxFavorites when adding
        if (!isFav) {
          const user = await getUserById(userId)
          const limits = await getPlanLimits(user?.plan || 'free')
          if (session.favorites.length >= limits.maxFavorites) {
            if (typeof callback === 'function') {
              (callback as (d: { success: boolean; error: string }) => void)({ success: false, error: `Limite de ${limits.maxFavorites} pares no plano gratuito. Faça upgrade.` })
            }
            socket.emit('plan-limit', { feature: 'maxFavorites', message: `Limite de ${limits.maxFavorites} pares no seu plano.` })
            return
          }
        }

        if (isFav) {
          // Remove from user's favorites
          session.favorites = session.favorites.filter((p: string) => p !== symbol)

          // Only remove from wsManager if no other user has it as favorite
          let otherUserHasIt = false
          for (const [uid, s] of userSessions) {
            if (uid !== userId && s.favorites.includes(symbol)) { otherUserHasIt = true; break }
          }
          if (!otherUserHasIt) {
            wsManager.removeFavorite(symbol)
            state.delete(symbol)
            prevIndicators.delete(symbol)
            prevSignals.delete(symbol)
            lastEmitTimestamp.delete(symbol)
          }
        } else {
          // Add to user's favorites
          if (!wsManager.isFavorite(symbol)) {
            await wsManager.addFavorite(symbol)
          }
          session.favorites.push(symbol)
        }

        // Save to user settings
        await updateUserSettings(userId, { favorites: session.favorites, pairs: session.favorites })
        session.settings.favorites = session.favorites
        session.settings.pairs = session.favorites

        // Emit only to this user's sockets
        io.to(`user:${userId}`).emit('settings-updated', sanitizeSettings(session.settings))
        io.to(`user:${userId}`).emit('favorites-updated', session.favorites)

        await logAudit({ userId, action: 'FAVORITE_TOGGLE', details: { symbol, added: !isFav }, ip: undefined })
      } catch (err) {
        console.error('[Socket.io] Error toggling favorite:', (err as Error).message)
      }
    })

    // Legacy add/remove pair (per-user)
    socket.on('add-pair', async (data: unknown) => {
      if (!checkSocketRate(socket.id)) return
      try {
        const v = validate(toggleFavoriteSchema, data)
        if (!v.success) return
        const symbol = v.data.symbol
        if (session.favorites.includes(symbol)) return
        const user = await getUserById(userId)
        const limits = await getPlanLimits(user?.plan || 'free')
        if (session.favorites.length >= limits.maxFavorites) {
          socket.emit('plan-limit', { feature: 'maxFavorites', message: `Limite de ${limits.maxFavorites} pares no seu plano.` })
          return
        }
        if (!wsManager.isFavorite(symbol)) {
          await wsManager.addFavorite(symbol)
        }
        session.favorites.push(symbol)
        await updateUserSettings(userId, { favorites: session.favorites, pairs: session.favorites })
        session.settings.favorites = session.favorites
        session.settings.pairs = session.favorites
        io.to(`user:${userId}`).emit('settings-updated', sanitizeSettings(session.settings))
        io.to(`user:${userId}`).emit('favorites-updated', session.favorites)
      } catch (err) {
        console.error('[Socket.io] Error adding pair:', (err as Error).message)
      }
    })

    socket.on('remove-pair', async (data: unknown) => {
      if (!checkSocketRate(socket.id)) return
      try {
        const v = validate(toggleFavoriteSchema, data)
        if (!v.success) return
        const symbol = v.data.symbol
        session.favorites = session.favorites.filter((p: string) => p !== symbol)

        // Only remove from wsManager if no other user has it as favorite
        let otherUserHasIt = false
        for (const [uid, s] of userSessions) {
          if (uid !== userId && s.favorites.includes(symbol)) { otherUserHasIt = true; break }
        }
        if (!otherUserHasIt) {
          wsManager.removeFavorite(symbol)
          state.delete(symbol)
          prevIndicators.delete(symbol)
          prevSignals.delete(symbol)
          lastEmitTimestamp.delete(symbol)
        }

        await updateUserSettings(userId, { favorites: session.favorites, pairs: session.favorites })
        session.settings.favorites = session.favorites
        session.settings.pairs = session.favorites
        io.to(`user:${userId}`).emit('settings-updated', sanitizeSettings(session.settings))
        io.to(`user:${userId}`).emit('favorites-updated', session.favorites)
      } catch (err) {
        console.error('[Socket.io] Error removing pair:', (err as Error).message)
      }
    })

    // Update settings
    socket.on('update-settings', async (data: unknown, callback: unknown) => {
      if (!checkSocketRate(socket.id)) return
      try {
        const v = validate(updateSettingsSchema, data)
        if (!v.success) {
          if (typeof callback === 'function') (callback as (d: { success: boolean; error: string }) => void)({ success: false, error: v.error })
          return
        }
        const partial = v.data as Partial<UserSettings>

        // Block saving features the user's plan doesn't allow
        if (partial.autoTrade && partial.autoTrade.enabled) {
          const allowed = await checkFeature(userId, 'autoTrade')
          if (!allowed.allowed) {
            delete partial.autoTrade
            socket.emit('plan-limit', { feature: 'autoTrade', message: 'Upgrade para Trader para usar Auto-Trade' })
          }
        }

        const previousFavorites = [...session.favorites]
        const favoritesChanged = !!(partial.favorites || partial.pairs)

        if (favoritesChanged) {
          const user = await getUserById(userId)
          const limits = await getPlanLimits(user?.plan || 'free')
          const requested = partial.favorites ?? partial.pairs ?? []
          const limited = Array.from(new Set(requested)).slice(0, limits.maxFavorites)
          if (requested.length > limited.length) {
            socket.emit('plan-limit', { feature: 'maxFavorites', message: `Seu plano permite ate ${limits.maxFavorites} pares.` })
          }
          partial.favorites = limited
          partial.pairs = limited
        }

        // Track if API keys are changing for audit
        const apiKeyChanged = (partial.binanceApiKey && !partial.binanceApiKey.includes('****')) ||
          (partial.binanceApiSecret && !partial.binanceApiSecret.includes('****')) ||
          (partial.telegramBotToken && !partial.telegramBotToken.includes('****'))

        // Encrypt secrets before saving to DB (skip masked values)
        if (partial.binanceApiKey && !partial.binanceApiKey.includes('****')) {
          partial.binanceApiKey = encrypt(partial.binanceApiKey)
        } else if (partial.binanceApiKey?.includes('****')) {
          delete partial.binanceApiKey // Don't overwrite with masked value
        }
        if (partial.binanceApiSecret && !partial.binanceApiSecret.includes('****')) {
          partial.binanceApiSecret = encrypt(partial.binanceApiSecret)
        } else if (partial.binanceApiSecret?.includes('****')) {
          delete partial.binanceApiSecret
        }
        if (partial.telegramBotToken && !partial.telegramBotToken.includes('****')) {
          partial.telegramBotToken = encrypt(partial.telegramBotToken)
        } else if (partial.telegramBotToken?.includes('****')) {
          delete partial.telegramBotToken
        }
        if (partial.telegramChatId && !partial.telegramChatId.includes('****')) {
          partial.telegramChatId = encrypt(partial.telegramChatId)
        } else if (partial.telegramChatId?.includes('****')) {
          delete partial.telegramChatId
        }

        const updated = await updateUserSettings(userId, partial)

        if (favoritesChanged) {
          const nextFavorites = updated.favorites ?? updated.pairs ?? []
          session.favorites = nextFavorites
          updated.favorites = nextFavorites
          updated.pairs = nextFavorites

          for (const symbol of nextFavorites) {
            if (!wsManager.isFavorite(symbol)) {
              await wsManager.addFavorite(symbol)
            }
            if (!state.has(symbol)) {
              const candles = wsManager.getCandles(symbol)
              const priceData = wsManager.getPriceData(symbol)
              if (candles.length >= config.candles.minForSignals && priceData) {
                try {
                  const effectiveSettings = resolveStrategySettings(session.settings, symbol, 'live')
                  const indicators = calculateIndicators(candles, null, effectiveSettings.indicatorPeriods)
                  const signal = generateSignal(indicators, priceData, effectiveSettings, undefined)
                  const analysis: PairAnalysis = {
                    symbol,
                    candles: candles.slice(-100),
                    indicators,
                    price: priceData,
                    signal,
                    lastUpdate: Date.now(),
                  }
                  state.set(symbol, analysis)
                  prevIndicators.set(symbol, indicators)
                  prevSignals.set(symbol, signal)
                } catch (err) {
                  console.error(`[Server] Initial indicator calc error for ${symbol}:`, (err as Error).message)
                }
              }
            }
          }

          for (const symbol of previousFavorites) {
            if (nextFavorites.includes(symbol)) continue
            let otherUserHasIt = false
            for (const [uid, s] of userSessions) {
              if (uid !== userId && s.favorites.includes(symbol)) { otherUserHasIt = true; break }
            }
            if (!otherUserHasIt) {
              wsManager.removeFavorite(symbol)
              state.delete(symbol)
              prevIndicators.delete(symbol)
              prevSignals.delete(symbol)
              lastEmitTimestamp.delete(symbol)
            }
          }
        }

        // Keep encrypted in memory — decrypt only at moment of use
        session.settings = updated
        // Emit only to this user's sockets
        const safeSettings = sanitizeSettings(session.settings)
        io.to(`user:${userId}`).emit('settings-updated', safeSettings)
        if (favoritesChanged) {
          io.to(`user:${userId}`).emit('favorites-updated', session.favorites)
          const userAnalyses: PairAnalysis[] = []
          for (const symbol of session.favorites) {
            const analysis = state.get(symbol)
            if (analysis) userAnalyses.push(analysis)
          }
          const openTradesArray = Array.from(session.tradeTracker.getOpenTradesMap().values())
          const allPairsArr = Array.from(wsManager.getAllPairsData().values()).filter(p => p.price > 0)
          const globalStats = await session.tradeTracker.getStats().catch(() => null)
          io.to(`user:${userId}`).emit('state-snapshot', {
            analyses: userAnalyses,
            openTrades: openTradesArray,
            globalStats,
            settings: safeSettings,
            allPairs: allPairsArr,
            favorites: session.favorites,
          })
        }

        if (typeof callback === 'function') {
          (callback as (d: { success: boolean; settings: UserSettings }) => void)({ success: true, settings: safeSettings })
        }

        // Audit logging
        if (apiKeyChanged) {
          await logAudit({ userId, action: 'API_KEY_CHANGED', details: { changedFields: Object.keys(v.data) }, ip: undefined })
        }
        await logAudit({ userId, action: 'SETTINGS_UPDATE', details: { changedFields: Object.keys(v.data) }, ip: undefined })
      } catch (err) {
        console.error('[Socket.io] Error updating settings:', (err as Error).message)
        if (typeof callback === 'function') {
          (callback as (d: { success: boolean; error: string }) => void)({ success: false, error: 'Erro ao salvar configuracoes' })
        }
      }
    })

    // Create custom alert
    socket.on('create-custom-alert', async (data: unknown, callback: unknown) => {
      if (!checkSocketRate(socket.id)) return
      try {
        if (typeof callback !== 'function') return
        const v = validate(createAlertSchema, data)
        if (!v.success) { (callback as (d: null) => void)(null); return }

        // Max alerts per user
        const MAX_ALERTS = 50
        const existingAlerts = session.settings.customAlerts ?? []
        if (existingAlerts.length >= MAX_ALERTS) {
          (callback as (d: null) => void)(null)
          socket.emit('plan-limit', { feature: 'customAlerts', message: 'Limite de alertas atingido (max 50)' })
          return
        }

        const newAlert: CustomAlert = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          symbol: v.data.symbol,
          condition: v.data.condition,
          value: v.data.value,
          message: v.data.message || `${v.data.symbol} ${v.data.condition.replace('_', ' ')} ${v.data.value}`,
          triggered: false,
          createdAt: new Date().toISOString(),
        }

        const currentAlerts = session.settings.customAlerts ?? []
        const updatedAlerts = [...currentAlerts, newAlert]
        await updateUserSettings(userId, { customAlerts: updatedAlerts })
        session.settings.customAlerts = updatedAlerts
        io.to(`user:${userId}`).emit('settings-updated', sanitizeSettings(session.settings))
        ;(callback as (d: CustomAlert) => void)(newAlert)
        await logAudit({ userId, action: 'ALERT_CREATE', details: { symbol: v.data.symbol, condition: v.data.condition, value: v.data.value }, ip: undefined })
      } catch (err) {
        console.error('[Socket.io] Error creating custom alert:', (err as Error).message)
        if (typeof callback === 'function') (callback as (d: null) => void)(null)
      }
    })

    // Delete custom alert
    socket.on('delete-custom-alert', async (data: unknown) => {
      if (!checkSocketRate(socket.id)) return
      try {
        const v = validate(deleteAlertSchema, data)
        if (!v.success) return
        const currentAlerts = session.settings.customAlerts ?? []
        const filtered = currentAlerts.filter(a => a.id !== v.data.id)
        await updateUserSettings(userId, { customAlerts: filtered })
        session.settings.customAlerts = filtered
        io.to(`user:${userId}`).emit('settings-updated', sanitizeSettings(session.settings))
        await logAudit({ userId, action: 'ALERT_DELETE', details: { alertId: v.data.id }, ip: undefined })
      } catch (err) {
        console.error('[Socket.io] Error deleting custom alert:', (err as Error).message)
      }
    })

    // Execute order (semi-automatic mode)
    socket.on('execute-order', async (data: unknown, callback: unknown) => {
      if (typeof callback !== 'function') return
      if (!checkSocketRate(socket.id)) {
        return (callback as (d: OrderResult) => void)({ success: false, symbol: '', side: '', error: 'Rate limit exceeded', timestamp: Date.now() })
      }
      try {
        // Plan gating: check executeOrders feature
        const { allowed: orderAllowed, requiredPlan } = await checkFeature(userId, 'executeOrders')
        if (!orderAllowed) {
          return (callback as (d: OrderResult) => void)({ success: false, symbol: '', side: '', error: `Recurso disponível no plano ${requiredPlan}. Faça upgrade.`, timestamp: Date.now() })
        }

        const v = validate(executeOrderSchema, data)
        if (!v.success) {
          (callback as (d: OrderResult) => void)({ success: false, symbol: '', side: '', error: v.error, timestamp: Date.now() })
          return
        }
        const order = v.data as OrderRequest
        const { apiKey, apiSecret } = decryptApiKeys(session.settings)
        const testnet = process.env.BINANCE_TESTNET !== 'false'
        const result = await placeMarketOrder(order, apiKey, apiSecret, testnet)
        io.to(`user:${userId}`).emit('order-executed', result)
        if (result.success && result.error) {
          // SL/TP failed — warn user urgently
          io.to(`user:${userId}`).emit('alert', {
            type: 'warning',
            title: 'Ordens de proteção falharam',
            message: `${result.error}. Coloque SL/TP manualmente!`,
          })
        }
        ;(callback as (d: OrderResult) => void)(result)
        await logAudit({ userId, action: result.success ? 'ORDER_EXECUTE' : 'ORDER_FAILED', details: { symbol: order.symbol, side: order.side, quantity: order.quantity, error: result.error }, ip: undefined })
      } catch (err) {
        ;(callback as (d: OrderResult) => void)({ success: false, symbol: '', side: '', error: (err as Error).message, timestamp: Date.now() })
      }
    })

    // Get history
    socket.on('get-history', async (params: unknown, callback: unknown) => {
      if (!checkSocketReadRate(socket.id)) return
      try {
        if (typeof callback !== 'function') return
        const v = validate(paginationSchema, params ?? {})
        if (!v.success) { (callback as (data: { signals: never[]; total: number }) => void)({ signals: [], total: 0 }); return }
        const result = await getHistory(userId, v.data.symbol, v.data.limit, v.data.offset)
        callback(result)
      } catch (err) {
        console.error('[Socket.io] Error getting history:', (err as Error).message)
        if (typeof callback === 'function') {
          (callback as (data: { signals: never[]; total: number }) => void)({ signals: [], total: 0 })
        }
      }
    })

    // Get trade history
    socket.on('get-trade-history', async (params: unknown, callback: unknown) => {
      if (!checkSocketReadRate(socket.id)) return
      try {
        if (typeof callback !== 'function') return
        const v = validate(paginationSchema, params ?? {})
        if (!v.success) { (callback as (data: { trades: never[]; total: number }) => void)({ trades: [], total: 0 }); return }
        const result = await session.tradeTracker.getTradeHistoryData(v.data.symbol, v.data.limit, v.data.offset)
        callback(result)
      } catch (err) {
        console.error('[Socket.io] Error getting trade history:', (err as Error).message)
        if (typeof callback === 'function') {
          (callback as (data: { trades: never[]; total: number }) => void)({ trades: [], total: 0 })
        }
      }
    })

    // Get trade stats
    socket.on('get-trade-stats', async (params: unknown, callback: unknown) => {
      if (!checkSocketReadRate(socket.id)) return
      try {
        if (typeof callback !== 'function') return
        const v = validate(paginationSchema, params ?? {})
        if (!v.success) { (callback as (d: null) => void)(null); return }
        const result = await session.tradeTracker.getStats(v.data.symbol)
        callback(result)
      } catch (err) {
        console.error('[Socket.io] Error getting trade stats:', (err as Error).message)
        if (typeof callback === 'function') {
          (callback as (data: null) => void)(null)
        }
      }
    })

    // Get candles
    socket.on('get-candles', (data: unknown, callback: unknown) => {
      if (!checkSocketReadRate(socket.id)) return
      if (typeof callback !== 'function') return
      const v = validate(symbolOnlySchema, data)
      if (!v.success) return
      const candles = wsManager.getCandles(v.data.symbol).slice(-100)
      callback(candles)
    })

    // Analyze a non-favorite pair on demand
    socket.on('analyze-pair', async (data: unknown, callback: unknown) => {
      if (typeof callback !== 'function') return
      if (!checkSocketRate(socket.id)) {
        return (callback as (d: null) => void)(null)
      }
      try {
        const v = validate(analyzePairSchema, data)
        if (!v.success) { (callback as (d: null) => void)(null); return }
        const symbol = v.data.symbol

        // If already a favorite, return existing analysis
        const existing = state.get(symbol)
        if (existing && existing.lastUpdate > 0) { (callback as (d: PairAnalysis) => void)(existing); return }

        // Fetch candles and calculate
        const candles = await wsManager.fetchCandles(symbol)
        if (candles.length < config.candles.minForSignals) {
          (callback as (d: null) => void)(null); return
        }

        const effectiveSettings = resolveStrategySettings(session.settings, symbol, 'live')
        const indicators = calculateIndicators(candles, null, effectiveSettings.indicatorPeriods)
        let basicData = wsManager.getBasicPairData(symbol)
        if (!basicData || basicData.price <= 0) {
          basicData = (await fetchTickerSnapshot(symbol)).get(symbol)
        }
        const lastCandle = candles[candles.length - 1]
        const priceData: PriceData = {
          symbol,
          price: basicData?.price ?? lastCandle.close,
          markPrice: basicData?.markPrice ?? basicData?.price ?? lastCandle.close,
          change24h: basicData?.change24h ?? 0,
          volume24h: basicData?.volume24h ?? candles.slice(-96).reduce((sum, candle) => sum + candle.volume, 0),
          fundingRate: basicData?.fundingRate ?? 0,
          fundingCountdown: '00:00:00',
        }

        const signal = generateSignal(indicators, priceData, effectiveSettings)
        const analysis: PairAnalysis = {
          symbol,
          candles: candles.slice(-100),
          indicators,
          price: priceData,
          signal,
          lastUpdate: Date.now(),
        }
        ;(callback as (d: PairAnalysis) => void)(analysis)
      } catch (err) {
        console.error('[Socket.io] Error analyzing pair:', (err as Error).message)
        ;(callback as (d: null) => void)(null)
      }
    })

    // Run backtest
    socket.on('run-backtest', async (data: unknown, callback: unknown) => {
      if (typeof callback !== 'function') return
      if (!checkSocketRate(socket.id)) {
        return (callback as (d: null) => void)(null)
      }
      try {
        // Plan gating: check backtest feature
        const { allowed, requiredPlan } = await checkFeature(userId, 'backtest')
        if (!allowed) {
          return (callback as (d: { success: false; error: string }) => void)({ success: false, error: `Recurso disponível no plano ${requiredPlan}. Faça upgrade.` })
        }

        const v = validate(backtestParamsSchema, data)
        if (!v.success) {
          (callback as (d: null) => void)(null)
          return
        }
        const params = v.data as BacktestParams

        const periodMap: Record<string, number> = {
          '7d': 672,    // 7 * 24 * 4 (15min candles)
          '30d': 2880,  // 30 * 24 * 4
          '90d': 8640,  // 90 * 24 * 4
        }
        const limit = periodMap[params.period] ?? 2880

        console.log(`[Backtest] Starting for ${params.symbols.join(', ')} (${params.period}, ${limit} candles)`)

        // Fetch candles for each symbol
        const candlesMap = new Map<string, CandleData[]>()

        // Exchange APIs cap candle limits, so large periods are fetched in pages.
        for (const symbol of params.symbols) {
          let allCandles: CandleData[] = []
          let remaining = limit
          let endTime: number | undefined

          while (remaining > 0) {
            const fetchLimit = Math.min(remaining, 1000)
            try {
              const fetched = await fetchMarketCandles(symbol, config.candles.interval, fetchLimit, endTime)

              if (fetched.length === 0) break

              allCandles = [...fetched, ...allCandles]
              remaining -= fetched.length
              endTime = fetched[0].timestamp - 1

              if (fetched.length < fetchLimit) break // no more data
            } catch {
              break
            }
          }

          if (allCandles.length > 0) {
            // Sort by timestamp ascending
            allCandles.sort((a, b) => a.timestamp - b.timestamp)
            // Deduplicate
            const seen = new Set<number>()
            allCandles = allCandles.filter(c => {
              if (seen.has(c.timestamp)) return false
              seen.add(c.timestamp)
              return true
            })
            candlesMap.set(symbol, allCandles)
            console.log(`[Backtest] ${symbol}: ${allCandles.length} candles fetched`)
          }
        }

        const result = runBacktest(candlesMap, params)
        console.log(`[Backtest] Complete: ${result.stats.totalTrades} trades, ${result.stats.winRate.toFixed(1)}% win rate, ${result.stats.totalPnlPercent.toFixed(2)}% P&L`)
        ;(callback as (d: unknown) => void)(result)
      } catch (err) {
        console.error('[Backtest] Error:', (err as Error).message)
        ;(callback as (d: null) => void)(null)
      }
    })

    // Get performance data
    socket.on('get-performance', async (params: unknown, callback: unknown) => {
      if (!checkSocketReadRate(socket.id)) return
      try {
        if (typeof callback !== 'function') return
        const v = validate(paginationSchema, params ?? {})
        if (!v.success) { (callback as (data: null) => void)(null); return }
        const result = await getPerformanceData(userId, v.data.symbol)
        callback(result)
      } catch (err) {
        console.error('[Socket.io] Error getting performance data:', (err as Error).message)
        if (typeof callback === 'function') {
          (callback as (data: null) => void)(null)
        }
      }
    })

    // Paper trade queries
    socket.on('get-paper-trades', async (params: unknown, callback: unknown) => {
      if (!checkSocketReadRate(socket.id)) return
      if (typeof callback !== 'function') return
      try {
        const result_v = validate(paginationSchema, params ?? {})
        if (!result_v.success) { (callback as (d: unknown) => void)({ trades: [], total: 0 }); return }
        const result = await session.paperTracker.getHistory(result_v.data.symbol, result_v.data.limit, result_v.data.offset)
        ;(callback as (d: unknown) => void)(result)
      } catch { (callback as (d: unknown) => void)({ trades: [], total: 0 }) }
    })

    socket.on('get-paper-stats', async (params: unknown, callback: unknown) => {
      if (!checkSocketReadRate(socket.id)) return
      if (typeof callback !== 'function') return
      try {
        const v = validate(paginationSchema, params ?? {})
        if (!v.success) { (callback as (d: unknown) => void)(null); return }
        const result = await session.paperTracker.getStats(v.data.symbol)
        ;(callback as (d: unknown) => void)(result)
      } catch { (callback as (d: unknown) => void)(null) }
    })

    socket.on('test-telegram', async (data: unknown, callback: unknown) => {
      if (!checkSocketRate(socket.id)) return
      if (typeof callback !== 'function') return
      const { botToken, chatId } = decryptTelegramKeys(session.settings)
      const result = await sendTestMessage(botToken, chatId)
      ;(callback as (d: { success: boolean; error?: string }) => void)(result)
    })

    socket.on('disconnect', () => {
      socketRateLimits.delete(`write:${socket.id}`)
      socketRateLimits.delete(`read:${socket.id}`)
      session.sockets.delete(socket.id)
      console.log(`[Socket.io] Client disconnected: ${socket.id} (user: ${userId})`)

      // If no more sockets for this user, clean up session after delay
      if (session.sockets.size === 0) {
        setTimeout(() => {
          const s = userSessions.get(userId)
          if (s && s.sockets.size === 0) {
            removeSession(userId)
          }
        }, 60000) // Keep session alive for 1 min after last disconnect
      }
    })
  })

  // ── Start ────────────────────────────────────────────────────────────────

  httpServer.listen(config.port, () => {
    logger.info({ port: config.port, clientOrigin: config.clientOrigin, pairs: favoritePairs, interval: config.candles.interval }, 'Server started')
  })

  void (async () => {
    await wsManager.start()

    // Initial indicator calculation from historical candles
    for (const symbol of favoritePairs) {
      const candles = wsManager.getCandles(symbol)
      if (candles.length >= config.candles.minForSignals) {
        try {
          const indicators = calculateIndicators(candles, null, cachedSettings.indicatorPeriods)
          const priceData = wsManager.getPriceData(symbol)
          if (priceData) {
            const signal = generateSignal(indicators, priceData, cachedSettings)
            const alerts = detectAlerts(signal, undefined, indicators, priceData, cachedSettings)
            signal.alerts = alerts

            const analysis: PairAnalysis = {
              symbol,
              candles: wsManager.getCandles(symbol).slice(-100),
              indicators,
              price: priceData,
              signal,
              lastUpdate: Date.now(),
            }
            state.set(symbol, analysis)
            prevIndicators.set(symbol, indicators)
            prevSignals.set(symbol, signal)
            console.log(`[Server] Initial analysis for ${symbol}: ${signal.direction} (score: ${signal.confluenceScore.toFixed(1)})`)
          }
        } catch (err) {
          console.error(`[Server] Error calculating initial indicators for ${symbol}:`, (err as Error).message)
        }
      } else {
        console.log(`[Server] ${symbol}: only ${candles.length} candles, need ${config.candles.minForSignals} for indicators`)
      }
    }
  })().catch((err) => {
    logger.error({ err }, 'Market data startup failed')
  })

  // Cleanup expired blacklisted tokens every hour
  setInterval(() => cleanupExpiredTokens().catch(() => {}), 60 * 60 * 1000)

  // ── Batch Scoring: run every 15min for all non-favorite pairs ──────────

  const BATCH_SCORE_INTERVAL = 15 * 60 * 1000 // 15min
  let batchScoreCache = new Map<string, { score: number; direction: string }>()

  async function doBatchScoring() {
    const allPairs = wsManager.getAllPairsData()
    if (allPairs.size === 0) return

    // Build a union of all user favorites for exclusion from batch scoring
    const allFavs = new Set<string>()
    for (const [, session] of userSessions) {
      for (const fav of session.favorites) allFavs.add(fav)
    }
    // Fallback to global settings if no user sessions exist
    if (allFavs.size === 0) {
      for (const fav of (cachedSettings.favorites ?? cachedSettings.pairs)) allFavs.add(fav)
    }

    const results = await runBatchScoring(allPairs, cachedSettings, allFavs)

    for (const r of results) {
      batchScoreCache.set(r.symbol, { score: r.score, direction: r.direction })
      const pair = allPairs.get(r.symbol)
      if (pair) {
        pair.confluenceScore = r.score
        pair.signalDirection = r.direction
      }

      // Paper trade: evaluate high-confidence signals per-user
      if (r.signal && r.indicators && r.priceData) {
        for (const [, session] of userSessions) {
          (async () => {
            try {
              const paperSettings = resolveStrategySettings(session.settings, r.symbol, 'paper')
              const paperSignal = generateSignal(r.indicators!, r.priceData!, paperSettings)
              if (paperSignal.confidence !== 'high') return
              const tf15m = { interval: '15m' as const, direction: paperSignal.direction, score: paperSignal.confluenceScore, trend: paperSignal.direction === 'LONG' ? 'Bullish' : paperSignal.direction === 'SHORT' ? 'Bearish' : 'Lateral', keyLevels: { ma20: r.indicators!.ma20, ma50: r.indicators!.ma50, ma200: r.indicators!.ma200 } }
              const [mtfData, extData] = await Promise.all([
                getMultiTimeframeData(r.symbol, tf15m, paperSettings).catch(() => undefined),
                fetchExternalData(r.symbol).catch(() => undefined),
              ])
              await session.paperTracker.evaluateAndOpen(r.symbol, paperSignal, r.indicators!, r.priceData!, paperSettings, mtfData, extData)
            } catch {}
          })()
        }
      }

      // Candle close check for open paper trades per-user
      if (r.signal) {
        for (const [, session] of userSessions) {
          const paperSettings = resolveStrategySettings(session.settings, r.symbol, 'paper')
          const paperSignal = r.indicators && r.priceData ? generateSignal(r.indicators, r.priceData, paperSettings) : r.signal
          session.paperTracker.onCandleClose(r.symbol, paperSignal, r.priceData?.price ?? pair?.price ?? 0).catch(() => {})
        }
      }
    }

    if (results.length > 0) {
      // Scope batch-scores by user plan
      for (const [uid, session] of userSessions) {
        const user = await getUserById(uid)
        const plan = user?.plan || 'free'
        if (plan === 'free') {
          // Free users: only first 10 scores
          io.to(`user:${uid}`).emit('batch-scores', results.slice(0, 10))
        } else {
          io.to(`user:${uid}`).emit('batch-scores', results)
        }
      }
    }
  }

  // Paper trade price checking: use aggregate stream price updates (per-user)
  wsManager.on('all-pairs-update', (allPairsMap: Map<string, BasicPairData>) => {
    for (const [symbol, data] of allPairsMap) {
      if (data.price > 0) {
        for (const [, session] of userSessions) {
          session.paperTracker.checkPrice(symbol, data.price).catch(() => {})
        }
      }
    }
  })

  // First run after 30s (let aggregate streams populate first)
  setTimeout(() => {
    doBatchScoring().catch(err => console.error('[BatchScorer] Error:', err.message))
  }, 30_000)

  // Then every 15min
  setInterval(() => {
    doBatchScoring().catch(err => console.error('[BatchScorer] Error:', err.message))
  }, BATCH_SCORE_INTERVAL)

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down gracefully')

    // 1. Stop accepting new connections
    httpServer.close()

    // 2. Close all Socket.io connections
    io.close()

    // 3. Stop WebSocket connections to Binance
    wsManager.stop()

    // 4. Flush signal buffer
    try {
      await flushBuffer()
      console.log('[Server] Signal buffer flushed')
    } catch {}

    // 5. Close DB pool
    try {
      const { pool } = await import('./database.js')
      await pool.end()
      console.log('[Server] Database pool closed')
    } catch {}

    logger.info('Shutdown complete')
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

main().catch((err) => {
  logger.fatal({ err }, 'Fatal error')
  process.exit(1)
})
