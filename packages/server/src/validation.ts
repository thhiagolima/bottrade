import { z } from 'zod'

// Symbol validation - only alphanumeric, max 20 chars
const symbolSchema = z.string().min(1).max(20).regex(/^[A-Z0-9]+$/, 'Invalid symbol format')

const riskConfigSchema = z.object({
  slMode: z.enum(['auto', 'atr', 'fixed']).optional(),
  slFixedPercent: z.number().min(0.1).max(20).optional(),
  atrMultiplier: z.number().min(0.5).max(5).optional(),
  tpMode: z.enum(['rr', 'fixed']).optional(),
  tpFixedPercent: z.number().min(0.1).max(50).optional(),
  rrRatio: z.number().min(0.5).max(10).optional(),
  useSmartMoneySR: z.boolean().optional(),
  minSlPercent: z.number().min(0.1).max(10).optional(),
  maxSlPercent: z.number().min(0.5).max(20).optional(),
}).optional()

const indicatorPeriodsSchema = z.object({
  rsiPeriod: z.number().min(2).max(100).optional(),
  stochRsiPeriod: z.number().min(2).max(100).optional(),
  stochRsiK: z.number().min(1).max(20).optional(),
  stochRsiD: z.number().min(1).max(20).optional(),
  macdFast: z.number().min(2).max(100).optional(),
  macdSlow: z.number().min(5).max(200).optional(),
  macdSignal: z.number().min(2).max(50).optional(),
  bollingerPeriod: z.number().min(5).max(100).optional(),
  bollingerStdDev: z.number().min(0.5).max(5).optional(),
  atrPeriod: z.number().min(2).max(100).optional(),
  adxPeriod: z.number().min(2).max(100).optional(),
  cciPeriod: z.number().min(5).max(100).optional(),
  mfiPeriod: z.number().min(2).max(100).optional(),
  williamsRPeriod: z.number().min(2).max(100).optional(),
}).optional()

const scoreConfigSchema = z.object({
  longThreshold: z.number().min(50).max(95).optional(),
  shortThreshold: z.number().min(5).max(50).optional(),
  highConfidenceLong: z.number().min(70).max(100).optional(),
  highConfidenceShort: z.number().min(0).max(30).optional(),
  weights: z.object({
    structure: z.number().min(0).max(100).optional(),
    macd: z.number().min(0).max(100).optional(),
    stochRsi: z.number().min(0).max(100).optional(),
    volume: z.number().min(0).max(100).optional(),
    funding: z.number().min(0).max(100).optional(),
    emaAlignment: z.number().min(0).max(100).optional(),
  }).refine((w) => {
    if (!w) return true
    const total = (w.structure ?? 25) + (w.macd ?? 20) + (w.stochRsi ?? 20) + (w.volume ?? 15) + (w.funding ?? 15) + (w.emaAlignment ?? 5)
    return total > 0 && total <= 120
  }, { message: 'Soma dos pesos deve ficar entre 1 e 120' }).optional(),
}).optional()

const strategyProfileSchema = z.object({
  id: z.string().min(1).max(60).regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().min(1).max(80),
  scoreConfig: scoreConfigSchema,
  riskConfig: riskConfigSchema,
  indicatorToggles: z.record(z.string(), z.boolean()).optional(),
  indicatorPeriods: indicatorPeriodsSchema,
})

