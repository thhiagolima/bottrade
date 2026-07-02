# BottRade Launch Blockers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 24 critical blockers identified in the audit so the platform is ready for commercial launch.

**Architecture:** Server-side fixes in `packages/server/src/`, client-side fixes in `packages/client/src/`. Each task is self-contained and produces a working commit. Security fixes first, then functional, then UX/marketing.

**Tech Stack:** Node.js/Express/Socket.io (server), React/Zustand/Tailwind (client), MySQL, Stripe, Binance API

**Reminder:** Every new feature/fix that is user-visible must also be reflected on the LandingPage.tsx (pricing section, feature lists, security section).

---

## Task 1: Fix crypto.ts — Remove silent fallback on decrypt failure

**Files:**
- Modify: `packages/server/src/crypto.ts`
- Create: `packages/server/src/__tests__/crypto.test.ts`

**Context:** The `decrypt()` function silently returns the encrypted ciphertext as plaintext when decryption fails (wrong key, corrupted data). This is a CVSS 9.0 vulnerability — after key rotation, all API keys would be sent as hex garbage to Binance.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/server/src/__tests__/crypto.test.ts
import { describe, it, expect } from 'vitest'
import { encrypt, decrypt, maskSecret, isEncrypted } from '../crypto.js'

describe('crypto', () => {
  it('encrypts and decrypts roundtrip', () => {
    const original = 'my-secret-api-key-12345'
    const encrypted = encrypt(original)
    expect(encrypted).not.toBe(original)
    expect(decrypt(encrypted)).toBe(original)
  })

  it('encrypt returns empty string for empty input', () => {
    expect(encrypt('')).toBe('')
  })

  it('decrypt returns empty string for empty input', () => {
    expect(decrypt('')).toBe('')
  })

  it('decrypt throws on invalid encrypted data', () => {
    expect(() => decrypt('bad:data:here')).toThrow()
  })

  it('decrypt throws on corrupted ciphertext', () => {
    const encrypted = encrypt('test')
    const corrupted = encrypted.slice(0, -4) + 'ZZZZ'
    expect(() => decrypt(corrupted)).toThrow()
  })

  it('isEncrypted detects encrypted format', () => {
    const encrypted = encrypt('test')
    expect(isEncrypted(encrypted)).toBe(true)
    expect(isEncrypted('plaintext')).toBe(false)
    expect(isEncrypted('')).toBe(false)
  })

  it('maskSecret masks correctly', () => {
    expect(maskSecret('1234567890abcdef')).toBe('1234****cdef')
    expect(maskSecret('short')).toBe('****')
    expect(maskSecret(undefined)).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/server && npx vitest run src/__tests__/crypto.test.ts`
Expected: FAIL on "decrypt throws on invalid encrypted data" (currently returns the input)

- [ ] **Step 3: Fix decrypt to throw instead of silent fallback**

```typescript
// packages/server/src/crypto.ts — replace the decrypt function
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return ''
  const parts = encryptedText.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format — not in iv:authTag:encrypted format')
  }
  const [ivHex, authTagHex, encrypted] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const key = getKey()
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}
```

- [ ] **Step 4: Add tryDecrypt helper for migration cases**

```typescript
// packages/server/src/crypto.ts — add after decrypt
export function tryDecrypt(text: string): string {
  if (!text) return ''
  if (!isEncrypted(text)) return text // plaintext (legacy)
  return decrypt(text) // throws if key is wrong
}
```

- [ ] **Step 5: Update all callers to use tryDecrypt**

In `packages/server/src/index.ts` lines 70-73, replace:
```typescript
if (settings.binanceApiKey) settings.binanceApiKey = decrypt(settings.binanceApiKey)
if (settings.binanceApiSecret) settings.binanceApiSecret = decrypt(settings.binanceApiSecret)
if (settings.telegramBotToken) settings.telegramBotToken = decrypt(settings.telegramBotToken)
if (settings.telegramChatId) settings.telegramChatId = decrypt(settings.telegramChatId)
```
with:
```typescript
if (settings.binanceApiKey) settings.binanceApiKey = tryDecrypt(settings.binanceApiKey)
if (settings.binanceApiSecret) settings.binanceApiSecret = tryDecrypt(settings.binanceApiSecret)
if (settings.telegramBotToken) settings.telegramBotToken = tryDecrypt(settings.telegramBotToken)
if (settings.telegramChatId) settings.telegramChatId = tryDecrypt(settings.telegramChatId)
```

Update the import in index.ts to include `tryDecrypt`.

- [ ] **Step 6: Run tests and verify all pass**

Run: `cd packages/server && npx vitest run`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/crypto.ts packages/server/src/__tests__/crypto.test.ts packages/server/src/index.ts
git commit -m "security: remove silent decrypt fallback, add tryDecrypt for migration"
```

---

## Task 2: Stop storing decrypted API keys in session memory

**Files:**
- Modify: `packages/server/src/index.ts` (lines 69-73, ~760, ~1191-1208)
- Modify: `packages/server/src/binanceOrders.ts`

**Context:** API keys are decrypted at session creation and kept in plaintext in memory forever. Any heap dump exposes ALL users' Binance keys. Instead, store encrypted and decrypt only at moment of use.

- [ ] **Step 1: Remove decryption from getOrCreateSession**

In `packages/server/src/index.ts`, remove lines 69-73 (the decrypt block). The settings will now keep the encrypted values.

- [ ] **Step 2: Create decryptApiKeys helper**

Add to `packages/server/src/index.ts` after imports:

```typescript
import { tryDecrypt } from './crypto.js'

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
```

- [ ] **Step 3: Update auto-trade to decrypt at use**

In `packages/server/src/index.ts` around line 760, replace:
```typescript
const result = await placeMarketOrder(order, session.settings.binanceApiKey || '', session.settings.binanceApiSecret || '', true)
```
with:
```typescript
const { apiKey, apiSecret } = decryptApiKeys(session.settings)
const testnet = process.env.BINANCE_TESTNET !== 'false'
const result = await placeMarketOrder(order, apiKey, apiSecret, testnet)
```

- [ ] **Step 4: Update Telegram calls to decrypt at use**

Find all `session.settings.telegramBotToken` / `session.settings.telegramChatId` usages and replace with:
```typescript
const { botToken, chatId } = decryptTelegramKeys(session.settings)
if (botToken && chatId) {
  sendTelegramMessage(..., botToken, chatId).catch(() => {})
}
```

- [ ] **Step 5: Update .env.example with BINANCE_TESTNET**

Add to `.env.example`:
```
# Binance testnet mode (set to 'false' for production mainnet)
BINANCE_TESTNET=true
```

- [ ] **Step 6: Run tests and verify**

Run: `cd packages/server && npx vitest run`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/index.ts packages/server/src/crypto.ts .env.example
git commit -m "security: decrypt API keys only at moment of use, add BINANCE_TESTNET env"
```

---

## Task 3: Fix account deletion — transaction + token invalidation + session cleanup

**Files:**
- Modify: `packages/server/src/index.ts` (lines 360-379)

**Context:** Account deletion runs 6 DELETE queries without transaction (partial deletion on failure) and doesn't invalidate the JWT or disconnect WebSocket sessions.

- [ ] **Step 1: Rewrite DELETE /api/account with transaction and session cleanup**

Replace lines 360-379 in `packages/server/src/index.ts`:

```typescript
app.delete('/api/account', async (req, res) => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' })
  const token = authHeader.substring(7)
  const payload = await verifyToken(token)
  if (!payload) return res.status(401).json({ error: 'Invalid token' })

  const userId = payload.id
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

    // Blacklist the current token
    await blacklistToken(token)

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
```

- [ ] **Step 2: Run tests and verify**

Run: `cd packages/server && npx vitest run`

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/index.ts
git commit -m "security: account deletion with transaction, token invalidation, session cleanup"
```

---

## Task 4: Fix login rate limit bypass + admin role verification

**Files:**
- Modify: `packages/server/src/index.ts` (lines 276-280, 422-430)

**Context:** Login rate limiter uses raw email from body (case-sensitive bypass). Admin middleware trusts JWT role claim instead of checking DB.

- [ ] **Step 1: Fix login rate limiter key generator**

Replace lines 276-280:
```typescript
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => ((req.body as any)?.email || '').toLowerCase().trim() + ':' + (req.ip || 'unknown'),
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
})
```

- [ ] **Step 2: Fix admin middleware to verify role from DB**

Replace lines 422-430:
```typescript
async function requireAdmin(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' })
  const payload = await verifyToken(authHeader.substring(7))
  if (!payload) return res.status(401).json({ error: 'Invalid token' })
  // Always check role from DB, not JWT cache
  const user = await getUserById(payload.id)
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
  req.userId = payload.id
  next()
}
```

- [ ] **Step 3: Run tests and verify**

Run: `cd packages/server && npx vitest run`

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/index.ts
git commit -m "security: fix login rate limit bypass, verify admin role from DB"
```

---

## Task 5: Fix health endpoint info leak + demo/feed fake data

**Files:**
- Modify: `packages/server/src/index.ts` (lines 242-264, 595-604)

**Context:** Health endpoint exposes memory/users/uptime without auth. Demo feed fabricates user counts with Math.random().

- [ ] **Step 1: Limit public health endpoint to status only**

Replace lines 242-264:
```typescript
app.get('/health', async (_req, res) => {
  try {
    await pool.execute('SELECT 1')
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  } catch {
    res.status(503).json({ status: 'unhealthy', timestamp: new Date().toISOString() })
  }
})

// Detailed health for admins only
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
```

Note: `requireAdmin` must be defined before this endpoint. Move the admin middleware definition to before the health endpoint, or define the admin health route after the admin middleware section.

- [ ] **Step 2: Fix demo/feed to use real data only**

Replace lines 595-604:
```typescript
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
```

- [ ] **Step 3: Run tests and verify**

Run: `cd packages/server && npx vitest run`

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/index.ts
git commit -m "security: limit health endpoint info, remove fake data from demo feed"
```

---

## Task 6: Fix SL/TP silent failure in binanceOrders.ts

**Files:**
- Modify: `packages/server/src/binanceOrders.ts`

**Context:** If the market order succeeds but SL/TP orders fail, the user has an unprotected position. Currently failures are silently caught with console.error.

- [ ] **Step 1: Update placeMarketOrder to report SL/TP failures**

Replace `packages/server/src/binanceOrders.ts`:
```typescript
import crypto from 'crypto'
import axios from 'axios'
import type { OrderRequest, OrderResult } from '@bottrade/shared'

function sign(queryString: string, apiSecret: string): string {
  return crypto.createHmac('sha256', apiSecret).update(queryString).digest('hex')
}

export async function placeMarketOrder(
  request: OrderRequest,
  apiKey: string,
  apiSecret: string,
  testnet = true
): Promise<OrderResult> {
  if (!apiKey || !apiSecret) {
    return { success: false, symbol: request.symbol, side: request.side, error: 'API keys not configured', timestamp: Date.now() }
  }

  const baseUrl = testnet ? 'https://testnet.binancefuture.com' : 'https://fapi.binance.com'

  try {
    // Place market order
    const timestamp = Date.now()
    const params = new URLSearchParams({
      symbol: request.symbol,
      side: request.side,
      type: 'MARKET',
      quantity: request.quantity.toString(),
      timestamp: timestamp.toString(),
    })
    const signature = sign(params.toString(), apiSecret)
    params.append('signature', signature)

    const resp = await axios.post(`${baseUrl}/fapi/v1/order`, params.toString(), {
      headers: {
        'X-MBX-APIKEY': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 10000,
    })

    const data = resp.data
    const avgPrice = parseFloat(data.avgPrice || data.price || '0')

    // Place protective orders — track failures
    const warnings: string[] = []
    const slSide = request.side === 'BUY' ? 'SELL' : 'BUY'

    // Stop Loss
    try {
      const slParams = new URLSearchParams({
        symbol: request.symbol,
        side: slSide,
        type: 'STOP_MARKET',
        stopPrice: request.stopLoss.toFixed(2),
        closePosition: 'true',
        timestamp: Date.now().toString(),
      })
      slParams.append('signature', sign(slParams.toString(), apiSecret))
      await axios.post(`${baseUrl}/fapi/v1/order`, slParams.toString(), {
        headers: { 'X-MBX-APIKEY': apiKey, 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000,
      })
    } catch (err) {
      const msg = axios.isAxiosError(err) ? (err.response?.data?.msg || err.message) : (err as Error).message
      warnings.push(`SL order failed: ${msg}`)
    }

    // Take Profit
    try {
      const tpParams = new URLSearchParams({
        symbol: request.symbol,
        side: slSide,
        type: 'TAKE_PROFIT_MARKET',
        stopPrice: request.takeProfit.toFixed(2),
        closePosition: 'true',
        timestamp: Date.now().toString(),
      })
      tpParams.append('signature', sign(tpParams.toString(), apiSecret))
      await axios.post(`${baseUrl}/fapi/v1/order`, tpParams.toString(), {
        headers: { 'X-MBX-APIKEY': apiKey, 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000,
      })
    } catch (err) {
      const msg = axios.isAxiosError(err) ? (err.response?.data?.msg || err.message) : (err as Error).message
      warnings.push(`TP order failed: ${msg}`)
    }

    return {
      success: true,
      orderId: String(data.orderId),
      symbol: request.symbol,
      side: request.side,
      price: avgPrice,
      quantity: request.quantity,
      timestamp: Date.now(),
      error: warnings.length > 0 ? `WARNING: ${warnings.join('; ')}` : undefined,
    }
  } catch (err) {
    const msg = axios.isAxiosError(err) ? (err.response?.data?.msg || err.message) : (err as Error).message
    return { success: false, symbol: request.symbol, side: request.side, error: msg, timestamp: Date.now() }
  }
}
```

- [ ] **Step 2: In index.ts auto-trade section, emit warning to user if SL/TP failed**

After the `placeMarketOrder` call (around line 761 in index.ts), add:
```typescript
if (result.success && result.error) {
  // SL/TP failed — warn user
  io.to(`user:${uid}`).emit('alert', {
    type: 'warning',
    title: 'Ordens de proteção falharam',
    message: `${result.error}. Coloque SL/TP manualmente!`,
  })
}
```

- [ ] **Step 3: Run tests and verify**

Run: `cd packages/server && npx vitest run`

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/binanceOrders.ts packages/server/src/index.ts
git commit -m "security: report SL/TP failures to user instead of silently swallowing"
```

---

## Task 7: Implement forgot-password (full flow)

**Files:**
- Modify: `packages/server/src/auth.ts`
- Modify: `packages/server/src/index.ts` (lines 323-329)
- Modify: `packages/client/src/components/AuthPage.tsx`
- Modify: `packages/client/src/App.tsx`

**Context:** The forgot-password endpoint is a stub that returns success without doing anything. Need full flow: generate token → save to DB → send email → reset endpoint → UI.

- [ ] **Step 1: Add password_reset_tokens table to auth.ts initAuthTables**

In `packages/server/src/auth.ts` `initAuthTables()`, after the users table creation, add:
```typescript
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
```

- [ ] **Step 2: Add generateResetToken and verifyResetToken to auth.ts**

Add to bottom of `packages/server/src/auth.ts`:
```typescript
export async function generateResetToken(email: string): Promise<string | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT id FROM users WHERE email = ? AND is_active = TRUE', [email.toLowerCase()]
  )
  if (rows.length === 0) return null

  const userId = rows[0].id
  const token = require('crypto').randomBytes(32).toString('hex')
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
```

Note: Replace `require('crypto')` with `import { randomBytes } from 'crypto'` — add `randomBytes` to the existing crypto import at line 3.

- [ ] **Step 3: Implement forgot-password endpoint in index.ts**

Replace lines 323-329:
```typescript
app.post('/api/auth/forgot-password', forgotPasswordLimiter, async (req, res) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'Email obrigatório' })

  const token = await generateResetToken(email)
  if (token) {
    const { sendPasswordResetEmail } = await import('./email.js')
    await sendPasswordResetEmail(email, token)
  }
  // Always return success to prevent email enumeration
  res.json({ message: 'Se o email existir, enviaremos as instruções de redefinição.' })
})
```

- [ ] **Step 4: Add reset-password endpoint in index.ts (after forgot-password)**

```typescript
app.post('/api/auth/reset-password', async (req, res) => {
  const { token, password } = req.body
  if (!token || !password) return res.status(400).json({ error: 'Token e senha obrigatórios' })

  const result = await resetPassword(token, password)
  if (!result.success) return res.status(400).json({ error: result.error })

  await logAudit({ userId: result.user!.id, action: 'PASSWORD_RESET', details: {}, ip: req.ip })
  res.json({ user: result.user, token: result.token })
})
```

Add `generateResetToken, resetPassword` to the imports from `./auth.js`.

- [ ] **Step 5: Update AuthPage.tsx with forgot-password and reset-password UI**

Replace `packages/client/src/components/AuthPage.tsx` with:
```tsx
import { useState } from 'react'
import { useStore } from '../store/useStore'

