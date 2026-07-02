import { describe, it, expect } from 'vitest'
import {
  updateSettingsSchema,
  executeOrderSchema,
  backtestParamsSchema,
  createAlertSchema,
  paginationSchema,
  registerSchema,
  loginSchema,
  analyzePairSchema,
  toggleFavoriteSchema,
  symbolOnlySchema,
  deleteAlertSchema,
  validate,
} from '../validation.js'

// ── validate helper ─────────────────────────────────────────────────────────

describe('validate', () => {
  it('returns success with parsed data for valid input', () => {
    const result = validate(loginSchema, { email: 'test@test.com', password: 'pass' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe('test@test.com')
    }
  })

  it('returns error string for invalid input', () => {
    const result = validate(loginSchema, { email: 'bad' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(typeof result.error).toBe('string')
      expect(result.error.length).toBeGreaterThan(0)
    }
  })
})

// ── registerSchema ──────────────────────────────────────────────────────────

describe('registerSchema', () => {
  it('accepts valid registration data', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      name: 'John Doe',
      password: 'secure123',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = registerSchema.safeParse({
      email: 'not-an-email',
      name: 'John',
      password: 'secure123',
    })
    expect(result.success).toBe(false)
  })

  it('rejects short name (< 2 chars)', () => {
    const result = registerSchema.safeParse({
      email: 'test@test.com',
      name: 'A',
      password: 'secure123',
    })
    expect(result.success).toBe(false)
  })

  it('rejects long name (> 100 chars)', () => {
    const result = registerSchema.safeParse({
      email: 'test@test.com',
      name: 'A'.repeat(101),
      password: 'secure123',
    })
    expect(result.success).toBe(false)
  })

  it('rejects short password (< 8 chars)', () => {
    const result = registerSchema.safeParse({
      email: 'test@test.com',
      name: 'John',
      password: '1234567',
    })
    expect(result.success).toBe(false)
  })

  it('rejects long password (> 100 chars)', () => {
    const result = registerSchema.safeParse({
      email: 'test@test.com',
      name: 'John',
      password: 'a'.repeat(101),
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing fields', () => {
    expect(registerSchema.safeParse({}).success).toBe(false)
    expect(registerSchema.safeParse({ email: 'test@test.com' }).success).toBe(false)
    expect(registerSchema.safeParse({ email: 'test@test.com', name: 'John' }).success).toBe(false)
  })

  it('rejects email longer than 255 chars', () => {
    const result = registerSchema.safeParse({
      email: 'a'.repeat(250) + '@b.com',
      name: 'John',
      password: 'secure123',
    })
    expect(result.success).toBe(false)
  })
})

// ── loginSchema ─────────────────────────────────────────────────────────────

describe('loginSchema', () => {
  it('accepts valid login data', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true)
  })

  it('rejects invalid email', () => {
    expect(loginSchema.safeParse({ email: 'bad', password: 'x' }).success).toBe(false)
  })

  it('rejects empty password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false)
  })
})

// ── symbolSchema (via symbolOnlySchema) ─────────────────────────────────────

describe('symbolOnlySchema', () => {
  it('accepts valid symbols', () => {
    expect(symbolOnlySchema.safeParse({ symbol: 'ETHUSDT' }).success).toBe(true)
    expect(symbolOnlySchema.safeParse({ symbol: 'BTCUSDT' }).success).toBe(true)
    expect(symbolOnlySchema.safeParse({ symbol: '1000PEPEUSDT' }).success).toBe(true)
  })

  it('rejects lowercase symbols', () => {
    expect(symbolOnlySchema.safeParse({ symbol: 'ethusdt' }).success).toBe(false)
  })

  it('rejects symbols with special characters', () => {
    expect(symbolOnlySchema.safeParse({ symbol: 'ETH-USDT' }).success).toBe(false)
    expect(symbolOnlySchema.safeParse({ symbol: 'ETH/USDT' }).success).toBe(false)
    expect(symbolOnlySchema.safeParse({ symbol: 'ETH USDT' }).success).toBe(false)
  })

  it('rejects empty symbol', () => {
    expect(symbolOnlySchema.safeParse({ symbol: '' }).success).toBe(false)
  })

  it('rejects symbol longer than 20 chars', () => {
    expect(symbolOnlySchema.safeParse({ symbol: 'A'.repeat(21) }).success).toBe(false)
  })

  it('rejects SQL injection attempts', () => {
    expect(symbolOnlySchema.safeParse({ symbol: "'; DROP TABLE--" }).success).toBe(false)
    expect(symbolOnlySchema.safeParse({ symbol: 'ETHUSDT; DELETE FROM' }).success).toBe(false)
  })

  it('rejects XSS attempts', () => {
    expect(symbolOnlySchema.safeParse({ symbol: '<script>alert(1)</script>' }).success).toBe(false)
  })
})

