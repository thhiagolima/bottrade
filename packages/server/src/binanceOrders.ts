import crypto from 'crypto'
import axios from 'axios'
import type { OrderRequest, OrderResult } from '@bottrade/shared'
import { config } from './config.js'
import { getExchangeProvider } from './exchangeMarket.js'

function sign(queryString: string, apiSecret: string): string {
  return crypto.createHmac('sha256', apiSecret).update(queryString).digest('hex')
}

function signBybit(payload: string, apiSecret: string): string {
  return crypto.createHmac('sha256', apiSecret).update(payload).digest('hex')
}

async function placeBybitMarketOrder(
  request: OrderRequest,
  apiKey: string,
  apiSecret: string,
): Promise<OrderResult> {
  if (!apiKey || !apiSecret) {
    return { success: false, symbol: request.symbol, side: request.side, error: 'API keys not configured', timestamp: Date.now() }
  }

  const baseUrl = process.env.BYBIT_TESTNET === 'true' ? 'https://api-testnet.bybit.com' : config.bybit.restBaseUrl
  const timestamp = Date.now().toString()
  const recvWindow = '5000'
  const body = {
    category: config.bybit.category,
    symbol: request.symbol,
    side: request.side === 'BUY' ? 'Buy' : 'Sell',
    orderType: 'Market',
    qty: request.quantity.toString(),
    ...(request.takeProfit ? { takeProfit: request.takeProfit.toString() } : {}),
    ...(request.stopLoss ? { stopLoss: request.stopLoss.toString() } : {}),
  }
  const bodyString = JSON.stringify(body)
  const signature = signBybit(`${timestamp}${apiKey}${recvWindow}${bodyString}`, apiSecret)

  try {
    const resp = await axios.post(`${baseUrl}/v5/order/create`, bodyString, {
      headers: {
        'X-BAPI-API-KEY': apiKey,
        'X-BAPI-SIGN': signature,
        'X-BAPI-TIMESTAMP': timestamp,
        'X-BAPI-RECV-WINDOW': recvWindow,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    })

    if (resp.data?.retCode !== 0) {
      return {
        success: false,
        symbol: request.symbol,
        side: request.side,
        error: resp.data?.retMsg || 'Bybit order failed',
        timestamp: Date.now(),
      }
    }

    return {
      success: true,
      orderId: String(resp.data?.result?.orderId || ''),
      symbol: request.symbol,
      side: request.side,
      quantity: request.quantity,
      timestamp: Date.now(),
    }
  } catch (err) {
    const msg = axios.isAxiosError(err) ? (err.response?.data?.retMsg || err.response?.data?.msg || err.message) : (err as Error).message
    return { success: false, symbol: request.symbol, side: request.side, error: msg, timestamp: Date.now() }
  }
}

export async function placeMarketOrder(
  request: OrderRequest,
  apiKey: string,
  apiSecret: string,
  testnet = true
): Promise<OrderResult> {
  if (getExchangeProvider() === 'bybit') {
    return placeBybitMarketOrder(request, apiKey, apiSecret)
  }

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