interface AuthPageProps {
  onBack?: () => void
  initialMode?: 'login' | 'register' | 'forgot' | 'reset'
  resetToken?: string
}

export default function AuthPage({ onBack, initialMode = 'login', resetToken: initialResetToken }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>(initialMode)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [resetToken] = useState(initialResetToken || '')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const login = useStore(s => s.login)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (mode === 'forgot') {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        })
        const data = await res.json()
        if (!res.ok) { setError(data.error || 'Erro'); return }
        setSuccess(data.message)
        return
      }

      if (mode === 'reset') {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: resetToken, password })
        })
        const data = await res.json()
        if (!res.ok) { setError(data.error || 'Erro'); return }
        login(data.user, data.token)
        return
      }

      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const body = mode === 'login' ? { email, password } : { email, name, password }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erro desconhecido'); return }
      login(data.user, data.token)
    } catch {
      setError('Erro de conexão com o servidor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {onBack && (
          <button onClick={onBack} className="mb-4 text-sm text-muted hover:text-white transition-colors flex items-center gap-1">
            <span>←</span> Voltar
          </button>
        )}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-bold text-white">
            Bottrade<span className="text-accent">.</span>
          </h1>
          <p className="text-muted mt-2 text-sm">
            {mode === 'forgot' ? 'Recuperar senha' : mode === 'reset' ? 'Nova senha' : 'Dashboard inteligente para trading de criptomoedas'}
          </p>
        </div>

        <div className="bg-card border border-card-border rounded-lg p-6">
          {mode !== 'forgot' && mode !== 'reset' && (
            <div className="flex mb-6 border-b border-card-border">
              <button onClick={() => { setMode('login'); setError(''); setSuccess('') }}
                className={`flex-1 pb-3 text-sm font-medium transition-colors ${mode === 'login' ? 'text-white border-b-2 border-accent' : 'text-muted hover:text-white'}`}>
                Entrar
              </button>
              <button onClick={() => { setMode('register'); setError(''); setSuccess('') }}
                className={`flex-1 pb-3 text-sm font-medium transition-colors ${mode === 'register' ? 'text-white border-b-2 border-accent' : 'text-muted hover:text-white'}`}>
                Criar conta
              </button>
            </div>
          )}

          {error && <div className="mb-4 p-3 bg-bear/10 border border-bear/20 rounded text-bear text-sm">{error}</div>}
          {success && <div className="mb-4 p-3 bg-bull/10 border border-bull/20 rounded text-bull text-sm">{success}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-sm text-muted mb-1">Nome</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  className="w-full bg-bg border border-card-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-accent transition-colors"
                  placeholder="Seu nome" required />
              </div>
            )}
            {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
              <div>
                <label className="block text-sm text-muted mb-1">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full bg-bg border border-card-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-accent transition-colors"
                  placeholder="seu@email.com" required />
              </div>
            )}
            {(mode === 'login' || mode === 'register' || mode === 'reset') && (
              <div>
                <label className="block text-sm text-muted mb-1">{mode === 'reset' ? 'Nova senha' : 'Senha'}</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full bg-bg border border-card-border rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-accent transition-colors"
                  placeholder={mode === 'register' || mode === 'reset' ? 'Mínimo 8 caracteres' : '********'}
                  required minLength={mode === 'register' || mode === 'reset' ? 8 : 1} />
              </div>
            )}
            <button type="submit" disabled={loading}
              className="w-full bg-accent hover:bg-accent/90 text-white rounded py-2.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : mode === 'register' ? 'Criar conta' : mode === 'forgot' ? 'Enviar link' : 'Redefinir senha'}
            </button>
          </form>

          {mode === 'login' && (
            <button onClick={() => { setMode('forgot'); setError(''); setSuccess('') }}
              className="w-full mt-3 text-xs text-muted hover:text-accent transition-colors text-center">
              Esqueci minha senha
            </button>
          )}
          {(mode === 'forgot' || mode === 'reset') && (
            <button onClick={() => { setMode('login'); setError(''); setSuccess('') }}
              className="w-full mt-3 text-xs text-muted hover:text-accent transition-colors text-center">
              Voltar para login
            </button>
          )}
        </div>

        <p className="text-center text-dim text-xs mt-6">
          Ao continuar, você concorda com os termos de uso.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Handle ?reset=TOKEN in App.tsx**

