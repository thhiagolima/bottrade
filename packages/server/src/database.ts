import mysql, { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { SignalData, IndicatorValues, UserSettings, SignalRecord, Trade, TradeStats, PerformanceData } from '@bottrade/shared'
import { config } from './config.js'

export let pool: Pool

// Default settings for new users
export const defaultSettings: UserSettings = {
  userMode: 'trader',
  baseCapital: config.defaults.baseCapital,
  leverage: config.defaults.leverage,
  fundingThreshold: config.defaults.fundingThreshold,
  stochRsiHighThreshold: config.defaults.stochRsiHighThreshold,
  stochRsiLowThreshold: config.defaults.stochRsiLowThreshold,
  soundAlerts: config.defaults.soundAlerts,
  desktopNotifications: config.defaults.desktopNotifications,
  pairs: [...config.defaults.pairs],
  favorites: [...config.defaults.favorites],
  telegramBotToken: config.defaults.telegramBotToken,
  telegramChatId: config.defaults.telegramChatId,
  riskConfig: {
    slMode: 'auto',
    slFixedPercent: 1.5,
    atrMultiplier: 2.0,
    tpMode: 'rr',
    tpFixedPercent: 3.0,
    rrRatio: 2.0,
    useSmartMoneySR: true,
    minSlPercent: 0.5,
    maxSlPercent: 5.0,
  },
}

const CREATE_SIGNALS_TABLE = `
CREATE TABLE IF NOT EXISTS signals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  direction ENUM('LONG', 'SHORT', 'NEUTRO') NOT NULL,
  confluence_score DECIMAL(5,2) NOT NULL,
  confidence ENUM('normal', 'high') NOT NULL DEFAULT 'normal',
  entry_price DECIMAL(18,8) NOT NULL,
  stop_loss DECIMAL(18,8),
  take_profit DECIMAL(18,8),
  risk_reward_ratio DECIMAL(4,2),
  funding_rate DECIMAL(10,6),
  critical_decision TEXT,
  action_points JSON,
  overrides JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_symbol (symbol),
  INDEX idx_created_at (created_at)
)`

const CREATE_INDICATOR_SNAPSHOTS_TABLE = `
CREATE TABLE IF NOT EXISTS indicator_snapshots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  signal_id INT NOT NULL,
  ma20 DECIMAL(18,8), ma50 DECIMAL(18,8),
  ma100 DECIMAL(18,8), ma200 DECIMAL(18,8),
  ema20 DECIMAL(18,8), ema50 DECIMAL(18,8),
  macd_value DECIMAL(18,8), macd_signal DECIMAL(18,8), macd_histogram DECIMAL(18,8),
  macd_divergence VARCHAR(10),
  stoch_k DECIMAL(8,4), stoch_d DECIMAL(8,4),
  stoch_persistent_overbought BOOLEAN DEFAULT FALSE,
  stoch_persistent_oversold BOOLEAN DEFAULT FALSE,
  volume_current DECIMAL(24,8), volume_average DECIMAL(24,8),
  volume_is_spike BOOLEAN DEFAULT FALSE,
  volume_candle_direction ENUM('green', 'red') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_signal_id (signal_id),
  FOREIGN KEY (signal_id) REFERENCES signals(id) ON DELETE CASCADE
)`

const CREATE_SETTINGS_TABLE = `
CREATE TABLE IF NOT EXISTS settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  key_name VARCHAR(50) UNIQUE NOT NULL,
  value JSON NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)`

const CREATE_TRADES_TABLE = `
CREATE TABLE IF NOT EXISTS trades (
  id INT AUTO_INCREMENT PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  direction ENUM('LONG', 'SHORT') NOT NULL,
  entry_price DECIMAL(18,8) NOT NULL,
  stop_loss DECIMAL(18,8) NOT NULL,
  take_profit DECIMAL(18,8) NOT NULL,
  exit_price DECIMAL(18,8),
  result ENUM('WIN', 'LOSS'),
  pnl_percent DECIMAL(8,4),
  confluence_score DECIMAL(5,2) NOT NULL,
  status ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
  opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP NULL,
  partial_tp_price DECIMAL(18,8) NULL,
  partial_tp_pnl DECIMAL(8,4) NULL,
  partial_tp_at TIMESTAMP NULL,
  INDEX idx_symbol (symbol),
  INDEX idx_status (status),
  INDEX idx_opened_at (opened_at)
)`

const CREATE_PAPER_TRADES_TABLE = `
CREATE TABLE IF NOT EXISTS paper_trades (
  id INT AUTO_INCREMENT PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  direction ENUM('LONG', 'SHORT') NOT NULL,
  entry_price DECIMAL(18,8) NOT NULL,
  stop_loss DECIMAL(18,8) NOT NULL,
  take_profit DECIMAL(18,8) NOT NULL,
  exit_price DECIMAL(18,8),
  result ENUM('WIN', 'LOSS'),
  exit_reason VARCHAR(20),
  pnl_percent DECIMAL(8,4),
  confluence_score DECIMAL(5,2) NOT NULL,
  status ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
  opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP NULL,
  partial_tp_price DECIMAL(18,8) NULL,
  partial_tp_pnl DECIMAL(8,4) NULL,
  partial_tp_at TIMESTAMP NULL,
  entry_filters JSON,
  INDEX idx_symbol (symbol),
  INDEX idx_status (status),
  INDEX idx_opened_at (opened_at)
)`

const CREATE_USER_SETTINGS_TABLE = `
CREATE TABLE IF NOT EXISTS user_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL UNIQUE,
  settings JSON NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_settings_user (user_id)
)`

async function createPoolWithRetry(maxRetries = 10): Promise<Pool> {
  let delay = 1000

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const p = mysql.createPool({
        host: config.db.host,
        user: config.db.user,
        password: config.db.password,
        database: config.db.database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      })

      // Test the connection
      const conn = await p.getConnection()
      conn.release()
      console.log('[DB] Connected to MySQL successfully')
      return p
    } catch (err) {
      console.error(`[DB] Connection attempt ${attempt} failed:`, (err as Error).message)
      if (attempt === maxRetries) {
        throw err
      }
      console.log(`[DB] Retrying in ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
      delay = Math.min(delay * 2, 30_000)
    }
  }

  // Unreachable but satisfies TypeScript
  throw new Error('[DB] Failed to connect after all retries')
}

export async function initDatabase(): Promise<void> {
  pool = await createPoolWithRetry()

  try {
    await pool.execute(CREATE_SIGNALS_TABLE)
    await pool.execute(CREATE_INDICATOR_SNAPSHOTS_TABLE)
    await pool.execute(CREATE_SETTINGS_TABLE)
    await pool.execute(CREATE_TRADES_TABLE)
    await pool.execute(CREATE_PAPER_TRADES_TABLE)
    console.log('[DB] Tables created/verified successfully')

    // Multi-tenancy: add user_id to all tables
    const alterations = [
      'ALTER TABLE signals ADD COLUMN user_id INT NULL AFTER id',
      'ALTER TABLE signals ADD INDEX idx_user_id (user_id)',
      'ALTER TABLE trades ADD COLUMN user_id INT NULL AFTER id',
      'ALTER TABLE trades ADD INDEX idx_trades_user_id (user_id)',
      'ALTER TABLE paper_trades ADD COLUMN user_id INT NULL AFTER id',
      'ALTER TABLE paper_trades ADD INDEX idx_paper_user_id (user_id)',
    ]

    for (const sql of alterations) {
      try {
        await pool.execute(sql)
      } catch {
        // Column/index already exists
      }
    }

    console.log('[DB] Multi-tenancy columns verified')

    // Token blacklist table (persistent across restarts)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS token_blacklist (
        token_hash VARCHAR(64) PRIMARY KEY,
        expires_at TIMESTAMP NOT NULL,
        INDEX idx_expires (expires_at)
      )
    `)
    console.log('[DB] Token blacklist table ready')

    // Trade runtime state columns
    const tradeAlterations = [
      'ALTER TABLE trades ADD COLUMN current_stop_loss DECIMAL(18,8) NULL',
      'ALTER TABLE trades ADD COLUMN partial_closed BOOLEAN DEFAULT FALSE',
      'ALTER TABLE trades ADD COLUMN candle_count INT DEFAULT 0',
      'ALTER TABLE trades ADD COLUMN peak_pnl DECIMAL(8,4) DEFAULT 0',
    ]

    for (const sql of tradeAlterations) {
      try {
        await pool.execute(sql)
      } catch {
        // Column already exists
      }
    }

    console.log('[DB] Trade runtime state columns verified')
  } catch (err) {
    console.error('[DB] Failed to create tables:', (err as Error).message)
    throw err
  }
}