// ── executeOrderSchema ──────────────────────────────────────────────────────

describe('executeOrderSchema', () => {
  const validOrder = {
    symbol: 'ETHUSDT',
    side: 'BUY',
    type: 'MARKET',
    quantity: 0.5,
    stopLoss: 2000,
    takeProfit: 2500,
  }

  it('accepts valid order', () => {
    expect(executeOrderSchema.safeParse(validOrder).success).toBe(true)
  })

  it('rejects invalid side', () => {
    expect(executeOrderSchema.safeParse({ ...validOrder, side: 'HOLD' }).success).toBe(false)
  })

  it('rejects non-MARKET type', () => {
    expect(executeOrderSchema.safeParse({ ...validOrder, type: 'LIMIT' }).success).toBe(false)
  })

  it('rejects negative quantity', () => {
    expect(executeOrderSchema.safeParse({ ...validOrder, quantity: -1 }).success).toBe(false)
  })

  it('rejects zero quantity', () => {
    expect(executeOrderSchema.safeParse({ ...validOrder, quantity: 0 }).success).toBe(false)
  })

  it('rejects quantity above 100000', () => {
    expect(executeOrderSchema.safeParse({ ...validOrder, quantity: 100001 }).success).toBe(false)
  })

  it('rejects negative stop loss', () => {
    expect(executeOrderSchema.safeParse({ ...validOrder, stopLoss: -100 }).success).toBe(false)
  })

  it('rejects negative take profit', () => {
    expect(executeOrderSchema.safeParse({ ...validOrder, takeProfit: -100 }).success).toBe(false)
  })
})

// ── updateSettingsSchema ────────────────────────────────────────────────────

