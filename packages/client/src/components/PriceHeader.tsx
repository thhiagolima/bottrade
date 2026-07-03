import type { PriceData } from '@bottrade/shared'
import { formatPrice, formatVolume } from '../utils/format'

export default function PriceHeader({ price }: { price: PriceData }) {
  const changePositive = price.change24h >= 0
  const fundingAbs = Math.abs(price.fundingRate)
  const fundingExtreme = fundingAbs > 0.001
  const asset = price.symbol.replace(/USDT$/, '')
  const quote = price.symbol.endsWith('USDT') ? 'USDT' : ''

  let fundingColor = 'text-bull'
  if (price.fundingRate >= 0 && price.fundingRate <= 0.0005) {
    fundingColor = 'text-warn'
  } else if (price.fundingRate > 0.0005) {
    fundingColor = 'text-bear'
  }

  return (
    <div className="px-4 py-4 md:px-5 md:py-5" data-tour="price-header">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-card-border bg-bg-elevated text-sm font-black text-accent">
              {asset.slice(0, 1)}
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-baseline gap-2">
                <h2 className="min-w-0 truncate text-2xl font-black tracking-tight text-white md:text-3xl font-mono-num" title={price.symbol}>
                  {asset}
                </h2>
                {quote && <span className="text-sm font-bold text-muted font-mono-num">{quote}</span>}
                <span className="rounded border border-card-border bg-card-hover px-1.5 py-0.5 text-[10px] font-bold text-muted">PERP</span>
              </div>
              <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-dim">Analise em tempo real</div>
            </div>
          </div>
        </div>

        <div className="min-w-0 text-left lg:text-right">
          <div className="font-mono-num text-3xl font-black tabular-nums text-white md:text-4xl">
            {formatPrice(price.price)}
          </div>
          <div className={`mt-1 inline-flex rounded px-2 py-0.5 font-mono-num text-sm font-black tabular-nums ${
            changePositive ? 'bg-bull/10 text-bull' : 'bg-bear/10 text-bear'
          }`}>
            {changePositive ? '+' : ''}{price.change24h.toFixed(2)}%
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Metric label="Mark" value={formatPrice(price.markPrice)} />
        <Metric
          label="Funding"
          value={`${(price.fundingRate * 100).toFixed(4)}%`}
          valueClassName={fundingColor}
          suffix={fundingExtreme ? 'EXTREMO' : undefined}
        />
        <Metric label="Volume 24h" value={formatVolume(price.volume24h)} />
        <Metric label="Proximo funding" value={price.fundingCountdown || '00:00:00'} dim />
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  valueClassName = 'text-muted',
  suffix,
  dim = false,
}: {
  label: string
  value: string
  valueClassName?: string
  suffix?: string
  dim?: boolean
}) {
  return (
    <div className="min-w-0 rounded-lg border border-card-border bg-bg/45 px-3 py-2">
      <div className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-dim">{label}</div>
      <span className={`mt-1 block min-w-0 truncate font-mono-num text-xs font-bold tabular-nums ${dim ? 'text-muted' : valueClassName}`}>
        {value}
      </span>
      {suffix && (
        <span className="mt-1 inline-flex flex-shrink-0 rounded bg-bear/20 px-1 py-0 text-[9px] font-bold text-bear">
          {suffix}
        </span>
      )}
    </div>
  )
}