export async function initUserSettingsTable(): Promise<void> {
  await pool.execute(CREATE_USER_SETTINGS_TABLE)
  console.log('[DB] User settings table ready')
}

// Signal buffer for MySQL outages (max 100 entries)
interface BufferedSignal {
  signal: SignalData
  indicators: IndicatorValues
  symbol: string
  price: number
  userId?: number
}

const signalBuffer: BufferedSignal[] = []
const MAX_BUFFER_SIZE = 100

export async function saveSignal(
  userId: number,
  symbol: string,
  signal: SignalData,
  indicators: IndicatorValues
): Promise<number | null> {
  try {
    const entryPrice = signal.riskManagement?.entry ?? 0
    const stopLoss = signal.direction === 'NEUTRO' ? null : (signal.riskManagement?.stopLoss ?? null)
    const takeProfit = signal.riskManagement?.takeProfit ?? null
    const riskRewardRatio = signal.riskManagement?.riskRewardRatio ?? null

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO signals (user_id, symbol, direction, confluence_score, confidence, entry_price, stop_loss, take_profit, risk_reward_ratio, funding_rate, critical_decision, action_points, overrides)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        symbol,
        signal.direction,
        signal.confluenceScore,
        signal.confidence,
        entryPrice,
        stopLoss,
        takeProfit,
        riskRewardRatio,
        null, // funding_rate is not in SignalData, set from PriceData externally if needed
        signal.criticalDecision || null,
        JSON.stringify(signal.actionPoints),
        JSON.stringify(signal.overrides),
      ]
    )

    const signalId = result.insertId

    await pool.execute(
      `INSERT INTO indicator_snapshots (signal_id, ma20, ma50, ma100, ma200, ema20, ema50, macd_value, macd_signal, macd_histogram, macd_divergence, stoch_k, stoch_d, stoch_persistent_overbought, stoch_persistent_oversold, volume_current, volume_average, volume_is_spike, volume_candle_direction)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        signalId,
        indicators.ma20,
        indicators.ma50,
        indicators.ma100,
        indicators.ma200,
        indicators.ema20,
        indicators.ema50,
        indicators.macd.macd,
        indicators.macd.signal,
        indicators.macd.histogram,
        indicators.macd.divergence,
        indicators.stochRsi.k,
        indicators.stochRsi.d,
        indicators.stochRsi.persistentOverbought,
        indicators.stochRsi.persistentOversold,
        indicators.volume.current,
        indicators.volume.average,
        indicators.volume.isSpike,
        indicators.volume.candleDirection,
      ]
    )

    console.log(`[DB] Signal saved: ${symbol} ${signal.direction} (id: ${signalId}, user: ${userId})`)
    return signalId
  } catch (err) {
    console.error('[DB] Failed to save signal:', (err as Error).message)
    if (signalBuffer.length < MAX_BUFFER_SIZE) {
      signalBuffer.push({
        signal,
        indicators,
        symbol,
        price: signal.riskManagement?.entry ?? 0,
        userId,
      })
      console.log(`[DB] Signal buffered (${signalBuffer.length}/${MAX_BUFFER_SIZE})`)
    }
    return null
  }
}

// ── User-scoped settings ──────────────────────────────────────────────────────

export async function getUserSettings(userId: number): Promise<UserSettings> {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT settings FROM user_settings WHERE user_id = ?',
      [userId]
    )
    if (rows.length === 0) {
      return { ...defaultSettings, pairs: [...defaultSettings.pairs], favorites: [...defaultSettings.favorites] }
    }
    const parsed = typeof rows[0].settings === 'string'
      ? JSON.parse(rows[0].settings)
      : rows[0].settings
    return { ...defaultSettings, ...parsed }
  } catch (err) {
    console.error('[DB] Failed to get user settings:', (err as Error).message)
    return { ...defaultSettings, pairs: [...defaultSettings.pairs], favorites: [...defaultSettings.favorites] }
  }
}

export async function updateUserSettings(userId: number, partial: Partial<UserSettings>): Promise<UserSettings> {
  const current = await getUserSettings(userId)
  const merged = { ...current, ...partial }
  const json = JSON.stringify(merged)

  await pool.execute(
    `INSERT INTO user_settings (user_id, settings) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE settings = ?, updated_at = NOW()`,
    [userId, json, json]
  )

  console.log(`[DB] User settings updated (user: ${userId})`)
  return merged
}

// ── Deprecated: global settings (use getUserSettings/updateUserSettings instead) ──

/** @deprecated Use getUserSettings(userId) instead */
export async function getSettings(): Promise<UserSettings> {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT value FROM settings WHERE key_name = 'user_settings'`
    )

    if (rows.length > 0) {
      try {
        const value = typeof rows[0].value === 'string'
          ? JSON.parse(rows[0].value)
          : rows[0].value
        return value as UserSettings
      } catch (parseErr) {
        console.error('[DB] Failed to parse settings JSON:', (parseErr as Error).message)
      }
    }
  } catch (err) {
    console.error('[DB] Failed to get settings:', (err as Error).message)
  }

  return { ...defaultSettings, pairs: [...defaultSettings.pairs], favorites: [...defaultSettings.favorites] }
}

