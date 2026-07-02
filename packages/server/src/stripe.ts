import Stripe from 'stripe'
import { updateUserPlan } from './auth.js'
import { logAudit } from './auditLog.js'
import { pool } from './database.js'
import type { RowDataPacket } from 'mysql2/promise'
import type { PlanType } from '@bottrade/shared'

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || ''
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || ''

let stripe: Stripe | null = null

export function initStripe(): boolean {
  if (!STRIPE_SECRET_KEY) {
    console.log('[Stripe] No API key configured — billing disabled')
    return false
  }
  stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' as any })
  console.log('[Stripe] Initialized')
  return true
}

export function isStripeConfigured(): boolean {
  return stripe !== null
}

// Price IDs from Stripe Dashboard (configured via env)
const PLAN_PRICES: Record<string, string> = {
  free: '',
  pro: process.env.STRIPE_PRICE_PRO || '',
  trader: process.env.STRIPE_PRICE_TRADER || '',
  pro_annual: process.env.STRIPE_PRICE_PRO_ANNUAL || '',
  trader_annual: process.env.STRIPE_PRICE_TRADER_ANNUAL || '',
}

const TRIAL_DAYS = parseInt(process.env.STRIPE_TRIAL_DAYS || '7')

// Reverse lookup
function getPlanFromPriceId(priceId: string): PlanType | null {
  for (const [key, id] of Object.entries(PLAN_PRICES)) {
    if (id === priceId) {
      return key.replace('_annual', '') as PlanType
    }
  }
  return null
}

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

export async function createPortalSession(stripeCustomerId: string, returnUrl: string): Promise<{ url: string | null; error?: string }> {
  if (!stripe) return { url: null, error: 'Stripe não configurado' }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    })
    return { url: session.url }
  } catch (err) {
    console.error('[Stripe] Portal error:', (err as Error).message)
    return { url: null, error: 'Erro ao abrir portal' }
  }
}

export async function handleWebhook(body: Buffer, signature: string): Promise<{ success: boolean; error?: string }> {
  if (!stripe) return { success: false, error: 'Stripe não configurado' }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('[Stripe] Webhook signature verification failed:', (err as Error).message)
    return { success: false, error: 'Invalid signature' }
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = parseInt(session.metadata?.userId || '0')
        const plan = (session.metadata?.plan || 'pro') as PlanType
        const customerId = session.customer as string
        const subscriptionId = session.subscription as string

        if (userId) {
          // Set expiration to 1 month from now
          const expiresAt = new Date()
          expiresAt.setMonth(expiresAt.getMonth() + 1)

          await updateUserPlan(userId, plan, expiresAt, customerId, subscriptionId)
          await logAudit({ userId, action: 'SETTINGS_UPDATE', details: { type: 'plan_upgrade', plan, customerId } })
          console.log(`[Stripe] User ${userId} upgraded to ${plan}`)
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const priceId = subscription.items.data[0]?.price.id
        const plan = getPlanFromPriceId(priceId || '') || 'pro'
        const customerId = subscription.customer as string

        try {
          const [rows] = await pool.execute<RowDataPacket[]>(
            'SELECT id FROM users WHERE stripe_customer_id = ?', [customerId]
          )
          if (rows.length > 0) {
            if (subscription.status === 'active') {
              const expiresAt = new Date((subscription as any).current_period_end * 1000)
              await updateUserPlan(rows[0].id, plan, expiresAt)
              console.log(`[Stripe] User ${rows[0].id} subscription updated to ${plan}`)
            } else if (subscription.status === 'canceled' || subscription.status === 'unpaid' || subscription.status === 'past_due') {
              await pool.execute(
                'UPDATE users SET plan = ?, plan_expires_at = NULL WHERE id = ?',
                ['free', rows[0].id]
              )
              console.log(`[Stripe] User ${rows[0].id} downgraded to free (subscription status: ${subscription.status})`)
            }
          }
        } catch (err) {
          console.error('[Stripe] Error updating user subscription:', (err as Error).message)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        try {
          const [rows] = await pool.execute<RowDataPacket[]>(
            'SELECT id FROM users WHERE stripe_customer_id = ?', [customerId]
          )
          if (rows.length > 0) {
            await pool.execute(
              'UPDATE users SET plan = ?, plan_expires_at = NULL WHERE id = ?',
              ['free', rows[0].id]
            )
            console.log(`[Stripe] User ${rows[0].id} downgraded to free (subscription deleted)`)
          }
        } catch (err) {
          console.error('[Stripe] Error downgrading user:', (err as Error).message)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string
        console.log(`[Stripe] Payment failed for customer ${customerId}`)
        break
      }
    }

    return { success: true }
  } catch (err) {
    console.error('[Stripe] Webhook processing error:', (err as Error).message)
    return { success: false, error: 'Processing error' }
  }
}
