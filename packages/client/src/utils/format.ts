/**
 * Format a crypto price preserving meaningful precision.
 * - BTC ($70,425.60) → "70,425.60"
 * - ETH ($2,153.06) → "2,153.06"
 * - DOGE ($0.16800) → "0.16800"
 * - SHIB ($0.00002341) → "0.00002341"
 */
export function formatPrice(value: number): string {
  if (value === 0) return '0.00'

  const abs = Math.abs(value)

  // For prices >= 1, use 2 decimal places with comma separators
  if (abs >= 1) {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  // For prices < 1, preserve significant digits
  // Find how many leading zeros after decimal
  const str = abs.toFixed(20)
  const decimalPart = str.split('.')[1] || ''
  let leadingZeros = 0
  for (const ch of decimalPart) {
    if (ch === '0') leadingZeros++
    else break
  }

  // Show leading zeros + 4 significant digits
  const decimals = Math.max(4, leadingZeros + 4)
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/**
 * Format volume with K/M/B suffixes.
 */
export function formatVolume(vol: number): string {
  if (vol >= 1_000_000_000) return (vol / 1_000_000_000).toFixed(2) + 'B'
  if (vol >= 1_000_000) return (vol / 1_000_000).toFixed(2) + 'M'
  if (vol >= 1_000) return (vol / 1_000).toFixed(2) + 'K'
  return vol.toFixed(2)
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDateTime(dateString: string | null): string {
  if (!dateString) return '-'
  // Handle MySQL format "2026-03-24 10:45:08" or ISO "2026-03-24T10:45:08.000Z"
  const d = new Date(dateString)
  if (isNaN(d.getTime())) return dateString
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${day}/${month}\u00A0${hours}:${minutes}`
}