In `packages/client/src/App.tsx`, modify the auth overlay section. Add state for reset token:
```tsx
// Inside App(), add:
const [resetToken, setResetToken] = useState<string | null>(null)

// In the useEffect for checkAuth, add URL param check:
useEffect(() => {
  checkAuth()
  const params = new URLSearchParams(window.location.search)
  const token = params.get('reset')
  if (token) {
    setResetToken(token)
    setShowAuth(true)
    // Clean URL
    window.history.replaceState({}, '', window.location.pathname)
  }
}, [checkAuth])

// Update the AuthPage render:
{showAuth && (
  <AuthPage
    onBack={() => { setShowAuth(false); setResetToken(null) }}
    initialMode={resetToken ? 'reset' : 'login'}
    resetToken={resetToken || undefined}
  />
)}
```

- [ ] **Step 7: Run tests and verify**

Run: `cd packages/server && npx vitest run`

- [ ] **Step 8: Commit**

```bash
git add packages/server/src/auth.ts packages/server/src/index.ts packages/client/src/components/AuthPage.tsx packages/client/src/App.tsx
git commit -m "feat: implement full forgot-password flow with email, token, reset UI"
```

---

## Task 8: Implement GDPR buttons (export + delete) in SettingsPage

**Files:**
- Modify: `packages/client/src/components/SettingsPage.tsx` (lines 524-546)
- Modify: `packages/client/src/store/useStore.ts`

