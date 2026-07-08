import * as Sentry from '@sentry/node'

const sentryDsn = process.env.SENTRY_DSN
const environment = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development'
const release = process.env.SENTRY_RELEASE
const tracesSampleRate = Number.parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1')

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment,
    release,
    tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0.1,
    sendDefaultPii: false,
  })
}