/** @deprecated Use updateUserSettings(userId, partial) instead */
export async function updateSettings(partial: Partial<UserSettings>): Promise<UserSettings> {
  const current = await getSettings()
  const merged: UserSettings = { ...current, ...partial }

  const jsonValue = JSON.stringify(merged)

  await pool.execute(
    `INSERT INTO settings (key_name, value) VALUES ('user_settings', ?)
     ON DUPLICATE KEY UPDATE value = ?`,
    [jsonValue, jsonValue]
  )

  console.log('[DB] Settings updated')
  return merged
}

// ── Signal history ──────────────────────────────────────────────────────────

export async function getHistory(
  userId: number,
  symbol?: string,
  limit = 50,
  offset = 0
): Promise<{ signals: SignalRecord[]; total: number }> {
  const conditions: string[] = ['user_id = ?']
  const params: (string | number)[] = [userId]

  if (symbol) {
    conditions.push('symbol = ?')
    params.push(symbol)
  }

  const whereClause = 'WHERE ' + conditions.join(' AND ')

  const [countRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM signals ${whereClause}`,
    params
  )
  const total = countRows[0].total as number

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM signals ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  )

  const signals: SignalRecord[] = rows.map(row => ({
    id: row.id,
    symbol: row.symbol,
    direction: row.direction,
    confluenceScore: Number(row.confluence_score),
    confidence: row.confidence,
    entryPrice: Number(row.entry_price),
    stopLoss: row.stop_loss != null ? Number(row.stop_loss) : null,
    takeProfit: row.take_profit != null ? Number(row.take_profit) : null,
    riskRewardRatio: row.risk_reward_ratio != null ? Number(row.risk_reward_ratio) : null,
    fundingRate: row.funding_rate != null ? Number(row.funding_rate) : null,
    criticalDecision: row.critical_decision,
    actionPoints: typeof row.action_points === 'string'
      ? JSON.parse(row.action_points)
      : (row.action_points ?? []),
    overrides: typeof row.overrides === 'string'
      ? JSON.parse(row.overrides)
      : (row.overrides ?? []),
    createdAt: new Date(row.created_at).toISOString(),
  }))

  return { signals, total }
}

export async function flushBuffer(): Promise<void> {
  if (signalBuffer.length === 0) return

  try {
    // Test if pool is connected
    const conn = await pool.getConnection()
    conn.release()
  } catch {
    console.log('[DB] Cannot flush buffer - database not available')
    return
  }

  const toFlush = signalBuffer.splice(0, signalBuffer.length)
  console.log(`[DB] Flushing ${toFlush.length} buffered signals...`)
  let flushed = 0
  const failed: BufferedSignal[] = []

  for (const entry of toFlush) {
    const result = await saveSignal(entry.userId ?? 0, entry.symbol, entry.signal, entry.indicators)
    if (result !== null) {
      flushed++
    } else {
      failed.push(entry)
    }
  }

  // Push back any that failed to save
  if (failed.length > 0) {
    signalBuffer.push(...failed)
  }

  console.log(`[DB] Flushed ${flushed}/${toFlush.length} buffered signals`)
}

// ── Trade functions ─────────────────────────────────────────────────────────

export async function insertTrade(userId: number, trade: Omit<Trade, 'id'>): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO trades (user_id, symbol, direction, entry_price, stop_loss, take_profit, exit_price, result, pnl_percent, confluence_score, status, opened_at, closed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NULL)`,
    [
      userId,
      trade.symbol,
      trade.direction,
      trade.entryPrice,
      trade.stopLoss,
      trade.takeProfit,
      trade.exitPrice,
      trade.result,
      trade.pnlPercent,
      trade.confluenceScore,
      trade.status,
    ]
  )
  return result.insertId
}

