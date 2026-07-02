import { PLAN_LIMITS, PlanLimits, PlanType } from '@bottrade/shared'
import { getUserById } from './auth.js'
import { pool } from './database.js'

const PLAN_SETTINGS_KEY = 'plan_limits'

export interface AdminPlanConfig {
  name: string
  price: string
  features: {
    paresIlimitados: boolean
    todosIndicadores: boolean
    multiTimeframe: boolean
    paperTrading: boolean
    backtest: boolean
    telegram: boolean
    autoTrade: boolean
    execucaoOrdens: boolean
  }
  maxFavorites: number
}

type AdminPlanMap = Record<PlanType, AdminPlanConfig>

function defaultAdminPlans(): AdminPlanMap {
  return {
    free: {
      name: 'Free',
      price: 'R$0',
      features: { paresIlimitados: false, todosIndicadores: false, multiTimeframe: false, paperTrading: false, backtest: false, telegram: false, autoTrade: false, execucaoOrdens: false },
      maxFavorites: PLAN_LIMITS.free.maxFavorites,
    },
    pro: {
      name: 'Pro',
      price: 'R$49/mes',
      features: { paresIlimitados: true, todosIndicadores: true, multiTimeframe: true, paperTrading: true, backtest: true, telegram: true, autoTrade: false, execucaoOrdens: false },
      maxFavorites: PLAN_LIMITS.pro.maxFavorites,
    },
    trader: {
      name: 'Trader',
      price: 'R$99/mes',
      features: { paresIlimitados: true, todosIndicadores: true, multiTimeframe: true, paperTrading: true, backtest: true, telegram: true, autoTrade: true, execucaoOrdens: true },
      maxFavorites: PLAN_LIMITS.trader.maxFavorites,
    },
  }
}

function planKeyFromName(name: string): PlanType {
  const normalized = name.toLowerCase().trim()
  if (normalized === 'pro') return 'pro'
  if (normalized === 'trader') return 'trader'
  return 'free'
}

function adminPlanToLimits(plan: PlanType, config: AdminPlanConfig): PlanLimits {
  const defaults = PLAN_LIMITS[plan]
  return {
    ...defaults,
    maxFavorites: Math.max(0, Math.floor(Number(config.maxFavorites) || 0)),
    multiTimeframe: !!config.features.multiTimeframe,
    paperTrading: !!config.features.paperTrading,
    backtest: !!config.features.backtest,
    autoTrade: !!config.features.autoTrade,
    executeOrders: !!config.features.execucaoOrdens,
    telegramAlerts: !!config.features.telegram,
    customAlerts: plan !== 'free' && !!config.features.telegram,
    allIndicators: !!config.features.todosIndicadores,
  }
}

async function readPlanMap(): Promise<AdminPlanMap> {
  const defaults = defaultAdminPlans()
  try {
    const [rows] = await pool.execute<any[]>('SELECT value FROM settings WHERE key_name = ?', [PLAN_SETTINGS_KEY])
    if (!rows.length) return defaults
    const raw = typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value
    return { ...defaults, ...raw }
  } catch {
    return defaults
  }
}

export async function getAdminPlanConfigs(): Promise<AdminPlanMap> {
  return readPlanMap()
}

export async function saveAdminPlanConfig(plan: AdminPlanConfig): Promise<AdminPlanMap> {
  const key = planKeyFromName(plan.name)
  const plans = await readPlanMap()
  plans[key] = {
    ...plans[key],
    ...plan,
    maxFavorites: Math.max(0, Math.floor(Number(plan.maxFavorites) || 0)),
  }
  await pool.execute(
    'INSERT INTO settings (key_name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
    [PLAN_SETTINGS_KEY, JSON.stringify(plans)],
  )
  return plans
}

export async function checkFeature(userId: number, feature: keyof typeof PLAN_LIMITS.free): Promise<{ allowed: boolean; plan: PlanType; requiredPlan: PlanType }> {
  const user = await getUserById(userId)
  let plan: PlanType = user?.plan || 'free'

  // Check if plan has expired
  if (plan !== 'free' && user?.planExpiresAt) {
    const expires = new Date(user.planExpiresAt)
    if (expires < new Date()) {
      plan = 'free' // Expired, downgrade to free
    }
  }

  const limits = await getPlanLimits(plan)
  const allowed = !!limits[feature]

  // Find the minimum plan that allows this feature
  let requiredPlan: PlanType = 'trader'
  for (const p of ['free', 'pro', 'trader'] as PlanType[]) {
    const candidateLimits = await getPlanLimits(p)
    if (candidateLimits[feature]) {
      requiredPlan = p
      break
    }
  }

  return { allowed, plan, requiredPlan }
}

export async function getPlanLimits(plan: PlanType): Promise<PlanLimits> {
  const plans = await readPlanMap()
  return adminPlanToLimits(plan, plans[plan])
}
