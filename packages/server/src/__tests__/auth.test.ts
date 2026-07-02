import { describe, it, expect, vi, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

// Set required env vars before importing modules that check them at load time
// vi.hoisted runs before vi.mock hoisting, ensuring env vars are set first
const { TEST_JWT_SECRET } = vi.hoisted(() => {
  const TEST_JWT_SECRET = 'bottrade-dev-secret-change-in-production'
  process.env.JWT_SECRET = TEST_JWT_SECRET
  process.env.ENCRYPTION_KEY = 'bottrade-dev-encryption-key-32ch'
  return { TEST_JWT_SECRET }
})

// Mock the database module before importing auth
vi.mock('../database.js', () => ({
  pool: {
    getConnection: vi.fn().mockResolvedValue({
      execute: vi.fn().mockResolvedValue([]),
      release: vi.fn(),
    }),
    execute: vi.fn().mockResolvedValue([[]]),
  },
  blacklistTokenDB: vi.fn().mockResolvedValue(undefined),
  isTokenBlacklistedDB: vi.fn().mockResolvedValue(false),
}))

import { registerUser, loginUser, generateToken, verifyToken, getUserById } from '../auth.js'
import { pool } from '../database.js'

const JWT_SECRET = TEST_JWT_SECRET as string

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockPoolExecute(returnValue: unknown) {
  (pool.execute as ReturnType<typeof vi.fn>).mockResolvedValueOnce(returnValue)
}

// ── generateToken / verifyToken (pure functions, no DB) ─────────────────────

describe('generateToken', () => {
  it('returns a valid JWT string', () => {
    const user = {
      id: 1, email: 'test@test.com', name: 'Test', role: 'user' as const,
      plan: 'free' as const, planExpiresAt: null, stripe_customer_id: null, createdAt: new Date().toISOString(),
    }
    const token = generateToken(user)
    expect(typeof token).toBe('string')
    expect(token.split('.')).toHaveLength(3) // JWT has 3 parts
  })

  it('encodes user id, email, and role in the payload', () => {
    const user = {
      id: 42, email: 'admin@test.com', name: 'Admin', role: 'admin' as const,
      plan: 'trader' as const, planExpiresAt: null, stripe_customer_id: null, createdAt: new Date().toISOString(),
    }
    const token = generateToken(user)
    const decoded = jwt.verify(token, JWT_SECRET) as Record<string, unknown>
    expect(decoded.id).toBe(42)
    expect(decoded.email).toBe('admin@test.com')
    expect(decoded.role).toBe('admin')
  })

  it('sets expiration to 4 hours', () => {
    const user = {
      id: 1, email: 'test@test.com', name: 'Test', role: 'user' as const,
      plan: 'free' as const, planExpiresAt: null, stripe_customer_id: null, createdAt: new Date().toISOString(),
    }
    const token = generateToken(user)
    const decoded = jwt.verify(token, JWT_SECRET) as { exp: number; iat: number }
    const fourHours = 4 * 60 * 60
    expect(decoded.exp - decoded.iat).toBe(fourHours)
  })
})

describe('verifyToken', () => {
  it('returns decoded payload for valid token', async () => {
    const token = jwt.sign({ id: 5, email: 'a@b.com', role: 'user' }, JWT_SECRET, { expiresIn: '1h' })
    const result = await verifyToken(token)
    expect(result).not.toBeNull()
    expect(result!.id).toBe(5)
    expect(result!.email).toBe('a@b.com')
    expect(result!.role).toBe('user')
  })

  it('returns null for expired token', async () => {
    const token = jwt.sign({ id: 1, email: 'a@b.com', role: 'user' }, JWT_SECRET, { expiresIn: '-1s' })
    const result = await verifyToken(token)
    expect(result).toBeNull()
  })

  it('returns null for token signed with wrong secret', async () => {
    const token = jwt.sign({ id: 1, email: 'a@b.com', role: 'user' }, 'wrong-secret')
    const result = await verifyToken(token)
    expect(result).toBeNull()
  })

  it('returns null for malformed token', async () => {
    expect(await verifyToken('not.a.jwt')).toBeNull()
    expect(await verifyToken('')).toBeNull()
    expect(await verifyToken('abc')).toBeNull()
  })

  it('returns null for tampered token', async () => {
    const token = jwt.sign({ id: 1, email: 'a@b.com', role: 'user' }, JWT_SECRET)
    // Tamper with payload
    const parts = token.split('.')
    parts[1] = Buffer.from(JSON.stringify({ id: 999, email: 'hacker@evil.com', role: 'admin' })).toString('base64url')
    const tampered = parts.join('.')
    expect(await verifyToken(tampered)).toBeNull()
  })
})

// ── registerUser ────────────────────────────────────────────────────────────

describe('registerUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects empty email', async () => {
    const result = await registerUser('', 'Test', 'password123')
    expect(result.success).toBe(false)
    expect(result.error).toContain('obrigatórios')
  })

  it('rejects empty name', async () => {
    const result = await registerUser('test@test.com', '', 'password123')
    expect(result.success).toBe(false)
    expect(result.error).toContain('obrigatórios')
  })

  it('rejects empty password', async () => {
    const result = await registerUser('test@test.com', 'Test', '')
    expect(result.success).toBe(false)
    expect(result.error).toContain('obrigatórios')
  })

  it('rejects password shorter than 8 characters', async () => {
    const result = await registerUser('test@test.com', 'Test', '1234567')
    expect(result.success).toBe(false)
    expect(result.error).toContain('8 caracteres')
  })

  it('rejects invalid email format', async () => {
    const result = await registerUser('not-an-email', 'Test', 'password123')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Email inválido')
  })

  it('rejects email without domain', async () => {
    const result = await registerUser('test@', 'Test', 'password123')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Email inválido')
  })

  it('rejects duplicate email', async () => {
    // First query: check existing → found
    mockPoolExecute([[{ id: 1 }]])
    const result = await registerUser('existing@test.com', 'Test', 'password123')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Não foi possível criar a conta')
  })

  it('lowercases email before storing', async () => {
    // Check existing → empty
    mockPoolExecute([[]])
    // Insert → success
    mockPoolExecute([{ insertId: 10 }])

    const result = await registerUser('Test@UPPER.com', 'Test', 'password123')
    expect(result.success).toBe(true)
    expect(result.user!.email).toBe('test@upper.com')

    // Verify the queries were called with lowercased email
    const calls = (pool.execute as ReturnType<typeof vi.fn>).mock.calls
    expect(calls[0][1]).toContain('test@upper.com')
    expect(calls[1][1][0]).toBe('test@upper.com')
  })

  it('returns user with free plan and token on success', async () => {
    mockPoolExecute([[]]) // no existing user
    mockPoolExecute([{ insertId: 42 }]) // insert

    const result = await registerUser('new@test.com', 'New User', 'secure_pass123')
    expect(result.success).toBe(true)
    expect(result.user).toBeDefined()
    expect(result.user!.id).toBe(42)
    expect(result.user!.plan).toBe('free')
    expect(result.user!.role).toBe('user')
    expect(result.token).toBeDefined()
    expect(typeof result.token).toBe('string')
  })

  it('hashes password with bcrypt salt rounds 12', async () => {
    mockPoolExecute([[]]) // no existing user
    mockPoolExecute([{ insertId: 1 }]) // insert

    await registerUser('hash@test.com', 'Test', 'my_password')

    const calls = (pool.execute as ReturnType<typeof vi.fn>).mock.calls
    const insertCall = calls[1]
    const storedHash = insertCall[1][2] // third param is the hash
    expect(storedHash).toMatch(/^\$2[aby]\$12\$/) // bcrypt hash with 12 rounds
    expect(await bcrypt.compare('my_password', storedHash)).toBe(true)
    expect(await bcrypt.compare('wrong_password', storedHash)).toBe(false)
  })

  it('handles database errors gracefully', async () => {
    mockPoolExecute([[]]) // no existing
    // Insert throws
    ;(pool.execute as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Connection refused'))

    const result = await registerUser('db@test.com', 'Test', 'password123')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Erro ao registrar')
  })
})