export async function closeTrade(
  userId: number,
  id: number,
  exitPrice: number,
  result: 'WIN' | 'LOSS',
  pnlPercent: number
): Promise<void> {
  await pool.execute(
    `UPDATE trades SET exit_price = ?, result = ?, pnl_percent = ?, status = 'CLOSED', closed_at = NOW() WHERE id = ? AND user_id = ?`,
    [exitPrice, result, pnlPercent, id, userId]
  )
}

export async function updatePartialTp(
  userId: number,
  id: number,
  partialTpPrice: number,
  partialTpPnl: number,
): Promise<void> {
  await pool.execute(
    `UPDATE trades SET partial_tp_price = ?, partial_tp_pnl = ?, partial_tp_at = NOW() WHERE id = ? AND user_id = ?`,
    [partialTpPrice, partialTpPnl, id, userId]
  )
}

export async function updateTradeRuntimeState(userId: number, tradeId: number, state: { currentStopLoss: number, partialClosed: boolean, candleCount: number, peakPnl: number }): Promise<void> {
  await pool.execute(
    `UPDATE trades SET current_stop_loss = ?, partial_closed = ?, candle_count = ?, peak_pnl = ? WHERE id = ? AND user_id = ?`,
    [state.currentStopLoss, state.partialClosed ? 1 : 0, state.candleCount, state.peakPnl, tradeId, userId]
  )
}

