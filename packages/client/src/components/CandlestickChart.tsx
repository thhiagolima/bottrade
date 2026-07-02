import { useEffect, useRef } from 'react'
import { createChart, CandlestickSeries, LineSeries } from 'lightweight-charts'
import type { IChartApi, ISeriesApi, CandlestickData, LineData, Time } from 'lightweight-charts'
import type { CandleData, IndicatorValues } from '@bottrade/shared'

function calculateSMA(candles: CandleData[], period: number): { time: Time; value: number }[] {
  const result: { time: Time; value: number }[] = []
  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) {
      sum += candles[j].close
    }
    result.push({
      time: (candles[i].timestamp / 1000) as Time,
      value: sum / period,
    })
  }
  return result
}

export default function CandlestickChart({
  candles,
  indicators,
}: {
  candles: CandleData[]
  indicators: IndicatorValues
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const ma20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const ma50SeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const ma200SeriesRef = useRef<ISeriesApi<'Line'> | null>(null)

  // Create chart on mount
  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      height: 300,
      layout: {
        background: { color: '#0f0f0f' },
        textColor: '#888',
      },
      grid: {
        vertLines: { color: '#1a1a1a' },
        horzLines: { color: '#1a1a1a' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#2a2a2a',
      },
      rightPriceScale: {
        borderColor: '#2a2a2a',
      },
      crosshair: {
        mode: 0,
      },
    })

    chartRef.current = chart

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#00c896',
      downColor: '#ff4444',
      borderUpColor: '#00c896',
      borderDownColor: '#ff4444',
      wickUpColor: '#00c896',
      wickDownColor: '#ff4444',
    })
    candleSeriesRef.current = candleSeries

    const ma20Series = chart.addSeries(LineSeries, {
      color: '#3b82f6',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    })
    ma20SeriesRef.current = ma20Series

    const ma50Series = chart.addSeries(LineSeries, {
      color: '#f97316',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    })
    ma50SeriesRef.current = ma50Series

    const ma200Series = chart.addSeries(LineSeries, {
      color: 'rgba(255, 255, 255, 0.4)',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    })
    ma200SeriesRef.current = ma200Series

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect
        chart.applyOptions({ width })
      }
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      chart.remove()
      chartRef.current = null
    }
  }, [])

  // Update data on candles/indicators change
  useEffect(() => {
    if (!candleSeriesRef.current || candles.length === 0) return

    // Deduplicate by timestamp and sort ascending
    const seen = new Set<number>()
    const uniqueCandles = candles.filter((c) => {
      const t = Math.floor(c.timestamp / 1000)
      if (seen.has(t)) return false
      seen.add(t)
      return true
    }).sort((a, b) => a.timestamp - b.timestamp)

    const candleData: CandlestickData<Time>[] = uniqueCandles.map((c) => ({
      time: (Math.floor(c.timestamp / 1000)) as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }))

    candleSeriesRef.current.setData(candleData)

    // Calculate and set MA data from deduplicated candles
    const ma20Data = calculateSMA(uniqueCandles, 20)
    const ma50Data = calculateSMA(uniqueCandles, 50)
    const ma200Data = calculateSMA(uniqueCandles, 200)

    if (ma20SeriesRef.current) ma20SeriesRef.current.setData(ma20Data as LineData<Time>[])
    if (ma50SeriesRef.current) ma50SeriesRef.current.setData(ma50Data as LineData<Time>[])
    if (ma200SeriesRef.current) ma200SeriesRef.current.setData(ma200Data as LineData<Time>[])

    // Fit content
    chartRef.current?.timeScale().fitContent()
  }, [candles, indicators])

  return (
    <div className="bg-card border border-card-border rounded-lg overflow-hidden">
      <div ref={containerRef} style={{ height: 300 }} />
    </div>
  )
}
