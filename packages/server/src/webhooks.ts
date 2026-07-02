import axios from 'axios'

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

export interface WebhookConfig {
  url: string
  type: 'discord' | 'slack' | 'custom'
  events: string[] // 'trade_opened', 'trade_closed', 'high_confidence'
  active: boolean
}

export async function sendWebhook(config: WebhookConfig, event: string, data: Record<string, unknown>): Promise<boolean> {
  if (!config.active || !config.events.includes(event)) return false

  if (!isUrlSafe(config.url)) {
    console.warn(`[Webhook] Blocked unsafe URL: ${config.url}`)
    return false
  }

  try {
    if (config.type === 'discord') {
      await sendDiscordWebhook(config.url, event, data)
    } else if (config.type === 'slack') {
      await sendSlackWebhook(config.url, event, data)
    } else {
      await sendCustomWebhook(config.url, event, data)
    }
    return true
  } catch (err) {
    console.error(`[Webhook] Failed to send ${config.type}:`, (err as Error).message)
    return false
  }
}

async function sendDiscordWebhook(url: string, event: string, data: Record<string, unknown>): Promise<void> {
  const color = event === 'trade_closed' && data.result === 'WIN' ? 0x22c55e : event === 'trade_closed' ? 0xef4444 : 0x6366f1

  await axios.post(url, {
    embeds: [{
      title: `Bottrade — ${event.replace('_', ' ').toUpperCase()}`,
      description: formatEventMessage(event, data),
      color,
      timestamp: new Date().toISOString(),
      footer: { text: 'Bottrade Trading Bot' }
    }]
  }, { timeout: 5000, maxRedirects: 0 })
}

async function sendSlackWebhook(url: string, event: string, data: Record<string, unknown>): Promise<void> {
  const emoji = event === 'trade_closed' && data.result === 'WIN' ? ':chart_with_upwards_trend:' : event === 'trade_closed' ? ':chart_with_downwards_trend:' : ':bell:'

  await axios.post(url, {
    text: `${emoji} *Bottrade — ${event.replace('_', ' ').toUpperCase()}*\n${formatEventMessage(event, data)}`
  }, { timeout: 5000, maxRedirects: 0 })
}

async function sendCustomWebhook(url: string, event: string, data: Record<string, unknown>): Promise<void> {
  await axios.post(url, {
    event,
    data,
    timestamp: new Date().toISOString(),
    source: 'bottrade'
  }, { timeout: 5000, maxRedirects: 0, headers: { 'Content-Type': 'application/json' } })
}

function formatEventMessage(event: string, data: Record<string, unknown>): string {
  switch (event) {
    case 'trade_opened':
      return `**${data.symbol}** — ${data.direction} @ $${data.entryPrice}\nSL: $${data.stopLoss} | TP: $${data.takeProfit}`
    case 'trade_closed':
      return `**${data.symbol}** — ${data.direction}\nResultado: **${data.result}** | P&L: ${Number(data.pnl) > 0 ? '+' : ''}${data.pnl}%`
    case 'high_confidence':
      return `**${data.symbol}** — Sinal ${data.direction} com score ${data.score}\nConfiança ALTA`
    default:
      return JSON.stringify(data)
  }
}