export async function getOpenTrades(userId: number): Promise<Trade[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM trades WHERE status = 'OPEN' AND user_id = ?`,
    [userId]
  )
  return rows.map(mapRowToTrade)
}

export async function getTradeHistory(
  userId: number,
  symbol?: string,
  limit = 50,
  offset = 0
): Promise<{ trades: Trade[]; total: number }> {
  const conditions: string[] = ['user_id = ?']
  const params: (string | number)[] = [userId]

  if (symbol) {
    conditions.push('symbol = ?')
    params.push(symbol)
  }

  const whereClause = 'WHERE ' + conditions.join(' AND ')

  const [countRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM trades ${whereClause}`,
    params
  )
  const total = countRows[0].total as number

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM trades ${whereClause} ORDER BY opened_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  )

  return { trades: rows.map(mapRowToTrade), total }
}

export async function getTradeStats(userId: number, symbol?: string): Promise<TradeStats> {
  const conditions: string[] = ['user_id = ?', "status = 'CLOSED'"]
  const params: (string | number)[] = [userId]

  if (symbol) {
    conditions.push('symbol = ?')
    params.push(symbol)
  }

  const closedWhere = 'WHERE ' + conditions.join(' AND ')

  const [totalRows] = await pool.execute<RowDataPacket[]>(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN result = 'WIN' THEN 1 ELSE 0 END) as wins,
       SUM(CASE WHEN result = 'LOSS' THEN 1 ELSE 0 END) as losses
     FROM trades ${closedWhere}`,
    params
  )

  const row = totalRows[0]
  const totalTrades = Number(row.total) || 0
  const wins = Number(row.wins) || 0
  const losses = Number(row.losses) || 0

  const [pnlRows] = await pool.execute<RowDataPacket[]>(
    `SELECT
       AVG(CASE WHEN result = 'WIN' THEN pnl_percent ELSE NULL END) as avg_win,
       AVG(CASE WHEN result = 'LOSS' THEN pnl_percent ELSE NULL END) as avg_loss,
       MAX(pnl_percent) as best,
       MIN(pnl_percent) as worst
     FROM trades ${closedWhere}`,
    params
  )

  const pnl = pnlRows[0]

  return {
    symbol: symbol ?? null,
    totalTrades,
    wins,
    losses,
    winRate: totalTrades > 0 ? (wins / totalTrades) * 100 : 0,
    avgWinPnl: Number(pnl.avg_win) || 0,
    avgLossPnl: Number(pnl.avg_loss) || 0,
    bestTrade: Number(pnl.best) || 0,
    worstTrade: Number(pnl.worst) || 0,
  }
}

export async function getPerformanceData(userId: number, symbol?: string): Promise<PerformanceData> {
  const closedConditions: string[] = ['user_id = ?', "status = 'CLOSED'"]
  const baseConditions: string[] = ['user_id = ?']
  const params: (string | number)[] = [userId]

  if (symbol) {
    closedConditions.push('symbol = ?')
    baseConditions.push('symbol = ?')
    params.push(symbol)
  }

  const closedWhere = 'WHERE ' + closedConditions.join(' AND ')
  const whereBase = 'WHERE ' + baseConditions.join(' AND ')

  // 1. Get all closed trades ordered by closed_at
  const [closedRows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM trades ${closedWhere} ORDER BY closed_at ASC`,
    params
  )
  const closedTrades: Trade[] = closedRows.map(mapRowToTrade)

  // 2. Build equity curve starting from base 100
  let equity = 100
  let peak = 100
  let maxDrawdown = 0
  const equityCurve: PerformanceData['equityCurve'] = []

  for (const t of closedTrades) {
    const pnl = t.pnlPercent ?? 0
    equity = equity * (1 + pnl / 100)
    if (equity > peak) peak = equity
    const dd = ((peak - equity) / peak) * 100
    if (dd > maxDrawdown) maxDrawdown = dd
    equityCurve.push({
      timestamp: t.closedAt ?? t.openedAt,
      equity,
      trade: { symbol: t.symbol, direction: t.direction, pnlPercent: pnl },
    })
  }

  // 3. Group by symbol
  const symbolMap = new Map<string, { trades: number; wins: number; losses: number; pnl: number }>()
  for (const t of closedTrades) {
    const s = symbolMap.get(t.symbol) ?? { trades: 0, wins: 0, losses: 0, pnl: 0 }
    s.trades++
    if (t.result === 'WIN') s.wins++
    else s.losses++
    s.pnl += t.pnlPercent ?? 0
    symbolMap.set(t.symbol, s)
  }
  const bySymbol = Array.from(symbolMap.entries())
    .map(([sym, s]) => ({
      symbol: sym,
      trades: s.trades,
      wins: s.wins,
      losses: s.losses,
      winRate: s.trades > 0 ? (s.wins / s.trades) * 100 : 0,
      pnl: s.pnl,
    }))
    .sort((a, b) => b.pnl - a.pnl)

  // 4. Group by direction
  const dirMap = new Map<string, { trades: number; wins: number; losses: number; pnl: number }>()
  for (const t of closedTrades) {
    const d = dirMap.get(t.direction) ?? { trades: 0, wins: 0, losses: 0, pnl: 0 }
    d.trades++
    if (t.result === 'WIN') d.wins++
    else d.losses++
    d.pnl += t.pnlPercent ?? 0
    dirMap.set(t.direction, d)
  }
  const byDirection = Array.from(dirMap.entries()).map(([dir, d]) => ({
    direction: dir,
    trades: d.trades,
    wins: d.wins,
    losses: d.losses,
    winRate: d.trades > 0 ? (d.wins / d.trades) * 100 : 0,
    pnl: d.pnl,
  }))

  // 5. Group by day period
  const dayMap = new Map<string, { trades: number; wins: number; pnl: number }>()
  for (const t of closedTrades) {
    const date = (t.closedAt ?? t.openedAt).slice(0, 10)
    const d = dayMap.get(date) ?? { trades: 0, wins: 0, pnl: 0 }
    d.trades++
    if (t.result === 'WIN') d.wins++
    d.pnl += t.pnlPercent ?? 0
    dayMap.set(date, d)
  }
  const byPeriod = Array.from(dayMap.entries())
    .map(([period, d]) => ({ period, trades: d.trades, wins: d.wins, pnl: d.pnl }))
    .sort((a, b) => a.period.localeCompare(b.period))

  // 6. Best and worst day
  let bestDay = { date: '-', pnl: 0 }
  let worstDay = { date: '-', pnl: 0 }
  for (const d of byPeriod) {
    if (d.pnl > bestDay.pnl) bestDay = { date: d.period, pnl: d.pnl }
    if (d.pnl < worstDay.pnl) worstDay = { date: d.period, pnl: d.pnl }
  }

  // 7. Totals
  const totalTrades = closedTrades.length
  const wins = closedTrades.filter((t) => t.result === 'WIN').length
  const losses = closedTrades.filter((t) => t.result === 'LOSS').length
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0
  const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnlPercent ?? 0), 0)

  const totalWinPnl = closedTrades
    .filter((t) => t.result === 'WIN')
    .reduce((sum, t) => sum + (t.pnlPercent ?? 0), 0)
  const totalLossPnl = Math.abs(
    closedTrades
      .filter((t) => t.result === 'LOSS')
      .reduce((sum, t) => sum + (t.pnlPercent ?? 0), 0)
  )
  const profitFactor = totalLossPnl > 0 ? totalWinPnl / totalLossPnl : totalWinPnl > 0 ? Infinity : 0

  // 8. Recent trades (last 20 from all trades, not just closed)
  const [recentRows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM trades ${whereBase} ORDER BY opened_at DESC LIMIT 20`,
    params
  )
  const recentTrades = recentRows.map(mapRowToTrade)

  return {
    equityCurve,
    bySymbol,
    byDirection,
    byPeriod,
    maxDrawdown,
    bestDay,
    worstDay,
    totalPnl,
    winRate,
    totalTrades,
    profitFactor,
    recentTrades,
  }
}

function mapRowToTrade(row: RowDataPacket): Trade {
  return {
    id: row.id,
    symbol: row.symbol,
    direction: row.direction,
    entryPrice: Number(row.entry_price),
    stopLoss: Number(row.stop_loss),
    takeProfit: Number(row.take_profit),
    exitPrice: row.exit_price != null ? Number(row.exit_price) : null,
    result: row.result ?? null,
    pnlPercent: row.pnl_percent != null ? Number(row.pnl_percent) : null,
    confluenceScore: Number(row.confluence_score),
    status: row.status,
    openedAt: String(row.opened_at),
    closedAt: row.closed_at ? String(row.closed_at) : null,
    partialTpPrice: row.partial_tp_price != null ? Number(row.partial_tp_price) : null,
    partialTpPnl: row.partial_tp_pnl != null ? Number(row.partial_tp_pnl) : null,
    partialTpAt: row.partial_tp_at ? String(row.partial_tp_at) : null,
    // Runtime state (persisted)
    currentStopLoss: row.current_stop_loss != null ? Number(row.current_stop_loss) : undefined,
    partialClosed: row.partial_closed === 1 || row.partial_closed === true,
    candleCount: row.candle_count != null ? Number(row.candle_count) : 0,
    peakPnl: row.peak_pnl != null ? Number(row.peak_pnl) : 0,
  }
}

// ── Paper Trade functions ───────────────────────────────────────────────────

export async function insertPaperTrade(userId: number, trade: Record<string, unknown>): Promise<number> {
  const params = [
    userId,
    String(trade.symbol), String(trade.direction),
    Number(trade.entryPrice), Number(trade.stopLoss), Number(trade.takeProfit),
    Number(trade.confluenceScore),
    trade.entryFilters ? JSON.stringify(trade.entryFilters) : null,
  ]
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO paper_trades (user_id, symbol, direction, entry_price, stop_loss, take_profit, confluence_score, status, entry_filters)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'OPEN', ?)`,
    params
  )
  return result.insertId
}