**Context:** The "Exportar dados" and "Deletar conta" buttons have no onClick handlers. The "Upgrade" button also has no action. These are LGPD requirements.

- [ ] **Step 1: Add deleteAccount and exportData to the store**

In `packages/client/src/store/useStore.ts`, add to the AppState interface:
```typescript
deleteAccount: () => Promise<boolean>
exportData: () => Promise<void>
```

Add implementations before the closing `}))`:
```typescript
deleteAccount: async () => {
  const token = get().authToken
  if (!token) return false
  try {
    const res = await fetch('/api/account', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) return false
    get().logout()
    return true
  } catch {
    return false
  }
},

exportData: async () => {
  const token = get().authToken
  if (!token) return
  try {
    const res = await fetch('/api/account/export', {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) return
    const data = await res.json()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bottrade-export-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    // silent fail
  }
},
```

- [ ] **Step 2: Wire up buttons in SettingsPage.tsx**

Replace lines 524-546 in `packages/client/src/components/SettingsPage.tsx`:
```tsx
<Section title="Plano Atual">
  <div className="flex items-center justify-between px-3 py-2 bg-bg rounded border border-card-border">
    <div>
      <div className="text-xs font-bold text-white capitalize">{authUser?.plan || (authUser?.role === 'admin' ? 'Admin' : 'Free')}</div>
      <div className="text-[10px] text-muted mt-0.5">Plano atual</div>
    </div>
    <button
      onClick={async () => {
        const token = useStore.getState().authToken
        if (!token) return
        try {
          const res = await fetch('/api/stripe/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ plan: 'pro' })
          })
          const data = await res.json()
          if (data.url) window.location.href = data.url
        } catch {}
      }}
      className="px-2 py-1 bg-accent/20 border border-accent/30 rounded text-accent text-xs font-bold hover:bg-accent/30 transition-colors"
    >
      Upgrade
    </button>
  </div>
</Section>

<Section title="Dados">
  <button
    onClick={() => useStore.getState().exportData()}
    className="w-full px-2 py-1.5 bg-card-border/50 border border-card-border rounded text-muted text-xs font-bold hover:bg-card-border transition-colors"
  >
    Exportar dados (JSON)
  </button>
</Section>

<Section title="Zona de Perigo">
  <button
    onClick={async () => {
      if (!confirm('Tem certeza? Esta ação é irreversível. Todos os seus dados serão permanentemente deletados.')) return
      if (!confirm('Última confirmação: deseja realmente deletar sua conta e todos os dados?')) return
      const ok = await useStore.getState().deleteAccount()
      if (!ok) alert('Erro ao deletar conta. Tente novamente.')
    }}
    className="w-full px-2 py-1.5 bg-bear/10 border border-bear/30 rounded text-bear text-xs font-bold hover:bg-bear/20 transition-colors"
  >
    Deletar conta
  </button>
</Section>
```