// ── loginUser ────────────────────────────────────────────────────────────────

describe('loginUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects empty email', async () => {
    const result = await loginUser('', 'password123')
    expect(result.success).toBe(false)
    expect(result.error).toContain('obrigatórios')
  })

  it('rejects empty password', async () => {
    const result = await loginUser('test@test.com', '')
    expect(result.success).toBe(false)
    expect(result.error).toContain('obrigatórios')
  })

  it('returns error when user not found', async () => {
    mockPoolExecute([[]])
    const result = await loginUser('nonexistent@test.com', 'password')
    expect(result.success).toBe(false)
    expect(result.error).toContain('incorretos')
  })

  it('returns error for inactive account', async () => {
    const hash = await bcrypt.hash('password123', 12)
    mockPoolExecute([[{
      id: 1, email: 'inactive@test.com', name: 'Inactive', password_hash: hash,
      role: 'user', plan: 'free', plan_expires_at: null, stripe_customer_id: null,
      is_active: false, created_at: '2024-01-01',
    }]])
    const result = await loginUser('inactive@test.com', 'password123')
    expect(result.success).toBe(false)
    expect(result.error).toContain('desativada')
  })

  it('returns error for wrong password', async () => {
    const hash = await bcrypt.hash('correct_password', 12)
    mockPoolExecute([[{
      id: 1, email: 'user@test.com', name: 'User', password_hash: hash,
      role: 'user', plan: 'free', plan_expires_at: null, stripe_customer_id: null,
      is_active: true, created_at: '2024-01-01',
    }]])
    const result = await loginUser('user@test.com', 'wrong_password')
    expect(result.success).toBe(false)
    expect(result.error).toContain('incorretos')
  })

  it('returns user and token on successful login', async () => {
    const hash = await bcrypt.hash('correct_password', 12)
    mockPoolExecute([[{
      id: 7, email: 'user@test.com', name: 'User', password_hash: hash,
      role: 'user', plan: 'pro', plan_expires_at: '2025-12-31', stripe_customer_id: 'cus_123',
      is_active: true, created_at: '2024-01-01',
    }]])
    // UPDATE last_login
    mockPoolExecute([{ affectedRows: 1 }])

    const result = await loginUser('user@test.com', 'correct_password')
    expect(result.success).toBe(true)
    expect(result.user!.id).toBe(7)
    expect(result.user!.email).toBe('user@test.com')
    expect(result.user!.plan).toBe('pro')
    expect(result.token).toBeDefined()
  })

  it('lowercases email for lookup', async () => {
    const hash = await bcrypt.hash('pass', 12)
    mockPoolExecute([[{
      id: 1, email: 'user@test.com', name: 'User', password_hash: hash,
      role: 'user', plan: 'free', plan_expires_at: null, stripe_customer_id: null,
      is_active: true, created_at: '2024-01-01',
    }]])
    mockPoolExecute([{ affectedRows: 1 }])

    await loginUser('USER@Test.Com', 'pass')
    const calls = (pool.execute as ReturnType<typeof vi.fn>).mock.calls
    expect(calls[0][1]).toContain('user@test.com')
  })

  it('handles database errors gracefully', async () => {
    ;(pool.execute as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('DB down'))
    const result = await loginUser('user@test.com', 'password')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Erro ao fazer login')
  })
})

// ── getUserById ──────────────────────────────────────────────────────────────

describe('getUserById', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when user not found', async () => {
    mockPoolExecute([[]])
    const result = await getUserById(999)
    expect(result).toBeNull()
  })

  it('returns user when found', async () => {
    mockPoolExecute([[{
      id: 3, email: 'found@test.com', name: 'Found', role: 'admin',
      plan: 'trader', plan_expires_at: '2025-12-31', stripe_customer_id: 'cus_abc',
      created_at: '2024-01-01',
    }]])
    const result = await getUserById(3)
    expect(result).not.toBeNull()
    expect(result!.id).toBe(3)
    expect(result!.role).toBe('admin')
    expect(result!.plan).toBe('trader')
    expect(result!.planExpiresAt).toBe('2025-12-31')
  })

  it('defaults plan to free when null in DB', async () => {
    mockPoolExecute([[{
      id: 1, email: 'test@test.com', name: 'Test', role: 'user',
      plan: null, plan_expires_at: null, stripe_customer_id: null,
      created_at: '2024-01-01',
    }]])
    const result = await getUserById(1)
    expect(result!.plan).toBe('free')
  })
})