export async function closePaperTrade(userId: number, id: number, exitPrice: number, result: 'WIN' | 'LOSS', pnlPercent: number, exitReason: string): Promise<void> {
  await pool.execute(
    `UPDATE paper_trades SET exit_price = ?, result = ?, pnl_percent = ?, exit_reason = ?, status = 'CLOSED', closed_at = NOW() WHERE id = ? AND user_id = ?`,
    [exitPrice, result, pnlPercent, exitReason, id, userId]
  )
}

export async function updatePaperPartialTp(userId: number, id: number, price: number, pnl: number): Promise<void> {
  await pool.execute(
    `UPDATE paper_trades SET partial_tp_price = ?, partial_tp_pnl = ?, partial_tp_at = NOW() WHERE id = ? AND user_id = ?`,
    [price, pnl, id, userId]
  )
}

export async function getOpenPaperTrades(userId: number): Promise<Trade[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM paper_trades WHERE status = 'OPEN' AND user_id = ?`,
    [userId]
  )
  return rows.map(mapRowToPaperTrade)
}

export async function getPaperTradeHistory(userId: number, symbol?: string, limit = 50, offset = 0): Promise<{ trades: Trade[]; total: number }> {
  const conditions: string[] = ['user_id = ?']
  const params: (string | number)[] = [userId]

  if (symbol) {
    conditions.push('symbol = ?')
    params.push(symbol)
  }

  const whereClause = 'WHERE ' + conditions.join(' AND ')

  const [countRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM paper_trades ${whereClause}`,
    params
  )
  const total = countRows[0].total as number

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM paper_trades ${whereClause} ORDER BY opened_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  )
  return { trades: rows.map(mapRowToPaperTrade), total }
}