Also add the store import at the top of the file if not already there for `useStore.getState()`.

Also update the `authUser` type: find where `authUser` is destructured from the store and ensure `plan` is accessible. Update the authUser interface in `useStore.ts` to include `plan`:

```typescript
authUser: { id: number; email: string; name: string; role: string; plan?: string } | null
```

- [ ] **Step 3: Run dev server and verify buttons work**

Run: `npm run dev:client`
Test: Go to Settings → Conta tab → verify Export downloads JSON, Upgrade redirects to Stripe, Delete shows confirmation.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/components/SettingsPage.tsx packages/client/src/store/useStore.ts
git commit -m "feat: implement GDPR export/delete buttons, upgrade redirects to Stripe"
```

---

## Task 9: Implement Stripe trial period + annual plan

**Files:**
- Modify: `packages/server/src/stripe.ts`
- Modify: `.env.example`

**Context:** Landing page promises "Teste grátis por 7 dias" and "Anual: R$39/mês (20% off)" but neither is implemented.

- [ ] **Step 1: Add annual price IDs and trial to Stripe config**

Update `packages/server/src/stripe.ts`:
```typescript
const PLAN_PRICES: Record<string, string> = {
  free: '',
  pro: process.env.STRIPE_PRICE_PRO || '',
  trader: process.env.STRIPE_PRICE_TRADER || '',
  pro_annual: process.env.STRIPE_PRICE_PRO_ANNUAL || '',
  trader_annual: process.env.STRIPE_PRICE_TRADER_ANNUAL || '',
}

