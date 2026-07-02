import toast from 'react-hot-toast'
import type { Alert } from '@bottrade/shared'
import { useStore } from '../store/useStore'

const alertConfig: Record<Alert['type'], { dotColor: string; duration: number }> = {
  'direction-change': { dotColor: 'bg-warn', duration: 5000 },
  'funding-extreme': { dotColor: 'bg-bear', duration: 8000 },
  'stochrsi-extreme': { dotColor: 'bg-warn', duration: 5000 },
  'full-alignment': { dotColor: 'bg-bull', duration: 8000 },
}

const severityBorderColor: Record<Alert['severity'], string> = {
  info: 'var(--color-card-border)',
  warning: 'var(--color-warn)',
  critical: 'var(--color-bear)',
}

export function showAlert(alert: Alert): void {
  const config = alertConfig[alert.type]
  const borderColor = severityBorderColor[alert.severity]

  // Green border for full-alignment
  const finalBorder = alert.type === 'full-alignment' ? 'var(--color-bull)' : borderColor
  // Red border override for critical funding-extreme
  const criticalFundingBorder =
    alert.type === 'funding-extreme' && alert.severity === 'critical' ? 'var(--color-bear)' : finalBorder

  toast(
    (t) => (
      <div className="flex items-start gap-2 text-sm">
        <span className={`w-2 h-2 rounded-full ${config.dotColor} inline-block flex-shrink-0 mt-1.5`} />
        <div>
          <div className="font-bold font-mono-num">{alert.symbol}</div>
          <div className="text-muted text-xs">{alert.message}</div>
        </div>
      </div>
    ),
    {
      duration: config.duration,
      style: {
        background: 'var(--color-card)',
        color: 'var(--color-text)',
        border: `2px solid ${criticalFundingBorder}`,
      },
    }
  )

  // Sound alert
  const settings = useStore.getState().settings
  if (settings.soundAlerts) {
    try {
      const audio = new Audio('/alert.mp3')
      audio.play().catch(() => {
        // Gracefully handle missing audio file or autoplay block
      })
    } catch {
      // Gracefully handle
    }
  }

  // Desktop notification
  if (settings.desktopNotifications && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(`${alert.symbol} - ${alert.type}`, {
        body: alert.message,
        icon: '/favicon.ico',
      })
    } catch {
      // Gracefully handle
    }
  }
}