export async function getPaperTradeStats(userId: number, symbol?: string): Promise<TradeStats> {
  const conditions: string[] = ['user_id = ?', "status = 'CLOSED'"]
  const params: (string | number)[] = [userId]

  if (symbol) {
    conditions.push('symbol = ?')
    params.push(symbol)
  }

  const closed = 'WHERE ' + conditions.join(' AND ')

  const [totalRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as total, SUM(CASE WHEN result='WIN' THEN 1 ELSE 0 END) as wins, SUM(CASE WHEN result='LOSS' THEN 1 ELSE 0 END) as losses FROM paper_trades ${closed}`, params
  )
  const row = totalRows[0]
  const totalTrades = Number(row.total) || 0
  const wins = Number(row.wins) || 0
  const losses = Number(row.losses) || 0
  const [pnlRows] = await pool.execute<RowDataPacket[]>(
    `SELECT AVG(CASE WHEN result='WIN' THEN pnl_percent ELSE NULL END) as avg_win, AVG(CASE WHEN result='LOSS' THEN pnl_percent ELSE NULL END) as avg_loss, MAX(pnl_percent) as best, MIN(pnl_percent) as worst FROM paper_trades ${closed}`, params
  )
  const pnl = pnlRows[0]
  return {
    symbol: symbol ?? null, totalTrades, wins, losses,
    winRate: totalTrades > 0 ? (wins / totalTrades) * 100 : 0,
    avgWinPnl: Number(pnl.avg_win) || 0, avgLossPnl: Number(pnl.avg_loss) || 0,
    bestTrade: Number(pnl.best) || 0, worstTrade: Number(pnl.worst) || 0,
  }
}

function mapRowToPaperTrade(row: RowDataPacket): Trade {
  return {
    id: row.id, symbol: row.symbol, direction: row.direction,
    entryPrice: Number(row.entry_price), stopLoss: Number(row.stop_loss), takeProfit: Number(row.take_profit),
    exitPrice: row.exit_price != null ? Number(row.exit_price) : null,
    result: row.result ?? null, exitReason: row.exit_reason ?? undefined,
    pnlPercent: row.pnl_percent != null ? Number(row.pnl_percent) : null,
    confluenceScore: Number(row.confluence_score), status: row.status,
    openedAt: String(row.opened_at), closedAt: row.closed_at ? String(row.closed_at) : null,
    partialTpPrice: row.partial_tp_price != null ? Number(row.partial_tp_price) : null,
    partialTpPnl: row.partial_tp_pnl != null ? Number(row.partial_tp_pnl) : null,
    partialTpAt: row.partial_tp_at ? String(row.partial_tp_at) : null,
  }
}

// ── Token Blacklist DB functions ────────────────────────────────────────────

export async function blacklistTokenDB(tokenHash: string, expiresAt: Date): Promise<void> {
  await pool.execute('INSERT IGNORE INTO token_blacklist (token_hash, expires_at) VALUES (?, ?)', [tokenHash, expiresAt])
}

export async function isTokenBlacklistedDB(tokenHash: string): Promise<boolean> {
  const [rows] = await pool.execute<RowDataPacket[]>('SELECT 1 FROM token_blacklist WHERE token_hash = ?', [tokenHash])
  return rows.length > 0
}

export async function cleanupExpiredTokens(): Promise<void> {
  await pool.execute('DELETE FROM token_blacklist WHERE expires_at < NOW()')
}