// Settings update
export const updateSettingsSchema = z.object({
  userMode: z.enum(['simple', 'trader', 'pro']).optional(),
  baseCapital: z.number().min(1).max(1000000).optional(),
  leverage: z.number().min(1).max(125).optional(),
  fundingThreshold: z.number().min(0).max(1).optional(),
  stochRsiHighThreshold: z.number().min(50).max(100).optional(),
  stochRsiLowThreshold: z.number().min(0).max(50).optional(),
  soundAlerts: z.boolean().optional(),
  desktopNotifications: z.boolean().optional(),
  pairs: z.array(symbolSchema).min(1).max(50).optional(),
  favorites: z.array(symbolSchema).min(1).max(50).optional(),
  theme: z.enum(['dark', 'light']).optional(),
  binanceApiKey: z.string().max(200).optional(),
  binanceApiSecret: z.string().max(200).optional(),
  telegramBotToken: z.string().max(200).optional(),
  telegramChatId: z.string().max(200).optional(),
  autoTrade: z.object({
    enabled: z.boolean(),
    mode: z.enum(['semi', 'auto']),
    maxOpenTrades: z.number().min(1).max(20).optional(),
    maxDailyLoss: z.number().min(0).max(100).optional(),
    maxDailyTrades: z.number().min(0).max(100).optional(),
    allowedPairs: z.array(symbolSchema).max(50).optional(),
  }).optional(),
  indicatorToggles: z.record(z.string(), z.boolean()).optional(),
  scoreConfig: z.object({
    longThreshold: z.number().min(50).max(95).optional(),
    shortThreshold: z.number().min(5).max(50).optional(),
    highConfidenceLong: z.number().min(70).max(100).optional(),
    highConfidenceShort: z.number().min(0).max(30).optional(),
    weights: z.object({
      structure: z.number().min(0).max(100).optional(),
      macd: z.number().min(0).max(100).optional(),
      stochRsi: z.number().min(0).max(100).optional(),
      volume: z.number().min(0).max(100).optional(),
      funding: z.number().min(0).max(100).optional(),
      emaAlignment: z.number().min(0).max(100).optional(),
    }).refine((w) => {
      if (!w) return true
      const total = (w.structure ?? 25) + (w.macd ?? 20) + (w.stochRsi ?? 20) + (w.volume ?? 15) + (w.funding ?? 15) + (w.emaAlignment ?? 5)
      return total <= 120
    }, { message: 'Soma dos pesos não pode exceder 120' }).optional(),
  }).optional(),
  riskConfig: riskConfigSchema,
  indicatorPeriods: z.object({
    rsiPeriod: z.number().min(2).max(100).optional(),
    stochRsiPeriod: z.number().min(2).max(100).optional(),
    stochRsiK: z.number().min(1).max(20).optional(),
    stochRsiD: z.number().min(1).max(20).optional(),
    macdFast: z.number().min(2).max(100).optional(),
    macdSlow: z.number().min(5).max(200).optional(),
    macdSignal: z.number().min(2).max(50).optional(),
    bollingerPeriod: z.number().min(5).max(100).optional(),
    bollingerStdDev: z.number().min(0.5).max(5).optional(),
    atrPeriod: z.number().min(2).max(100).optional(),
    adxPeriod: z.number().min(2).max(100).optional(),
    cciPeriod: z.number().min(5).max(100).optional(),
    mfiPeriod: z.number().min(2).max(100).optional(),
    williamsRPeriod: z.number().min(2).max(100).optional(),
  }).optional(),
  strategyProfiles: z.array(strategyProfileSchema).max(20).optional(),
  pairProfileAssignments: z.record(symbolSchema, z.string().min(1).max(60)).optional(),
  paperProfileAssignments: z.record(symbolSchema, z.string().min(1).max(60)).optional(),
}).strict()

// Execute order
export const executeOrderSchema = z.object({
  symbol: symbolSchema,
  side: z.enum(['BUY', 'SELL']),
  type: z.literal('MARKET'),
  quantity: z.number().positive().max(100000),
  stopLoss: z.number().positive(),
  takeProfit: z.number().positive(),
})

// Backtest params
export const backtestParamsSchema = z.object({
  symbols: z.array(symbolSchema).min(1).max(10),
  period: z.enum(['7d', '30d', '90d']),
  scoreThreshold: z.number().min(50).max(100).optional(),
  stopLossPercent: z.number().min(0.1).max(10).optional(),
  takeProfitPercent: z.number().min(0.1).max(20).optional(),
})

// Custom alert
export const createAlertSchema = z.object({
  symbol: symbolSchema,
  condition: z.enum(['price_above', 'price_below', 'score_above', 'score_below', 'funding_above', 'funding_below']),
  value: z.number(),
  message: z.string().max(200).optional(),
})

// History/pagination
export const paginationSchema = z.object({
  symbol: symbolSchema.optional(),
  limit: z.number().min(1).max(200).optional().default(50),
  offset: z.number().min(0).optional().default(0),
})

// Auth
export const registerSchema = z.object({
  email: z.string().email('Email inválido').max(255),
  name: z.string().min(2).max(100),
  password: z.string().min(8).max(100),
})

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(100),
})

// Analyze pair
export const analyzePairSchema = z.object({
  symbol: symbolSchema,
})

// Toggle favorite
export const toggleFavoriteSchema = z.object({
  symbol: symbolSchema,
})

// Replace one monitored favorite with another symbol
export const replaceFavoriteSchema = z.object({
  removeSymbol: symbolSchema,
  addSymbol: symbolSchema,
})

// Symbol-only schema (e.g. get-candles)
export const symbolOnlySchema = z.object({
  symbol: symbolSchema
})

// Delete alert
export const deleteAlertSchema = z.object({
  id: z.string().min(1).max(100)
})

// Generic validation helper
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  const errors = result.error.issues.map((e: { path: PropertyKey[]; message: string }) => `${e.path.join('.')}: ${e.message}`).join(', ')
  return { success: false, error: errors }
}
