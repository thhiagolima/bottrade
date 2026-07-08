import './sentry'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import { Sentry } from './sentry'
import App from './App'
import './styles/globals.css'

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!clerkPublishableKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY')
}

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <Sentry.ErrorBoundary fallback={<div className="min-h-screen bg-bg flex items-center justify-center text-muted font-display">Algo deu errado. Atualize a pagina.</div>}>
        <App />
      </Sentry.ErrorBoundary>
    </ClerkProvider>
  </React.StrictMode>
)
