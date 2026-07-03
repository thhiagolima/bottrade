import { pool } from './database.js'
import type { ResultSetHeader } from 'mysql2/promise'

export type AuditAction =
  | 'USER_REGISTER'
  | 'USER_LOGIN'
  | 'USER_LOGIN_FAILED'
  | 'PASSWORD_RESET'
  | 'ACCOUNT_DELETED'
  | 'SETTINGS_UPDATE'
  | 'ORDER_EXECUTE'
  | 'ORDER_FAILED'
  | 'TRADE_OPENED'
  | 'TRADE_CLOSED'
  | 'API_KEY_CHANGED'
  | 'FAVORITE_TOGGLE'
  | 'FAVORITE_REPLACE'
  | 'ALERT_CREATE'
  | 'ALERT_DELETE'
  | 'BACKTEST_RUN'
  | 'AUTO_TRADE_TOGGLE'

export interface AuditEntry {
  userId: number | null
  action: AuditAction
  details: Record<string, unknown>
  ip?: string
}

export async function initAuditTable(): Promise<void> {
  const conn = await pool.getConnection()
  try {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NULL,
        action VARCHAR(50) NOT NULL,
        details JSON,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_action (action),
        INDEX idx_created_at (created_at)
      )
    `)
    console.log('[Audit] Audit log table ready')
  } finally {
    conn.release()
  }
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await pool.execute<ResultSetHeader>(
      'INSERT INTO audit_log (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
      [entry.userId, entry.action, JSON.stringify(entry.details), entry.ip || null]
    )
  } catch (err) {
    // Never let audit logging break the application
    console.error('[Audit] Failed to log:', (err as Error).message)
  }
}

export async function getAuditLog(params: {
  userId?: number
  action?: AuditAction
  limit?: number
  offset?: number
}): Promise<unknown[]> {
  const conditions: string[] = []
  const values: unknown[] = []

  if (params.userId) {
    conditions.push('user_id = ?')
    values.push(params.userId)
  }
  if (params.action) {
    conditions.push('action = ?')
    values.push(params.action)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = Math.min(Math.max(1, params.limit || 50), 200)
  const offset = Math.max(0, params.offset || 0)

  const sql = `SELECT * FROM audit_log ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  const [rows] = await pool.execute({ sql, values: [...values, limit, offset] })
  return rows as unknown[]
}
