import { useStore } from '../store/useStore'
import { formatPrice, formatVolume } from '../utils/format'
import type { PairAnalysis } from '@bottrade/shared'

const directionColors: Record<string, { bg: string; text: string }> = {
  LONG: { bg: 'bg-bull', text: 'text-bull' },
  SHORT: { bg: 'bg-bear', text: 'text-bear' },
  NEUTRO: { bg: 'bg-warn', text: 'text-warn' },
}

function CompareColumn({ analysis }: { analysis: PairAnalysis }) {
  const direction = analysis.signal?.direction ?? 'NEUTRO'
  const colors = directionColors[direction] ?? directionColors.NEUTRO
  const score = Math.min(100, Math.max(0, analysis.signal.confluenceScore))
  const { indicators, price, signal } = analysis
  const risk = signal.riskManagement
  const changePositive = price.change24h >= 0

  const maRows: { name: string; value: number }[] = [
    { name: 'MA20', value: indicators.ma20 },
    { name: 'MA50', value: indicators.ma50 },
    { name: 'MA100', value: indicators.ma100 },
    { name: 'MA200', value: indicators.ma200 },
  ]

  const { macd, stochRsi, volume } = indicators

  const fundingColor =
    price.fundingRate >= 0 && price.fundingRate <= 0.0005
      ? 'text-warn'
      : price.fundingRate > 0.0005
        ? 'text-bear'
        : 'text-bull'

  return (
    <div className="flex-1 min-w-0 border-r border-card-border last:border-r-0 flex flex-col">
      {/* Header: symbol, price, direction badge, score */}
      <div className="p-3 border-b border-card-border">
        <div className="flex items-center justify-between mb-1">
          <span className="font-bold text-sm truncate">{analysis.symbol}</span>
          <span className={`px-1.5 py-0.5 text-[10px] font-bold text-white rounded flex-shrink-0 ${colors.bg}`}>
            {direction} {score.toFixed(0)}
          </span>
        </div>
        <div className="flex items-baseline justify-between mb-1">
          <span className="font-mono-num text-base font-bold">${formatPrice(price.price)}</span>
          <span className={`font-mono-num text-xs ${changePositive ? 'text-bull' : 'text-bear'}`}>
            {changePositive ? '+' : ''}{price.change24h.toFixed(2)}%
          </span>
        </div>
        {/* Score bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'linear-gradient(to right, var(--color-bear), var(--color-warn), var(--color-bull))' }}>
            <div className="h-full bg-white/30 rounded-full" style={{ width: `${score}%` }} />
          </div>
          <span className="font-mono-num text-[10px] text-muted w-8 text-right">{score.toFixed(0)}%</span>
        </div>
      </div>

      {/* Indicators */}
      <div className="p-2 border-b border-card-border space-y-1.5 text-xs">
        <h4 className="text-muted font-bold text-[10px]">INDICADORES</h4>
        {/* MAs */}
        {maRows.map((row) => (
          <div key={row.name} className="flex items-center justify-between">
            <span className="text-muted">{row.name}</span>
            <span>{price.price >= row.value ? <svg className="w-3 h-3 text-bull inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> : <svg className="w-3 h-3 text-bear inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}</span>
          </div>
        ))}

        {/* MACD */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-muted">MACD</span>
          <span className={`font-mono-num font-bold ${macd.histogram >= 0 ? 'text-bull' : 'text-bear'}`}>
            {macd.histogram >= 0 ? '+' : ''}{macd.histogram.toFixed(4)}
          </span>
        </div>
        {macd.divergence && (
          <div className="text-right">
            <span className={`px-1 py-0.5 text-[9px] font-bold rounded ${
              macd.divergence === 'bullish' ? 'bg-bull/20 text-bull' : 'bg-bear/20 text-bear'
            }`}>
              DIV {macd.divergence === 'bullish' ? 'BULL' : 'BEAR'}
            </span>
          </div>
        )}

        {/* StochRSI */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-muted">StochRSI</span>
          <span className="font-mono-num">
            K:{stochRsi.k.toFixed(0)} D:{stochRsi.d.toFixed(0)}
          </span>
        </div>
        <div className="text-right">
          <span className={`text-[10px] font-bold ${
            stochRsi.zone === 'overbought' ? 'text-bear' :
            stochRsi.zone === 'oversold' ? 'text-bull' : 'text-warn'
          }`}>
            {stochRsi.zone === 'overbought' ? 'SOBRECOMPRA' :
             stochRsi.zone === 'oversold' ? 'SOBREVENDA' : 'NEUTRO'}
          </span>
        </div>

        {/* Volume */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-muted">Vol</span>
          <span className="font-mono-num">{formatVolume(volume.current)}</span>
        </div>
        {volume.isSpike && (
          <div className="text-right">
            <span className="px-1 py-0.5 text-[9px] font-bold bg-warn/20 text-warn rounded">SPIKE</span>
          </div>
        )}

        {/* Funding */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-muted">Fund</span>
          <span className={`font-mono-num ${fundingColor}`}>
            {(price.fundingRate * 100).toFixed(4)}%
          </span>
        </div>
      </div>

      {/* Risk Management */}
      <div className="p-2 border-b border-card-border text-xs space-y-1">
        <h4 className="text-muted font-bold text-[10px]">RISCO</h4>
        {risk && direction !== 'NEUTRO' ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-muted">Entry</span>
              <span className="font-mono-num">{formatPrice(risk.entry)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">SL</span>
              <span className="font-mono-num text-bear">{formatPrice(risk.stopLoss)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">TP</span>
              <span className="font-mono-num text-bull">{formatPrice(risk.takeProfit)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">R:R</span>
              <span className="font-mono-num font-bold">{risk.riskRewardRatio.toFixed(2)}</span>
            </div>
          </>
        ) : (
          <span className="text-muted">N/A</span>
        )}
      </div>

      {/* Multi-timeframe */}
      {analysis.multiTimeframe && (
        <div className="p-2 border-b border-card-border text-xs space-y-1">
          <h4 className="text-muted font-bold text-[10px]">MULTI-TF</h4>
          <div className="text-[10px] text-muted break-words">{analysis.multiTimeframe.summary}</div>
          <span className={`inline-block px-1 py-0.5 text-[9px] font-bold rounded ${
            analysis.multiTimeframe.alignment === 'aligned' ? 'bg-bull/20 text-bull' :
            analysis.multiTimeframe.alignment === 'conflicting' ? 'bg-bear/20 text-bear' :
            'bg-warn/20 text-warn'
          }`}>
            {analysis.multiTimeframe.alignment === 'aligned' ? 'ALINHADO' :
             analysis.multiTimeframe.alignment === 'conflicting' ? 'CONFLITO' : 'PARCIAL'}
          </span>
        </div>
      )}

      {/* BTC Correlation */}
      {analysis.btcCorrelation && (
        <div className="p-2 text-xs space-y-1">
          <h4 className="text-muted font-bold text-[10px]">BTC CORR</h4>
          <div className="flex items-center justify-between">
            <span className="text-muted">BTC</span>
            <span className={`font-bold ${
              analysis.btcCorrelation.btcDirection === 'LONG' ? 'text-bull' :
              analysis.btcCorrelation.btcDirection === 'SHORT' ? 'text-bear' : 'text-warn'
            }`}>
              {analysis.btcCorrelation.btcDirection} {analysis.btcCorrelation.btcScore.toFixed(0)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">Alinhado</span>
            <span>{analysis.btcCorrelation.aligned ? <svg className="w-3 h-3 text-bull inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> : <svg className="w-3 h-3 text-bear inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}</span>
          </div>
          {analysis.btcCorrelation.warning && (
            <div className="text-[10px] text-warn break-words">{analysis.btcCorrelation.warning}</div>
          )}
        </div>
      )}
    </div>
  )
}

export default function CompareView() {
  const pairs = useStore((s) => s.pairs)
  const favorites = useStore((s) => s.favorites)
  const comparePairs = useStore((s) => s.comparePairs)
  const addComparePair = useStore((s) => s.addComparePair)
  const removeComparePair = useStore((s) => s.removeComparePair)
  const toggleCompareMode = useStore((s) => s.toggleCompareMode)

  // Available pairs to add (favorites that have data and aren't already selected)
  const availablePairs = favorites.filter(
    (symbol) => pairs[symbol] && !comparePairs.includes(symbol)
  )

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-card-border bg-card">
        <h3 className="text-xs font-bold text-white">Modo Comparacao</h3>

        {/* Selected pair chips */}
        <div className="flex items-center gap-1.5 flex-1">
          {comparePairs.map((symbol) => (
            <span
              key={symbol}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold bg-card-border rounded"
            >
              {symbol.replace('USDT', '')}
              <button
                onClick={() => removeComparePair(symbol)}
                className="text-muted hover:text-bear transition-colors cursor-pointer p-0.5"
                title={`Remover ${symbol}`}
              >
                x
              </button>
            </span>
          ))}

          {/* Add dropdown */}
          {comparePairs.length < 3 && availablePairs.length > 0 && (
            <select
              className="px-2 py-0.5 text-xs bg-bg border border-card-border rounded text-white font-mono-num"
              value=""
              onChange={(e) => {
                if (e.target.value) addComparePair(e.target.value)
              }}
            >
              <option value="">+ Adicionar</option>
              {availablePairs.map((symbol) => (
                <option key={symbol} value={symbol}>
                  {symbol.replace('USDT', '')}
                </option>
              ))}
            </select>
          )}
        </div>

        <button
          onClick={toggleCompareMode}
          className="px-3 py-1 text-xs font-bold text-bear hover:bg-bear/10 rounded transition-colors"
        >
          Sair
        </button>
      </div>

      {/* Comparison columns */}
      {comparePairs.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-muted text-xs">
          Selecione pares na sidebar ou no dropdown acima (max 3)
        </div>
      ) : (
        <div className="flex-1 flex overflow-x-auto overflow-y-auto">
          {comparePairs.map((symbol) => {
            const analysis = pairs[symbol]
            if (!analysis) return null
            return <CompareColumn key={symbol} analysis={analysis} />
          })}
        </div>
      )}
    </div>
  )
}
