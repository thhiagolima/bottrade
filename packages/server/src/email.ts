import nodemailer from 'nodemailer'

const SMTP_HOST = process.env.SMTP_HOST || ''
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587')
const SMTP_USER = process.env.SMTP_USER || ''
const SMTP_PASS = process.env.SMTP_PASS || ''
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@bottrade.com'
const APP_URL = process.env.APP_URL || 'http://localhost:5173'

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

let transporter: nodemailer.Transporter | null = null

export function initEmail(): boolean {
  if (!SMTP_HOST) {
    console.log('[Email] No SMTP configured — email disabled')
    return false
  }
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  })
  console.log('[Email] Initialized')
  return true
}

export function isEmailConfigured(): boolean {
  return transporter !== null
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!transporter) return false
  try {
    await transporter.sendMail({ from: `Bottrade <${FROM_EMAIL}>`, to, subject, html })
    return true
  } catch (err) {
    console.error('[Email] Send failed:', (err as Error).message)
    return false
  }
}

export async function sendWelcomeEmail(email: string, name: string): Promise<boolean> {
  return sendEmail(email, 'Bem-vindo ao Bottrade!', `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #111114; color: #e4e4e7; padding: 32px; border-radius: 8px;">
      <h1 style="color: #6366f1;">Bottrade<span style="color: #6366f1;">.</span></h1>
      <h2>Bem-vindo, ${escapeHtml(name)}!</h2>
      <p>Sua conta foi criada com sucesso. Comece a operar com dados agora.</p>
      <a href="${APP_URL}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 16px;">Acessar Dashboard</a>
      <p style="color: #71717a; margin-top: 24px; font-size: 12px;">Se você não criou esta conta, ignore este email.</p>
    </div>
  `)
}

export async function sendPasswordResetEmail(email: string, resetToken: string): Promise<boolean> {
  const resetUrl = `${APP_URL}?reset=${resetToken}`
  return sendEmail(email, 'Redefinir senha — Bottrade', `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #111114; color: #e4e4e7; padding: 32px; border-radius: 8px;">
      <h1 style="color: #6366f1;">Bottrade<span style="color: #6366f1;">.</span></h1>
      <h2>Redefinir senha</h2>
      <p>Clique no botão abaixo para redefinir sua senha. Este link expira em 1 hora.</p>
      <a href="${resetUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 16px;">Redefinir Senha</a>
      <p style="color: #71717a; margin-top: 24px; font-size: 12px;">Se você não solicitou esta redefinição, ignore este email.</p>
    </div>
  `)
}

export async function sendTradeNotification(email: string, trade: { symbol: string; direction: string; result: string; pnl: number }): Promise<boolean> {
  const safeSymbol = escapeHtml(trade.symbol)
  const safeDirection = escapeHtml(trade.direction)
  const safeResult = escapeHtml(trade.result)
  const color = trade.result === 'WIN' ? '#22c55e' : '#ef4444'
  return sendEmail(email, `[Bottrade] ${safeSymbol} ${safeResult} ${trade.pnl > 0 ? '+' : ''}${trade.pnl.toFixed(2)}%`, `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #111114; color: #e4e4e7; padding: 32px; border-radius: 8px;">
      <h1 style="color: #6366f1;">Bottrade<span style="color: #6366f1;">.</span></h1>
      <h2>Trade Finalizado</h2>
      <p><strong>${safeSymbol}</strong> — ${safeDirection}</p>
      <p style="font-size: 24px; color: ${color}; font-weight: bold;">${safeResult} ${trade.pnl > 0 ? '+' : ''}${trade.pnl.toFixed(2)}%</p>
      <a href="${APP_URL}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 16px;">Ver Detalhes</a>
    </div>
  `)
}
