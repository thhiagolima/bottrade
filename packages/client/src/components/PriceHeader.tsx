import type { PriceData } from '@bottrade/shared'
import { formatPrice, formatVolume } from '../utils/format'

export default function PriceHeader({ price }: { price: PriceData }) {
  const changePositive = price.change24h >= 0
  const fundingAbs = Math.abs(price.fundingRate)
  const fundingExtreme = fundingAbs > 0.001

  let fundingColor = 'text-bull'
  if (price.fundingRate >= 0 && price.fundingRate <= 0.0005) {
    fundingColor = 'text-warn'
  } else if (price.fundingRate > 0.0005) {
    fundingColor = 'text-bear'
  }

  return (
    <div className="px-3 py-2.5" data-tour="price-header">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1">
        <h2 className="min-w-0 truncate text-sm md:text-base font-display font-bold" title={price.symbol}>
          {price.symbol}
        </h2>
        <div className="text-right">
          <div className="font-mono-num text-base md:text-xl font-semibold tabular-nums">
            {formatPrice(price.price)}
          </div>
          <div className={`font-mono-num text-xs md:text-sm font-bold tabular-nums ${changePositive ? 'text-bull' : 'text-bear'}`}>
            {changePositive ? '+' : ''}{price.change24h.toFixed(2)}%
          </div>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 md:flex md:flex-wrap md:items-center gap-x-3 gap-y-1 text-[11px] md:text-xs text-muted">
        <Metric label="Mark" value={formatPrice(price.markPrice)} />
        <Metric
          label="Funding"
          value={`${(price.fundingRate * 100).toFixed(4)}%`}
          valueClassName={fundingColor}
          suffix={fundingExtreme ? 'EXTREMO' : undefined}
        />
        <Metric label="Vol" value={formatVolume(price.volume24h)} />
        <Metric label="Prox." value={price.fundingCountdown || '00:00:00'} dim />
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
    <div className="min-w-0 flex items-center gap-1">
      <span className="text-dim">{label}:</span>
      <span className={`min-w-0 truncate font-mono-num tabular-nums ${dim ? 'text-dim' : valueClassName}`}>
        {value}
      </span>
      {suffix && (
        <span className="flex-shrink-0 px-1 py-0 text-[9px] font-bold bg-bear/20 text-bear rounded">
          {suffix}
        </span>
      )}
    </div>
  )
}
