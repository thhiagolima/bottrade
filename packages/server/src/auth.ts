import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { createHash, randomBytes } from 'crypto'
import { pool, blacklistTokenDB, isTokenBlacklistedDB } from './database.js'
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'

if (!process.env.JWT_SECRET) {
  console.error('[AUTH] FATAL: JWT_SECRET environment variable is not set!')
  process.exit(1)
}
const JWT_SECRET: string = process.env.JWT_SECRET
const JWT_EXPIRES_IN = '4h'

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function blacklistToken(token: string): Promise<void> {
  const hash = hashToken(token)
  const expires = new Date(Date.now() + 4 * 60 * 60 * 1000) // 4h
  await blacklistTokenDB(hash, expires)
}

export async function isTokenBlacklisted(token: string): Promise<boolean> {
  return isTokenBlacklistedDB(hashToken(token))
}

export interface AuthUser {
  id: number
  clerkUserId?: string | null
  email: string
  name: string
  role: 'user' | 'admin'
  plan: 'free' | 'pro' | 'trader'
  planExpiresAt: string | null
  stripe_customer_id: string | null
  createdAt: string
}

export interface AuthResult {
  success: boolean
  user?: AuthUser
  token?: string
  error?: string
}

// Create users table if not exists
export async function initAuthTables(): Promise<void> {
  const conn = await pool.getConnection()
  try {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        clerk_user_id VARCHAR(255) NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('user', 'admin') DEFAULT 'user',
        plan ENUM('free', 'pro', 'trader') DEFAULT 'free',
        plan_expires_at TIMESTAMP NULL,
        stripe_customer_id VARCHAR(255) NULL,
        stripe_subscription_id VARCHAR(255) NULL,
        is_active BOOLEAN DEFAULT TRUE,
        last_login TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_active (is_active)
      )
    `)
    // Add plan columns if they don't exist (for existing databases)
    try {
      await conn.execute(`ALTER TABLE users ADD COLUMN plan ENUM('free', 'pro', 'trader') DEFAULT 'free'`)
    } catch { /* column already exists */ }
    try {
      await conn.execute(`ALTER TABLE users ADD COLUMN plan_expires_at TIMESTAMP NULL`)
    } catch { /* column already exists */ }
    try {
      await conn.execute(`ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255) NULL`)
    } catch { /* column already exists */ }
    try {
      await conn.execute(`ALTER TABLE users ADD COLUMN stripe_subscription_id VARCHAR(255) NULL`)
    } catch { /* column already exists */ }
    try {
      await conn.execute(`ALTER TABLE users ADD COLUMN clerk_user_id VARCHAR(255) NULL UNIQUE`)
    } catch { /* column already exists */ }

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        token_hash VARCHAR(64) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_token (token_hash),
        INDEX idx_user (user_id)
      )
    `)

    console.log('[Auth] Users table ready')
  } finally {
    conn.release()
  }
}

export async function registerUser(email: string, name: string, password: string): Promise<AuthResult> {
  try {
    // Validate
    if (!email || !name || !password) {
      return { success: false, error: 'Email, nome e senha são obrigatórios' }
    }
    if (password.length < 8) {
      return { success: false, error: 'Senha deve ter pelo menos 8 caracteres' }
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return { success: false, error: 'Email inválido' }
    }

    // Check if email already exists
    const [existing] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM users WHERE email = ?', [email.toLowerCase()]
    )
    if (existing.length > 0) {
      return { success: false, error: 'Não foi possível criar a conta. Tente novamente.' }
    }

    // Hash password
    const salt = await bcrypt.genSalt(12)
    const passwordHash = await bcrypt.hash(password, salt)

    // Insert user
    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)',
      [email.toLowerCase(), name, passwordHash]
    )

    const user: AuthUser = {
      id: result.insertId,
      clerkUserId: null,
      email: email.toLowerCase(),
      name,
      role: 'user',
      plan: 'free',
      planExpiresAt: null,
      stripe_customer_id: null,
      createdAt: new Date().toISOString()
    }

    const token = generateToken(user)
    return { success: true, user, token }
  } catch (err) {
    console.error('[Auth] Register error:', (err as Error).message)
    return { success: false, error: 'Erro ao registrar usuário' }
  }
}

export async function loginUser(email: string, password: string): Promise<AuthResult> {
  try {
    if (!email || !password) {
      return { success: false, error: 'Email e senha são obrigatórios' }
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT id, clerk_user_id, email, name, password_hash, role, plan, plan_expires_at, stripe_customer_id, is_active, created_at FROM users WHERE email = ?',
      [email.toLowerCase()]
    )

    if (rows.length === 0) {
      return { success: false, error: 'Email ou senha incorretos' }
    }

    const row = rows[0]
    if (!row.is_active) {
      return { success: false, error: 'Conta desativada' }
    }

    const valid = await bcrypt.compare(password, row.password_hash)
    if (!valid) {
      return { success: false, error: 'Email ou senha incorretos' }
    }

    // Update last login
    await pool.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [row.id])

    const user: AuthUser = {
      id: row.id,
      clerkUserId: row.clerk_user_id || null,
      email: row.email,
      name: row.name,
      role: row.role,
      plan: row.plan || 'free',
      planExpiresAt: row.plan_expires_at ? String(row.plan_expires_at) : null,
      stripe_customer_id: row.stripe_customer_id || null,
      createdAt: String(row.created_at)
    }

    const token = generateToken(user)
    return { success: true, user, token }
  } catch (err) {
    console.error('[Auth] Login error:', (err as Error).message)
    return { success: false, error: 'Erro ao fazer login' }
  }
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  )
}