const TRIAL_DAYS = parseInt(process.env.STRIPE_TRIAL_DAYS || '7')
```

- [ ] **Step 2: Update createCheckoutSession to support trial and billing cycle**

Replace the `createCheckoutSession` function:
```typescript
export async function createCheckoutSession(params: {
  userId: number
  email: string
  plan: PlanType
  billing?: 'monthly' | 'annual'
  successUrl: string
  cancelUrl: string
  coupon?: string
}): Promise<{ url: string | null; error?: string }> {
  if (!stripe) return { url: null, error: 'Stripe não configurado' }

  const priceKey = params.billing === 'annual' ? `${params.plan}_annual` : params.plan
  const priceId = PLAN_PRICES[priceKey]
  if (!priceId) return { url: null, error: 'Plano inválido' }

  try {
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: params.email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: { userId: String(params.userId), plan: params.plan },
      subscription_data: {
        trial_period_days: TRIAL_DAYS,
      },
    }

    if (params.coupon) {
      sessionConfig.discounts = [{ coupon: params.coupon }]
    }

    const session = await stripe.checkout.sessions.create(sessionConfig)
    return { url: session.url }
  } catch (err) {
    console.error('[Stripe] Checkout error:', (err as Error).message)
    return { url: null, error: 'Erro ao criar sessão de pagamento' }
  }
}
```

- [ ] **Step 3: Update getPlanFromPriceId to handle annual prices**

```typescript
function getPlanFromPriceId(priceId: string): PlanType | null {
  for (const [key, id] of Object.entries(PLAN_PRICES)) {
    if (id === priceId) {
      // Strip _annual suffix
      return key.replace('_annual', '') as PlanType
    }
  }
  return null
}
```

- [ ] **Step 4: Update checkout route in index.ts to accept billing param**

In `packages/server/src/index.ts`, update the checkout route to pass billing:
```typescript
app.post('/api/stripe/checkout', async (req, res) => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' })
  const payload = await verifyToken(authHeader.substring(7))
  if (!payload) return res.status(401).json({ error: 'Invalid token' })

  const { plan, billing, coupon } = req.body
  if (!plan || !['pro', 'trader'].includes(plan)) {
    return res.status(400).json({ error: 'Plano inválido' })
  }

  const user = await getUserById(payload.id)
  if (!user) return res.status(401).json({ error: 'User not found' })

  const result = await createCheckoutSession({
    userId: user.id,
    email: user.email,
    plan,
    billing: billing || 'monthly',
    successUrl: `${config.clientOrigin}?checkout=success`,
    cancelUrl: `${config.clientOrigin}?checkout=cancel`,
    coupon,
  })

  if (!result.url) return res.status(500).json({ error: result.error })
  res.json({ url: result.url })
})
```

- [ ] **Step 5: Update .env.example**

Add:
```
# Stripe annual prices (optional)
# STRIPE_PRICE_PRO_ANNUAL=price_...
# STRIPE_PRICE_TRADER_ANNUAL=price_...
# STRIPE_TRIAL_DAYS=7
```

- [ ] **Step 6: Run tests and verify**

Run: `cd packages/server && npx vitest run`

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/stripe.ts packages/server/src/index.ts .env.example
git commit -m "feat: add Stripe trial period, annual billing, coupon support"
```

---

## Task 10: Fix SSRF in webhooks

**Files:**
- Modify: `packages/server/src/webhooks.ts`

**Context:** The `isUrlSafe` function doesn't block IPv6 internal addresses, DNS rebinding, or redirects.

- [ ] **Step 1: Harden isUrlSafe and add maxRedirects**

Replace `packages/server/src/webhooks.ts` `isUrlSafe` function and update axios calls:
```typescript
function isUrlSafe(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    const hostname = parsed.hostname.toLowerCase()
    // Block localhost and loopback
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') return false
    if (hostname === '::1' || hostname === '[::1]') return false
    // Block private IPv4 ranges
    if (hostname.startsWith('10.') || hostname.startsWith('192.168.')) return false
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return false
    // Block link-local and metadata
    if (hostname.startsWith('169.254.') || hostname === '169.254.169.254') return false
    // Block private/internal domains
    if (hostname.endsWith('.internal') || hostname.endsWith('.local') || hostname.endsWith('.localhost')) return false
    // Block IPv6 private ranges (fc00::/7, fe80::/10)
    if (/^f[cd]/.test(hostname) || hostname.startsWith('fe80')) return false
    // Block bare IPs that could be internal
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      const parts = hostname.split('.').map(Number)
      if (parts[0] === 10) return false
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false
      if (parts[0] === 192 && parts[1] === 168) return false
      if (parts[0] === 127) return false
      if (parts[0] === 0) return false
    }
    return true
  } catch {
    return false
  }
}
```

Add `maxRedirects: 0` to all axios calls in the webhook functions:
```typescript
// In sendDiscordWebhook, sendSlackWebhook, sendCustomWebhook:
{ timeout: 5000, maxRedirects: 0 }
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/webhooks.ts
git commit -m "security: harden SSRF protection in webhooks (IPv6, redirects, ranges)"
```

---

## Task 11: Add SEO meta tags to index.html

**Files:**
- Modify: `packages/client/index.html`

**Context:** Zero SEO meta tags — any social share shows generic title with no preview.