describe('updateSettingsSchema', () => {
  it('accepts valid partial settings', () => {
    const result = updateSettingsSchema.safeParse({
      baseCapital: 500,
      leverage: 10,
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty object (all fields optional)', () => {
    expect(updateSettingsSchema.safeParse({}).success).toBe(true)
  })

  it('rejects leverage above 125', () => {
    expect(updateSettingsSchema.safeParse({ leverage: 126 }).success).toBe(false)
  })

  it('rejects leverage below 1', () => {
    expect(updateSettingsSchema.safeParse({ leverage: 0 }).success).toBe(false)
  })

  it('rejects baseCapital below 1', () => {
    expect(updateSettingsSchema.safeParse({ baseCapital: 0 }).success).toBe(false)
  })

  it('rejects baseCapital above 1000000', () => {
    expect(updateSettingsSchema.safeParse({ baseCapital: 1000001 }).success).toBe(false)
  })

  it('rejects extra/unknown fields (strict mode)', () => {
    const result = updateSettingsSchema.safeParse({ hackField: 'malicious' })
    expect(result.success).toBe(false)
  })

  it('validates autoTrade nested object', () => {
    const result = updateSettingsSchema.safeParse({
      autoTrade: { enabled: true, mode: 'auto', maxDailyLoss: 5, maxDailyTrades: 10 },
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid autoTrade mode', () => {
    const result = updateSettingsSchema.safeParse({
      autoTrade: { enabled: true, mode: 'full_auto' },
    })
    expect(result.success).toBe(false)
  })

  it('validates scoreConfig weights', () => {
    const result = updateSettingsSchema.safeParse({
      scoreConfig: {
        longThreshold: 70,
        weights: { structure: 25, macd: 20 },
      },
    })
    expect(result.success).toBe(true)
  })

  it('rejects weight above 50', () => {
    const result = updateSettingsSchema.safeParse({
      scoreConfig: { weights: { structure: 51 } },
    })
    expect(result.success).toBe(false)
  })

  it('rejects stochRsiHighThreshold below 50', () => {
    expect(updateSettingsSchema.safeParse({ stochRsiHighThreshold: 49 }).success).toBe(false)
  })

  it('rejects stochRsiLowThreshold above 50', () => {
    expect(updateSettingsSchema.safeParse({ stochRsiLowThreshold: 51 }).success).toBe(false)
  })

  it('validates indicatorPeriods', () => {
    const result = updateSettingsSchema.safeParse({
      indicatorPeriods: { rsiPeriod: 14, macdFast: 12, macdSlow: 26 },
    })
    expect(result.success).toBe(true)
  })

  it('rejects indicator period below minimum', () => {
    expect(updateSettingsSchema.safeParse({ indicatorPeriods: { rsiPeriod: 1 } }).success).toBe(false)
  })

  it('validates binanceApiKey max length', () => {
    expect(updateSettingsSchema.safeParse({ binanceApiKey: 'a'.repeat(201) }).success).toBe(false)
    expect(updateSettingsSchema.safeParse({ binanceApiKey: 'a'.repeat(200) }).success).toBe(true)
  })
})

// ── backtestParamsSchema ────────────────────────────────────────────────────

describe('backtestParamsSchema', () => {
  it('accepts valid backtest params', () => {
    const result = backtestParamsSchema.safeParse({
      symbols: ['ETHUSDT', 'BTCUSDT'],
      period: '30d',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty symbols array', () => {
    expect(backtestParamsSchema.safeParse({ symbols: [], period: '7d' }).success).toBe(false)
  })

  it('rejects more than 10 symbols', () => {
    const symbols = Array.from({ length: 11 }, (_, i) => `SYM${i}USDT`)
    expect(backtestParamsSchema.safeParse({ symbols, period: '7d' }).success).toBe(false)
  })

  it('rejects invalid period', () => {
    expect(backtestParamsSchema.safeParse({ symbols: ['ETHUSDT'], period: '365d' }).success).toBe(false)
  })

  it('accepts optional fields', () => {
    const result = backtestParamsSchema.safeParse({
      symbols: ['ETHUSDT'],
      period: '90d',
      scoreThreshold: 85,
      stopLossPercent: 2,
      takeProfitPercent: 6,
    })
    expect(result.success).toBe(true)
  })
})

// ── createAlertSchema ───────────────────────────────────────────────────────

describe('createAlertSchema', () => {
  it('accepts valid alert', () => {
    const result = createAlertSchema.safeParse({
      symbol: 'ETHUSDT',
      condition: 'price_above',
      value: 2500,
    })
    expect(result.success).toBe(true)
  })

  it('accepts all condition types', () => {
    const conditions = ['price_above', 'price_below', 'score_above', 'score_below', 'funding_above', 'funding_below']
    for (const condition of conditions) {
      expect(createAlertSchema.safeParse({ symbol: 'ETHUSDT', condition, value: 1 }).success).toBe(true)
    }
  })

  it('rejects invalid condition', () => {
    expect(createAlertSchema.safeParse({ symbol: 'ETHUSDT', condition: 'invalid', value: 1 }).success).toBe(false)
  })

  it('rejects message longer than 200 chars', () => {
    expect(createAlertSchema.safeParse({
      symbol: 'ETHUSDT', condition: 'price_above', value: 1, message: 'x'.repeat(201),
    }).success).toBe(false)
  })
})

// ── paginationSchema ────────────────────────────────────────────────────────

describe('paginationSchema', () => {
  it('accepts empty object (uses defaults)', () => {
    const result = paginationSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('applies default limit of 50', () => {
    const result = paginationSchema.safeParse({})
    if (result.success) {
      expect(result.data.limit).toBe(50)
    }
  })

  it('applies default offset of 0', () => {
    const result = paginationSchema.safeParse({})
    if (result.success) {
      expect(result.data.offset).toBe(0)
    }
  })

  it('rejects limit above 200', () => {
    expect(paginationSchema.safeParse({ limit: 201 }).success).toBe(false)
  })

  it('rejects negative offset', () => {
    expect(paginationSchema.safeParse({ offset: -1 }).success).toBe(false)
  })

  it('validates optional symbol filter', () => {
    expect(paginationSchema.safeParse({ symbol: 'ETHUSDT' }).success).toBe(true)
    expect(paginationSchema.safeParse({ symbol: 'bad!' }).success).toBe(false)
  })
})

// ── deleteAlertSchema ───────────────────────────────────────────────────────

describe('deleteAlertSchema', () => {
  it('accepts valid id', () => {
    expect(deleteAlertSchema.safeParse({ id: 'alert-123' }).success).toBe(true)
  })

  it('rejects empty id', () => {
    expect(deleteAlertSchema.safeParse({ id: '' }).success).toBe(false)
  })

  it('rejects id longer than 100 chars', () => {
    expect(deleteAlertSchema.safeParse({ id: 'x'.repeat(101) }).success).toBe(false)
  })
})