export async function verifyToken(token: string): Promise<{ id: number; email: string; role: string } | null> {
  try {
    if (await isTokenBlacklisted(token)) return null
    return jwt.verify(token, JWT_SECRET) as { id: number; email: string; role: string }
  } catch {
    return null
  }
}

export async function getUserById(id: number): Promise<AuthUser | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT id, clerk_user_id, email, name, role, plan, plan_expires_at, stripe_customer_id, created_at FROM users WHERE id = ? AND is_active = TRUE',
    [id]
  )
  if (rows.length === 0) return null
  const row = rows[0]
  return {
    id: row.id,
    clerkUserId: row.clerk_user_id || null,
    email: row.email,
    name: row.name,
    role: row.role,
    plan: row.plan || 'free',
    planExpiresAt: row.plan_expires_at ? String(row.plan_expires_at) : null,
    stripe_customer_id: row.stripe_customer_id || null,
    createdAt: String(row.created_at)
  }
}

export async function getOrCreateUserFromClerk(input: {
  clerkUserId: string
  email: string
  name: string
}): Promise<AuthUser> {
  const email = input.email.toLowerCase()
  const name = input.name.trim() || email.split('@')[0] || 'Usuario'

  const [existingByClerk] = await pool.execute<RowDataPacket[]>(
    'SELECT id, clerk_user_id, email, name, role, plan, plan_expires_at, stripe_customer_id, created_at FROM users WHERE clerk_user_id = ? AND is_active = TRUE',
    [input.clerkUserId]
  )
  if (existingByClerk.length > 0) {
    const row = existingByClerk[0]
    await pool.execute('UPDATE users SET email = ?, name = ?, last_login = NOW() WHERE id = ?', [email, name, row.id])
    return {
      id: row.id,
      clerkUserId: row.clerk_user_id || input.clerkUserId,
      email,
      name,
      role: row.role,
      plan: row.plan || 'free',
      planExpiresAt: row.plan_expires_at ? String(row.plan_expires_at) : null,
      stripe_customer_id: row.stripe_customer_id || null,
      createdAt: String(row.created_at)
    }
  }

  const [existingByEmail] = await pool.execute<RowDataPacket[]>(
    'SELECT id, clerk_user_id, email, name, role, plan, plan_expires_at, stripe_customer_id, created_at FROM users WHERE email = ? AND is_active = TRUE',
    [email]
  )
  if (existingByEmail.length > 0) {
    const row = existingByEmail[0]
    await pool.execute(
      'UPDATE users SET clerk_user_id = ?, name = ?, last_login = NOW() WHERE id = ?',
      [input.clerkUserId, name, row.id]
    )
    return {
      id: row.id,
      clerkUserId: input.clerkUserId,
      email: row.email,
      name,
      role: row.role,
      plan: row.plan || 'free',
      planExpiresAt: row.plan_expires_at ? String(row.plan_expires_at) : null,
      stripe_customer_id: row.stripe_customer_id || null,
      createdAt: String(row.created_at)
    }
  }

  const [result] = await pool.execute<ResultSetHeader>(
    'INSERT INTO users (clerk_user_id, email, name, password_hash, last_login) VALUES (?, ?, ?, ?, NOW())',
    [input.clerkUserId, email, name, 'clerk-managed']
  )

  return {
    id: result.insertId,
    clerkUserId: input.clerkUserId,
    email,
    name,
    role: 'user',
    plan: 'free',
    planExpiresAt: null,
    stripe_customer_id: null,
    createdAt: new Date().toISOString()
  }
}

export async function updateUserPlan(
  userId: number,
  plan: 'free' | 'pro' | 'trader',
  expiresAt: Date | null,
  stripeCustomerId?: string,
  stripeSubscriptionId?: string
): Promise<void> {
  await pool.execute(
    'UPDATE users SET plan = ?, plan_expires_at = ?, stripe_customer_id = COALESCE(?, stripe_customer_id), stripe_subscription_id = COALESCE(?, stripe_subscription_id) WHERE id = ?',
    [plan, expiresAt, stripeCustomerId || null, stripeSubscriptionId || null, userId]
  )
}

export async function generateResetToken(email: string): Promise<string | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT id FROM users WHERE email = ? AND is_active = TRUE', [email.toLowerCase()]
  )
  if (rows.length === 0) return null

  const userId = rows[0].id
  const token = randomBytes(32).toString('hex')
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  // Invalidate previous tokens for this user
  await pool.execute('UPDATE password_reset_tokens SET used = TRUE WHERE user_id = ? AND used = FALSE', [userId])

  await pool.execute(
    'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [userId, tokenHash, expiresAt]
  )

  return token
}

export async function resetPassword(token: string, newPassword: string): Promise<AuthResult> {
  if (!token || !newPassword) {
    return { success: false, error: 'Token e nova senha são obrigatórios' }
  }
  if (newPassword.length < 8) {
    return { success: false, error: 'Senha deve ter pelo menos 8 caracteres' }
  }

  const tokenHash = hashToken(token)
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT user_id FROM password_reset_tokens WHERE token_hash = ? AND used = FALSE AND expires_at > NOW()',
    [tokenHash]
  )
  if (rows.length === 0) {
    return { success: false, error: 'Token inválido ou expirado' }
  }

  const userId = rows[0].user_id
  const salt = await bcrypt.genSalt(12)
  const passwordHash = await bcrypt.hash(newPassword, salt)

  await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId])
  await pool.execute('UPDATE password_reset_tokens SET used = TRUE WHERE token_hash = ?', [tokenHash])

  const user = await getUserById(userId)
  if (!user) return { success: false, error: 'Usuário não encontrado' }

  const newToken = generateToken(user)
  return { success: true, user, token: newToken }
}