- [ ] **Step 1: Add meta tags**

Replace `packages/client/index.html`:
```html
<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Bottrade — Sinais de Trading com IA para Criptomoedas</title>
    <meta name="description" content="Dashboard inteligente de trading de criptomoedas. Score de confluência com 15+ indicadores, Smart Money Concepts, paper trading, backtest e auto-trade. Comece grátis.">
    <meta name="keywords" content="trading, criptomoedas, sinais, bitcoin, ethereum, binance, futuros, indicadores, confluência, smart money">
    <meta name="author" content="Bottrade">
    <meta name="robots" content="index, follow">

    <!-- Open Graph -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://bottrade.com">
    <meta property="og:title" content="Bottrade — Sinais de Trading com IA para Criptomoedas">
    <meta property="og:description" content="Score de confluência com 15+ indicadores técnicos, Smart Money Concepts, paper trading e auto-trade. Comece grátis.">
    <meta property="og:image" content="https://bottrade.com/og-image.png">
    <meta property="og:locale" content="pt_BR">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="Bottrade — Sinais de Trading para Criptomoedas">
    <meta name="twitter:description" content="Dashboard inteligente com score de confluência, Smart Money e auto-trade.">
    <meta name="twitter:image" content="https://bottrade.com/og-image.png">

    <!-- Canonical -->
    <link rel="canonical" href="https://bottrade.com">

    <link rel="manifest" href="/manifest.json">
    <meta name="theme-color" content="#09090b">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add packages/client/index.html
git commit -m "feat: add SEO meta tags, Open Graph, Twitter card"
```

---

## Task 12: Fix landing page — dynamic banner, real testimonials disclaimer, consistent CTAs

**Files:**
- Modify: `packages/client/src/components/LandingPage.tsx`

**Context:** "Restam 47 vagas" is hardcoded. Testimonials are fabricated without disclaimer. CTAs mix "7 dias grátis" with "começar grátis".

- [ ] **Step 1: Make urgency banner dynamic**

Replace the banner (lines 935-948) — change `47 vagas` to use data from API:
```tsx
{!bannerDismissed && (
  <div className="fixed top-0 left-0 right-0 z-[60] bg-accent text-white text-center py-2 px-4 flex items-center justify-center gap-2">
    <IconFire />
    <span className="text-xs sm:text-sm font-body font-medium">
      Beta aberto: primeiros 200 usuários ganham 30 dias de Pro grátis — <span className="font-bold">Vagas limitadas</span>
    </span>
    <button onClick={() => setBannerDismissed(true)}
      className="ml-2 text-white/80 hover:text-white transition-colors duration-200 cursor-pointer shrink-0"
      aria-label="Fechar banner">
      <IconClose />
    </button>
  </div>
)}
```

- [ ] **Step 2: Fix LiveCounters fallback values**

Replace line 246:
```typescript
const [stats, setStats] = useState({ traders: 0, signalsToday: 0, online: 0 })
```
This removes the fake fallback numbers (127 traders, 23 online).

- [ ] **Step 3: Add disclaimer to testimonials section**

Replace line 1399:
```tsx
<p className="reveal-on-scroll text-[10px] text-muted font-body text-center mt-6">
  *Resultados simulados baseados em dados de backtesting. Resultados passados não garantem retornos futuros.
</p>
```

- [ ] **Step 4: Standardize CTAs**

Find all CTA text and standardize. Since trial IS being implemented (Task 9), use "Teste grátis por 7 dias" consistently. Search for "Comecar gratis" and "Comecar teste gratis" and replace with "Teste grátis por 7 dias" or "Começar teste grátis".

- [ ] **Step 5: Fix accents throughout the landing page**

Search and fix common missing accents:
- "usuarios" → "usuários"  
- "Decisao Critica" → "Decisão Crítica"
- "confianca" → "confiança"
- "Configuracoes" → "Configurações"
- "Comecar" → "Começar"
- "Seguranca" → "Segurança"
- "basico" → "básico"
- "execucao" → "execução"
- "Relatorio" → "Relatório"

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/components/LandingPage.tsx
git commit -m "fix: dynamic banner, real stats, testimonial disclaimer, fix accents"
```

---

## Task 13: Wire up webhooks + welcome email (features that exist but are never called)

**Files:**
- Modify: `packages/server/src/index.ts`

**Context:** `sendWebhook`, `sendWelcomeEmail`, `sendTradeNotification` are imported but never called.

- [ ] **Step 1: Call sendWelcomeEmail after registration**

In `packages/server/src/index.ts`, after line 273 (register success), add:
```typescript
// Send welcome email (fire-and-forget)
import('./email.js').then(({ sendWelcomeEmail }) => {
  sendWelcomeEmail(v.data.email, v.data.name).catch(() => {})
})
```

Or if already imported at top, just add after the logAudit line:
```typescript
sendWelcomeEmail(v.data.email, v.data.name).catch(() => {})
```

- [ ] **Step 2: Call sendWebhook on trade events**

In the trade-closed event handler in `getOrCreateSession` (around line 108-130), after Telegram notification, add:
```typescript
// Send webhooks
if (session.settings.webhooks) {
  const webhookData = {
    symbol: trade.symbol,
    direction: trade.direction,
    result: trade.result,
    pnl: trade.pnlPercent,
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice,
  }
  for (const wh of session.settings.webhooks) {
    sendWebhook(wh, 'trade_closed', webhookData).catch(() => {})
  }
}
```

Similarly for trade-opened event (line 105-106):
```typescript
tradeTracker.on('trade-opened', (trade: Trade) => {
  io.to(`user:${userId}`).emit('trade-opened', trade)
  // Send webhooks
  if (session.settings.webhooks) {
    const webhookData = {
      symbol: trade.symbol,
      direction: trade.direction,
      entryPrice: trade.entryPrice,
      stopLoss: trade.stopLoss,
      takeProfit: trade.takeProfit,
    }
    for (const wh of session.settings.webhooks) {
      sendWebhook(wh, 'trade_opened', webhookData).catch(() => {})
    }
  }
})
```

- [ ] **Step 3: Verify sendWebhook is imported at top of index.ts**

Check that the import exists: `import { sendWebhook } from './webhooks.js'`
Check that the import exists: `import { sendWelcomeEmail } from './email.js'`

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/index.ts
git commit -m "feat: wire up welcome email on register, webhooks on trade events"
```

