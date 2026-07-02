import axios from 'axios'

export async function sendTelegramMessage(
  text: string,
  botToken: string,
  chatId: string
): Promise<boolean> {
  if (!botToken || !chatId) return false
  try {
    await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    }, { timeout: 5000 })
    return true
  } catch (err) {
    console.error('[Telegram] Failed to send:', (err as Error).message)
    return false
  }
}

export async function sendTestMessage(
  botToken: string,
  chatId: string
): Promise<{ success: boolean; error?: string }> {
  if (!botToken || !chatId) {
    return { success: false, error: 'Token ou Chat ID não configurado' }
  }
  try {
    await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      chat_id: chatId,
      text: '✅ <b>Bottrade</b> — Conexão com Telegram verificada com sucesso!',
      parse_mode: 'HTML'
    }, { timeout: 5000 })
    return { success: true }
  } catch (err: any) {
    const msg = err.response?.data?.description || err.message
    return { success: false, error: msg }
  }
}

export function formatSignalMessage(data: {
  symbol: string
  direction: 'LONG' | 'SHORT'
  score: number
  price: number
  stopLoss?: number
  takeProfit?: number
  criticalDecision: string
}): string {
  const icon = data.direction === 'LONG' ? '🟢' : '🔴'
  let msg = `${icon} <b>SINAL ${data.direction}</b> - ${data.symbol}\n\n`
  msg += `💰 Preço: <code>${data.price}</code>\n`
  msg += `📊 Score: <b>${data.score.toFixed(0)}%</b> (Alta Confiança)\n`
  if (data.stopLoss) msg += `🛑 Stop Loss: <code>${data.stopLoss}</code>\n`
  if (data.takeProfit) msg += `🎯 Take Profit: <code>${data.takeProfit}</code>\n`
  msg += `\n📋 ${data.criticalDecision}`
  return msg
}

export function formatTradeClosedMessage(data: {
  symbol: string
  direction: string
  result: 'WIN' | 'LOSS'
  pnlPercent: number
  entryPrice: number
  exitPrice: number
}): string {
  const icon = data.result === 'WIN' ? '✅' : '❌'
  let msg = `${icon} <b>TRADE ${data.result}</b> - ${data.symbol}\n\n`
  msg += `📈 Direção: ${data.direction}\n`
  msg += `💰 Entry: <code>${data.entryPrice}</code>\n`
  msg += `💰 Exit: <code>${data.exitPrice}</code>\n`
  msg += `📊 P&L: <b>${data.pnlPercent >= 0 ? '+' : ''}${data.pnlPercent.toFixed(2)}%</b>`
  return msg
}