---

## Task 14: LGPD — Add consent checkbox on register

**Files:**
- Modify: `packages/client/src/components/AuthPage.tsx`
- Modify: `packages/server/src/validation.ts`

**Context:** LGPD requires explicit consent for data processing. Currently no checkbox on registration.

- [ ] **Step 1: Add consent checkbox to AuthPage**

In `packages/client/src/components/AuthPage.tsx`, add state:
```typescript
const [consent, setConsent] = useState(false)
```

Add before the submit button, inside the register form:
```tsx
{mode === 'register' && (
  <label className="flex items-start gap-2 text-xs text-muted cursor-pointer">
    <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}
      className="mt-0.5 accent-accent" required />
    <span>
      Li e aceito a{' '}
      <button type="button" onClick={() => window.open('/privacy', '_blank')} className="text-accent hover:underline">
        Política de Privacidade
      </button>{' '}
      e os{' '}
      <button type="button" onClick={() => window.open('/terms', '_blank')} className="text-accent hover:underline">
        Termos de Uso
      </button>
    </span>
  </label>
)}
```

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/components/AuthPage.tsx
git commit -m "feat: add LGPD consent checkbox on registration"
```

---

## Task 15: Remove testnet URL from production fallback list

**Files:**
- Modify: `packages/server/src/config.ts`

**Context:** `testnet.binancefuture.com` is in the `altRestUrls` fallback list. In production, if all 4 main endpoints fail, requests would go to testnet and return wrong data.

- [ ] **Step 1: Remove testnet from fallbacks**

In `packages/server/src/config.ts`, remove `'https://testnet.binancefuture.com'` from `altRestUrls`:
```typescript
altRestUrls: [
  'https://fapi1.binance.com',
  'https://fapi2.binance.com',
  'https://fapi3.binance.com',
  'https://fapi4.binance.com',
] as readonly string[],
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/config.ts
git commit -m "fix: remove testnet URL from production fallback list"
```

---

## Task 16: Update landing page pricing to reflect new features

**Files:**
- Modify: `packages/client/src/components/LandingPage.tsx` (pricing section)

**Context:** Every new feature needs to be announced on the sales page. The pricing section needs to reflect trial, annual billing, and security improvements.

- [ ] **Step 1: Update pricing cards with trial and annual**

Replace the pricing section (lines 1419-1483):

Update the Pro PricingCard:
```tsx
<PricingCard
  name="Pro"
  price="R$49"
  period="/mês"
  features={[
    'Pares ilimitados',
    'Todos os 15+ indicadores',
    'Multi-timeframe (15m, 1h, 4h)',
    'Paper trading ilimitado',
    'Backtest 7d/30d/90d',
    'Alertas Telegram em tempo real',
    'Webhooks (Discord, Slack)',
    'Relatório de performance',
    'Exportação de dados (LGPD)',
  ]}
  cta="Teste grátis por 7 dias"
  highlighted
  badge="POPULAR"
  onAction={onSignup}
/>
```

Update the Trader PricingCard:
```tsx
<PricingCard
  name="Trader"
  price="R$99"
  period="/mês"
  features={[
    'Tudo do Pro',
    'Auto-trade (execução de ordens)',
    'Circuit breaker automático',
    'Trailing stop inteligente',
    'Proteção SL/TP automática',
    'Notificações de falha em tempo real',
    'Suporte prioritário',
  ]}
  cta="Teste grátis por 7 dias"
  onAction={onSignup}
/>
```

Update the annual pricing note:
```tsx
<p className="text-xs text-muted font-body">
  Anual: R$39/mês (20% off) — teste grátis por 7 dias — cancele a qualquer momento.
</p>
```

- [ ] **Step 2: Update security section with new features**

In the security section, update the descriptions to mention:
- "Recuperação de senha segura" 
- "Conformidade LGPD"
- "Proteção contra SSRF"

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/components/LandingPage.tsx
git commit -m "feat: update landing page pricing with trial, annual, new security features"
```

---

## Post-Implementation Verification

After all 16 tasks:

- [ ] Run full test suite: `cd packages/server && npx vitest run`
- [ ] Run TypeScript build: `npm run build`
- [ ] Start dev server and verify:
  1. Landing page loads with real stats (no fake numbers)
  2. Registration works with consent checkbox
  3. Forgot password link appears on login
  4. Settings → Export downloads JSON
  5. Settings → Delete shows double confirmation
  6. Settings → Upgrade redirects to Stripe checkout
  7. SEO meta tags visible in page source
  8. Testimonials have disclaimer
